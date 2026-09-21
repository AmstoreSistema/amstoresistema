import React from "react";
import { brl, dateBR } from "./format";

export interface TransactionDetailsContext {
  clients?: any[];
  sales?: any[];
  suppliers?: any[];
  accounts?: any[];
  clientMap?: Map<string, any>;
  saleMap?: Map<string, any>;
  supplierMap?: Map<string, any>;
  accountMap?: Map<string, any>;
}

export interface ExtractedTransaction {
  id: string;
  isIncome: boolean;
  isExpense: boolean;
  date: string;
  rawDate: string;
  saleCode: string;
  clientName: string;
  supplierName: string;
  description: string;
  category: string;
  method: string;
  status: "Pago" | "Pendente" | "Cancelado";
  amount: number;
  amountFormatted: string;
}

/**
 * Remove o nome do cliente do final da descrição da venda APENAS se o nome for válido e estiver
 * claramente exibido em coluna própria, evitando que o nome do cliente seja apagado/escondido.
 */
export function cleanTransactionTitle(description: string | null | undefined, clientName?: string | null): string {
  if (!description) return "Sem descrição";

  // NUNCA remover texto da descrição se não houver cliente ou se for 'Consumidor Final'
  if (!clientName || !clientName.trim() || clientName.trim().toLowerCase() === "consumidor final") {
    return description;
  }

  const trimmedClient = clientName.trim();
  const escaped = trimmedClient.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`\\s*-\\s*${escaped}(?:\\s*\\([^)]*\\))?\\s*$`, "i");
  if (regex.test(description)) {
    return description.replace(regex, "").trim();
  }

  return description;
}

/**
 * Valida se a string é um nome real de cliente (e não genérico como Consumidor Final ou vazio).
 */
export function isValidClientName(name?: string | null): boolean {
  if (!name || typeof name !== "string") return false;
  const t = name.trim();
  if (!t) return false;
  const lower = t.toLowerCase();
  if (
    lower === "consumidor final" ||
    lower === "consumidor" ||
    lower === "cliente avulso" ||
    lower === "não informado" ||
    lower === "nao informado" ||
    lower === "—" ||
    lower === "-"
  ) {
    return false;
  }
  return true;
}

/**
 * Extrai o nome do cliente a partir da descrição da transação com suporte a:
 * - 'Parcial 1/1 • V9218587757-G - Galega'
 * - 'Parcial 1/1 • V220826105653JS - Jamile Gonçalves da Silva - Estação Sabor'
 * - 'Pagamento Venda #1234 - Maria Santos'
 * - 'Venda #VEN-10 - João Carlos (Parcela 1/2)'
 */
