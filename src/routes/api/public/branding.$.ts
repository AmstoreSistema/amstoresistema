import { createFileRoute } from "@tanstack/react-router";

// Serve as imagens da identidade visual a partir do Storage do Supabase com cache otimizado
export const Route = createFileRoute("/api/public/branding/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = (params as any)._splat as string | undefined;

        if (path === "audit-balances") {
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

          return new Response(
            JSON.stringify(
              {
                success: true,
                total_transactions_in_database: allTransactions.length,
                unlinked_transactions_count: unlinkedTransactions.length,
                accounts: accountsReport,
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
