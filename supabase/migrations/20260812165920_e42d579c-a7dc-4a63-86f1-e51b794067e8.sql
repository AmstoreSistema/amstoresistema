
CREATE TABLE IF NOT EXISTS public.cashback_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES public.material_categories(id) ON DELETE CASCADE,
    cashback_percent NUMERIC NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(category_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cashback_config TO authenticated;
GRANT ALL ON public.cashback_config TO service_role;

ALTER TABLE public.cashback_config ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Allow all for authenticated' AND tablename = 'cashback_config'
    ) THEN
        CREATE POLICY "Allow all for authenticated" ON public.cashback_config FOR ALL TO authenticated USING (true);
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.get_cashback_percent_by_category(p_category_name TEXT)
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_percent NUMERIC;
BEGIN
    SELECT cc.cashback_percent INTO v_percent
    FROM public.cashback_config cc
    JOIN public.material_categories mc ON mc.id = cc.category_id
    WHERE mc.name = p_category_name AND cc.active = true
    LIMIT 1;
    
    RETURN COALESCE(v_percent, 0);
END;
$$;
