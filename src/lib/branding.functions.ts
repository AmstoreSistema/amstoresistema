import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "./admin.server";

export interface BrandingItem {
  id?: string;
  key: string;
  name: string;
  description: string;
  file_path: string | null;
  file_url: string;
  mime_type: string | null;
  file_size: number | null;
  width: number | null;
  height: number | null;
  is_active: boolean;
  updated_at: string;
}

export interface BrandingColors {
  splash_bg_color: string;
  pwa_bg_color: string;
  pwa_theme_color: string;
}

export const BRANDING_COLORS_DEFAULT: BrandingColors = {
  splash_bg_color: "#D4AF37",
  pwa_bg_color: "#D4AF37",
  pwa_theme_color: "#D4AF37",
};

export const BRANDING_DEFAULTS: Record<string, Omit<BrandingItem, "updated_at">> = {
  logo_primary: {
    key: "logo_primary",
    name: "Logo Principal",
    description: "Utilizada no cabeçalho/sidebar aberto do sistema e relatórios.",
    file_path: null,
    file_url: "/bagshoes-logo.png",
    mime_type: "image/png",
    file_size: null,
    width: null,
    height: null,
    is_active: true,
  },
  logo_compact: {
    key: "logo_compact",
    name: "Logo Compacta",
    description: "Utilizada quando o menu/sidebar estiver recolhido (ícone/símbolo).",
    file_path: null,
    file_url: "/bagshoes-logo.png",
    mime_type: "image/png",
    file_size: null,
    width: null,
    height: null,
    is_active: true,
  },
  logo_login: {
    key: "logo_login",
    name: "Logo da Tela de Login",
    description: "Utilizada na tela de login e recuperação de senha.",
    file_path: null,
    file_url: "/bagshoes-logo.png",
    mime_type: "image/png",
    file_size: null,
    width: null,
    height: null,
    is_active: true,
  },
  splash: {
    key: "splash",
    name: "Logomarca do Splash Screen",
    description: "Exibida sobre o fundo dourado durante a inicialização do aplicativo.",
    file_path: null,
    file_url: "/bagshoes-logo-white.png",
    mime_type: "image/png",
    file_size: null,
    width: null,
    height: null,
    is_active: true,
  },
  app_icon: {
    key: "app_icon",
    name: "Ícone do Sistema",
    description: "Ícone utilizado na interface e em locais onde o sistema precisar representar a aplicação.",
    file_path: null,
    file_url: "/app-icon-512.png",
    mime_type: "image/png",
    file_size: null,
    width: null,
    height: null,
    is_active: true,
  },
  pwa_icon: {
    key: "pwa_icon",
    name: "Ícone de Instalação PWA",
    description: "Ícone para instalação do aplicativo no celular ou computador (192x192 / 512x512).",
    file_path: null,
    file_url: "/app-icon-512.png",
    mime_type: "image/png",
    file_size: null,
    width: null,
    height: null,
    is_active: true,
  },
  favicon: {
    key: "favicon",
    name: "Favicon",
    description: "Ícone exibido na aba do navegador.",
    file_path: null,
    file_url: "/favicon.png",
    mime_type: "image/png",
    file_size: null,
    width: null,
    height: null,
    is_active: true,
  },
  loading: {
    key: "loading",
    name: "Imagem de Carregamento",
    description: "Imagem opcional exibida durante carregamentos importantes e transições.",
    file_path: null,
    file_url: "/bagshoes-logo-white.png",
    mime_type: "image/png",
    file_size: null,
    width: null,
    height: null,
    is_active: true,
  },
  fallback: {
    key: "fallback",
    name: "Imagem Padrão / Fallback",
    description: "Imagem utilizada quando alguma foto de produto, material ou avatar não estiver disponível.",
    file_path: null,
    file_url: "/bagshoes-logo.png",
    mime_type: "image/png",
    file_size: null,
    width: null,
    height: null,
    is_active: true,
  },
};

