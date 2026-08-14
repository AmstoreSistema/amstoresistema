CREATE TABLE public.etiqueta_gerada (
    id              SERIAL PRIMARY KEY,
    produto_id      UUID REFERENCES public.products(id) ON DELETE SET NULL,
    produto_nome    VARCHAR(500) NOT NULL,
    codigo_barras   VARCHAR(255) NOT NULL,
    codigo_interno  VARCHAR(255),
    tipo_codigo     VARCHAR(50) NOT NULL DEFAULT 'CODE128',
    quantidade      INTEGER NOT NULL DEFAULT 1,
    linha           INTEGER NOT NULL,
    coluna          INTEGER NOT NULL,
    imagem_barcode  TEXT,
    impressa        BOOLEAN NOT NULL DEFAULT FALSE,
    data_geracao    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_date    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_date    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by_id   UUID REFERENCES auth.users(id),
    is_sample       BOOLEAN DEFAULT FALSE,
    CONSTRAINT chk_coluna CHECK (coluna >= 1 AND coluna <= 3),
    CONSTRAINT chk_linha CHECK (linha >= 1),
    CONSTRAINT chk_quantidade CHECK (quantidade >= 1)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.etiqueta_gerada TO authenticated;
GRANT ALL ON public.etiqueta_gerada TO service_role;

ALTER TABLE public.etiqueta_gerada ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own generated labels"
ON public.etiqueta_gerada
FOR ALL
TO authenticated
USING (auth.uid() = created_by_id);

CREATE POLICY "Admins can manage all generated labels"
ON public.etiqueta_gerada
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_etiqueta_gerada_produto ON public.etiqueta_gerada(produto_id);
CREATE INDEX idx_etiqueta_gerada_data ON public.etiqueta_gerada(data_geracao);