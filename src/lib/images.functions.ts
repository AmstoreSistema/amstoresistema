import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

/**
 * Recebe uma imagem em base64 (data URL), grava no armazenamento de arquivos
 * e devolve a URL leve que deve ser salva no banco.
 */
export const uploadCatalogImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        dataUrl: z.string().min(10),
        folder: z.string().default("products"),
      })
      .parse(data)
  )
  .handler(async ({ data }) => {
    const match = /^data:([^;]+);base64,(.*)$/s.exec(data.dataUrl);
    if (!match) {
      // Já é uma URL comum: nada a fazer.
      return { url: data.dataUrl };
    }

    const mime = match[1] || "image/jpeg";
    const base64 = match[2] || "";
    const ext = EXT_BY_MIME[mime.toLowerCase()] || "jpg";
    const bytes = Buffer.from(base64, "base64");

    const folder = data.folder.replace(/[^a-z0-9_-]/gi, "") || "products";
    const path = `${folder}/${crypto.randomUUID()}.${ext}`;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.storage
      .from("catalog-images")
      .upload(path, bytes, { contentType: mime, upsert: false });

    if (error) throw new Error(error.message);

    return { url: `/api/public/catalog-image/${path}` };
  });
