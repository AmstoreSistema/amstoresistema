import { useState, useEffect, useCallback, useRef } from "react";

// ─── Presets ──────────────────────────────────────────────────────────
export const A4_PRESETS: Record<string, Partial<A4Profile>> = {
  "pimaco-6080": {
    presetName: "Pimaco 6080",
    columns: 3, rows: 10,
    labelWidth: 63.5, labelHeight: 25.4,
    marginTop: 12.7, marginBottom: 12.7,
    marginLeft: 8.2, marginRight: 8.2,
    spacingH: 3.2, spacingV: 0,
    paddingInternal: 2,
  },
  "pimaco-6081": {
    presetName: "Pimaco 6081",
    columns: 2, rows: 10,
    labelWidth: 101.6, labelHeight: 25.4,
    marginTop: 12.7, marginBottom: 12.7,
    marginLeft: 3.2, marginRight: 3.2,
    spacingH: 2, spacingV: 0,
    paddingInternal: 2,
  },
  "pimaco-6082": {
    presetName: "Pimaco 6082",
    columns: 2, rows: 7,
    labelWidth: 101.6, labelHeight: 33.9,
    marginTop: 12.7, marginBottom: 12.7,
    marginLeft: 3.2, marginRight: 3.2,
    spacingH: 2, spacingV: 0,
    paddingInternal: 2,
  },
  "pimaco-6083": {
    presetName: "Pimaco 6083",
    columns: 2, rows: 5,
    labelWidth: 101.6, labelHeight: 50.8,
    marginTop: 12.7, marginBottom: 12.7,
    marginLeft: 3.2, marginRight: 3.2,
    spacingH: 2, spacingV: 0,
    paddingInternal: 2,
  },
  "pimaco-6180": {
    presetName: "Pimaco 6180",
    columns: 3, rows: 10,
    labelWidth: 63.5, labelHeight: 25.4,
    marginTop: 15.1, marginBottom: 15.1,
    marginLeft: 7.1, marginRight: 7.1,
    spacingH: 3.2, spacingV: 0,
    paddingInternal: 2,
  },
  "pimaco-6280": {
    presetName: "Pimaco 6280",
    columns: 3, rows: 11,
    labelWidth: 63.5, labelHeight: 22.5,
    marginTop: 11.5, marginBottom: 11.5,
    marginLeft: 8.2, marginRight: 8.2,
    spacingH: 3.2, spacingV: 2.5,
    paddingInternal: 1.5,
  },
  custom: {
    presetName: "Personalizado",
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
  // Paper
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

export function validateA4Dimensions(a4: A4Profile): ValidationResult {
  const errors: string[] = [];
  const occupiedW =
    a4.marginLeft +
    a4.marginRight +
    a4.columns * a4.labelWidth +
    (a4.columns - 1) * a4.spacingH;
  if (occupiedW > a4.paperWidth + 0.05) {
    const diff = (occupiedW - a4.paperWidth).toFixed(1);
    errors.push(
      `Largura total (${occupiedW.toFixed(1)}mm: margens ${a4.marginLeft + a4.marginRight}mm + ${a4.columns} colunas de ${a4.labelWidth}mm + espaçamento ${((a4.columns - 1) * a4.spacingH).toFixed(1)}mm) ultrapassa a folha A4 (${a4.paperWidth}mm) em ${diff}mm.`
    );
  }

  const occupiedH =
    a4.marginTop +
    a4.marginBottom +
    a4.rows * a4.labelHeight +
    (a4.rows - 1) * a4.spacingV;
  if (occupiedH > a4.paperHeight + 0.05) {
    const diff = (occupiedH - a4.paperHeight).toFixed(1);
    errors.push(
      `Altura total (${occupiedH.toFixed(1)}mm: margens ${a4.marginTop + a4.marginBottom}mm + ${a4.rows} linhas de ${a4.labelHeight}mm + espaçamento ${((a4.rows - 1) * a4.spacingV).toFixed(1)}mm) ultrapassa a folha A4 (${a4.paperHeight}mm) em ${diff}mm.`
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
  if (marginsH + thermal.printableWidth > thermal.paperWidth + 0.05) {
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
  presetName: "Pimaco 6080",
  presetId: "pimaco-6080",
  paperWidth: 210,
  paperHeight: 297,
  marginTop: 12.7,
  marginBottom: 12.7,
  marginLeft: 8.2,
  marginRight: 8.2,
  columns: 3,
  rows: 10,
  labelWidth: 63.5,
  labelHeight: 25.4,
  spacingH: 3.2,
  spacingV: 0,
  paddingInternal: 2,
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

const STORAGE_KEY = "amstore-label-settings";

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
    setSettings((s) => ({ ...s, a4: { ...s.a4, ...patch } }));
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
      setSettings((s) => ({
        ...s,
        a4: {
          ...s.a4,
          ...preset,
          presetId,
          presetName: preset.presetName || presetId,
          paperWidth: 210,
          paperHeight: 297,
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

  // Computed: total labels per sheet for A4
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
