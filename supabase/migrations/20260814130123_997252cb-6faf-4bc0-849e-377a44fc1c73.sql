-- Add discount_amount column to sales table
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS discount_amount NUMERIC DEFAULT 0;

-- Update the create_complete_sale function to handle p_discount_amount
CREATE OR REPLACE FUNCTION public.create_complete_sale(
    p_client_id UUID DEFAULT NULL,
    p_payment_method TEXT DEFAULT 'Dinheiro',
    p_total_amount NUMERIC DEFAULT 0,
    p_discount NUMERIC DEFAULT 0,
    p_discount_amount NUMERIC DEFAULT 0,
    p_paid_amount NUMERIC DEFAULT 0,
    p_is_debt BOOLEAN DEFAULT FALSE,
    p_cashback_used NUMERIC DEFAULT 0,
    p_cashback_earned NUMERIC DEFAULT 0,
    p_items JSONB DEFAULT '[]'::JSONB,
    p_installments JSONB DEFAULT '[]'::JSONB,
    p_notes TEXT DEFAULT '',
    p_sale_type TEXT DEFAULT 'Varejo',
    p_financial_account_id UUID DEFAULT NULL,
    p_protection_method TEXT DEFAULT 'Padrão',
    p_sale_code TEXT DEFAULT NULL,
    p_created_at TIMESTAMPTZ DEFAULT NOW()
) RETURNS UUID AS $$
DECLARE
    v_sale_id UUID;
    v_item JSONB;
    v_inst JSONB;
    v_stock_id UUID;
    v_product_id UUID;
    v_qty INT;
    v_numeracao TEXT;
    v_unit_price NUMERIC;
    v_item_discount NUMERIC;
    v_transaction_id UUID;
BEGIN
    -- 1. Insert Sale
    INSERT INTO public.sales (
        client_id, 
        payment_method, 
        total_amount, 
        discount, 
        discount_amount,
        paid_amount, 
        is_debt, 
        cashback_used, 
        cashback_earned, 
        notes, 
        sale_type, 
        financial_account_id, 
        protection_method, 
        sale_code, 
        created_at,
        status
    )
    VALUES (
        p_client_id, 
        p_payment_method, 
        p_total_amount, 
        p_discount, 
        p_discount_amount,
        p_paid_amount, 
        p_is_debt, 
        p_cashback_used, 
        p_cashback_earned, 
        p_notes, 
        p_sale_type, 
        p_financial_account_id, 
        p_protection_method, 
        p_sale_code, 
        p_created_at,
        CASE WHEN p_is_debt THEN 'pending' ELSE 'paid' END
    )
    RETURNING id INTO v_sale_id;

    -- 2. Process Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_stock_id := (v_item->>'stock_id')::UUID;
        v_product_id := (v_item->>'product_id')::UUID;
        v_qty := (v_item->>'quantity')::INT;
        v_numeracao := v_item->>'numeracao';
        v_unit_price := (v_item->>'unit_price')::NUMERIC;
        v_item_discount := COALESCE((v_item->>'discount')::NUMERIC, 0);

        -- Insert sale item
        INSERT INTO public.sale_items (
            sale_id, product_id, quantity, unit_price, discount, numeracao
        ) VALUES (
            v_sale_id, v_product_id, v_qty, v_unit_price, v_item_discount, v_numeracao
        );

        -- Adjust stock
        IF v_numeracao IS NOT NULL AND v_numeracao <> '' THEN
            UPDATE public.stock_products 
            SET current_stock = GREATEST(0, current_stock - v_qty)
            WHERE produto_id = v_product_id AND numeracao = v_numeracao;
        ELSE
            UPDATE public.products 
            SET current_stock = GREATEST(0, current_stock - v_qty)
            WHERE id = v_product_id;
        END IF;
    END LOOP;

    -- 3. Process Installments (if debt)
    IF p_is_debt THEN
        FOR v_inst IN SELECT * FROM jsonb_array_elements(p_installments)
        LOOP
            INSERT INTO public.sale_installments (
                sale_id, installment_number, amount, due_date, status
            ) VALUES (
                v_sale_id, 
                (v_inst->>'number')::INT, 
                (v_inst->>'amount')::NUMERIC, 
                (v_inst->>'due_date')::TIMESTAMPTZ,
                'pending'
            );
        END LOOP;
    END IF;

    -- 4. Financial Transaction (if not debt and paid_amount > 0)
    IF NOT p_is_debt AND p_paid_amount > 0 THEN
        INSERT INTO public.transactions (
            amount, type, description, sale_id, category, account_id, status, created_at
        ) VALUES (
            p_paid_amount, 'income', 'Venda #' || COALESCE(p_sale_code, v_sale_id::TEXT), v_sale_id, 'Venda', p_financial_account_id, 'pago', p_created_at
        ) RETURNING id INTO v_transaction_id;

        -- Update account balance
        IF p_financial_account_id IS NOT NULL THEN
            UPDATE public.financial_accounts 
            SET current_balance = current_balance + p_paid_amount
            WHERE id = p_financial_account_id;
        END IF;
    END IF;

    -- 5. Update Client Cashback Balance
    IF p_client_id IS NOT NULL THEN
        -- Subtract used cashback
        IF p_cashback_used > 0 THEN
            UPDATE public.clients 
            SET cashback_balance = GREATEST(0, cashback_balance - p_cashback_used)
            WHERE id = p_client_id;

            INSERT INTO public.cashback_entries (client_id, amount, kind, description)
            VALUES (p_client_id, p_cashback_used, 'used', 'Resgate em venda #' || COALESCE(p_sale_code, v_sale_id::TEXT));
        END IF;

        -- Add earned cashback
        IF p_cashback_earned > 0 THEN
            UPDATE public.clients 
            SET cashback_balance = cashback_balance + p_cashback_earned
            WHERE id = p_client_id;

            INSERT INTO public.cashback_entries (client_id, amount, kind, description)
            VALUES (p_client_id, p_cashback_earned, 'earned', 'Ganho em venda #' || COALESCE(p_sale_code, v_sale_id::TEXT));
        END IF;
    END IF;

    RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql;