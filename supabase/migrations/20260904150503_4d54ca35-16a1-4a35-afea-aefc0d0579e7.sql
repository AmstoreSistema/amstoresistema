CREATE OR REPLACE FUNCTION public.ensure_single_active_account()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.active = true THEN
        UPDATE public.financial_accounts
        SET active = false
        WHERE id <> NEW.id AND active = true;
    END IF;

    -- Só bloqueia quando a desativação foi feita diretamente pelo usuário
    -- (pg_trigger_depth() > 1 significa desativação em cascata deste próprio trigger)
    IF TG_OP = 'UPDATE' AND pg_trigger_depth() = 1 THEN
        IF OLD.active = true AND NEW.active = false THEN
            IF NOT EXISTS (SELECT 1 FROM public.financial_accounts WHERE active = true AND id <> NEW.id) THEN
                RAISE EXCEPTION 'O sistema deve possuir ao menos uma conta financeira ativa.';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;