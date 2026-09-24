import { useMemo } from "react";
import JsBarcode from "jsbarcode";
import { QRCodeSVG } from "qrcode.react";
import type {
  A4Profile,
  ThermalProfile,
} from "@/hooks/use-label-settings";
import {
  computeCompleteLabelLayout,
  type ComputedSheetLayout,
  type ComputedLabel,
} from "@/lib/label-layout-engine";

// ─── Millimeter to Pixel Helper ───────────────────────────────────────
function mmToPx(mm: number, scale: number) {
  return mm * scale;
}

// ─── Single Unified Label Renderer ────────────────────────────────────
interface UnifiedLabelCellProps {
  computed: ComputedLabel;
  scale: number;
  isPrint?: boolean;
}

export function UnifiedLabelCell({
  computed,
  scale,
  isPrint,
}: UnifiedLabelCellProps) {
  const widthPx = mmToPx(computed.widthMm, scale);
  const heightPx = mmToPx(computed.heightMm, scale);
  const padPx = mmToPx(computed.paddingMm, scale);

  const barcodeId = `barcode-unified-${computed.index}-${isPrint ? "print" : "screen"}`;

  return (
    <div
      className="flex flex-col items-center justify-between text-center overflow-hidden"
      style={{
        width: `${widthPx}px`,
        height: `${heightPx}px`,
        padding: `${padPx}px`,
        border: isPrint ? "none" : "1px dashed rgba(0,0,0,0.12)",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      {/* Top Group: Header, Product Name, Reference */}
      <div className="w-full flex flex-col items-center overflow-hidden min-h-0">
        {computed.header?.show && (
          <span
            style={{
              fontSize: `${computed.header.fontSizePt * scale * 0.352778}px`,
              fontWeight: 800,
              fontFamily: computed.header.fontFamily,
              lineHeight: 1.1,
              letterSpacing: "0.5px",
              maxWidth: "100%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              display: "block",
            }}
          >
            {computed.header.text}
          </span>
        )}

        {computed.productName?.show && (
          <span
            style={{
              fontSize: `${computed.productName.fontSizePt * scale * 0.352778}px`,
              fontWeight: computed.productName.isBold ? 700 : 400,
              fontFamily: computed.productName.fontFamily,
              lineHeight: 1.15,
              maxWidth: "100%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              display: "block",
            }}
            title={computed.label?.produto_nome}
          >
            {computed.productName.text}
          </span>
        )}

        {computed.reference?.show && (
          <span
            style={{
              fontSize: `${computed.reference.fontSizePt * scale * 0.352778}px`,
              fontWeight: computed.reference.isBold ? 700 : 400,
              fontFamily: computed.reference.fontFamily,
              lineHeight: 1.1,
              color: "#555",
              maxWidth: "100%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              display: "block",
            }}
          >
            {computed.reference.text}
          </span>
        )}
      </div>

      {/* Barcode / QR Center */}
      {computed.barcode?.show && (
        <div
          className="flex items-center justify-center w-full overflow-hidden my-auto"
          style={{
            maxHeight: `${mmToPx(computed.barcode.heightMm, scale)}px`,
            minHeight: `${Math.max(10, heightPx * 0.2)}px`,
          }}
        >
          {computed.barcode.barcodeType === "QR" ? (
            <QRCodeSVG
              value={computed.barcode.barcodeValue || "0000"}
              size={Math.min(
                mmToPx(computed.barcode.widthMm, scale),
                mmToPx(computed.barcode.heightMm, scale)
              )}
            />
          ) : (
            <BarcodeInline
              id={barcodeId}
              value={computed.barcode.barcodeValue || "0000"}
              width={mmToPx(computed.barcode.widthMm, scale)}
              height={mmToPx(computed.barcode.heightMm, scale)}
              showValue={computed.barcode.showValueText}
            />
          )}
        </div>
      )}

      {/* Bottom Group: Price, Size, Extra Info */}
      <div className="w-full flex flex-col items-center overflow-hidden min-h-0">
        {computed.priceAndSize?.show && (
          <span
            style={{
              fontSize: `${computed.priceAndSize.fontSizePt * scale * 0.352778}px`,
              fontWeight: computed.priceAndSize.isBold ? 800 : 500,
              fontFamily: computed.priceAndSize.fontFamily,
              lineHeight: 1.15,
              color: "#000",
              maxWidth: "100%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {computed.priceAndSize.text}
          </span>
        )}

        {computed.extraInfo?.show && (
          <span
            style={{
              fontSize: `${computed.extraInfo.fontSizePt * scale * 0.352778}px`,
              color: "#666",
              lineHeight: 1.1,
              maxWidth: "100%",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              display: "block",
              marginTop: "1px",
            }}
          >
            {computed.extraInfo.text}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Inline Barcode SVG for Screen & Browser Print ────────────────────
function BarcodeInline({
  id,
  value,
  width,
  height,
  showValue,
}: {
  id: string;
  value: string;
  width: number;
  height: number;
  showValue: boolean;
}) {
  return (
    <svg
      id={id}
      ref={(el) => {
        if (el) {
          try {
            JsBarcode(el, value, {
              format: "CODE128",
              width: Math.max(1, Math.floor(width / 75)),
              height: Math.max(height * 0.7, 10),
              displayValue: showValue,
              fontSize: Math.max(6, Math.min(10, height * 0.25)),
              margin: 0,
              textMargin: 1,
            });
          } catch {}
        }
      }}
      className="max-w-full"
      style={{ maxWidth: `${width}px`, maxHeight: `${height}px` }}
    />
  );
}

// ─── Calibration Test Cell ───────────────────────────────────────────
function TestCell({
  index,
  row,
  col,
  width,
  height,
  widthMm,
  heightMm,
}: {
  index: number;
  row: number;
  col: number;
  width: number;
  height: number;
  widthMm: number;
  heightMm: number;
}) {
  return (
    <div
      style={{
        width: `${width}px`,
        height: `${height}px`,
        border: "1px solid #000",
        boxSizing: "border-box",
        position: "relative",
        background: "rgba(0,0,0,0.01)",
        overflow: "hidden",
      }}
      className="flex flex-col items-center justify-center select-none"
    >
      {/* Center crosshair (+) */}
      <div
        className="absolute top-1/2 left-0 right-0 border-t border-dashed border-gray-400"
        style={{ transform: "translateY(-50%)" }}
      />
      <div
        className="absolute left-1/2 top-0 bottom-0 border-l border-dashed border-gray-400"
        style={{ transform: "translateX(-50%)" }}
      />

      {/* Corner marks */}
      <div className="absolute top-1 left-1 text-[8px] font-mono text-gray-500">
        ┌
      </div>
      <div className="absolute top-1 right-1 text-[8px] font-mono text-gray-500">
        ┐
      </div>
      <div className="absolute bottom-1 left-1 text-[8px] font-mono text-gray-500">
        └
      </div>
      <div className="absolute bottom-1 right-1 text-[8px] font-mono text-gray-500">
        ┘
      </div>

      {/* Label Info in Center */}
      <div className="relative z-10 bg-white/90 px-1 py-0.5 rounded border border-gray-200 text-center">
        <p className="text-[10px] font-black leading-tight">#{index + 1}</p>
        <p className="text-[8px] text-gray-600 font-mono leading-tight">
          L{row + 1} C{col + 1}
        </p>
        <p className="text-[7px] text-gray-500 font-mono leading-tight">
          {widthMm}×{heightMm}mm
        </p>
      </div>
    </div>
  );
}

// ─── Millimeter Rulers ───────────────────────────────────────────────
function MmRulerHorizontal({
  widthMm,
  scale,
}: {
  widthMm: number;
  scale: number;
}) {
  const step = 10;
  const count = Math.floor(widthMm / step);

  return (
    <div
      className="relative border-b border-black text-[7px] font-mono text-gray-700 select-none"
      style={{
        width: `${mmToPx(widthMm, scale)}px`,
        height: `${mmToPx(5, scale)}px`,
      }}
    >
      {Array.from({ length: count + 1 }).map((_, i) => {
        const mm = i * step;
        const x = mmToPx(mm, scale);
        return (
          <div
            key={mm}
            className="absolute top-0 bottom-0 border-l border-black flex flex-col justify-end"
            style={{ left: `${x}px` }}
          >
            {mm % 20 === 0 && (
              <span className="transform -translate-x-1/2 translate-y-[-1px] text-[7px]">
                {mm}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function MmRulerVertical({
  heightMm,
  scale,
}: {
  heightMm: number;
  scale: number;
}) {
  const step = 10;
  const count = Math.floor(heightMm / step);

  return (
    <div
      className="relative border-r border-black text-[7px] font-mono text-gray-700 select-none"
      style={{
        height: `${mmToPx(heightMm, scale)}px`,
        width: `${mmToPx(5, scale)}px`,
      }}
    >
      {Array.from({ length: count + 1 }).map((_, i) => {
        const mm = i * step;
        const y = mmToPx(mm, scale);
        return (
          <div
            key={mm}
            className="absolute left-0 right-0 border-t border-black flex items-center justify-end pr-0.5"
            style={{ top: `${y}px` }}
          >
            {mm % 20 === 0 && (
              <span className="transform -translate-y-1/2 text-[6px]">
                {mm}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── A4 Sheet Preview ────────────────────────────────────────────────
interface A4PreviewProps {
  profile: A4Profile;
  labels: any[];
  containerWidth: number;
  isPrint?: boolean;
  isTestSheet?: boolean;
}

export function A4SheetPreview({
  profile,
  labels,
  containerWidth,
  isPrint,
  isTestSheet,
}: A4PreviewProps) {
  const scale = useMemo(() => {
    if (isPrint) return 3.7795275591; // 1mm = 3.7795px at 96dpi
    return Math.min((containerWidth - 32) / profile.paperWidth, 4);
  }, [containerWidth, profile.paperWidth, isPrint]);

  // Unified mathematical layout computation
  const layout = useMemo(() => {
    return computeCompleteLabelLayout({
      profileType: "a4",
      a4: profile,
      thermal: {} as any,
      labels,
      isTestSheet,
    });
  }, [profile, labels, isTestSheet]);

  const pageW = mmToPx(layout.pageWidthMm, scale);
  const pageH = mmToPx(layout.pageHeightMm, scale);

  return (
    <div className={isPrint ? "" : "space-y-6"}>
      {layout.pages.map((page, pageIdx) => (
        <div
          key={pageIdx}
          className={
            isPrint
              ? "print-page"
              : "bg-white rounded-lg shadow-md mx-auto border border-gray-200"
          }
          style={{
            width: `${pageW}px`,
            height: `${pageH}px`,
            position: "relative",
            overflow: "hidden",
            boxSizing: "border-box",
            pageBreakAfter:
              isPrint && pageIdx < layout.pages.length - 1 ? "always" : undefined,
          }}
        >
          {/* Test Sheet Header Info */}
          {isTestSheet && (
            <div
              className="absolute left-2 top-2 z-20 text-black text-[9px] font-sans font-bold leading-tight"
              style={{ maxWidth: `${pageW - 20}px` }}
            >
              <span>FOLHA DE TESTE E CALIBRAÇÃO — {profile.presetName}</span>
              <span className="font-mono text-gray-600 font-normal ml-2">
                OffsetX: {profile.offsetX}mm | OffsetY: {profile.offsetY}mm | Grade: {profile.columns}×{profile.rows} ({profile.labelWidth}×{profile.labelHeight}mm)
              </span>
            </div>
          )}

          {/* Rulers on test sheet */}
          {isTestSheet && (
            <>
              <div className="absolute top-0 left-0 right-0 z-10">
                <MmRulerHorizontal widthMm={profile.paperWidth} scale={scale} />
              </div>
              <div className="absolute top-0 bottom-0 left-0 z-10">
                <MmRulerVertical heightMm={profile.paperHeight} scale={scale} />
              </div>
            </>
          )}

          {/* Render Labels at Exact Millimeter Coordinates */}
          {page.labels.map((computedLabel) => {
            const x = mmToPx(computedLabel.xMm, scale);
            const y = mmToPx(computedLabel.yMm, scale);
            const w = mmToPx(computedLabel.widthMm, scale);
            const h = mmToPx(computedLabel.heightMm, scale);

            if (isTestSheet) {
              return (
                <div
                  key={computedLabel.index}
                  style={{
                    position: "absolute",
                    left: `${x}px`,
                    top: `${y}px`,
                  }}
                >
                  <TestCell
                    index={computedLabel.index}
                    row={computedLabel.row}
                    col={computedLabel.col}
                    width={w}
                    height={h}
                    widthMm={computedLabel.widthMm}
                    heightMm={computedLabel.heightMm}
                  />
                </div>
              );
            }

            if (!computedLabel.label || computedLabel.label.id?.startsWith?.("empty-")) {
              return (
                <div
                  key={computedLabel.index}
                  style={{
                    position: "absolute",
                    left: `${x}px`,
                    top: `${y}px`,
                    width: `${w}px`,
                    height: `${h}px`,
                  }}
                  className={isPrint ? "" : "border border-dashed border-gray-100"}
                />
              );
            }

            return (
              <div
                key={computedLabel.index}
                style={{
                  position: "absolute",
                  left: `${x}px`,
                  top: `${y}px`,
                }}
              >
                <UnifiedLabelCell
                  computed={computedLabel}
                  scale={scale}
                  isPrint={isPrint}
                />
              </div>
            );
          })}

          {/* Margin guide lines (screen only, when not test sheet) */}
          {!isPrint && !isTestSheet && (
            <>
              <div
                className="absolute left-0 right-0 border-b border-dashed border-blue-300/60 pointer-events-none"
                style={{
                  top: `${mmToPx(profile.marginTop + profile.offsetY, scale)}px`,
                }}
              />
              <div
                className="absolute top-0 bottom-0 border-r border-dashed border-blue-300/60 pointer-events-none"
                style={{
                  left: `${mmToPx(profile.marginLeft + profile.offsetX, scale)}px`,
                }}
              />
            </>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Thermal Strip Preview (1 or 2 columns) ───────────────────────────
interface ThermalPreviewProps {
  profile: ThermalProfile;
  labels: any[];
  containerWidth: number;
  isPrint?: boolean;
  isTestSheet?: boolean;
}

export function ThermalStripPreview({
  profile,
  labels,
  containerWidth,
  isPrint,
  isTestSheet,
}: ThermalPreviewProps) {
  const scale = useMemo(() => {
    if (isPrint) return 3.7795275591;
    return Math.min((containerWidth - 32) / profile.paperWidth, 5);
  }, [containerWidth, profile.paperWidth, isPrint]);

  // Unified mathematical layout computation
  const layout = useMemo(() => {
    return computeCompleteLabelLayout({
      profileType: "thermal",
      a4: {} as any,
      thermal: profile,
      labels,
      isTestSheet,
    });
  }, [profile, labels, isTestSheet]);

  const pageW = mmToPx(layout.pageWidthMm, scale);
  const pageH = mmToPx(layout.pageHeightMm, scale);

  return (
    <div className={isPrint ? "" : "space-y-3"}>
      {layout.pages.length === 0 ? (
        <div
          className="bg-white rounded-lg shadow-md mx-auto border border-gray-200 flex items-center justify-center"
          style={{
            width: `${pageW}px`,
            minHeight: `${pageH}px`,
          }}
        >
          <span className="text-muted-foreground text-xs">
            Nenhuma etiqueta
          </span>
        </div>
      ) : (
        layout.pages.map((page, pageIdx) => (
          <div
            key={pageIdx}
            className={
              isPrint
                ? "print-page"
                : "bg-white rounded-lg shadow-md mx-auto border border-gray-200"
            }
            style={{
              width: `${pageW}px`,
              height: `${pageH}px`,
              overflow: "hidden",
              boxSizing: "border-box",
              position: "relative",
              pageBreakAfter:
                isPrint && pageIdx < layout.pages.length - 1 ? "always" : "avoid",
              pageBreakInside: "avoid",
            }}
          >
            {isTestSheet && pageIdx === 0 && (
              <div className="absolute top-0 left-0 right-0 z-10">
                <MmRulerHorizontal widthMm={profile.paperWidth} scale={scale} />
              </div>
            )}

            {page.labels.map((computedLabel) => {
              const x = mmToPx(computedLabel.xMm, scale);
              const y = mmToPx(computedLabel.yMm, scale);
              const w = mmToPx(computedLabel.widthMm, scale);
              const h = mmToPx(computedLabel.heightMm, scale);

              if (isTestSheet) {
                return (
                  <div
                    key={computedLabel.index}
                    style={{
                      position: "absolute",
                      left: `${x}px`,
                      top: `${y}px`,
                    }}
                  >
                    <TestCell
                      index={computedLabel.index}
                      row={computedLabel.row}
                      col={computedLabel.col}
                      width={w}
                      height={h}
                      widthMm={computedLabel.widthMm}
                      heightMm={computedLabel.heightMm}
                    />
                  </div>
                );
              }

              return (
                <div
                  key={computedLabel.index}
                  style={{
                    position: "absolute",
                    left: `${x}px`,
                    top: `${y}px`,
                  }}
                >
                  <UnifiedLabelCell
                    computed={computedLabel}
                    scale={scale}
                    isPrint={isPrint}
                  />
                </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}
