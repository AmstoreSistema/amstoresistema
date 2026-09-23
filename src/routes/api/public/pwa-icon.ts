import { createFileRoute } from "@tanstack/react-router";
import { getPwaIconBuffer, getServerPwaColors } from "@/lib/pwa-icons.server";

export const Route = createFileRoute('/api/public/pwa-icon')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);

          if (url.searchParams.get("audit") === "1") {
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

          const rawVariant = url.searchParams.get("variant") || url.searchParams.get("size") || "192";
          let variant: "192" | "512" | "192-maskable" | "512-maskable" | "apple-touch" = "192";

          if (rawVariant === "512") {
            variant = "512";
          } else if (
            rawVariant === "512-maskable" ||
            (rawVariant === "512" && url.searchParams.get("maskable") === "1")
          ) {
            variant = "512-maskable";
          } else if (
            rawVariant === "192-maskable" ||
            (rawVariant === "192" && url.searchParams.get("maskable") === "1")
          ) {
            variant = "192-maskable";
          } else if (
            rawVariant === "apple" ||
            rawVariant === "apple-touch" ||
            url.searchParams.get("apple") === "1"
          ) {
            variant = "apple-touch";
          }

          let color = url.searchParams.get("color") || url.searchParams.get("bg");
          const hasExplicitColor = Boolean(color);

          if (color) {
            color = color.trim();
            if (!color.startsWith("#")) color = `#${color}`;
          } else {
            const colors = await getServerPwaColors();
            color = colors.pwaBgHex;
          }

          const buf = getPwaIconBuffer(variant, color);

          return new Response(new Uint8Array(buf), {
            headers: {
              "Content-Type": "image/png",
              "Cache-Control":
                hasExplicitColor || url.searchParams.has("v")
                  ? "public, max-age=31536000, immutable"
                  : "public, max-age=60, must-revalidate",
            },
          });
        } catch (err) {
          console.error("[pwa-icon] Erro ao gerar ícone dinâmico do PWA:", err);
          return new Response("Erro ao gerar ícone", { status: 500 });
        }
      },
    },
  },
});
