
CREATE TABLE IF NOT EXISTS public.material_variations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id uuid REFERENCES public.materials(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL, -- Cor/Nome da Variação
    specification text, -- Especificação
    current_stock numeric DEFAULT 0,
    cost_price numeric DEFAULT 0,
    notes text,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.material_variations ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_variations TO authenticated;
GRANT ALL ON public.material_variations TO service_role;

-- Policies
CREATE POLICY "Allow authenticated to manage variations" ON public.material_variations FOR ALL TO authenticated USING (true);