const KEY_TO_FOLDER: Record<string, string> = {
  logo_primary: "logo-primary",
  logo_compact: "logo-compact",
  logo_login: "logo-login",
  splash: "splash",
  app_icon: "app-icon",
  pwa_icon: "pwa-icon",
  favicon: "favicon",
  loading: "loading",
  fallback: "fallback",
};

const EXT_BY_MIME: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
};

/**
 * Carrega todas as configurações de identidade visual.
 * Lê prioritariamente de system_branding, com fallback para app_settings e defaults embutidos.
 */
export const getBrandingSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  let items: BrandingItem[] = [];

  try {
    const { data, error } = await supabaseAdmin
      .from("system_branding")
      .select("*")
      .order("created_at", { ascending: true });

    if (!error && Array.isArray(data) && data.length > 0) {
      items = data as BrandingItem[];
    }
  } catch (err: any) {
    console.warn("[Branding] Tabela system_branding indisponível, verificando app_settings:", err?.message);
  }

  // Se não obteve da tabela system_branding, tenta ler de app_settings
  if (items.length === 0) {
    try {
      const { data } = await supabaseAdmin
        .from("app_settings")
        .select("value")
        .eq("key", "system_branding")
        .maybeSingle();

      if (data?.value) {
        const parsed = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
        if (Array.isArray(parsed)) {
          items = parsed;
        }
      }
    } catch {}
  }

  // Mescla com os padrões para garantir que todas as 9 chaves existam sempre
  const itemsByKey = new Map<string, BrandingItem>();
  items.forEach((item) => itemsByKey.set(item.key, item));

  const now = new Date().toISOString();
  const merged: BrandingItem[] = Object.keys(BRANDING_DEFAULTS).map((key) => {
    const def = BRANDING_DEFAULTS[key]!;
    const existing = itemsByKey.get(key);
    if (existing) {
      return {
        ...def,
        ...existing,
        file_url: existing.file_url || def.file_url,
      };
    }
    return {
      ...def,
      updated_at: now,
    };
  });

  return merged;
});

/**
 * Realiza upload com resiliência: tenta criar/usar o bucket 'branding';
 * se não existir ou falhar, faz fallback automático para o bucket 'catalog-images' (pasta 'branding/').
 */
async function uploadToStorage(
  supabaseAdmin: any,
  subPath: string,
  bytes: Buffer,
  mime: string
): Promise<{ bucket: string; fullPath: string; publicUrl: string }> {
  let brandingReady = false;
  try {
    const { data: bucketData, error: getErr } = await supabaseAdmin.storage.getBucket("branding");
    if (bucketData && !getErr) {
      brandingReady = true;
    } else {
      const { error: createErr } = await supabaseAdmin.storage.createBucket("branding", {
        public: true,
        fileSizeLimit: 10485760,
      });
      if (!createErr) brandingReady = true;
    }
  } catch (e) {
    console.warn("[Branding] Erro ao verificar bucket 'branding':", e);
  }

  if (brandingReady) {
    const { error: uploadErr } = await supabaseAdmin.storage
      .from("branding")
      .upload(subPath, bytes, { contentType: mime, upsert: true });

    if (!uploadErr) {
      const { data: urlData } = supabaseAdmin.storage.from("branding").getPublicUrl(subPath);
      return {
        bucket: "branding",
        fullPath: subPath,
        publicUrl: urlData?.publicUrl || `/api/public/branding/${subPath}`,
      };
    }
    console.warn("[Branding] Upload em 'branding' falhou:", uploadErr.message);
  }

  // Fallback para 'catalog-images'
  const fallbackPath = `branding/${subPath}`;
  const { error: catErr } = await supabaseAdmin.storage
    .from("catalog-images")
    .upload(fallbackPath, bytes, { contentType: mime, upsert: true });

  if (!catErr) {
    const { data: urlData } = supabaseAdmin.storage.from("catalog-images").getPublicUrl(fallbackPath);
    return {
      bucket: "catalog-images",
      fullPath: fallbackPath,
      publicUrl: urlData?.publicUrl || `/api/public/catalog-image/${fallbackPath}`,
    };
  }

  throw new Error(`Falha no upload para o Storage: ${catErr.message || "Bucket não disponível"}`);
}

