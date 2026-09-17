-- Migration: Create system_branding table and storage policies
CREATE TABLE IF NOT EXISTS public.system_branding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    file_path TEXT,
    file_url TEXT NOT NULL,
    mime_type VARCHAR(50),
    file_size INTEGER,
    width INTEGER,
    height INTEGER,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_system_branding_key ON public.system_branding(key);

-- Grants
GRANT SELECT ON public.system_branding TO anon, authenticated;
GRANT ALL ON public.system_branding TO authenticated;
GRANT ALL ON public.system_branding TO service_role;

-- Row Level Security
ALTER TABLE public.system_branding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read access for system_branding"
ON public.system_branding
FOR SELECT
TO public
USING (true);

CREATE POLICY "Admins can manage system_branding"
ON public.system_branding
FOR ALL
TO authenticated
USING (
    public.has_role(auth.uid(), 'admin')
    OR auth.jwt()->>'email' IN ('amstorebagshoes@gmail.com', 'matosmonica000@gmail.com')
)
WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR auth.jwt()->>'email' IN ('amstorebagshoes@gmail.com', 'matosmonica000@gmail.com')
);

-- Seed default keys if table is empty
INSERT INTO public.system_branding (key, name, description, file_url)
VALUES
    ('logo_primary', 'Logo Principal', 'Utilizada no cabeçalho/sidebar aberto do sistema e relatórios.', '/bagshoes-logo.png'),
    ('logo_compact', 'Logo Compacta', 'Utilizada quando o menu/sidebar estiver recolhido.', '/bagshoes-logo.png'),
    ('logo_login', 'Logo da Tela de Login', 'Utilizada na tela de login e recuperação de senha.', '/bagshoes-logo.png'),
    ('splash', 'Splash Screen', 'Utilizada enquanto o sistema está carregando.', '/splash-startup.png'),
    ('app_icon', 'Ícone do Sistema', 'Ícone de representação do sistema na interface.', '/app-icon-512.png'),
    ('pwa_icon', 'Ícone de Instalação PWA', 'Ícone quando o sistema for instalado no celular ou desktop.', '/app-icon-512.png'),
    ('favicon', 'Favicon', 'Ícone exibido na aba do navegador.', '/favicon.png'),
    ('loading', 'Imagem de Carregamento', 'Imagem exibida durante carregamentos importantes.', '/bagshoes-logo-white.png'),
    ('fallback', 'Imagem Padrão / Fallback', 'Imagem exibida quando alguma foto de produto ou conteúdo não estiver disponível.', '/bagshoes-logo.png')
ON CONFLICT (key) DO NOTHING;
