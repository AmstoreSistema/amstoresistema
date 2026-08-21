CREATE OR REPLACE FUNCTION public.handle_transaction_balance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    v_account_active BOOLEAN;
BEGIN
    -- Obter o status ativo da conta
    IF TG_OP = 'DELETE' THEN
        SELECT active INTO v_account_active FROM public.financial_accounts WHERE id = OLD.account_id;
    ELSE
        SELECT active INTO v_account_active FROM public.financial_accounts WHERE id = NEW.account_id;
    END IF;

    -- Se a conta não existir ou não estiver ativa, não processa o saldo
    -- (Opcional: você pode querer processar mesmo em inativas, mas o pedido foca no fluxo da conta ativa)
    IF v_account_active IS DISTINCT FROM true THEN
        IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
    END IF;

    -- INSERT case: add or subtract from balance
    IF (TG_OP = 'INSERT' AND NEW.status = 'pago') THEN
        IF (NEW.type = 'entrada' OR NEW.type = 'income') THEN
            UPDATE public.financial_accounts SET current_balance = current_balance + NEW.amount WHERE id = NEW.account_id;
        ELSIF (NEW.type = 'saida' OR NEW.type = 'expense') THEN
            UPDATE public.financial_accounts SET current_balance = current_balance - NEW.amount WHERE id = NEW.account_id;
        END IF;
        RETURN NEW;

    -- UPDATE case: handle status changes, amount changes, or account changes
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Se a conta mudou, estorna da antiga e lança na nova
        IF OLD.account_id <> NEW.account_id THEN
            -- Estorna da antiga se estava paga
            IF OLD.status = 'pago' THEN
                IF (OLD.type = 'entrada' OR OLD.type = 'income') THEN
                    UPDATE public.financial_accounts SET current_balance = current_balance - OLD.amount WHERE id = OLD.account_id;
                ELSIF (OLD.type = 'saida' OR OLD.type = 'expense') THEN
                    UPDATE public.financial_accounts SET current_balance = current_balance + OLD.amount WHERE id = OLD.account_id;
                END IF;
            END IF;
            -- Lança na nova se está paga
            IF NEW.status = 'pago' THEN
                IF (NEW.type = 'entrada' OR NEW.type = 'income') THEN
                    UPDATE public.financial_accounts SET current_balance = current_balance + NEW.amount WHERE id = NEW.account_id;
                ELSIF (NEW.type = 'saida' OR NEW.type = 'expense') THEN
                    UPDATE public.financial_accounts SET current_balance = current_balance - NEW.amount WHERE id = NEW.account_id;
                END IF;
            END IF;
        
        -- Se a conta é a mesma, mas mudou status ou valor
        ELSE
            -- Mudança de status para pago
            IF (OLD.status <> 'pago' AND NEW.status = 'pago') THEN
                IF (NEW.type = 'entrada' OR NEW.type = 'income') THEN
                    UPDATE public.financial_accounts SET current_balance = current_balance + NEW.amount WHERE id = NEW.account_id;
                ELSIF (NEW.type = 'saida' OR NEW.type = 'expense') THEN
                    UPDATE public.financial_accounts SET current_balance = current_balance - NEW.amount WHERE id = NEW.account_id;
                END IF;
            -- Mudança de status de pago para outro
            ELSIF (OLD.status = 'pago' AND NEW.status <> 'pago') THEN
                IF (OLD.type = 'entrada' OR OLD.type = 'income') THEN
                    UPDATE public.financial_accounts SET current_balance = current_balance - OLD.amount WHERE id = OLD.account_id;
                ELSIF (OLD.type = 'saida' OR OLD.type = 'expense') THEN
                    UPDATE public.financial_accounts SET current_balance = current_balance + OLD.amount WHERE id = OLD.account_id;
                END IF;
            -- Se continua pago, mas o valor mudou
            ELSIF (OLD.status = 'pago' AND NEW.status = 'pago' AND OLD.amount <> NEW.amount) THEN
                IF (NEW.type = 'entrada' OR NEW.type = 'income') THEN
                    UPDATE public.financial_accounts SET current_balance = current_balance - OLD.amount + NEW.amount WHERE id = NEW.account_id;
                ELSIF (NEW.type = 'saida' OR NEW.type = 'expense') THEN
                    UPDATE public.financial_accounts SET current_balance = current_balance + OLD.amount - NEW.amount WHERE id = NEW.account_id;
                END IF;
            END IF;
        END IF;
        RETURN NEW;

    -- DELETE case: reverse the balance impact
    ELSIF (TG_OP = 'DELETE') THEN
        IF (OLD.status = 'pago') THEN
            IF (OLD.type = 'entrada' OR OLD.type = 'income') THEN
                UPDATE public.financial_accounts SET current_balance = current_balance - OLD.amount WHERE id = OLD.account_id;
            ELSIF (OLD.type = 'saida' OR OLD.type = 'expense') THEN
                UPDATE public.financial_accounts SET current_balance = current_balance + OLD.amount WHERE id = OLD.account_id;
            END IF;
        END IF;
        RETURN OLD;
    END IF;
    
    RETURN NULL;
END;
$function$;