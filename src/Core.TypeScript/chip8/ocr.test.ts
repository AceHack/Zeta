import { describe, expect, test } from "bun:test";
import { FONTSET } from "./chip8";
import { readScreen, recognizeGlyphs, snapToGrid } from "./ocr";

const W = 64;
const H = 32;

function blank(): number[] {
  return new Array(W * H).fill(0);
}

/** Paint fontset glyph g at (x, y) in `color` — exactly as DRW+LD F would. */
function paintGlyph(d: number[], g: number, x: number, y: number, color = 1): void {
  for (let r = 0; r < 5; r++) {
    const rowBits = (FONTSET[g * 5 + r]! >> 4) & 0xf;
    for (let c = 0; c < 4; c++) {
      if ((rowBits >> (3 - c)) & 1) d[(y + r) * W + (x + c)] = color;
    }
  }
}

describe("ocr — glyph recognition", () => {
  test("recognizes every one of the 16 fontset glyphs in isolation", () => {
    for (let g = 0; g < 16; g++) {
      const d = blank();
      paintGlyph(d, g, 12, 9);
      const hits = recognizeGlyphs(d);
      expect(hits).toHaveLength(1);
      expect(hits[0]!.value).toBe(g);
      expect(hits[0]!.x).toBe(12);
      expect(hits[0]!.y).toBe(9);
    }
  });

  test("reports the glyph's color", () => {
    const d = blank();
    paintGlyph(d, 7, 5, 5, 2);
    const hits = recognizeGlyphs(d);
    expect(hits[0]!.color).toBe(2);
  });

  test("does not hallucinate glyphs on arbitrary rectangles", () => {
    const d = blank();
    // Solid blocks (the game sprites) are not fontset glyphs.
    for (let y = 10; y < 14; y++) for (let x = 20; x < 24; x++) d[y * W + x] = 1;
    for (let y = 20; y < 22; y++) for (let x = 40; x < 42; x++) d[y * W + x] = 2;
    expect(recognizeGlyphs(d)).toHaveLength(0);
  });

  test("adjacent digits at the 5px pitch are both recognized (border rule)", () => {
    const d = blank();
    paintGlyph(d, 4, 2, 3);
    paintGlyph(d, 2, 7, 3);
    const hits = recognizeGlyphs(d);
    expect(hits.map((h) => h.char).sort()).toEqual(["2", "4"]);
  });
});

describe("ocr — the spreadsheet view", () => {
  test("rows and columns snap into a grid", () => {
    const d = blank();
    // Row 1: "0 1 2"  Row 2: "3 4 5" — 5px column pitch, 7px row pitch.
    paintGlyph(d, 0, 2, 2);
    paintGlyph(d, 1, 7, 2);
    paintGlyph(d, 2, 12, 2);
    paintGlyph(d, 3, 2, 9);
    paintGlyph(d, 4, 7, 9);
    paintGlyph(d, 5, 12, 9);
    const grid = snapToGrid(recognizeGlyphs(d));
    expect(grid.rowCount).toBe(2);
    expect(grid.colCount).toBe(3);
    const cell = (r: number, c: number) => grid.cells.find((x) => x.row === r && x.col === c)!.char;
    expect([cell(0, 0), cell(0, 1), cell(0, 2)]).toEqual(["0", "1", "2"]);
    expect([cell(1, 0), cell(1, 1), cell(1, 2)]).toEqual(["3", "4", "5"]);
  });

  test("adjacent digits merge into multi-digit numbers; separated ones do not", () => {
    const d = blank();
    paintGlyph(d, 4, 2, 3); // "42" — adjacent columns
    paintGlyph(d, 2, 7, 3);
    paintGlyph(d, 9, 40, 3); // a lone "9" far to the right, same row
    const { numbers } = readScreen(d);
    const values = numbers.map((n) => n.value).sort((a, b) => a - b);
    expect(values).toEqual([9, 42]);
    const fortyTwo = numbers.find((n) => n.value === 42)!;
    expect(fortyTwo.digits).toBe(2);
    expect(fortyTwo.row).toBe(0);
  });

  test("hex letters break a digit run", () => {
    const d = blank();
    paintGlyph(d, 1, 2, 3);
    paintGlyph(d, 0xa, 7, 3); // "A" between digits
    paintGlyph(d, 2, 12, 3);
    const { numbers } = readScreen(d);
    expect(numbers.map((n) => n.value).sort((a, b) => a - b)).toEqual([1, 2]);
  });
});
