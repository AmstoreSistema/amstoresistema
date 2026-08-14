
CREATE OR REPLACE FUNCTION public.create_complete_sale(
  p_client_id uuid DEFAULT NULL,
  p_payment_method text DEFAULT 'Dinheiro',
  p_total_amount numeric DEFAULT 0,
  p_discount numeric DEFAULT 0,
  p_paid_amount numeric DEFAULT 0,
  p_is_debt boolean DEFAULT false,
  p_cashback_used numeric DEFAULT 0,
  p_cashback_earned numeric DEFAULT 0,
  p_notes text DEFAULT '',
  p_items jsonb DEFAULT '[]',
  p_installments jsonb DEFAULT '[]',
  p_sale_type text DEFAULT 'Varejo',
  p_financial_account_id uuid DEFAULT NULL,
  p_protection_method text DEFAULT NULL,
  p_sale_code text DEFAULT NULL,
  p_created_at timestamp with time zone DEFAULT now()
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_sale_id uuid;
  v_item jsonb;
  v_inst jsonb;
  v_stock public.stock_products%ROWTYPE;
  v_quantity integer;
  v_size_quantity numeric;
  v_calculated_total numeric;
  v_sale_code text;
BEGIN
  -- Validations
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'A venda deve conter pelo menos um item.';
  END IF;

  IF p_is_debt AND p_client_id IS NULL THEN
    RAISE EXCEPTION 'Cliente é obrigatório para vendas fiado.';
  END IF;

  v_calculated_total := p_total_amount - p_discount - p_cashback_used;
  v_sale_code := COALESCE(p_sale_code, UPPER(substring(md5(random()::text) from 1 for 8)));

  -- Create Sale
  INSERT INTO public.sales (
    client_id, total_amount, discount_amount, paid_amount, 
    payment_method, is_debt, cashback_used, cashback_earned, 
    notes, sale_type, sale_code, created_at
  ) VALUES (
    p_client_id, v_calculated_total, p_discount, p_paid_amount, 
    p_payment_method, p_is_debt, p_cashback_used, p_cashback_earned, 
    p_notes, p_sale_type, v_sale_code, COALESCE(p_created_at, now())
  ) RETURNING id INTO v_sale_id;

  -- Process Items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_quantity := (v_item->>'quantity')::integer;
    
    INSERT INTO public.sale_items (
      sale_id, product_id, quantity, unit_price, size, subtotal
    ) VALUES (
      v_sale_id, (v_item->>'product_id')::uuid, v_quantity, 
      (v_item->>'unit_price')::numeric, (v_item->>'size')::text,
      (v_item->>'subtotal')::numeric
    );

    -- Stock update
    IF (v_item->>'size') IS NOT NULL AND (v_item->>'size') <> '' THEN
      UPDATE public.stock_products
      SET sizes = jsonb_set(
        COALESCE(sizes, '{}'::jsonb),
        ARRAY[(v_item->>'size')::text],
        (COALESCE((sizes->>(v_item->>'size')::text)::numeric, 0) - v_quantity)::text::jsonb
      ),
      current_stock = current_stock - v_quantity,
      updated_at = now()
      WHERE product_id = (v_item->>'product_id')::uuid;
    ELSE
      UPDATE public.stock_products
      SET current_stock = current_stock - v_quantity,
      updated_at = now()
      WHERE product_id = (v_item->>'product_id')::uuid;
    END IF;
  END LOOP;

  -- Process Installments
  IF p_is_debt THEN
    FOR v_inst IN SELECT * FROM jsonb_array_elements(p_installments)
    LOOP
      INSERT INTO public.sale_installments (
        sale_id, amount, due_date, status
      ) VALUES (
        v_sale_id, (v_inst->>'amount')::numeric, 
        (v_inst->>'due_date')::date, 'pending'
      );
    END LOOP;
  END IF;

  -- Financial Transaction
  IF p_paid_amount > 0 AND p_financial_account_id IS NOT NULL THEN
    INSERT INTO public.transactions (sale_id, amount, type, description, created_at, category, account_id, status, payment_method, client_id)
    VALUES (
      v_sale_id, p_paid_amount, 'income', 'Venda #' || v_sale_code, COALESCE(p_created_at, now()),
      'Venda', p_financial_account_id, 'pago', p_payment_method, p_client_id
    );
  ELSIF p_is_debt THEN
    INSERT INTO public.transactions (sale_id, amount, type, description, created_at, due_date, category, account_id, status, payment_method, client_id)
    VALUES (
      v_sale_id, v_calculated_total, 'income', 'Venda fiada #' || v_sale_code, COALESCE(p_created_at, now()),
      CASE WHEN jsonb_array_length(p_installments) > 0 THEN ((p_installments->0->>'due_date')::timestamp with time zone)::date ELSE NULL END,
      'Venda Fiado', p_financial_account_id, 'pendente', p_payment_method, p_client_id
    );
  END IF;

  -- Cashback update
  IF p_client_id IS NOT NULL THEN
    UPDATE public.clients
    SET cashback_balance = GREATEST(0, COALESCE(cashback_balance, 0) - COALESCE(p_cashback_used, 0) + COALESCE(p_cashback_earned, 0))
    WHERE id = p_client_id;

    IF COALESCE(p_cashback_used, 0) > 0 THEN
      INSERT INTO public.cashback_entries (client_id, amount, kind, description)
      VALUES (p_client_id, p_cashback_used, 'used', 'Utilizado na venda #' || v_sale_code);
    END IF;

    IF COALESCE(p_cashback_earned, 0) > 0 THEN
      INSERT INTO public.cashback_entries (client_id, amount, kind, description)
      VALUES (p_client_id, p_cashback_earned, 'earned', 'Gerado na venda #' || v_sale_code);
    END IF;
  END IF;

  RETURN v_sale_id;
END;
$function$;