/**
 * Remove arquivo do Storage com segurança em ambos os buckets possíveis.
 */
async function deleteFromStorage(supabaseAdmin: any, fullPath: string | null) {
  if (!fullPath) return;
  try {
    if (fullPath.startsWith("branding/")) {
      await supabaseAdmin.storage.from("catalog-images").remove([fullPath]);
      const stripped = fullPath.replace(/^branding\//, "");
      await supabaseAdmin.storage.from("branding").remove([stripped]);
    } else {
      await supabaseAdmin.storage.from("branding").remove([fullPath]);
      await supabaseAdmin.storage.from("catalog-images").remove([`branding/${fullPath}`]);
    }
  } catch (e) {
    console.warn("[Branding] Aviso ao limpar arquivo do storage:", e);
  }
}

/**
 * Realiza upload de uma imagem para o bucket 'branding' do Supabase Storage
 * e atualiza o registro no banco de dados.
 */
export const uploadBrandingImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        key: z.string(),
        dataUrl: z.string().min(10),
        fileName: z.string().optional(),
        width: z.number().nullable().optional(),
        height: z.number().nullable().optional(),
      })
      .parse(data)
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Extrai mime type e base64
    const match = /^data:([^;]+);base64,(.*)$/s.exec(data.dataUrl);
    if (!match) {
      throw new Error("Formato de imagem inválido. Forneça uma data URL base64 válida.");
    }

    const mime = match[1]?.toLowerCase() || "image/png";
    const base64 = match[2] || "";
    const ext = EXT_BY_MIME[mime] || "png";
    const bytes = Buffer.from(base64, "base64");

    // Validação de tamanho máximo (5MB)
    const MAX_SIZE = 5 * 1024 * 1024;
    if (bytes.byteLength > MAX_SIZE) {
      throw new Error("A imagem excede o tamanho máximo permitido de 5MB.");
    }

    const folder = KEY_TO_FOLDER[data.key] || data.key.replace(/[^a-z0-9_-]/gi, "");
    const fileName = `${data.key}-${Date.now()}.${ext}`;
    const filePath = `${folder}/${fileName}`;

    // Obtém o registro atual para limpar arquivo anterior posteriormente
    let previousFilePath: string | null = null;
    try {
      const { data: current } = await supabaseAdmin
        .from("system_branding")
        .select("file_path")
        .eq("key", data.key)
        .maybeSingle();
      if (current?.file_path) {
        previousFilePath = current.file_path;
      }
    } catch {}

    // Upload resiliente para o Storage
    const { fullPath, publicUrl } = await uploadToStorage(supabaseAdmin, filePath, bytes, mime);

    const def = BRANDING_DEFAULTS[data.key] || {
      name: data.key,
      description: "",
      file_url: publicUrl,
    };

    const updatedRecord: BrandingItem = {
      key: data.key,
      name: def.name,
      description: def.description,
      file_path: fullPath,
      file_url: publicUrl,
      mime_type: mime,
      file_size: bytes.byteLength,
      width: data.width || null,
      height: data.height || null,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    // Tenta gravar em system_branding
    let savedInTable = false;
    try {
      const { error: dbError } = await supabaseAdmin
        .from("system_branding")
        .upsert(
          {
            key: updatedRecord.key,
            name: updatedRecord.name,
            description: updatedRecord.description,
            file_path: updatedRecord.file_path,
            file_url: updatedRecord.file_url,
            mime_type: updatedRecord.mime_type,
            file_size: updatedRecord.file_size,
            width: updatedRecord.width,
            height: updatedRecord.height,
            is_active: true,
            updated_at: updatedRecord.updated_at,
            updated_by: context.userId,
          },
          { onConflict: "key" }
        );

      if (!dbError) {
        savedInTable = true;
      }
    } catch (err: any) {
      console.warn("[Branding] Gravação direta em system_branding falhou:", err?.message);
    }

    // Sincroniza em app_settings para resiliência contínua
    try {
      const { data: existingSettings } = await supabaseAdmin
        .from("app_settings")
        .select("value")
        .eq("key", "system_branding")
        .maybeSingle();

      let brandingList: BrandingItem[] = [];
      if (existingSettings?.value) {
        try {
          brandingList = typeof existingSettings.value === "string" ? JSON.parse(existingSettings.value) : existingSettings.value;
        } catch {}
      }

      const idx = brandingList.findIndex((b) => b.key === data.key);
      if (idx >= 0) {
        brandingList[idx] = updatedRecord;
      } else {
        brandingList.push(updatedRecord);
      }

      await supabaseAdmin.from("app_settings").upsert({
        key: "system_branding",
        value: JSON.stringify(brandingList),
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn("[Branding] Falha ao sincronizar em app_settings:", err);
    }

    // Remove arquivo anterior do storage se diferente
    if (previousFilePath && previousFilePath !== fullPath) {
      await deleteFromStorage(supabaseAdmin, previousFilePath);
    }

    return {
      success: true,
      item: updatedRecord,
    };
  });

/**
 * Remove a imagem customizada de uma chave de identidade visual,
 * apagando o arquivo do Storage e restaurando o item para o padrão.
 */
export const removeBrandingImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) => z.object({ key: z.string() }).parse(data))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Localiza caminho atual
    let currentPath: string | null = null;
    try {
      const { data: current } = await supabaseAdmin
        .from("system_branding")
        .select("file_path")
        .eq("key", data.key)
        .maybeSingle();
      currentPath = current?.file_path || null;
    } catch {}

    if (!currentPath) {
      try {
        const { data: setRow } = await supabaseAdmin
          .from("app_settings")
          .select("value")
          .eq("key", "system_branding")
          .maybeSingle();
        if (setRow?.value) {
          const list = typeof setRow.value === "string" ? JSON.parse(setRow.value) : setRow.value;
          const found = list.find((it: any) => it.key === data.key);
          if (found?.file_path) currentPath = found.file_path;
        }
      } catch {}
    }

    const def = BRANDING_DEFAULTS[data.key];
    const defaultUrl = def ? def.file_url : "/bagshoes-logo.png";

    // Remove do Storage de forma segura em ambos os buckets possíveis
    if (currentPath) {
      await deleteFromStorage(supabaseAdmin, currentPath);
    }

    const resetRecord: BrandingItem = {
      key: data.key,
      name: def?.name || data.key,
      description: def?.description || "",
      file_path: null,
      file_url: defaultUrl,
      mime_type: null,
      file_size: null,
      width: null,
      height: null,
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    // Atualiza tabela
    try {
      await supabaseAdmin.from("system_branding").upsert(
        {
          key: resetRecord.key,
          name: resetRecord.name,
          description: resetRecord.description,
          file_path: null,
          file_url: defaultUrl,
          mime_type: null,
          file_size: null,
          width: null,
          height: null,
          is_active: true,
          updated_at: resetRecord.updated_at,
          updated_by: context.userId,
        },
        { onConflict: "key" }
      );
    } catch {}

    // Sincroniza em app_settings
    try {
      const { data: existingSettings } = await supabaseAdmin
        .from("app_settings")
        .select("value")
        .eq("key", "system_branding")
        .maybeSingle();

      let brandingList: BrandingItem[] = [];
      if (existingSettings?.value) {
        try {
          brandingList = typeof existingSettings.value === "string" ? JSON.parse(existingSettings.value) : existingSettings.value;
        } catch {}
      }

      const idx = brandingList.findIndex((b) => b.key === data.key);
      if (idx >= 0) {
        brandingList[idx] = resetRecord;
      } else {
        brandingList.push(resetRecord);
      }

      await supabaseAdmin.from("app_settings").upsert({
        key: "system_branding",
        value: JSON.stringify(brandingList),
        updated_at: new Date().toISOString(),
      });
    } catch {}

    return {
      success: true,
      item: resetRecord,
    };
  });

