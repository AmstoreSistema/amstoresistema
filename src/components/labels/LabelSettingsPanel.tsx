import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Printer,
  Monitor,
  Save,
  RotateCcw,
  Trash2,
  Type,
  Ruler,
  Grid3X3,
  Move,
  Layers,
  AlertTriangle,
  AlignLeft,
  AlignCenter,
} from "lucide-react";
import { toast } from "sonner";
import type {
  LabelSettings,
  A4Profile,
  ThermalProfile,
  LabelContentSettings,
  LabelFieldConfig,
  PrinterProfile,
  ValidationResult,
} from "@/hooks/use-label-settings";
import { A4_PRESETS, THERMAL_HEIGHT_OPTIONS } from "@/hooks/use-label-settings";

// ─── Numeric Input with mm unit ──────────────────────────────────────
function MmInput({
  label,
  value,
  onChange,
  min = -50,
  max = 300,
  step = 0.1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </Label>
      <div className="relative">
        <Input
          type="number"
          step={step}
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-8 text-xs pr-8 font-mono bg-background"
        />
        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-muted-foreground font-bold">
          mm
        </span>
      </div>
    </div>
  );
}

// ─── Field Toggle Row ────────────────────────────────────────────────
function FieldToggle({
  label,
  config,
  onChange,
}: {
  label: string;
  config: LabelFieldConfig;
  onChange: (patch: Partial<LabelFieldConfig>) => void;
}) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
      <Switch
        checked={config.show}
        onCheckedChange={(v) => onChange({ show: v })}
        className="data-[state=checked]:bg-gold"
      />
      <div className="flex-1 min-w-0">
        <span className="text-xs font-bold">{label}</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-16">
          <Input
            type="number"
            min={4}
            max={24}
            step={0.5}
            value={config.fontSize}
            onChange={(e) => onChange({ fontSize: Number(e.target.value) })}
            disabled={!config.show}
            className="h-7 text-[10px] text-center font-mono"
          />
        </div>
        <span className="text-[9px] text-muted-foreground">pt</span>
        <Button
          variant={config.bold ? "default" : "outline"}
          size="sm"
          className="h-7 w-7 p-0 text-[10px] font-black"
          disabled={!config.show}
          onClick={() => onChange({ bold: !config.bold })}
        >
          B
        </Button>
      </div>
    </div>
  );
}

// ─── Main Settings Panel ─────────────────────────────────────────────
interface LabelSettingsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: LabelSettings;
  validation: ValidationResult;
  setActiveProfile: (p: PrinterProfile) => void;
  updateA4: (patch: Partial<A4Profile>) => void;
  updateThermal: (patch: Partial<ThermalProfile>) => void;
  updateA4Content: (patch: Partial<LabelContentSettings>) => void;
  updateThermalContent: (patch: Partial<LabelContentSettings>) => void;
  applyPreset: (id: string) => void;
  saveCustomPreset: (name: string) => string;
  deleteCustomPreset: (id: string) => void;
  resetToDefaults: () => void;
  onOpenTestSheet?: () => void;
}

