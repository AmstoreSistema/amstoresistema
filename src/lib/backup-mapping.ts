/**
 * Mapeamento genérico de backups externos (Base44 e similares) para o schema Amstore.
 * Aceita praticamente qualquer JSON que contenha coleções de registros.
 */

export type Collections = Record<string, any[]>;

/** Marcador para coleções conhecidas que o sistema não importa (não geram alerta). */
export const IGNORED_TABLE = "__ignorado";

export const TABLE_ALIASES: Record<string, string> = {

  // Clientes
  clients: "clients",
  client: "clients",
  clientes: "clients",
  cliente: "clients",
  customers: "clients",
  customer: "clients",
  contatos: "clients",
  contato: "clients",
  users: "clients",
  user: "clients",

  // Produtos
  products: "products",
  product: "products",
  produtos: "products",
  produto: "products",
  items: "products",
  item: "products",
  produtoacabado: "products",
  produtosacabados: "products",
  modelos: "products",
  modelo: "products",
  variacoes: "products",
  variacao: "products",
  mercadorias: "products",
  mercadoria: "products",

  // Fornecedores
  suppliers: "suppliers",
  supplier: "suppliers",
  fornecedores: "suppliers",
  fornecedor: "suppliers",
  empresas: "suppliers",
  empresa: "suppliers",
  partners: "suppliers",
  partner: "suppliers",

  // Materiais
  materials: "materials",
  material: "materials",
  materiais: "materials",
  materiaprima: "materials",
  materiasprimas: "materials",
  rawmaterial: "materials",
  rawmaterials: "materials",
  insumos: "materials",
  insumo: "materials",
  componentes: "materials",
  componente: "materials",

  // Categorias
  material_categories: "material_categories",
  materialcategory: "material_categories",
  materialcategories: "material_categories",
  categorias: "material_categories",
  categoria: "material_categories",
  categories: "material_categories",
  category: "material_categories",
  categoriamaterial: "material_categories",
  categoriasmateriais: "material_categories",
  grupos: "material_categories",
  grupo: "material_categories",

  // Composições / Ficha Técnica
  product_materials: "product_materials",
  productmaterial: "product_materials",
  productmaterials: "product_materials",
  composicoes: "product_materials",
  composicao: "product_materials",
  fichatecnica: "product_materials",
  fichastecnicas: "product_materials",
  receita: "product_materials",
  bom: "product_materials",

  // Ordens de Produção
  production_orders: "production_orders",
  productionorder: "production_orders",
  productionorders: "production_orders",
  ordens: "production_orders",
  ordem: "production_orders",
  ordensproducao: "production_orders",
  ordemproducao: "production_orders",
  producao: "production_orders",

  // Estoque
  stock_products: "stock_products",
  stockproduct: "stock_products",
  stockproducts: "stock_products",
  estoque: "stock_products",
  estoques: "stock_products",
  stock: "stock_products",
  estoqueproduto: "stock_products",
  estoqueprodutos: "stock_products",
  inventory: "stock_products",
  armazem: "stock_products",

  // Vendas e Transações
  transactions: "transactions",
  transaction: "transactions",
  transacoes: "transactions",
  transacao: "transactions",
  transacaofinanceira: "transactions",
  transacoesfinanceiras: "transactions",
  financeiro: "transactions",
  lancamentos: "transactions",
  lancamento: "transactions",
  movimentacoes: "transactions",
  movimentacaofinanceira: "transactions",
  financialtransaction: "transactions",
  financialtransactions: "transactions",
  fluxodecaixa: "transactions",
  contasapagar: "transactions",
  contasareceber: "transactions",
  payments: "transactions",
  payment: "transactions",
  faturamento: "transactions",

  // Vendas Específicas
  sales: "sales",
  sale: "sales",
  vendas: "sales",
  venda: "sales",
  vendafiado: "sales",
  vendasfiado: "sales",
  vendafiada: "sales",
  vendasfiadas: "sales",
  sale_items: "sale_items",
  itensvenda: "sale_items",
  itens_venda: "sale_items",
  itensvendas: "sale_items",
  itemvenda: "sale_items",
  sale_payments: "sale_payments",
  pagamentos: "sale_payments",
  pagamentos_vendas: "sale_payments",
  pagamentovenda: "sale_payments",
  pagamentosvenda: "sale_payments",
  sale_installments: "sale_installments",
  parcelas: "sale_installments",
  parcelas_vendas: "sale_installments",
  parcelavenda: "sale_installments",
  parcelasvenda: "sale_installments",


  // Compras Específicas
  purchases: "purchases",
  compras: "purchases",
  compras_materiais: "purchases",
  purchase_items: "purchase_items",
  itenscompra: "purchase_items",
  itens_compra: "purchase_items",
  itenscompras: "purchase_items",

  // Sistema e Alertas
  notifications: "notifications",
  alertas: "notifications",
  configuracoes_materiais: "material_categories",
  configuracoesmateriais: "material_categories",
  configuracoes_globais: "app_settings",
  configuracoesglobais: "app_settings",
  app_settings: "app_settings",
  configuracoes: "app_settings",
  setting: "app_settings",
  settings: "app_settings",

  // Contas Financeiras
  financial_accounts: "financial_accounts",
  financialaccount: "financial_accounts",
  financialaccounts: "financial_accounts",
  contas: "financial_accounts",
  conta: "financial_accounts",
  contasfinanceiras: "financial_accounts",
  contafinanceira: "financial_accounts",
  caixas: "financial_accounts",
  caixa: "financial_accounts",
  bancos: "financial_accounts",
  banco: "financial_accounts",
  banks: "financial_accounts",

  // Promoções e Cupons
  promotions: "promotions",
  promotion: "promotions",
  promocoes: "promotions",
  promocao: "promotions",
  descontos: "promotions",

  // Unidades de Medida
  units_of_measure: "units_of_measure",
  unitofmeasure: "units_of_measure",
  unitsofmeasure: "units_of_measure",
  unidades: "units_of_measure",
  unidademedida: "units_of_measure",
  unidadesdemedida: "units_of_measure",
  medidas: "units_of_measure",

  // Cortes de Material
  material_cuts: "material_cuts",
  materialcut: "material_cuts",
  materialcuts: "material_cuts",
  cortes: "material_cuts",
  corte: "material_cuts",
  cortecouro: "material_cuts",
  cortescouro: "material_cuts",
  pecacouro: "material_cuts",
  pecascouro: "material_cuts",
  moldecorte: "material_cuts",
  moldescorte: "material_cuts",
  moldes: "material_cuts",

  // Variações de Material
  material_variations: "material_variations",
  materialvariation: "material_variations",
  materialvariations: "material_variations",
  cupon: "material_variations",
  cupons: "material_variations",
  cuponproducao: "material_variations",
  cuponsproducao: "material_variations",
  cupomproducao: "material_variations",
  cupomsproducao: "material_variations",
  variacaomaterial: "material_variations",
  variacoesmateriais: "material_variations",

  // Composições de Material
  composicaomaterial: "product_materials",
  composicoesmateriais: "product_materials",
  composicaomateriais: "product_materials",

  // Coleções conhecidas que o Amstore não utiliza (ignoradas sem alerta)
  configuracaomaterial: IGNORED_TABLE,
  configuracoesmaterial: IGNORED_TABLE,
  configuracaomateriais: IGNORED_TABLE,
  categoriatransacao: IGNORED_TABLE,
  categoriastransacao: IGNORED_TABLE,
  categoriatransacoes: IGNORED_TABLE,
  categoriastransacoes: IGNORED_TABLE,
};