/**
 * Recupera as cores customizadas do Splash Screen e da instalação PWA.
 */
export const getBrandingColors = createServerFn({ method: "GET" }).handler(async (): Promise<BrandingColors> => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  try {
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "branding_colors")
      .maybeSingle();

    if (data?.value) {
      const parsed = typeof data.value === "string" ? JSON.parse(data.value) : data.value;
      return {
        splash_bg_color: parsed.splash_bg_color || BRANDING_COLORS_DEFAULT.splash_bg_color,
        pwa_bg_color: parsed.pwa_bg_color || BRANDING_COLORS_DEFAULT.pwa_bg_color,
        pwa_theme_color: parsed.pwa_theme_color || BRANDING_COLORS_DEFAULT.pwa_theme_color,
      };
    }
  } catch (e) {
    console.warn("[Branding] Aviso ao ler branding_colors de app_settings:", e);
  }

  // Fallback para appearance caso branding_colors ainda não exista
  try {
    const { data: appRow } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "appearance")
      .maybeSingle();
    if (appRow?.value) {
      const parsed = typeof appRow.value === "string" ? JSON.parse(appRow.value) : appRow.value;
      if (parsed?.splash_bg) {
        return {
          splash_bg_color: parsed.splash_bg,
          pwa_bg_color: parsed.splash_bg,
          pwa_theme_color: parsed.splash_bg,
        };
      }
    }
  } catch {}

  return BRANDING_COLORS_DEFAULT;
});

