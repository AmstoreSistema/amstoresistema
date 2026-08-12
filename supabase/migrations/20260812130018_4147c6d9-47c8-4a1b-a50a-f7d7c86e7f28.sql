-- Re-applying the installment support migration content directly since the table is missing
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS installments_count INTEGER DEFAULT 1;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.sale_installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE NOT NULL,
    installment_number INTEGER NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    due_date TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
    paid_at TIMESTAMPTZ,
    payment_method TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    paid_amount decimal(12,2) DEFAULT 0,
    remaining_amount decimal(12,2)
);

ALTER TABLE public.sale_installments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_installments TO authenticated;
GRANT ALL ON public.sale_installments TO service_role;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all for authenticated users' AND tablename = 'sale_installments') THEN
        CREATE POLICY "Allow all for authenticated users" ON public.sale_installments FOR ALL TO authenticated USING (true);
    END IF;
END $$;

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
BEGIN
  SELECT sale_id, (paid_amount + p_amount)
  INTO v_sale_id, v_new_paid_amount
  FROM public.sale_installments
  WHERE id = p_installment_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Parcela não encontrada';
  END IF;

  UPDATE public.sale_installments
  SET 
    paid_amount = v_new_paid_amount,
    remaining_amount = amount - v_new_paid_amount,
    status = CASE WHEN (amount - v_new_paid_amount) <= 0 THEN 'paid' ELSE 'partial' END,
    paid_at = CASE WHEN (amount - v_new_paid_amount) <= 0 THEN now() ELSE paid_at END,
    payment_method = p_payment_method
  WHERE id = p_installment_id;

  INSERT INTO public.sale_payments (sale_id, amount, payment_method)
  VALUES (v_sale_id, p_amount, p_payment_method);

  SELECT SUM(amount) INTO v_total_paid FROM public.sale_payments WHERE sale_id = v_sale_id;
  SELECT total_amount INTO v_total_sale FROM public.sales WHERE id = v_sale_id;

  UPDATE public.sales
  SET 
    paid_amount = v_total_paid,
    status = CASE WHEN v_total_paid >= v_total_sale THEN 'paid' ELSE 'partial' END
  WHERE id = v_sale_id;

  INSERT INTO public.transactions (amount, type, description, sale_id, category)
  VALUES (p_amount, 'income', 'Pagamento Parcial Venda #' || substr(v_sale_id::text, 1, 8), v_sale_id, 'Venda');
END;
$$;

CREATE OR REPLACE FUNCTION public.update_sale_installments(
  p_sale_id uuid,
  p_installments jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.sale_installments 
  WHERE sale_id = p_sale_id AND status != 'paid';

  INSERT INTO public.sale_installments (sale_id, installment_number, amount, due_date, status, paid_amount, remaining_amount)
  SELECT 
    p_sale_id,
    (val->>'number')::int,
    (val->>'amount')::decimal,
    (val->>'due_date')::timestamp,
    'pending',
    0,
    (val->>'amount')::decimal
  FROM jsonb_array_elements(p_installments) AS val;
END;
$$;