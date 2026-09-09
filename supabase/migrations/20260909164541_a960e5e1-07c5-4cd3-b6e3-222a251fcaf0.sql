CREATE TABLE IF NOT EXISTS public.condicionais (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  codigo TEXT NOT NULL,
  client_id TEXT,
  client_name TEXT,
  status TEXT NOT NULL DEFAULT 'aberto',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  user_id TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS condicionais_codigo_key ON public.condicionais (codigo);

GRANT ALL ON public.condicionais TO anon, authenticated, service_role;

ALTER TABLE public.condicionais ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'condicionais' AND policyname = 'Public access condicionais'
  ) THEN
    CREATE POLICY "Public access condicionais" ON public.condicionais FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.condicional_items (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  condicional_id TEXT NOT NULL REFERENCES public.condicionais(id) ON DELETE CASCADE,
  stock_id TEXT,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  numeracao TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  quantity INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pendente',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_condicional_items_condicional ON public.condicional_items (condicional_id);

GRANT ALL ON public.condicional_items TO anon, authenticated, service_role;

ALTER TABLE public.condicional_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'condicional_items' AND policyname = 'Public access condicional_items'
  ) THEN
    CREATE POLICY "Public access condicional_items" ON public.condicional_items FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;