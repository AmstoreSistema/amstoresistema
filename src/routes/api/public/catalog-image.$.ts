import { createFileRoute } from "@tanstack/react-router";

// Serve as fotos de produtos/materiais a partir do armazenamento de arquivos,
// com cache longo no navegador (muito mais rápido que carregar base64 do banco).
export const Route = createFileRoute("/api/public/catalog-image/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = (params as any)._splat as string | undefined;
        if (!path || path.includes("..")) {
          return new Response("Not found", { status: 404 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from("catalog-images").download(path);

        if (error || !data) {
          return new Response("Not found", { status: 404 });
        }

        const buf = await data.arrayBuffer();
        return new Response(buf, {
          headers: {
            "Content-Type": data.type || "image/jpeg",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
