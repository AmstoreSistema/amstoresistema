import fs from "fs";
import zlib from "zlib";
import path from "path";
import { WHITE_LOGO_BASE64 } from "./white-logo-asset";

// CRC32 implementation
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
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

function encodePng(width: number, height: number, rgbaBuffer: Buffer): Buffer {
  const raw = Buffer.alloc((width * 4 + 1) * height);
  let srcOffset = 0;
  let dstOffset = 0;
  for (let y = 0; y < height; y++) {
    raw[dstOffset++] = 0; // Filter: None
    for (let x = 0; x < width; x++) {
      raw[dstOffset++] = rgbaBuffer[srcOffset++]!;
      raw[dstOffset++] = rgbaBuffer[srcOffset++]!;
      raw[dstOffset++] = rgbaBuffer[srcOffset++]!;
      raw[dstOffset++] = rgbaBuffer[srcOffset++]!;
    }
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

function decodePng(filePathOrBuf?: string | Buffer): { width: number; height: number; data: Buffer } {
  let buf: Buffer;
  if (Buffer.isBuffer(filePathOrBuf)) {
    buf = filePathOrBuf;
  } else if (typeof filePathOrBuf === "string" && fs.existsSync(filePathOrBuf)) {
    try {
      buf = fs.readFileSync(filePathOrBuf);
    } catch {
      buf = Buffer.from(WHITE_LOGO_BASE64, "base64");
    }
  } else {
    buf = Buffer.from(WHITE_LOGO_BASE64, "base64");
  }
  let pos = 8;
  let width = 0;
  let height = 0;
  const idat: Buffer[] = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString("ascii", pos + 4, pos + 8);
    if (type === "IHDR") {
      width = buf.readUInt32BE(pos + 8);
      height = buf.readUInt32BE(pos + 12);
    } else if (type === "IDAT") {
      idat.push(buf.subarray(pos + 8, pos + 8 + len));
    }
    pos += 12 + len;
  }
  const decompressed = zlib.inflateSync(Buffer.concat(idat));
  const rawRgba = Buffer.alloc(width * height * 4);
  const srcStride = width * 4 + 1;
  let dstOffset = 0;
  for (let y = 0; y < height; y++) {
    const rowStart = y * srcStride + 1;
    for (let x = 0; x < width; x++) {
      const idx = rowStart + x * 4;
      rawRgba[dstOffset++] = decompressed[idx]!;
      rawRgba[dstOffset++] = decompressed[idx + 1]!;
      rawRgba[dstOffset++] = decompressed[idx + 2]!;
      rawRgba[dstOffset++] = decompressed[idx + 3]!;
    }
  }
  return { width, height, data: rawRgba };
}

// Bilinear scaling
function scaleRgba(
  src: { width: number; height: number; data: Buffer },
  targetW: number,
  targetH: number
): { width: number; height: number; data: Buffer } {
  const dst = Buffer.alloc(targetW * targetH * 4);
  const xRatio = (src.width - 1) / Math.max(targetW - 1, 1);
  const yRatio = (src.height - 1) / Math.max(targetH - 1, 1);

  for (let y = 0; y < targetH; y++) {
    const srcY = y * yRatio;
    const yFloor = Math.floor(srcY);
    const yCeil = Math.min(src.height - 1, Math.ceil(srcY));
    const yWeight = srcY - yFloor;

    for (let x = 0; x < targetW; x++) {
      const srcX = x * xRatio;
      const xFloor = Math.floor(srcX);
      const xCeil = Math.min(src.width - 1, Math.ceil(srcX));
      const xWeight = srcX - xFloor;

      const idxTL = (yFloor * src.width + xFloor) * 4;
      const idxTR = (yFloor * src.width + xCeil) * 4;
      const idxBL = (yCeil * src.width + xFloor) * 4;
      const idxBR = (yCeil * src.width + xCeil) * 4;

      const dstIdx = (y * targetW + x) * 4;

      for (let c = 0; c < 4; c++) {
        const top = src.data[idxTL + c]! * (1 - xWeight) + src.data[idxTR + c]! * xWeight;
        const bottom = src.data[idxBL + c]! * (1 - xWeight) + src.data[idxBR + c]! * xWeight;
        dst[dstIdx + c] = Math.round(top * (1 - yWeight) + bottom * yWeight);
      }
    }
  }
  return { width: targetW, height: targetH, data: dst };
}

function compositeLogo(
  canvasW: number,
  canvasH: number,
  logoScaled: { width: number; height: number; data: Buffer },
  bgRgb: [number, number, number] | null,
  offsetX: number,
  offsetY: number
): Buffer {
  const canvas = Buffer.alloc(canvasW * canvasH * 4);

  // Fill background
  for (let i = 0; i < canvasW * canvasH; i++) {
    if (bgRgb) {
      canvas[i * 4] = bgRgb[0];
      canvas[i * 4 + 1] = bgRgb[1];
      canvas[i * 4 + 2] = bgRgb[2];
      canvas[i * 4 + 3] = 255;
    } else {
      canvas[i * 4] = 0;
      canvas[i * 4 + 1] = 0;
      canvas[i * 4 + 2] = 0;
      canvas[i * 4 + 3] = 0; // Transparent
    }
  }

  // Alpha blend logo onto canvas
  for (let ly = 0; ly < logoScaled.height; ly++) {
    const cy = offsetY + ly;
    if (cy < 0 || cy >= canvasH) continue;
    for (let lx = 0; lx < logoScaled.width; lx++) {
      const cx = offsetX + lx;
      if (cx < 0 || cx >= canvasW) continue;

      const logoIdx = (ly * logoScaled.width + lx) * 4;
      const canvasIdx = (cy * canvasW + cx) * 4;

      const la = logoScaled.data[logoIdx + 3]! / 255;
      if (la <= 0) continue;

      if (!bgRgb) {
        canvas[canvasIdx] = logoScaled.data[logoIdx]!;
        canvas[canvasIdx + 1] = logoScaled.data[logoIdx + 1]!;
        canvas[canvasIdx + 2] = logoScaled.data[logoIdx + 2]!;
        canvas[canvasIdx + 3] = logoScaled.data[logoIdx + 3]!;
      } else {
        const ca = canvas[canvasIdx + 3]! / 255;
        const outA = la + ca * (1 - la);
        if (outA > 0) {
          canvas[canvasIdx] = Math.round((logoScaled.data[logoIdx]! * la + canvas[canvasIdx]! * ca * (1 - la)) / outA);
          canvas[canvasIdx + 1] = Math.round(
            (logoScaled.data[logoIdx + 1]! * la + canvas[canvasIdx + 1]! * ca * (1 - la)) / outA
          );
          canvas[canvasIdx + 2] = Math.round(
            (logoScaled.data[logoIdx + 2]! * la + canvas[canvasIdx + 2]! * ca * (1 - la)) / outA
          );
          canvas[canvasIdx + 3] = Math.round(outA * 255);
        }
      }
    }
  }

  return canvas;
}

function scaleAndCenterLogo(
  src: { width: number; height: number; data: Buffer },
  canvasW: number,
  canvasH: number,
  maxLogoW: number,
  maxLogoH: number,
  bgRgb: [number, number, number],
  offsetYShift = 0
): Buffer {
  const scale = Math.min(maxLogoW / src.width, maxLogoH / src.height);
  const targetW = Math.max(1, Math.round(src.width * scale));
  const targetH = Math.max(1, Math.round(src.height * scale));
  const scaled = scaleRgba(src, targetW, targetH);
  const offsetX = Math.round((canvasW - targetW) / 2);
  const offsetY = Math.round((canvasH - targetH) / 2) + offsetYShift;
  return compositeLogo(canvasW, canvasH, scaled, bgRgb, offsetX, offsetY);
}

export function hexToRgb(hex: string): [number, number, number] {
  let clean = hex.replace("#", "").trim();
  if (clean.length === 3) {
    clean = clean
      .split("")
      .map((c) => c + c)
      .join("");
  }
  if (clean.length < 6) return [212, 175, 55]; // Fallback Gold
  const num = parseInt(clean.slice(0, 6), 16);
  if (isNaN(num)) return [212, 175, 55];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

const iconBufferCache = new Map<string, { buffer: Buffer; timestamp: number }>();
const splashBufferCache = new Map<string, { buffer: Buffer; timestamp: number }>();

export function getPwaIconBuffer(
  variant: "192" | "512" | "192-maskable" | "512-maskable" | "apple-touch",
  pwaBgHex: string
): Buffer {
  let hex = (pwaBgHex || "#D4AF37").trim();
  if (!hex.startsWith("#")) hex = `#${hex}`;
  const cacheKey = `${variant}:${hex.toUpperCase()}`;
  const cached = iconBufferCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 300_000) {
    return cached.buffer;
  }

  const publicDir = path.resolve(process.cwd(), "public");
  const whiteLogoPath = path.resolve(publicDir, "bagshoes-logo-white.png");
  const pwaRgb = hexToRgb(hex);
  const whiteLogoSrc = decodePng(whiteLogoPath);

  let buf: Buffer;
  if (variant === "512" || variant === "512-maskable") {
    // 512x512 maskable: safe zone é 80% do diâmetro (~409px). 340x340 preserva proporção exata sem esticar
    const mask512Data = scaleAndCenterLogo(whiteLogoSrc, 512, 512, 340, 340, pwaRgb);
    buf = encodePng(512, 512, mask512Data);
  } else if (variant === "192" || variant === "192-maskable") {
    // 192x192 maskable: zona proporcional de 128x128
    const mask192Data = scaleAndCenterLogo(whiteLogoSrc, 192, 192, 128, 128, pwaRgb);
    buf = encodePng(192, 192, mask192Data);
  } else {
    // Apple touch icon 192x192: 140x140
    const appleData = scaleAndCenterLogo(whiteLogoSrc, 192, 192, 140, 140, pwaRgb);
    buf = encodePng(192, 192, appleData);
  }

  iconBufferCache.set(cacheKey, { buffer: buf, timestamp: Date.now() });
  return buf;
}

export function getSplashStartupBuffer(splashBgHex: string): Buffer {
  let hex = (splashBgHex || "#D4AF37").trim();
  if (!hex.startsWith("#")) hex = `#${hex}`;
  const cacheKey = hex.toUpperCase();
  const cached = splashBufferCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 300_000) {
    return cached.buffer;
  }

  const publicDir = path.resolve(process.cwd(), "public");
  const whiteLogoPath = path.resolve(publicDir, "bagshoes-logo-white.png");
  const splashRgb = hexToRgb(hex);
  const whiteLogoSrc = decodePng(whiteLogoPath);

  // Canvas vertical 1080x1920: logo nítida de 520px máx proporcional, centralizada com elevação suave
  const splashData = scaleAndCenterLogo(whiteLogoSrc, 1080, 1920, 520, 400, splashRgb, -60);
  const buf = encodePng(1080, 1920, splashData);
  splashBufferCache.set(cacheKey, { buffer: buf, timestamp: Date.now() });
  return buf;
}

