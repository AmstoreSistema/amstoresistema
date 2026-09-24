import { createFileRoute } from "@tanstack/react-router";
import { getPwaIconBuffer, getServerPwaColors } from "@/lib/pwa-icons.server";

export const Route = createFileRoute('/api/public/pwa-icon')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const url = new URL(request.url);

          const rawVariant = url.searchParams.get("variant") || url.searchParams.get("size") || "192";
          let variant: "192" | "512" | "192-maskable" | "512-maskable" | "apple-touch" = "192";

          if (rawVariant === "512") {
            variant = "512";
          } else if (
            rawVariant === "512-maskable" ||
            (rawVariant === "512" && url.searchParams.get("maskable") === "1")
          ) {
            variant = "512-maskable";
          } else if (
            rawVariant === "192-maskable" ||
            (rawVariant === "192" && url.searchParams.get("maskable") === "1")
          ) {
            variant = "192-maskable";
          } else if (
            rawVariant === "apple" ||
            rawVariant === "apple-touch" ||
            url.searchParams.get("apple") === "1"
          ) {
            variant = "apple-touch";
          }

          let color = url.searchParams.get("color") || url.searchParams.get("bg");
          const hasExplicitColor = Boolean(color);

          if (color) {
            color = color.trim();
            if (!color.startsWith("#")) color = `#${color}`;
          } else {
            const colors = await getServerPwaColors();
            color = colors.pwaBgHex;
          }

          const buf = getPwaIconBuffer(variant, color);

          return new Response(new Uint8Array(buf), {
            headers: {
              "Content-Type": "image/png",
              "Cache-Control":
                hasExplicitColor || url.searchParams.has("v")
                  ? "public, max-age=31536000, immutable"
                  : "public, max-age=60, must-revalidate",
            },
          });
        } catch (err) {
          console.error("[pwa-icon] Erro ao gerar ícone dinâmico do PWA:", err);
          return new Response("Erro ao gerar ícone", { status: 500 });
        }
      },
    },
  },
});