export function LabelSettingsPanel({
  open,
  onOpenChange,
  settings,
  validation,
  setActiveProfile,
  updateA4,
  updateThermal,
  updateA4Content,
  updateThermalContent,
  applyPreset,
  saveCustomPreset,
  deleteCustomPreset,
  resetToDefaults,
  onOpenTestSheet,
}: LabelSettingsPanelProps) {
  const [savePresetOpen, setSavePresetOpen] = useState(false);
  const [presetName, setPresetName] = useState("");

  const a4 = settings.a4;
  const thermal = settings.thermal;
  const isA4 = settings.activeProfile === "a4";

  const allPresets = { ...A4_PRESETS, ...settings.customPresets };

  const activeContent = isA4 ? a4.content : thermal.content;
  const updateContent = isA4 ? updateA4Content : updateThermalContent;

  const handleFieldChange = (
    field: keyof LabelContentSettings,
    patch: Partial<LabelFieldConfig>
  ) => {
    const current = activeContent[field];
    if (typeof current === "object" && current !== null && "show" in current) {
      updateContent({ [field]: { ...current, ...patch } } as any);
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
          <SheetHeader className="p-4 pb-3 border-b shrink-0">
            <SheetTitle className="flex items-center gap-2 text-base">
              <div className="size-7 rounded-lg bg-gradient-dark flex items-center justify-center">
                <Printer className="size-3.5 text-gold" />
              </div>
              Configurações de Etiquetas
            </SheetTitle>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <div className="p-4 space-y-5">
              {/* ── Dimension Validation Alert ── */}
              {!validation.valid && (
                <div className="bg-destructive/15 border-2 border-destructive/40 rounded-xl p-3 text-destructive space-y-1.5 animate-in fade-in">
                  <div className="flex items-center gap-2 font-bold text-xs">
                    <AlertTriangle className="size-4 shrink-0" />
                    <span>Atenção: Dimensões Ultrapassam o Limite!</span>
                  </div>
                  {validation.errors.map((err, i) => (
                    <p key={i} className="text-[11px] leading-relaxed text-destructive/90">
                      • {err}
                    </p>
                  ))}
                </div>
              )}

              {/* ── Profile Selector ── */}
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Monitor className="size-3" /> Perfil de Impressora
                </Label>
                <Tabs
                  value={settings.activeProfile}
                  onValueChange={(v) => setActiveProfile(v as PrinterProfile)}
                  className="w-full"
                >
                  <TabsList className="w-full grid grid-cols-2 h-9">
                    <TabsTrigger value="a4" className="text-xs font-bold gap-1.5">
                      <Grid3X3 className="size-3" /> Folha A4
                    </TabsTrigger>
                    <TabsTrigger value="thermal" className="text-xs font-bold gap-1.5">
                      <Layers className="size-3" /> Térmica 80mm
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {/* ── A4 Settings ── */}
              {isA4 && (
                <div className="space-y-5">
                  {/* Preset selector */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Layers className="size-3" /> Modelo de Folha
                    </Label>
                    <div className="flex gap-2">
                      <Select
                        value={a4.presetId}
                        onValueChange={(v) => applyPreset(v)}
                      >
                        <SelectTrigger className="h-8 text-xs font-bold flex-1">
                          <SelectValue placeholder="Selecione..." />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(allPresets).map(([id, p]) => (
                            <SelectItem key={id} value={id}>
                              <div className="flex items-center gap-2">
                                {p.presetName}
                                {id.startsWith("custom-") && (
                                  <Badge variant="outline" className="text-[8px] h-4">
                                    Meu
                                  </Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1 text-[10px] font-bold shrink-0"
                        onClick={() => {
                          setPresetName("");
                          setSavePresetOpen(true);
                        }}
                      >
                        <Save className="size-3" /> Salvar
                      </Button>
                    </div>
                    {a4.presetId.startsWith("custom-") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] text-destructive hover:text-destructive"
                        onClick={() => {
                          deleteCustomPreset(a4.presetId);
                          applyPreset("pimaco-6080");
                          toast.success("Preset excluído");
                        }}
                      >
                        <Trash2 className="size-3 mr-1" /> Excluir Preset
                      </Button>
                    )}
                  </div>

                  {/* Sheet Margins */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Ruler className="size-3" /> Margens da Folha
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      <MmInput
                        label="Superior"
                        value={a4.marginTop}
                        onChange={(v) => updateA4({ marginTop: v })}
                        min={0}
                      />
                      <MmInput
                        label="Inferior"
                        value={a4.marginBottom}
                        onChange={(v) => updateA4({ marginBottom: v })}
                        min={0}
                      />
                      <MmInput
                        label="Esquerda"
                        value={a4.marginLeft}
                        onChange={(v) => updateA4({ marginLeft: v })}
                        min={0}
                      />
                      <MmInput
                        label="Direita"
                        value={a4.marginRight}
                        onChange={(v) => updateA4({ marginRight: v })}
                        min={0}
                      />
                    </div>
                  </div>

                  {/* Grid Config */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Grid3X3 className="size-3" /> Grade
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Colunas
                        </Label>
                        <Input
                          type="number"
                          min={1}
                          max={6}
                          value={a4.columns}
                          onChange={(e) =>
                            updateA4({
                              columns: Number(e.target.value),
                              presetId: "custom",
                              presetName: "Personalizado",
                            })
                          }
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                          Linhas
                        </Label>
                        <Input
                          type="number"
                          min={1}
                          max={25}
                          value={a4.rows}
                          onChange={(e) =>
                            updateA4({
                              rows: Number(e.target.value),
                              presetId: "custom",
                              presetName: "Personalizado",
                            })
                          }
                          className="h-8 text-xs font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Label Size */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Ruler className="size-3" /> Tamanho da Etiqueta
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      <MmInput
                        label="Largura"
                        value={a4.labelWidth}
                        onChange={(v) =>
                          updateA4({
                            labelWidth: v,
                            presetId: "custom",
                            presetName: "Personalizado",
                          })
                        }
                        min={10}
                        max={200}
                      />
                      <MmInput
                        label="Altura"
                        value={a4.labelHeight}
                        onChange={(v) =>
                          updateA4({
                            labelHeight: v,
                            presetId: "custom",
                            presetName: "Personalizado",
                          })
                        }
                        min={10}
                        max={150}
                      />
                    </div>
                  </div>

                  {/* Spacing */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Move className="size-3" /> Espaçamento entre Etiquetas
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      <MmInput
                        label="Horizontal"
                        value={a4.spacingH}
                        onChange={(v) => updateA4({ spacingH: v })}
                        min={0}
                        max={20}
                      />
                      <MmInput
                        label="Vertical"
                        value={a4.spacingV}
                        onChange={(v) => updateA4({ spacingV: v })}
                        min={0}
                        max={20}
                      />
                    </div>
                  </div>

                  {/* Padding */}
                  <MmInput
                    label="Padding Interno da Etiqueta"
                    value={a4.paddingInternal}
                    onChange={(v) => updateA4({ paddingInternal: v })}
                    min={0}
                    max={10}
                  />

                  {/* Calibration */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Move className="size-3" /> Calibração (Ajuste Fino)
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      <MmInput
                        label="Deslocamento X"
                        value={a4.offsetX}
                        onChange={(v) => updateA4({ offsetX: v })}
                        min={-20}
                        max={20}
                      />
                      <MmInput
                        label="Deslocamento Y"
                        value={a4.offsetY}
                        onChange={(v) => updateA4({ offsetY: v })}
                        min={-20}
                        max={20}
                      />
                    </div>
                    <p className="text-[9px] text-muted-foreground italic">
                      Valores positivos movem para direita/baixo; negativos para esquerda/cima.
                    </p>
                  </div>
                </div>
              )}

              {/* ── Thermal Settings ── */}
              {!isA4 && (
                <div className="space-y-5">
                  {/* Paper */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Ruler className="size-3" /> Bobina / Papel
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      <MmInput
                        label="Largura Total"
                        value={thermal.paperWidth}
                        onChange={(v) => updateThermal({ paperWidth: v })}
                        min={40}
                        max={120}
                      />
                      <MmInput
                        label="Largura Útil"
                        value={thermal.printableWidth}
                        onChange={(v) => updateThermal({ printableWidth: v })}
                        min={30}
                        max={110}
                      />
                    </div>
                  </div>

                  {/* Label Height */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                      Altura da Etiqueta
                    </Label>
                    <Select
                      value={String(thermal.labelHeight)}
                      onValueChange={(v) =>
                        updateThermal({ labelHeight: Number(v) })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {THERMAL_HEIGHT_OPTIONS.map((h) => (
                          <SelectItem key={h} value={String(h)}>
                            {h === 0 ? "Automática (contínua)" : `${h} mm`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Columns */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                      Etiquetas por Linha
                    </Label>
                    <div className="flex gap-2">
                      {[1, 2].map((n) => (
                        <Button
                          key={n}
                          variant={thermal.columns === n ? "default" : "outline"}
                          size="sm"
                          className="flex-1 h-8 text-xs font-bold"
                          onClick={() => updateThermal({ columns: n })}
                        >
                          {n} {n === 1 ? "etiqueta" : "etiquetas (2 colunas)"}
                        </Button>
                      ))}
                    </div>
                    {thermal.columns === 2 && (
                      <div className="pt-2">
                        <MmInput
                          label="Espaço entre as 2 etiquetas"
                          value={thermal.spacingH || 2}
                          onChange={(v) => updateThermal({ spacingH: v })}
                          min={0}
                          max={10}
                        />
                      </div>
                    )}
                  </div>

                  {/* Margins */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Ruler className="size-3" /> Margens
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      <MmInput
                        label="Superior"
                        value={thermal.marginTop}
                        onChange={(v) => updateThermal({ marginTop: v })}
                        min={0}
                      />
                      <MmInput
                        label="Inferior"
                        value={thermal.marginBottom}
                        onChange={(v) => updateThermal({ marginBottom: v })}
                        min={0}
                      />
                      <MmInput
                        label="Esquerda"
                        value={thermal.marginLeft}
                        onChange={(v) => updateThermal({ marginLeft: v })}
                        min={0}
                      />
                      <MmInput
                        label="Direita"
                        value={thermal.marginRight}
                        onChange={(v) => updateThermal({ marginRight: v })}
                        min={0}
                      />
                    </div>
                  </div>

                  {/* Calibration */}
                  <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <Move className="size-3" /> Calibração
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      <MmInput
                        label="Deslocamento X"
                        value={thermal.offsetX}
                        onChange={(v) => updateThermal({ offsetX: v })}
                        min={-20}
                        max={20}
                      />
                      <MmInput
                        label="Deslocamento Y"
                        value={thermal.offsetY}
                        onChange={(v) => updateThermal({ offsetY: v })}
                        min={-20}
                        max={20}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ── Content Settings (shared) ── */}
              <div className="space-y-3 pt-2 border-t border-border/40">
                <Label className="text-[10px] font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Type className="size-3" /> Conteúdo da Etiqueta
                </Label>

                {/* Header / Store Name */}
                <div className="bg-muted/30 rounded-xl border border-border/30 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">Cabeçalho / Loja</span>
                    <Switch
                      checked={activeContent.showHeader}
                      onCheckedChange={(v) => updateContent({ showHeader: v })}
                      className="data-[state=checked]:bg-gold"
                    />
                  </div>
                  {activeContent.showHeader && (
                    <div className="space-y-2 pt-1">
                      <Input
                        value={activeContent.headerTitle || ""}
                        onChange={(e) =>
                          updateContent({ headerTitle: e.target.value })
                        }
                        placeholder="Ex: AMSTORE"
                        className="h-7 text-xs font-bold"
                      />
                      <div className="flex items-center gap-2">
                        <Label className="text-[10px] text-muted-foreground">
                          Tamanho Fonte:
                        </Label>
                        <Input
                          type="number"
                          min={4}
                          max={16}
                          step={0.5}
                          value={activeContent.headerFontSize || 7}
                          onChange={(e) =>
                            updateContent({
                              headerFontSize: Number(e.target.value),
                            })
                          }
                          className="h-6 w-14 text-[10px] text-center font-mono"
                        />
                        <span className="text-[9px] text-muted-foreground">pt</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Field Toggles */}
                <div className="bg-muted/30 rounded-xl border border-border/30 p-3">
                  <FieldToggle
                    label="Nome do Produto"
                    config={activeContent.productName}
                    onChange={(p) => handleFieldChange("productName", p)}
                  />
                  <FieldToggle
                    label="Referência / SKU"
                    config={activeContent.reference}
                    onChange={(p) => handleFieldChange("reference", p)}
                  />
                  <FieldToggle
                    label="Preço de Venda"
                    config={activeContent.price}
                    onChange={(p) => handleFieldChange("price", p)}
                  />
                  <FieldToggle
                    label="Código de Barras / QR"
                    config={activeContent.barcode}
                    onChange={(p) => handleFieldChange("barcode", p)}
                  />
                  {activeContent.barcode.show && (
                    <div className="flex items-center justify-between py-1.5 pl-4 border-b border-border/20 text-xs">
                      <span className="text-muted-foreground text-[11px]">
                        Exibir número abaixo das barras
                      </span>
                      <Switch
                        checked={activeContent.showBarcodeValue}
                        onCheckedChange={(v) =>
                          updateContent({ showBarcodeValue: v })
                        }
                        className="scale-75 data-[state=checked]:bg-gold"
                      />
                    </div>
                  )}
                  <FieldToggle
                    label="Numeração / Tamanho"
                    config={activeContent.size}
                    onChange={(p) => handleFieldChange("size", p)}
                  />
                </div>

                {/* Extra Info */}
                <div className="bg-muted/30 rounded-xl border border-border/30 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">Mensagem de Rodapé</span>
                    <Switch
                      checked={activeContent.showExtraInfo}
                      onCheckedChange={(v) => updateContent({ showExtraInfo: v })}
                      className="data-[state=checked]:bg-gold"
                    />
                  </div>
                  {activeContent.showExtraInfo && (
                    <Input
                      value={activeContent.extraInfo || ""}
                      onChange={(e) =>
                        updateContent({ extraInfo: e.target.value })
                      }
                      placeholder="Ex: Troca em até 7 dias"
                      className="h-7 text-xs"
                    />
                  )}
                </div>

                {/* Text Alignment */}
                <div className="flex items-center justify-between py-1">
                  <Label className="text-xs font-bold">Alinhamento do Texto</Label>
                  <div className="flex gap-1">
                    <Button
                      variant={activeContent.align === "left" ? "default" : "outline"}
                      size="sm"
                      className="h-7 px-2.5 text-xs font-bold gap-1"
                      onClick={() => updateContent({ align: "left" })}
                    >
                      <AlignLeft className="size-3" /> Esquerda
                    </Button>
                    <Button
                      variant={activeContent.align === "center" ? "default" : "outline"}
                      size="sm"
                      className="h-7 px-2.5 text-xs font-bold gap-1"
                      onClick={() => updateContent({ align: "center" })}
                    >
                      <AlignCenter className="size-3" /> Centro
                    </Button>
                  </div>
                </div>

                {/* Line spacing */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      Espaçamento entre Linhas
                    </Label>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {activeContent.lineSpacing} mm
                    </span>
                  </div>
                  <Slider
                    value={[activeContent.lineSpacing]}
                    min={0}
                    max={3}
                    step={0.1}
                    onValueChange={([v]) => updateContent({ lineSpacing: v })}
                  />
                </div>

                {/* Auto shrink & min font size */}
                <div className="space-y-2 bg-muted/30 rounded-xl border border-border/30 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold">
                        Reduzir Fonte Automaticamente
                      </span>
                      <p className="text-[9px] text-muted-foreground">
                        Reduz títulos longos para caber na etiqueta sem estourar
                      </p>
                    </div>
                    <Switch
                      checked={activeContent.autoShrink}
                      onCheckedChange={(v) => updateContent({ autoShrink: v })}
                      className="data-[state=checked]:bg-gold"
                    />
                  </div>

                  {activeContent.autoShrink && (
                    <div className="flex items-center justify-between pt-2 border-t border-border/20">
                      <Label className="text-[11px] font-medium text-muted-foreground">
                        Tamanho Mínimo da Fonte:
                      </Label>
                      <div className="flex items-center gap-1.5">
                        <Input
                          type="number"
                          min={3}
                          max={10}
                          step={0.5}
                          value={activeContent.minFontSize || 4.5}
                          onChange={(e) =>
                            updateContent({ minFontSize: Number(e.target.value) })
                          }
                          className="h-6 w-14 text-[10px] text-center font-mono"
                        />
                        <span className="text-[9px] text-muted-foreground">pt</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Actions ── */}
              <div className="pt-3 border-t border-border/40 space-y-2">
                {onOpenTestSheet && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8 text-xs font-bold gap-1.5 text-blue-600 border-blue-200 hover:bg-blue-50"
                    onClick={() => {
                      onOpenChange(false);
                      onOpenTestSheet();
                    }}
                  >
                    <Ruler className="size-3.5" /> Abrir Folha de Teste / Calibração
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-8 text-xs font-bold text-destructive border-destructive/20 hover:bg-destructive/5"
                  onClick={() => {
                    if (
                      confirm("Restaurar todas as configurações para o padrão?")
                    ) {
                      resetToDefaults();
                      toast.success("Configurações restauradas");
                    }
                  }}
                >
                  <RotateCcw className="size-3 mr-1.5" /> Restaurar Padrão
                </Button>
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Save Custom Preset Dialog */}
      <Dialog open={savePresetOpen} onOpenChange={setSavePresetOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">
              Salvar Preset Personalizado
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase">
                Nome do Preset
              </Label>
              <Input
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                placeholder="Ex: Minha Folha 3x10"
                className="h-8 text-xs"
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              Salva as configurações atuais de grade, margens e tamanho como um novo preset reutilizável.
            </p>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                if (!presetName.trim()) {
                  toast.error("Informe um nome");
                  return;
                }
                saveCustomPreset(presetName.trim());
                setSavePresetOpen(false);
                toast.success("Preset salvo!");
              }}
              className="w-full h-8 text-xs font-bold"
            >
              <Save className="size-3 mr-1.5" /> Salvar Preset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
