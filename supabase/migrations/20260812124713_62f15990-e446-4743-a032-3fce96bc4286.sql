-- Revogar acesso público às funções
REVOKE EXECUTE ON FUNCTION public.create_complete_sale(UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, NUMERIC, NUMERIC, TEXT, JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cancel_complete_sale(UUID) FROM PUBLIC, anon, authenticated;

-- Garantir acesso apenas a roles autorizadas
GRANT EXECUTE ON FUNCTION public.create_complete_sale(UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, NUMERIC, NUMERIC, TEXT, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancel_complete_sale(UUID) TO authenticated, service_role;

-- Ajustar search_path para segurança
ALTER FUNCTION public.create_complete_sale(UUID, TEXT, NUMERIC, NUMERIC, NUMERIC, BOOLEAN, NUMERIC, NUMERIC, TEXT, JSONB) SET search_path = public;
ALTER FUNCTION public.cancel_complete_sale(UUID) SET search_path = public;
