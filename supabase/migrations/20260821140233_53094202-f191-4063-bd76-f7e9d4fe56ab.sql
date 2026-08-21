CREATE OR REPLACE FUNCTION public.cancel_purchase(p_purchase_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
    v_item RECORD;
    v_tx RECORD;
BEGIN
    -- 1. Estornar o estoque dos materiais
    FOR v_item IN (SELECT material_id, quantity FROM public.purchase_items WHERE purchase_id = p_purchase_id) LOOP
        UPDATE public.materials
        SET current_stock = current_stock - v_item.quantity
        WHERE id = v_item.material_id;
    END LOOP;

    -- 2. Estornar os saldos das contas financeiras das transações vinculadas
    FOR v_tx IN (SELECT account_id, amount, type, status FROM public.transactions WHERE purchase_id = p_purchase_id) LOOP
        IF v_tx.account_id IS NOT NULL AND COALESCE(v_tx.status, 'pago') = 'pago' THEN
            -- Se for saída (compra), devolvemos o valor à conta
            IF v_tx.type IN ('saida', 'expense') THEN
                UPDATE public.financial_accounts
                SET current_balance = COALESCE(current_balance, 0) + v_tx.amount
                WHERE id = v_tx.account_id;
            -- Se for entrada (improvável em compra, mas para consistência), removemos o valor
            ELSIF v_tx.type IN ('entrada', 'income') THEN
                UPDATE public.financial_accounts
                SET current_balance = COALESCE(current_balance, 0) - v_tx.amount
                WHERE id = v_tx.account_id;
            END IF;
        END IF;
    END LOOP;

    -- 3. Remover as transações financeiras vinculadas
    DELETE FROM public.transactions WHERE purchase_id = p_purchase_id;

    -- 4. Deletar a compra (os itens serão deletados via CASCADE se configurado)
    DELETE FROM public.purchases WHERE id = p_purchase_id;
END;
$function$;