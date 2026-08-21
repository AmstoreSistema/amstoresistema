/**
 * Mapeamento genérico de backups externos (Base44 e similares) para o schema Amstore.
 * Aceita praticamente qualquer JSON que contenha coleções de registros.
 */

export type Collections = Record<string, any[]>;

const TABLE_ALIASES: Record<string, string> = {
  clients: "clients",
  client: "clients",
  clientes: "clients",
  cliente: "clients",
  customers: "clients",
  customer: "clients",
  contatos: "clients",
  contato: "clients",

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

  suppliers: "suppliers",
  supplier: "suppliers",
  fornecedores: "suppliers",
  fornecedor: "suppliers",
  empresas: "suppliers",
  empresa: "suppliers",

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

  transactions: "transactions",
  transaction: "transactions",
  transacoes: "transactions",
  transacao: "transactions",
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

  promotions: "promotions",
  promotion: "promotions",
  promocoes: "promotions",
  promocao: "promotions",
  descontos: "promotions",
  cupom: "promotions",

  units_of_measure: "units_of_measure",
  unitofmeasure: "units_of_measure",
  unitsofmeasure: "units_of_measure",
  unidades: "units_of_measure",
  unidademedida: "units_of_measure",
  unidadesdemedida: "units_of_measure",
  medidas: "units_of_measure",
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
    if (typeof v === "string") return v.trim() || undefined;
    if (Array.isArray(v)) return first(v[0]);
    if (typeof v === "object") return first(v.url ?? v.src ?? v.file_url ?? v.path ?? v.href);
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
  const visit = (node: any, depth: number) => {
    if (!node || typeof node !== "object" || depth > 4) return;
    if (Array.isArray(node)) return;
    for (const [key, value] of Object.entries(node)) {
      if (Array.isArray(value)) {
        if (value.some((r) => r && typeof r === "object" && !Array.isArray(r))) {
          out[key] = (out[key] ?? []).concat(value.filter((r) => r && typeof r === "object"));
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
  const out: Collections = {};
  for (const [key, rows] of Object.entries(extractAllCollections(payload))) {
    const target = TABLE_ALIASES[slug(key)];
    if (target) out[target] = (out[target] ?? []).concat(rows);
  }
  return out;
}

/** Nomes de coleções presentes no arquivo que não conhecemos. */
export function unrecognizedCollections(payload: any): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, rows] of Object.entries(extractAllCollections(payload))) {
    if (!TABLE_ALIASES[slug(key)]) out[key] = rows.length;
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
    const sku = str(pick(p, ["sku", "codigo", "code", "referencia", "ref", "id_externo"]));
    if (!name && !sku) return null;
    const sale = num(pick(p, ["sale_price", "preco", "precovenda", "price", "valor", "valorvenda", "venda"]));
    return {
      sku: sku ?? null,
      name: name ?? `Produto ${sku}`,
      description: str(pick(p, ["description", "descricao", "info", "detalhes"])) ?? null,
      category: str(pick(p, ["category", "categoria", "tipo", "grupo"])) ?? "Geral",
      color: str(pick(p, ["color", "cor"])) ?? null,
      image_url: image(p),
      sale_price: sale,
      wholesale_price: num(pick(p, ["wholesale_price", "precoatacado", "atacado", "valoratacado"]), 0) || null,
      cost_price: num(pick(p, ["cost_price", "custo", "precocusto", "valorcusto"])),
      labor_cost: num(pick(p, ["labor_cost", "maodeobra", "custommaodeobra", "mao_de_obra"])),
      overhead_cost: num(pick(p, ["overhead_cost", "custoindireto", "despesas", "fixo"])),
      retail_margin: num(pick(p, ["retail_margin", "margemvarejo", "margem", "markup"])),
      wholesale_margin: num(pick(p, ["wholesale_margin", "margematacado"])),
      current_stock: stockQty(p),
      min_stock: num(pick(p, ["min_stock", "estoqueminimo", "minimo"])),
      active: pick(p, ["active", "ativo", "status"]) === false || pick(p, ["status"]) === "inativo" ? false : true,
      created_at: date(pick(p, ["created_at", "criadoem", "data", "date"])),
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
      cost_price: num(pick(m, ["cost_price", "custo", "preco", "valor", "precocusto", "custounitario", "compra"])),
      current_stock: stockQty(m),
      min_stock: num(pick(m, ["min_stock", "estoqueminimo", "minimo"])),
      supplier: str(pick(m, ["supplier", "fornecedor", "origem"])) ?? null,
      specification: str(pick(m, ["specification", "especificacao", "dimensoes"])) ?? null,
      width: num(pick(m, ["width", "largura", "L"]), 0) || null,
      height: num(pick(m, ["height", "altura", "H", "comp"]), 0) || null,
      thickness: num(pick(m, ["thickness", "espessura", "E"]), 0) || null,
      created_at: date(pick(m, ["created_at", "criadoem", "data", "date"])),
    };
  },
  material_categories: (c) => {
    const name = str(pick(c, ["name", "nome", "categoria", "grupo"]));
    if (!name) return null;
    return { name, created_at: date(pick(c, ["created_at", "criadoem", "data"])) };
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
  transactions: (t) => {
    const amount = num(pick(t, ["amount", "valor", "value", "total", "saldo"]));
    if (!amount) return null;
    const rawType = slug(String(pick(t, ["type", "tipo", "natureza", "sentido"]) ?? "income"));
    const isExpense = ["expense", "saida", "despesa", "debito", "out", "pagamento", "pagar", "retirada"].includes(rawType);
    return {
      amount: Math.abs(amount),
      type: isExpense ? "expense" : "income",
      description: str(pick(t, ["description", "descricao", "historico", "titulo", "obs"])) ?? "Importado do backup",
      category: str(pick(t, ["category", "categoria", "grupo", "fluxo"])) ?? "Importado",
      payment_method: str(pick(t, ["payment_method", "formapagamento", "pagamento", "meio"])) ?? null,
      status: str(pick(t, ["status", "situacao", "estado"])) ?? "pago",
      notes: str(pick(t, ["notes", "observacoes", "complemento"])) ?? null,
      created_at: date(pick(t, ["created_at", "data", "datapagamento", "criadoem", "vencimento"])),
    };
  },
};

/** Ordem de inserção respeitando dependências simples. */
export const IMPORT_ORDER = [
  "material_categories",
  "units_of_measure",
  "suppliers",
  "materials",
  "clients",
  "products",
  "stock_products",
  "financial_accounts",
  "promotions",
  "transactions",
];

export function mapForeignBackup(payload: any): Collections {
  const collections = extractCollections(payload);
  const mapped: Collections = {};
  for (const table of IMPORT_ORDER) {
    const rows = collections[table];
    const mapper = MAPPERS[table];
    if (!rows?.length || !mapper) continue;
    const converted = rows.map(mapper).filter(Boolean) as any[];
    if (converted.length) mapped[table] = converted;
  }
  return mapped;
}

export function describeCollections(payload: any): string[] {
  return Object.entries(extractCollections(payload)).map(([k, v]) => `${k} (${v.length})`);
}
