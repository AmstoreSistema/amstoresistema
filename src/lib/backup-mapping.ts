/**
 * Mapeamento genérico de backups externos (Base44 e similares) para o schema Amstore.
 * Aceita praticamente qualquer JSON que contenha coleções de registros.
 */

export type Collections = Record<string, any[]>;

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
  sales: "transactions",
  vendas: "transactions",
  venda: "transactions",
  faturamento: "transactions",

  // Vendas Específicas
  sale_items: "sale_items",
  itensvenda: "sale_items",
  itens_venda: "sale_items",
  sale_payments: "sale_payments",
  pagamentos: "sale_payments",
  pagamentos_vendas: "sale_payments",
  sale_installments: "sale_installments",
  parcelas: "sale_installments",
  parcelas_vendas: "sale_installments",

  // Compras Específicas
  purchases: "purchases",
  compras: "purchases",
  compras_materiais: "purchases",
  purchase_items: "purchase_items",
  itenscompra: "purchase_items",
  itens_compra: "purchase_items",

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
  cupom: "promotions",

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

  // Variações de Material
  material_variations: "material_variations",
  materialvariation: "material_variations",
  materialvariations: "material_variations",
  cupon: "material_variations",
  cupons: "material_variations",
  cuponproducao: "material_variations",
  cuponsproducao: "material_variations",
  variacaomaterial: "material_variations",
  variacoesmateriais: "material_variations",

  // Sistema e Alertas
  notifications: "notifications",
  alertas: "notifications",
  configuracoes_materiais: "material_categories",
  configuracoesmateriais: "material_categories",
  configuracoes_globais: "app_settings",
  configuracoesglobais: "app_settings",
  app_settings: "app_settings",
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
        // Aceitamos mesmo que o array esteja vazio para que seja mapeado e não descartado
        out[key] = (out[key] ?? []).concat(value.filter((r) => r && typeof r === "object"));
        // Se estiver vazio, garantimos que a chave exista no output para o TABLE_ALIASES funcionar
        if (value.length === 0) {
          out[key] = out[key] ?? [];
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
  const out: Collections = {};
  for (const [key, rows] of Object.entries(extractAllCollections(payload))) {
    const target = TABLE_ALIASES[slug(key)];
    if (target) {
      out[target] = (out[target] ?? []).concat(rows);
    }
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
  product_materials: (pm) => {
    // Mapeamento simples para ficha técnica
    return {
      product_id: pick(pm, ["product_id", "produto_id", "id_produto"]),
      material_id: pick(pm, ["material_id", "material_id", "id_material"]),
      quantity: num(pick(pm, ["quantity", "quantidade", "qtd"])),
      created_at: date(pick(pm, ["created_at", "criadoem"]))
    };
  },
  production_orders: (po) => {
    return {
      product_id: pick(po, ["product_id", "produto_id", "id_produto"]),
      quantity: num(pick(po, ["quantity", "quantidade", "qtd"])),
      status: str(pick(po, ["status", "situacao"])) ?? "pendente",
      start_date: date(pick(po, ["start_date", "data_inicio"])),
      end_date: date(pick(po, ["end_date", "data_fim"])),
      created_at: date(pick(po, ["created_at", "criadoem"]))
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
  sales: (s) => ({
    client_id: pick(s, ["client_id", "cliente_id"]),
    total_amount: num(pick(s, ["total_amount", "valor_total", "valor"])),
    paid_amount: num(pick(s, ["paid_amount", "valor_pago"])),
    discount: num(pick(s, ["discount", "desconto"])),
    payment_method: str(pick(s, ["payment_method", "metodo", "forma"])) ?? "dinheiro",
    status: str(pick(s, ["status", "situacao"])) ?? "finalizado",
    notes: str(pick(s, ["notes", "observacoes"])),
    created_at: date(pick(s, ["created_at", "data"])),
  }),
  sale_items: (si) => ({
    sale_id: pick(si, ["sale_id", "venda_id"]),
    product_id: pick(si, ["product_id", "produto_id"]),
    quantity: num(pick(si, ["quantity", "quantidade"])),
    unit_price: num(pick(si, ["unit_price", "preco_unitario", "valor"])),
    discount: num(pick(si, ["discount", "desconto"])),
    numeracao: str(pick(si, ["numeracao", "tamanho"])),
  }),
  sale_payments: (sp) => ({
    sale_id: pick(sp, ["sale_id", "venda_id"]),
    amount: num(pick(sp, ["amount", "valor"])),
    payment_method: str(pick(sp, ["payment_method", "metodo", "forma"])) ?? "dinheiro",
    created_at: date(pick(sp, ["created_at", "data"])),
  }),
  sale_installments: (si) => ({
    sale_id: pick(si, ["sale_id", "venda_id"]),
    installment_number: num(pick(si, ["installment_number", "numero", "parcela"])),
    amount: num(pick(si, ["amount", "valor"])),
    due_date: date(pick(si, ["due_date", "vencimento"])),
    status: str(pick(si, ["status", "situacao"])) ?? "pendente",
  }),
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