/**
 * Atualiza as cores customizadas do Splash Screen e da instalação PWA.
 */
export const updateBrandingColors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data) =>
    z
      .object({
        splash_bg_color: z.string().min(4).max(9),
        pwa_bg_color: z.string().min(4).max(9),
        pwa_theme_color: z.string().min(4).max(9),
      })
      .parse(data)
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId, context.claims);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const payload: BrandingColors = {
      splash_bg_color: data.splash_bg_color,
      pwa_bg_color: data.pwa_bg_color,
      pwa_theme_color: data.pwa_theme_color,
    };

    // 1. Grava em app_settings ("branding_colors")
    await supabaseAdmin.from("app_settings").upsert({
      key: "branding_colors",
      value: JSON.stringify(payload),
      updated_at: new Date().toISOString(),
    });

    // 2. Mantém compatibilidade com appearance.splash_bg
    try {
      const { data: curApp } = await supabaseAdmin
        .from("app_settings")
        .select("value")
        .eq("key", "appearance")
        .maybeSingle();

      let appObj: any = {};
      if (curApp?.value) {
        appObj = typeof curApp.value === "string" ? JSON.parse(curApp.value) : curApp.value;
      }
      appObj.splash_bg = payload.splash_bg_color;
      await supabaseAdmin.from("app_settings").upsert({
        key: "appearance",
        value: JSON.stringify(appObj),
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn("[Branding] Aviso ao sincronizar appearance:", e);
    }

    // 3. Regenera fisicamente os ícones e splash para que Android, iOS e Windows instalem com a nova cor imediatamente
    try {
      const { generatePwaAssets } = await import("@/lib/pwa-icons.server");
      await generatePwaAssets(payload.pwa_bg_color, payload.splash_bg_color);
    } catch (e) {
      console.warn("[Branding] Aviso ao regenerar assets do PWA:", e);
    }

    return {
      success: true,
      colors: payload,
    };
  });

