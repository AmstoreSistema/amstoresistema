-- Adiciona campos necessários para rastrear fornecedor e itens nas compras
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id);

-- Cria tabela de itens de compra para histórico detalhado
CREATE TABLE IF NOT EXISTS public.purchase_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_id UUID REFERENCES public.purchases(id) ON DELETE CASCADE,
    material_id UUID REFERENCES public.materials(id),
    quantity NUMERIC NOT NULL,
    unit_cost NUMERIC NOT NULL,
    previous_cost NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_items TO authenticated;
GRANT ALL ON public.purchase_items TO service_role;

ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Permitir tudo para usuários autenticados em purchase_items"
ON public.purchase_items FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Trigger para atualizar o custo do material se o novo preço for maior
CREATE OR REPLACE FUNCTION public.tr_update_material_cost_on_purchase()
RETURNS TRIGGER AS $$
BEGIN
    -- Se o novo custo for maior que o custo atual, atualiza o material
    UPDATE public.materials
    SET cost_price = NEW.unit_cost,
        updated_at = now()
    WHERE id = NEW.material_id
      AND (cost_price IS NULL OR NEW.unit_cost > cost_price);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_purchase_item_update_cost ON public.purchase_items;
CREATE TRIGGER tr_purchase_item_update_cost
AFTER INSERT ON public.purchase_items
FOR EACH ROW EXECUTE FUNCTION public.tr_update_material_cost_on_purchase();