const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const pick = (row: any, keys: string[]) => {
  const map: Record<string, any> = {};
  for (const k of Object.keys(row ?? {})) map[slug(k)] = row[k];
  for (const k of keys) {
    const v = map[slug(k)];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
};

const num = (v: any, fallback = 0) => {
  if (v === undefined || v === null || v === "") return fallback;
  if (typeof v === "number") return Number.isFinite(v) ? v : fallback;
  const parsed = Number(String(v).replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}\b)/g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const str = (v: any) => (v === undefined || v === null ? undefined : String(v).trim() || undefined);

const date = (v: any) => {
  const s = str(v);
  if (!s) return new Date().toISOString();
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
};

/** Extrai a primeira URL/base64 de imagem de qualquer formato (string, array, objeto). */
const image = (row: any) => {
  const raw = pick(row, [
    "image_url",
    "imageurl",
    "imagem_url",
    "imagem",
    "imagens",
    "image",
    "images",
    "foto",
    "fotos",
    "photo",
    "photos",
    "picture",
    "thumbnail",
    "file_url",
    "fileurl",
    "url_imagem",
    "arquivo",
  ]);
  const first = (v: any): string | undefined => {
    if (!v) return undefined;
    if (typeof v === "string") {
      const s = v.trim();
      if (!s) return undefined;
      // Se for Base64 puro sem prefixo, adicionamos o prefixo padrão de imagem
      if (s.length > 100 && !s.includes(":") && !s.includes("/") && !s.includes("http")) {
        return `data:image/jpeg;base64,${s}`;
      }
      return s;
    }
    if (Array.isArray(v)) return first(v[0]);
    if (typeof v === "object") return first(v.url ?? v.src ?? v.file_url ?? v.path ?? v.href ?? v.base64 ?? v.data);
    return undefined;
  };
  return first(raw) ?? null;
};

/** Quantidade em estoque aceitando muitos nomes diferentes. */
const stockQty = (row: any) =>
  num(
    pick(row, [
      "current_stock",
      "currentstock",
      "quantidade_disponivel",
      "quantidadedisponivel",
      "estoque_atual",
      "estoqueatual",
      "quantidade_estoque",
      "quantidadeestoque",
      "estoque",
      "quantidade",
      "quantidade_total",
      "qtd",
      "qtde",
      "qty",
      "quantity",
      "stock",
      "saldo",
      "saldo_atual",
      "metros",
      "metragem",
    ]),
  );

/** Encontra todas as coleções de registros dentro de um payload de formato desconhecido. */
export function extractAllCollections(payload: any): Collections {
  const out: Collections = {};
  
  if (Array.isArray(payload)) {
    // Se for um array direto, tentamos inferir o que é ou apenas jogamos numa chave genérica
    if (payload.length > 0 && typeof payload[0] === "object") {
      out["root_array"] = payload;
    }
    return out;
  }

  if (payload?.dados && typeof payload.dados === "object" && !Array.isArray(payload.dados)) {
    // Caso específico do Base44 onde tudo está dentro de "dados"
    for (const [key, value] of Object.entries(payload.dados)) {
      if (Array.isArray(value)) {
        // Mapeia para a chave da tabela se houver alias, senão usa a chave original
        const target = TABLE_ALIASES[slug(key)] || key;
        out[target] = (out[target] ?? []).concat(value.filter((r) => r && typeof r === "object"));
        if (value.length === 0) {
          out[target] = out[target] ?? [];
        }
      }
    }
  }

  const visit = (node: any, depth: number) => {
    if (!node || typeof node !== "object" || depth > 4) return;
    if (Array.isArray(node)) return;
    
    for (const [key, value] of Object.entries(node)) {
      if (key === "dados" && depth === 0) continue; // Já processado acima se for raiz
      
      if (Array.isArray(value)) {
        // Inclui mesmo arrays vazios se estivermos no objeto 'dados' ou se for provável coleção
        const looksLikeCollection = value.length === 0 || value.some((r) => r && typeof r === "object" && !Array.isArray(r));
        if (looksLikeCollection) {
          out[key] = (out[key] ?? []).concat(value.filter((r) => r && typeof r === "object"));
          if (value.length === 0) {
            out[key] = out[key] ?? [];
          }
        }
      } else if (value && typeof value === "object") {
        visit(value, depth + 1);
      }
    }
  };
  
  visit(payload, 0);
  return out;
}

/** Coleções reconhecidas (chaveadas pela tabela destino). */
export function extractCollections(payload: any): Collections {
  const all = extractAllCollections(payload);
  const out: Collections = {};
  
  // Garantimos que o mapeamento de aliases seja aplicado a todas as chaves extraídas
  for (const [key, rows] of Object.entries(all)) {
    const target = TABLE_ALIASES[slug(key)] || key;
    if (target === IGNORED_TABLE) continue;
    out[target] = (out[target] ?? []).concat(rows);
  }
  
  return out;
}

/** Nomes de coleções presentes no arquivo que não conhecemos. */
export function unrecognizedCollections(payload: any): Record<string, number> {
  const known = new Set(Object.values(TABLE_ALIASES));
  const out: Record<string, number> = {};
  for (const [key, rows] of Object.entries(extractAllCollections(payload))) {
    const target = TABLE_ALIASES[slug(key)];
    if (target === IGNORED_TABLE) continue;
    if (!target && !known.has(key)) out[key] = rows.length;
  }

  return out;
}


type Mapper = (row: any) => Record<string, any> | null;

const MAPPERS: Record<string, Mapper> = {
  clients: (c) => {
    const name = str(pick(c, ["name", "nome", "cliente", "razaosocial", "fullname", "nomecompleto"]));
    if (!name) return null;
    return {
      name,
      phone: str(pick(c, ["phone", "telefone", "celular", "whatsapp", "fone", "tel", "cel"])) ?? null,
      email: str(pick(c, ["email", "e_mail", "mail"])) ?? null,
      document_cpf: str(pick(c, ["document_cpf", "cpf", "documento", "cnpj", "doc"])) ?? null,
      address: str(pick(c, ["address", "endereco", "logradouro", "rua", "lograd"])) ?? null,
      city: str(pick(c, ["city", "cidade", "municipio"])) ?? null,
      state: str(pick(c, ["state", "estado", "uf"])) ?? null,
      zip_code: str(pick(c, ["zip_code", "cep", "codigopostal"])) ?? null,
      notes: str(pick(c, ["notes", "observacoes", "obs", "comentarios"])) ?? null,
      client_type: str(pick(c, ["client_type", "tipo", "tipocliente", "origem"])) ?? "varejo",
      cashback_balance: num(pick(c, ["cashback_balance", "cashback", "saldocashback", "credito"])),
      created_at: date(pick(c, ["created_at", "criadoem", "datacadastro", "data", "date"])),
    };
  },
  products: (p) => {
    const name = str(pick(p, ["name", "nome", "produto", "descricao", "description", "label"]));
    const sku = str(
      pick(p, ["sku", "codigo_produto", "codigoproduto", "codigo", "code", "referencia", "ref", "id_externo"]),
    );
    if (!name && !sku) return null;
    const sale = num(pick(p, ["sale_price", "preco_venda", "preco", "precovenda", "price", "valor", "valorvenda", "venda"]));
    return {
      sku: sku ?? null,
      name: name ?? `Produto ${sku}`,
      description: str(pick(p, ["description", "descricao", "info", "detalhes"])) ?? null,
      category: str(pick(p, ["category", "categoria", "tipo", "grupo"])) ?? "Geral",
      color: str(pick(p, ["color", "cor"])) ?? null,
      image_url: image(p),
      sale_price: sale,
      wholesale_price: num(pick(p, ["wholesale_price", "preco_atacado", "precoatacado", "atacado", "valoratacado"]), 0) || null,
      cost_price: num(pick(p, ["cost_price", "custo_estimado", "custoestimado", "custo", "precocusto", "valorcusto"])),
      labor_cost: num(pick(p, ["labor_cost", "mao_de_obra", "maodeobra", "custommaodeobra"])),
      overhead_cost: num(pick(p, ["overhead_cost", "despesas_gerais", "despesasgerais", "custoindireto", "despesas", "fixo"])),
      retail_margin: num(pick(p, ["retail_margin", "margem_varejo", "margemvarejo", "margem", "markup"])),
      wholesale_margin: num(pick(p, ["wholesale_margin", "margem_atacado", "margematacado"])),
      production_time_hours: num(pick(p, ["production_time_hours", "tempo_producao", "tempoproducao"]), 0) || null,
      current_stock: stockQty(p),
      min_stock: num(pick(p, ["min_stock", "estoque_minimo", "estoqueminimo", "minimo"])),
      active: pick(p, ["active", "ativo", "status"]) === false || pick(p, ["status"]) === "inativo" ? false : true,
      created_at: date(pick(p, ["created_at", "created_date", "criadoem", "data", "date"])),
    };
  },

  suppliers: (s) => {
    const name = str(pick(s, ["name", "nome", "fornecedor", "razaosocial", "empresa"]));
    if (!name) return null;
    return {
      name,
      contact: str(pick(s, ["contact", "contato", "responsavel", "atendente"])) ?? null,
      phone: str(pick(s, ["phone", "telefone", "celular", "whatsapp", "fone"])) ?? null,
      email: str(pick(s, ["email", "mail"])) ?? null,
      document: str(pick(s, ["document", "cnpj", "cpf", "documento", "doc"])) ?? null,
      category: str(pick(s, ["category", "categoria", "tipo", "ramo"])) ?? null,
      type: str(pick(s, ["type", "tipo"])) ?? null,
      city: str(pick(s, ["city", "cidade"])) ?? null,
      state: str(pick(s, ["state", "estado", "uf"])) ?? null,
      address: str(pick(s, ["address", "endereco"])) ?? null,
      zip_code: str(pick(s, ["zip_code", "cep"])) ?? null,
      notes: str(pick(s, ["notes", "observacoes", "obs"])) ?? null,
      active: pick(s, ["active", "ativo"]) === false ? false : true,
      created_at: date(pick(s, ["created_at", "criadoem", "data", "date"])),
    };
  },
  materials: (m) => {
    const name = str(pick(m, ["name", "nome", "material", "descricao", "insumo"]));
    if (!name) return null;
    return {
      name,
      sku: str(pick(m, ["sku", "codigo", "referencia", "ref"])) ?? null,
      description: str(pick(m, ["description", "descricao", "info"])) ?? null,
      type: str(pick(m, ["type", "tipo", "categoria", "grupo"])) ?? "Geral",
      color: str(pick(m, ["color", "cor"])) ?? null,
      unit: str(pick(m, ["unit", "unidade", "un", "unidademedida", "uom"])) ?? "un",
      image_url: image(m),
      cost_price: num(pick(m, ["cost_price", "preco_unitario", "precounitario", "custo", "preco", "valor", "precocusto", "custounitario", "compra"])),
      current_stock: stockQty(m),
      min_stock: num(pick(m, ["min_stock", "estoque_minimo", "estoqueminimo", "minimo"])),
      supplier: str(pick(m, ["supplier", "fornecedor", "origem"])) ?? null,
      specification: str(pick(m, ["specification", "especificacao_customizada", "especificacao", "dimensoes"])) ?? null,
      width: num(pick(m, ["width", "largura", "L"]), 0) || null,
      height: num(pick(m, ["height", "altura", "H", "comp"]), 0) || null,
      thickness: num(pick(m, ["thickness", "espessura", "E"]), 0) || null,
      created_at: date(pick(m, ["created_at", "created_date", "criadoem", "data", "date"])),
    };
  },
  material_categories: (c) => {
    const name = str(pick(c, ["name", "nome", "categoria", "grupo"]));
    if (!name) return null;
    return { name, created_at: date(pick(c, ["created_at", "criadoem", "data"])) };
  },
  product_materials: (pm) => {
    return {
      product_id: pick(pm, ["product_id", "produto_id", "id_produto"]),
      material_id: pick(pm, ["material_id", "id_material", "material_id_fk"]),
      quantity: num(pick(pm, ["quantity", "quantidade", "qtd", "valor"])),
      created_at: date(pick(pm, ["created_at", "criadoem"]))
    };
  },
  production_orders: (po) => {
    return {
      quantity: num(pick(po, ["quantity", "quantidade", "qtd", "total"]), 1) || 1,
      status: str(pick(po, ["status", "situacao", "estado"])) ?? "pendente",
      priority: str(pick(po, ["priority", "prioridade"])) ?? null,
      codigo_ordem: str(pick(po, ["codigo_ordem", "codigo", "numero", "numero_ordem"])) ?? null,
      produto_nome: str(pick(po, ["produto_nome", "produto", "nome", "produtonome"])) ?? null,
      notes: str(pick(po, ["notes", "observacoes", "obs"])) ?? null,
      started_at: pick(po, ["started_at", "data_inicio", "inicio"]) ? date(pick(po, ["started_at", "data_inicio", "inicio"])) : null,
      completed_at: pick(po, ["completed_at", "data_fim", "fim"]) ? date(pick(po, ["completed_at", "data_fim", "fim"])) : null,
      created_at: date(pick(po, ["created_at", "created_date", "criadoem", "data"])),
    };
  },

  stock_products: (s) => {
    const name = str(pick(s, ["produto_nome", "produtonome", "name", "nome", "produto", "descricao", "item"]));
    if (!name) return null;
    const numeracoes = pick(s, ["numeracoes", "numeracao", "tamanhos", "sizes", "grade", "variacoes"]);
    return {
      produto_nome: name,
      categoria: str(pick(s, ["categoria", "category", "tipo", "grupo"])) ?? null,
      quantidade_disponivel: stockQty(s),
      numeracoes:
        numeracoes && typeof numeracoes === "object" && !Array.isArray(numeracoes) ? numeracoes : null,
      preco_custo: num(pick(s, ["preco_custo", "custo", "cost_price", "valorcusto"])),
      preco_venda: num(pick(s, ["preco_venda", "preco", "sale_price", "valor", "valorvenda"])),
      localizacao: str(pick(s, ["localizacao", "location", "local", "prateleira"])) ?? null,
      lote: str(pick(s, ["lote", "batch", "num_lote"])) ?? null,
      data_entrada: date(pick(s, ["data_entrada", "created_at", "dataentrada", "data", "date"])),
      __product_name: name,

    };
  },
  financial_accounts: (a) => {
    const name = str(pick(a, ["name", "nome", "conta", "descricao", "banco"]));
    if (!name) return null;
    const initial = num(pick(a, ["initial_balance", "saldoinicial", "saldo", "inicial"]));
    return {
      name,
      type: str(pick(a, ["type", "tipo", "natureza"])) ?? "caixa",
      initial_balance: initial,
      current_balance: num(pick(a, ["current_balance", "saldoatual", "saldo", "valor"]), initial),
      bank_name: str(pick(a, ["bank_name", "banco", "instituicao"])) ?? null,
      agency: str(pick(a, ["agency", "agencia"])) ?? null,
      account_number: str(pick(a, ["account_number", "numeroconta", "conta", "num"])) ?? null,
      active: pick(a, ["active", "ativo", "status"]) === false ? false : true,
      created_at: date(pick(a, ["created_at", "criadoem", "data", "date"])),
    };
  },
  promotions: (p) => {
    const name = str(pick(p, ["name", "nome", "promocao", "titulo", "campanha"]));
    if (!name) return null;
    return {
      name,
      code: str(pick(p, ["code", "codigo", "cupom", "voucher"])) ?? null,
      discount_percent: num(pick(p, ["discount_percent", "desconto", "percentual", "off"])),
      active: pick(p, ["active", "ativo", "status"]) === false ? false : true,
      created_at: date(pick(p, ["created_at", "criadoem", "data", "date"])),
    };
  },
  units_of_measure: (u) => {
    const name = str(pick(u, ["name", "nome", "unidade", "descricao", "medida"]));
    if (!name) return null;
    return {
      name,
      abbreviation: str(pick(u, ["abbreviation", "sigla", "abreviacao", "simbolo", "abrev"])) ?? name.slice(0, 3),
      created_at: date(pick(u, ["created_at", "criadoem", "data"])),
    };
  },
  material_cuts: (c) => {
    const name = str(pick(c, ["name", "nome", "corte", "descricao"]));
    const material_id = str(pick(c, ["material_id", "material", "id_material", "insumo_id"]));
    if (!name || !material_id) return null;
    return {
      name,
      material_id,
      width: num(pick(c, ["width", "largura", "L"])),
      height: num(pick(c, ["height", "altura", "H"])),
      x: pick(c, ["x", "pos_x"]) ?? null,
      y: pick(c, ["y", "pos_y"]) ?? null,
      rotation: num(pick(c, ["rotation", "rotacao"]), 0),
      status: str(pick(c, ["status", "situacao"])) ?? "disponivel",
      created_at: date(pick(c, ["created_at", "criadoem"])),
    };
  },
  material_variations: (v) => {
    const name = str(pick(v, ["name", "nome", "variacao", "descricao", "cupom"]));
    const material_id = str(pick(v, ["material_id", "material", "id_material"]));
    if (!name || !material_id) return null;
    return {
      name,
      material_id,
      sku: str(pick(v, ["sku", "codigo", "referencia"])) ?? null,
      created_at: date(pick(v, ["created_at", "criadoem"])),
    };
  },
  transactions: (t) => {
    const amount = num(pick(t, ["amount", "valor", "value", "total", "saldo"]));
    if (!amount) return null;
    const rawType = slug(String(pick(t, ["type", "tipo", "natureza", "sentido"]) ?? "income"));
    const isExpense = ["expense", "saida", "despesa", "debito", "out", "pagamento", "pagar", "retirada"].includes(rawType);
    const due = pick(t, ["due_date", "data_vencimento", "vencimento"]);
    return {
      amount: Math.abs(amount),
      type: isExpense ? "expense" : "income",
      description: str(pick(t, ["description", "descricao", "historico", "titulo", "obs"])) ?? "Importado do backup",
      category: str(pick(t, ["category", "categoria_nome", "categorianome", "categoria", "grupo", "fluxo"])) ?? "Importado",
      payment_method: str(pick(t, ["payment_method", "forma_pagamento", "formapagamento", "pagamento", "meio"])) ?? null,
      status: str(pick(t, ["status", "situacao", "estado"])) ?? "pago",
      notes: str(pick(t, ["notes", "observacoes", "complemento"])) ?? null,
      due_date: due ? date(due).slice(0, 10) : null,
      created_at: date(pick(t, ["created_at", "data_transacao", "datatransacao", "data", "datapagamento", "criadoem"])),
      __account_name: str(pick(t, ["conta_nome", "contanome", "account_name", "conta"])) ?? null,
      __client_name: str(pick(t, ["cliente_nome", "clientenome"])) ?? null,
      __supplier_name: str(pick(t, ["fornecedor_nome", "fornecedornome"])) ?? null,
    };
  },
  sales: (s) => {
    const total = num(pick(s, ["total_amount", "valor_total", "valor", "subtotal"]));
    const paid = num(pick(s, ["paid_amount", "valor_pago"]));
    const method = str(pick(s, ["payment_method", "forma_pagamento", "formapagamento", "metodo", "forma"])) ?? "dinheiro";
    const remaining = num(pick(s, ["valor_restante", "valorrestante"]), Math.max(total - paid, 0));
    const isDebt = slug(method) === "fiado" || remaining > 0.009;
    const rawStatus = str(pick(s, ["status", "situacao"]));
    const status = rawStatus ?? (remaining <= 0.009 ? "pago" : paid > 0 ? "parcial" : "pendente");
    return {
      sale_code: str(pick(s, ["sale_code", "codigo_venda", "codigovenda", "codigo"])) ?? null,
      total_amount: total,
      paid_amount: paid,
      discount: num(pick(s, ["discount", "desconto"])),
      payment_method: method,
      is_debt: isDebt,
      status,
      sale_type: str(pick(s, ["sale_type", "tipo_venda", "tipovenda"])) ?? "varejo",
      cashback_used: num(pick(s, ["cashback_used", "cashback_usado"])),
      cashback_earned: num(pick(s, ["cashback_earned", "cashback_gerado"])),
      notes: str(pick(s, ["notes", "observacoes"])) ?? null,
      created_at: date(pick(s, ["created_at", "data_venda", "datavenda", "data"])),
      __client_name: str(pick(s, ["cliente_nome", "clientenome", "cliente"])) ?? null,
    };
  },
  sale_items: (si) => ({
    quantity: num(pick(si, ["quantity", "quantidade"]), 1) || 1,
    unit_price: num(pick(si, ["unit_price", "preco_unitario", "valor_unitario", "valor"])),
    discount: num(pick(si, ["discount", "desconto"])),
    numeracao: str(pick(si, ["numeracao", "tamanho"])) ?? null,
    __sale_code: str(pick(si, ["codigo_venda", "codigovenda"])) ?? null,
    __product_name: str(pick(si, ["produto_nome", "produtonome", "produto", "nome"])) ?? null,
  }),
  sale_payments: (sp) => ({
    amount: num(pick(sp, ["amount", "valor_pago", "valor"])),
    payment_method: str(pick(sp, ["payment_method", "forma_pagamento", "formapagamento", "metodo", "forma"])) ?? "dinheiro",
    created_at: date(pick(sp, ["created_at", "data_pagamento", "datapagamento", "data"])),
    __sale_code: str(pick(sp, ["codigo_venda", "codigovenda"])) ?? null,
  }),
  sale_installments: (si) => {
    const paid = num(pick(si, ["paid_amount", "valor_pago"]));
    const amount = num(pick(si, ["amount", "valor_parcela", "valorparcela", "valor"]));
    const paidAt = pick(si, ["paid_at", "data_pagamento", "datapagamento"]);
    return {
      installment_number: num(pick(si, ["installment_number", "numero_parcela", "numeroparcela", "numero", "parcela"]), 1) || 1,
      amount,
      paid_amount: paid,
      remaining_amount: Math.max(amount - paid, 0),
      due_date: date(pick(si, ["due_date", "data_vencimento", "datavencimento", "vencimento"])),
      paid_at: paidAt ? date(paidAt) : null,
      status: str(pick(si, ["status", "situacao"])) ?? (paid >= amount && amount > 0 ? "pago" : "pendente"),
      __sale_code: str(pick(si, ["codigo_venda", "codigovenda"])) ?? null,
    };
  },

  purchases: (p) => ({
    supplier_id: pick(p, ["supplier_id", "fornecedor_id"]),
    material_id: pick(p, ["material_id", "material_id"]),
    quantity: num(pick(p, ["quantity", "quantidade"])),
    unit_cost: num(pick(p, ["unit_cost", "custo_unitario"])),
    status: str(pick(p, ["status", "situacao"])) ?? "pendente",
    received_at: date(pick(p, ["received_at", "data_recebimento"])),
  }),
  purchase_items: (pi) => ({
    purchase_id: pick(pi, ["purchase_id", "compra_id"]),
    material_id: pick(pi, ["material_id", "material_id"]),
    quantity: num(pick(pi, ["quantity", "quantidade"])),
    unit_cost: num(pick(pi, ["unit_cost", "custo_unitario"])),
  }),
  notifications: (n) => ({
    title: str(pick(n, ["title", "titulo"])) ?? "Notificação",
    message: str(pick(n, ["message", "mensagem"])) ?? "",
    type: str(pick(n, ["type", "tipo"])) ?? "info",
    is_read: pick(n, ["is_read", "lido"]) === true,
  }),
  app_settings: (s) => ({
    key: str(pick(s, ["key", "chave"])),
    value: str(pick(s, ["value", "valor"])),
  }),
};

/** Ordem de inserção respeitando dependências simples. */
export const IMPORT_ORDER = [
  "accounts",
  "material_categories",
  "units_of_measure",
  "suppliers",
  "materials",
  "material_cuts",
  "material_variations",
  "clients",
  "products",
  "product_materials",
  "production_orders",
  "stock_products",
  "financial_accounts",
  "promotions",
  "transactions",
  "sales",
  "sale_items",
  "sale_payments",
  "sale_installments",
  "purchases",
  "purchase_items",
  "notifications",
  "app_settings",
];

export function mapForeignBackup(payload: any): Collections {
  const collections = extractCollections(payload);
  const mapped: Collections = {};
  for (const table of IMPORT_ORDER) {
    const rows = collections[table];
    const mapper = MAPPERS[table];
    if (rows === undefined || !mapper) continue;
    
    // Se rows for um array vazio, retornamos o array vazio para manter a intenção de mapeamento.
    if (rows.length === 0) {
      mapped[table] = [];
      continue;
    }
    
    const converted = rows.map(mapper).filter(Boolean) as any[];
    if (converted.length) {
      mapped[table] = converted;
    }
  }
  return mapped;
}

export function describeCollections(payload: any): string[] {
  return Object.entries(extractCollections(payload)).map(([k, v]) => `${k} (${v.length})`);
}
