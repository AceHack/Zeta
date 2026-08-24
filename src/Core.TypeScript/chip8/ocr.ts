/**
 * ocr.ts — glyphs on screen → a structured grid of characters and numbers.
 *
 * CHIP-8 has exactly one typography: the 4×5 hex fontset the emulator loads at
 * 0x000 and carts address via `LD F, Vx`. So OCR here is not statistical — it
 * is exact template matching against the same FONTSET bitmaps the emulator
 * draws (imported, not copied: one source of truth). A match is a match; there
 * is no confidence to invent.
 *
 * The output is the "spreadsheet" view: detections snapped to rows by y and to
 * columns by x, so a score drawn at (2,1) and a timer at (40,1) come back as
 * one row with two addressable cells, and adjacent digits merge into numbers.
 *
 * Deterministic, pure, no wall clock. Anchor: template matching is the
 * degenerate (exact, binary) case of normalized cross-correlation matching
 * (Lewis 1995); with a 16-glyph closed alphabet the degenerate case is the
 * correct one, not a shortcut.
 */

import { FONTSET } from "./chip8";

export interface GlyphHit {
  /** The recognized character: "0".."9", "A".."F". */
  readonly char: string;
  /** Hex value 0..15 of the glyph. */
  readonly value: number;
  /** Top-left pixel of the 4×5 glyph cell. */
  readonly x: number;
  readonly y: number;
  /** Color value the glyph is drawn in (majority color of its lit pixels). */
  readonly color: number;
}

export interface GridCell {
  readonly row: number;
  readonly col: number;
  readonly char: string;
  readonly x: number;
  readonly y: number;
  readonly color: number;
}

export interface GlyphGrid {
  readonly cells: readonly GridCell[];
  readonly rowCount: number;
  readonly colCount: number;
}

export interface ReadNumber {
  readonly value: number;
  readonly row: number;
  /** Column of the number's first digit. */
  readonly col: number;
  readonly digits: number;
  readonly color: number;
}

const GLYPH_W = 4;
export const GLYPH_H = 5;
/** Digits drawn side by side sit 5px apart (4px glyph + 1px gap). */
export const COL_PITCH = 5;
const ROW_PITCH = 6;

/** FONTSET rows for glyph g: 5 bytes, glyph in the high nibble. */
function glyphRows(g: number): number[] {
  const rows: number[] = [];
  for (let r = 0; r < GLYPH_H; r++) rows.push((FONTSET[g * GLYPH_H + r]! >> 4) & 0xf);
  return rows;
}

const GLYPH_PATTERNS: readonly (readonly number[])[] = Array.from({ length: 16 }, (_, g) =>
  glyphRows(g),
);

const HEX_CHARS = "0123456789ABCDEF";

/**
 * Scan the display for exact 4×5 fontset matches.
 *
 * A window matches glyph g iff the lit-mask of its 4×5 cells equals the glyph
 * bitmap exactly (any nonzero color counts as lit) AND the window's 1px right
 * and bottom borders are unlit — the border rule kills the "3 inside 8"‑style
 * embedded false positives that pure window equality would admit for glyphs
 * whose bitmaps are sub-masks of a neighbour's.
 *
 * Overlapping matches resolve deterministically: scan order is row-major, and
 * a claimed cell cannot anchor a second glyph.
 */
export function recognizeGlyphs(display: readonly number[], w = 64, h = 32): GlyphHit[] {
  return scanGlyphs(display, w, h, null).hits;
}

/** A foveated glyph scan: hits found plus how many windows were actually matched. */
export interface FoveatedScan {
  readonly hits: GlyphHit[];
  /** Windows that reached template matching — the useful-work meter's denominator. */
  readonly attempts: number;
}

/** The attention grid's geometry, mirrored from attention-field (8×8 tiles). */
const FOVEA_TILE = 8;
const FOVEA_COLS = 8;

/**
 * The glyph walk, optionally restricted to windows whose ORIGIN pixel falls
 * in an allowed attention tile (`null` = scan everything). A glyph whose
 * origin sits in an attended tile is read wholly even where it overhangs the
 * tile edge; one whose origin is unattended is skipped this tick — the
 * caller's peripheral sweep guarantees every tile is revisited.
 */
