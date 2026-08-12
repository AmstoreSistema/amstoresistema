
-- Primeiro removemos as versões existentes para evitar conflitos de overload
DROP FUNCTION IF EXISTS public.create_complete_sale(UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, NUMERIC, NUMERIC, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.create_complete_sale(UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, NUMERIC, NUMERIC, TEXT, JSONB, JSONB);
DROP FUNCTION IF EXISTS public.create_complete_sale(UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, NUMERIC, NUMERIC, TEXT, JSONB, JSONB, TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS public.create_complete_sale(UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, NUMERIC, NUMERIC, TEXT, JSONB, JSONB, TEXT, UUID, TEXT, TIMESTAMP WITH TIME ZONE);

-- Função auxiliar para calcular total
CREATE OR REPLACE FUNCTION public.p_total_amount_calculated(p_items JSONB, p_discount NUMERIC)
RETURNS NUMERIC
LANGUAGE plpgsql
AS $$
DECLARE
    v_total NUMERIC := 0;
    v_item JSONB;
BEGIN
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        return 0 - p_discount;
    END IF;
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_total := v_total + ((v_item->>'quantity')::NUMERIC * (v_item->>'unit_price')::NUMERIC - COALESCE((v_item->>'discount')::NUMERIC, 0));
    END LOOP;
    RETURN v_total - p_discount;
END;
$$;

-- Agora criamos a versão definitiva e robusta
CREATE OR REPLACE FUNCTION public.create_complete_sale(
    p_cashback_earned NUMERIC DEFAULT 0,
    p_cashback_used NUMERIC DEFAULT 0,
    p_client_id UUID DEFAULT NULL,
    p_created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    p_discount NUMERIC DEFAULT 0,
    p_financial_account_id UUID DEFAULT NULL,
    p_installments JSONB DEFAULT '[]'::jsonb,
    p_is_debt BOOLEAN DEFAULT FALSE,
    p_items JSONB DEFAULT '[]'::jsonb,
    p_notes TEXT DEFAULT '',
    p_paid_amount NUMERIC DEFAULT 0,
    p_payment_method TEXT DEFAULT 'Dinheiro',
    p_protection_method TEXT DEFAULT NULL,
    p_sale_code TEXT DEFAULT NULL,
    p_sale_type TEXT DEFAULT 'Varejo'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sale_id UUID;
    v_item JSONB;
    v_inst JSONB;
    v_status TEXT;
    v_total_amount NUMERIC;
BEGIN
    v_total_amount := public.p_total_amount_calculated(p_items, p_discount);

    -- Determinar status
    IF p_paid_amount >= v_total_amount THEN
        v_status := 'paid';
    ELSIF p_paid_amount > 0 OR p_is_debt THEN
        v_status := 'partial';
    ELSE
        v_status := 'pending';
    END IF;

    -- Criar a venda
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
        sale_code,
        sale_type,
        created_at,
        installments_count
    ) VALUES (
        p_client_id, 
        p_payment_method, 
        v_total_amount,
        p_discount, 
        p_paid_amount,
        p_is_debt, 
        v_status, 
        p_cashback_used, 
        p_cashback_earned, 
        p_notes,
        p_sale_code,
        p_sale_type,
        COALESCE(p_created_at, NOW()),
        COALESCE(jsonb_array_length(p_installments), 0)
    ) RETURNING id INTO v_sale_id;

    -- Inserir itens e atualizar estoque
    IF p_items IS NOT NULL THEN
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

            -- Atualizar estoque do produto (stock_products)
            UPDATE public.stock_products
            SET 
                quantidade_disponivel = quantidade_disponivel - (v_item->>'quantity')::NUMERIC,
                numeracoes = CASE 
                    WHEN (v_item->>'numeracao') IS NOT NULL AND (numeracoes ? (v_item->>'numeracao'))
                    THEN jsonb_set(
                        numeracoes, 
                        ARRAY[v_item->>'numeracao'], 
                        to_jsonb(GREATEST(0, (COALESCE((numeracoes->>(v_item->>'numeracao'))::NUMERIC, 0) - (v_item->>'quantity')::NUMERIC)))
                    )
                    ELSE numeracoes
                END
            WHERE id = COALESCE((v_item->>'stock_id')::UUID, (SELECT id FROM public.stock_products WHERE product_id = (v_item->>'product_id')::UUID LIMIT 1));
        END LOOP;
    END IF;

    -- Inserir parcelas se houver
    IF p_installments IS NOT NULL AND jsonb_array_length(p_installments) > 0 THEN
        FOR v_inst IN SELECT * FROM jsonb_array_elements(p_installments)
        LOOP
            INSERT INTO public.sale_installments (
                sale_id, installment_number, amount, due_date, status
            ) VALUES (
                v_sale_id, 
                (v_inst->>'number')::INTEGER, 
                (v_inst->>'amount')::NUMERIC, 
                (v_inst->>'due_date')::TIMESTAMP WITH TIME ZONE,
                'pending'
            );
        END LOOP;
    END IF;

    -- Registrar transação financeira se houver pagamento
    IF p_paid_amount > 0 THEN
        INSERT INTO public.transactions (
            amount, 
            type, 
            description, 
            sale_id, 
            category,
            account_id,
            created_at
        ) VALUES (
            p_paid_amount, 
            'income', 
            'Venda #' || COALESCE(p_sale_code, substring(v_sale_id::text from 1 for 8)), 
            v_sale_id, 
            'Venda',
            p_financial_account_id,
            COALESCE(p_created_at, NOW())
        );
        
        -- Registrar na sale_payments
        INSERT INTO public.sale_payments (sale_id, amount, payment_method, financial_account_id, created_at)
        VALUES (v_sale_id, p_paid_amount, p_payment_method, p_financial_account_id, COALESCE(p_created_at, NOW()));
    END IF;

    -- Atualizar saldo de cashback do cliente
    IF p_client_id IS NOT NULL THEN
        UPDATE public.clients
        SET cashback_balance = COALESCE(cashback_balance, 0) - p_cashback_used + p_cashback_earned
        WHERE id = p_client_id;
    END IF;

    RETURN v_sale_id;
END;
$$;

-- Garantir privilégios
GRANT EXECUTE ON FUNCTION public.create_complete_sale(NUMERIC, NUMERIC, UUID, TIMESTAMP WITH TIME ZONE, NUMERIC, UUID, JSONB, BOOLEAN, JSONB, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_complete_sale(NUMERIC, NUMERIC, UUID, TIMESTAMP WITH TIME ZONE, NUMERIC, UUID, JSONB, BOOLEAN, JSONB, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.p_total_amount_calculated(JSONB, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.p_total_amount_calculated(JSONB, NUMERIC) TO service_role;
