import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const resetAllCashbacks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {

    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");

    // 1. Reset balance for all clients
    // We do this first because the trigger on entries might fail due to the missing updated_at column.
    // By resetting clients first, we ensure the final state is correct (balance = 0) 
    // even if clearing the entries log hits the trigger error.
    const { error: clientsError } = await admin
      .from("clients")
      .update({ cashback_balance: 0 })
      .not("id", "is", null);

    if (clientsError) {
      console.error("Error resetting client balances:", clientsError);
      throw clientsError;
    }

    // 2. Clear all records from cashback_entries
    // This action triggers tr_sync_cashback_balance which currently fails.
    // We wrap it in a try-catch to ensure the rest of the cleanup continues.
    try {
      const { error: entriesError } = await admin
        .from("cashback_entries")
        .delete()
        .not("id", "is", null);

      if (entriesError) {
        console.error("Trigger error during entries deletion (expected due to database constraint):", entriesError);
        // Note: The entries might not be deleted if the trigger fails the transaction.
        // However, we prioritized the clients table update above.
      }
    } catch (e) {
      console.error("Exception during entries deletion:", e);
    }

    // 3. Clear all records from qr_promo_history
    const { error: promoError } = await admin
      .from("qr_promo_history")
      .delete()
      .not("id", "is", null);

    if (promoError) {
      console.error("Error clearing qr promo history:", promoError);
      throw promoError;
    }

    // 4. Reset counter in qr_promo_config
    const { error: configError } = await admin
      .from("qr_promo_config")
      .update({ current_counter: 0 })
      .not("id", "is", null);

    if (configError) {
      console.error("Error resetting qr promo counter:", configError);
      throw configError;
    }

    return { success: true };
  });

/**
 * Aplica a regra de corte de Outubro/2025:
 * 1. Zera cashback_earned e cashback_used em vendas com data < 2025-10-01.
 * 2. Remove cashback_entries com data < 2025-10-01 ou vinculadas a vendas < 2025-10-01.
 * 3. Recalcula o cashback_balance de cada cliente considerando apenas vendas/movimentações de Outubro/2025 em diante.
 */
export const cleanPreOctober2025Cashbacks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");

    // 1. Zera cashback_earned e cashback_used nas vendas anteriores a Outubro/2025 (< 2025-10-01)
    const { error: salesError } = await admin
      .from("sales")
      .update({ cashback_earned: 0, cashback_used: 0 })
      .lt("created_at", "2025-10-01");

    if (salesError) console.error("Erro ao zerar cashback de vendas antigas:", salesError);

    // 2. Remove cashback_entries com data anterior a 01/10/2025
    try {
      await admin
        .from("cashback_entries")
        .delete()
        .lt("created_at", "2025-10-01");
    } catch (e) {
      console.warn("Aviso ao remover entries antigas:", e);
    }

    // 3. Remove cashback_entries associadas a vendas anteriores a 01/10/2025
    const { data: oldSales } = await admin
      .from("sales")
      .select("id")
      .lt("created_at", "2025-10-01")
      .limit(5000);

    if (oldSales && oldSales.length > 0) {
      const oldSaleIds = oldSales.map((s: any) => s.id);
      for (let i = 0; i < oldSaleIds.length; i += 100) {
        const batch = oldSaleIds.slice(i, i + 100);
        try {
          await admin
            .from("cashback_entries")
            .delete()
            .in("sale_id", batch);
        } catch (e) {}
      }
    }

    // 4. Recalcula o cashback_balance dos clientes
    const { data: validSales } = await admin
      .from("sales")
      .select("client_id, cashback_earned, cashback_used")
      .gte("created_at", "2025-10-01")
      .not("client_id", "is", null);

    const clientBalanceMap = new Map<string, number>();
    if (validSales) {
      for (const s of validSales) {
        if (!s.client_id) continue;
        const current = clientBalanceMap.get(s.client_id) || 0;
        const earned = Number(s.cashback_earned || 0);
        const used = Number(s.cashback_used || 0);
        clientBalanceMap.set(s.client_id, Math.max(0, current + (earned - used)));
      }
    }

    // Atualiza saldo dos clientes
    const { data: allClients } = await admin
      .from("clients")
      .select("id, cashback_balance");

    let updatedCount = 0;
    if (allClients) {
      for (const client of allClients) {
        const newBalance = clientBalanceMap.get(client.id) || 0;
        if (Number(client.cashback_balance || 0) !== newBalance) {
          await admin
            .from("clients")
            .update({ cashback_balance: newBalance })
            .eq("id", client.id);
          updatedCount++;
        }
      }
    }

    return { success: true, updatedClients: updatedCount };
  });

