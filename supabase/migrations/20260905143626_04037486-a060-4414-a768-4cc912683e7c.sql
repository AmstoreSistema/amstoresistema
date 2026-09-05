CREATE TABLE public."CashbackCategoria" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  categoria_id TEXT,
  categoria_nome TEXT NOT NULL,
  percentual_cashback NUMERIC NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public."CashbackCategoria" TO authenticated;
GRANT ALL ON public."CashbackCategoria" TO service_role;
ALTER TABLE public."CashbackCategoria" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage CashbackCategoria" ON public."CashbackCategoria" FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TABLE public."CashbackCliente" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  cliente_id TEXT NOT NULL,
  cliente_nome TEXT NOT NULL,
  saldo NUMERIC NOT NULL DEFAULT 0,
  ultima_atualizacao TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public."CashbackCliente" TO authenticated;
GRANT ALL ON public."CashbackCliente" TO service_role;
ALTER TABLE public."CashbackCliente" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage CashbackCliente" ON public."CashbackCliente" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_cashback_cliente_cliente ON public."CashbackCliente"(cliente_id);

CREATE TABLE public."CashbackMovimentacao" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  cliente_id TEXT NOT NULL,
  cliente_nome TEXT,
  venda_id TEXT NOT NULL,
  codigo_venda TEXT,
  valor_pago_base NUMERIC,
  percentual_total NUMERIC,
  valor_cashback NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente',
  data TIMESTAMPTZ NOT NULL DEFAULT now(),
  categorias TEXT[],
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public."CashbackMovimentacao" TO authenticated;
GRANT ALL ON public."CashbackMovimentacao" TO service_role;
ALTER TABLE public."CashbackMovimentacao" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage CashbackMovimentacao" ON public."CashbackMovimentacao" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_cashback_mov_cliente ON public."CashbackMovimentacao"(cliente_id);
CREATE INDEX idx_cashback_mov_venda ON public."CashbackMovimentacao"(venda_id);

CREATE TABLE public."CashbackHistorico" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  cliente_id TEXT NOT NULL,
  cliente_nome TEXT,
  venda_id TEXT,
  codigo_venda TEXT,
  pagamento_id TEXT,
  tipo TEXT NOT NULL,
  valor NUMERIC NOT NULL DEFAULT 0,
  valor_pago_referencia NUMERIC,
  percentual_aplicado NUMERIC,
  data TIMESTAMPTZ NOT NULL DEFAULT now(),
  observacao TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public."CashbackHistorico" TO authenticated;
GRANT ALL ON public."CashbackHistorico" TO service_role;
ALTER TABLE public."CashbackHistorico" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage CashbackHistorico" ON public."CashbackHistorico" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_cashback_hist_cliente ON public."CashbackHistorico"(cliente_id);
CREATE INDEX idx_cashback_hist_venda ON public."CashbackHistorico"(venda_id);

CREATE TABLE public."CompraMaterial" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  numero_compra TEXT NOT NULL,
  fornecedor_id TEXT NOT NULL,
  fornecedor_nome TEXT,
  data_compra TIMESTAMPTZ NOT NULL DEFAULT now(),
  data_entrega_prevista DATE,
  data_entrega_real DATE,
  status TEXT NOT NULL DEFAULT 'pendente',
  forma_pagamento TEXT,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  valor_pago NUMERIC,
  valor_restante NUMERIC,
  conta_id TEXT,
  conta_nome TEXT,
  transacao_id TEXT,
  numero_nota_fiscal TEXT,
  observacoes TEXT,
  materiais_entrada_dada BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public."CompraMaterial" TO authenticated;
GRANT ALL ON public."CompraMaterial" TO service_role;
ALTER TABLE public."CompraMaterial" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage CompraMaterial" ON public."CompraMaterial" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_compra_material_fornecedor ON public."CompraMaterial"(fornecedor_id);

CREATE TABLE public."ItemCompraMaterial" (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  compra_id TEXT NOT NULL REFERENCES public."CompraMaterial"(id) ON DELETE CASCADE,
  material_id TEXT,
  material_nome TEXT NOT NULL,
  material_tipo TEXT,
  quantidade NUMERIC NOT NULL DEFAULT 0,
  unidade_medida TEXT,
  preco_unitario NUMERIC NOT NULL DEFAULT 0,
  subtotal NUMERIC,
  largura NUMERIC,
  altura NUMERIC,
  cor TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public."ItemCompraMaterial" TO authenticated;
GRANT ALL ON public."ItemCompraMaterial" TO service_role;
ALTER TABLE public."ItemCompraMaterial" ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage ItemCompraMaterial" ON public."ItemCompraMaterial" FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE INDEX idx_item_compra_material_compra ON public."ItemCompraMaterial"(compra_id);

CREATE TRIGGER trg_cashback_categoria_updated BEFORE UPDATE ON public."CashbackCategoria" FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cashback_cliente_updated BEFORE UPDATE ON public."CashbackCliente" FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cashback_mov_updated BEFORE UPDATE ON public."CashbackMovimentacao" FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_cashback_hist_updated BEFORE UPDATE ON public."CashbackHistorico" FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_compra_material_updated BEFORE UPDATE ON public."CompraMaterial" FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_item_compra_material_updated BEFORE UPDATE ON public."ItemCompraMaterial" FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();