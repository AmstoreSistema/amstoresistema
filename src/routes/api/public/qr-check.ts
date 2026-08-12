import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/qr-check')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url)
        const code = url.searchParams.get('code')

        if (!code) {
          return new Response('Código não fornecido', { status: 400 })
        }

        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')

        // Find sale by promo_qr
        const { data: sale, error: saleError } = await supabaseAdmin
          .from('sales')
          .select('id, is_awarded, promo_qr')
          .eq('promo_qr', code)
          .single()

        if (saleError || !sale) {
          return new Response(`
            <!DOCTYPE html>
            <html lang="pt-BR">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Promoção Amstore</title>
              <script src="https://cdn.tailwindcss.com"></script>
              <style>
                @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap');
                body { font-family: 'Courier Prime', monospace; background-color: #0A0A0B; color: #D4AF37; }
              </style>
            </head>
            <body class="flex items-center justify-center min-h-screen p-6">
              <div class="max-w-md w-full border-2 border-dashed border-[#D4AF37]/30 p-8 rounded-3xl text-center space-y-4">
                <div class="size-16 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg xmlns="http://www.w3.org/2000/svg" class="size-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                </div>
                <h1 class="text-2xl font-bold uppercase tracking-widest">Código Inválido</h1>
                <p class="text-gray-400">Este QR Code não foi encontrado em nosso sistema ou já expirou.</p>
                <div class="pt-6">
                  <button onclick="window.close()" class="bg-[#D4AF37] text-black font-bold py-3 px-8 rounded-xl uppercase tracking-wider hover:opacity-90 transition-opacity">Fechar</button>
                </div>
              </div>
            </body>
            </html>
          `, { headers: { 'Content-Type': 'text/html' } })
        }

        // Get promo config
        const { data: config } = await supabaseAdmin
          .from('qr_promo_config')
          .select('standard_message, awarded_message, awarded_positions')
          .single()

        const isAwarded = sale.is_awarded

        return new Response(`
          <!DOCTYPE html>
          <html lang="pt-BR">
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Resultado Promoção — Amstore</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              @import url('https://fonts.googleapis.com/css2?family=Courier+Prime:wght@400;700&display=swap');
              body { font-family: 'Courier Prime', monospace; background-color: #0A0A0B; color: #D4AF37; }
              .gold-gradient { background: linear-gradient(135deg, #D4AF37 0%, #F4D03F 50%, #D4AF37 100%); }
            </style>
          </head>
          <body class="flex items-center justify-center min-h-screen p-6">
            <div class="max-w-md w-full border-2 border-dashed border-[#D4AF37]/30 p-8 rounded-3xl text-center space-y-6 relative overflow-hidden">
              ${isAwarded ? '<div class="absolute -top-10 -right-10 size-32 gold-gradient blur-3xl opacity-20"></div>' : ''}
              
              <div class="space-y-2">
                <p class="text-[10px] uppercase tracking-[0.3em] text-gray-500">Amstore Bagshoes</p>
                <div class="h-px bg-dashed border-t border-[#D4AF37]/20 w-full my-4"></div>
              </div>

              ${isAwarded ? `
                <div class="size-24 gold-gradient text-black rounded-full flex items-center justify-center mx-auto mb-2 shadow-[0_0_30px_rgba(212,175,55,0.3)]">
                  <svg xmlns="http://www.w3.org/2000/svg" class="size-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
                </div>
                <h1 class="text-3xl font-bold uppercase tracking-widest text-white">Você Ganhou!</h1>
                <p class="text-lg leading-relaxed text-[#D4AF37] font-bold">
                  ${config?.awarded_message || 'PARABÉNS! Você foi sorteado! Apresente este código na loja.'}
                </p>
              ` : `
                <div class="size-20 bg-gray-500/10 text-gray-500 rounded-full flex items-center justify-center mx-auto mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" class="size-10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v10"/><path d="M18.42 15.61a8 8 0 1 1-12.84 0"/></svg>
                </div>
                <h1 class="text-xl font-bold uppercase tracking-widest opacity-80">Continue Tentando</h1>
                <p class="text-gray-400 text-sm italic">
                  ${config?.standard_message || 'Que pena! Continue comprando para concorrer.'}
                </p>
              `}

              <div class="space-y-4 pt-4">
                <div class="bg-white/5 p-4 rounded-xl border border-white/10">
                  <p class="text-[10px] text-gray-500 uppercase mb-1">Código de Verificação</p>
                  <p class="text-xl font-mono font-bold tracking-tighter text-white">${sale.promo_qr}</p>
                </div>
                
                <p class="text-[9px] text-gray-600 uppercase tracking-widest">
                  Verificado em ${new Date().toLocaleString('pt-BR')}
                </p>
              </div>

              <div class="pt-4">
                <button onclick="window.close()" class="w-full border border-[#D4AF37]/30 text-[#D4AF37] py-3 rounded-xl uppercase text-xs tracking-widest hover:bg-[#D4AF37]/10 transition-colors">Fechar</button>
              </div>
            </div>
          </body>
          </html>
        `, { headers: { 'Content-Type': 'text/html' } })
      }
    }
  }
})
