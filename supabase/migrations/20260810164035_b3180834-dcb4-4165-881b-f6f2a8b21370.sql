-- Adicionando campos faltantes à tabela de materiais para suportar a UI e o fluxo de produção
ALTER TABLE public.materials 
ADD COLUMN IF NOT EXISTS width numeric,
ADD COLUMN IF NOT EXISTS height numeric,
ADD COLUMN IF NOT EXISTS thickness numeric,
ADD COLUMN IF NOT EXISTS color text,
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS specification text;

-- Re-garantir permissões
GRANT SELECT, INSERT, UPDATE, DELETE ON public.materials TO authenticated;
GRANT ALL ON public.materials TO service_role;
