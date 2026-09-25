-- ==============================================================================
-- SETUP COMPLETO DE NOTIFICAÇÕES PUSH VIA FIREBASE (SUPABASE SQL EDITOR)
-- Execute este script no SQL Editor do painel do Supabase
-- ==============================================================================

-- 1. Garante que a função auxiliar has_role exista para verificação de cargos/permissões
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1.1 Administradores fixos do sistema ou role no JWT
    IF _role = 'admin' AND (
        auth.jwt()->>'email' IN ('amstorebagshoes@gmail.com', 'matosmonica000@gmail.com')
        OR auth.jwt()->'app_metadata'->>'role' = 'admin'
        OR auth.jwt()->'user_metadata'->>'role' = 'admin'
    ) THEN
        RETURN TRUE;
    END IF;

    -- 1.2 Tenta consultar a tabela user_roles de forma defensiva
    BEGIN
        RETURN EXISTS (
            SELECT 1 FROM public.user_roles 
            WHERE user_id = _user_id AND role::text = _role
        );
    EXCEPTION WHEN OTHERS THEN
        RETURN FALSE;
    END;
END;
$$;

-- 2. Criação da tabela de tokens dos aparelhos dos administradores
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

-- 3. Habilita extensões para chamadas HTTP assíncronas e agendamento (de forma segura)
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

-- 4. Função auxiliar genérica para invocar a Edge Function send-push-notification
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
    v_url := 'https://zfxjocaypfgivnwncyqs.supabase.co/functions/v1/send-push-notification';
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

-- 4.0 Garante a existência das tabelas antes da criação dos triggers
CREATE TABLE IF NOT EXISTS public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_code TEXT,
    client_id UUID,
    seller_id UUID,
    total_amount NUMERIC NOT NULL DEFAULT 0,
    paid_amount NUMERIC NOT NULL DEFAULT 0,
    discount NUMERIC NOT NULL DEFAULT 0,
    discount_amount NUMERIC DEFAULT 0,
    payment_method TEXT NOT NULL DEFAULT 'dinheiro',
    protection_method TEXT,
    sale_type TEXT DEFAULT 'Varejo',
    status TEXT DEFAULT 'concluida',
    is_debt BOOLEAN DEFAULT FALSE,
    cashback_used NUMERIC DEFAULT 0,
    cashback_earned NUMERIC DEFAULT 0,
    financial_account_id UUID,
    due_date DATE,
    installments_count INTEGER DEFAULT 1,
    is_awarded BOOLEAN DEFAULT FALSE,
    promo_qr TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sale_installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
    installment_number INTEGER NOT NULL DEFAULT 1,
    amount NUMERIC NOT NULL DEFAULT 0,
    paid_amount NUMERIC DEFAULT 0,
    remaining_amount NUMERIC DEFAULT 0,
    due_date DATE NOT NULL DEFAULT CURRENT_DATE,
    paid_at TIMESTAMPTZ,
    payment_method TEXT,
    status TEXT DEFAULT 'pendente',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4.1 Trigger: Venda Realizada (tabela sales)
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
    v_url := 'https://zfxjocaypfgivnwncyqs.supabase.co/functions/v1/check-overdue-fiados';
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

-- 7. Triggers: Estoque Baixo (tabelas products e materials)
-- Dispara apenas quando current_stock transiciona para menor que min_stock
-- (e não estivesse já abaixo do mínimo antes, para não notificar repetidamente)

-- 7.1 Trigger para Produtos Acabados (products)
CREATE OR REPLACE FUNCTION public.trg_fn_notify_product_low_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_title TEXT := 'Estoque baixo';
    v_body TEXT;
    v_current NUMERIC;
    v_min NUMERIC;
    v_old_current NUMERIC;
BEGIN
    v_current := COALESCE(NEW.current_stock, 0);
    v_min := COALESCE(NEW.min_stock, 0);
    v_old_current := COALESCE(OLD.current_stock, v_min);

    -- Dispara apenas se o novo estoque estiver abaixo do mínimo E o anterior estava no mínimo ou acima
    IF v_current < v_min AND v_old_current >= v_min THEN
        IF v_current <= 0 THEN
            v_body := 'O produto "' || COALESCE(NEW.name, 'Sem nome') || '" ZEROU no estoque (mínimo: ' || v_min || ').';
        ELSE
            v_body := 'O produto "' || COALESCE(NEW.name, 'Sem nome') || '" está com estoque baixo: ' || v_current || ' restante(s) (mínimo: ' || v_min || ').';
        END IF;

        PERFORM public.notify_push_notification(
            v_title,
            v_body,
            jsonb_build_object(
                'type', 'low_stock_product',
                'product_id', NEW.id::text,
                'name', COALESCE(NEW.name, ''),
                'current_stock', v_current::text,
                'min_stock', v_min::text,
                'url', '/stock'
            )
        );
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[trg_fn_notify_product_low_stock] Erro ao disparar notificação de estoque: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_product_low_stock ON public.products;
CREATE TRIGGER trg_notify_product_low_stock
AFTER UPDATE OF current_stock ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.trg_fn_notify_product_low_stock();


-- 7.2 Trigger para Matérias-Primas / Insumos (materials)
CREATE OR REPLACE FUNCTION public.trg_fn_notify_material_low_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_title TEXT := 'Estoque baixo';
    v_body TEXT;
    v_current NUMERIC;
    v_min NUMERIC;
    v_old_current NUMERIC;
    v_unit TEXT;
BEGIN
    v_current := COALESCE(NEW.current_stock, 0);
    v_min := COALESCE(NEW.min_stock, 0);
    v_old_current := COALESCE(OLD.current_stock, v_min);
    v_unit := COALESCE(NEW.unit, 'un');

    -- Dispara apenas se o novo estoque estiver abaixo do mínimo E o anterior estava no mínimo ou acima
    IF v_current < v_min AND v_old_current >= v_min THEN
        IF v_current <= 0 THEN
            v_body := 'O material "' || COALESCE(NEW.name, 'Sem nome') || '" ZEROU no estoque (mínimo: ' || v_min || ' ' || v_unit || ').';
        ELSE
            v_body := 'O material "' || COALESCE(NEW.name, 'Sem nome') || '" está com estoque baixo: ' || v_current || ' ' || v_unit || ' restante(s) (mínimo: ' || v_min || ' ' || v_unit || ').';
        END IF;

        PERFORM public.notify_push_notification(
            v_title,
            v_body,
            jsonb_build_object(
                'type', 'low_stock_material',
                'material_id', NEW.id::text,
                'name', COALESCE(NEW.name, ''),
                'current_stock', v_current::text,
                'min_stock', v_min::text,
                'unit', v_unit,
                'url', '/materials'
            )
        );
    END IF;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[trg_fn_notify_material_low_stock] Erro ao disparar notificação de estoque: %', SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_material_low_stock ON public.materials;
CREATE TRIGGER trg_notify_material_low_stock
AFTER UPDATE OF current_stock ON public.materials
FOR EACH ROW
EXECUTE FUNCTION public.trg_fn_notify_material_low_stock();

-- Remove trigger e função antigos se existiam
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'stock_products') THEN
        DROP TRIGGER IF EXISTS trg_notify_low_stock ON public.stock_products;
    END IF;
    DROP FUNCTION IF EXISTS public.trg_fn_notify_low_stock();
END $$;
