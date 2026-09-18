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
    recommendedSize: "576x1024 px ou 1080x1920 px",
    recommendedFormat: "PNG transparente",
    maxDimensionNote: "Logo centralizada exibida sobre fundo preto elegante",
  },
  app_icon: {
    key: "app_icon",
    recommendedSize: "512x512 px ou 1024x1024 px",
    recommendedFormat: "PNG ou JPG (alta resolução)",
    maxDimensionNote: "Ícone mestre para representação do sistema",
  },
  pwa_icon: {
    key: "pwa_icon",
    recommendedSize: "512x512 px ou 1024x1024 px",
    recommendedFormat: "PNG ou JPG",
    maxDimensionNote: "Ícone oficial para instalação no celular ou computador",
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

export function BrandingSettingsTab() {
  const {
    branding,
    refreshBranding,
  } = useBranding();

  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const doUpload = useServerFn(uploadBrandingImage);
  const doRemove = useServerFn(removeBrandingImage);

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
            Configure e altere todas as imagens da marca e logomarca do sistema. O Splash de inicialização e o aplicativo PWA utilizam um elegante fundo preto oficial com a logomarca e o ícone cadastrados.
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
                      backgroundColor: key === "splash" ? "#000000" : undefined,
                      backgroundImage:
                        key === "splash"
                          ? undefined
                          : "repeating-conic-gradient(#1e1e24 0% 25%, #141418 0% 50%) 50% / 16px 16px",
                    }}
                  >
                    {isUploading ? (
                      <div className="flex flex-col items-center gap-2 text-gold">
                        <Loader2 className="size-8 animate-spin" />
                        <span className="text-xs font-semibold">Enviando imagem...</span>
                      </div>
                    ) : item?.file_url ? (
                      <img
                        src={item.file_url}
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
