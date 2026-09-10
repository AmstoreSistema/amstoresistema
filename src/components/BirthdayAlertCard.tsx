import { useState, useEffect, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { X, Gift, Sparkles, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRows } from "@/lib/data";
import {
  filterBirthdaysToday,
  isWithinDisplayHours,
  hasAlreadyShownToday,
  markAsShownToday,
} from "@/lib/birthdays";

interface BirthdayAlertCardProps {
  forceVisible?: boolean;
}

export function BirthdayAlertCard({ forceVisible = false }: BirthdayAlertCardProps) {
  const [dismissed, setDismissed] = useState(false);
  const [canShow, setCanShow] = useState(false);

  const { data: clients = [], isLoading } = useRows<any>("clients", {
    order: { column: "name", ascending: true },
  });

  const birthdaysToday = useMemo(() => filterBirthdaysToday(clients), [clients]);

  useEffect(() => {
    if (isLoading) return;

    if (forceVisible) {
      setCanShow(true);
      return;
    }

    // Regras de exibição: entre 09:00 e 18:00, apenas 1x por dia se houver aniversariantes
    const inHours = isWithinDisplayHours();
    const alreadyShown = hasAlreadyShownToday();

    if (inHours && !alreadyShown && birthdaysToday.length > 0) {
      setCanShow(true);
      // Salva no localStorage para não mostrar novamente hoje
      markAsShownToday();
    }
  }, [isLoading, birthdaysToday.length, forceVisible]);

  const handleClose = () => {
    markAsShownToday();
    setDismissed(true);
  };

  if (isLoading || dismissed || !canShow || birthdaysToday.length === 0) {
    return null;
  }

  return (
    <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border-2 border-pink-400/90 bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-700 p-4 sm:p-6 text-white shadow-2xl shadow-pink-500/20 transition-all duration-500 animate-in fade-in slide-in-from-top-4">
      {/* Elementos decorativos de fundo */}
      <div className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full bg-white/10 blur-2xl" />
      <div className="pointer-events-none absolute -left-12 -bottom-12 size-48 rounded-full bg-pink-400/20 blur-2xl" />

      {/* Botão Fechar X */}
      <button
        type="button"
        onClick={handleClose}
        className="absolute right-2 top-2 sm:right-4 sm:top-4 rounded-full p-1.5 sm:p-2 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
        title="Fechar alerta"
      >
        <X className="size-4 sm:size-5" />
      </button>

      <div className="relative space-y-3 sm:space-y-4">
        {/* Cabeçalho */}
        <div className="flex items-center gap-2.5 sm:gap-3 pr-8 sm:pr-10">
          <span className="text-2xl sm:text-3xl select-none" role="img" aria-label="bolo">
            🎂
          </span>
          <div>
            <h3 className="font-display text-base font-black tracking-tight sm:text-2xl text-white drop-shadow-sm flex items-center gap-1.5 sm:gap-2">
              🎉 Aniversariantes de Hoje! 🎂
            </h3>
            <p className="text-[11px] sm:text-xs text-white/85 font-medium leading-tight sm:leading-normal">
              {birthdaysToday.length === 1
                ? "1 cliente comemorando aniversário hoje! Deseje felicitações e envie um carinho da loja."
                : `${birthdaysToday.length} clientes comemorando aniversário hoje! Deseje felicitações.`}
            </p>
          </div>
        </div>

        {/* Lista de aniversariantes */}
        <div className="grid gap-2 sm:gap-2.5 sm:grid-cols-2 lg:grid-cols-3 pt-1">
          {birthdaysToday.map((client) => {
            const name = client.name || client.nome || "Cliente";
            const phone = client.phone || client.telefone;

            return (
              <div
                key={client.id}
                className="flex items-center justify-between gap-2.5 sm:gap-3 rounded-xl sm:rounded-2xl border border-white/20 bg-white/15 p-2.5 sm:p-3.5 backdrop-blur-md transition-all hover:bg-white/25 hover:shadow-md"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs sm:text-sm font-bold text-white tracking-tight">
                    {name}
                  </p>
                  {phone ? (
                    <p className="text-[11px] sm:text-xs text-white/90 flex items-center gap-1 font-medium mt-0.5">
                      <span>📱</span> {phone}
                    </p>
                  ) : (
                    <p className="text-[10px] sm:text-[11px] text-white/70 italic mt-0.5">
                      Sem telefone cadastrado
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-lg sm:text-xl select-none" title="Aniversariante do dia">
                  🎁
                </div>
              </div>
            );
          })}
        </div>

        {/* Rodapé com Botões de Ação */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 pt-1 sm:pt-2">
          <Button
            asChild
            className="w-full sm:w-auto h-9 sm:h-10 rounded-xl bg-white text-purple-700 font-bold hover:bg-white/90 shadow-md gap-2 text-xs sm:text-sm"
          >
            <Link to="/aniversariantes">
              <Sparkles className="size-3.5 sm:size-4 text-pink-500" />
              Criar Cartão & Enviar
            </Link>
          </Button>

          <Button
            asChild
            className="w-full sm:w-auto h-9 sm:h-10 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white font-bold border border-white/30 hover:brightness-110 shadow-md gap-2 text-xs sm:text-sm"
          >
            <Link to="/clients">
              Ver Clientes
              <ExternalLink className="size-3.5 sm:size-4" />
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
