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

  products: "products",
  product: "products",
  produtos: "products",
  produto: "products",
  items: "products",

  suppliers: "suppliers",
  supplier: "suppliers",
  fornecedores: "suppliers",
  fornecedor: "suppliers",

  materials: "materials",
  material: "materials",
  materiais: "materials",
  materiaprima: "materials",
  materiasprimas: "materials",

  material_categories: "material_categories",
  categorias: "material_categories",
  categoria: "material_categories",
  categories: "material_categories",

  stock_products: "stock_products",
  estoque: "stock_products",
  estoques: "stock_products",
  stock: "stock_products",

  transactions: "transactions",
  transacoes: "transactions",
  transacao: "transactions",
  financeiro: "transactions",
  lancamentos: "transactions",
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

/** Encontra as coleções de registros dentro de um payload de formato desconhecido. */
export function extractCollections(payload: any): Collections {
  const out: Collections = {};
  const visit = (node: any, depth: number) => {
    if (!node || typeof node !== "object" || depth > 3) return;
    for (const [key, value] of Object.entries(node)) {
      if (Array.isArray(value)) {
        if (value.some((r) => r && typeof r === "object" && !Array.isArray(r))) {
          const target = TABLE_ALIASES[slug(key)];
          if (target) out[target] = (out[target] ?? []).concat(value.filter((r) => r && typeof r === "object"));
        }
      } else if (value && typeof value === "object") {
        visit(value, depth + 1);
      }
    }
  };
  visit(payload, 0);
  return out;
}

type Mapper = (row: any) => Record<string, any> | null;

