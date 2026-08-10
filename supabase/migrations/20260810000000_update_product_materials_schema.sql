-- Add material_variation_id and material_cut_id to product_materials
ALTER TABLE public.product_materials 
ADD COLUMN IF NOT EXISTS material_variation_id uuid REFERENCES public.material_variations(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS material_cut_id uuid REFERENCES public.material_cuts(id) ON DELETE SET NULL;

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_materials TO authenticated;
GRANT ALL ON public.product_materials TO service_role;
