ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transactions TO authenticated;
GRANT ALL ON public.transactions TO service_role;
