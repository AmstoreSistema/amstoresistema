-- Fix search_path and execution permissions for handle_transaction_balance
ALTER FUNCTION public.handle_transaction_balance() SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.handle_transaction_balance() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.handle_transaction_balance() TO service_role;

-- Fix search_path and execution permissions for transfer_between_accounts
ALTER FUNCTION public.transfer_between_accounts(uuid, uuid, decimal, text, timestamptz) SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.transfer_between_accounts(uuid, uuid, decimal, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_between_accounts(uuid, uuid, decimal, text, timestamptz) TO authenticated, service_role;
