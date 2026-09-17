import { createFileRoute } from "@tanstack/react-router";
import { getAppearance, appearanceHash, NO_STORE_HEADERS } from "@/lib/appearance.server";

export const Route = createFileRoute("/manifest.json")({
  server: {
    handlers: {
      GET: async () => {
        const appearance = await getAppearance();
        const v = appearanceHash(appearance);
        const name = appearance.site_name || "Amstore Bagshoes";
        const shortName = "Amstore";

        let pwaBgColor = appearance.splash_bg || "#D4AF37";
        let pwaThemeColor = appearance.splash_bg || "#D4AF37";
        let pwaIconUrl: string | null = null;
        let pwaTime: number | string = v;

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          try {
            const { data: colorRow } = await supabaseAdmin
              .from("app_settings")
              .select("value")
              .eq("key", "branding_colors")
              .maybeSingle();

            if (colorRow?.value) {
              const parsed = typeof colorRow.value === "string" ? JSON.parse(colorRow.value) : colorRow.value;
              if (parsed.pwa_bg_color) pwaBgColor = parsed.pwa_bg_color;
              if (parsed.pwa_theme_color) pwaThemeColor = parsed.pwa_theme_color;
            }
          } catch {}

          try {
            const { data } = await supabaseAdmin
              .from("system_branding")
              .select("key, file_url, updated_at")
              .in("key", ["pwa_icon", "app_icon"]);

            const pwa =
              data?.find((d: any) => d.key === "pwa_icon" && d.file_url) ||
              data?.find((d: any) => d.key === "app_icon" && d.file_url);

            if (pwa?.file_url) {
              pwaIconUrl = pwa.file_url;
              if (pwa.updated_at) pwaTime = new Date(pwa.updated_at).getTime();
            }
          } catch {}

          if (!pwaIconUrl) {
            try {
              const { data: setRow } = await supabaseAdmin
                .from("app_settings")
                .select("value")
                .eq("key", "system_branding")
                .maybeSingle();

              if (setRow?.value) {
                const list = typeof setRow.value === "string" ? JSON.parse(setRow.value) : setRow.value;
                if (Array.isArray(list)) {
                  const found =
                    list.find((it: any) => it.key === "pwa_icon" && it.file_url) ||
                    list.find((it: any) => it.key === "app_icon" && it.file_url);
                  if (found?.file_url) {
                    pwaIconUrl = found.file_url;
                    if (found.updated_at) pwaTime = new Date(found.updated_at).getTime();
                  }
                }
              }
            } catch {}
          }
        } catch (e) {
          console.warn("[Manifest.json] Erro ao carregar configurações de marca:", e);
        }

        const iconUrl192 = pwaIconUrl
          ? `${pwaIconUrl}${pwaIconUrl.includes("?") ? "&" : "?"}v=${pwaTime}`
          : `/app-icon-192.png?v=${pwaTime}`;
        const iconUrl512 = pwaIconUrl
          ? `${pwaIconUrl}${pwaIconUrl.includes("?") ? "&" : "?"}v=${pwaTime}`
          : `/app-icon-512.png?v=${pwaTime}`;
        const maskUrl192 = pwaIconUrl
          ? `${pwaIconUrl}${pwaIconUrl.includes("?") ? "&" : "?"}v=${pwaTime}`
          : `/app-icon-192-maskable.png?v=${pwaTime}`;
        const maskUrl512 = pwaIconUrl
          ? `${pwaIconUrl}${pwaIconUrl.includes("?") ? "&" : "?"}v=${pwaTime}`
          : `/app-icon-512-maskable.png?v=${pwaTime}`;

        const manifest = {
          name,
          short_name: shortName,
          description: appearance.site_tagline || "Sistema de Gestão Amstore Bagshoes",
          id: "/",
          scope: "/",
          start_url: `/?v=${pwaTime}`,
          display: "standalone",
          orientation: "portrait",
          lang: "pt-BR",
          background_color: pwaBgColor,
          theme_color: pwaThemeColor,
          categories: ["business", "shopping"],
          icons: [
            { src: maskUrl192, sizes: "192x192", type: "image/png", purpose: "maskable" },
            { src: maskUrl512, sizes: "512x512", type: "image/png", purpose: "maskable" },
            { src: iconUrl192, sizes: "192x192", type: "image/png", purpose: "any" },
            { src: iconUrl512, sizes: "512x512", type: "image/png", purpose: "any" },
          ],
        };

        return new Response(JSON.stringify(manifest, null, 2), {
          headers: {
            "content-type": "application/manifest+json; charset=utf-8",
            ...NO_STORE_HEADERS,
          },
        });
      },
    },
  },
});
