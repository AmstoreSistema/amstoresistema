-- 1. Unificar CASCADE em chaves estrangeiras relacionadas a vendas
DO $$
BEGIN
    -- sale_items
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'sale_items_sale_id_fkey') THEN
        ALTER TABLE public.sale_items DROP CONSTRAINT sale_items_sale_id_fkey;
    END IF;
    ALTER TABLE public.sale_items ADD CONSTRAINT sale_items_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;

    -- sale_payments
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'sale_payments_sale_id_fkey') THEN
        ALTER TABLE public.sale_payments DROP CONSTRAINT sale_payments_sale_id_fkey;
    END IF;
    ALTER TABLE public.sale_payments ADD CONSTRAINT sale_payments_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;

    -- sale_installments
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'sale_installments_sale_id_fkey') THEN
        ALTER TABLE public.sale_installments DROP CONSTRAINT sale_installments_sale_id_fkey;
    END IF;
    ALTER TABLE public.sale_installments ADD CONSTRAINT sale_installments_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;

    -- transactions
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'transactions_sale_id_fkey') THEN
        ALTER TABLE public.transactions DROP CONSTRAINT transactions_sale_id_fkey;
    END IF;
    ALTER TABLE public.transactions ADD CONSTRAINT transactions_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;

    -- qr_promo_history
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'qr_promo_history_sale_id_fkey') THEN
        ALTER TABLE public.qr_promo_history DROP CONSTRAINT qr_promo_history_sale_id_fkey;
    END IF;
    ALTER TABLE public.qr_promo_history ADD CONSTRAINT qr_promo_history_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;

    -- cashback_entries
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'cashback_entries_sale_id_fkey') THEN
        ALTER TABLE public.cashback_entries DROP CONSTRAINT cashback_entries_sale_id_fkey;
    END IF;
    -- Adicionando coluna sale_id se não existir
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'cashback_entries' AND column_name = 'sale_id') THEN
        ALTER TABLE public.cashback_entries ADD COLUMN sale_id uuid;
    END IF;
    ALTER TABLE public.cashback_entries ADD CONSTRAINT cashback_entries_sale_id_fkey FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;
END $$;

-- 2. Trigger para Sincronização Automática de Saldo de Cashback em clients
CREATE OR REPLACE FUNCTION public.sync_client_cashback_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_client_id uuid;
    v_total numeric;
BEGIN
    IF TG_OP = 'DELETE' THEN
        v_client_id := OLD.client_id;
    ELSE
        v_client_id := NEW.client_id;
    END IF;

    IF v_client_id IS NOT NULL THEN
        SELECT COALESCE(SUM(
            CASE 
                WHEN kind = 'earned' THEN amount 
                WHEN kind = 'used' THEN -amount 
                ELSE 0 
            END
        ), 0) INTO v_total
        FROM public.cashback_entries
        WHERE client_id = v_client_id;

        UPDATE public.clients
        SET cashback_balance = GREATEST(0, v_total),
            updated_at = now()
        WHERE id = v_client_id;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_sync_cashback_balance ON public.cashback_entries;
CREATE TRIGGER tr_sync_cashback_balance
AFTER INSERT OR UPDATE OR DELETE ON public.cashback_entries
FOR EACH ROW EXECUTE FUNCTION public.sync_client_cashback_balance();

-- 3. Atualizar saldos existentes para garantir consistência inicial
DO $$
DECLARE
    v_client RECORD;
    v_total numeric;
BEGIN
    FOR v_client IN SELECT id FROM public.clients LOOP
        SELECT COALESCE(SUM(
            CASE 
                WHEN kind = 'earned' THEN amount 
                WHEN kind = 'used' THEN -amount 
                ELSE 0 
            END
        ), 0) INTO v_total
        FROM public.cashback_entries
        WHERE client_id = v_client.id;

        UPDATE public.clients
        SET cashback_balance = GREATEST(0, v_total)
        WHERE id = v_client.id;
    END LOOP;
END $$;

