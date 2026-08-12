CREATE OR REPLACE FUNCTION public.cancel_complete_sale(p_sale_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

    -- Devolve itens ao estoque quando existir registro de estoque
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

    -- Reverte saldo das contas financeiras das transações pagas desta venda
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

    DELETE FROM public.debt_payments WHERE sale_id = p_sale_id;
    DELETE FROM public.transactions WHERE sale_id = p_sale_id;
    DELETE FROM public.sale_payments WHERE sale_id = p_sale_id;
    DELETE FROM public.sale_installments WHERE sale_id = p_sale_id;
    DELETE FROM public.qr_promo_history WHERE sale_id = p_sale_id OR used_in_sale_id = p_sale_id;
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

-- Permitir que usuários autenticados leiam os cargos (necessário para a tela de administradores)
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

DROP POLICY IF EXISTS "Authenticated users can read roles" ON public.user_roles;
CREATE POLICY "Authenticated users can read roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));