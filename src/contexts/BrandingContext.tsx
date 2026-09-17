import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getBrandingSettings, BrandingItem, BRANDING_DEFAULTS } from "@/lib/branding.functions";

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
  loadingBranding: boolean;
  refreshBranding: () => Promise<void>;
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
  const [loadingBranding, setLoadingBranding] = useState(true);
  const fetchBranding = useServerFn(getBrandingSettings);

  const refreshBranding = useCallback(async () => {
    try {
      const items = await fetchBranding();
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
    } catch (err) {
      console.warn("[BrandingContext] Falha ao carregar configurações de marca:", err);
    } finally {
      setLoadingBranding(false);
    }
  }, [fetchBranding]);

  useEffect(() => {
    void refreshBranding();
  }, [refreshBranding]);

  const value: BrandingContextType = {
    branding: brandingMap,
    logoPrimary: brandingMap["logo_primary"]?.file_url || "/bagshoes-logo.png",
    logoCompact: brandingMap["logo_compact"]?.file_url || "/bagshoes-logo.png",
    logoLogin: brandingMap["logo_login"]?.file_url || "/bagshoes-logo.png",
    splash: brandingMap["splash"]?.file_url || "/bagshoes-logo-white.png",
    appIcon: brandingMap["app_icon"]?.file_url || "/app-icon-512.png",
    pwaIcon: brandingMap["pwa_icon"]?.file_url || "/app-icon-512.png",
    favicon: brandingMap["favicon"]?.file_url || "/favicon.png",
    loading: brandingMap["loading"]?.file_url || "/bagshoes-logo-white.png",
    fallback: brandingMap["fallback"]?.file_url || "/bagshoes-logo.png",
    loadingBranding,
    refreshBranding,
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
      loadingBranding: false,
      refreshBranding: async () => {},
    };
  }
  return ctx;
}
