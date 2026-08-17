-- Garantir que as colunas essenciais na tabela purchases tenham os tipos corretos e não nulos onde necessário
DO $$ 
BEGIN
    -- Se supplier_id existir mas for UUID e estivermos enviando nulo as vezes, garantir que possa ser nulo
    ALTER TABLE public.purchases ALTER COLUMN supplier_id DROP NOT NULL;
    
    -- Se supplier_name existir garantir que seja TEXT
    ALTER TABLE public.purchases ALTER COLUMN supplier_name TYPE TEXT;
    
    -- Garantir total_amount como numérico
    ALTER TABLE public.purchases ALTER COLUMN total_amount TYPE NUMERIC(15,2);
END $$;

-- Recarregar schema novamente para garantir que as mudanças de tipo foram propagadas
NOTIFY pgrst, 'reload schema';
