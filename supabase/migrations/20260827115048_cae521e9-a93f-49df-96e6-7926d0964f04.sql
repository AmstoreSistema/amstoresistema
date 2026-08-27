-- app_settings já existe (key text PK, value text). Garante leitura pública apenas da aparência.
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON public.app_settings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT ALL ON public.app_settings TO service_role;

DROP POLICY IF EXISTS "Public can read appearance settings" ON public.app_settings;
CREATE POLICY "Public can read appearance settings"
ON public.app_settings
FOR SELECT
TO anon
USING (key = 'appearance');

INSERT INTO public.app_settings (key, value)
VALUES ('appearance', '{"site_name":"AmStore Gestão","site_tagline":"Produção, Estoque e Vendas","site_logo_url":"","favicon_url":"","app_icon_url":"","splash_logo_url":"","splash_bg":"#0A0A0B","splash_effect":"pulse","block_screenshot":false}')
ON CONFLICT (key) DO NOTHING;