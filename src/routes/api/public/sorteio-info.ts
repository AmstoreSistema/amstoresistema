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
