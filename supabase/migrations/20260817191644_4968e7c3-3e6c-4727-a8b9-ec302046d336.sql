-- Garantir que a tabela purchases possua as colunas necessárias
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'supplier_id') THEN
        ALTER TABLE public.purchases ADD COLUMN supplier_id UUID;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'supplier_name') THEN
        ALTER TABLE public.purchases ADD COLUMN supplier_name TEXT;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'purchases' AND column_name = 'total_amount') THEN
        ALTER TABLE public.purchases ADD COLUMN total_amount NUMERIC(15,2) DEFAULT 0;
    END IF;
END $$;

-- Conceder permissões
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchases TO authenticated;
GRANT ALL ON public.purchases TO service_role;

-- Atualizar o cache do schema do PostgREST
NOTIFY pgrst, 'reload schema';
