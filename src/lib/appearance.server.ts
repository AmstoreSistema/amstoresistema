import { createClient } from "@supabase/supabase-js";
import { deflateSync } from "zlib";

export type Appearance = {
  site_name: string;
  site_tagline: string;
  site_logo_url: string;
  favicon_url: string;
  app_icon_url: string;
  splash_logo_url: string;
  splash_bg: string;
  splash_effect: "pulse" | "spin" | "bounce" | "ping" | "fade" | "none";
  block_screenshot: boolean;
};

export const DEFAULT_APPEARANCE: Appearance = {
  site_name: "AmStore Gestão",
  site_tagline: "Produção, Estoque e Vendas",
  site_logo_url: "",
  favicon_url: "",
  app_icon_url: "",
  splash_logo_url: "",
  splash_bg: "#0A0A0B",
  splash_effect: "pulse",
  block_screenshot: false,
};

export function normalizeAppearance(raw: unknown): Appearance {
  let parsed: any = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = null;
    }
  }
  if (!parsed || typeof parsed !== "object") return DEFAULT_APPEARANCE;
  return { ...DEFAULT_APPEARANCE, ...parsed } as Appearance;
}

export async function getAppearance(): Promise<Appearance> {
  try {
    const supabase = createClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_PUBLISHABLE_KEY"]!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "appearance")
      .maybeSingle();
    return normalizeAppearance(data?.value);
  } catch {
    return DEFAULT_APPEARANCE;
  }
}

/** Hash simples só para invalidar URLs de ícone/manifest — não é segurança. */
export function appearanceHash(a: Appearance): string {
  const seed = [
    a.site_name,
    a.site_logo_url,
    a.favicon_url,
    a.app_icon_url,
    a.splash_logo_url,
    a.splash_bg,
    a.splash_effect,
  ].join("|");
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Converte uma URL (http/https ou data:) em data URI base64 para embutir no SVG. */
export async function toDataUri(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const type = res.headers.get("content-type") || "image/png";
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > 3_000_000) return null;
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

export async function buildIconSvg(
  appearance: Appearance,
  imageUrl: string,
  options: { maskable?: boolean } = {},
): Promise<string> {
  const size = 512;
  const bg = /^#[0-9a-fA-F]{3,8}$/.test(appearance.splash_bg) ? appearance.splash_bg : "#0A0A0B";
  const dataUri = await toDataUri(imageUrl);
  const pad = options.maskable ? Math.round(size * 0.1) : 0;
  const inner = size - pad * 2;

  const content = dataUri
    ? `<image x="${pad}" y="${pad}" width="${inner}" height="${inner}" preserveAspectRatio="xMidYMid slice" href="${escapeXml(dataUri)}" />`
    : `<text x="50%" y="50%" dy="0.35em" text-anchor="middle" font-family="sans-serif" font-weight="700" font-size="${Math.round(size * 0.5)}" fill="#ffffff">${escapeXml(
        (appearance.site_name || "A").trim().charAt(0).toUpperCase(),
      )}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"><rect width="${size}" height="${size}" fill="${escapeXml(bg)}" />${content}</svg>`;
}

export async function buildSplashSvg(appearance: Appearance): Promise<string> {
  const w = 1290;
  const h = 2796;
  const bg = /^#[0-9a-fA-F]{3,8}$/.test(appearance.splash_bg) ? appearance.splash_bg : "#0A0A0B";
  const logo = await toDataUri(appearance.splash_logo_url || appearance.app_icon_url || appearance.site_logo_url);
  const logoSize = 480;
  const content = logo
    ? `<image x="${(w - logoSize) / 2}" y="${(h - logoSize) / 2}" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet" href="${escapeXml(logo)}" />`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="${w}" height="${h}" fill="${escapeXml(bg)}" />${content}</svg>`;
}

function hexToRgb(hex: string): [number, number, number] {
  let value = hex.replace("#", "");
  if (value.length === 3) value = value.split("").map((c) => c + c).join("");
  if (value.length < 6) return [10, 10, 11];
  const num = parseInt(value.slice(0, 6), 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]!) & 0xff]! ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

/** PNG sólido gerado manualmente (sem sharp/canvas, compatível com edge runtime). */
export function buildSolidPng(width: number, height: number, hex: string): Buffer {
  const [r, g, b] = hexToRgb(hex);
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let offset = 0;
  for (let y = 0; y < height; y++) {
    raw[offset++] = 0; // filter type none
    for (let x = 0; x < width; x++) {
      raw[offset++] = r;
      raw[offset++] = g;
      raw[offset++] = b;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // truecolor
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", deflateSync(raw)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

export const NO_STORE_HEADERS = {
  "cache-control": "no-store, no-cache, must-revalidate",
  pragma: "no-cache",
};

export function svgResponse(svg: string) {
  return new Response(svg, {
    headers: { "content-type": "image/svg+xml; charset=utf-8", ...NO_STORE_HEADERS },
  });
}
