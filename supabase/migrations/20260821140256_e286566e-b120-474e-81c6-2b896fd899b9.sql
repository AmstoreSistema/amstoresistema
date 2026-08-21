CREATE OR REPLACE FUNCTION public.handle_transaction_balance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    -- INSERT case: add or subtract from balance
    IF (TG_OP = 'INSERT' AND NEW.status = 'pago') THEN
        IF (NEW.type = 'entrada' OR NEW.type = 'income') THEN
            UPDATE public.financial_accounts SET current_balance = current_balance + NEW.amount WHERE id = NEW.account_id;
        ELSIF (NEW.type = 'saida' OR NEW.type = 'expense') THEN
            UPDATE public.financial_accounts SET current_balance = current_balance - NEW.amount WHERE id = NEW.account_id;
        END IF;
        RETURN NEW;

    -- UPDATE case: handle status changes
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Handle status change to 'pago'
        IF (OLD.status != 'pago' AND NEW.status = 'pago') THEN
            IF (NEW.type = 'entrada' OR NEW.type = 'income') THEN
                UPDATE public.financial_accounts SET current_balance = current_balance + NEW.amount WHERE id = NEW.account_id;
            ELSIF (NEW.type = 'saida' OR NEW.type = 'expense') THEN
                UPDATE public.financial_accounts SET current_balance = current_balance - NEW.amount WHERE id = NEW.account_id;
            END IF;
        -- Handle status change FROM 'pago' to something else
        ELSIF (OLD.status = 'pago' AND NEW.status != 'pago') THEN
            IF (OLD.type = 'entrada' OR OLD.type = 'income') THEN
                UPDATE public.financial_accounts SET current_balance = current_balance - OLD.amount WHERE id = OLD.account_id;
            ELSIF (OLD.type = 'saida' OR OLD.type = 'expense') THEN
                UPDATE public.financial_accounts SET current_balance = current_balance + OLD.amount WHERE id = OLD.account_id;
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