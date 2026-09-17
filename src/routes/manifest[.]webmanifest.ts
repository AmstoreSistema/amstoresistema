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
            { src: `/app-icon-192-maskable.png?v=${v}`, sizes: "192x192", type: "image/png", purpose: "maskable" },
            { src: `/app-icon-512-maskable.png?v=${v}`, sizes: "512x512", type: "image/png", purpose: "maskable" },
            { src: `/app-icon-192.png?v=${v}`, sizes: "192x192", type: "image/png", purpose: "any" },
            { src: `/app-icon-512.png?v=${v}`, sizes: "512x512", type: "image/png", purpose: "any" },
          ],

        };

        return new Response(JSON.stringify(manifest), {
          headers: { "content-type": "application/manifest+json; charset=utf-8", ...NO_STORE_HEADERS },
        });
      },
    },
  },
});
