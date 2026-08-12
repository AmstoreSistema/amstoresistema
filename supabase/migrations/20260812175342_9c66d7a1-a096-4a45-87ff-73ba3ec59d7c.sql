ALTER TABLE public.qr_promo_history ADD COLUMN IF NOT EXISTS used_in_sale_id uuid REFERENCES public.sales(id);
ALTER TABLE public.qr_promo_history ADD COLUMN IF NOT EXISTS available_bonus boolean DEFAULT true;
GRANT SELECT, UPDATE ON public.qr_promo_history TO authenticated;
GRANT ALL ON public.qr_promo_history TO service_role;