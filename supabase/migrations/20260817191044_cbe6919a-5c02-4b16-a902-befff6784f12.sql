ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS supplier_name TEXT;
NOTIFY pgrst, 'reload schema';