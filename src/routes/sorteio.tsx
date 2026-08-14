import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Gift, Trophy, QrCode, XCircle, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { z } from "zod";

const sorteioSearchSchema = z.object({
  codigo: z.string().optional(),
});

export const Route = createFileRoute("/sorteio")({
  validateSearch: (search) => sorteioSearchSchema.parse(search),
  component: SorteioPage,
});

function SorteioPage() {
  const { codigo } = useSearch({ from: "/sorteio" });
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!codigo) {
      setError("Código não fornecido no link.");
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const response = await fetch(`/api/public/sorteio-info?code=${codigo}`);
        const json = await response.json();
        
        if (!response.ok) {
          setError(json.error || "Erro ao consultar código.");
        } else {
          setData(json);
        }
      } catch (err) {
        setError("Erro de conexão com o servidor.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [codigo]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0A0A0B] p-6 text-center">
        <Loader2 className="mb-4 size-12 animate-spin text-[#D4AF37]" />
        <p className="font-mono text-[#D4AF37] uppercase tracking-widest">Consultando sua surpresa...</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0A0A0B] p-6 font-mono text-[#D4AF37]">
      <div className="relative w-full max-w-md overflow-hidden rounded-[2.5rem] border-2 border-dashed border-[#D4AF37]/30 bg-[#121214] p-8 shadow-2xl">
        {data?.sale?.is_awarded && (
          <div className="absolute -right-10 -top-10 size-32 bg-[#D4AF37]/20 blur-3xl" />
        )}
        
        <div className="mb-8 text-center">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.4em] text-gray-500">Amstore Bagshoes</p>
          <div className="h-px w-full border-t border-dashed border-[#D4AF37]/20" />
        </div>

        {error ? (
          <div className="space-y-6 text-center">
            <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-red-500/10 text-red-500">
              <XCircle className="size-10" />
            </div>
            <h1 className="text-2xl font-black uppercase tracking-widest text-white">Ops!</h1>
            <p className="text-sm leading-relaxed text-gray-400">{error}</p>
            <Button 
              className="mt-4 w-full border border-[#D4AF37]/30 bg-transparent py-6 text-xs font-bold uppercase tracking-widest text-[#D4AF37] hover:bg-[#D4AF37]/10"
              onClick={() => window.location.href = 'https://amstoreloja.lovable.app'}
            >
              Voltar para a Loja
            </Button>
          </div>
        ) : (
          <div className="space-y-8 text-center">
            {data.sale.is_awarded ? (
              <>
                <div className="mx-auto flex size-24 items-center justify-center rounded-full bg-gradient-to-br from-[#D4AF37] to-[#F4D03F] text-black shadow-[0_0_30px_rgba(212,175,55,0.4)]">
                  <Trophy className="size-12" />
                </div>
                <div className="space-y-3">
                  <h1 className="text-3xl font-black uppercase tracking-[0.2em] text-white">Parabéns!</h1>
                  <p className="text-lg font-bold leading-relaxed text-[#D4AF37]">
                    {data.config.message}
                  </p>
                  {data.config.bonus_value && (
                    <div className="mt-4 inline-block rounded-xl bg-[#D4AF37] px-6 py-2 text-xl font-black text-black">
                      R$ {data.config.bonus_value.toFixed(2)}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="mx-auto flex size-20 items-center justify-center rounded-full bg-gray-500/10 text-gray-500">
                  <Gift className="size-10" />
                </div>
                <div className="space-y-3">
                  <h1 className="text-xl font-black uppercase tracking-widest opacity-80 text-white">Continue Tentando!</h1>
                  <p className="text-sm leading-relaxed text-gray-400">
                    {data.config.message}
                  </p>
                </div>
              </>
            )}

            <div className="space-y-4 pt-4">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <p className="mb-1 text-[10px] uppercase tracking-widest text-gray-500">Código da Venda</p>
                <p className="text-2xl font-black tracking-tighter text-white">{data.sale.promo_qr}</p>
              </div>
              
              <div className="flex items-center justify-center gap-2 text-[9px] uppercase tracking-widest text-gray-600">
                <QrCode className="size-3" />
                <span>Verificado em {new Date().toLocaleDateString('pt-BR')}</span>
              </div>
            </div>

            <Button 
              className="w-full bg-[#D4AF37] py-7 text-xs font-black uppercase tracking-widest text-black shadow-lg shadow-[#D4AF37]/20 hover:opacity-90"
              onClick={() => window.location.href = 'https://amstoreloja.lovable.app'}
            >
              Visitar nossa Loja <ArrowRight className="ml-2 size-4" />
            </Button>
          </div>
        )}

        <div className="mt-8 text-center opacity-30">
          <p className="text-[8px] uppercase tracking-[0.2em]">Amstore Gestão Inteligente © 2026</p>
        </div>
      </div>
    </div>
  );
}
