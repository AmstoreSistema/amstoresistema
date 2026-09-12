const SUPABASE_URL = "https://ebooolaabwsuwmqhcqkv.supabase.co";
const SUPABASE_KEY = "sb_publishable_DJQXpWPvlKvYzLR9FiGDwA_2xsBbp0L";

async function run() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/transactions?select=type,amount,status,category,created_at,description,sale_id`, {
    headers: {
      'apikey': SUPABASE_KEY,
    }
  });
  if (!res.ok) {
    console.log("Error status:", res.status, await res.text());
    return;
  }
  const txs = await res.json();
  console.log("Fetched transactions count:", txs.length);

  let inflow = 0;
  let outflow = 0;
  let paidInflow = 0;
  let paidOutflow = 0;

  const typeMap = {};
  const statusMap = {};
  const categoryMap = {};
  const yearMonthMap = {};
  let saleIdCount = 0;

  for (const t of txs) {
    const amt = Number(t.amount || 0);
    const type = String(t.type || "").toLowerCase();
    const st = String(t.status || "").toLowerCase();
    const isIncome = type === 'entrada' || type === 'income';
    const isExpense = type === 'saida' || type === 'expense';
    const isPaid = ['pago', 'paid'].includes(st);

    typeMap[type] = (typeMap[type] || 0) + 1;
    statusMap[st] = (statusMap[st] || 0) + 1;
    categoryMap[t.category || "Nenhum"] = (categoryMap[t.category || "Nenhum"] || 0) + amt;

    const ym = (t.created_at || "sem-data").slice(0, 7);
    if (!yearMonthMap[ym]) yearMonthMap[ym] = { in: 0, out: 0, count: 0 };
    yearMonthMap[ym].count++;

    if (isIncome) {
      inflow += amt;
      if (isPaid) {
        paidInflow += amt;
        yearMonthMap[ym].in += amt;
      }
    } else if (isExpense) {
      outflow += Math.abs(amt);
      if (isPaid) {
        paidOutflow += Math.abs(amt);
        yearMonthMap[ym].out += Math.abs(amt);
      }
    }

    if (t.sale_id) saleIdCount++;
  }

  console.log("\n--- RESULTADO GERAL TRANSAÇÕES ---");
  console.log("Total geral entradas (todas):", inflow.toFixed(2));
  console.log("Total geral saídas (todas):", outflow.toFixed(2));
  console.log("Total PAGO entradas:", paidInflow.toFixed(2));
  console.log("Total PAGO saídas:", paidOutflow.toFixed(2));
  console.log("Saldo Real Pago:", (paidInflow - paidOutflow).toFixed(2));
  console.log("Transações vinculadas a sale_id:", saleIdCount, "de", txs.length);

  console.log("\n--- POR MÊS (Apenas Pagas) ---");
  console.table(yearMonthMap);

  console.log("\n--- POR CATEGORIA ---");
  console.table(categoryMap);
}

run().catch(console.error);
