
-- Módulo de Ordens de Produção - Atualização da Tabela
ALTER TABLE public.production_orders 
ADD COLUMN IF NOT EXISTS codigo_ordem TEXT,
ADD COLUMN IF NOT EXISTS produto_nome TEXT,
ADD COLUMN IF NOT EXISTS data_prevista DATE,
ADD COLUMN IF NOT EXISTS materiais_baixados BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS plano_corte_id UUID,
ADD COLUMN IF NOT EXISTS qualidade_inspecionada BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_sample BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS created_by_id UUID REFERENCES auth.users(id);

-- Criar tabela de Estoque de Produtos Acabados se não existir
CREATE TABLE IF NOT EXISTS public.stock_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    produto_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
    produto_nome TEXT NOT NULL,
    ordem_producao_id UUID REFERENCES public.production_orders(id) ON DELETE SET NULL,
    quantidade_disponivel INTEGER DEFAULT 0,
    data_entrada TIMESTAMP WITH TIME ZONE DEFAULT now(),
    categoria TEXT,
    numeracoes JSONB DEFAULT '{}'::jsonb,
    preco_custo DECIMAL(10,2) DEFAULT 0,
    preco_venda DECIMAL(10,2) DEFAULT 0,
    localizacao TEXT,
    lote TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Grants para stock_products
GRANT SELECT, INSERT, UPDATE, DELETE ON public.stock_products TO authenticated;
GRANT ALL ON public.stock_products TO service_role;

-- Habilitar RLS
ALTER TABLE public.stock_products ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para stock_products
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir leitura para usuários autenticados' AND tablename = 'stock_products') THEN
        CREATE POLICY "Permitir leitura para usuários autenticados" ON public.stock_products FOR SELECT TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir inserção para usuários autenticados' AND tablename = 'stock_products') THEN
        CREATE POLICY "Permitir inserção para usuários autenticados" ON public.stock_products FOR INSERT TO authenticated WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir atualização para usuários autenticados' AND tablename = 'stock_products') THEN
        CREATE POLICY "Permitir atualização para usuários autenticados" ON public.stock_products FOR UPDATE TO authenticated USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Permitir exclusão para usuários autenticados' AND tablename = 'stock_products') THEN
        CREATE POLICY "Permitir exclusão para usuários autenticados" ON public.stock_products FOR DELETE TO authenticated USING (true);
    END IF;
END
$$;
