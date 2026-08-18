CREATE OR REPLACE FUNCTION public.release_proportional_cashback()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_cashback_earned numeric(12,2);
    v_total_amount numeric(12,2);
    v_client_id uuid;
    v_total_paid numeric(12,2);
    v_already_released numeric(12,2);
    v_target_released numeric(12,2);
    v_release_amount numeric(12,2);
BEGIN
    IF NEW.type IN ('income', 'entrada')
       AND NEW.sale_id IS NOT NULL
       AND COALESCE(NEW.status, 'pago') = 'pago' THEN
        SELECT COALESCE(cashback_earned, 0), COALESCE(total_amount, 0), client_id
          INTO v_cashback_earned, v_total_amount, v_client_id
        FROM public.sales
        WHERE id = NEW.sale_id;

        IF v_cashback_earned > 0 AND v_total_amount > 0 AND v_client_id IS NOT NULL THEN
            SELECT COALESCE(SUM(amount), 0)
              INTO v_total_paid
            FROM public.transactions
            WHERE sale_id = NEW.sale_id
              AND type IN ('income', 'entrada')
              AND COALESCE(status, 'pago') = 'pago';

            SELECT COALESCE(SUM(amount), 0)
              INTO v_already_released
            FROM public.cashback_entries
            WHERE sale_id = NEW.sale_id
              AND kind = 'earned'
              AND description LIKE 'Cashback liberado por pagamento%';

            v_target_released := LEAST(
                v_cashback_earned,
                ROUND(v_cashback_earned * LEAST(v_total_paid, v_total_amount) / v_total_amount, 2)
            );
            v_release_amount := GREATEST(0, v_target_released - v_already_released);

            IF v_release_amount > 0 THEN
                INSERT INTO public.cashback_entries (client_id, sale_id, amount, kind, description)
                VALUES (
                    v_client_id,
                    NEW.sale_id,
                    v_release_amount,
                    'earned',
                    'Cashback liberado por pagamento (' || COALESCE(NEW.description, 'Venda') || ')'
                );
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_sale_cashback_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_available numeric(12,2);
BEGIN
    IF NEW.client_id IS NOT NULL AND COALESCE(NEW.cashback_used, 0) > 0 THEN
        SELECT COALESCE(cashback_balance, 0)
          INTO v_available
        FROM public.clients
        WHERE id = NEW.client_id
        FOR UPDATE;

        IF v_available < NEW.cashback_used THEN
            RAISE EXCEPTION 'Saldo de cashback insuficiente. Disponível: %, solicitado: %', v_available, NEW.cashback_used;
        END IF;

        INSERT INTO public.cashback_entries (client_id, sale_id, amount, kind, description)
        VALUES (
            NEW.client_id,
            NEW.id,
            NEW.cashback_used,
            'used',
            'Cashback utilizado na venda #' || COALESCE(NEW.sale_code, LEFT(NEW.id::text, 8))
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_record_sale_cashback_usage ON public.sales;
CREATE TRIGGER tr_record_sale_cashback_usage
AFTER INSERT ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.record_sale_cashback_usage();