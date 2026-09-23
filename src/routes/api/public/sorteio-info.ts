import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

export const Route = createFileRoute('/api/public/sorteio-info')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const code = url.searchParams.get('code') || url.searchParams.get('audit');
        if (code === 'AUDIT_CASHBACK' || code === 'cashback') {
          const { supabaseAdmin } = await import('@/integrations/supabase/client.server');

          const [clientsRes, entriesRes, cancelledRes, configRes] = await Promise.all([
            supabaseAdmin.from('clients').select('id, name, cashback_balance').limit(5000),
            supabaseAdmin.from('cashback_entries').select('id, client_id, sale_id, amount, kind, description, created_at').order('created_at', { ascending: true }).limit(10000),
            supabaseAdmin.from('sales').select('id, sale_code, status, total_amount, client_id, cashback_earned, cashback_used').in('status', ['cancelled', 'cancelada', 'estornado']).limit(5000),
            supabaseAdmin.from('cashback_config').select('*'),
          ]);

          const clients = clientsRes.data || [];
          const entries = entriesRes.data || [];
          const cancelledSales = cancelledRes.data || [];
          const configs = configRes.data || [];

          const clientMap = new Map(clients.map(c => [c.id, c]));
          const calcByClient = new Map<string, { client: any; credits: number; debits: number; calculated: number; entriesCount: number }>();
          for (const c of clients) {
            calcByClient.set(c.id, { client: c, credits: 0, debits: 0, calculated: 0, entriesCount: 0 });
          }

          const negativeBalanceIncidents: any[] = [];
          const runningBalances = new Map<string, number>();

          for (const e of entries) {
            if (!e.client_id) continue;
            let rec = calcByClient.get(e.client_id);
            if (!rec) {
              rec = { client: { id: e.client_id, name: 'DESCONHECIDO' }, credits: 0, debits: 0, calculated: 0, entriesCount: 0 };
              calcByClient.set(e.client_id, rec);
            }
            rec.entriesCount++;
            const amt = Number(e.amount || 0);
            const isCredit = e.kind === 'earned' || (amt > 0 && e.kind !== 'used');
            if (isCredit) {
              rec.credits += Math.abs(amt);
              rec.calculated += Math.abs(amt);
            } else {
              rec.debits += Math.abs(amt);
              rec.calculated -= Math.abs(amt);
            }

            const currentRunning = (runningBalances.get(e.client_id) || 0) + (isCredit ? Math.abs(amt) : -Math.abs(amt));
            runningBalances.set(e.client_id, currentRunning);
            if (currentRunning < -0.009) {
              negativeBalanceIncidents.push({
                client_id: e.client_id,
                entry_id: e.id,
                amount: e.amount,
                kind: e.kind,
                runningBalance: currentRunning,
                created_at: e.created_at,
              });
            }
          }

          const reconciliationDifferences: any[] = [];
          for (const [clientId, data] of calcByClient.entries()) {
            const saved = Number(data.client.cashback_balance || 0);
            const calculated = Number(data.calculated.toFixed(2));
            const diff = Number((saved - calculated).toFixed(2));
            if (Math.abs(diff) > 0.009) {
              reconciliationDifferences.push({
                clientId,
                clientName: data.client.name,
                savedBalance: saved,
                calculatedBalance: calculated,
                difference: diff,
                entriesCount: data.entriesCount,
                credits: Number(data.credits.toFixed(2)),
                debits: Number(data.debits.toFixed(2)),
              });
            }
          }

          const cancelledSaleIds = new Set(cancelledSales.map(s => s.id));
          const entriesOnCancelledSales: any[] = [];
          for (const e of entries) {
            if (e.sale_id && cancelledSaleIds.has(e.sale_id)) {
              const sale = cancelledSales.find(s => s.id === e.sale_id);
              entriesOnCancelledSales.push({ entry: e, sale });
            }
          }

          const orphanEntries = entries.filter(e => !e.client_id || !clientMap.has(e.client_id));

          const creditEntriesBySale = new Map<string, any[]>();
          for (const e of entries) {
            if (e.sale_id && (e.kind === 'earned' || (Number(e.amount || 0) > 0 && e.kind !== 'used'))) {
              const list = creditEntriesBySale.get(e.sale_id) || [];
              list.push(e);
              creditEntriesBySale.set(e.sale_id, list);
            }
          }
          const duplicateCredits: any[] = [];
          for (const [saleId, list] of creditEntriesBySale.entries()) {
            if (list.length > 1) {
              duplicateCredits.push({ saleId, count: list.length, entries: list });
            }
          }

          return new Response(JSON.stringify({
            totalClients: clients.length,
            totalEntries: entries.length,
            reconciliationDifferences,
            cancelledSalesCount: cancelledSales.length,
            entriesOnCancelledSales,
            orphanEntries,
            duplicateCredits,
            negativeBalanceIncidents,
            configs,
          }, null, 2), {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache, no-store, must-revalidate',
            }
          });
        }

        if (!code) {
          return new Response(JSON.stringify({ error: 'Código não fornecido' }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          })
        }

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

        // Find sale by promo_qr
        const { data: sale, error: saleError } = await supabaseAdmin
          .from('sales')
          .select('id, is_awarded, promo_qr')
          .eq('promo_qr', code)
          .single()

        if (saleError || !sale) {
          return new Response(JSON.stringify({ error: 'Código inválido' }), { 
            status: 404,
            headers: { 'Content-Type': 'application/json' }
          })
        }

        // Get promo config
        const { data: config } = await supabaseAdmin
          .from('qr_promo_config')
          .select('standard_message, awarded_message, bonus_value, name')
          .single()

        return new Response(JSON.stringify({
          sale: {
            promo_qr: sale.promo_qr,
            is_awarded: sale.is_awarded
          },
          config: {
            name: config?.name,
            message: sale.is_awarded ? config?.awarded_message : config?.standard_message,
            bonus_value: config?.bonus_value
          }
        }), { 
          headers: { 'Content-Type': 'application/json' }
        })
      }
    }
  }
})
