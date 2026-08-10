-- Add dimension and color fields to materials table
ALTER TABLE public.materials 
ADD COLUMN IF NOT EXISTS width numeric,
ADD COLUMN IF NOT EXISTS height numeric,
ADD COLUMN IF NOT EXISTS thickness numeric,
ADD COLUMN IF NOT EXISTS color text,
ADD COLUMN IF NOT EXISTS description text;

-- Re-grant access (good practice after schema changes in public)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.materials TO authenticated;
GRANT ALL ON public.materials TO service_role;
