-- No schema changes needed for UI buttons, but ensuring the RPC is granted
GRANT EXECUTE ON FUNCTION public.create_complete_sale TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_complete_sale TO anon;
GRANT EXECUTE ON FUNCTION public.create_complete_sale TO service_role;
