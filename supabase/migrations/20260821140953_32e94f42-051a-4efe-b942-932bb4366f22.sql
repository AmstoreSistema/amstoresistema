CREATE OR REPLACE FUNCTION public.ensure_single_active_account()
RETURNS TRIGGER AS $$
BEGIN
    -- Se a conta está sendo marcada como ativa
    IF NEW.active = true THEN
        -- Desativa todas as outras contas
        UPDATE public.financial_accounts
        SET active = false
        WHERE id <> NEW.id AND active = true;
    END IF;

    -- Garantia de que sempre haverá ao menos uma conta ativa se existirem contas
    -- Se a conta que está sendo desativada (UPDATE) era a única ativa, impedimos
    IF TG_OP = 'UPDATE' THEN
        IF OLD.active = true AND NEW.active = false THEN
            IF NOT EXISTS (SELECT 1 FROM public.financial_accounts WHERE active = true AND id <> NEW.id) THEN
                RAISE EXCEPTION 'O sistema deve possuir ao menos uma conta financeira ativa.';
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_ensure_single_active_account ON public.financial_accounts;

CREATE TRIGGER tr_ensure_single_active_account
BEFORE INSERT OR UPDATE OF active ON public.financial_accounts
FOR EACH ROW
EXECUTE FUNCTION public.ensure_single_active_account();

-- Garantir que pelo menos uma conta esteja ativa agora se houver alguma
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.financial_accounts) AND NOT EXISTS (SELECT 1 FROM public.financial_accounts WHERE active = true) THEN
        UPDATE public.financial_accounts 
        SET active = true 
        WHERE id = (SELECT id FROM public.financial_accounts ORDER BY created_at ASC LIMIT 1);
    END IF;
END $$;
