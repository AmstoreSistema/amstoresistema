import * as React from "react";
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

export function HeaderBrand() {
  const now = useNow();
  const { data: settings = [] } = useRows<any>("app_settings");

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
        .replace(",", ".,")
    : "";

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-0.5 py-1">
      <p className="font-display text-lg font-bold leading-none tracking-tight text-gold">
        {time}
      </p>
      <p className="text-[9px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
        {date}
      </p>
      <img
        src={storeLogo}
        alt="Amstore Bagshoes"
        className="mt-1 h-6 w-auto max-w-[140px] object-contain"
      />
      <p className="text-[8px] font-semibold uppercase tracking-[0.3em] text-muted-foreground">
        Gestão de Produção
      </p>
    </div>
  );
}