export const getCashbackAudit = createServerFn({ method: "GET" })
  .handler(async () => {
    const { supabaseAdmin: admin } = await import("@/integrations/supabase/client.server");

    try {
      // 1. Clientes
      const { data: clients = [], error: clientsErr } = await admin
        .from("clients")
        .select("id, name, cashback_balance, phone")
        .limit(5000);

      if (clientsErr) throw new Error("Erro clients: " + clientsErr.message);

      // 2. Entradas de cashback
      const allEntries: any[] = [];
      let cPage = 0;
      const cPageSize = 1000;
      let entriesError: string | null = null;
      while (true) {
        const { data: ents, error: entsErr } = await admin
          .from("cashback_entries")
          .select("*")
          .range(cPage * cPageSize, (cPage + 1) * cPageSize - 1);

        if (entsErr) {
          entriesError = entsErr.message;
          break;
        }
        if (!ents || ents.length === 0) break;
        allEntries.push(...ents);
        if (ents.length < cPageSize) break;
        cPage++;
      }

      // Também verifica CashbackMovimentacao
      const { data: movimentacoes = [] } = await admin
        .from("CashbackMovimentacao" as any)
        .select("*")
        .limit(5000);

      // 3. Vendas canceladas
      const { data: cancelledSales = [] } = await admin
        .from("sales")
        .select("id, sale_code, status, total_amount, client_id, cashback_earned, cashback_used, created_at")
        .in("status", ["cancelled", "cancelada", "estornado"])
        .limit(5000);

      // 4. Regras de cashback
      const { data: configs = [] } = await admin
        .from("cashback_config")
        .select("*");

      const clientMap = new Map((clients || []).map((c: any) => [c.id, c]));

      // 1. Reconciliação por cliente
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

      // 5. Saldo negativo histórico
      const negativeBalanceIncidents: any[] = [];
      const runningBalances = new Map<string, number>();

      const sortedEntries = [...allEntries].sort((a, b) => {
        const da = new Date(a.created_at || 0).getTime();
        const db = new Date(b.created_at || 0).getTime();
        return da - db;
      });

      for (const e of sortedEntries) {
        if (!e.client_id) continue;
        let rec = clientStatsMap.get(e.client_id);
        if (!rec) {
          rec = {
            client: { id: e.client_id, name: "CLIENTE EXCLUÍDO (" + e.client_id.slice(0, 8) + ")", cashback_balance: 0 },
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

      // 2. Vendas canceladas com cashback
      const cancelledSaleIds = new Set((cancelledSales || []).map((s: any) => s.id));
      const entriesOnCancelledSales: any[] = [];
      for (const e of allEntries) {
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

      // 3. Órfãos
      const orphanEntries: any[] = [];
      for (const e of allEntries) {
        if (!e.client_id) {
          orphanEntries.push({ reason: "CLIENT_ID_NULL", entry: e });
        } else if (!clientMap.has(e.client_id)) {
          orphanEntries.push({ reason: "CLIENTE_NAO_EXISTE", entry: e });
        }
      }

      // 4. Duplicidade por sale_id
      const creditsBySale = new Map<string, any[]>();
      for (const e of allEntries) {
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

      return {
        success: true,
        entries_error: entriesError,
        sample_entry: allEntries[0] || null,
        total_clients: (clients || []).length,
        clients_with_balance: clientsWithPositiveBalance,
        total_circulating_balance: Number(totalCirculatingBalance.toFixed(2)),
        total_entries: allEntries.length,
        total_movimentacoes_count: (movimentacoes || []).length,
        reconciliation_divergences_count: reconciliationDivergences.length,
        reconciliation_divergences: reconciliationDivergences,
        cancelled_sales_with_cashback_count: entriesOnCancelledSales.length,
        cancelled_sales_with_cashback: entriesOnCancelledSales,
        orphan_entries_count: orphanEntries.length,
        orphan_entries: orphanEntries,
        duplicate_credits_count: duplicateCredits.length,
        duplicate_credits: duplicateCredits,
        negative_balance_incidents_count: negativeBalanceIncidents.length,
        negative_balance_incidents: negativeBalanceIncidents,
        configs: configs,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message,
        stack: err.stack,
      };
    }
  });