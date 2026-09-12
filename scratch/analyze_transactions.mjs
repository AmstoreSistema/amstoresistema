import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://ebooolaabwsuwmqhcqkv.supabase.co";
const SUPABASE_KEY = "sb_publishable_DJQXpWPvlKvYzLR9FiGDwA_2xsBbp0L";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log("Analyzing transactions in database...");

  // 1. Count and sum transactions
  const { data: txs, error: txError } = await supabase
    .from('transactions')
    .select('id, type, amount, status, category, description, created_at, sale_id, client_id, supplier_id, payment_method');

  if (txError) {
    console.error("Error fetching transactions:", txError);
    return;
  }

  console.log(`Total transactions count: ${txs.length}`);

  let totalIncome = 0;
  let totalExpense = 0;
  let paidIncome = 0;
  let paidExpense = 0;
  let withSaleId = 0;
  let withoutSaleId = 0;

  const categories = {};
  const statusCount = {};
  const typeCount = {};

  for (const t of txs) {
    const amt = Number(t.amount || 0);
    const type = String(t.type || "").toLowerCase();
    const st = String(t.status || "").toLowerCase();
    const isIncome = type === 'entrada' || type === 'income';
    const isExpense = type === 'saida' || type === 'expense';
    const isPaid = ['pago', 'paid'].includes(st);

    statusCount[st] = (statusCount[st] || 0) + 1;
    typeCount[type] = (typeCount[type] || 0) + 1;
    categories[t.category || "Sem categoria"] = (categories[t.category || "Sem categoria"] || 0) + amt;

    if (isIncome) {
      totalIncome += amt;
      if (isPaid) paidIncome += amt;
    } else if (isExpense) {
      totalExpense += Math.abs(amt);
      if (isPaid) paidExpense += Math.abs(amt);
    }

    if (t.sale_id) withSaleId++;
    else withoutSaleId++;
  }

  console.log("\n--- Transações Totais (Todos os status) ---");
  console.log(`Total Income: R$ ${totalIncome.toFixed(2)}`);
  console.log(`Total Expense: R$ ${totalExpense.toFixed(2)}`);
  console.log(`Saldo Teórico: R$ ${(totalIncome - totalExpense).toFixed(2)}`);

  console.log("\n--- Transações Pagas (status = pago/paid) ---");
  console.log(`Paid Income: R$ ${paidIncome.toFixed(2)}`);
  console.log(`Paid Expense: R$ ${paidExpense.toFixed(2)}`);
  console.log(`Saldo Real Pago: R$ ${(paidIncome - paidExpense).toFixed(2)}`);

  console.log("\n--- Tipos ---", typeCount);
  console.log("--- Status ---", statusCount);
  console.log(`With sale_id: ${withSaleId}, Without sale_id: ${withoutSaleId}`);

  // 2. Check Sales
  const { data: sales, error: sErr } = await supabase
    .from('sales')
    .select('id, total_amount, paid_amount, status, is_debt, created_at');

  if (sales) {
    const totalSalesAmount = sales.reduce((acc, s) => acc + Number(s.total_amount || 0), 0);
    const totalSalesPaid = sales.reduce((acc, s) => acc + Number(s.paid_amount || 0), 0);
    console.log(`\n--- Vendas (Total: ${sales.length}) ---`);
    console.log(`Soma Total Vendas: R$ ${totalSalesAmount.toFixed(2)}`);
    console.log(`Soma Total Pago Vendas: R$ ${totalSalesPaid.toFixed(2)}`);
  }

  // 3. Check Financial Accounts
  const { data: accounts } = await supabase.from('financial_accounts').select('*');
  console.log("\n--- Contas Financeiras ---", accounts);

  // 4. Breakdown by Year / Month
  const byMonth = {};
  for (const t of txs) {
    const m = (t.created_at || "sem_data").slice(0, 7);
    if (!byMonth[m]) byMonth[m] = { income: 0, expense: 0, count: 0 };
    const amt = Number(t.amount || 0);
    const type = String(t.type || "").toLowerCase();
    const isIncome = type === 'entrada' || type === 'income';
    const isExpense = type === 'saida' || type === 'expense';
    if (isIncome) byMonth[m].income += amt;
    if (isExpense) byMonth[m].expense += Math.abs(amt);
    byMonth[m].count++;
  }
  console.log("\n--- Por Mês/Ano ---", byMonth);
}

main().catch(console.error);
