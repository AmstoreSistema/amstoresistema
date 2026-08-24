CREATE OR REPLACE FUNCTION public.create_complete_purchase(
  p_items jsonb,
  p_supplier_id uuid DEFAULT NULL,
  p_supplier_name text DEFAULT NULL,
  p_account_id uuid DEFAULT NULL,
  p_category text DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_purchase_id uuid;
  v_item jsonb;
  v_total numeric(12,2) := 0;
  v_material public.materials%ROWTYPE;
  v_account_id uuid := p_account_id;
  v_summary text := '';
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'A compra deve conter pelo menos um item.';
  END IF;

  -- Validação prévia de todos os itens (nada é gravado se algo estiver errado)
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_material FROM public.materials WHERE id = (v_item->>'material_id')::uuid FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Matéria-prima não encontrada na compra';
    END IF;
    IF COALESCE((v_item->>'quantity')::numeric, 0) <= 0 THEN
      RAISE EXCEPTION 'Quantidade inválida para %', v_material.name;
    END IF;
    v_total := v_total + (v_item->>'quantity')::numeric * COALESCE((v_item->>'unit_cost')::numeric, 0);
    v_summary := v_summary || CASE WHEN v_summary = '' THEN '' ELSE ', ' END
      || (v_item->>'quantity') || COALESCE(v_material.unit, 'un') || ' ' || v_material.name;
  END LOOP;

  IF v_account_id IS NULL THEN
    SELECT id INTO v_account_id FROM public.financial_accounts WHERE active = true LIMIT 1;
  END IF;
  IF v_account_id IS NULL THEN
    RAISE EXCEPTION 'Nenhuma conta financeira ativa encontrada para lançar a despesa';
  END IF;

  INSERT INTO public.purchases (supplier, supplier_id, supplier_name, total_amount, status, quantity, unit_cost, received_at)
  VALUES (
    COALESCE(p_supplier_name, 'Fornecedor não informado'),
    p_supplier_id,
    COALESCE(p_supplier_name, 'Fornecedor não informado'),
    v_total,
    'recebido',
    0,
    0,
    now()
  )
  RETURNING id INTO v_purchase_id;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    SELECT * INTO v_material FROM public.materials WHERE id = (v_item->>'material_id')::uuid FOR UPDATE;

    INSERT INTO public.purchase_items (purchase_id, material_id, quantity, unit_cost, previous_cost)
    VALUES (
      v_purchase_id,
      v_material.id,
      (v_item->>'quantity')::numeric,
      COALESCE((v_item->>'unit_cost')::numeric, 0),
      COALESCE(v_material.cost_price, 0)
    );

    UPDATE public.materials
    SET current_stock = COALESCE(current_stock, 0) + (v_item->>'quantity')::numeric,
        updated_at = now()
    WHERE id = v_material.id;
  END LOOP;

  INSERT INTO public.transactions (amount, type, description, account_id, category, status, due_date, supplier_id, purchase_id)
  VALUES (
    ABS(v_total),
    'saida',
    COALESCE(p_description, 'Compra: ' || v_summary),
    v_account_id,
    COALESCE(p_category, 'Compra de Materiais'),
    'pago',
    CURRENT_DATE,
    p_supplier_id,
    v_purchase_id
  );

  RETURN v_purchase_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_complete_purchase(jsonb, uuid, text, uuid, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.create_complete_sale(p_items jsonb, p_payment_method text, p_total_amount numeric, p_paid_amount numeric, p_is_debt boolean, p_discount numeric DEFAULT 0, p_discount_amount numeric DEFAULT 0, p_client_id uuid DEFAULT NULL::uuid, p_financial_account_id uuid DEFAULT NULL::uuid, p_notes text DEFAULT ''::text, p_sale_type text DEFAULT 'Varejo'::text, p_protection_method text DEFAULT 'Padrão'::text, p_sale_code text DEFAULT NULL::text, p_created_at timestamp with time zone DEFAULT now(), p_cashback_used numeric DEFAULT 0, p_cashback_earned numeric DEFAULT 0, p_installments jsonb DEFAULT '[]'::jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_sale_id uuid;
    v_item jsonb;
    v_inst jsonb;
    v_stock_id uuid;
    v_product_id uuid;
    v_quantity integer;
    v_numeracao text;
    v_unit_price numeric;
    v_item_discount numeric;
    v_sale_code text;
    v_available numeric;
    v_product_name text;
BEGIN
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'A venda deve conter pelo menos um item.';
    END IF;

    -- Validação atômica de estoque antes de qualquer gravação
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_stock_id := (v_item->>'stock_id')::uuid;
        v_quantity := (v_item->>'quantity')::integer;
        v_numeracao := v_item->>'numeracao';

        IF v_quantity IS NULL OR v_quantity <= 0 THEN
            RAISE EXCEPTION 'Quantidade inválida em um dos itens da venda';
        END IF;

        IF v_stock_id IS NOT NULL THEN
            SELECT COALESCE(quantidade_disponivel, 0), produto_nome
              INTO v_available, v_product_name
            FROM public.stock_products
            WHERE id = v_stock_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Item de estoque não encontrado';
            END IF;

            IF v_numeracao IS NOT NULL AND v_numeracao <> '' THEN
                SELECT COALESCE((numeracoes->>v_numeracao)::numeric, 0)
                  INTO v_available
                FROM public.stock_products
                WHERE id = v_stock_id;

                IF v_available < v_quantity THEN
                    RAISE EXCEPTION 'Estoque insuficiente de % (numeração %): disponível %, solicitado %',
                        COALESCE(v_product_name, 'produto'), v_numeracao, v_available, v_quantity;
                END IF;
            ELSIF v_available < v_quantity THEN
                RAISE EXCEPTION 'Estoque insuficiente de %: disponível %, solicitado %',
                    COALESCE(v_product_name, 'produto'), v_available, v_quantity;
            END IF;
        END IF;
    END LOOP;

    v_sale_code := COALESCE(p_sale_code, 'V' || to_char(now(), 'YYYYMMDDHH24MISS') || floor(random()*100)::text);

    INSERT INTO public.sales (
        client_id, total_amount, discount, discount_amount, paid_amount, 
        payment_method, is_debt, cashback_used, cashback_earned, 
        notes, sale_type, sale_code, created_at, financial_account_id, protection_method
    ) VALUES (
        p_client_id, p_total_amount, p_discount, p_discount_amount, p_paid_amount, 
        p_payment_method, p_is_debt, p_cashback_used, p_cashback_earned, 
        p_notes, p_sale_type, v_sale_code, p_created_at, p_financial_account_id, p_protection_method
    ) RETURNING id INTO v_sale_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::uuid;
        v_stock_id := (v_item->>'stock_id')::uuid;
        v_quantity := (v_item->>'quantity')::integer;
        v_numeracao := v_item->>'numeracao';
        v_unit_price := (v_item->>'unit_price')::numeric;
        v_item_discount := COALESCE((v_item->>'discount')::numeric, 0);

        INSERT INTO public.sale_items (
            sale_id, product_id, quantity, unit_price, numeracao, discount
        ) VALUES (
            v_sale_id, v_product_id, v_quantity, v_unit_price, v_numeracao, v_item_discount
        );

        UPDATE public.products 
        SET current_stock = GREATEST(0, COALESCE(current_stock, 0) - v_quantity),
            updated_at = now()
        WHERE id = v_product_id;

        IF v_stock_id IS NOT NULL THEN
            UPDATE public.stock_products
            SET 
                quantidade_disponivel = GREATEST(0, COALESCE(quantidade_disponivel, 0) - v_quantity),
                numeracoes = CASE 
                    WHEN v_numeracao IS NOT NULL AND v_numeracao <> '' THEN
                        jsonb_set(
                            COALESCE(numeracoes, '{}'::jsonb),
                            ARRAY[v_numeracao],
                            to_jsonb(GREATEST(0, (COALESCE(numeracoes->>v_numeracao, '0'))::numeric - v_quantity)),
                            true
                        )
                    ELSE numeracoes
                END,
                updated_at = now()
            WHERE id = v_stock_id;
        END IF;
    END LOOP;

    IF p_is_debt AND p_installments IS NOT NULL THEN
        FOR v_inst IN SELECT * FROM jsonb_array_elements(p_installments)
        LOOP
            INSERT INTO public.sale_installments (
                sale_id, installment_number, amount, due_date, status
            ) VALUES (
                v_sale_id, 
                (v_inst->>'number')::integer, 
                (v_inst->>'amount')::numeric, 
                (v_inst->>'due_date')::timestamp with time zone,
                'pendente'
            );
        END LOOP;
    END IF;

    IF NOT p_is_debt AND p_paid_amount > 0 THEN
        INSERT INTO public.transactions (
            amount, type, description, sale_id, category, account_id, status, payment_method, client_id
        ) VALUES (
            p_paid_amount, 'income', 'Venda #' || v_sale_code, v_sale_id, 'Venda', p_financial_account_id, 'pago', p_payment_method, p_client_id
        );
    END IF;

    RETURN v_sale_id;
END;
$function$;