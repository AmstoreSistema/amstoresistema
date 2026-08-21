CREATE OR REPLACE FUNCTION public.cancel_purchase(p_purchase_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
    v_item RECORD;
BEGIN
    -- 1. Estornar o estoque dos materiais
    FOR v_item IN (SELECT material_id, quantity FROM public.purchase_items WHERE purchase_id = p_purchase_id) LOOP
        UPDATE public.materials
        SET current_stock = GREATEST(0, COALESCE(current_stock, 0) - v_item.quantity),
            updated_at = now()
        WHERE id = v_item.material_id;
    END LOOP;

    -- 2. Remover as transações financeiras vinculadas
    -- O gatilho 'transaction_balance_trigger' configurado para DELETE 
    -- cuidará automaticamente do estorno do saldo na conta financeira.
    DELETE FROM public.transactions WHERE purchase_id = p_purchase_id;

    -- 3. Deletar a compra (os itens são deletados via CASCADE se configurado,
    -- mas garantimos a ordem para evitar erros de FK se necessário)
    DELETE FROM public.purchase_items WHERE purchase_id = p_purchase_id;
    DELETE FROM public.purchases WHERE id = p_purchase_id;
END;
$function$;