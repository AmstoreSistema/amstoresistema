import React, { useState, useRef, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  uploadBrandingImage,
  removeBrandingImage,
  BrandingItem,
} from "@/lib/branding.functions";
import { useBranding } from "@/contexts/BrandingContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Upload,
  Trash2,
  Eye,
  Loader2,
  Sparkles,
  Info,
  RefreshCw,
  CheckCircle2,
  Palette,
  RotateCcw,
  Smartphone,
  Save,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { BrandingPreviewModal } from "./BrandingPreviewModal";

interface BrandingConfigMeta {
  key: string;
  recommendedSize: string;
  recommendedFormat: string;
  maxDimensionNote?: string;
}

const BRANDING_META: Record<string, BrandingConfigMeta> = {
  logo_primary: {
    key: "logo_primary",
    recommendedSize: "300x80 px",
    recommendedFormat: "PNG, SVG, WEBP (transparente)",
    maxDimensionNote: "Versão horizontal para o topo e menu aberto",
  },
  logo_compact: {
    key: "logo_compact",
    recommendedSize: "80x80 px",
    recommendedFormat: "PNG, SVG (quadrada / ícone)",
    maxDimensionNote: "Símbolo para quando o menu estiver recolhido",
  },
  logo_login: {
    key: "logo_login",
    recommendedSize: "360x120 px",
    recommendedFormat: "PNG, SVG, WEBP",
    maxDimensionNote: "Logomarca em destaque no card de login",
  },
  splash: {
    key: "splash",
    recommendedSize: "1080x1920 px ou 1024x1024 px",
    recommendedFormat: "PNG branco transparente",
    maxDimensionNote: "Logo branca transparente sobre a cor de fundo configurada",
  },
  app_icon: {
    key: "app_icon",
    recommendedSize: "512x512 px",
    recommendedFormat: "PNG (alta resolução)",
    maxDimensionNote: "Ícone mestre para representação do sistema",
  },
  pwa_icon: {
    key: "pwa_icon",
    recommendedSize: "512x512 px",
    recommendedFormat: "PNG",
    maxDimensionNote: "Ícone para instalação como app no celular / desktop",
  },
  favicon: {
    key: "favicon",
    recommendedSize: "64x64 px ou 32x32 px",
    recommendedFormat: "PNG, ICO, SVG",
    maxDimensionNote: "Ícone na aba do navegador",
  },
  loading: {
    key: "loading",
    recommendedSize: "120x120 px",
    recommendedFormat: "SVG, PNG, GIF",
    maxDimensionNote: "Exibido em telas de carregamento interno",
  },
  fallback: {
    key: "fallback",
    recommendedSize: "400x400 px",
    recommendedFormat: "PNG, WEBP, JPG",
    maxDimensionNote: "Exibido quando fotos de produtos não estiverem disponíveis",
  },
};

const COLOR_PRESETS = [
  { name: "Dourado Nobre", hex: "#D4AF37" },
  { name: "Preto Luxo", hex: "#0A0A0C" },
  { name: "Grafite Escuro", hex: "#18181B" },
  { name: "Vinho Elegante", hex: "#382430" },
  { name: "Bordô Velvet", hex: "#4A0E2E" },
  { name: "Azul Noturno", hex: "#0F172A" },
  { name: "Verde Esmeralda", hex: "#064E3B" },
  { name: "Âmbar Imperial", hex: "#78350F" },
];

