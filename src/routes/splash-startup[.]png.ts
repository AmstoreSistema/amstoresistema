import { createFileRoute } from "@tanstack/react-router";
import { getSplashStartupBuffer, getServerPwaColors } from "@/lib/pwa-icons.server";

export const Route = createFileRoute("/splash-startup.png")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);
          let color = url.searchParams.get("color") || url.searchParams.get("bg");
          if (color) {
            color = color.trim();
            if (!color.startsWith("#")) color = `#${color}`;
          } else {
            const colors = await getServerPwaColors();
            color = colors.splashBgHex;
          }

          const buf = getSplashStartupBuffer(color);
          return new Response(new Uint8Array(buf), {
            headers: {
              "Content-Type": "image/png",
              "Cache-Control": "public, max-age=300, must-revalidate",
            },
          });
        } catch (err) {
          console.error("[splash-startup] Erro ao gerar splash dinâmico:", err);
          return new Response("Erro ao gerar splash", { status: 500 });
        }
      },
    },
  },
});
