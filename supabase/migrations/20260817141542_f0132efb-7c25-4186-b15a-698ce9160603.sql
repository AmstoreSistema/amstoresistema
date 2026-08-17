CREATE OR REPLACE FUNCTION public.release_proportional_cashback()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_cashback_earned numeric(12,2);
    v_total_amount numeric(12,2);
    v_client_id uuid;
    v_release_amount numeric(12,2);
BEGIN
    -- Only handle income transactions related to sales
    IF NEW.type = 'income' AND NEW.sale_id IS NOT NULL AND NEW.status = 'pago' THEN
        -- Get sale info
        SELECT cashback_earned, total_amount, client_id 
        INTO v_cashback_earned, v_total_amount, v_client_id
        FROM public.sales 
        WHERE id = NEW.sale_id;

        IF v_cashback_earned > 0 AND v_total_amount > 0 AND v_client_id IS NOT NULL THEN
            -- Calculate proportional cashback: (payment_amount / total_sale_amount) * total_cashback_earned
            v_release_amount := (NEW.amount / v_total_amount) * v_cashback_earned;
            
            -- Use 2 decimal places for precision
            v_release_amount := round(v_release_amount, 2);

            IF v_release_amount > 0.009 THEN
                -- Update client balance
                UPDATE public.clients 
                SET cashback_balance = COALESCE(cashback_balance, 0) + v_release_amount
                WHERE id = v_client_id;

                -- Record cashback entry
                INSERT INTO public.cashback_entries (client_id, sale_id, amount, kind, description)
                VALUES (v_client_id, NEW.sale_id, v_release_amount, 'earned', 'Cashback liberado por pagamento (' || NEW.description || ')');
            END IF;
        END IF;
    END IF;
    RETURN NEW;
END;
$function$;