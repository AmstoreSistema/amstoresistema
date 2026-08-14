-- Primeiro limpamos as funções duplicadas para evitar conflitos de assinatura
DROP FUNCTION IF EXISTS public.create_complete_sale(uuid, text, numeric, numeric, numeric, boolean, numeric, numeric, text, jsonb, jsonb, text, uuid, text, text, timestamp with time zone);
DROP FUNCTION IF EXISTS public.create_complete_sale(uuid, text, numeric, numeric, numeric, numeric, boolean, numeric, numeric, jsonb, jsonb, text, text, uuid, text, text, timestamp with time zone);

-- Garantir colunas necessárias (Auditoria de Sincronização)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'discount_amount') THEN
        ALTER TABLE public.sales ADD COLUMN discount_amount numeric DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sales' AND column_name = 'financial_account_id') THEN
        ALTER TABLE public.sales ADD COLUMN financial_account_id uuid REFERENCES public.financial_accounts(id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sale_items' AND column_name = 'numeracao') THEN
        ALTER TABLE public.sale_items ADD COLUMN numeracao text;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sale_items' AND column_name = 'discount') THEN
        ALTER TABLE public.sale_items ADD COLUMN discount numeric DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'sale_id') THEN
        ALTER TABLE public.transactions ADD COLUMN sale_id uuid REFERENCES public.sales(id);
    END IF;
END $$;

-- Recriar a função create_complete_sale com a nova assinatura unificada
CREATE OR REPLACE FUNCTION public.create_complete_sale(
    p_items jsonb,
    p_payment_method text,
    p_total_amount numeric,
    p_paid_amount numeric,
    p_is_debt boolean,
    p_discount numeric DEFAULT 0,
    p_discount_amount numeric DEFAULT 0,
    p_client_id uuid DEFAULT NULL,
    p_financial_account_id uuid DEFAULT NULL,
    p_notes text DEFAULT '',
    p_sale_type text DEFAULT 'Varejo',
    p_protection_method text DEFAULT 'Padrão',
    p_sale_code text DEFAULT NULL,
    p_created_at timestamp with time zone DEFAULT now(),
    p_cashback_used numeric DEFAULT 0,
    p_cashback_earned numeric DEFAULT 0,
    p_installments jsonb DEFAULT '[]'::jsonb
) RETURNS uuid AS $$
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
BEGIN
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'A venda deve conter pelo menos um item.';
    END IF;

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
            amount, type, description, sale_id, category, account_id, status, payment_method
        ) VALUES (
            p_paid_amount, 'income', 'Venda #' || v_sale_code, v_sale_id, 'Venda', p_financial_account_id, 'pago', p_payment_method
        );

        IF p_financial_account_id IS NOT NULL THEN
            UPDATE public.financial_accounts
            SET current_balance = COALESCE(current_balance, 0) + p_paid_amount,
                updated_at = now()
            WHERE id = p_financial_account_id;
        END IF;
    END IF;

    RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION public.create_complete_sale TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_complete_sale TO service_role;
