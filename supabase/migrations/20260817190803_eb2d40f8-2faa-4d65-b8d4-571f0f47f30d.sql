ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id);
NOTIFY pgrst, 'reload schema';