import { createFileRoute } from "@tanstack/react-router";

// Serve as imagens da identidade visual a partir do Storage do Supabase com cache otimizado
export const Route = createFileRoute("/api/public/branding/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = (params as any)?._splat || (params as any)?._ || (params as any)?.['*'];

        if (!path || path.includes("..")) {
          return new Response("Not found", { status: 404 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let { data, error } = await supabaseAdmin.storage.from("branding").download(path);

        if (error || !data) {
          const res = await supabaseAdmin.storage.from("catalog-images").download(`branding/${path}`);
          data = res.data;
          error = res.error;
        }

        if (error || !data) {
          return new Response("Not found", { status: 404 });
        }

        const buf = await data.arrayBuffer();
        return new Response(buf, {
          headers: {
            "Content-Type": data.type || "image/png",
            "Cache-Control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