export async function getServerPwaColors(): Promise<{ pwaBgHex: string; splashBgHex: string; pwaThemeHex: string }> {
  // 1. Tenta via supabaseAdmin
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: colorRow } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "branding_colors")
      .maybeSingle();

    if (colorRow?.value) {
      const parsed = typeof colorRow.value === "string" ? JSON.parse(colorRow.value) : colorRow.value;
      if (parsed.pwa_bg_color || parsed.splash_bg_color) {
        return {
          pwaBgHex: parsed.pwa_bg_color || parsed.splash_bg_color || "#D4AF37",
          splashBgHex: parsed.splash_bg_color || parsed.pwa_bg_color || "#D4AF37",
          pwaThemeHex: parsed.pwa_theme_color || parsed.pwa_bg_color || "#D4AF37",
        };
      }
    }

    // 1b. Fallback para appearance via supabaseAdmin (ignora se for o preto legado não configurado #0A0A0C)
    const { data: appRow } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "appearance")
      .maybeSingle();

    if (appRow?.value) {
      const parsed = typeof appRow.value === "string" ? JSON.parse(appRow.value) : appRow.value;
      if (parsed.splash_bg && parsed.splash_bg.toUpperCase() !== "#0A0A0C") {
        return {
          pwaBgHex: parsed.splash_bg,
          splashBgHex: parsed.splash_bg,
          pwaThemeHex: parsed.splash_bg,
        };
      }
    }
  } catch {}

  // 2. Fallback via createClient público (para ambientes locais ou sem service role)
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabaseUrl = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
    const supabaseKey = process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
    if (supabaseUrl && supabaseKey) {
      const client = createClient(supabaseUrl, supabaseKey, {
        auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      });

      const { data: colorRow } = await client
        .from("app_settings")
        .select("value")
        .eq("key", "branding_colors")
        .maybeSingle();

      if (colorRow?.value) {
        const parsed = typeof colorRow.value === "string" ? JSON.parse(colorRow.value) : colorRow.value;
        if (parsed.pwa_bg_color || parsed.splash_bg_color) {
          return {
            pwaBgHex: parsed.pwa_bg_color || parsed.splash_bg_color || "#D4AF37",
            splashBgHex: parsed.splash_bg_color || parsed.pwa_bg_color || "#D4AF37",
            pwaThemeHex: parsed.pwa_theme_color || parsed.pwa_bg_color || "#D4AF37",
          };
        }
      }

      const { data: appRow } = await client
        .from("app_settings")
        .select("value")
        .eq("key", "appearance")
        .maybeSingle();

      if (appRow?.value) {
        const parsed = typeof appRow.value === "string" ? JSON.parse(appRow.value) : appRow.value;
        if (parsed.splash_bg && parsed.splash_bg.toUpperCase() !== "#0A0A0C") {
          return {
            pwaBgHex: parsed.splash_bg,
            splashBgHex: parsed.splash_bg,
            pwaThemeHex: parsed.splash_bg,
          };
        }
      }
    }
  } catch {}

  return { pwaBgHex: "#D4AF37", splashBgHex: "#D4AF37", pwaThemeHex: "#D4AF37" };
}

