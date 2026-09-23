import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

export const Route = createFileRoute('/api/public/sorteio-info')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const code = url.searchParams.get('code')

        if (!code) {
          return new Response(JSON.stringify({ error: 'Código não fornecido' }), { 
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          })
        }

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

        if (code === 'AUDIT_BALANCES') {
          // 1. Busca todas as contas
          const { data: accounts, error: accErr } = await supabaseAdmin
            .from('financial_accounts')
            .select('*')
            .order('name', { ascending: true })

          if (accErr) {
            return new Response(JSON.stringify({ error: accErr.message }), {
              status: 500,
              headers: { 'Content-Type': 'application/json' }
            })
          }

          // 2. Busca todas as transações com paginação
          const allTransactions: any[] = []
          let page = 0
          const pageSize = 1000
          while (true) {
            const { data: txs, error: txErr } = await supabaseAdmin
              .from('transactions')
              .select('id, account_id, type, amount, status, description, category, created_at')
              .range(page * pageSize, (page + 1) * pageSize - 1)

            if (txErr) {
              return new Response(JSON.stringify({ error: txErr.message }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
              })
            }
            if (!txs || txs.length === 0) break
            allTransactions.push(...txs)
            if (txs.length < pageSize) break
            page++
          }

          const knownAccountIds = new Set((accounts || []).map((a: any) => a.id))
          const unlinkedTransactions = allTransactions.filter(
            (t: any) => !t.account_id || !knownAccountIds.has(t.account_id)
          )

          const accountsReport = (accounts || []).map((acc: any) => {
            const accTxs = allTransactions.filter((t: any) => t.account_id === acc.id)

            let sumIncome = 0
            let sumExpense = 0
            let countIncome = 0
            let countExpense = 0
            let countPending = 0
            let pendingAmount = 0
            let countOther = 0

            accTxs.forEach((t: any) => {
              const status = String(t.status || '').toLowerCase().trim()
              const isPaid = ['pago', 'paid'].includes(status)
              const type = String(t.type || '').toLowerCase().trim()
              const rawAmt = Number(t.amount || 0)

              if (!isPaid) {
                countPending++
                pendingAmount += Math.abs(rawAmt)
                return
              }

              if (['income', 'entrada'].includes(type)) {
                sumIncome += Math.abs(rawAmt)
                countIncome++
              } else if (['expense', 'saida'].includes(type)) {
                sumExpense += Math.abs(rawAmt)
                countExpense++
              } else {
                countOther++
              }
            })

            const initial = Number(acc.initial_balance || 0)
            const calculated = initial + sumIncome - sumExpense
            const saved = Number(acc.current_balance || 0)
            const difference = calculated - saved

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
              total_transactions: accTxs.length
            }
          })

          return new Response(JSON.stringify({
            success: true,
            total_transactions: allTransactions.length,
            unlinked_transactions_count: unlinkedTransactions.length,
            accounts: accountsReport
          }, null, 2), {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'no-cache, no-store, must-revalidate'
            }
          })
        }

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
