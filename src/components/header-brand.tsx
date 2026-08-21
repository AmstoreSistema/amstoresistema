import * as React from "react";
import { Store } from "lucide-react";
import { useRows } from "@/lib/data";
import logoAsset from "@/assets/store-logo.png.asset.json";

function useNow() {
  const [now, setNow] = React.useState<Date | null>(null);
  React.useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000 * 20);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** Bloco de marca exibido no topo do menu lateral: hora, data e logomarca. */
export function HeaderBrand() {
  const now = useNow();
  const { data: settings = [] } = useRows<any>("app_settings");
  const [broken, setBroken] = React.useState(false);

  const storeLogo = React.useMemo(() => {
    const setting = settings.find((s: any) => s.key === "store_logo");
    if (!setting?.value) return logoAsset.url;
    try {
      return JSON.parse(setting.value) || logoAsset.url;
    } catch {
      return setting.value || logoAsset.url;
    }
  }, [settings]);

  const time = now
    ? now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "--:--";
  const date = now
    ? now
        .toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" })
        .toUpperCase()
    : "";

  return (
    <div className="flex flex-col items-center gap-1 px-2 py-3">
      <p className="font-display text-xl font-bold leading-none tracking-tight text-gold">
        {time}
      </p>
      <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-sidebar-foreground/50">
        {date}
      </p>
      {storeLogo && !broken ? (
        <img
          src={storeLogo}
          alt="Amstore Bagshoes"
          onError={() => setBroken(true)}
          className="mt-2 h-10 w-auto max-w-[150px] object-contain"
        />
      ) : (
        <div className="mt-2 flex items-center gap-2">
          <Store className="size-5 text-gold" />
          <span className="font-display text-sm font-bold text-sidebar-foreground">
            Amstore
          </span>
        </div>
      )}
      <p className="text-[8px] font-semibold uppercase tracking-[0.28em] text-sidebar-foreground/45">
        Gestão de Produção
      </p>
    </div>
  );
}