/**
 * Regenera todos os ícones de PWA e a tela de Splash física com as cores customizadas configuradas,
 * sem distorção e preservando a proporção de aspecto perfeita.
 */
export async function generatePwaAssets(pwaBgHex: string, splashBgHex: string): Promise<void> {
  try {
    const publicDir = path.resolve(process.cwd(), "public");
    const whiteLogoPath = path.resolve(publicDir, "bagshoes-logo-white.png");

    if (!fs.existsSync(whiteLogoPath)) {
      console.warn("[PWA Assets] Arquivo bagshoes-logo-white.png não encontrado em", whiteLogoPath);
      return;
    }

    // 1. app-icon-512.png e app-icon-512-maskable.png (512x512, fundo da cor PWA)
    const icon512Buf = getPwaIconBuffer("512", pwaBgHex);
    fs.writeFileSync(path.resolve(publicDir, "app-icon-512.png"), icon512Buf);
    fs.writeFileSync(path.resolve(publicDir, "app-icon-512-maskable.png"), icon512Buf);

    // 2. app-icon-192.png e app-icon-192-maskable.png (192x192, fundo da cor PWA)
    const icon192Buf = getPwaIconBuffer("192", pwaBgHex);
    fs.writeFileSync(path.resolve(publicDir, "app-icon-192.png"), icon192Buf);
    fs.writeFileSync(path.resolve(publicDir, "app-icon-192-maskable.png"), icon192Buf);

    // 3. apple-touch-icon.png (192x192, fundo da cor PWA)
    const appleBuf = getPwaIconBuffer("apple-touch", pwaBgHex);
    fs.writeFileSync(path.resolve(publicDir, "apple-touch-icon.png"), appleBuf);

    // 4. splash-startup.png e splash-startup.jpg (1080x1920, fundo da cor Splash, logo branca centralizada e sem distorção)
    const splashPng = getSplashStartupBuffer(splashBgHex);
    fs.writeFileSync(path.resolve(publicDir, "splash-startup.png"), splashPng);
    fs.writeFileSync(path.resolve(publicDir, "splash-startup.jpg"), splashPng);

    // 5. Atualiza public/manifest.json para sincronizar arquivo estático com as cores reais
    try {
      const manifestPath = path.resolve(publicDir, "manifest.json");
      if (fs.existsSync(manifestPath)) {
        const manifestContent = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
        const cleanBg = (pwaBgHex || "#D4AF37").replace("#", "").toUpperCase();
        manifestContent.background_color = pwaBgHex;
        manifestContent.theme_color = pwaBgHex;
        if (Array.isArray(manifestContent.icons)) {
          manifestContent.icons = manifestContent.icons.map((ic: any) => {
            if (typeof ic.src === "string" && ic.src.includes("/api/public/pwa-icon")) {
              const urlObj = new URL(ic.src, "https://amstore.local");
              urlObj.searchParams.set("color", cleanBg);
              urlObj.searchParams.set("v", "pwa");
              return { ...ic, src: `${urlObj.pathname}?${urlObj.searchParams.toString()}` };
            }
            return ic;
          });
        }
        fs.writeFileSync(manifestPath, JSON.stringify(manifestContent, null, 2), "utf8");
      }
    } catch (e) {
      console.warn("[PWA Assets] Erro ao atualizar public/manifest.json:", e);
    }

    console.log(`[PWA Assets] Todos os ícones e splash regenerados com proporção perfeita! PWA: ${pwaBgHex}, Splash: ${splashBgHex}`);
  } catch (err) {
    console.error("[PWA Assets] Erro ao gerar assets do PWA:", err);
  }
}
