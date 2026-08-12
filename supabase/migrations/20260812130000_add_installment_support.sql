-- Adicionando colunas de parcelamento na tabela de vendas
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS installments_count INTEGER DEFAULT 1;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ;

-- Tabela de parcelas para controle de vendas fiado
CREATE TABLE IF NOT EXISTS public.sale_installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE NOT NULL,
    installment_number INTEGER NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    due_date TIMESTAMPTZ NOT NULL,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
    paid_at TIMESTAMPTZ,
    payment_method TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS e Permissões para sale_installments
ALTER TABLE public.sale_installments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_installments TO authenticated;
GRANT ALL ON public.sale_installments TO service_role;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all for authenticated users' AND tablename = 'sale_installments') THEN
        CREATE POLICY "Allow all for authenticated users" ON public.sale_installments FOR ALL TO authenticated USING (true);
    END IF;
END $$;

-- Atualizar a função create_complete_sale para suportar parcelas
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
    p_installments JSONB DEFAULT '[]'::JSONB
) RETURNS UUID AS $$
DECLARE
    v_sale_id UUID;
    v_item JSONB;
    v_inst JSONB;
    v_status TEXT;
BEGIN
    -- Determinar status inicial
    IF p_paid_amount >= p_total_amount THEN
        v_status := 'paid';
    ELSIF p_paid_amount > 0 OR p_is_debt THEN
        v_status := 'partial';
    ELSE
        v_status := 'pending';
    END IF;

    -- Criar a venda
    INSERT INTO public.sales (
        client_id, payment_method, total_amount, discount, paid_amount, 
        is_debt, status, cashback_used, cashback_earned, notes,
        installments_count
    ) VALUES (
        p_client_id, p_payment_method, p_total_amount, p_discount, p_paid_amount,
        p_is_debt, v_status, p_cashback_used, p_cashback_earned, p_notes,
        COALESCE(jsonb_array_length(p_installments), 1)
    ) RETURNING id INTO v_sale_id;

    -- Inserir itens e atualizar estoque
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

    -- Inserir parcelas se for venda fiado/parcelada
    IF p_is_debt AND jsonb_array_length(p_installments) > 0 THEN
        FOR v_inst IN SELECT * FROM jsonb_array_elements(p_installments)
        LOOP
            INSERT INTO public.sale_installments (
                sale_id, installment_number, amount, due_date, status
            ) VALUES (
                v_sale_id,
                (v_inst->>'number')::INTEGER,
                (v_inst->>'amount')::NUMERIC,
                (v_inst->>'due_date')::TIMESTAMPTZ,
                'pending'
            );
        END LOOP;
    END IF;

    -- Registrar transação financeira se houver pagamento imediato
    IF p_paid_amount > 0 THEN
        INSERT INTO public.transactions (
            amount, type, description, sale_id, category
        ) VALUES (
            p_paid_amount, 'income', 'Venda #' || substring(v_sale_id::text from 1 for 8), v_sale_id, 'Venda'
        );
        
        -- Registrar na sale_payments
        INSERT INTO public.sale_payments (sale_id, amount, payment_method)
        VALUES (v_sale_id, p_paid_amount, p_payment_method);
    END IF;

    -- Atualizar saldo de cashback do cliente
    IF p_client_id IS NOT NULL THEN
        UPDATE public.clients
        SET cashback_balance = cashback_balance - p_cashback_used + p_cashback_earned
        WHERE id = p_client_id;
    END IF;

    RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
