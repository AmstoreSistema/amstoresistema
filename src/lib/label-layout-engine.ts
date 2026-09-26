import JsBarcode from "jsbarcode";
import type {
  A4Profile,
  ThermalProfile,
  LabelContentSettings,
  PrinterProfile,
} from "@/hooks/use-label-settings";
import { brl } from "@/lib/format";

/**
 * Generates an ultra high-resolution (600+ DPI) barcode PNG for print and jsPDF.
 * At 600 DPI, lines are razor sharp and never blurry on laser or thermal printers.
 */
export function generateHighResBarcode(
  value: string,
  showText: boolean,
  widthMm: number,
  heightMm: number,
  dpi: number = 600
): string | null {
  if (typeof document === "undefined" || !value) return null;
  try {
    const pxPerMm = dpi / 25.4;
    const canvas = document.createElement("canvas");
    const targetW = Math.max(300, Math.round(widthMm * pxPerMm));
    const targetH = Math.max(80, Math.round(heightMm * pxPerMm));

    canvas.width = targetW;
    canvas.height = targetH;

    JsBarcode(canvas, value, {
      format: "CODE128",
      width: Math.min(2, Math.max(1, Math.floor(targetW / 200))),
      height: Math.round(targetH * (showText ? 0.72 : 0.95)),
      displayValue: showText,
      fontSize: Math.round(targetH * 0.22),
      font: "Helvetica, Arial, sans-serif",
      margin: 0,
      textMargin: 2,
    });

    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

// ─── Font & Text Measurement Constants ────────────────────────────────
// 1 pt = 1/72 inch; at 96 DPI CSS: 1 pt = 1.333333 px; in mm: 1 pt = 0.352778 mm
const PT_TO_MM = 0.352778;
const PT_TO_PX = 96 / 72; // 1.333333
const PX_TO_MM = 25.4 / 96;

let measurementCanvas: HTMLCanvasElement | null = null;
let measurementCtx: CanvasRenderingContext2D | null = null;

/**
 * Measure text width in millimeters using an offscreen canvas with standard font metrics.
 * Ensures 100% identical measurement across Preview, Print, and jsPDF.
 */
export function measureTextWidthMm(
  text: string,
  fontSizePt: number,
  isBold: boolean = false,
  fontFamily: string = "Helvetica, Arial, sans-serif"
): number {
  if (!text) return 0;

  if (typeof document !== "undefined") {
    if (!measurementCanvas) {
      measurementCanvas = document.createElement("canvas");
      measurementCtx = measurementCanvas.getContext("2d");
    }
    if (measurementCtx) {
      const fontSizePx = fontSizePt * PT_TO_PX;
      const weight = isBold ? "bold" : "normal";
      measurementCtx.font = `${weight} ${fontSizePx}px ${fontFamily}`;
      const px = measurementCtx.measureText(text).width;
      return px * PX_TO_MM;
    }
  }

  // Pure fallback: standard Helvetica character width approximation
  const charWidthFactor = isBold ? 0.56 : 0.52;
  return text.length * fontSizePt * charWidthFactor * PT_TO_MM;
}

/**
 * Unified Auto-shrink and Truncation function.
 * Progressively reduces font size down to minFontSizePt; if still too wide, truncates with ellipsis (...).
 */
export function fitAndTruncateText(
  text: string,
  baseFontSizePt: number,
  minFontSizePt: number,
  maxAvailableWidthMm: number,
  autoShrink: boolean,
  isBold: boolean,
  fontFamily: string = "Helvetica, Arial, sans-serif"
): { fittedText: string; finalFontSizePt: number; textWidthMm: number } {
  if (!text) {
    return { fittedText: "", finalFontSizePt: baseFontSizePt, textWidthMm: 0 };
  }

  let size = baseFontSizePt;
  let w = measureTextWidthMm(text, size, isBold, fontFamily);

  if (autoShrink && maxAvailableWidthMm > 0) {
    while (w > maxAvailableWidthMm && size > minFontSizePt) {
      size = Math.max(minFontSizePt, size - 0.25);
      w = measureTextWidthMm(text, size, isBold, fontFamily);
    }
  }

  let output = text;
  if (w > maxAvailableWidthMm && maxAvailableWidthMm > 0) {
    while (
      output.length > 1 &&
      measureTextWidthMm(output + "...", size, isBold, fontFamily) > maxAvailableWidthMm
    ) {
      output = output.slice(0, -1);
    }
    output = output ? output + "..." : "";
    w = measureTextWidthMm(output, size, isBold, fontFamily);
  }

  return { fittedText: output, finalFontSizePt: size, textWidthMm: w };
}

// ─── Unified Layout Models ────────────────────────────────────────────

export interface ComputedField {
  show: boolean;
  text?: string;
  isBold?: boolean;
  fontFamily: string;
  fontSizePt: number;
  fontSizeMm: number;
  align: "center" | "left";
  // Coordinates relative to the label top-left (in mm)
  xMm: number;
  yMm: number; // top of field
  widthMm: number;
  heightMm: number;
}

export interface ComputedBarcodeField extends ComputedField {
  barcodeValue: string;
  barcodeType: "CODE128" | "QR";
  showValueText: boolean;
}

export interface ComputedLabel {
  index: number;
  label: any;
  pageIndex: number;
  row: number;
  col: number;
  // Position on the physical page in mm
  xMm: number;
  yMm: number;
  widthMm: number;
  heightMm: number;
  paddingMm: number;
  // Internal fields
  header?: ComputedField;
  productName?: ComputedField;
  reference?: ComputedField;
  barcode?: ComputedBarcodeField;
  priceAndSize?: ComputedField;
  extraInfo?: ComputedField;
}

export interface ComputedPage {
  pageIndex: number;
  pageWidthMm: number;
  pageHeightMm: number;
  labels: ComputedLabel[];
}

export interface ComputedSheetLayout {
  profileType: PrinterProfile;
  pageWidthMm: number;
  pageHeightMm: number;
  pages: ComputedPage[];
  totalLabels: number;
  totalPages: number;
  labelWidthMm: number;
  labelHeightMm: number;
}

// ─── Single Engine Layout Calculation ─────────────────────────────────

export interface ComputeLayoutOptions {
  profileType: PrinterProfile;
  a4: A4Profile;
  thermal: ThermalProfile;
  labels: any[];
  isTestSheet?: boolean | undefined;
}

export function computeCompleteLabelLayout(options: ComputeLayoutOptions): ComputedSheetLayout {
  const { profileType, a4, thermal, labels, isTestSheet } = options;

  if (profileType === "a4") {
    return computeA4Layout(a4, labels, isTestSheet);
  } else {
    return computeThermalLayout(thermal, labels, isTestSheet);
  }
}

// ─── A4 Layout Engine ─────────────────────────────────────────────────

function computeA4Layout(
  a4: A4Profile,
  labels: any[],
  isTestSheet?: boolean
): ComputedSheetLayout {
  const labelsPerSheet = a4.columns * a4.rows;
  const items = isTestSheet
    ? Array.from({ length: labelsPerSheet }).map((_, i) => ({ id: `test-${i}` }))
    : labels;

  const totalPages = Math.max(1, Math.ceil(items.length / labelsPerSheet));
  const pages: ComputedPage[] = [];

  for (let pageIdx = 0; pageIdx < totalPages; pageIdx++) {
    const pageItems = items.slice(pageIdx * labelsPerSheet, (pageIdx + 1) * labelsPerSheet);
    const computedLabels: ComputedLabel[] = [];

    for (let slotIdx = 0; slotIdx < (isTestSheet ? labelsPerSheet : pageItems.length); slotIdx++) {
      const row = Math.floor(slotIdx / a4.columns);
      const col = slotIdx % a4.columns;

      const xMm = a4.marginLeft + a4.offsetX + col * (a4.labelWidth + a4.spacingH);
      const yMm = a4.marginTop + a4.offsetY + row * (a4.labelHeight + a4.spacingV);

      const labelData = pageItems[slotIdx] || { id: `empty-${slotIdx}` };

      const computed = computeSingleLabelFields(
        slotIdx,
        pageIdx,
        row,
        col,
        labelData,
        xMm,
        yMm,
        a4.labelWidth,
        a4.labelHeight,
        a4.paddingInternal,
        a4.content,
        isTestSheet
      );

      computedLabels.push(computed);
    }

    pages.push({
      pageIndex: pageIdx,
      pageWidthMm: a4.paperWidth,
      pageHeightMm: a4.paperHeight,
      labels: computedLabels,
    });
  }

  return {
    profileType: "a4",
    pageWidthMm: a4.paperWidth,
    pageHeightMm: a4.paperHeight,
    pages,
    totalLabels: items.length,
    totalPages,
    labelWidthMm: a4.labelWidth,
    labelHeightMm: a4.labelHeight,
  };
}

// ─── Thermal Layout Engine ────────────────────────────────────────────

function computeThermalLayout(
  thermal: ThermalProfile,
  labels: any[],
  isTestSheet?: boolean
): ComputedSheetLayout {
  const cols = thermal.columns || 1;
  const spacingH = thermal.spacingH || 2;
  const totalPrintableW = thermal.printableWidth;
  const labelW = cols === 2 ? (totalPrintableW - spacingH) / 2 : totalPrintableW;
  const labelH = thermal.labelHeight || 40;

  const items = isTestSheet
    ? Array.from({ length: cols === 2 ? 4 : 2 }).map((_, i) => ({ id: `test-${i}` }))
    : labels;

  // In thermal, each row of 1 or 2 labels is a page
  const totalRows = Math.max(1, Math.ceil(items.length / cols));
  const pages: ComputedPage[] = [];

  for (let rowIdx = 0; rowIdx < totalRows; rowIdx++) {
    const rowItems = items.slice(rowIdx * cols, (rowIdx + 1) * cols);
    const computedLabels: ComputedLabel[] = [];

    for (let c = 0; c < rowItems.length; c++) {
      const xMm = thermal.marginLeft + thermal.offsetX + c * (labelW + spacingH);
      const yMm = thermal.marginTop + thermal.offsetY;
      const labelData = rowItems[c];

      const computed = computeSingleLabelFields(
        rowIdx * cols + c,
        rowIdx,
        rowIdx,
        c,
        labelData,
        xMm,
        yMm,
        labelW,
        labelH - (thermal.marginTop + thermal.marginBottom),
        2, // default 2mm padding for thermal
        thermal.content,
        isTestSheet
      );

      computedLabels.push(computed);
    }

    pages.push({
      pageIndex: rowIdx,
      pageWidthMm: thermal.paperWidth,
      pageHeightMm: labelH,
      labels: computedLabels,
    });
  }

  return {
    profileType: "thermal",
    pageWidthMm: thermal.paperWidth,
    pageHeightMm: labelH,
    pages,
    totalLabels: items.length,
    totalPages: totalRows,
    labelWidthMm: labelW,
    labelHeightMm: labelH,
  };
}

// ─── Internal Label Field Geometry & Sizing ───────────────────────────

function computeSingleLabelFields(
  index: number,
  pageIndex: number,
  row: number,
  col: number,
  label: any,
  xMm: number,
  yMm: number,
  widthMm: number,
  heightMm: number,
  paddingMm: number,
  content: LabelContentSettings,
  isTestSheet?: boolean
): ComputedLabel {
  const result: ComputedLabel = {
    index,
    label,
    pageIndex,
    row,
    col,
    xMm,
    yMm,
    widthMm,
    heightMm,
    paddingMm,
  };

  if (isTestSheet) return result;

  const maxW = Math.max(5, widthMm - paddingMm * 2);
  const align = content.align || "center";
  const minFont = content.minFontSize || 4.5;
  const lineSpacingMm = content.lineSpacing || 0.5;

  let cursorY = paddingMm;

  // 1. Header / Store Name
  if (content.showHeader && content.headerTitle) {
    const { fittedText, finalFontSizePt } = fitAndTruncateText(
      content.headerTitle,
      content.headerFontSize || 7,
      minFont,
      maxW,
      content.autoShrink,
      true,
      "Helvetica, Arial, sans-serif"
    );
    const fieldHeightMm = finalFontSizePt * PT_TO_MM;
    result.header = {
      show: true,
      text: fittedText,
      isBold: true,
      fontFamily: "Helvetica, Arial, sans-serif",
      fontSizePt: finalFontSizePt,
      fontSizeMm: fieldHeightMm,
      align,
      xMm: align === "center" ? widthMm / 2 : paddingMm,
      yMm: cursorY,
      widthMm: maxW,
      heightMm: fieldHeightMm,
    };
    cursorY += fieldHeightMm + lineSpacingMm;
  }

  // 2. Product Name
  if (content.productName.show) {
    const rawName = label.produto_nome || "Produto";
    const { fittedText, finalFontSizePt } = fitAndTruncateText(
      rawName,
      content.productName.fontSize || 7,
      minFont,
      maxW,
      content.autoShrink,
      content.productName.bold,
      "Helvetica, Arial, sans-serif"
    );
    const fieldHeightMm = finalFontSizePt * PT_TO_MM;
    result.productName = {
      show: true,
      text: fittedText,
      isBold: content.productName.bold,
      fontFamily: "Helvetica, Arial, sans-serif",
      fontSizePt: finalFontSizePt,
      fontSizeMm: fieldHeightMm,
      align,
      xMm: align === "center" ? widthMm / 2 : paddingMm,
      yMm: cursorY,
      widthMm: maxW,
      heightMm: fieldHeightMm,
    };
    cursorY += fieldHeightMm + lineSpacingMm;
  }

  // 3. Reference / SKU
  if (content.reference.show && label.codigo_barras) {
    const rawRef = `REF: ${label.codigo_barras}`;
    const { fittedText, finalFontSizePt } = fitAndTruncateText(
      rawRef,
      content.reference.fontSize || 6,
      minFont,
      maxW,
      content.autoShrink,
      content.reference.bold,
      "Courier, monospace"
    );
    const fieldHeightMm = finalFontSizePt * PT_TO_MM;
    result.reference = {
      show: true,
      text: fittedText,
      isBold: content.reference.bold,
      fontFamily: "Courier, monospace",
      fontSizePt: finalFontSizePt,
      fontSizeMm: fieldHeightMm,
      align,
      xMm: align === "center" ? widthMm / 2 : paddingMm,
      yMm: cursorY,
      widthMm: maxW,
      heightMm: fieldHeightMm,
    };
    cursorY += fieldHeightMm + lineSpacingMm;
  }

  // 4. Barcode / QR Code
  if (content.barcode.show && label.codigo_barras) {
    const barHeightMm = Math.min(Math.max(heightMm * 0.32, 7), 13);
    const maxBarcodeW = maxW * 0.75;
    const barWidthMm = Math.min(maxBarcodeW, label.tipo_codigo === "QR" ? barHeightMm : maxBarcodeW);
    const barX = align === "center" ? (widthMm - barWidthMm) / 2 : paddingMm;

    result.barcode = {
      show: true,
      barcodeValue: label.codigo_barras,
      barcodeType: label.tipo_codigo === "QR" ? "QR" : "CODE128",
      showValueText: content.showBarcodeValue ?? true,
      fontFamily: "Helvetica, Arial, sans-serif",
      fontSizePt: 8,
      fontSizeMm: 8 * PT_TO_MM,
      align,
      xMm: barX,
      yMm: cursorY,
      widthMm: barWidthMm,
      heightMm: barHeightMm,
    };
    cursorY += barHeightMm + lineSpacingMm;
  }

  // 5. Price & Size (bottom row)
  const bottomParts: string[] = [];
  if (content.price.show && label.preco != null && Number(label.preco) > 0) {
    bottomParts.push(brl(label.preco));
  }
  if (content.size.show && label.numeracao) {
    bottomParts.push(`TAM: ${label.numeracao}`);
  }

  if (bottomParts.length > 0) {
    const rawBottom = bottomParts.join("  |  ");
    const { fittedText, finalFontSizePt } = fitAndTruncateText(
      rawBottom,
      content.price.fontSize || 9,
      minFont,
      maxW,
      content.autoShrink,
      content.price.bold,
      "Helvetica, Arial, sans-serif"
    );
    const fieldHeightMm = finalFontSizePt * PT_TO_MM;
    result.priceAndSize = {
      show: true,
      text: fittedText,
      isBold: content.price.bold,
      fontFamily: "Helvetica, Arial, sans-serif",
      fontSizePt: finalFontSizePt,
      fontSizeMm: fieldHeightMm,
      align,
      xMm: align === "center" ? widthMm / 2 : paddingMm,
      yMm: cursorY,
      widthMm: maxW,
      heightMm: fieldHeightMm,
    };
    cursorY += fieldHeightMm + lineSpacingMm;
  }

  // 6. Extra Info / Footer message
  if (content.showExtraInfo && content.extraInfo) {
    const { fittedText, finalFontSizePt } = fitAndTruncateText(
      content.extraInfo,
      content.extraInfoFontSize || 6,
      minFont,
      maxW,
      content.autoShrink,
      false,
      "Helvetica, Arial, sans-serif"
    );
    const fieldHeightMm = finalFontSizePt * PT_TO_MM;
    result.extraInfo = {
      show: true,
      text: fittedText,
      isBold: false,
      fontFamily: "Helvetica, Arial, sans-serif",
      fontSizePt: finalFontSizePt,
      fontSizeMm: fieldHeightMm,
      align,
      xMm: align === "center" ? widthMm / 2 : paddingMm,
      yMm: cursorY,
      widthMm: maxW,
      heightMm: fieldHeightMm,
    };
  }

  return result;
}
