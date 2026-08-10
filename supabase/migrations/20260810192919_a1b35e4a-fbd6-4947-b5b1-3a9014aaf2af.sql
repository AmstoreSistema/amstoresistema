ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS color text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS labor_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS overhead_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retail_margin numeric NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS wholesale_margin numeric NOT NULL DEFAULT 30;

ALTER TABLE public.product_materials
  DROP CONSTRAINT IF EXISTS product_materials_product_id_material_id_key;

ALTER TABLE public.product_materials
  ADD COLUMN IF NOT EXISTS material_variation_id uuid REFERENCES public.material_variations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS material_cut_id uuid REFERENCES public.material_cuts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS material_name text,
  ADD COLUMN IF NOT EXISTS material_type text,
  ADD COLUMN IF NOT EXISTS variation_name text,
  ADD COLUMN IF NOT EXISTS unit text,
  ADD COLUMN IF NOT EXISTS unit_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stage text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS validated boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS allows_scrap boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_materials TO authenticated;
GRANT ALL ON public.product_materials TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_product_materials_updated_at ON public.product_materials;
CREATE TRIGGER update_product_materials_updated_at BEFORE UPDATE ON public.product_materials
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();