-- Add new columns to sales table
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS sale_type TEXT DEFAULT 'Varejo',
ADD COLUMN IF NOT EXISTS seller_id UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS financial_account_id UUID REFERENCES public.financial_accounts(id),
ADD COLUMN IF NOT EXISTS protection_method TEXT,
ADD COLUMN IF NOT EXISTS sale_code TEXT;

-- Update create_complete_sale to handle these new fields
CREATE OR REPLACE FUNCTION public.create_complete_sale(
    p_client_id UUID,
    p_payment_method TEXT,
    p_total_amount NUMERIC,
    p_discount NUMERIC,
    p_paid_amount NUMERIC,
    p_is_debt BOOLEAN,
    p_cashback_used NUMERIC,
    p_cashback_earned NUMERIC,
    p_notes TEXT,
    p_items JSONB,
    p_installments JSONB DEFAULT '[]'::JSONB,
    p_sale_type TEXT DEFAULT 'Varejo',
    p_financial_account_id UUID DEFAULT NULL,
    p_protection_method TEXT DEFAULT NULL,
    p_sale_code TEXT DEFAULT NULL
) RETURNS UUID 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sale_id UUID;
    v_item JSONB;
    v_inst JSONB;
    v_status TEXT;
    v_final_sale_code TEXT;
BEGIN
    -- Generate sale code if not provided
    IF p_sale_code IS NULL OR p_sale_code = '' THEN
        v_final_sale_code := 'V' || to_char(now(), 'YYMMDDHH24MISS');
    ELSE
        v_final_sale_code := p_sale_code;
    END IF;

    IF p_paid_amount >= p_total_amount THEN
        v_status := 'paid';
    ELSIF p_paid_amount > 0 OR p_is_debt THEN
        v_status := 'partial';
    ELSE
        v_status := 'pending';
    END IF;

    INSERT INTO public.sales (
        client_id, payment_method, total_amount, discount, paid_amount, 
        is_debt, status, cashback_used, cashback_earned, notes,
        installments_count, sale_type, financial_account_id, 
        protection_method, sale_code, seller_id
    ) VALUES (
        p_client_id, p_payment_method, p_total_amount, p_discount, p_paid_amount,
        p_is_debt, v_status, p_cashback_used, p_cashback_earned, p_notes,
        COALESCE(jsonb_array_length(p_installments), 1), p_sale_type, p_financial_account_id,
        p_protection_method, v_final_sale_code, auth.uid()
    ) RETURNING id INTO v_sale_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        INSERT INTO public.sale_items (
            sale_id, product_id, quantity, unit_price, numeracao, discount, stock_snapshot
        ) VALUES (
            v_sale_id, 
            (v_item->>'product_id')::UUID, 
            (v_item->>'quantity')::NUMERIC, 
            (v_item->>'unit_price')::NUMERIC,
            (v_item->>'numeracao'),
            COALESCE((v_item->>'discount')::NUMERIC, 0),
            (v_item->'stock_snapshot')
        );

        IF (v_item->>'stock_id') IS NOT NULL THEN
            UPDATE public.stock_products
            SET 
                quantidade_disponivel = quantidade_disponivel - (v_item->>'quantity')::NUMERIC,
                numeracoes = CASE 
                    WHEN (v_item->>'numeracao') IS NOT NULL AND numeracoes ? (v_item->>'numeracao')
                    THEN jsonb_set(
                        numeracoes, 
                        ARRAY[v_item->>'numeracao'], 
                        to_jsonb(GREATEST(0, (COALESCE((numeracoes->>(v_item->>'numeracao'))::NUMERIC, 0) - (v_item->>'quantity')::NUMERIC)))
                    )
                    ELSE numeracoes
                END
            WHERE id = (v_item->>'stock_id')::UUID;
        END IF;
    END LOOP;

    IF p_is_debt AND jsonb_array_length(p_installments) > 0 THEN
        FOR v_inst IN SELECT * FROM jsonb_array_elements(p_installments)
        LOOP
            INSERT INTO public.sale_installments (
                sale_id, installment_number, amount, due_date, status, paid_amount, remaining_amount
            ) VALUES (
                v_sale_id,
                (v_inst->>'number')::INTEGER,
                (v_inst->>'amount')::NUMERIC,
                (v_inst->>'due_date')::TIMESTAMPTZ,
                'pending',
                0,
                (v_inst->>'amount')::NUMERIC
            );
        END LOOP;
    END IF;

    IF p_paid_amount > 0 THEN
        INSERT INTO public.transactions (
            amount, type, description, sale_id, category, account_id
        ) VALUES (
            p_paid_amount, 'income', 'Venda #' || v_final_sale_code, v_sale_id, 'Venda', p_financial_account_id
        );
        
        INSERT INTO public.sale_payments (sale_id, amount, payment_method)
        VALUES (v_sale_id, p_paid_amount, p_payment_method);
    END IF;

    IF p_client_id IS NOT NULL THEN
        UPDATE public.clients
        SET cashback_balance = cashback_balance - p_cashback_used + p_cashback_earned
        WHERE id = p_client_id;
    END IF;

    RETURN v_sale_id;
END;
$$;

-- Grant permissions again for the new signature
GRANT EXECUTE ON FUNCTION public.create_complete_sale(uuid, text, numeric, numeric, numeric, boolean, numeric, numeric, text, jsonb, jsonb, text, uuid, text, text) TO authenticated;
