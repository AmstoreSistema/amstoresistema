import { createFileRoute } from "@tanstack/react-router";

// Serve as imagens da identidade visual a partir do Storage do Supabase com cache otimizado
export const Route = createFileRoute("/api/public/branding/$")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const url = new URL(request.url);
        const path = (params as any)?._splat || (params as any)?._ || (params as any)?.['*'];

        if (url.pathname.includes("audit") || url.searchParams.has("audit") || path === "audit-balances") {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // 1. Busca todas as contas financeiras
          const { data: accounts, error: accErr } = await supabaseAdmin
            .from("financial_accounts")
            .select("*")
            .order("name", { ascending: true });

          if (accErr) {
            return new Response(JSON.stringify({ error: accErr.message }), {
              status: 500,
              headers: { "Content-Type": "application/json" }
            });
          }

          // 2. Busca todas as transações (com paginação)
          const allTransactions: any[] = [];
          let page = 0;
          const pageSize = 1000;
          while (true) {
            const { data: txs, error: txErr } = await supabaseAdmin
              .from("transactions")
              .select("id, account_id, type, amount, status, description, category, created_at")
              .range(page * pageSize, (page + 1) * pageSize - 1);

            if (txErr) {
              return new Response(JSON.stringify({ error: txErr.message }), {
                status: 500,
                headers: { "Content-Type": "application/json" }
              });
            }
            if (!txs || txs.length === 0) break;
            allTransactions.push(...txs);
            if (txs.length < pageSize) break;
            page++;
          }

          const knownAccountIds = new Set((accounts || []).map((a: any) => a.id));
          const unlinkedTransactions = allTransactions.filter(
            (t: any) => !t.account_id || !knownAccountIds.has(t.account_id)
          );

          const accountsReport = (accounts || []).map((acc: any) => {
            const accTxs = allTransactions.filter((t: any) => t.account_id === acc.id);

            let sumIncome = 0;
            let sumExpense = 0;
            let countIncome = 0;
            let countExpense = 0;
            let countPending = 0;
            let pendingAmount = 0;
            let countOther = 0;

            accTxs.forEach((t: any) => {
              const status = String(t.status || "").toLowerCase().trim();
              const isPaid = ["pago", "paid"].includes(status);
              const type = String(t.type || "").toLowerCase().trim();
              const rawAmt = Number(t.amount || 0);

              if (!isPaid) {
                countPending++;
                pendingAmount += Math.abs(rawAmt);
                return;
              }

              if (["income", "entrada"].includes(type)) {
                sumIncome += Math.abs(rawAmt);
                countIncome++;
              } else if (["expense", "saida"].includes(type)) {
                sumExpense += Math.abs(rawAmt);
                countExpense++;
              } else {
                countOther++;
              }
            });

            const initial = Number(acc.initial_balance || 0);
            const calculated = initial + sumIncome - sumExpense;
            const saved = Number(acc.current_balance || 0);
            const difference = calculated - saved;

            return {
              id: acc.id,
              name: acc.name,
              type: acc.type,
              active: acc.active,
              initial_balance: initial,
              sum_income: sumIncome,
              count_income: countIncome,
              sum_expense: sumExpense,
              count_expense: countExpense,
              calculated_balance: calculated,
              saved_current_balance: saved,
              difference: difference,
              has_divergence: Math.abs(difference) > 0.009,
              count_pending: countPending,
              pending_amount: pendingAmount,
              count_other: countOther,
              total_transactions: accTxs.length,
            };
          });

          // 3. Auditoria de Cashback
          const { data: clients = [] } = await supabaseAdmin
            .from("clients")
            .select("id, name, cashback_balance, phone")
            .limit(5000);

          const allCbEntries: any[] = [];
          let cbPage = 0;
          const cbPageSize = 1000;
          let cbEntriesError: string | null = null;
          while (true) {
            const { data: ents, error: entsErr } = await supabaseAdmin
              .from("cashback_entries")
              .select("*")
              .range(cbPage * cbPageSize, (cbPage + 1) * cbPageSize - 1);

            if (entsErr) {
              cbEntriesError = entsErr.message;
              break;
            }
            if (!ents || ents.length === 0) break;
            allCbEntries.push(...ents);
            if (ents.length < cbPageSize) break;
            cbPage++;
          }

          const { data: cancelledSales = [] } = await supabaseAdmin
            .from("sales")
            .select("id, sale_code, status, total_amount, client_id, cashback_earned, cashback_used, created_at")
            .in("status", ["cancelled", "cancelada", "estornado"])
            .limit(5000);

          const { data: configs = [] } = await supabaseAdmin
            .from("cashback_config")
            .select("*");

          const clientMap = new Map((clients || []).map((c: any) => [c.id, c]));

          const clientStatsMap = new Map<string, {
            client: any;
            credits: number;
            debits: number;
            calculated: number;
            entriesCount: number;
          }>();

          for (const c of (clients || [])) {
            clientStatsMap.set(c.id, {
              client: c,
              credits: 0,
              debits: 0,
              calculated: 0,
              entriesCount: 0,
            });
          }

          const negativeBalanceIncidents: any[] = [];
          const runningBalances = new Map<string, number>();

          const sortedCbEntries = [...allCbEntries].sort((a, b) => {
            const da = new Date(a.created_at || 0).getTime();
            const db = new Date(b.created_at || 0).getTime();
            return da - db;
          });

          for (const e of sortedCbEntries) {
            if (!e.client_id) continue;
            let rec = clientStatsMap.get(e.client_id);
            if (!rec) {
              rec = {
                client: { id: e.client_id, name: "CLIENTE EXCLUÍDO (" + String(e.client_id).slice(0, 8) + ")", cashback_balance: 0 },
                credits: 0,
                debits: 0,
                calculated: 0,
                entriesCount: 0,
              };
              clientStatsMap.set(e.client_id, rec);
            }
            rec.entriesCount++;

            const rawAmt = Number(e.amount || 0);
            const kind = String(e.kind || "").toLowerCase().trim();
            const isDebit = kind === "used" || kind === "debito" || kind === "debit" || rawAmt < 0;
            const absAmt = Math.abs(rawAmt);

            if (isDebit) {
              rec.debits += absAmt;
              rec.calculated -= absAmt;
            } else {
              rec.credits += absAmt;
              rec.calculated += absAmt;
            }

            const currentRunning = (runningBalances.get(e.client_id) || 0) + (isDebit ? -absAmt : absAmt);
            runningBalances.set(e.client_id, currentRunning);
            if (currentRunning < -0.009) {
              negativeBalanceIncidents.push({
                client_id: e.client_id,
                client_name: rec.client.name,
                entry_id: e.id,
                amount: e.amount,
                kind: e.kind,
                running_balance: Number(currentRunning.toFixed(2)),
                created_at: e.created_at,
              });
            }
          }

          const reconciliationDivergences: any[] = [];
          for (const [clientId, data] of clientStatsMap.entries()) {
            const saved = Number(data.client.cashback_balance || 0);
            const calculated = Number(data.calculated.toFixed(2));
            const difference = Number((calculated - saved).toFixed(2));
            if (Math.abs(difference) > 0.009) {
              reconciliationDivergences.push({
                client_id: clientId,
                client_name: data.client.name,
                phone: data.client.phone,
                calculated_balance: calculated,
                saved_balance: saved,
                difference: difference,
                total_credits: Number(data.credits.toFixed(2)),
                total_debits: Number(data.debits.toFixed(2)),
                entries_count: data.entriesCount,
              });
            }
          }

          const cancelledSaleIds = new Set((cancelledSales || []).map((s: any) => s.id));
          const entriesOnCancelledSales: any[] = [];
          for (const e of allCbEntries) {
            if (e.sale_id && cancelledSaleIds.has(e.sale_id)) {
              const sale = (cancelledSales || []).find((s: any) => s.id === e.sale_id);
              entriesOnCancelledSales.push({
                entry_id: e.id,
                sale_id: e.sale_id,
                sale_code: sale?.sale_code,
                client_id: e.client_id,
                client_name: clientMap.get(e.client_id)?.name || "N/A",
                amount: e.amount,
                kind: e.kind,
                sale_status: sale?.status,
                sale_total: sale?.total_amount,
                created_at: e.created_at,
              });
            }
          }

          const orphanEntries: any[] = [];
          for (const e of allCbEntries) {
            if (!e.client_id) {
              orphanEntries.push({ reason: "CLIENT_ID_NULL", entry: e });
            } else if (!clientMap.has(e.client_id)) {
              orphanEntries.push({ reason: "CLIENTE_NAO_EXISTE", entry: e });
            }
          }

          const creditsBySale = new Map<string, any[]>();
          for (const e of allCbEntries) {
            const rawAmt = Number(e.amount || 0);
            const kind = String(e.kind || "").toLowerCase().trim();
            const isCredit = kind === "earned" || (!["used", "debito", "debit"].includes(kind) && rawAmt > 0);
            if (e.sale_id && isCredit) {
              const list = creditsBySale.get(e.sale_id) || [];
              list.push(e);
              creditsBySale.set(e.sale_id, list);
            }
          }
          const duplicateCredits: any[] = [];
          for (const [saleId, list] of creditsBySale.entries()) {
            if (list.length > 1) {
              duplicateCredits.push({
                sale_id: saleId,
                credits_count: list.length,
                total_credited: list.reduce((sum, item) => sum + Number(item.amount || 0), 0),
                entries: list,
              });
            }
          }

          const totalCirculatingBalance = (clients || []).reduce((s: number, c: any) => s + Number(c.cashback_balance || 0), 0);
          const clientsWithPositiveBalance = (clients || []).filter((c: any) => Number(c.cashback_balance || 0) > 0).length;

          return new Response(
            JSON.stringify(
              {
                success: true,
                total_transactions_in_database: allTransactions.length,
                unlinked_transactions_count: unlinkedTransactions.length,
                accounts: accountsReport,
                cashback_audit: {
                  entries_error: cbEntriesError,
                  total_clients: (clients || []).length,
                  clients_with_balance: clientsWithPositiveBalance,
                  total_circulating_balance: Number(totalCirculatingBalance.toFixed(2)),
                  total_entries: allCbEntries.length,
                  reconciliation_divergences_count: reconciliationDivergences.length,
                  reconciliation_divergences: reconciliationDivergences.slice(0, 50),
                  cancelled_sales_with_cashback_count: entriesOnCancelledSales.length,
                  cancelled_sales_with_cashback: entriesOnCancelledSales.slice(0, 30),
                  orphan_entries_count: orphanEntries.length,
                  orphan_entries: orphanEntries.slice(0, 30),
                  duplicate_credits_count: duplicateCredits.length,
                  duplicate_credits: duplicateCredits.slice(0, 30),
                  negative_balance_incidents_count: negativeBalanceIncidents.length,
                  negative_balance_incidents_sample: negativeBalanceIncidents.slice(0, 20),
                  configs: configs,
                }
              },
              null,
              2
            ),
            {
              headers: {
                "Content-Type": "application/json",
                "Cache-Control": "no-cache, no-store, must-revalidate",
              },
            }
          );
        }

        if (!path || path.includes("..")) {
          return new Response("Not found", { status: 404 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let { data, error } = await supabaseAdmin.storage.from("branding").download(path);

        if (error || !data) {
          const res = await supabaseAdmin.storage.from("catalog-images").download(`branding/${path}`);
          data = res.data;
          error = res.error;
        }

        if (error || !data) {
          return new Response("Not found", { status: 404 });
        }

        const buf = await data.arrayBuffer();
        return new Response(buf, {
          headers: {
            "Content-Type": data.type || "image/png",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
