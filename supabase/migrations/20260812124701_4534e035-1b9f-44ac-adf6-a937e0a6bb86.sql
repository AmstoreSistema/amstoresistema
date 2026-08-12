-- Adicionando colunas necessárias para a tabela de vendas se não existirem
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'sales' AND COLUMN_NAME = 'discount') THEN
        ALTER TABLE public.sales ADD COLUMN discount NUMERIC(10,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'sales' AND COLUMN_NAME = 'paid_amount') THEN
        ALTER TABLE public.sales ADD COLUMN paid_amount NUMERIC(10,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'sales' AND COLUMN_NAME = 'payment_method') THEN
        ALTER TABLE public.sales ADD COLUMN payment_method TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'sales' AND COLUMN_NAME = 'status') THEN
        ALTER TABLE public.sales ADD COLUMN status TEXT DEFAULT 'pending';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'sales' AND COLUMN_NAME = 'is_debt') THEN
        ALTER TABLE public.sales ADD COLUMN is_debt BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'sales' AND COLUMN_NAME = 'cashback_used') THEN
        ALTER TABLE public.sales ADD COLUMN cashback_used NUMERIC(10,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'sales' AND COLUMN_NAME = 'cashback_earned') THEN
        ALTER TABLE public.sales ADD COLUMN cashback_earned NUMERIC(10,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'sales' AND COLUMN_NAME = 'notes') THEN
        ALTER TABLE public.sales ADD COLUMN notes TEXT;
    END IF;
END $$;

-- Tabela de pagamentos vinculados a vendas
CREATE TABLE IF NOT EXISTS public.sale_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    payment_method TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Habilitar RLS e Permissões para sale_payments
ALTER TABLE public.sale_payments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sale_payments TO authenticated;
GRANT ALL ON public.sale_payments TO service_role;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all for authenticated users' AND tablename = 'sale_payments') THEN
        CREATE POLICY "Allow all for authenticated users" ON public.sale_payments FOR ALL TO authenticated USING (true);
    END IF;
END $$;

-- Ajustes em sale_items
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'sale_items' AND COLUMN_NAME = 'numeracao') THEN
        ALTER TABLE public.sale_items ADD COLUMN numeracao TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'sale_items' AND COLUMN_NAME = 'discount') THEN
        ALTER TABLE public.sale_items ADD COLUMN discount NUMERIC(10,2) DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'sale_items' AND COLUMN_NAME = 'stock_snapshot') THEN
        ALTER TABLE public.sale_items ADD COLUMN stock_snapshot JSONB;
    END IF;
END $$;

-- Função atômica para criar venda
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
    p_items JSONB
) RETURNS UUID AS $$
DECLARE
    v_sale_id UUID;
    v_item JSONB;
    v_status TEXT;
BEGIN
    -- Determinar status
    IF p_paid_amount >= p_total_amount THEN
        v_status := 'paid';
    ELSIF p_paid_amount > 0 THEN
        v_status := 'partial';
    ELSE
        v_status := 'pending';
    END IF;

    -- Criar a venda
    INSERT INTO public.sales (
        client_id, payment_method, total_amount, discount, paid_amount, 
        is_debt, status, cashback_used, cashback_earned, notes
    ) VALUES (
        p_client_id, p_payment_method, p_total_amount, p_discount, p_paid_amount,
        p_is_debt, v_status, p_cashback_used, p_cashback_earned, p_notes
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
                    WHEN (v_item->>'numeracao') IS NOT NULL AND (numeracoes ? (v_item->>'numeracao'))
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

    -- Registrar transação financeira se houver pagamento
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

-- Função atômica para cancelar venda
CREATE OR REPLACE FUNCTION public.cancel_complete_sale(p_sale_id UUID) RETURNS VOID AS $$
DECLARE
    v_item RECORD;
    v_sale RECORD;
BEGIN
    SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id;
    
    IF v_sale.status = 'cancelled' THEN
        RETURN;
    END IF;

    -- Estornar estoque
    FOR v_item IN SELECT * FROM public.sale_items WHERE sale_id = p_sale_id
    LOOP
        UPDATE public.stock_products
        SET 
            quantidade_disponivel = quantidade_disponivel + v_item.quantity,
            numeracoes = CASE 
                WHEN v_item.numeracao IS NOT NULL AND (numeracoes ? v_item.numeracao)
                THEN jsonb_set(
                    numeracoes, 
                    ARRAY[v_item.numeracao], 
                    to_jsonb(COALESCE((numeracoes->>(v_item.numeracao))::NUMERIC, 0) + v_item.quantity)
                )
                ELSE numeracoes
            END
        WHERE product_id = v_item.product_id;
    END LOOP;

    -- Reverter cashback
    IF v_sale.client_id IS NOT NULL THEN
        UPDATE public.clients
        SET cashback_balance = cashback_balance + v_sale.cashback_used - v_sale.cashback_earned
        WHERE id = v_sale.client_id;
    END IF;

    -- Marcar venda como cancelada
    UPDATE public.sales SET status = 'cancelled' WHERE id = p_sale_id;

    -- Remover transações associadas
    DELETE FROM public.transactions WHERE sale_id = p_sale_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
