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
    SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Venda % não encontrada', p_sale_id;
    END IF;

    FOR v_item IN SELECT * FROM public.sale_items WHERE sale_id = p_sale_id
    LOOP
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
            END
        WHERE produto_id = v_item.product_id;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'Estoque do produto % não encontrado para devolução', v_item.product_id;
        END IF;
    END LOOP;

    DELETE FROM public.debt_payments WHERE sale_id = p_sale_id;
    DELETE FROM public.transactions WHERE sale_id = p_sale_id;
    DELETE FROM public.sale_payments WHERE sale_id = p_sale_id;
    DELETE FROM public.sale_installments WHERE sale_id = p_sale_id;
    DELETE FROM public.sale_items WHERE sale_id = p_sale_id;

    IF v_sale.client_id IS NOT NULL THEN
        UPDATE public.clients
        SET cashback_balance = GREATEST(
            0,
            COALESCE(cashback_balance, 0)
              + COALESCE(v_sale.cashback_used, 0)
              - COALESCE(v_sale.cashback_earned, 0)
        )
        WHERE id = v_sale.client_id;
    END IF;

    DELETE FROM public.sales WHERE id = p_sale_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.cancel_complete_sale(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_complete_sale(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_complete_sale(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_complete_sale(uuid) TO service_role;