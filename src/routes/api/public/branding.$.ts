import { createFileRoute } from "@tanstack/react-router";

// Serve as imagens da identidade visual a partir do Storage do Supabase com cache otimizado
export const Route = createFileRoute("/api/public/branding/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const path = (params as any)._splat as string | undefined;
        if (!path || path.includes("..")) {
          return new Response("Not found", { status: 404 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from("branding").download(path);

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