-- 4. Melhorar a função get_client_cashback_by_category para refletir saldo real
CREATE OR REPLACE FUNCTION public.get_client_cashback_by_category(p_client_id uuid)
RETURNS TABLE (
    category_name TEXT,
    total_earned NUMERIC,
    total_used NUMERIC,
    balance NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH earned AS (
    SELECT 
      p.category,
      SUM(si.quantity * si.unit_price * (COALESCE(cc.cashback_percent, 0) / 100.0)) as earned_amount
    FROM public.sale_items si
    JOIN public.sales s ON s.id = si.sale_id
    JOIN public.products p ON p.id = si.product_id
    LEFT JOIN public.material_categories mc ON mc.name = p.category
    LEFT JOIN public.cashback_config cc ON cc.category_id = mc.id AND cc.active = true
    WHERE s.client_id = p_client_id
    GROUP BY p.category
  ),
  used AS (
    -- Estimativa de uso por categoria proporcional ao ganho histórico (ou simplificado)
    -- Já que o sistema não rastreia uso por categoria explicitamente, vamos focar no saldo total
    SELECT 
        SUM(cashback_used) as total_used_sum
    FROM public.sales
    WHERE client_id = p_client_id
  )
  SELECT 
    mc.name::TEXT as category_name,
    COALESCE(e.earned_amount, 0)::NUMERIC as total_earned,
    0::NUMERIC as total_used, -- Mantido 0 por enquanto, pois o desconto é global na venda
    COALESCE(e.earned_amount, 0)::NUMERIC as balance
  FROM public.material_categories mc
  LEFT JOIN earned e ON e.category = mc.name
  ORDER BY mc.name;
END;
$$ LANGUAGE plpgsql;

-- 5. Garantir que cancel_complete_sale use DELETE para disparar os gatilhos e cascatas
CREATE OR REPLACE FUNCTION public.cancel_complete_sale(p_sale_id uuid)
RETURNS void AS $$
DECLARE
    v_item RECORD;
    v_sale RECORD;
    v_stock RECORD;
    v_tx RECORD;
BEGIN
    SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Venda % não encontrada', p_sale_id;
    END IF;

    -- Devolve itens ao estoque
    FOR v_item IN SELECT * FROM public.sale_items WHERE sale_id = p_sale_id
    LOOP
        SELECT * INTO v_stock
        FROM public.stock_products
        WHERE produto_id = v_item.product_id
        ORDER BY created_at NULLS LAST
        LIMIT 1;

        IF FOUND THEN
            UPDATE public.stock_products
            SET
                quantidade_disponivel = COALESCE(quantidade_disponivel, 0) + v_item.quantity,
                numeracoes = CASE
                    WHEN v_item.numeracao IS NOT NULL THEN jsonb_set(
                        COALESCE(numeracoes, '{}'::jsonb),
                        ARRAY[v_item.numeracao],
                        to_jsonb(COALESCE((numeracoes->>v_item.numeracao)::numeric, 0) + v_item.quantity),
                        true
                    )
                    ELSE numeracoes
                END,
                updated_at = now()
            WHERE id = v_stock.id;
        END IF;

        UPDATE public.products
        SET current_stock = GREATEST(0, COALESCE(current_stock, 0) + v_item.quantity),
            updated_at = now()
        WHERE id = v_item.product_id;
    END LOOP;

    -- Reverte saldo das contas financeiras
    FOR v_tx IN SELECT * FROM public.transactions WHERE sale_id = p_sale_id
    LOOP
        IF v_tx.account_id IS NOT NULL AND COALESCE(v_tx.status, 'pago') = 'pago' THEN
            IF v_tx.type IN ('entrada', 'income', 'entrada') THEN
                UPDATE public.financial_accounts
                SET current_balance = COALESCE(current_balance, 0) - v_tx.amount
                WHERE id = v_tx.account_id;
            ELSIF v_tx.type IN ('saida', 'expense') THEN
                UPDATE public.financial_accounts
                SET current_balance = COALESCE(current_balance, 0) + v_tx.amount
                WHERE id = v_tx.account_id;
            END IF;
        END IF;
    END LOOP;

    -- O CASCADE tratará o resto (sale_items, transactions, payments, installments, qr_history, cashback_entries)
    -- Mas precisamos garantir que cashback_entries tenha sale_id preenchido.
    -- O delete da venda disparará o recalculo de saldo via trigger se houver sale_id em cashback_entries.
    
    DELETE FROM public.sales WHERE id = p_sale_id;
END;
$$ LANGUAGE plpgsql;
