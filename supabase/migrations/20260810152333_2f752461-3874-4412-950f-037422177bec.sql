ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'Outros';
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS min_stock NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS supplier TEXT;

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'Geral';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS cost_price NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS min_stock INTEGER NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS cashback_balance NUMERIC NOT NULL DEFAULT 0;

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'dinheiro';
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS discount NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS paid_amount NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS notes TEXT;

CREATE TABLE IF NOT EXISTS public.accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  description TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'pagar',
  amount NUMERIC NOT NULL DEFAULT 0,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'pendente',
  category TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated;
GRANT ALL ON public.accounts TO service_role;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "accounts_admin_all" ON public.accounts FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier TEXT NOT NULL DEFAULT '',
  material_id UUID REFERENCES public.materials(id) ON DELETE SET NULL,
  quantity NUMERIC NOT NULL DEFAULT 0,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'solicitado',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  received_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchases_admin_all" ON public.purchases FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.promotions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  discount_percent NUMERIC NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  starts_at DATE,
  ends_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.promotions TO authenticated;
GRANT ALL ON public.promotions TO service_role;
ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "promotions_admin_all" ON public.promotions FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.debt_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.debt_payments TO authenticated;
GRANT ALL ON public.debt_payments TO service_role;
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "debt_payments_admin_all" ON public.debt_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.cashback_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  kind TEXT NOT NULL DEFAULT 'credito',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cashback_entries TO authenticated;
GRANT ALL ON public.cashback_entries TO service_role;
ALTER TABLE public.cashback_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "cashback_admin_all" ON public.cashback_entries FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  details TEXT,
  user_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_read" ON public.audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "audit_insert" ON public.audit_log FOR INSERT TO authenticated WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.app_settings (
  key TEXT NOT NULL PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "settings_admin_all" ON public.app_settings FOR ALL TO authenticated USING (true) WITH CHECK (true);

INSERT INTO public.app_settings (key, value) VALUES
  ('store_name', 'Amstore BAGSHOES'),
  ('store_phone', ''),
  ('cashback_percent', '2'),
  ('currency', 'BRL')
ON CONFLICT (key) DO NOTHING;