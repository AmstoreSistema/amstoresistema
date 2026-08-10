
-- Create tables for configuration management
CREATE TABLE IF NOT EXISTS public.material_categories (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.suppliers (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    contact text,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.units_of_measure (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL UNIQUE,
    abbreviation text NOT NULL,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.material_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units_of_measure ENABLE ROW LEVEL SECURITY;

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.material_categories TO authenticated;
GRANT ALL ON public.material_categories TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT ALL ON public.suppliers TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.units_of_measure TO authenticated;
GRANT ALL ON public.units_of_measure TO service_role;

-- Policies
CREATE POLICY "Allow authenticated to manage categories" ON public.material_categories FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated to manage suppliers" ON public.suppliers FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated to manage units" ON public.units_of_measure FOR ALL TO authenticated USING (true);

-- Seed some initial data
INSERT INTO public.material_categories (name) VALUES 
('Couro'), ('Tecido'), ('Ferragem'), ('Forro'), ('Cola'), ('Linha'), ('Estrutura'), ('Outro')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.units_of_measure (name, abbreviation) VALUES 
('Centímetro', 'cm'),
('Metro', 'm'),
('Metro quadrado', 'm²'),
('Quilograma', 'kg'),
('Litro', 'L'),
('Unidade', 'un'),
('Par', 'par')
ON CONFLICT (name) DO NOTHING;