export function extractClientFromDescription(desc?: string | null): string {
  if (!desc || typeof desc !== "string") return "";
  const trimmed = desc.trim();

  // Padrão 1: '• [CODIGO] - [NOME DO CLIENTE]' (suporta hífens dentro do código, ex: V9218587757-G)
  const bulletMatch = trimmed.match(/•\s*[A-Za-z0-9_-]+\s*-\s*([^()]+?)(?:\s*\(.*|\s*$)/);
  if (bulletMatch && bulletMatch[1]) {
    const cand = bulletMatch[1].trim();
    if (isValidClientName(cand)) return cand;
  }

  // Padrão 2: '(Pagamento )?Venda #(CODIGO) - [NOME DO CLIENTE]'
  const saleMatch = trimmed.match(/(?:Pagamento\s+)?Venda\s+(?:#)?([A-Za-z0-9_-]+)\s*-\s*([^()]+?)(?:\s*\(.*|\s*$)/i);
  if (saleMatch && saleMatch[2]) {
    const cand = saleMatch[2].trim();
    if (isValidClientName(cand)) return cand;
  }

  // Padrão 3: Último separador ' - ' antes de parênteses opcionais
  const lastDashIdx = trimmed.lastIndexOf(" - ");
  if (lastDashIdx !== -1) {
    const cand = trimmed.slice(lastDashIdx + 3).replace(/\s*\(.*$/, "").trim();
    if (cand && !/^(venda|parcela|entrada|saída|taxa|pagamento|estorno|receita|despesa)/i.test(cand) && isValidClientName(cand)) {
      return cand;
    }
  }

  // Padrão 4: Primeiro separador se não houver marcadores
  const firstDashMatch = trimmed.match(/-\s*([^()]+?)(?:\s*\(.*|\s*$)/);
  if (firstDashMatch && firstDashMatch[1]) {
    const cand = firstDashMatch[1].trim();
    if (cand && !/^(venda|parcela|entrada|saída|taxa|pagamento|estorno|receita|despesa)/i.test(cand) && isValidClientName(cand)) {
      return cand;
    }
  }

  return "";
}

/**
 * Extrai todas as informações de uma transação financeira de maneira inteligente,
 * resolvendo relacionamentos e códigos para Vendas e Despesas.
 */
export function extractTransactionDetails(t: any, context?: TransactionDetailsContext): ExtractedTransaction {
  const isIncome = t.type === "entrada" || t.type === "income";
  const isExpense = t.type === "saida" || t.type === "expense";

  // Mapas rápidos
  const clientMap = context?.clientMap || (context?.clients ? new Map(context.clients.map((c: any) => [c.id, c])) : undefined);
  const saleMap = context?.saleMap || (context?.sales ? new Map(context.sales.map((s: any) => [s.id, s])) : undefined);
  const supplierMap = context?.supplierMap || (context?.suppliers ? new Map(context.suppliers.map((s: any) => [s.id, s])) : undefined);
  const accountMap = context?.accountMap || (context?.accounts ? new Map(context.accounts.map((a: any) => [a.id, a])) : undefined);

  // 1. Código da Venda (se receita ou se vinculado a sale_id)
  let saleCode = "";
  const tSale = Array.isArray(t.sales) ? t.sales[0] : t.sales;
  if (t.sale_id && saleMap?.has(t.sale_id)) {
    saleCode = saleMap.get(t.sale_id)?.sale_code || "";
  }
  if (!saleCode && tSale?.sale_code) {
    saleCode = tSale.sale_code;
  }
  if (!saleCode && t.description) {
    const m = t.description.match(/(?:Pagamento\s+)?Venda\s+(?:#)?([A-Za-z0-9_-]+)/i);
    if (m && m[1]) saleCode = m[1];
  }
  if (!saleCode && t.sale_id) {
    saleCode = `#${t.sale_id.slice(0, 8)}`;
  }

  // 2. Nome do Cliente - Busca minuciosa e prioritária de nomes reais em todas as fontes
  let clientName = "";

  // 2.1. Diretamente no objeto/array clients vinculado à transação (join)
  const directClient = Array.isArray(t.clients) ? t.clients[0] : t.clients;
  if (directClient?.name && isValidClientName(directClient.name)) {
    clientName = directClient.name.trim();
  }

  // 2.2. Campo client_name diretamente na transação
  if (!clientName && t.client_name && isValidClientName(t.client_name)) {
    clientName = t.client_name.trim();
  }

  // 2.3. No mapa de clientes usando t.client_id
  if (!clientName && t.client_id && clientMap?.has(t.client_id)) {
    const c = clientMap.get(t.client_id);
    if (c?.name && isValidClientName(c.name)) {
      clientName = c.name.trim();
    }
  }

  // 2.4. Na venda aninhada via join (t.sales.clients ou t.sales.client_id)
  if (!clientName && tSale) {
    const saleClient = Array.isArray(tSale.clients) ? tSale.clients[0] : tSale.clients;
    if (saleClient?.name && isValidClientName(saleClient.name)) {
      clientName = saleClient.name.trim();
    } else if (tSale.client_name && isValidClientName(tSale.client_name)) {
      clientName = tSale.client_name.trim();
    } else if (tSale.client_id && clientMap?.has(tSale.client_id)) {
      const c = clientMap.get(tSale.client_id);
      if (c?.name && isValidClientName(c.name)) {
        clientName = c.name.trim();
      }
    }
  }

  // 2.5. Na venda vinculada via saleMap usando t.sale_id
  if (!clientName && t.sale_id && saleMap?.has(t.sale_id)) {
    const linkedSale = saleMap.get(t.sale_id);
    const lClient = Array.isArray(linkedSale?.clients) ? linkedSale.clients[0] : linkedSale?.clients;
    if (lClient?.name && isValidClientName(lClient.name)) {
      clientName = lClient.name.trim();
    } else if (linkedSale?.client_name && isValidClientName(linkedSale.client_name)) {
      clientName = linkedSale.client_name.trim();
    } else if (linkedSale?.client_id && clientMap?.has(linkedSale.client_id)) {
      const c = clientMap.get(linkedSale.client_id);
      if (c?.name && isValidClientName(c.name)) {
        clientName = c.name.trim();
      }
    }
  }

  // 2.6. No array de sales caso tenha sido passado no contexto
  if (!clientName && t.sale_id && context?.sales && Array.isArray(context.sales)) {
    const foundSale = context.sales.find((s: any) => s.id === t.sale_id);
    if (foundSale) {
      const fsClient = Array.isArray(foundSale.clients) ? foundSale.clients[0] : foundSale.clients;
      if (fsClient?.name && isValidClientName(fsClient.name)) {
        clientName = fsClient.name.trim();
      } else if (foundSale.client_name && isValidClientName(foundSale.client_name)) {
        clientName = foundSale.client_name.trim();
      } else if (foundSale.client_id && clientMap?.has(foundSale.client_id)) {
        const c = clientMap.get(foundSale.client_id);
        if (c?.name && isValidClientName(c.name)) {
          clientName = c.name.trim();
        }
      }
    }
  }

  // 2.7. Extração direta da descrição da transação (ex: 'Parcial 1/1 • V9218587757-G - Galega')
  if (!clientName && t.description && typeof t.description === "string") {
    const fromDesc = extractClientFromDescription(t.description);
    if (fromDesc) {
      clientName = fromDesc;
    }
  }

  // 2.8. Se ainda não encontrado, busca em array de clientes por correspondência no texto da descrição
  if (!clientName && t.description && context?.clients && Array.isArray(context.clients)) {
    const descLower = t.description.toLowerCase();
    for (const c of context.clients) {
      if (c?.name && c.name.trim().length >= 3 && isValidClientName(c.name)) {
        const cNameLower = c.name.trim().toLowerCase();
        if (descLower.includes(cNameLower)) {
          clientName = c.name.trim();
          break;
        }
      }
    }
  }

  // 2.9. Se for receita de venda e não houver NENHUM dado ou cliente em nenhuma fonte:
  if (!clientName && isIncome) {
    clientName = "Consumidor Final";
  }

  // 3. Fornecedor / Favorecido (para despesas)
  let supplierName = "";
  if (t.suppliers?.name) {
    supplierName = t.suppliers.name;
  } else if (t.supplier_name) {
    supplierName = t.supplier_name;
  } else if (t.supplier_id && supplierMap?.has(t.supplier_id)) {
    supplierName = supplierMap.get(t.supplier_id)?.name || "";
  }

  // 4. Descrição limpa
  let cleanDesc = t.description || (isIncome ? "Receita de Venda" : "Despesa");
  if (isIncome && clientName) {
    cleanDesc = cleanTransactionTitle(cleanDesc, clientName);
  }

  // 5. Categoria
  let category = t.category || (isIncome ? "Venda" : "Despesa Operacional");

  // 6. Forma de Pagamento / Conta
  let method = t.payment_method || "";
  const accName = t.financial_accounts?.name || (t.account_id && accountMap?.get(t.account_id)?.name);
  if (!method && accName) {
    method = accName;
  }

  // 7. Situação
  const rawStatus = String(t.status || "pago").toLowerCase();
  let status: "Pago" | "Pendente" | "Cancelado" = "Pago";
  if (["cancelado", "cancelled", "canceled"].includes(rawStatus)) {
    status = "Cancelado";
  } else if (["pendente", "pending", "aberto"].includes(rawStatus)) {
    status = "Pendente";
  } else {
    status = "Pago";
  }

  // 8. Valor
  const rawAmount = Math.abs(Number(t.amount || 0));

  return {
    id: t.id || "",
    isIncome,
    isExpense,
    date: dateBR(t.created_at || t.due_date),
    rawDate: String(t.created_at || t.due_date || ""),
    saleCode: saleCode || (isIncome ? "—" : ""),
    clientName: clientName || (isIncome ? "Consumidor Final" : "—"),
    supplierName: supplierName || (isExpense ? "—" : ""),
    description: cleanDesc,
    category,
    method: method ? method.toUpperCase() : "—",
    status,
    amount: rawAmount,
    amountFormatted: brl(rawAmount),
  };
}

export interface ReportColumnDef {
  key: string;
  label: string;
  align?: "right" | "left" | "center";
  className?: string;
}

/**
 * Constrói colunas e linhas perfeitamente alinhadas com o pedido do usuário:
 * - Despesa: Data, Descrição da transação, Categoria, Valor, Forma de Pagamento, Situação (pago)
 * - Receita: Data, Codigo venda, Nome cliente, Valor, Categoria (venda), Forma de Pagamento, Situação (Pago)
 * - Todos: Data, Tipo, Descrição / Cód. Venda, Cliente / Fornecedor, Categoria, Forma de Pagamento, Valor, Situação
 */
export function buildTransactionReportData(
  transactions: any[],
  typeFilter: "todos" | "receita" | "despesa",
  context?: TransactionDetailsContext
) {
  const extracted = transactions.map((t) => extractTransactionDetails(t, context));

  // Filtragem estrita por tipo se necessário
  const filtered = extracted.filter((item) => {
    if (typeFilter === "receita") return item.isIncome;
    if (typeFilter === "despesa") return item.isExpense;
    return true;
  });

  // Ordenação cronológica rigorosa: começa na data inicial do período e termina na data final
  filtered.sort((a, b) => {
    const timeA = new Date(a.rawDate).getTime() || 0;
    const timeB = new Date(b.rawDate).getTime() || 0;
    if (timeA !== timeB) return timeA - timeB;
    return (a.saleCode || "").localeCompare(b.saleCode || "");
  });

  const columns: ReportColumnDef[] = [];

  if (typeFilter === "receita") {
    columns.push(
      { key: "date", label: "Data", className: "whitespace-nowrap w-[70px] print:w-[58px]" },
      { key: "sale_code", label: "Código Venda", className: "whitespace-nowrap font-mono font-bold text-slate-900 w-[130px] print:w-[110px]" },
      { key: "client_name", label: "Nome Cliente", className: "min-w-[110px]" },
      { key: "category", label: "Categoria", align: "center", className: "whitespace-nowrap w-[65px] print:w-[52px]" },
      { key: "method", label: "Forma de Pagamento", className: "whitespace-nowrap w-[85px] print:w-[72px]" },
      { key: "status", label: "Situação", align: "center", className: "whitespace-nowrap w-[50px] print:w-[44px]" },
      { key: "amount", label: "Valor", align: "right", className: "whitespace-nowrap font-mono font-black min-w-[105px] print:min-w-[95px] print:w-[95px]" }
    );
  } else if (typeFilter === "despesa") {
    columns.push(
      { key: "date", label: "Data", className: "whitespace-nowrap w-[70px] print:w-[58px]" },
      { key: "description", label: "Descrição da Transação", className: "min-w-[150px]" },
      { key: "category", label: "Categoria", align: "center", className: "whitespace-nowrap w-[68px] print:w-[55px]" },
      { key: "method", label: "Forma de Pagamento", className: "whitespace-nowrap w-[85px] print:w-[72px]" },
      { key: "status", label: "Situação", align: "center", className: "whitespace-nowrap w-[50px] print:w-[44px]" },
      { key: "amount", label: "Valor", align: "right", className: "whitespace-nowrap font-mono font-black min-w-[105px] print:min-w-[95px] print:w-[95px]" }
    );
  } else {
    columns.push(
      { key: "date", label: "Data", className: "whitespace-nowrap w-[68px] print:w-[58px]" },
      { key: "type", label: "Tipo", align: "center", className: "whitespace-nowrap w-[54px] print:w-[46px]" },
      { key: "desc_code", label: "Descrição / Cód. Venda", className: "min-w-[130px]" },
      { key: "client_supplier", label: "Cliente / Favorecido", className: "min-w-[110px]" },
      { key: "category", label: "Categoria", className: "whitespace-nowrap w-[70px] print:w-[55px]" },
      { key: "method", label: "Forma de Pagamento", className: "whitespace-nowrap w-[85px] print:w-[70px]" },
      { key: "status", label: "Situação", align: "center", className: "whitespace-nowrap w-[48px] print:w-[42px]" },
      { key: "amount", label: "Valor", align: "right", className: "whitespace-nowrap font-mono font-black min-w-[105px] print:min-w-[95px] print:w-[95px]" }
    );
  }

  // Totais e estatísticas
  let totalReceitas = 0;
  let totalDespesas = 0;
  let pagasCount = 0;
  let pendentesCount = 0;

  filtered.forEach((item) => {
    if (item.isIncome) totalReceitas += item.amount;
    if (item.isExpense) totalDespesas += item.amount;
    if (item.status === "Pago") pagasCount++;
    if (item.status === "Pendente") pendentesCount++;
  });

  const rows = filtered.map((item) => {
    const isPaid = item.status === "Pago";
    const isPending = item.status === "Pendente";

    const dateSpan = <span className="whitespace-nowrap font-medium text-slate-800 text-xs">{item.date}</span>;
    const methodSpan = <span className="whitespace-nowrap font-medium text-slate-700 text-xs uppercase">{item.method}</span>;
    const categorySpan = (
      <span className="whitespace-nowrap text-slate-700 text-xs font-normal">
        {item.category}
      </span>
    );

    const statusBadge = (
      <span
        className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[9px] print:text-[8px] font-bold uppercase tracking-wider whitespace-nowrap border ${
          isPaid
            ? "bg-emerald-50 text-emerald-700 border-emerald-200/80 print:bg-emerald-50 print:text-emerald-900"
            : isPending
            ? "bg-amber-50 text-amber-700 border-amber-200/80 print:bg-amber-50 print:text-amber-900"
            : "bg-rose-50 text-rose-700 border-rose-200/80 print:bg-rose-50 print:text-rose-900"
        }`}
      >
        {item.status.toUpperCase()}
      </span>
    );

    const typeBadge = (
      <span
        className={`inline-flex items-center justify-center px-2 py-0.5 rounded text-[9px] print:text-[8px] font-bold uppercase tracking-wider whitespace-nowrap border ${
          item.isIncome
            ? "bg-emerald-50 text-emerald-700 border-emerald-200/80 print:bg-emerald-50 print:text-emerald-900"
            : "bg-rose-50 text-rose-700 border-rose-200/80 print:bg-rose-50 print:text-rose-900"
        }`}
      >
        {item.isIncome ? "RECEITA" : "DESPESA"}
      </span>
    );

    const amountFormatted = (
      <span
        className={`font-bold whitespace-nowrap font-mono text-xs print:text-[10px] tabular-nums tracking-tight ${
          item.isIncome ? "text-emerald-600 print:text-emerald-800" : "text-rose-600 print:text-rose-800"
        }`}
      >
        {item.isIncome ? "+ " : "- "}
        {item.amountFormatted}
      </span>
    );

    if (typeFilter === "receita") {
      return {
        date: dateSpan,
        sale_code: <span className="whitespace-nowrap font-mono font-bold text-slate-900 text-xs">{item.saleCode}</span>,
        client_name: <span className="text-slate-800 font-medium text-xs">{item.clientName}</span>,
        category: categorySpan,
        method: methodSpan,
        status: statusBadge,
        amount: amountFormatted,
        // Chaves puras para CSV/limpeza
        _raw_amount: item.amount,
        _raw_status: item.status,
      };
    }

    if (typeFilter === "despesa") {
      return {
        date: dateSpan,
        description: <span className="text-slate-800 font-normal text-xs">{item.description}</span>,
        category: categorySpan,
        method: methodSpan,
        status: statusBadge,
        amount: amountFormatted,
        // Chaves puras para CSV/limpeza
        _raw_amount: item.amount,
        _raw_status: item.status,
      };
    }

    return {
      date: dateSpan,
      type: typeBadge,
      desc_code: item.isIncome ? (
        item.saleCode ? (
          <span className="whitespace-nowrap font-mono font-bold text-slate-900 text-xs">{item.saleCode}</span>
        ) : (
          <span className="text-slate-800 font-normal text-xs">{item.description}</span>
        )
      ) : (
        <span className="text-slate-800 font-normal text-xs">{item.description}</span>
      ),
      client_supplier: <span className="text-slate-800 font-normal text-xs">{item.isIncome ? item.clientName : (item.supplierName || "—")}</span>,
      category: categorySpan,
      method: methodSpan,
      status: statusBadge,
      amount: amountFormatted,
      // Chaves puras para CSV/limpeza
      _raw_amount: item.amount,
      _raw_status: item.status,
      _raw_type: item.isIncome ? "Receita" : "Despesa",
    };
  });

  const summaryCards: { label: string; value: string | number; helper?: string }[] = [];

  if (typeFilter === "receita") {
    summaryCards.push(
      { label: "TOTAL RECEITAS (+)", value: brl(totalReceitas), helper: `${filtered.length} lançamentos de venda` },
      { label: "RECEITAS PAGAS", value: pagasCount, helper: "Concluídas e compensadas" },
      { label: "PENDENTES / A RECEBER", value: pendentesCount, helper: "Aguardando pagamento" }
    );
  } else if (typeFilter === "despesa") {
    summaryCards.push(
      { label: "TOTAL DESPESAS (-)", value: brl(totalDespesas), helper: `${filtered.length} despesas e custos` },
      { label: "DESPESAS QUITADAS", value: pagasCount, helper: "Pagas com comprovante" },
      { label: "DESPESAS PENDENTES", value: pendentesCount, helper: "A pagar no vencimento" }
    );
  } else {
    const bal = totalReceitas - totalDespesas;
    summaryCards.push(
      { label: "TOTAL RECEITAS (+)", value: brl(totalReceitas), helper: "Entradas financeiras" },
      { label: "TOTAL DESPESAS (-)", value: brl(totalDespesas), helper: "Saídas e custos operacionais" },
      {
        label: "RESULTADO LÍQUIDO",
        value: brl(bal),
        helper: bal >= 0 ? "Superávit do período" : "Déficit do período",
      },
      { label: "LANÇAMENTOS", value: filtered.length, helper: `${pagasCount} pagos / ${pendentesCount} pendentes` }
    );
  }

  const reportTitle =
    typeFilter === "receita"
      ? "Relatório de Receitas (Vendas)"
      : typeFilter === "despesa"
      ? "Relatório de Despesas (Saídas)"
      : "Relatório de Transações Financeiras";

  return {
    columns,
    rows,
    summaryCards,
    reportTitle,
    filteredItems: filtered,
  };
}

/**
 * Gera string CSV estruturada com as colunas pedidas pelo usuário,
 * com cabeçalho compatível com Excel (BOM UTF-8 e separador ';')
 */
export function exportTransactionsToCSV(
  transactions: any[],
  typeFilter: "todos" | "receita" | "despesa",
  context?: TransactionDetailsContext
): string {
  const extracted = transactions.map((t) => extractTransactionDetails(t, context));
  const filtered = extracted.filter((item) => {
    if (typeFilter === "receita") return item.isIncome;
    if (typeFilter === "despesa") return item.isExpense;
    return true;
  });

  // Ordenação cronológica rigorosa: começa na data inicial do período e termina na data final
  filtered.sort((a, b) => {
    const timeA = new Date(a.rawDate).getTime() || 0;
    const timeB = new Date(b.rawDate).getTime() || 0;
    if (timeA !== timeB) return timeA - timeB;
    return (a.saleCode || "").localeCompare(b.saleCode || "");
  });

  let headers: string[] = [];
  let rows: string[][] = [];

  if (typeFilter === "receita") {
    headers = ["Data", "Código Venda", "Nome Cliente", "Valor", "Categoria", "Forma de Pagamento", "Situação"];
    rows = filtered.map((i) => [
      i.date,
      i.saleCode,
      i.clientName,
      i.amountFormatted,
      i.category,
      i.method,
      i.status,
    ]);
  } else if (typeFilter === "despesa") {
    headers = ["Data", "Descrição da Transação", "Categoria", "Valor", "Forma de Pagamento", "Situação"];
    rows = filtered.map((i) => [
      i.date,
      i.description,
      i.category,
      i.amountFormatted,
      i.method,
      i.status,
    ]);
  } else {
    headers = [
      "Data",
      "Tipo",
      "Descrição / Cód. Venda",
      "Cliente / Favorecido",
      "Categoria",
      "Forma de Pagamento",
      "Valor",
      "Situação",
    ];
    rows = filtered.map((i) => [
      i.date,
      i.isIncome ? "Receita" : "Despesa",
      i.isIncome ? i.saleCode || i.description : i.description,
      i.isIncome ? i.clientName : i.supplierName || "—",
      i.category,
      i.method,
      (i.isIncome ? "+ " : "- ") + i.amountFormatted,
      i.status,
    ]);
  }

  const escapeCSV = (val: string) => `"${(val || "").replace(/"/g, '""')}"`;
  const headerLine = headers.map(escapeCSV).join(";");
  const rowLines = rows.map((r) => r.map(escapeCSV).join(";")).join("\n");

  return `\uFEFF${headerLine}\n${rowLines}`;
}

export interface ClientResolutionContext {
  clients?: any[];
  clientMap?: Map<string, any>;
  clientByNameMap?: Map<string, any>;
  sales?: any[];
  saleMap?: Map<string, any>;
  transactions?: any[];
  txBySaleIdMap?: Map<string, any>;
  txBySaleCodeMap?: Map<string, any>;
}

export interface ResolvedClientInfo {
  name: string;
  phone: string;
  isConsumidor: boolean;
}

/**
 * Constrói mapa indexado de transações pelo código da venda extraído de descrições e formatos conhecidos.
 */
export function buildTxBySaleCodeMap(transactions: any[]): Map<string, any> {
  const map = new Map<string, any>();
  transactions.forEach((tx: any) => {
    if (tx.description && typeof tx.description === "string") {
      // 1. Matches de marcadores de venda/código
      const matches = [
        ...tx.description.matchAll(/(?:#|•\s*|(?:Venda\s+#?)|(?:Venda\s+))([A-Za-z0-9_-]+)/gi)
      ];
      matches.forEach(m => {
        if (m[1]) {
          const code = m[1].toUpperCase().trim();
          if (!map.has(code)) map.set(code, tx);
        }
      });
      // 2. Matches de formato padrão V[0-9]{6,}[A-Za-z0-9]* (ex: V040826110856JC, V220826105653JS)
      const vCodes = [...tx.description.matchAll(/\b(V\d{6,}[A-Za-z0-9]*)\b/gi)];
      vCodes.forEach(vc => {
        if (vc[1]) {
          const code = vc[1].toUpperCase().trim();
          if (!map.has(code)) map.set(code, tx);
        }
      });
    }
  });
  return map;
}

/**
 * Constrói mapa de clientes indexado pelo nome normalizado em caixa baixa para buscas rápidas de telefone/contato.
 */
export function buildClientByNameMap(clients: any[]): Map<string, any> {
  const map = new Map<string, any>();
  clients.forEach((c: any) => {
    if (c?.name && isValidClientName(c.name)) {
      map.set(c.name.trim().toLowerCase(), c);
    }
  });
  return map;
}

/**
 * Resolução profunda e unificada de informações do cliente (Nome e Telefone)
 * para vendas, parcelas e relatórios em geral, evitando que clientes apareçam
 * genericamente como "Consumidor" ou "Consumidor Final".
 */
export function resolveSaleClientInfo(
  saleOrId: any,
  context: ClientResolutionContext,
  saleCodeFallback?: string,
  fallbackClientId?: string
): ResolvedClientInfo {
  let resolvedName = "";
  let resolvedPhone = "";

  // 1. Obter o objeto de venda (direto ou do saleMap/sales)
  let sale = typeof saleOrId === "object" && saleOrId !== null ? saleOrId : null;
  // Se o objeto for uma parcela que tem o join row.sales
  if (sale?.sales) {
    sale = Array.isArray(sale.sales) ? sale.sales[0] : sale.sales;
  }
  const saleId = (typeof saleOrId === "string" ? saleOrId : sale?.id || sale?.sale_id) || null;

  if (!sale && saleId) {
    sale = context.saleMap?.get(saleId) || (context.sales ? context.sales.find((s: any) => s.id === saleId) : null);
  }

  const effectiveCode = (sale?.sale_code || saleCodeFallback || "").toUpperCase().trim();
  if (!sale && effectiveCode && context.sales) {
    sale = context.sales.find((s: any) => (s.sale_code || "").toUpperCase() === effectiveCode);
  }

  // 2. Verificar cliente direto no objeto da venda (join clients)
  const directClient = sale ? (Array.isArray(sale.clients) ? sale.clients[0] : sale.clients) : null;
  if (directClient?.name && isValidClientName(directClient.name)) {
    resolvedName = directClient.name.trim();
    resolvedPhone = directClient.phone || "";
  }

  // 3. Verificar client_id da venda no clientMap ou clients array
  const effectiveClientId = sale?.client_id || fallbackClientId;
  if (!resolvedName && effectiveClientId) {
    const c = context.clientMap?.get(effectiveClientId) || (context.clients ? context.clients.find((cl: any) => cl.id === effectiveClientId) : null);
    if (c?.name && isValidClientName(c.name)) {
      resolvedName = c.name.trim();
      resolvedPhone = c.phone || "";
    }
  }

  // 4. Verificar client_name explícito na venda (se existir)
  if (!resolvedName && sale?.client_name && isValidClientName(sale.client_name)) {
    resolvedName = sale.client_name.trim();
  }

  // 5. Verificar transação vinculada por sale_id ou por sale_code
  let linkedTx = saleId ? context.txBySaleIdMap?.get(saleId) : null;
  if (!linkedTx && effectiveCode && context.txBySaleCodeMap) {
    linkedTx = context.txBySaleCodeMap.get(effectiveCode);
  }
  if (!linkedTx && saleId && context.transactions) {
    linkedTx = context.transactions.find((t: any) => t.sale_id === saleId);
  }
  if (!linkedTx && effectiveCode && context.transactions) {
    linkedTx = context.transactions.find((t: any) => t.description && t.description.toUpperCase().includes(effectiveCode));
  }

  if (linkedTx) {
    const txClient = Array.isArray(linkedTx.clients) ? linkedTx.clients[0] : linkedTx.clients;
    if (!resolvedName && txClient?.name && isValidClientName(txClient.name)) {
      resolvedName = txClient.name.trim();
      if (!resolvedPhone) resolvedPhone = txClient.phone || "";
    }
    if (!resolvedName && linkedTx.client_id) {
      const tc = context.clientMap?.get(linkedTx.client_id) || (context.clients ? context.clients.find((cl: any) => cl.id === linkedTx.client_id) : null);
      if (tc?.name && isValidClientName(tc.name)) {
        resolvedName = tc.name.trim();
        if (!resolvedPhone) resolvedPhone = tc.phone || "";
      }
    }
    if (!resolvedName && linkedTx.client_name && isValidClientName(linkedTx.client_name)) {
      resolvedName = linkedTx.client_name.trim();
    }
    if (!resolvedName && linkedTx.description) {
      const fromDesc = extractClientFromDescription(linkedTx.description);
      if (fromDesc) {
        resolvedName = fromDesc;
      }
    }
    if (!resolvedPhone && txClient?.phone) {
      resolvedPhone = txClient.phone;
    }
  }

  // 6. Verificar notas da venda (sale.notes) se ainda não encontrou
  if (!resolvedName && sale?.notes) {
    const fromNotes = extractClientFromDescription(sale.notes);
    if (fromNotes) resolvedName = fromNotes;
  }

  // 7. Se encontramos o nome mas ainda não temos o telefone, busca no cadastro de clientes
  if (resolvedName && (!resolvedPhone || resolvedPhone === "—")) {
    const lowerName = resolvedName.toLowerCase();
    const matched = context.clientByNameMap?.get(lowerName) || 
      (context.clients ? context.clients.find((c: any) => c.name && c.name.trim().toLowerCase() === lowerName) : null) ||
      (context.clients ? context.clients.find((c: any) => c.name && c.name.length >= 4 && (c.name.toLowerCase().includes(lowerName) || lowerName.includes(c.name.toLowerCase()))) : null);
    if (matched?.phone) {
      resolvedPhone = matched.phone;
    }
  }

  // 8. Se ainda não tem telefone e temos o cliente direto da venda
  if (!resolvedPhone && directClient?.phone) {
    resolvedPhone = directClient.phone;
  }

  const isConsumidor = !resolvedName;
  return {
    name: resolvedName || "Consumidor Final",
    phone: resolvedPhone || "—",
    isConsumidor,
  };
}

