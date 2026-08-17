-- Criar a tabela purchase_items se não existir
CREATE TABLE IF NOT EXISTS public.purchase_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id UUID REFERENCES public.purchases(id) ON DELETE CASCADE,
    material_id UUID REFERENCES public.materials(id),
    quantity NUMERIC(15,2) NOT NULL DEFAULT 0,
    unit_cost NUMERIC(15,2) NOT NULL DEFAULT 0,
    previous_cost NUMERIC(15,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Conceder permissões
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_items TO authenticated;
GRANT ALL ON public.purchase_items TO service_role;

-- Habilitar RLS
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;

-- Criar política de acesso para usuários autenticados
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'purchase_items' AND policyname = 'Authenticated users can manage purchase items'
    ) THEN
        CREATE POLICY "Authenticated users can manage purchase items" ON public.purchase_items
            FOR ALL TO authenticated USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Função e Trigger para atualizar o custo do material se o novo preço for maior
CREATE OR REPLACE FUNCTION public.update_material_cost_on_purchase()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.materials
    SET cost_price = NEW.unit_cost
    WHERE id = NEW.material_id
      AND (cost_price < NEW.unit_cost OR cost_price IS NULL OR cost_price = 0);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_update_material_cost_on_purchase') THEN
        CREATE TRIGGER tr_update_material_cost_on_purchase
        AFTER INSERT ON public.purchase_items
        FOR EACH ROW EXECUTE FUNCTION public.update_material_cost_on_purchase();
    END IF;
END $$;

-- Atualizar o cache do schema do PostgREST
NOTIFY pgrst, 'reload schema';
