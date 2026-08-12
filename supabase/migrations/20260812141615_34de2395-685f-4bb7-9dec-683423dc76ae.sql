REVOKE ALL ON FUNCTION public.cancel_complete_sale(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_complete_sale(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.cancel_complete_sale(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_complete_sale(uuid) TO service_role;