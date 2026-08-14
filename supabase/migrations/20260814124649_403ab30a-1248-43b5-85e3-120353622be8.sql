ALTER TABLE public.etiqueta_gerada 
ADD COLUMN IF NOT EXISTS variacao_nome VARCHAR(255),
ADD COLUMN IF NOT EXISTS numeracao VARCHAR(10),
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pendente';

GRANT ALL ON public.etiqueta_gerada TO authenticated;
GRANT ALL ON public.etiqueta_gerada TO service_role;