-- Refactor pay_sale_installment to avoid duplicate transactions and accurately describe the payment
CREATE OR REPLACE FUNCTION public.pay_sale_installment(
  p_installment_id uuid, 
  p_amount numeric, 
  p_payment_method text,
  p_account_id uuid DEFAULT NULL,
  p_description text DEFAULT NULL
)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  v_sale_id uuid;
  v_new_paid_amount decimal(12,2);
  v_total_paid decimal(12,2);
  v_total_sale decimal(12,2);
  v_inst_amount decimal(12,2);
  v_sale_code text;
  v_inst_number integer;
  v_final_desc text;
BEGIN
  -- Get installment and sale details
  SELECT si.sale_id, (COALESCE(si.paid_amount, 0) + p_amount), si.amount, s.sale_code, si.installment_number
  INTO v_sale_id, v_new_paid_amount, v_inst_amount, v_sale_code, v_inst_number
  FROM public.sale_installments si
  JOIN public.sales s ON s.id = si.sale_id
  WHERE si.id = p_installment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parcela não encontrada';
  END IF;

  -- Update installment status
  UPDATE public.sale_installments
  SET 
    paid_amount = v_new_paid_amount,
    remaining_amount = v_inst_amount - v_new_paid_amount,
    status = CASE WHEN (v_inst_amount - v_new_paid_amount) <= 0.009 THEN 'pago' ELSE 'parcial' END,
    paid_at = CASE WHEN (v_inst_amount - v_new_paid_amount) <= 0.009 THEN now() ELSE paid_at END,
    payment_method = p_payment_method
  WHERE id = p_installment_id;

  -- Record the payment in sale_payments
  INSERT INTO public.sale_payments (sale_id, amount, payment_method)
  VALUES (v_sale_id, p_amount, p_payment_method);

  -- Update total paid on the sale
  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid FROM public.sale_payments WHERE sale_id = v_sale_id;
  SELECT total_amount INTO v_total_sale FROM public.sales WHERE id = v_sale_id;

  UPDATE public.sales
  SET 
    paid_amount = v_total_paid,
    status = CASE WHEN v_total_paid >= (v_total_sale - 0.009) THEN 'pago' ELSE 'parcial' END
  WHERE id = v_sale_id;

  -- Generate description if not provided
  v_final_desc := COALESCE(p_description, 'Pagamento ' || v_inst_number || 'ª Parcela Venda #' || COALESCE(v_sale_code, substr(v_sale_id::text, 1, 8)));

  -- Insert a single transaction for this installment payment
  INSERT INTO public.transactions (amount, type, description, sale_id, category, account_id, status, payment_method)
  VALUES (p_amount, 'income', v_final_desc, v_sale_id, 'Venda', p_account_id, 'pago', p_payment_method);

  -- Update financial account balance if provided
  IF p_account_id IS NOT NULL THEN
    UPDATE public.financial_accounts
    SET current_balance = COALESCE(current_balance, 0) + p_amount,
        updated_at = now()
    WHERE id = p_account_id;
  END IF;
END;
$function$;

-- Ensure the trigger for cashback release exists and is correctly handled
CREATE OR REPLACE FUNCTION public.release_proportional_cashback()
RETURNS TRIGGER AS $$
DECLARE
    v_cashback_earned numeric;
    v_total_amount numeric;
    v_client_id uuid;
    v_release_amount numeric;
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
            
            -- Round to nearest integer
            v_release_amount := round(v_release_amount);

            IF v_release_amount > 0 THEN
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_release_cashback_on_payment ON public.transactions;
CREATE TRIGGER tr_release_cashback_on_payment
AFTER INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.release_proportional_cashback();

GRANT EXECUTE ON FUNCTION public.pay_sale_installment(uuid, numeric, text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pay_sale_installment(uuid, numeric, text, uuid, text) TO service_role;
