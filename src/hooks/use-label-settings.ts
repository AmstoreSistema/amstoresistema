import { useState, useEffect, useCallback, useRef } from "react";

// ─── Paper Types ──────────────────────────────────────────────────────
export type PaperType = "a4" | "letter" | "custom";

export const PAPER_DIMENSIONS: Record<PaperType, { width: number; height: number; name: string }> = {
  a4: { width: 210, height: 297, name: "A4 (210 × 297 mm)" },
  letter: { width: 215.9, height: 279.4, name: "Carta / Letter (215,9 × 279,4 mm)" },
  custom: { width: 210, height: 297, name: "Personalizado" },
};

// ─── Presets ──────────────────────────────────────────────────────────
export const A4_PRESETS: Record<string, Partial<A4Profile>> = {
  // ── Carta (Letter: 215.9 × 279.4 mm) ──
  "colacril-cc280": {
    presetName: "Colacril CC280 (Carta) – 30 etiquetas",
    paperType: "letter",
    paperWidth: 215.9,
    paperHeight: 279.4,
    columns: 3,
    rows: 10,
    labelWidth: 66.7,
    labelHeight: 25.4,
    marginTop: 12.7,
    marginBottom: 12.7,
    marginLeft: 4.7,
    marginRight: 4.7,
    spacingH: 3.2,
    spacingV: 0,
    paddingInternal: 1.5,
    presetNotes:
      "Medidas de margem baseadas no padrão 6180/5160. Confirme com régua na sua folha e calibre com a folha de teste.",
  },
  "colacril-cc180": {
    presetName: "Colacril CC180 (Carta) – 30 etiquetas",
    paperType: "letter",
    paperWidth: 215.9,
    paperHeight: 279.4,
    columns: 3,
    rows: 10,
    labelWidth: 66.7,
    labelHeight: 25.4,
    marginTop: 12.7,
    marginBottom: 12.7,
    marginLeft: 4.7,
    marginRight: 4.7,
    spacingH: 3.2,
    spacingV: 0,
    paddingInternal: 1.5,
    presetNotes:
      "Medidas de margem baseadas no padrão 6180/5160. Confirme com régua na sua folha e calibre com a folha de teste.",
  },
  "pimaco-6180": {
    presetName: "Pimaco 6180 (Carta) – 30 etiquetas",
    paperType: "letter",
    paperWidth: 215.9,
    paperHeight: 279.4,
    columns: 3,
    rows: 10,
    labelWidth: 66.7,
    labelHeight: 25.4,
    marginTop: 12.7,
    marginBottom: 12.7,
    marginLeft: 4.7,
    marginRight: 4.7,
    spacingH: 3.2,
    spacingV: 0,
    paddingInternal: 1.5,
    presetNotes:
      "Formato Carta compatível com Avery 5160. Margens balanceadas em 4,7 mm.",
  },
  "pimaco-6181": {
    presetName: "Pimaco 6181 (Carta) – 20 etiquetas",
    paperType: "letter",
    paperWidth: 215.9,
    paperHeight: 279.4,
    columns: 2,
    rows: 10,
    labelWidth: 101.6,
    labelHeight: 25.4,
    marginTop: 12.7,
    marginBottom: 12.7,
    marginLeft: 4.7,
    marginRight: 4.7,
    spacingH: 3.3,
    spacingV: 0,
    paddingInternal: 2,
    presetNotes: "Formato Carta, 2 colunas largas de 101,6 mm.",
  },
  "pimaco-6182": {
    presetName: "Pimaco 6182 (Carta) – 14 etiquetas",
    paperType: "letter",
    paperWidth: 215.9,
    paperHeight: 279.4,
    columns: 2,
    rows: 7,
    labelWidth: 101.6,
    labelHeight: 33.9,
    marginTop: 21.05,
    marginBottom: 21.05,
    marginLeft: 4.7,
    marginRight: 4.7,
    spacingH: 3.3,
    spacingV: 0,
    paddingInternal: 2,
    presetNotes: "Formato Carta, 2 colunas por 7 linhas para caixas e pacotes.",
  },
  "pimaco-6288": {
    presetName: "Pimaco 6288 (Carta) – 33 etiquetas",
    paperType: "letter",
    paperWidth: 215.9,
    paperHeight: 279.4,
    columns: 3,
    rows: 11,
    labelWidth: 63.5,
    labelHeight: 22.5,
    marginTop: 3.45,
    marginBottom: 3.45,
    marginLeft: 9.5,
    marginRight: 9.5,
    spacingH: 3.2,
    spacingV: 2.5,
    paddingInternal: 1.5,
    presetNotes: "Formato Carta, 33 etiquetas com espaçamento vertical de 2,5 mm.",
  },

  // ── A4 (210 × 297 mm) ──
  "pimaco-6080": {
    presetName: "Pimaco 6080 (A4) – 30 etiquetas",
    paperType: "a4",
    paperWidth: 210,
    paperHeight: 297,
    columns: 3,
    rows: 10,
    labelWidth: 63.5,
    labelHeight: 25.4,
    marginTop: 21.5,
    marginBottom: 21.5,
    marginLeft: 6.55,
    marginRight: 6.55,
    spacingH: 3.2,
    spacingV: 0,
    paddingInternal: 2,
    presetNotes: "Folha padrão A4 internacional da linha 6000.",
  },
  "pimaco-6081": {
    presetName: "Pimaco 6081 (A4) – 20 etiquetas",
    paperType: "a4",
    paperWidth: 210,
    paperHeight: 297,
    columns: 2,
    rows: 10,
    labelWidth: 101.6,
    labelHeight: 25.4,
    marginTop: 21.5,
    marginBottom: 21.5,
    marginLeft: 1.6,
    marginRight: 1.6,
    spacingH: 5.2,
    spacingV: 0,
    paddingInternal: 2,
  },
  "pimaco-6082": {
    presetName: "Pimaco 6082 (A4) – 14 etiquetas",
    paperType: "a4",
    paperWidth: 210,
    paperHeight: 297,
    columns: 2,
    rows: 7,
    labelWidth: 101.6,
    labelHeight: 33.9,
    marginTop: 29.85,
    marginBottom: 29.85,
    marginLeft: 1.6,
    marginRight: 1.6,
    spacingH: 5.2,
    spacingV: 0,
    paddingInternal: 2,
  },
  "pimaco-6083": {
    presetName: "Pimaco 6083 (A4) – 10 etiquetas",
    paperType: "a4",
    paperWidth: 210,
    paperHeight: 297,
    columns: 2,
    rows: 5,
    labelWidth: 101.6,
    labelHeight: 50.8,
    marginTop: 21.5,
    marginBottom: 21.5,
    marginLeft: 1.6,
    marginRight: 1.6,
    spacingH: 5.2,
    spacingV: 0,
    paddingInternal: 2,
  },
  "pimaco-6280": {
    presetName: "Pimaco 6280 (A4) – 33 etiquetas",
    paperType: "a4",
    paperWidth: 210,
    paperHeight: 297,
    columns: 3,
    rows: 11,
    labelWidth: 63.5,
    labelHeight: 22.5,
    marginTop: 12.25,
    marginBottom: 12.25,
    marginLeft: 6.55,
    marginRight: 6.55,
    spacingH: 3.2,
    spacingV: 2.5,
    paddingInternal: 1.5,
  },
  custom: {
    presetName: "Personalizado",
    paperType: "custom",
  },
};

