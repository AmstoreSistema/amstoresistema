
-- Promoção QR Code
CREATE TABLE public.qr_promo_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    active BOOLEAN DEFAULT false,
    name TEXT DEFAULT 'QR Code Premiado',
    sales_limit INTEGER DEFAULT 100,
    bonus_value DECIMAL(10,2) DEFAULT 50.00,
    awarded_positions TEXT DEFAULT '7, 14, 35, 80, 92',
    standard_message TEXT DEFAULT 'Que pena! Ainda não foi dessa vez. Obrigado por comprar na AmStore Bagshoes! E continue comprando para concorrer a prêmios. 🎁',
    awarded_message TEXT DEFAULT '🚀 PARABÉNS! Você foi sorteado! Seu QR Code é PREMIADO! Você ganhou um bônus especial de cashback.',
    current_counter INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.qr_promo_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    position INTEGER NOT NULL,
    is_awarded BOOLEAN DEFAULT false,
    bonus_amount DECIMAL(10,2) DEFAULT 0,
    status TEXT DEFAULT 'padrao', -- 'padrao', 'premiado', 'pendente', 'resgatado'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Permissões
GRANT SELECT, INSERT, UPDATE ON public.qr_promo_config TO authenticated;
GRANT ALL ON public.qr_promo_config TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.qr_promo_history TO authenticated;
GRANT ALL ON public.qr_promo_history TO service_role;

-- RLS
ALTER TABLE public.qr_promo_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qr_promo_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for authenticated" ON public.qr_promo_config FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow all for authenticated" ON public.qr_promo_history FOR ALL TO authenticated USING (true);

-- Inserir config inicial
INSERT INTO public.qr_promo_config (active) VALUES (false);

-- Adicionar colunas necessárias na tabela de sales se não existirem
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS is_awarded BOOLEAN DEFAULT false;
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS promo_qr TEXT;
