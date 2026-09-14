import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(url, key, {
  global: { fetch: (i, init) => {
    const h = new Headers(init?.headers);
    h.delete("Authorization");
    h.set("apikey", key);
    return fetch(i, { ...init, headers: h });
  } },
});

const EXT = { "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif", "image/avif": "avif" };

for (const table of ["products", "materials"]) {
  const { data, error } = await admin.from(table).select("id, image_url").like("image_url", "data:%");
  if (error) throw error;
  console.log(table, "com base64:", data.length);
  let ok = 0, fail = 0;
  for (const row of data) {
    try {
      const m = /^data:([^;]+);base64,(.*)$/s.exec(row.image_url);
      if (!m) { fail++; continue; }
      const mime = m[1];
      const ext = EXT[mime.toLowerCase()] || "jpg";
      const bytes = Buffer.from(m[2], "base64");
      const path = `${table}/${randomUUID()}.${ext}`;
      const up = await admin.storage.from("catalog-images").upload(path, bytes, { contentType: mime, upsert: false });
      if (up.error) throw up.error;
      const { error: uErr } = await admin.from(table).update({ image_url: `/api/public/catalog-image/${path}` }).eq("id", row.id);
      if (uErr) throw uErr;
      ok++;
    } catch (e) {
      fail++;
      console.warn(table, row.id, e.message);
    }
  }
  console.log(table, "convertidas:", ok, "falhas:", fail);
}
