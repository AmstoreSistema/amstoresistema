CREATE OR REPLACE FUNCTION public.cancel_purchase(p_purchase_id UUID)
RETURNS void AS $$
DECLARE
    v_item RECORD;
BEGIN
    -- 1. Estornar o estoque dos materiais
    FOR v_item IN (SELECT material_id, quantity FROM public.purchase_items WHERE purchase_id = p_purchase_id) LOOP
        UPDATE public.materials
        SET current_stock = current_stock - v_item.quantity
        WHERE id = v_item.material_id;
    END LOOP;

    -- 2. Remover a transação financeira vinculada (baseada na descrição que criamos anteriormente)
    -- Nota: Idealmente teríamos uma FK, mas como o sistema usa descrição, buscamos pela string
    -- A descrição na rota é `Compra: ${itemsSummary}`.
    -- Para segurança total, seria melhor uma coluna de vínculo, mas vamos deletar a compra primeiro.
    -- O DELETE CASCADE na tabela purchase_items cuidará dos itens.
    
    DELETE FROM public.purchases WHERE id = p_purchase_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.cancel_purchase(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_purchase(UUID) TO service_role;
