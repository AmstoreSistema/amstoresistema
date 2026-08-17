CREATE OR REPLACE FUNCTION public.cancel_complete_sale(p_sale_id uuid)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_item RECORD;
    v_sale RECORD;
    v_stock RECORD;
    v_tx RECORD;
    v_cashback_to_reverse numeric(12,2);
BEGIN
    -- 1. Get sale info and lock it
    SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Venda % não encontrada', p_sale_id;
    END IF;

    -- 2. Restore items to stock
    FOR v_item IN SELECT * FROM public.sale_items WHERE sale_id = p_sale_id
    LOOP
        -- Update specific stock product if possible
        SELECT * INTO v_stock
        FROM public.stock_products
        WHERE produto_id = v_item.product_id
        ORDER BY created_at DESC
        LIMIT 1;

        IF FOUND THEN
            UPDATE public.stock_products
            SET
                quantidade_disponivel = COALESCE(quantidade_disponivel, 0) + v_item.quantity,
                numeracoes = CASE
                    WHEN v_item.numeracao IS NOT NULL AND v_item.numeracao <> '' THEN jsonb_set(
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

        -- Update global product stock
        UPDATE public.products
        SET current_stock = GREATEST(0, COALESCE(current_stock, 0) + v_item.quantity),
            updated_at = now()
        WHERE id = v_item.product_id;
    END LOOP;

    -- 3. Reverse account balances from related transactions
    FOR v_tx IN SELECT * FROM public.transactions WHERE sale_id = p_sale_id
    LOOP
        IF v_tx.account_id IS NOT NULL AND COALESCE(v_tx.status, 'pago') = 'pago' THEN
            IF v_tx.type IN ('entrada', 'income') THEN
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

    -- 4. Reverse cashback balance for the client
    -- We sum all 'earned' entries related to this sale
    SELECT COALESCE(SUM(amount), 0) INTO v_cashback_to_reverse
    FROM public.cashback_entries
    WHERE sale_id = p_sale_id AND kind = 'earned';

    -- Also account for 'used' cashback that should be returned to the client
    DECLARE
        v_cashback_to_return numeric(12,2);
    BEGIN
        SELECT COALESCE(SUM(amount), 0) INTO v_cashback_to_return
        FROM public.cashback_entries
        WHERE sale_id = p_sale_id AND kind = 'used';

        IF (v_cashback_to_reverse > 0 OR v_cashback_to_return > 0) AND v_sale.client_id IS NOT NULL THEN
            UPDATE public.clients
            SET cashback_balance = COALESCE(cashback_balance, 0) - v_cashback_to_reverse + v_cashback_to_return
            WHERE id = v_sale.client_id;
        END IF;
    END;

    -- 5. Delete all related records
    -- The FKs are likely ON DELETE CASCADE, but we explicitly clear important tables just in case
    DELETE FROM public.transactions WHERE sale_id = p_sale_id;
    DELETE FROM public.sale_payments WHERE sale_id = p_sale_id;
    DELETE FROM public.sale_installments WHERE sale_id = p_sale_id;
    DELETE FROM public.cashback_entries WHERE sale_id = p_sale_id;
    DELETE FROM public.qr_promo_history WHERE sale_id = p_sale_id;
    
    -- 6. Finally delete the sale itself
    DELETE FROM public.sales WHERE id = p_sale_id;
END;
$function$;