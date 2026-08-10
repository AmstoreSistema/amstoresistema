-- Add missing columns to support the detailed UI from screenshots
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS sku text;

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS wholesale_price numeric DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS production_time_hours numeric DEFAULT 0;

ALTER TABLE public.production_orders ADD COLUMN IF NOT EXISTS priority text DEFAULT 'media'; -- alta, media, baixa
ALTER TABLE public.production_orders ADD COLUMN IF NOT EXISTS notes text;

-- Ensure RLS is enabled and grants are correct (though they should be from previous steps)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.materials TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_orders TO authenticated;