export const THERMAL_HEIGHT_OPTIONS = [25, 30, 40, 50, 60, 0]; // 0 = auto/contínua

// ─── Types ────────────────────────────────────────────────────────────
export interface LabelFieldConfig {
  show: boolean;
  fontSize: number; // in pt
  bold: boolean;
}

export interface LabelContentSettings {
  productName: LabelFieldConfig;
  reference: LabelFieldConfig;
  price: LabelFieldConfig;
  barcode: LabelFieldConfig;
  size: LabelFieldConfig;
  headerTitle: string;
  showHeader: boolean;
  headerFontSize: number;
  showBarcodeValue: boolean;
  extraInfo: string;
  showExtraInfo: boolean;
  extraInfoFontSize: number;
  align: "center" | "left";
  autoShrink: boolean;
  minFontSize: number; // in pt
  lineSpacing: number; // in mm
}

export interface A4Profile {
  presetName: string;
  presetId: string;
  presetNotes?: string;
  // Paper
  paperType: PaperType;
  paperWidth: number;
  paperHeight: number;
  // Sheet margins
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  // Grid
  columns: number;
  rows: number;
  // Label size
  labelWidth: number;
  labelHeight: number;
  // Spacing
  spacingH: number;
  spacingV: number;
  // Internal
  paddingInternal: number;
  // Calibration
  offsetX: number;
  offsetY: number;
  // Content
  content: LabelContentSettings;
}

