ALTER TABLE public.cashback_config ADD COLUMN IF NOT EXISTS category_name TEXT;
UPDATE public.cashback_config cc SET category_name = mc.name FROM public.material_categories mc WHERE cc.category_id = mc.id AND cc.category_name IS NULL;
ALTER TABLE public.cashback_config DROP CONSTRAINT IF EXISTS cashback_config_category_id_key;
ALTER TABLE public.cashback_config ADD CONSTRAINT cashback_config_category_name_key UNIQUE (category_name);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cashback_config TO authenticated;
GRANT ALL ON public.cashback_config TO service_role;