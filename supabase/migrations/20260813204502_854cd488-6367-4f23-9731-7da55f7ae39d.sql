DROP FUNCTION IF EXISTS public.create_complete_sale(numeric, numeric, uuid, timestamp with time zone, numeric, uuid, jsonb, boolean, jsonb, text, numeric, text, text, text, text);
DROP FUNCTION IF EXISTS public.create_complete_sale(uuid, text, numeric, numeric, numeric, boolean, numeric, numeric, text, jsonb, jsonb, text, uuid, text, text);

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
  p_items jsonb DEFAULT '[]'::jsonb,
  p_installments jsonb DEFAULT '[]'::jsonb,
  p_sale_type text DEFAULT 'Varejo',
  p_financial_account_id uuid DEFAULT NULL,
  p_protection_method text DEFAULT NULL,
  p_sale_code text DEFAULT NULL,
  p_created_at timestamp with time zone DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale_id uuid;
  v_item jsonb;
  v_inst jsonb;
  v_stock public.stock_products%ROWTYPE;
  v_quantity integer;
  v_size_quantity numeric;
  v_status text;
  v_sale_code text;
  v_calculated_total numeric := 0;
  v_items_discount numeric := 0;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Adicione pelo menos um produto à venda';
  END IF;

  IF COALESCE(p_discount, 0) < 0 OR COALESCE(p_cashback_used, 0) < 0 OR COALESCE(p_cashback_earned, 0) < 0 THEN
    RAISE EXCEPTION 'Os valores de desconto e cashback não podem ser negativos';
  END IF;

  IF p_is_debt AND p_client_id IS NULL THEN
    RAISE EXCEPTION 'Selecione um cliente para realizar uma venda fiada';
  END IF;

  IF p_client_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.clients WHERE id = p_client_id) THEN
    RAISE EXCEPTION 'Cliente selecionado não foi encontrado';
  END IF;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    BEGIN
      v_quantity := (v_item->>'quantity')::integer;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'Quantidade inválida em um dos produtos';
    END;

    IF v_quantity <= 0 THEN
      RAISE EXCEPTION 'A quantidade dos produtos deve ser maior que zero';
    END IF;

    IF NULLIF(v_item->>'stock_id', '') IS NULL THEN
      RAISE EXCEPTION 'Produto sem vínculo com o estoque';
    END IF;

    SELECT * INTO v_stock
    FROM public.stock_products
    WHERE id = (v_item->>'stock_id')::uuid
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Produto selecionado não foi encontrado no estoque';
    END IF;

    IF v_stock.produto_id IS DISTINCT FROM (v_item->>'product_id')::uuid THEN
      RAISE EXCEPTION 'O produto selecionado não corresponde ao item em estoque';
    END IF;

    IF COALESCE(v_stock.quantidade_disponivel, 0) < v_quantity THEN
      RAISE EXCEPTION 'Estoque insuficiente para %: disponível %, solicitado %', v_stock.produto_nome, COALESCE(v_stock.quantidade_disponivel, 0), v_quantity;
    END IF;

    IF NULLIF(v_item->>'numeracao', '') IS NOT NULL THEN
      v_size_quantity := COALESCE((v_stock.numeracoes->>(v_item->>'numeracao'))::numeric, 0);
      IF v_size_quantity < v_quantity THEN
        RAISE EXCEPTION 'Estoque insuficiente da numeração % para %: disponível %, solicitado %', v_item->>'numeracao', v_stock.produto_nome, v_size_quantity, v_quantity;
      END IF;
    END IF;

    v_calculated_total := v_calculated_total + ((v_item->>'unit_price')::numeric * v_quantity);
    v_items_discount := v_items_discount + COALESCE((v_item->>'discount')::numeric, 0);
  END LOOP;

  v_calculated_total := GREATEST(0, v_calculated_total - v_items_discount - COALESCE(p_discount, 0) - COALESCE(p_cashback_used, 0));

  IF abs(v_calculated_total - COALESCE(p_total_amount, 0)) > 0.01 THEN
    RAISE EXCEPTION 'O total da venda foi alterado. Atualize o PDV e tente novamente';
  END IF;

  IF COALESCE(p_paid_amount, 0) > v_calculated_total THEN
    RAISE EXCEPTION 'O valor pago não pode ser maior que o total da venda';
  END IF;

  IF p_is_debt THEN
    v_status := CASE WHEN COALESCE(p_paid_amount, 0) > 0 THEN 'partial' ELSE 'pending' END;
  ELSE
    v_status := CASE WHEN COALESCE(p_paid_amount, 0) >= v_calculated_total THEN 'paid' ELSE 'partial' END;
  END IF;

  v_sale_code := COALESCE(NULLIF(trim(p_sale_code), ''), 'V' || to_char(clock_timestamp(), 'YYMMDDHH24MISSMS'));

  INSERT INTO public.sales (
    client_id, total_amount, is_debt, status, created_at, payment_method,
    discount, paid_amount, notes, cashback_used, cashback_earned,
    installments_count, sale_type, seller_id, financial_account_id,
    protection_method, sale_code
  ) VALUES (
    p_client_id, v_calculated_total, p_is_debt, v_status, COALESCE(p_created_at, now()), p_payment_method,
    COALESCE(p_discount, 0) + v_items_discount, COALESCE(p_paid_amount, 0), COALESCE(p_notes, ''),
    COALESCE(p_cashback_used, 0), COALESCE(p_cashback_earned, 0),
    CASE WHEN p_is_debt THEN jsonb_array_length(COALESCE(p_installments, '[]'::jsonb)) ELSE 0 END,
    p_sale_type, auth.uid(), p_financial_account_id, p_protection_method, v_sale_code
  ) RETURNING id INTO v_sale_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(p_items)
  LOOP
    v_quantity := (v_item->>'quantity')::integer;

    INSERT INTO public.sale_items (sale_id, product_id, quantity, unit_price, numeracao, discount, stock_snapshot)
    VALUES (
      v_sale_id, (v_item->>'product_id')::uuid, v_quantity, (v_item->>'unit_price')::numeric,
      NULLIF(v_item->>'numeracao', ''), COALESCE((v_item->>'discount')::numeric, 0), v_item->'stock_snapshot'
    );

    UPDATE public.stock_products
    SET quantidade_disponivel = quantidade_disponivel - v_quantity,
        numeracoes = CASE
          WHEN NULLIF(v_item->>'numeracao', '') IS NOT NULL
          THEN jsonb_set(COALESCE(numeracoes, '{}'::jsonb), ARRAY[v_item->>'numeracao'], to_jsonb(((numeracoes->>(v_item->>'numeracao'))::numeric - v_quantity)), true)
          ELSE numeracoes
        END,
        updated_at = now()
    WHERE id = (v_item->>'stock_id')::uuid;
  END LOOP;

  IF p_is_debt THEN
    IF p_installments IS NULL OR jsonb_typeof(p_installments) <> 'array' OR jsonb_array_length(p_installments) = 0 THEN
      RAISE EXCEPTION 'Informe ao menos uma parcela para a venda fiada';
    END IF;

    FOR v_inst IN SELECT value FROM jsonb_array_elements(p_installments)
    LOOP
      INSERT INTO public.sale_installments (sale_id, installment_number, amount, due_date, status, paid_amount, remaining_amount)
      VALUES (
        v_sale_id, (v_inst->>'number')::integer, (v_inst->>'amount')::numeric,
        (v_inst->>'due_date')::timestamp with time zone, 'pending', 0, (v_inst->>'amount')::numeric
      );
    END LOOP;
  END IF;

  IF COALESCE(p_paid_amount, 0) > 0 THEN
    INSERT INTO public.sale_payments (sale_id, amount, payment_method)
    VALUES (v_sale_id, p_paid_amount, p_payment_method);

    INSERT INTO public.transactions (sale_id, amount, type, description, created_at, category, account_id, status, payment_method, client_id)
    VALUES (
      v_sale_id, p_paid_amount, 'income', 'Venda #' || v_sale_code, COALESCE(p_created_at, now()),
      'Venda', p_financial_account_id, 'paid', p_payment_method, p_client_id
    );
  ELSIF p_is_debt THEN
    INSERT INTO public.transactions (sale_id, amount, type, description, created_at, due_date, category, account_id, status, payment_method, client_id)
    VALUES (
      v_sale_id, v_calculated_total, 'income', 'Venda fiada #' || v_sale_code, COALESCE(p_created_at, now()),
      CASE WHEN jsonb_array_length(p_installments) > 0 THEN ((p_installments->0->>'due_date')::timestamp with time zone)::date ELSE NULL END,
      'Venda Fiado', p_financial_account_id, 'pending', p_payment_method, p_client_id
    );
  END IF;

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
$$;

REVOKE ALL ON FUNCTION public.create_complete_sale(uuid, text, numeric, numeric, numeric, boolean, numeric, numeric, text, jsonb, jsonb, text, uuid, text, text, timestamp with time zone) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_complete_sale(uuid, text, numeric, numeric, numeric, boolean, numeric, numeric, text, jsonb, jsonb, text, uuid, text, text, timestamp with time zone) FROM anon;
GRANT EXECUTE ON FUNCTION public.create_complete_sale(uuid, text, numeric, numeric, numeric, boolean, numeric, numeric, text, jsonb, jsonb, text, uuid, text, text, timestamp with time zone) TO authenticated, service_role;