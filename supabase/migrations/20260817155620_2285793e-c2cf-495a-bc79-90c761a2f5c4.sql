CREATE OR REPLACE FUNCTION public.pay_sale_installment(p_installment_id uuid, p_amount numeric, p_payment_method text, p_account_id uuid DEFAULT NULL::uuid, p_description text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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
  v_client_id uuid;
BEGIN
  -- Get installment and sale details
  SELECT si.sale_id, (COALESCE(si.paid_amount, 0) + p_amount), si.amount, s.sale_code, si.installment_number, s.client_id
  INTO v_sale_id, v_new_paid_amount, v_inst_amount, v_sale_code, v_inst_number, v_client_id
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
  -- The transaction_balance_trigger will handle the current_balance update
  INSERT INTO public.transactions (amount, type, description, sale_id, category, account_id, status, payment_method, client_id)
  VALUES (p_amount, 'income', v_final_desc, v_sale_id, 'Venda', p_account_id, 'pago', p_payment_method, v_client_id);
END;
$function$;