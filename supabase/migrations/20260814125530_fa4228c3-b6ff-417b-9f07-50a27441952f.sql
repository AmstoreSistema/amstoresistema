-- Adiciona as colunas necessárias para rastreamento de etiquetas e ordens de produção
ALTER TABLE public.etiqueta_gerada ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.production_orders(id) ON DELETE SET NULL;
ALTER TABLE public.etiqueta_gerada ADD COLUMN IF NOT EXISTS impressa BOOLEAN DEFAULT FALSE;

-- Tabela para armazenar as configurações de impressão do usuário
CREATE TABLE IF NOT EXISTS public.print_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    page_size VARCHAR(50) DEFAULT 'A4',
    margin_top NUMERIC DEFAULT 0,
    margin_left NUMERIC DEFAULT 0,
    column_spacing NUMERIC DEFAULT 0,
    row_spacing NUMERIC DEFAULT 0,
    label_width NUMERIC DEFAULT 63.5, -- mm (Padrão 3 colunas A4)
    label_height NUMERIC DEFAULT 38.1, -- mm (Padrão 3 colunas A4)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

GRANT SELECT, INSERT, UPDATE ON public.print_settings TO authenticated;
GRANT ALL ON public.print_settings TO service_role;

ALTER TABLE public.print_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own print settings"
ON public.print_settings
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
