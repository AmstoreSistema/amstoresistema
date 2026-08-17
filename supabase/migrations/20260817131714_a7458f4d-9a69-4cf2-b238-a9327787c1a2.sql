ALTER TABLE public.sale_installments DROP CONSTRAINT IF EXISTS sale_installments_status_check;
ALTER TABLE public.sale_installments ADD CONSTRAINT sale_installments_status_check CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled', 'pendente', 'pago', 'aberto', 'vencido', 'parcial', 'partial'));

CREATE OR REPLACE FUNCTION public.pay_sale_installment(
  p_installment_id uuid,
  p_amount decimal(12,2),
  p_payment_method text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale_id uuid;
  v_new_paid_amount decimal(12,2);
  v_total_paid decimal(12,2);
  v_total_sale decimal(12,2);
  v_inst_amount decimal(12,2);
BEGIN
  SELECT sale_id, (COALESCE(paid_amount, 0) + p_amount), amount
  INTO v_sale_id, v_new_paid_amount, v_inst_amount
  FROM public.sale_installments
  WHERE id = p_installment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parcela não encontrada';
  END IF;

  UPDATE public.sale_installments
  SET 
    paid_amount = v_new_paid_amount,
    remaining_amount = v_inst_amount - v_new_paid_amount,
    status = CASE WHEN (v_inst_amount - v_new_paid_amount) <= 0.009 THEN 'pago' ELSE 'parcial' END,
    paid_at = CASE WHEN (v_inst_amount - v_new_paid_amount) <= 0.009 THEN now() ELSE paid_at END,
    payment_method = p_payment_method
  WHERE id = p_installment_id;

  INSERT INTO public.sale_payments (sale_id, amount, payment_method)
  VALUES (v_sale_id, p_amount, p_payment_method);

  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid FROM public.sale_payments WHERE sale_id = v_sale_id;
  SELECT total_amount INTO v_total_sale FROM public.sales WHERE id = v_sale_id;

  UPDATE public.sales
  SET 
    paid_amount = v_total_paid,
    status = CASE WHEN v_total_paid >= (v_total_sale - 0.009) THEN 'pago' ELSE 'parcial' END
  WHERE id = v_sale_id;

  INSERT INTO public.transactions (amount, type, description, sale_id, category)
  VALUES (p_amount, 'income', 'Pagamento Parcial Venda #' || substr(v_sale_id::text, 1, 8), v_sale_id, 'Venda');
END;
$$;