import { createFileRoute } from "@tanstack/react-router";
import { getAppearance, appearanceHash, NO_STORE_HEADERS } from "@/lib/appearance.server";

export const Route = createFileRoute("/manifest.webmanifest")({
  server: {
    handlers: {
      GET: async () => {
        const appearance = await getAppearance();
        const v = appearanceHash(appearance);
        const name = appearance.site_name || "Amstore Bagshoes";
        const shortName = "Amstore";

        let iconUrl192 = `/app-icon-192.png?v=${v}`;
        let iconUrl512 = `/app-icon-512.png?v=${v}`;
        let maskUrl192 = `/app-icon-192-maskable.png?v=${v}`;
        let maskUrl512 = `/app-icon-512-maskable.png?v=${v}`;

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data } = await supabaseAdmin
            .from("system_branding")
            .select("key, file_url, updated_at")
            .in("key", ["pwa_icon", "app_icon"]);

          const pwa = data?.find((d: any) => d.key === "pwa_icon" && d.file_url) || data?.find((d: any) => d.key === "app_icon" && d.file_url);
          if (pwa?.file_url) {
            const time = pwa.updated_at ? new Date(pwa.updated_at).getTime() : v;
            iconUrl192 = `${pwa.file_url}?v=${time}`;
            iconUrl512 = `${pwa.file_url}?v=${time}`;
            maskUrl192 = `${pwa.file_url}?v=${time}`;
            maskUrl512 = `${pwa.file_url}?v=${time}`;
          }
        } catch {}

        const manifest = {
          name,
          short_name: shortName,
          description: appearance.site_tagline || "Sistema de Gestão Amstore Bagshoes",
          id: "/",
          scope: "/",
          start_url: `/dashboard?appearance=${v}`,
          display: "standalone",
          orientation: "portrait",
          lang: "pt-BR",
          background_color: "#D4AF37",
          theme_color: "#D4AF37",
          icons: [
            { src: maskUrl192, sizes: "192x192", type: "image/png", purpose: "maskable" },
            { src: maskUrl512, sizes: "512x512", type: "image/png", purpose: "maskable" },
            { src: iconUrl192, sizes: "192x192", type: "image/png", purpose: "any" },
            { src: iconUrl512, sizes: "512x512", type: "image/png", purpose: "any" },
          ],
        };

        return new Response(JSON.stringify(manifest), {
          headers: { "content-type": "application/manifest+json; charset=utf-8", ...NO_STORE_HEADERS },
        });
      },
    },
  },
});
