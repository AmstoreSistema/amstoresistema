-- Drop the existing function to avoid conflicts with overloaded versions if parameters change significantly
DROP FUNCTION IF EXISTS public.create_complete_sale(uuid, text, numeric, numeric, numeric, boolean, numeric, numeric, text, jsonb, jsonb, text, uuid, text, text, timestamptz);

-- Recreate the function ensuring parameter order matches the RPC call in sales.functions.ts
-- The error in image-49.png shows PostgREST trying to find a function with parameters in alphabetical order:
-- p_cashback_earned, p_cashback_used, p_client_id, p_created_at, p_discount, p_financial_account_id, ...
-- This happens when using named parameters in a way that doesn't match the backend signature or cache is stale.

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
  p_protection_method text DEFAULT 'Padrão',
  p_sale_code text DEFAULT NULL,
  p_created_at timestamptz DEFAULT now()
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
BEGIN
  -- 1. Insert into sales
  INSERT INTO public.sales (
    client_id,
    payment_method,
    total_amount,
    discount,
    paid_amount,
    is_debt,
    status,
    cashback_used,
    cashback_earned,
    notes,
    sale_type,
    protection_method,
    sale_code,
    created_at,
    installments_count
  ) VALUES (
    p_client_id,
    p_payment_method,
    p_total_amount,
    p_discount,
    p_paid_amount,
    p_is_debt,
    CASE 
      WHEN p_is_debt THEN 'pending'
      WHEN p_paid_amount >= p_total_amount THEN 'paid'
      ELSE 'partial'
    END,
    p_cashback_used,
    p_cashback_earned,
    p_notes,
    p_sale_type,
    p_protection_method,
    p_sale_code,
    COALESCE(p_created_at, now()),
    jsonb_array_length(p_installments)
  ) RETURNING id INTO v_sale_id;

  -- 2. Insert items and update stock
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    INSERT INTO public.sale_items (
      sale_id,
      product_id,
      quantity,
      unit_price,
      discount,
      numeracao
    ) VALUES (
      v_sale_id,
      (v_item->>'product_id')::uuid,
      (v_item->>'quantity')::numeric,
      (v_item->>'unit_price')::numeric,
      COALESCE((v_item->>'discount')::numeric, 0),
      v_item->>'numeracao'
    );

    -- Update stock if stock_id is provided
    IF (v_item->>'stock_id') IS NOT NULL THEN
      UPDATE public.stock_products
      SET current_stock = current_stock - (v_item->>'quantity')::numeric
      WHERE id = (v_item->>'stock_id')::uuid;
    END IF;
  END LOOP;

  -- 3. Insert installments if debt
  IF p_is_debt AND p_installments IS NOT NULL THEN
    FOR v_inst IN SELECT * FROM jsonb_array_elements(p_installments)
    LOOP
      INSERT INTO public.sale_installments (
        sale_id,
        number,
        amount,
        due_date,
        status
      ) VALUES (
        v_sale_id,
        (v_inst->>'number')::integer,
        (v_inst->>'amount')::numeric,
        (v_inst->>'due_date')::timestamptz,
        'pending'
      );
    END LOOP;
  END IF;

  -- 4. Insert transaction entry if not pure debt and account is provided
  IF NOT p_is_debt AND p_paid_amount > 0 AND p_financial_account_id IS NOT NULL THEN
    INSERT INTO public.transactions (
      account_id,
      amount,
      type,
      description,
      category,
      sale_id,
      created_at
    ) VALUES (
      p_financial_account_id,
      p_paid_amount,
      'income',
      'Venda ' || COALESCE(p_sale_code, v_sale_id::text),
      'Venda',
      v_sale_id,
      COALESCE(p_created_at, now())
    );
  END IF;

  -- 5. Update client cashback balance if applicable
  IF p_client_id IS NOT NULL THEN
    UPDATE public.clients
    SET cashback_balance = cashback_balance - p_cashback_used + p_cashback_earned
    WHERE id = p_client_id;
  END IF;

  RETURN v_sale_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_complete_sale TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_complete_sale TO anon;
GRANT EXECUTE ON FUNCTION public.create_complete_sale TO service_role;
