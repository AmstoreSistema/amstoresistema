ALTER FUNCTION public.release_proportional_cashback() SECURITY INVOKER;
ALTER FUNCTION public.record_sale_cashback_usage() SECURITY INVOKER;

REVOKE ALL ON FUNCTION public.release_proportional_cashback() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_sale_cashback_usage() FROM PUBLIC, anon, authenticated;