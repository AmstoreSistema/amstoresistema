-- ==============================================================================
-- Migration: Push Notifications Triggers
-- Data: 2026-09-25 16:20:00 UTC
-- Triggers:
--   1. trg_notify_new_sale ON public.sales
--   2. trg_notify_fiado_quitado ON public.sale_installments
--   3. trg_notify_product_low_stock ON public.products
--   4. trg_notify_material_low_stock ON public.materials
-- ==============================================================================

-- 1. Função base para envio de push notification assíncrono via pg_net
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
    RAISE WARNING '[notify_push_notification] Erro ao disparar notificação: %', SQLERRM;
END;
$$;


-- 2. Trigger: Venda Realizada (tabela sales)
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


-- 3. Trigger: Fiado Quitado (tabela sale_installments)
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


-- 4. Trigger: Estoque Baixo em Produtos (tabela products)
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


-- 5. Trigger: Estoque Baixo em Materiais (tabela materials)
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