export function scanGlyphs(
  display: readonly number[],
  w: number,
  h: number,
  allowedTiles: ReadonlySet<number> | null,
): FoveatedScan {
  const hits: GlyphHit[] = [];
  let attempts = 0;
  const claimed = new Set<number>(); // pixel indices already inside a hit

  const litAt = (x: number, y: number): number => {
    if (x < 0 || y < 0 || x >= w || y >= h) return 0;
    return display[y * w + x] ?? 0;
  };

  for (let y = 0; y + GLYPH_H <= h; y++) {
    for (let x = 0; x + GLYPH_W <= w; x++) {
      if (claimed.has(y * w + x)) continue;
      if (
        allowedTiles !== null &&
        !allowedTiles.has(((y / FOVEA_TILE) | 0) * FOVEA_COLS + ((x / FOVEA_TILE) | 0))
      ) {
        continue;
      }
      // Build the window's 4-bit row masks once, reuse against all 16 glyphs.
      const winRows: number[] = [];
      let anyLit = false;
      for (let r = 0; r < GLYPH_H; r++) {
        let mask = 0;
        for (let c = 0; c < GLYPH_W; c++) {
          if (litAt(x + c, y + r) !== 0) {
            mask |= 1 << (3 - c);
            anyLit = true;
          }
        }
        winRows.push(mask);
      }
      if (!anyLit) continue;

      // Border rule: the column just right of the window and the row just
      // below it must be unlit across the glyph's extent (screen edge counts
      // as unlit). Without this, e.g. every "8" contains phantom sub-glyphs.
      let borderClear = true;
      for (let r = 0; r < GLYPH_H && borderClear; r++) {
        if (litAt(x + GLYPH_W, y + r) !== 0) borderClear = false;
      }
      for (let c = 0; c < GLYPH_W && borderClear; c++) {
        if (litAt(x + c, y + GLYPH_H) !== 0) borderClear = false;
      }
      if (!borderClear) continue;

      attempts += 1;
      for (let g = 0; g < 16; g++) {
        const pat = GLYPH_PATTERNS[g]!;
        let match = true;
        for (let r = 0; r < GLYPH_H; r++) {
          if (winRows[r] !== pat[r]) {
            match = false;
            break;
          }
        }
        if (!match) continue;

        // Majority color of the glyph's lit pixels.
        const colorCounts = new Map<number, number>();
        for (let r = 0; r < GLYPH_H; r++) {
          for (let c = 0; c < GLYPH_W; c++) {
            if ((pat[r]! >> (3 - c)) & 1) {
              const col = litAt(x + c, y + r);
              colorCounts.set(col, (colorCounts.get(col) ?? 0) + 1);
              claimed.add((y + r) * w + (x + c));
            }
          }
        }
        let color = 0;
        let best = -1;
        for (const [col, cnt] of colorCounts) {
          if (cnt > best || (cnt === best && col < color)) {
            best = cnt;
            color = col;
          }
        }

        hits.push({ char: HEX_CHARS[g]!, value: g, x, y, color });
        break; // exact alphabet: at most one glyph matches a window
      }
    }
  }
  return { hits, attempts };
}

/**
 * Snap glyph hits to the spreadsheet view: rows grouped by y (within half a
 * row pitch), columns assigned by x / COL_PITCH within the row's origin.
 */
export function snapToGrid(hits: readonly GlyphHit[]): GlyphGrid {
  if (hits.length === 0) return { cells: [], rowCount: 0, colCount: 0 };
  const sorted = [...hits].sort((a, b) => a.y - b.y || a.x - b.x);

  const cells: GridCell[] = [];
  let row = -1;
  let rowY = Number.NEGATIVE_INFINITY;
  let rowOriginX = 0;
  let maxCol = 0;
  for (const hit of sorted) {
    if (hit.y - rowY > ROW_PITCH / 2) {
      row += 1;
      rowY = hit.y;
      rowOriginX = hit.x;
    }
    const col = Math.round((hit.x - rowOriginX) / COL_PITCH);
    if (col > maxCol) maxCol = col;
    cells.push({ row, col, char: hit.char, x: hit.x, y: hit.y, color: hit.color });
  }
  return { cells, rowCount: row + 1, colCount: maxCol + 1 };
}

/**
 * Merge horizontally-adjacent digit cells (consecutive columns, same row) into
 * numbers. "A".."F" cells break a run — scores are decimal on screen.
 */
export function readNumbers(grid: GlyphGrid): ReadNumber[] {
  const numbers: ReadNumber[] = [];
  const byRow = new Map<number, GridCell[]>();
  for (const c of grid.cells) {
    const arr = byRow.get(c.row) ?? [];
    arr.push(c);
    byRow.set(c.row, arr);
  }
  for (const [row, cellsRaw] of [...byRow.entries()].sort((a, b) => a[0] - b[0])) {
    const cells = cellsRaw.sort((a, b) => a.col - b.col);
    let run: GridCell[] = [];
    const flush = (): void => {
      if (run.length === 0) return;
      let value = 0;
      for (const c of run) value = value * 10 + c.char.charCodeAt(0) - 48;
      numbers.push({ value, row, col: run[0]!.col, digits: run.length, color: run[0]!.color });
      run = [];
    };
    for (const cell of cells) {
      const isDigit = cell.char >= "0" && cell.char <= "9";
      const contiguous = run.length > 0 && cell.col === run[run.length - 1]!.col + 1;
      if (!isDigit || (run.length > 0 && !contiguous)) flush();
      if (isDigit) run.push(cell);
    }
    flush();
  }
  return numbers;
}

/** One call: display → structured readout. */
export function readScreen(
  display: readonly number[],
  w = 64,
  h = 32,
): { readonly grid: GlyphGrid; readonly numbers: readonly ReadNumber[] } {
  const grid = snapToGrid(recognizeGlyphs(display, w, h));
  return { grid, numbers: readNumbers(grid) };
}

/** readScreen restricted to attention tiles, reporting match attempts (D2). */
export function readScreenFoveated(
  display: readonly number[],
  allowedTiles: ReadonlySet<number>,
  w = 64,
  h = 32,
): { readonly grid: GlyphGrid; readonly numbers: readonly ReadNumber[]; readonly attempts: number } {
  const scan = scanGlyphs(display, w, h, allowedTiles);
  const grid = snapToGrid(scan.hits);
  return { grid, numbers: readNumbers(grid), attempts: scan.attempts };
}
