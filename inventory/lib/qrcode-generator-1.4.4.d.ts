/**
 * Inventory — minimal type declarations for the vendored QR encoder (Phase 6).
 * ---------------------------------------------------------------------------
 * Sidecar for the byte-identical vendored qrcode-generator-1.4.4.js
 * (kazuhikoarase, MIT). Type-only; declares just the subset of the encoder API
 * the page + proofs use, so `import qrcode from "..."` type-checks. The vendored
 * .js is NOT edited (its sha384 verifies against upstream) — types live here.
 */

/** A built QR model: query the module grid + render helpers. */
export interface QRCodeModel {
  addData(data: string): void;
  make(): void;
  getModuleCount(): number;
  isDark(row: number, col: number): boolean;
  /** Returns a `data:image/gif;base64,...` URL (cellSize px/module, margin modules). */
  createDataURL(cellSize?: number, margin?: number): string;
  /** Returns an `<svg>...</svg>` string. */
  createSvgTag(cellSize?: number, margin?: number): string;
}

/** typeNumber 0 = auto-fit; errorCorrectionLevel one of L/M/Q/H. */
declare function qrcode(
  typeNumber: number,
  errorCorrectionLevel: "L" | "M" | "Q" | "H",
): QRCodeModel;

export default qrcode;
