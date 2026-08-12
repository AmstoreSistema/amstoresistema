CREATE OR REPLACE FUNCTION public.cancel_complete_sale(p_sale_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_item RECORD;
    v_sale RECORD;
BEGIN
    SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Venda não encontrada'; END IF;

    -- Restaurar o estoque dos produtos e suas numerações
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
                    to_jsonb((COALESCE((numeracoes->>v_item.numeracao)::NUMERIC, 0) + v_item.quantity))
                )
                ELSE numeracoes
            END
        WHERE product_id = v_item.product_id;
    END LOOP;

    -- Remover transações financeiras vinculadas
    DELETE FROM public.transactions WHERE sale_id = p_sale_id;
    
    -- Remover registros de pagamentos
    DELETE FROM public.sale_payments WHERE sale_id = p_sale_id;
    
    -- Remover parcelas do fiado
    DELETE FROM public.sale_installments WHERE sale_id = p_sale_id;
    
    -- Devolver/Remover cashback do cliente
    IF v_sale.client_id IS NOT NULL THEN
        UPDATE public.clients
        SET cashback_balance = GREATEST(0, cashback_balance + COALESCE(v_sale.cashback_used, 0) - COALESCE(v_sale.cashback_earned, 0))
        WHERE id = v_sale.client_id;
    END IF;

    -- Remover os itens da venda
    DELETE FROM public.sale_items WHERE sale_id = p_sale_id;
    
    -- Finalmente remover a venda
    DELETE FROM public.sales WHERE id = p_sale_id;
END;
$function$;