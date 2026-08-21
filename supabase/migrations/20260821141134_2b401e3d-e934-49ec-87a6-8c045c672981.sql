CREATE OR REPLACE FUNCTION public.handle_transaction_balance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
    v_account_active BOOLEAN;
    v_old_signed_amount NUMERIC;
    v_new_signed_amount NUMERIC;
BEGIN
    -- Calcula o valor com sinal baseado no tipo
    -- Entrada/Income: Positivo | Saída/Expense: Negativo
    IF (TG_OP <> 'INSERT') THEN
        v_old_signed_amount := CASE 
            WHEN OLD.type IN ('entrada', 'income') THEN ABS(OLD.amount)
            WHEN OLD.type IN ('saida', 'expense') THEN -ABS(OLD.amount)
            ELSE 0 
        END;
    END IF;
    
    IF (TG_OP <> 'DELETE') THEN
        v_new_signed_amount := CASE 
            WHEN NEW.type IN ('entrada', 'income') THEN ABS(NEW.amount)
            WHEN NEW.type IN ('saida', 'expense') THEN -ABS(NEW.amount)
            ELSE 0 
        END;
    END IF;

    -- Obter o status ativo da conta
    IF TG_OP = 'DELETE' THEN
        SELECT active INTO v_account_active FROM public.financial_accounts WHERE id = OLD.account_id;
    ELSE
        SELECT active INTO v_account_active FROM public.financial_accounts WHERE id = NEW.account_id;
    END IF;

    -- Se a conta não existir ou não estiver ativa, não processa o saldo automático
    -- (Opcional: você pode querer processar mesmo em inativas, mas o pedido foca no fluxo da conta ativa)
    IF v_account_active IS DISTINCT FROM true THEN
        IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
    END IF;

    -- INSERT case
    IF (TG_OP = 'INSERT' AND NEW.status = 'pago') THEN
        UPDATE public.financial_accounts 
        SET current_balance = current_balance + v_new_signed_amount 
        WHERE id = NEW.account_id;
        RETURN NEW;

    -- UPDATE case
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Se a conta mudou
        IF OLD.account_id <> NEW.account_id THEN
            -- Estorna da antiga se estava paga
            IF OLD.status = 'pago' THEN
                UPDATE public.financial_accounts 
                SET current_balance = current_balance - v_old_signed_amount 
                WHERE id = OLD.account_id;
            END IF;
            -- Lança na nova se está paga
            IF NEW.status = 'pago' THEN
                UPDATE public.financial_accounts 
                SET current_balance = current_balance + v_new_signed_amount 
                WHERE id = NEW.account_id;
            END IF;
        
        -- Se a conta é a mesma
        ELSE
            -- Mudança de status para pago
            IF (OLD.status <> 'pago' AND NEW.status = 'pago') THEN
                UPDATE public.financial_accounts 
                SET current_balance = current_balance + v_new_signed_amount 
                WHERE id = NEW.account_id;
            -- Mudança de status de pago para outro
            ELSIF (OLD.status = 'pago' AND NEW.status <> 'pago') THEN
                UPDATE public.financial_accounts 
                SET current_balance = current_balance - v_old_signed_amount 
                WHERE id = NEW.account_id;
            -- Se continua pago, mas o valor ou tipo mudou
            ELSIF (OLD.status = 'pago' AND NEW.status = 'pago' AND (OLD.amount <> NEW.amount OR OLD.type <> NEW.type)) THEN
                UPDATE public.financial_accounts 
                SET current_balance = current_balance - v_old_signed_amount + v_new_signed_amount 
                WHERE id = NEW.account_id;
            END IF;
        END IF;
        RETURN NEW;

    -- DELETE case
    ELSIF (TG_OP = 'DELETE') THEN
        IF (OLD.status = 'pago') THEN
            UPDATE public.financial_accounts 
            SET current_balance = current_balance - v_old_signed_amount 
            WHERE id = OLD.account_id;
        END IF;
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$function$;