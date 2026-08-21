CREATE OR REPLACE FUNCTION public.handle_account_deletion()
RETURNS TRIGGER AS $$
BEGIN
    -- Se a conta deletada era a ativa, tenta ativar outra
    IF OLD.active = true THEN
        UPDATE public.financial_accounts
        SET active = true
        WHERE id = (SELECT id FROM public.financial_accounts ORDER BY created_at ASC LIMIT 1);
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS tr_handle_account_deletion ON public.financial_accounts;

CREATE TRIGGER tr_handle_account_deletion
AFTER DELETE ON public.financial_accounts
FOR EACH ROW
EXECUTE FUNCTION public.handle_account_deletion();
