-- 1) Configuração padrão da promoção QR (tabela ficou vazia)
INSERT INTO public.qr_promo_config (active, name, sales_limit, bonus_value, awarded_positions, standard_message, awarded_message, current_counter)
SELECT false, 'Promoção QR Code', 100, 20, '10,50,100',
       'Obrigado pela compra! Guarde seu cupom e participe das nossas promoções.',
       'Parabéns! Você foi premiado com um bônus especial. Apresente este cupom na loja.',
       0
WHERE NOT EXISTS (SELECT 1 FROM public.qr_promo_config);

-- 2) Status correto para vendas fiado
DROP FUNCTION IF EXISTS public.create_complete_sale(jsonb,text,numeric,numeric,boolean,numeric,numeric,uuid,uuid,text,text,text,text,timestamp with time zone,numeric,numeric,jsonb);

CREATE OR REPLACE FUNCTION public.create_complete_sale(
    p_items jsonb,
    p_payment_method text,
    p_total_amount numeric,
    p_paid_amount numeric,
    p_is_debt boolean,
    p_discount numeric,
    p_discount_amount numeric,
    p_client_id uuid DEFAULT NULL,
    p_financial_account_id uuid DEFAULT NULL,
    p_notes text DEFAULT NULL,
    p_sale_type text DEFAULT 'Varejo',
    p_protection_method text DEFAULT NULL,
    p_sale_code text DEFAULT NULL,
    p_created_at timestamp with time zone DEFAULT now(),
    p_cashback_used numeric DEFAULT 0,
    p_cashback_earned numeric DEFAULT 0,
    p_installments jsonb DEFAULT '[]'::jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_sale_id uuid;
    v_item jsonb;
    v_inst jsonb;
    v_stock_id uuid;
    v_product_id uuid;
    v_quantity integer;
    v_numeracao text;
    v_unit_price numeric;
    v_item_discount numeric;
    v_sale_code text;
    v_available numeric;
    v_product_name text;
    v_status text;
BEGIN
    IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'A venda deve conter pelo menos um item.';
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_stock_id := (v_item->>'stock_id')::uuid;
        v_quantity := (v_item->>'quantity')::integer;
        v_numeracao := v_item->>'numeracao';

        IF v_quantity IS NULL OR v_quantity <= 0 THEN
            RAISE EXCEPTION 'Quantidade inválida em um dos itens da venda';
        END IF;

        IF v_stock_id IS NOT NULL THEN
            SELECT COALESCE(quantidade_disponivel, 0), produto_nome
              INTO v_available, v_product_name
            FROM public.stock_products
            WHERE id = v_stock_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Item de estoque não encontrado';
            END IF;

            IF v_numeracao IS NOT NULL AND v_numeracao <> '' THEN
                SELECT COALESCE((numeracoes->>v_numeracao)::numeric, 0)
                  INTO v_available
                FROM public.stock_products
                WHERE id = v_stock_id;

                IF v_available < v_quantity THEN
                    RAISE EXCEPTION 'Estoque insuficiente de % (numeração %): disponível %, solicitado %',
                        COALESCE(v_product_name, 'produto'), v_numeracao, v_available, v_quantity;
                END IF;
            ELSIF v_available < v_quantity THEN
                RAISE EXCEPTION 'Estoque insuficiente de %: disponível %, solicitado %',
                    COALESCE(v_product_name, 'produto'), v_available, v_quantity;
            END IF;
        END IF;
    END LOOP;

    v_sale_code := COALESCE(p_sale_code, 'V' || to_char(now(), 'YYYYMMDDHH24MISS') || floor(random()*100)::text);

    -- Status coerente com o tipo de venda
    IF p_is_debt THEN
        IF COALESCE(p_paid_amount, 0) <= 0.009 THEN
            v_status := 'pendente';
        ELSIF COALESCE(p_paid_amount, 0) >= p_total_amount - 0.009 THEN
            v_status := 'pago';
        ELSE
            v_status := 'parcial';
        END IF;
    ELSE
        v_status := 'pago';
    END IF;

    INSERT INTO public.sales (
        client_id, total_amount, discount, discount_amount, paid_amount,
        payment_method, is_debt, cashback_used, cashback_earned,
        notes, sale_type, sale_code, created_at, financial_account_id, protection_method, status
    ) VALUES (
        p_client_id, p_total_amount, p_discount, p_discount_amount, p_paid_amount,
        p_payment_method, p_is_debt, p_cashback_used, p_cashback_earned,
        p_notes, p_sale_type, v_sale_code, p_created_at, p_financial_account_id, p_protection_method, v_status
    ) RETURNING id INTO v_sale_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
    LOOP
        v_product_id := (v_item->>'product_id')::uuid;
        v_stock_id := (v_item->>'stock_id')::uuid;
        v_quantity := (v_item->>'quantity')::integer;
        v_numeracao := v_item->>'numeracao';
        v_unit_price := (v_item->>'unit_price')::numeric;
        v_item_discount := COALESCE((v_item->>'discount')::numeric, 0);

        INSERT INTO public.sale_items (
            sale_id, product_id, quantity, unit_price, numeracao, discount
        ) VALUES (
            v_sale_id, v_product_id, v_quantity, v_unit_price, v_numeracao, v_item_discount
        );

        UPDATE public.products
        SET current_stock = GREATEST(0, COALESCE(current_stock, 0) - v_quantity),
            updated_at = now()
        WHERE id = v_product_id;

        IF v_stock_id IS NOT NULL THEN
            UPDATE public.stock_products
            SET
                quantidade_disponivel = GREATEST(0, COALESCE(quantidade_disponivel, 0) - v_quantity),
                numeracoes = CASE
                    WHEN v_numeracao IS NOT NULL AND v_numeracao <> '' THEN
                        jsonb_set(
                            COALESCE(numeracoes, '{}'::jsonb),
                            ARRAY[v_numeracao],
                            to_jsonb(GREATEST(0, (COALESCE(numeracoes->>v_numeracao, '0'))::numeric - v_quantity)),
                            true
                        )
                    ELSE numeracoes
                END,
                updated_at = now()
            WHERE id = v_stock_id;
        END IF;
    END LOOP;

    IF p_is_debt AND p_installments IS NOT NULL THEN
        FOR v_inst IN SELECT * FROM jsonb_array_elements(p_installments)
        LOOP
            INSERT INTO public.sale_installments (
                sale_id, installment_number, amount, due_date, status
            ) VALUES (
                v_sale_id,
                (v_inst->>'number')::integer,
                (v_inst->>'amount')::numeric,
                (v_inst->>'due_date')::timestamp with time zone,
                'pendente'
            );
        END LOOP;
    END IF;

    IF NOT p_is_debt AND p_paid_amount > 0 THEN
        INSERT INTO public.transactions (
            amount, type, description, sale_id, category, account_id, status, payment_method, client_id
        ) VALUES (
            p_paid_amount, 'income', 'Venda #' || v_sale_code, v_sale_id, 'Venda', p_financial_account_id, 'pago', p_payment_method, p_client_id
        );
    END IF;

    RETURN v_sale_id;
END;
$$;