-- Add specification field to materials table
ALTER TABLE public.materials 
ADD COLUMN IF NOT EXISTS specification text;

-- Re-grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.materials TO authenticated;
GRANT ALL ON public.materials TO service_role;