const MAPPERS: Record<string, Mapper> = {
  clients: (c) => {
    const name = str(pick(c, ["name", "nome", "cliente", "razaosocial", "fullname"]));
    if (!name) return null;
    return {
      name,
      phone: str(pick(c, ["phone", "telefone", "celular", "whatsapp", "fone"])) ?? null,
      email: str(pick(c, ["email", "e_mail"])) ?? null,
      document_cpf: str(pick(c, ["document_cpf", "cpf", "documento", "cnpj"])) ?? null,
      address: str(pick(c, ["address", "endereco", "logradouro"])) ?? null,
      city: str(pick(c, ["city", "cidade"])) ?? null,
      state: str(pick(c, ["state", "estado", "uf"])) ?? null,
      zip_code: str(pick(c, ["zip_code", "cep"])) ?? null,
      notes: str(pick(c, ["notes", "observacoes", "obs"])) ?? null,
      client_type: str(pick(c, ["client_type", "tipo", "tipocliente"])) ?? "varejo",
      cashback_balance: num(pick(c, ["cashback_balance", "cashback", "saldocashback"])),
      created_at: date(pick(c, ["created_at", "criadoem", "datacadastro", "data"])),
    };
  },
  products: (p) => {
    const name = str(pick(p, ["name", "nome", "produto", "descricao", "description"]));
    const sku = str(pick(p, ["sku", "codigo", "code", "referencia", "ref"]));
    if (!name && !sku) return null;
    const sale = num(pick(p, ["sale_price", "preco", "precovenda", "price", "valor", "valorvenda"]));
    return {
      sku: sku ?? null,
      name: name ?? `Produto ${sku}`,
      description: str(pick(p, ["description", "descricao"])) ?? null,
      category: str(pick(p, ["category", "categoria", "tipo"])) ?? "Geral",
      color: str(pick(p, ["color", "cor"])) ?? null,
      sale_price: sale,
      wholesale_price: num(pick(p, ["wholesale_price", "precoatacado", "atacado"]), 0) || null,
      cost_price: num(pick(p, ["cost_price", "custo", "precocusto"])),
      labor_cost: num(pick(p, ["labor_cost", "maodeobra", "custommaodeobra"])),
      overhead_cost: num(pick(p, ["overhead_cost", "custoindireto", "despesas"])),
      retail_margin: num(pick(p, ["retail_margin", "margemvarejo", "margem"])),
      wholesale_margin: num(pick(p, ["wholesale_margin", "margematacado"])),
      current_stock: num(pick(p, ["current_stock", "estoque", "quantidade", "qtd", "estoqueatual"])),
      min_stock: num(pick(p, ["min_stock", "estoqueminimo"])),
      active: pick(p, ["active", "ativo"]) === false ? false : true,
      created_at: date(pick(p, ["created_at", "criadoem", "data"])),
    };
  },
  suppliers: (s) => {
    const name = str(pick(s, ["name", "nome", "fornecedor", "razaosocial"]));
    if (!name) return null;
    return {
      name,
      contact: str(pick(s, ["contact", "contato", "responsavel"])) ?? null,
      phone: str(pick(s, ["phone", "telefone", "celular", "whatsapp"])) ?? null,
      email: str(pick(s, ["email"])) ?? null,
      document: str(pick(s, ["document", "cnpj", "cpf", "documento"])) ?? null,
      category: str(pick(s, ["category", "categoria"])) ?? null,
      type: str(pick(s, ["type", "tipo"])) ?? null,
      city: str(pick(s, ["city", "cidade"])) ?? null,
      state: str(pick(s, ["state", "estado", "uf"])) ?? null,
      address: str(pick(s, ["address", "endereco"])) ?? null,
      zip_code: str(pick(s, ["zip_code", "cep"])) ?? null,
      notes: str(pick(s, ["notes", "observacoes"])) ?? null,
      active: pick(s, ["active", "ativo"]) === false ? false : true,
      created_at: date(pick(s, ["created_at", "criadoem", "data"])),
    };
  },
  materials: (m) => {
    const name = str(pick(m, ["name", "nome", "material", "descricao"]));
    if (!name) return null;
    return {
      name,
      sku: str(pick(m, ["sku", "codigo", "referencia"])) ?? null,
      description: str(pick(m, ["description", "descricao"])) ?? null,
      type: str(pick(m, ["type", "tipo", "categoria"])) ?? null,
      color: str(pick(m, ["color", "cor"])) ?? null,
      unit: str(pick(m, ["unit", "unidade", "un"])) ?? "un",
      cost_price: num(pick(m, ["cost_price", "custo", "preco", "valor"])),
      current_stock: num(pick(m, ["current_stock", "estoque", "quantidade", "qtd"])),
      min_stock: num(pick(m, ["min_stock", "estoqueminimo"])),
      supplier: str(pick(m, ["supplier", "fornecedor"])) ?? null,
      specification: str(pick(m, ["specification", "especificacao"])) ?? null,
      created_at: date(pick(m, ["created_at", "criadoem", "data"])),
    };
  },
  material_categories: (c) => {
    const name = str(pick(c, ["name", "nome", "categoria"]));
    if (!name) return null;
    return { name, created_at: date(pick(c, ["created_at", "criadoem"])) };
  },
  transactions: (t) => {
    const amount = num(pick(t, ["amount", "valor", "value", "total"]));
    if (!amount) return null;
    const rawType = slug(String(pick(t, ["type", "tipo", "natureza"]) ?? "income"));
    const isExpense = ["expense", "saida", "despesa", "debito", "out"].includes(rawType);
    return {
      amount: Math.abs(amount),
      type: isExpense ? "expense" : "income",
      description: str(pick(t, ["description", "descricao", "historico", "titulo"])) ?? "Importado do backup",
      category: str(pick(t, ["category", "categoria"])) ?? "Importado",
      payment_method: str(pick(t, ["payment_method", "formapagamento", "pagamento"])) ?? null,
      status: str(pick(t, ["status", "situacao"])) ?? "pago",
      notes: str(pick(t, ["notes", "observacoes"])) ?? null,
      created_at: date(pick(t, ["created_at", "data", "datapagamento", "criadoem"])),
    };
  },
};

/** Ordem de inserção respeitando dependências simples. */
export const IMPORT_ORDER = [
  "material_categories",
  "suppliers",
  "materials",
  "clients",
  "products",
  "stock_products",
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
