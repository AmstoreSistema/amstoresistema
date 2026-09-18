import { createFileRoute } from "@tanstack/react-router";
import { getAppearance, appearanceHash, NO_STORE_HEADERS } from "@/lib/appearance.server";
import { getServerPwaColors } from "@/lib/pwa-icons.server";

export const Route = createFileRoute("/manifest.json")({
  server: {
    handlers: {
      GET: async () => {
        const appearance = await getAppearance();
        const v = appearanceHash(appearance);
        const name = appearance.site_name || "Amstore Bagshoes";
        const shortName = "Amstore";

        const pwaColors = await getServerPwaColors();
        const pwaBgColor = pwaColors.pwaBgHex || "#D4AF37";
        const pwaThemeColor = pwaColors.pwaThemeHex || pwaColors.pwaBgHex || "#D4AF37";

        const cleanBg = pwaBgColor.replace("#", "").toUpperCase();
        const iconKey = `${v}_${cleanBg}`;

        const maskUrl192 = `/api/public/pwa-icon?variant=192-maskable&color=${cleanBg}&v=${iconKey}`;
        const maskUrl512 = `/api/public/pwa-icon?variant=512-maskable&color=${cleanBg}&v=${iconKey}`;
        const iconUrl192 = `/api/public/pwa-icon?variant=192&color=${cleanBg}&v=${iconKey}`;
        const iconUrl512 = `/api/public/pwa-icon?variant=512&color=${cleanBg}&v=${iconKey}`;

        const manifest = {
          name,
          short_name: shortName,
          description: appearance.site_tagline || "Sistema de Gestão Amstore Bagshoes - Produção, Estoque e Vendas",
          id: "/",
          scope: "/",
          start_url: `/?v=${v}`,
          display: "standalone",
          orientation: "portrait",
          lang: "pt-BR",
          background_color: "#000000",
          theme_color: "#000000",
          categories: ["business", "shopping"],
          icons: [
            { src: "/app-icon-192-maskable.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
            { src: "/app-icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
            { src: "/app-icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
            { src: "/app-icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
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
