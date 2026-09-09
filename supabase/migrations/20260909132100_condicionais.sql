-- ============================================================
-- Tabela: condicionais (cabeçalho da saída condicional)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.condicionais (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  codigo      TEXT NOT NULL,
  client_id   TEXT,
  client_name TEXT,
  status      TEXT NOT NULL DEFAULT 'aberto',  -- aberto | fechado | cancelado
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at   TIMESTAMPTZ,
  user_id     TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS condicionais_codigo_key ON public.condicionais (codigo);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.condicionais TO authenticated;
GRANT ALL ON public.condicionais TO service_role;
ALTER TABLE public.condicionais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage condicionais"
  ON public.condicionais FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ============================================================
-- Tabela: condicional_items (itens de cada saída condicional)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.condicional_items (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  condicional_id   TEXT NOT NULL REFERENCES public.condicionais(id) ON DELETE CASCADE,
  stock_id         TEXT,           -- id em stock_products (null para virtuais)
  product_id       TEXT NOT NULL,  -- id em products
  product_name     TEXT NOT NULL,
  numeracao        TEXT,           -- tamanho/numeração
  price            NUMERIC NOT NULL DEFAULT 0,
  quantity         INTEGER NOT NULL DEFAULT 1,
  status           TEXT NOT NULL DEFAULT 'pendente',  -- pendente | confirmado | devolvido
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_condicional_items_condicional
  ON public.condicional_items (condicional_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.condicional_items TO authenticated;
GRANT ALL ON public.condicional_items TO service_role;
ALTER TABLE public.condicional_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage condicional_items"
  ON public.condicional_items FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
