import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  getBrandingSettings,
  getBrandingColors,
  updateBrandingColors,
  BrandingItem,
  BrandingColors,
  BRANDING_DEFAULTS,
  BRANDING_COLORS_DEFAULT,
} from "@/lib/branding.functions";

interface BrandingContextType {
  branding: Record<string, BrandingItem>;
  logoPrimary: string;
  logoCompact: string;
  logoLogin: string;
  splash: string;
  appIcon: string;
  pwaIcon: string;
  favicon: string;
  loading: string;
  fallback: string;
  splashBgColor: string;
  pwaBgColor: string;
  pwaThemeColor: string;
  loadingBranding: boolean;
  refreshBranding: () => Promise<void>;
  saveBrandingColors: (colors: BrandingColors) => Promise<boolean>;
}

const BrandingContext = createContext<BrandingContextType | null>(null);

function createInitialState(): Record<string, BrandingItem> {
  const map: Record<string, BrandingItem> = {};
  Object.keys(BRANDING_DEFAULTS).forEach((k) => {
    map[k] = {
      ...BRANDING_DEFAULTS[k]!,
      updated_at: new Date().toISOString(),
    };
  });
  return map;
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [brandingMap, setBrandingMap] = useState<Record<string, BrandingItem>>(createInitialState);
  const [colors, setColors] = useState<BrandingColors>(BRANDING_COLORS_DEFAULT);
  const [loadingBranding, setLoadingBranding] = useState(true);

  const fetchBranding = useServerFn(getBrandingSettings);
  const fetchColors = useServerFn(getBrandingColors);
  const doUpdateColors = useServerFn(updateBrandingColors);

  const refreshBranding = useCallback(async () => {
    try {
      const [items, loadedColors] = await Promise.all([
        fetchBranding().catch((e) => {
          console.warn("[BrandingContext] Falha ao ler itens de marca:", e);
          return null;
        }),
        fetchColors().catch((e) => {
          console.warn("[BrandingContext] Falha ao ler cores de marca:", e);
          return null;
        }),
      ]);

      if (Array.isArray(items) && items.length > 0) {
        const nextMap: Record<string, BrandingItem> = { ...brandingMap };
        items.forEach((it) => {
          nextMap[it.key] = it;
        });
        setBrandingMap(nextMap);

        // Atualiza dinamicamente o Favicon no documento
        const fav = nextMap["favicon"]?.file_url;
        if (fav && typeof document !== "undefined") {
          let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
          if (!link) {
            link = document.createElement("link");
            link.rel = "icon";
            document.head.appendChild(link);
          }
          const v = nextMap["favicon"]?.updated_at ? new Date(nextMap["favicon"].updated_at).getTime() : Date.now();
          link.href = `${fav}${fav.includes("?") ? "&" : "?"}v=${v}`;
        }
      }

      if (loadedColors) {
        setColors(loadedColors);
        if (typeof document !== "undefined") {
          const timestamp = Date.now();

          // 1. Atualiza meta name="theme-color"
          let meta = document.querySelector("meta[name='theme-color']") as HTMLMetaElement | null;
          if (!meta) {
            meta = document.createElement("meta");
            meta.name = "theme-color";
            document.head.appendChild(meta);
          }
          meta.content = loadedColors.pwa_theme_color || loadedColors.pwa_bg_color || "#D4AF37";

          // 2. Atualiza manifest com cache-buster para que o navegador recarregue as cores imediatamente
          const manifestLink = document.querySelector("link[rel='manifest']") as HTMLLinkElement | null;
          if (manifestLink) {
            manifestLink.href = `/manifest.webmanifest?v=${timestamp}`;
          }

          // 3. Atualiza apple-touch-icon no iOS
          const appleIcons = document.querySelectorAll("link[rel='apple-touch-icon']");
          appleIcons.forEach((el) => {
            const link = el as HTMLLinkElement;
            const base = link.href.split("?")[0];
            link.href = `${base}?v=${timestamp}`;
          });
        }
      }
    } catch (err) {
      console.warn("[BrandingContext] Falha ao carregar configurações de marca:", err);
    } finally {
      setLoadingBranding(false);
    }
  }, [fetchBranding, fetchColors]);

  useEffect(() => {
    void refreshBranding();
  }, [refreshBranding]);

  const saveBrandingColors = useCallback(
    async (newColors: BrandingColors): Promise<boolean> => {
      setColors(newColors);
      const timestamp = Date.now();

      if (typeof document !== "undefined") {
        let meta = document.querySelector("meta[name='theme-color']") as HTMLMetaElement | null;
        if (!meta) {
          meta = document.createElement("meta");
          meta.name = "theme-color";
          document.head.appendChild(meta);
        }
        meta.content = newColors.pwa_theme_color || newColors.pwa_bg_color || "#D4AF37";

        const manifestLink = document.querySelector("link[rel='manifest']") as HTMLLinkElement | null;
        if (manifestLink) {
          manifestLink.href = `/manifest.webmanifest?v=${timestamp}`;
        }

        const appleIcons = document.querySelectorAll("link[rel='apple-touch-icon']");
        appleIcons.forEach((el) => {
          const link = el as HTMLLinkElement;
          const base = link.href.split("?")[0];
          link.href = `${base}?v=${timestamp}`;
        });
      }

      const res = await doUpdateColors({ data: newColors });
      if (res?.success) {
        return true;
      }
      return false;
    },
    [doUpdateColors]
  );

  const value: BrandingContextType = {
    branding: brandingMap,
    logoPrimary: brandingMap["logo_primary"]?.file_url || "/bagshoes-logo.png",
    logoCompact: brandingMap["logo_compact"]?.file_url || "/bagshoes-logo.png",
    logoLogin: brandingMap["logo_login"]?.file_url || "/bagshoes-logo.png",
    splash: brandingMap["splash"]?.file_url || "/bagshoes-logo-white.png",
    appIcon: brandingMap["app_icon"]?.file_path ? brandingMap["app_icon"].file_url : "/app-icon-512.png",
    pwaIcon: brandingMap["pwa_icon"]?.file_path ? brandingMap["pwa_icon"].file_url : "/bagshoes-logo-white.png",
    favicon: brandingMap["favicon"]?.file_url || "/favicon.png",
    loading: brandingMap["loading"]?.file_url || "/bagshoes-logo-white.png",
    fallback: brandingMap["fallback"]?.file_url || "/bagshoes-logo.png",
    splashBgColor: colors.splash_bg_color || BRANDING_COLORS_DEFAULT.splash_bg_color,
    pwaBgColor: colors.pwa_bg_color || BRANDING_COLORS_DEFAULT.pwa_bg_color,
    pwaThemeColor: colors.pwa_theme_color || BRANDING_COLORS_DEFAULT.pwa_theme_color,
    loadingBranding,
    refreshBranding,
    saveBrandingColors,
  };

  return <BrandingContext.Provider value={value}>{children}</BrandingContext.Provider>;
}

export function useBranding(): BrandingContextType {
  const ctx = useContext(BrandingContext);
  if (!ctx) {
    // Fallback defensivo caso seja chamado fora do provider
    return {
      branding: createInitialState(),
      logoPrimary: "/bagshoes-logo.png",
      logoCompact: "/bagshoes-logo.png",
      logoLogin: "/bagshoes-logo.png",
      splash: "/bagshoes-logo-white.png",
      appIcon: "/app-icon-512.png",
      pwaIcon: "/app-icon-512.png",
      favicon: "/favicon.png",
      loading: "/bagshoes-logo-white.png",
      fallback: "/bagshoes-logo.png",
      splashBgColor: BRANDING_COLORS_DEFAULT.splash_bg_color,
      pwaBgColor: BRANDING_COLORS_DEFAULT.pwa_bg_color,
      pwaThemeColor: BRANDING_COLORS_DEFAULT.pwa_theme_color,
      loadingBranding: false,
      refreshBranding: async () => {},
      saveBrandingColors: async () => false,
    };
  }
  return ctx;
}
