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

  // 2. Nome do Cliente - Busca minuciosa e resiliente em todas as fontes disponíveis
  let clientName = "";

  // 2.1. Diretamente no objeto/array clients vinculado à transação
  const directClient = Array.isArray(t.clients) ? t.clients[0] : t.clients;
  if (directClient?.name && typeof directClient.name === "string" && directClient.name.trim()) {
    clientName = directClient.name.trim();
  }

  // 2.2. Campo client_name diretamente na transação
  if (!clientName && t.client_name && typeof t.client_name === "string" && t.client_name.trim()) {
    clientName = t.client_name.trim();
  }

  // 2.3. No mapa de clientes usando t.client_id
  if (!clientName && t.client_id && clientMap?.has(t.client_id)) {
    const c = clientMap.get(t.client_id);
    if (c?.name && typeof c.name === "string" && c.name.trim()) {
      clientName = c.name.trim();
    }
  }

  // 2.4. Na venda aninhada (join t.sales)
  if (!clientName && tSale) {
    const saleClient = Array.isArray(tSale.clients) ? tSale.clients[0] : tSale.clients;
    if (saleClient?.name && typeof saleClient.name === "string" && saleClient.name.trim()) {
      clientName = saleClient.name.trim();
    } else if (tSale.client_id && clientMap?.has(tSale.client_id)) {
      const c = clientMap.get(tSale.client_id);
      if (c?.name && typeof c.name === "string" && c.name.trim()) {
        clientName = c.name.trim();
      }
    }
  }

  // 2.5. Na venda vinculada via saleMap usando t.sale_id
  if (!clientName && t.sale_id && saleMap?.has(t.sale_id)) {
    const linkedSale = saleMap.get(t.sale_id);
    const lClient = Array.isArray(linkedSale?.clients) ? linkedSale.clients[0] : linkedSale?.clients;
    if (lClient?.name && typeof lClient.name === "string" && lClient.name.trim()) {
      clientName = lClient.name.trim();
    } else if (linkedSale?.client_name && typeof linkedSale.client_name === "string" && linkedSale.client_name.trim()) {
      clientName = linkedSale.client_name.trim();
    } else if (linkedSale?.client_id && clientMap?.has(linkedSale.client_id)) {
      const c = clientMap.get(linkedSale.client_id);
      if (c?.name && typeof c.name === "string" && c.name.trim()) {
        clientName = c.name.trim();
      }
    }
  }

  // 2.6. No array de sales caso tenha sido passado no contexto
  if (!clientName && t.sale_id && context?.sales && Array.isArray(context.sales)) {
    const foundSale = context.sales.find((s: any) => s.id === t.sale_id);
    if (foundSale) {
      const fsClient = Array.isArray(foundSale.clients) ? foundSale.clients[0] : foundSale.clients;
      if (fsClient?.name && typeof fsClient.name === "string" && fsClient.name.trim()) {
        clientName = fsClient.name.trim();
      } else if (foundSale.client_id && clientMap?.has(foundSale.client_id)) {
        const c = clientMap.get(foundSale.client_id);
        if (c?.name && typeof c.name === "string" && c.name.trim()) {
          clientName = c.name.trim();
        }
      }
    }
  }

  // 2.7. Se ainda não encontrado, extrai da descrição:
  // Ex: "Venda #VEN-1234 - Maria Santos" ou "Pagamento Venda #10 - João Carlos (Parcela 1/2)"
  if (!clientName && t.description && typeof t.description === "string") {
    const dashMatch = t.description.match(/-\s*([^()]+?)(?:\s*\(.*|\s*$)/);
    if (dashMatch && dashMatch[1]) {
      const candidate = dashMatch[1].trim();
      // Não considerar termos comuns do sistema como nome de cliente
      if (candidate && !/^(venda|parcela|entrada|saída|taxa|pagamento|estorno)/i.test(candidate)) {
        clientName = candidate;
      }
    }
  }

  // 2.8. Se for receita de venda e não houver NENHUM dado ou cliente em nenhuma fonte:
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
      { key: "sale_code", label: "Código Venda", className: "whitespace-nowrap font-mono font-bold text-slate-900 w-[95px] print:w-[80px]" },
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
      { key: "type", label: "Tipo", align: "center", className: "whitespace-nowrap w-[52px] print:w-[44px]" },
      { key: "desc_code", label: "Descrição / Cód. Venda", className: "min-w-[120px]" },
      { key: "client_supplier", label: "Cliente / Favorecido", className: "min-w-[100px]" },
      { key: "category", label: "Categoria", align: "center", className: "whitespace-nowrap w-[60px] print:w-[48px]" },
      { key: "method", label: "Forma de Pagamento", className: "whitespace-nowrap w-[80px] print:w-[68px]" },
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

    const dateSpan = <span className="whitespace-nowrap">{item.date}</span>;
    const methodSpan = <span className="whitespace-nowrap">{item.method}</span>;
    const categorySpan = (
      <span
        className="block truncate max-w-[80px] print:max-w-[60px] text-[10.5px] print:text-[8px] font-semibold text-slate-700"
        title={item.category}
      >
        {item.category}
      </span>
    );

    const statusBadge = (
      <span
        className={`inline-flex items-center justify-center px-1.5 py-0.5 print:px-1 print:py-0 rounded text-[8.5px] print:text-[7.5px] font-black uppercase tracking-tighter whitespace-nowrap ${
          isPaid
            ? "bg-emerald-100 text-emerald-800 print:bg-emerald-50 print:text-emerald-900"
            : isPending
            ? "bg-amber-100 text-amber-800 print:bg-amber-50 print:text-amber-900"
            : "bg-rose-100 text-rose-800 print:bg-rose-50 print:text-rose-900"
        }`}
      >
        {item.status}
      </span>
    );

    const typeBadge = (
      <span
        className={`inline-flex items-center justify-center px-1.5 py-0.5 print:px-1 print:py-0 rounded text-[8.5px] print:text-[7.5px] font-black uppercase tracking-tighter whitespace-nowrap ${
          item.isIncome
            ? "bg-emerald-50 text-emerald-700 print:bg-emerald-50 print:text-emerald-900"
            : "bg-rose-50 text-rose-700 print:bg-rose-50 print:text-rose-900"
        }`}
      >
        {item.isIncome ? "Receita" : "Despesa"}
      </span>
    );

    const amountFormatted = (
      <span
        className={`font-black whitespace-nowrap font-mono text-xs print:text-[10px] tabular-nums tracking-tight ${
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
        sale_code: <span className="whitespace-nowrap font-mono font-bold text-slate-900">{item.saleCode}</span>,
        client_name: item.clientName,
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
        description: item.description,
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
      desc_code: item.isIncome ? (item.saleCode ? <span className="whitespace-nowrap font-mono font-bold">{item.saleCode}</span> : item.description) : item.description,
      client_supplier: item.isIncome ? item.clientName : (item.supplierName || "—"),
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
      { label: "Total Receitas (+)", value: brl(totalReceitas), helper: `${filtered.length} lançamentos de venda` },
      { label: "Receitas Pagas", value: pagasCount, helper: "Concluídas e compensadas" },
      { label: "Pendentes / A Receber", value: pendentesCount, helper: "Aguardando pagamento" }
    );
  } else if (typeFilter === "despesa") {
    summaryCards.push(
      { label: "Total Despesas (-)", value: brl(totalDespesas), helper: `${filtered.length} despesas e custos` },
      { label: "Despesas Quitadas", value: pagasCount, helper: "Pagas com comprovante" },
      { label: "Despesas Pendentes", value: pendentesCount, helper: "A pagar no vencimento" }
    );
  } else {
    const bal = totalReceitas - totalDespesas;
    summaryCards.push(
      { label: "Total Receitas (+)", value: brl(totalReceitas), helper: "Entradas financeiras" },
      { label: "Total Despesas (-)", value: brl(totalDespesas), helper: "Saídas e custos operacionais" },
      {
        label: "Resultado Líquido",
        value: brl(bal),
        helper: bal >= 0 ? "Superávit do período" : "Déficit do período",
      },
      { label: "Lançamentos", value: filtered.length, helper: `${pagasCount} pagos / ${pendentesCount} pendentes` }
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
