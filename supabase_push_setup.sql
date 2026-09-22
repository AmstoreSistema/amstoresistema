-- ==============================================================================
-- SETUP COMPLETO DE NOTIFICAÇÕES PUSH VIA FIREBASE (SUPABASE SQL EDITOR)
-- Execute este script no SQL Editor do painel do Supabase
-- ==============================================================================

-- 1. Criação da tabela de tokens dos aparelhos dos administradores
CREATE TABLE IF NOT EXISTS public.device_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform TEXT NOT NULL DEFAULT 'android',
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_device_tokens_user_token UNIQUE (user_id, token)
);

CREATE INDEX IF NOT EXISTS idx_device_tokens_user_id ON public.device_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_device_tokens_token ON public.device_tokens(token);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.device_tokens TO authenticated;
GRANT ALL ON public.device_tokens TO service_role;

ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own device tokens" ON public.device_tokens;
CREATE POLICY "Users can manage their own device tokens"
ON public.device_tokens
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins have full access to device tokens" ON public.device_tokens;
CREATE POLICY "Admins have full access to device tokens"
ON public.device_tokens
FOR ALL
TO authenticated
USING (
    public.has_role(auth.uid(), 'admin')
    OR auth.jwt()->>'email' IN ('amstorebagshoes@gmail.com', 'matosmonica000@gmail.com')
)
WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR auth.jwt()->>'email' IN ('amstorebagshoes@gmail.com', 'matosmonica000@gmail.com')
);

-- 2. Habilita extensões para chamadas HTTP assíncronas e agendamento (de forma segura)
DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
EXCEPTION WHEN OTHERS THEN
    -- Ignora se já estiver habilitada ou precisar ser ativada via UI
    NULL;
END;
$$;

DO $$
BEGIN
    CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
EXCEPTION WHEN OTHERS THEN
    -- pg_cron pode requerer ativação em Database -> Extensions
    NULL;
END;
$$;

-- 3. Função auxiliar genérica para invocar a Edge Function send-push-notification
CREATE OR REPLACE FUNCTION public.notify_push_notification(
    p_title TEXT,
    p_body TEXT,
    p_data JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_url TEXT;
    v_anon_key TEXT;
BEGIN
    v_url := 'https://ebooolaabwsuwmqhcqkv.supabase.co/functions/v1/send-push-notification';
    v_anon_key := 'sb_publishable_DJQXpWPvlKvYzLR9FiGDwA_2xsBbp0L';

    -- Dispara de forma assíncrona usando pg_net (não bloqueia a transação do banco)
    PERFORM net.http_post(
        url := v_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'apikey', v_anon_key,
            'Authorization', 'Bearer ' || v_anon_key
        ),
        body := jsonb_build_object(
            'title', p_title,
            'body', p_body,
            'data', p_data
        )
    );
EXCEPTION WHEN OTHERS THEN
    -- Garante que NUNCA trave a operação de venda, pagamento ou estoque se houver falha de rede/notificação
    RAISE WARNING '[notify_push_notification] Erro ao disparar notificação: %', SQLERRM;
END;
$$;

-- 4. Trigger: Venda Realizada (tabela sales)
CREATE OR REPLACE FUNCTION public.trg_fn_notify_new_sale()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_seller_name TEXT := '';
    v_formatted_amount TEXT;
    v_title TEXT := 'Nova venda registrada';
    v_body TEXT;
BEGIN
    IF NEW.seller_id IS NOT NULL THEN
        SELECT COALESCE(display_name, '')
        INTO v_seller_name
        FROM public.user_profiles
        WHERE id = NEW.seller_id;
    END IF;

    v_formatted_amount := 'R$ ' || REPLACE(TO_CHAR(ROUND(COALESCE(NEW.total_amount, 0)::numeric, 2), 'FM999999990.00'), '.', ',');

    IF v_seller_name IS NOT NULL AND v_seller_name <> '' THEN
        v_body := 'Venda ' || COALESCE(NEW.sale_code, '') || ' no valor de ' || v_formatted_amount || ' registrada por ' || v_seller_name || '.';
    ELSE
        v_body := 'Venda ' || COALESCE(NEW.sale_code, '') || ' no valor de ' || v_formatted_amount || ' registrada no sistema.';
    END IF;

    PERFORM public.notify_push_notification(
        v_title,
        v_body,
        jsonb_build_object(
            'type', 'new_sale',
            'sale_id', NEW.id,
            'sale_code', COALESCE(NEW.sale_code, ''),
            'url', '/sales'
        )
    );

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[trg_fn_notify_new_sale] Erro ao disparar notificação de venda: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_new_sale ON public.sales;
CREATE TRIGGER trg_notify_new_sale
AFTER INSERT ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.trg_fn_notify_new_sale();

