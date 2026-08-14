
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

CREATE OR REPLACE FUNCTION public.sync_client_cashback_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_client_id uuid;
    v_total numeric;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_client_id := OLD.client_id;
    ELSE
        v_client_id := NEW.client_id;
    END IF;

    IF v_client_id IS NOT NULL THEN
        -- Only sum entries linked to non-deleted sales (or bonus entries without sale_id)
        SELECT COALESCE(SUM(
            CASE 
                WHEN ce.kind = 'earned' THEN ce.amount 
                WHEN ce.kind = 'used' THEN -ce.amount 
                ELSE 0 
            END
        ), 0) INTO v_total
        FROM public.cashback_entries ce
        LEFT JOIN public.sales s ON ce.sale_id = s.id
        WHERE ce.client_id = v_client_id
        AND (ce.sale_id IS NULL OR s.id IS NOT NULL);

        UPDATE public.clients
        SET cashback_balance = GREATEST(0, v_total),
            updated_at = now()
        WHERE id = v_client_id;
    END IF;

    RETURN NULL;
END;
$$;

-- Recalculate all balances
DO $$
DECLARE
    r RECORD;
    v_total numeric;
BEGIN
    FOR r IN SELECT id FROM public.clients LOOP
        SELECT COALESCE(SUM(
            CASE 
                WHEN ce.kind = 'earned' THEN ce.amount 
                WHEN ce.kind = 'used' THEN -ce.amount 
                ELSE 0 
            END
        ), 0) INTO v_total
        FROM public.cashback_entries ce
        LEFT JOIN public.sales s ON ce.sale_id = s.id
        WHERE ce.client_id = r.id
        AND (ce.sale_id IS NULL OR s.id IS NOT NULL);

        UPDATE public.clients
        SET cashback_balance = GREATEST(0, v_total),
            updated_at = now()
        WHERE id = r.id;
    END LOOP;
END;
$$;
