DROP TRIGGER IF EXISTS transaction_balance_trigger ON public.transactions;

CREATE TRIGGER transaction_balance_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.handle_transaction_balance();

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
        SET current_stock = current_stock - v_item.quantity
        WHERE id = v_item.material_id;
    END LOOP;

    -- 2. Remover as transações financeiras vinculadas
    -- O gatilho 'transaction_balance_trigger' (agora configurado para DELETE) 
    -- cuidará automaticamente do estorno do saldo na conta financeira.
    DELETE FROM public.transactions WHERE purchase_id = p_purchase_id;

    -- 3. Deletar a compra (os itens serão deletados via CASCADE se configurado)
    DELETE FROM public.purchases WHERE id = p_purchase_id;
END;
$function$;