-- 5. Trigger: Fiado Quitado (tabela sale_installments)
CREATE OR REPLACE FUNCTION public.trg_fn_notify_fiado_quitado()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_sale_code TEXT;
    v_client_name TEXT;
    v_formatted_amount TEXT;
    v_title TEXT := 'Fiado quitado';
    v_body TEXT;
BEGIN
    IF (OLD.status IS NULL OR LOWER(OLD.status) NOT IN ('paga', 'paid', 'quitada'))
       AND (NEW.status IS NOT NULL AND LOWER(NEW.status) IN ('paga', 'paid', 'quitada')) THEN

        SELECT s.sale_code, c.name
        INTO v_sale_code, v_client_name
        FROM public.sales s
        LEFT JOIN public.clients c ON c.id = s.client_id
        WHERE s.id = NEW.sale_id;

        v_formatted_amount := 'R$ ' || REPLACE(TO_CHAR(ROUND(COALESCE(NEW.amount, 0)::numeric, 2), 'FM999999990.00'), '.', ',');

        v_body := 'Parcela no valor de ' || v_formatted_amount || ' quitada com sucesso';
        IF v_client_name IS NOT NULL AND v_client_name <> '' THEN
            v_body := v_body || ' da cliente ' || v_client_name;
        END IF;
        IF v_sale_code IS NOT NULL AND v_sale_code <> '' THEN
            v_body := v_body || ' (Venda #' || v_sale_code || ').';
        ELSE
            v_body := v_body || '.';
        END IF;

        PERFORM public.notify_push_notification(
            v_title,
            v_body,
            jsonb_build_object(
                'type', 'fiado_quitado',
                'sale_id', NEW.sale_id,
                'installment_id', NEW.id,
                'url', '/credit'
            )
        );
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[trg_fn_notify_fiado_quitado] Erro ao disparar notificação de fiado quitado: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_fiado_quitado ON public.sale_installments;
CREATE TRIGGER trg_notify_fiado_quitado
AFTER UPDATE ON public.sale_installments
FOR EACH ROW
EXECUTE FUNCTION public.trg_fn_notify_fiado_quitado();

-- 6. Agendamento Diário: Fiados Vencidos
CREATE OR REPLACE FUNCTION public.run_daily_overdue_check()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_url TEXT;
    v_anon_key TEXT;
BEGIN
    v_url := 'https://ebooolaabwsuwmqhcqkv.supabase.co/functions/v1/check-overdue-fiados';
    v_anon_key := 'sb_publishable_DJQXpWPvlKvYzLR9FiGDwA_2xsBbp0L';

    PERFORM net.http_post(
        url := v_url,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'apikey', v_anon_key,
            'Authorization', 'Bearer ' || v_anon_key
        ),
        body := '{}'::jsonb
    );
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[run_daily_overdue_check] Erro no agendamento de fiados vencidos: %', SQLERRM;
END;
$$;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        PERFORM cron.unschedule('daily-check-overdue-fiados')
        WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'daily-check-overdue-fiados');

        -- 11:00 UTC = 08:00 Horário de Brasília
        PERFORM cron.schedule(
            'daily-check-overdue-fiados',
            '0 11 * * *',
            'SELECT public.run_daily_overdue_check();'
        );
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[pg_cron] pg_cron não disponível: %', SQLERRM;
END;
$$;

-- 7. Trigger: Estoque Baixo (tabela stock_products)
CREATE OR REPLACE FUNCTION public.trg_fn_notify_low_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_title TEXT := 'Estoque baixo';
    v_body TEXT;
    v_qtd INT;
BEGIN
    v_qtd := COALESCE(NEW.quantidade_disponivel, 0);

    IF v_qtd < 2 AND (OLD.quantidade_disponivel >= 2 OR OLD.quantidade_disponivel IS NULL) THEN
        v_body := 'O produto ' || NEW.produto_nome;
        
        IF NEW.categoria IS NOT NULL AND NEW.categoria <> '' THEN
            v_body := v_body || ' (' || NEW.categoria || ')';
        END IF;

        IF v_qtd <= 0 THEN
            v_body := v_body || ' zerou no estoque!';
        ELSIF v_qtd = 1 THEN
            v_body := v_body || ' está com apenas 1 unidade disponível!';
        ELSE
            v_body := v_body || ' atingiu estoque crítico (' || v_qtd || ' restantes).';
        END IF;

        PERFORM public.notify_push_notification(
            v_title,
            v_body,
            jsonb_build_object(
                'type', 'low_stock',
                'stock_id', NEW.id,
                'produto_id', NEW.produto_id,
                'quantidade', v_qtd,
                'url', '/stock'
            )
        );
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[trg_fn_notify_low_stock] Erro ao disparar notificação de estoque: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_low_stock ON public.stock_products;
CREATE TRIGGER trg_notify_low_stock
AFTER UPDATE OF quantidade_disponivel ON public.stock_products
FOR EACH ROW
EXECUTE FUNCTION public.trg_fn_notify_low_stock();
