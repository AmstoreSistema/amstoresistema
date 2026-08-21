CREATE OR REPLACE FUNCTION public.transfer_between_accounts(p_origin_id uuid, p_dest_id uuid, p_amount numeric, p_description text, p_date timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
BEGIN
    -- Validação de saldo
    IF NOT EXISTS (SELECT 1 FROM public.financial_accounts WHERE id = p_origin_id AND current_balance >= p_amount) THEN
        RAISE EXCEPTION 'Saldo insuficiente na conta de origem.';
    END IF;

    -- O gatilho transaction_balance_trigger cuidará dos saldos ao inserir nas transações
    
    -- Saída da origem
    INSERT INTO public.transactions (account_id, amount, type, description, status, created_at, category)
    VALUES (p_origin_id, p_amount, 'saida', 'Transferência (Saída): ' || p_description, 'pago', p_date, 'Transferência');
    
    -- Entrada no destino
    INSERT INTO public.transactions (account_id, amount, type, description, status, created_at, category)
    VALUES (p_dest_id, p_amount, 'entrada', 'Transferência (Entrada): ' || p_description, 'pago', p_date, 'Transferência');
END;
$function$;