export function BrandingSettingsTab() {
  const {
    branding,
    splash,
    pwaIcon,
    splashBgColor,
    pwaBgColor,
    pwaThemeColor,
    refreshBranding,
    saveBrandingColors,
  } = useBranding();

  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Estados locais para edição de cores
  const [localSplashBg, setLocalSplashBg] = useState<string>(splashBgColor || "#D4AF37");
  const [localPwaBg, setLocalPwaBg] = useState<string>(pwaBgColor || "#D4AF37");
  const [localPwaTheme, setLocalPwaTheme] = useState<string>(pwaThemeColor || "#D4AF37");
  const [savingColors, setSavingColors] = useState(false);

  // Sincroniza quando os dados do servidor chegam
  useEffect(() => {
    if (splashBgColor) setLocalSplashBg(splashBgColor);
    if (pwaBgColor) setLocalPwaBg(pwaBgColor);
    if (pwaThemeColor) setLocalPwaTheme(pwaThemeColor);
  }, [splashBgColor, pwaBgColor, pwaThemeColor]);

  const hasColorChanges =
    localSplashBg.toUpperCase() !== (splashBgColor || "#D4AF37").toUpperCase() ||
    localPwaBg.toUpperCase() !== (pwaBgColor || "#D4AF37").toUpperCase() ||
    localPwaTheme.toUpperCase() !== (pwaThemeColor || "#D4AF37").toUpperCase();

  const doUpload = useServerFn(uploadBrandingImage);
  const doRemove = useServerFn(removeBrandingImage);

  const handleSaveColors = async () => {
    const hexRegex = /^#[0-9a-fA-F]{6}$/;
    if (!hexRegex.test(localSplashBg) || !hexRegex.test(localPwaBg) || !hexRegex.test(localPwaTheme)) {
      toast.error("Insira códigos hexadecimais válidos no formato #RRGGBB (ex.: #D4AF37).");
      return;
    }

    setSavingColors(true);
    try {
      const ok = await saveBrandingColors({
        splash_bg_color: localSplashBg.toUpperCase(),
        pwa_bg_color: localPwaBg.toUpperCase(),
        pwa_theme_color: localPwaTheme.toUpperCase(),
      });

      if (ok) {
        toast.success("Cores de fundo do Splash Screen e do PWA salvas com sucesso!");
        await refreshBranding();
      } else {
        toast.error("Erro ao salvar cores de fundo.");
      }
    } catch (err: any) {
      console.error("Erro ao salvar cores:", err);
      toast.error(`Erro ao salvar: ${err?.message || "Falha inesperada"}`);
    } finally {
      setSavingColors(false);
    }
  };

  const handleResetColors = async () => {
    setLocalSplashBg("#D4AF37");
    setLocalPwaBg("#D4AF37");
    setLocalPwaTheme("#D4AF37");

    setSavingColors(true);
    try {
      const ok = await saveBrandingColors({
        splash_bg_color: "#D4AF37",
        pwa_bg_color: "#D4AF37",
        pwa_theme_color: "#D4AF37",
      });

      if (ok) {
        toast.success("Cores restauradas para o dourado padrão (#D4AF37)!");
        await refreshBranding();
      }
    } catch (err: any) {
      toast.error(`Erro ao restaurar: ${err?.message}`);
    } finally {
      setSavingColors(false);
    }
  };

  const handleFileChange = async (key: string, file: File) => {
    const validMimes = [
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "image/svg+xml",
      "image/x-icon",
      "image/vnd.microsoft.icon",
    ];

    if (!validMimes.includes(file.type.toLowerCase())) {
      toast.error("Formato não permitido. Utilize PNG, JPG, WEBP, SVG ou ICO.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Arquivo muito grande. O tamanho máximo permitido é de 5MB.");
      return;
    }

    setUploadingKey(key);

    try {
      const { dataUrl, width, height } = await new Promise<{
        dataUrl: string;
        width: number | null;
        height: number | null;
      }>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          if (file.type.includes("svg")) {
            resolve({ dataUrl: result, width: null, height: null });
            return;
          }
          const img = new Image();
          img.onload = () => {
            resolve({ dataUrl: result, width: img.naturalWidth, height: img.naturalHeight });
          };
          img.onerror = () => resolve({ dataUrl: result, width: null, height: null });
          img.src = result;
        };
        reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
        reader.readAsDataURL(file);
      });

      const res = await doUpload({
        data: {
          key,
          dataUrl,
          fileName: file.name,
          width,
          height,
        },
      });

      if (res?.success) {
        toast.success(`Imagem para "${branding[key]?.name || key}" atualizada com sucesso!`);
        await refreshBranding();
      } else {
        toast.error("Erro ao salvar imagem.");
      }
    } catch (err: any) {
      console.error("Erro no upload de branding:", err);
      toast.error(`Erro no upload: ${err.message || "Falha inesperada"}`);
    } finally {
      setUploadingKey(null);
      if (fileInputRefs.current[key]) {
        fileInputRefs.current[key]!.value = "";
      }
    }
  };

  const handleRemove = async (key: string) => {
    setRemovingKey(key);
    try {
      const res = await doRemove({ data: { key } });
      if (res?.success) {
        toast.success(`Imagem de "${branding[key]?.name || key}" restaurada para o padrão!`);
        await refreshBranding();
      }
    } catch (err: any) {
      console.error("Erro ao remover imagem:", err);
      toast.error(`Erro ao remover: ${err.message}`);
    } finally {
      setRemovingKey(null);
    }
  };

  const keys = Object.keys(BRANDING_META);

  return (
    <div className="space-y-8">
      {/* Top Banner & Ações */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl border border-gold/40 bg-gradient-to-r from-card via-card/90 to-gold/10 shadow-lg">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <Sparkles className="size-5 text-gold" />
            <h3 className="text-xl font-bold tracking-tight text-foreground">
              Identidade Visual & Logomarca
            </h3>
            <Badge variant="outline" className="border-gold/50 text-gold text-xs font-semibold">
              Personalização Global
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Configure e altere todas as imagens da marca e as cores de fundo do Splash Screen e da instalação PWA.
            As alterações são salvas com segurança no banco de dados e refletem imediatamente em todas as páginas, no app e na tela de login.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refreshBranding()}
            className="rounded-xl border-border/70 hover:border-gold/50"
          >
            <RefreshCw className="size-4 mr-2" />
            Atualizar
          </Button>

          <Button
            type="button"
            onClick={() => setPreviewModalOpen(true)}
            className="rounded-xl bg-gold hover:bg-gold/90 text-black font-bold shadow-lg shadow-gold/20"
          >
            <Eye className="size-4 mr-2" />
            Visualizar aplicação
          </Button>
        </div>
      </div>

      {/* NOVO: Seção de Personalização das Cores do Splash Screen e do PWA */}
      <Card className="rounded-3xl border-gold/40 bg-card/80 backdrop-blur-md shadow-xl overflow-hidden">
        <CardHeader className="p-6 pb-4 border-b border-border/50 bg-gradient-to-r from-gold/10 via-transparent to-transparent">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Palette className="size-5 text-gold" />
                <CardTitle className="text-lg font-bold text-foreground">
                  Cores do Splash Screen & Instalação PWA
                </CardTitle>
                {hasColorChanges && (
                  <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/40 text-[10px] font-bold animate-pulse">
                    Alterações não salvas
                  </Badge>
                )}
              </div>
              <CardDescription className="text-xs max-w-2xl">
                Adapte as cores de fundo do Splash de inicialização e do aplicativo instalado PWA conforme seu gosto.
                Veja a prévia em tempo real abaixo enquanto escolhe as cores.
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={savingColors}
                onClick={handleResetColors}
                className="rounded-xl border-border/70 hover:border-gold/40 text-xs h-9"
              >
                <RotateCcw className="size-3.5 mr-1.5" />
                Restaurar Padrão
              </Button>

              <Button
                type="button"
                size="sm"
                disabled={savingColors}
                onClick={handleSaveColors}
                className={`rounded-xl font-bold text-xs h-9 transition-all shadow-md ${
                  hasColorChanges
                    ? "bg-gold hover:bg-gold/90 text-black shadow-gold/30 animate-bounce"
                    : "bg-gold/90 hover:bg-gold text-black"
                }`}
              >
                {savingColors ? (
                  <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Save className="size-3.5 mr-1.5" />
                )}
                Salvar Cores
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 1. Controle da Cor do Splash Screen */}
            <div className="p-5 rounded-2xl border border-border/60 bg-muted/20 flex flex-col justify-between gap-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="size-3 rounded-full bg-gold" />
                    <h4 className="font-bold text-sm text-foreground">Fundo do Splash Screen</h4>
                  </div>
                  <span className="text-[11px] font-mono text-gold font-bold px-2 py-0.5 rounded-lg bg-gold/10 border border-gold/30">
                    {localSplashBg}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Cor de fundo da tela de abertura exibida ao iniciar o sistema em celulares e computadores.
                </p>

                {/* Seletor Hex + Color Picker Nativo */}
                <div className="flex items-center gap-3 pt-1">
                  <div className="relative flex items-center justify-center">
                    <input
                      type="color"
                      aria-label="Escolher cor de fundo do Splash Screen"
                      value={localSplashBg}
                      onChange={(e) => setLocalSplashBg(e.target.value.toUpperCase())}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                    />
                    <div
                      className="size-11 rounded-xl border-2 border-border/80 shadow-md cursor-pointer transition-transform hover:scale-105 flex items-center justify-center"
                      style={{ backgroundColor: localSplashBg }}
                    >
                      <Palette className="size-4 text-white drop-shadow" />
                    </div>
                  </div>

                  <div className="flex-1">
                    <Input
                      type="text"
                      aria-label="Código Hexadecimal da cor do Splash Screen"
                      value={localSplashBg}
                      maxLength={7}
                      onChange={(e) => {
                        let val = e.target.value;
                        if (!val.startsWith("#")) val = "#" + val;
                        setLocalSplashBg(val.toUpperCase());
                      }}
                      className="h-11 font-mono text-xs uppercase font-bold tracking-widest bg-background/80 border-border/80"
                      placeholder="#D4AF37"
                    />
                  </div>
                </div>

                {/* Paleta Rápida de Cores Elegantes */}
                <div className="space-y-1.5 pt-2">
                  <span className="text-[11px] font-semibold text-muted-foreground block">
                    Sugestões de Cores Elegantes:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {COLOR_PRESETS.map((preset) => {
                      const isSelected = localSplashBg.toUpperCase() === preset.hex.toUpperCase();
                      return (
                        <button
                          key={preset.hex}
                          type="button"
                          onClick={() => setLocalSplashBg(preset.hex)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold border transition-all ${
                            isSelected
                              ? "border-gold bg-gold/20 text-gold shadow-sm font-bold scale-105"
                              : "border-border/60 bg-muted/40 text-muted-foreground hover:border-gold/40 hover:text-foreground"
                          }`}
                        >
                          <span
                            className="size-2.5 rounded-full border border-black/30 shrink-0"
                            style={{ backgroundColor: preset.hex }}
                          />
                          <span>{preset.name}</span>
                          {isSelected && <Check className="size-3 text-gold" />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Prévia ao Vivo do Splash */}
              <div className="pt-3 border-t border-border/40 flex items-center justify-between gap-4">
                <div className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground block">Prévia em Tempo Real:</span>
                  A logo branca com fundo transparente se adapta dinamicamente sobre a cor escolhida.
                </div>

                <div
                  className="w-24 h-36 rounded-2xl border-2 border-white/20 shadow-xl overflow-hidden flex flex-col items-center justify-center p-2 relative shrink-0 transition-all duration-300"
                  style={{
                    backgroundColor: localSplashBg,
                    backgroundImage: `radial-gradient(circle at 50% 45%, rgba(255, 255, 255, 0.18) 0%, rgba(0, 0, 0, 0.28) 100%)`,
                  }}
                >
                  <img
                    src={splash && !splash.includes("splash-startup") ? splash : "/bagshoes-logo-white.png"}
                    alt="Splash Preview"
                    className="max-h-12 w-auto max-w-[80px] object-contain drop-shadow animate-pulse"
                  />
                  <div className="mt-3 flex items-center gap-1">
                    <div className="size-1 rounded-full bg-white animate-bounce [animation-delay:-0.3s]" />
                    <div className="size-1 rounded-full bg-white animate-bounce [animation-delay:-0.15s]" />
                    <div className="size-1 rounded-full bg-white animate-bounce" />
                  </div>
                  <span className="absolute bottom-1 text-[8px] font-bold text-white/80 uppercase tracking-widest drop-shadow">
                    Splash
                  </span>
                </div>
              </div>
            </div>

            {/* 2. Controle das Cores do PWA (Fundo da Janela e Barra de Status) */}
            <div className="p-5 rounded-2xl border border-border/60 bg-muted/20 flex flex-col justify-between gap-5">
              <div className="space-y-4">
                {/* 2.1 Cor de Fundo da Instalação PWA */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Smartphone className="size-4 text-gold" />
                      <h4 className="font-bold text-sm text-foreground">Fundo da Instalação PWA</h4>
                    </div>
                    <span className="text-[11px] font-mono text-gold font-bold px-2 py-0.5 rounded-lg bg-gold/10 border border-gold/30">
                      {localPwaBg}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Cor de fundo da janela do aplicativo instalado no celular e nos cards de instalação.
                  </p>

                  <div className="flex items-center gap-3 pt-1">
                    <div className="relative flex items-center justify-center">
                      <input
                        type="color"
                        aria-label="Escolher cor de fundo da instalação PWA"
                        value={localPwaBg}
                        onChange={(e) => setLocalPwaBg(e.target.value.toUpperCase())}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                      />
                      <div
                        className="size-11 rounded-xl border-2 border-border/80 shadow-md cursor-pointer transition-transform hover:scale-105 flex items-center justify-center"
                        style={{ backgroundColor: localPwaBg }}
                      >
                        <Palette className="size-4 text-white drop-shadow" />
                      </div>
                    </div>

                    <div className="flex-1">
                      <Input
                        type="text"
                        aria-label="Código Hexadecimal da cor de fundo do PWA"
                        value={localPwaBg}
                        maxLength={7}
                        onChange={(e) => {
                          let val = e.target.value;
                          if (!val.startsWith("#")) val = "#" + val;
                          setLocalPwaBg(val.toUpperCase());
                        }}
                        className="h-11 font-mono text-xs uppercase font-bold tracking-widest bg-background/80 border-border/80"
                        placeholder="#D4AF37"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {COLOR_PRESETS.map((preset) => {
                      const isSelected = localPwaBg.toUpperCase() === preset.hex.toUpperCase();
                      return (
                        <button
                          key={preset.hex}
                          type="button"
                          onClick={() => setLocalPwaBg(preset.hex)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold border transition-all ${
                            isSelected
                              ? "border-gold bg-gold/20 text-gold shadow-sm font-bold scale-105"
                              : "border-border/60 bg-muted/40 text-muted-foreground hover:border-gold/40 hover:text-foreground"
                          }`}
                        >
                          <span
                            className="size-2.5 rounded-full border border-black/30 shrink-0"
                            style={{ backgroundColor: preset.hex }}
                          />
                          <span>{preset.name}</span>
                          {isSelected && <Check className="size-3 text-gold" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2.2 Cor do Tema / Barra de Status */}
                <div className="space-y-2 pt-2 border-t border-border/40">
                  <div className="flex items-center justify-between">
                    <h5 className="font-bold text-xs text-foreground">
                      Cor da Barra Superior do Celular (theme-color)
                    </h5>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setLocalPwaTheme(localPwaBg)}
                      className="text-[11px] h-6 px-2 text-gold hover:text-gold/90 hover:bg-gold/10"
                    >
                      <Copy className="size-3 mr-1" />
                      Igualar ao Fundo PWA
                    </Button>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="relative flex items-center justify-center">
                      <input
                        type="color"
                        aria-label="Escolher cor do tema e barra de status PWA"
                        value={localPwaTheme}
                        onChange={(e) => setLocalPwaTheme(e.target.value.toUpperCase())}
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer z-10"
                      />
                      <div
                        className="size-9 rounded-lg border border-border shadow-sm cursor-pointer flex items-center justify-center"
                        style={{ backgroundColor: localPwaTheme }}
                      >
                        <Palette className="size-3.5 text-white drop-shadow" />
                      </div>
                    </div>

                    <div className="flex-1">
                      <Input
                        type="text"
                        aria-label="Código Hexadecimal do tema da barra de status"
                        value={localPwaTheme}
                        maxLength={7}
                        onChange={(e) => {
                          let val = e.target.value;
                          if (!val.startsWith("#")) val = "#" + val;
                          setLocalPwaTheme(val.toUpperCase());
                        }}
                        className="h-9 font-mono text-xs uppercase font-bold tracking-wider bg-background/80 border-border/80"
                        placeholder="#D4AF37"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Prévia ao Vivo do PWA */}
              <div className="pt-3 border-t border-border/40 flex items-center justify-between gap-4">
                <div className="text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground block">Prévia PWA no Celular:</span>
                  Simulação do ícone na tela inicial e da barra de status superior.
                </div>

                <div className="w-24 h-36 rounded-2xl border-2 border-border/70 bg-neutral-950 shadow-xl overflow-hidden flex flex-col justify-between p-2 relative shrink-0">
                  {/* Mini Barra Superior */}
                  <div
                    className="w-full h-3 rounded-md flex items-center justify-end px-1 transition-colors duration-300"
                    style={{ backgroundColor: localPwaTheme }}
                  >
                    <div className="size-1 rounded-full bg-white/80" />
                  </div>

                  {/* Mini Ícone */}
                  <div className="flex flex-col items-center my-auto">
                    <div
                      className="size-11 rounded-xl p-1.5 flex items-center justify-center shadow-md border border-white/20 transition-all duration-300"
                      style={{ backgroundColor: localPwaBg }}
                    >
                      <img
                        src={pwaIcon && !pwaIcon.includes("app-icon-") ? pwaIcon : "/bagshoes-logo-white.png"}
                        alt="PWA Icon Preview"
                        className="size-full object-contain drop-shadow"
                      />
                    </div>
                    <span className="text-[8px] font-bold text-white/90 mt-1 truncate max-w-[70px]">
                      Amstore
                    </span>
                  </div>

                  <span className="text-center text-[8px] font-bold text-muted-foreground uppercase tracking-wider">
                    PWA
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Título da Seção de Imagens */}
      <div className="flex items-center justify-between pt-2">
        <div>
          <h3 className="text-lg font-bold text-foreground">Imagens e Logomarcas do Sistema</h3>
          <p className="text-xs text-muted-foreground">
            Gerencie cada um dos arquivos da identidade visual. Faça upload para alterar ou clique em remover para restaurar a imagem padrão.
          </p>
        </div>
      </div>

      {/* Grid de Cards de Imagem */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {keys.map((key) => {
          const item = branding[key];
          const meta = BRANDING_META[key];
          const isUploading = uploadingKey === key;
          const isRemoving = removingKey === key;
          const isCustom = !!item?.file_path;

          return (
            <Card
              key={key}
              className="rounded-3xl border-border/50 bg-card/60 backdrop-blur-sm shadow-md hover:shadow-xl hover:border-gold/40 transition-all flex flex-col justify-between overflow-hidden group"
            >
              <CardHeader className="p-6 pb-4 border-b border-border/40 bg-muted/20">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="text-base font-bold text-foreground group-hover:text-gold transition-colors">
                      {item?.name || key}
                    </CardTitle>
                    <CardDescription className="text-xs line-clamp-2">
                      {item?.description}
                    </CardDescription>
                  </div>
                  {isCustom ? (
                    <Badge className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold shrink-0">
                      Personalizado
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] text-muted-foreground shrink-0">
                      Padrão
                    </Badge>
                  )}
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-5 flex-1 flex flex-col justify-between">
                {/* Visualizador da Imagem com Fundo Transparente */}
                <div className="space-y-2">
                  <div
                    className="relative w-full h-40 rounded-2xl border border-border/60 overflow-hidden flex items-center justify-center p-3 shadow-inner group/box"
                    style={{
                      backgroundImage:
                        "repeating-conic-gradient(#1e1e24 0% 25%, #141418 0% 50%) 50% / 16px 16px",
                    }}
                  >
                    {isUploading ? (
                      <div className="flex flex-col items-center gap-2 text-gold">
                        <Loader2 className="size-8 animate-spin" />
                        <span className="text-xs font-semibold">Enviando imagem...</span>
                      </div>
                    ) : item?.file_url ? (
                      <img
                        src={
                          !item?.file_path && (key === "pwa_icon" || key === "app_icon")
                            ? `/api/public/pwa-icon?variant=512&color=${localPwaBg.replace("#", "")}`
                            : item.file_url
                        }
                        alt={item.name}
                        className="max-h-full max-w-full object-contain drop-shadow-md transition-transform group-hover/box:scale-105"
                      />
                    ) : (
                      <div className="flex flex-col items-center text-muted-foreground text-xs">
                        <Info className="size-6 mb-1" />
                        Sem imagem
                      </div>
                    )}
                  </div>

                  {/* Informações Técnicas */}
                  <div className="space-y-1 text-[11px] text-muted-foreground bg-muted/30 p-2.5 rounded-xl border border-border/40">
                    <div className="flex justify-between">
                      <span className="font-semibold text-foreground/80">Recomendado:</span>
                      <span>{meta?.recommendedSize || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-semibold text-foreground/80">Formatos:</span>
                      <span>{meta?.recommendedFormat || "-"}</span>
                    </div>
                    {item?.file_size && (
                      <div className="flex justify-between text-muted-foreground/80 pt-1 border-t border-border/30">
                        <span>Tamanho:</span>
                        <span>{(item.file_size / 1024).toFixed(1)} KB</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Ações */}
                <div className="space-y-3 pt-2">
                  <input
                    type="file"
                    ref={(el) => {
                      fileInputRefs.current[key] = el;
                    }}
                    accept="image/png,image/jpeg,image/webp,image/svg+xml,image/x-icon"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileChange(key, file);
                    }}
                  />

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      disabled={isUploading || isRemoving}
                      onClick={() => fileInputRefs.current[key]?.click()}
                      className="flex-1 rounded-xl bg-gold hover:bg-gold/90 text-black font-bold h-9 text-xs shadow-sm"
                    >
                      {isUploading ? (
                        <Loader2 className="size-3.5 mr-2 animate-spin" />
                      ) : (
                        <Upload className="size-3.5 mr-2" />
                      )}
                      Alterar imagem
                    </Button>

                    {isCustom && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isUploading || isRemoving}
                        onClick={() => handleRemove(key)}
                        className="rounded-xl border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 h-9 px-3"
                        title="Remover imagem personalizada e restaurar padrão"
                      >
                        {isRemoving ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                      </Button>
                    )}
                  </div>

                  {item?.updated_at && (
                    <p className="text-[10px] text-center text-muted-foreground/60">
                      Atualizado em: {new Date(item.updated_at).toLocaleDateString("pt-BR")} às{" "}
                      {new Date(item.updated_at).toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Modal de Prévia ao Vivo */}
      <BrandingPreviewModal
        open={previewModalOpen}
        onOpenChange={setPreviewModalOpen}
      />
    </div>
  );
}