export interface ThermalProfile {
  // Paper
  paperWidth: number;
  printableWidth: number;
  labelHeight: number; // 0 = auto
  // Grid
  columns: number; // 1 or 2
  spacingH: number; // gap between columns if 2 columns
  // Margins
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  // Calibration
  offsetX: number;
  offsetY: number;
  // Content
  content: LabelContentSettings;
}

export type PrinterProfile = "a4" | "thermal";

export interface LabelSettings {
  activeProfile: PrinterProfile;
  a4: A4Profile;
  thermal: ThermalProfile;
  customPresets: Record<string, Partial<A4Profile>>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateA4Dimensions(sheet: A4Profile): ValidationResult {
  const errors: string[] = [];
  const paperName =
    sheet.paperType === "letter"
      ? "Carta (Letter)"
      : sheet.paperType === "a4"
      ? "A4"
      : "Personalizado";

  const occupiedW =
    sheet.marginLeft +
    sheet.marginRight +
    sheet.columns * sheet.labelWidth +
    (sheet.columns - 1) * sheet.spacingH;

  // Tolerância de 0.2mm conforme especificado
  if (occupiedW > sheet.paperWidth + 0.2) {
    const diff = (occupiedW - sheet.paperWidth).toFixed(1);
    errors.push(
      `Largura total (${occupiedW.toFixed(1)}mm: margens ${(sheet.marginLeft + sheet.marginRight).toFixed(1)}mm + ${sheet.columns} colunas de ${sheet.labelWidth}mm + espaçamento ${((sheet.columns - 1) * sheet.spacingH).toFixed(1)}mm) ultrapassa o papel ${paperName} (${sheet.paperWidth}mm) em ${diff}mm.`
    );
  }

  const occupiedH =
    sheet.marginTop +
    sheet.marginBottom +
    sheet.rows * sheet.labelHeight +
    (sheet.rows - 1) * sheet.spacingV;

  if (occupiedH > sheet.paperHeight + 0.2) {
    const diff = (occupiedH - sheet.paperHeight).toFixed(1);
    errors.push(
      `Altura total (${occupiedH.toFixed(1)}mm: margens ${(sheet.marginTop + sheet.marginBottom).toFixed(1)}mm + ${sheet.rows} linhas de ${sheet.labelHeight}mm + espaçamento ${((sheet.rows - 1) * sheet.spacingV).toFixed(1)}mm) ultrapassa o papel ${paperName} (${sheet.paperHeight}mm) em ${diff}mm.`
    );
  }

  return { valid: errors.length === 0, errors };
}

export function validateThermalDimensions(thermal: ThermalProfile): ValidationResult {
  const errors: string[] = [];
  if (thermal.printableWidth > thermal.paperWidth) {
    const diff = (thermal.printableWidth - thermal.paperWidth).toFixed(1);
    errors.push(
      `Largura útil (${thermal.printableWidth}mm) ultrapassa a largura total da bobina (${thermal.paperWidth}mm) em ${diff}mm.`
    );
  }

  const marginsH = thermal.marginLeft + thermal.marginRight;
  if (marginsH + thermal.printableWidth > thermal.paperWidth + 0.2) {
    const diff = (marginsH + thermal.printableWidth - thermal.paperWidth).toFixed(1);
    errors.push(
      `Margens laterais (${marginsH.toFixed(1)}mm) + largura útil (${thermal.printableWidth}mm) ultrapassam a bobina (${thermal.paperWidth}mm) em ${diff}mm.`
    );
  }

  return { valid: errors.length === 0, errors };
}

// ─── Defaults ─────────────────────────────────────────────────────────
const DEFAULT_CONTENT: LabelContentSettings = {
  productName: { show: true, fontSize: 7, bold: true },
  reference: { show: true, fontSize: 6, bold: false },
  price: { show: true, fontSize: 9, bold: true },
  barcode: { show: true, fontSize: 8, bold: false },
  size: { show: true, fontSize: 7, bold: true },
  headerTitle: "AMSTORE",
  showHeader: false,
  headerFontSize: 7,
  showBarcodeValue: true,
  extraInfo: "Troca em até 7 dias",
  showExtraInfo: false,
  extraInfoFontSize: 6,
  align: "center",
  autoShrink: true,
  minFontSize: 4.5,
  lineSpacing: 0.5,
};

const DEFAULT_A4: A4Profile = {
  presetName: "Colacril CC280 (Carta) – 30 etiquetas",
  presetId: "colacril-cc280",
  presetNotes:
    "Medidas de margem baseadas no padrão 6180/5160. Confirme com régua na sua folha e calibre com a folha de teste.",
  paperType: "letter",
  paperWidth: 215.9,
  paperHeight: 279.4,
  marginTop: 12.7,
  marginBottom: 12.7,
  marginLeft: 4.7,
  marginRight: 4.7,
  columns: 3,
  rows: 10,
  labelWidth: 66.7,
  labelHeight: 25.4,
  spacingH: 3.2,
  spacingV: 0,
  paddingInternal: 1.5,
  offsetX: 0,
  offsetY: 0,
  content: { ...DEFAULT_CONTENT },
};

const DEFAULT_THERMAL: ThermalProfile = {
  paperWidth: 80,
  printableWidth: 72,
  labelHeight: 40,
  columns: 1,
  spacingH: 2,
  marginTop: 2,
  marginBottom: 2,
  marginLeft: 4,
  marginRight: 4,
  offsetX: 0,
  offsetY: 0,
  content: { ...DEFAULT_CONTENT, barcode: { show: true, fontSize: 8, bold: false } },
};

const DEFAULT_SETTINGS: LabelSettings = {
  activeProfile: "a4",
  a4: DEFAULT_A4,
  thermal: DEFAULT_THERMAL,
  customPresets: {},
};

const STORAGE_KEY = "amstore-label-settings-v2";

// ─── Hook ─────────────────────────────────────────────────────────────
export function useLabelSettings() {
  const [settings, setSettings] = useState<LabelSettings>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        return {
          ...DEFAULT_SETTINGS,
          ...parsed,
          a4: {
            ...DEFAULT_A4,
            ...parsed.a4,
            content: { ...DEFAULT_CONTENT, ...parsed.a4?.content },
          },
          thermal: {
            ...DEFAULT_THERMAL,
            ...parsed.thermal,
            content: { ...DEFAULT_CONTENT, ...parsed.thermal?.content },
          },
        };
      }
    } catch {}
    return DEFAULT_SETTINGS;
  });

  const saveTimeout = useRef<NodeJS.Timeout | null>(null);

  // Debounced localStorage save
  useEffect(() => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }, 300);
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, [settings]);

  const setActiveProfile = useCallback((p: PrinterProfile) => {
    setSettings((s) => ({ ...s, activeProfile: p }));
  }, []);

  const updateA4 = useCallback((patch: Partial<A4Profile>) => {
    setSettings((s) => {
      let updatedPatch = { ...patch };
      // Se paperType mudou, atualizar dimensões automaticamente caso seja A4 ou Letter
      if (patch.paperType && patch.paperType !== "custom") {
        const dim = PAPER_DIMENSIONS[patch.paperType];
        updatedPatch = {
          ...updatedPatch,
          paperWidth: dim.width,
          paperHeight: dim.height,
        };
      }
      return { ...s, a4: { ...s.a4, ...updatedPatch } };
    });
  }, []);

  const updateThermal = useCallback((patch: Partial<ThermalProfile>) => {
    setSettings((s) => ({ ...s, thermal: { ...s.thermal, ...patch } }));
  }, []);

  const updateA4Content = useCallback((patch: Partial<LabelContentSettings>) => {
    setSettings((s) => ({
      ...s,
      a4: { ...s.a4, content: { ...s.a4.content, ...patch } },
    }));
  }, []);

  const updateThermalContent = useCallback(
    (patch: Partial<LabelContentSettings>) => {
      setSettings((s) => ({
        ...s,
        thermal: { ...s.thermal, content: { ...s.thermal.content, ...patch } },
      }));
    },
    []
  );

  const applyPreset = useCallback(
    (presetId: string) => {
      const preset = A4_PRESETS[presetId] || settings.customPresets[presetId];
      if (!preset) return;
      const paperType = preset.paperType || (preset.paperWidth === 215.9 ? "letter" : "a4");
      const paperDim = PAPER_DIMENSIONS[paperType] || { width: 210, height: 297 };

      setSettings((s) => ({
        ...s,
        a4: {
          ...s.a4,
          ...preset,
          presetId,
          presetName: preset.presetName || presetId,
          presetNotes: preset.presetNotes || "",
          paperType,
          paperWidth: preset.paperWidth || paperDim.width,
          paperHeight: preset.paperHeight || paperDim.height,
          offsetX: s.a4.offsetX,
          offsetY: s.a4.offsetY,
          content: s.a4.content,
        },
      }));
    },
    [settings.customPresets]
  );

  const saveCustomPreset = useCallback((name: string) => {
    const id = `custom-${Date.now()}`;
    setSettings((s) => ({
      ...s,
      customPresets: {
        ...s.customPresets,
        [id]: {
          presetName: name,
          paperType: s.a4.paperType,
          paperWidth: s.a4.paperWidth,
          paperHeight: s.a4.paperHeight,
          columns: s.a4.columns,
          rows: s.a4.rows,
          labelWidth: s.a4.labelWidth,
          labelHeight: s.a4.labelHeight,
          marginTop: s.a4.marginTop,
          marginBottom: s.a4.marginBottom,
          marginLeft: s.a4.marginLeft,
          marginRight: s.a4.marginRight,
          spacingH: s.a4.spacingH,
          spacingV: s.a4.spacingV,
          paddingInternal: s.a4.paddingInternal,
        },
      },
      a4: { ...s.a4, presetId: id, presetName: name },
    }));
    return id;
  }, []);

  const deleteCustomPreset = useCallback((presetId: string) => {
    setSettings((s) => {
      const next = { ...s.customPresets };
      delete next[presetId];
      return { ...s, customPresets: next };
    });
  }, []);

  const resetToDefaults = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Computed: total labels per sheet for A4/Carta
  const labelsPerSheet = settings.a4.columns * settings.a4.rows;

  // Validation
  const validation =
    settings.activeProfile === "a4"
      ? validateA4Dimensions(settings.a4)
      : validateThermalDimensions(settings.thermal);

  return {
    settings,
    setActiveProfile,
    updateA4,
    updateThermal,
    updateA4Content,
    updateThermalContent,
    applyPreset,
    saveCustomPreset,
    deleteCustomPreset,
    resetToDefaults,
    labelsPerSheet,
    validation,
  };
}
