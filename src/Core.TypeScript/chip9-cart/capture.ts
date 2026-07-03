/**
 * chip9-cart capture format v1 (081KWJE90EZ, layer-4 first slice).
 *
 * A capture is stored as a chip9 CARTRIDGE — a program that redraws itself on the treaty VM —
 * never as pixels. The cart artifact is TEXT (hex-in-JSON; no-binary-in-proof-lineage) and
 * SELF-VERIFYING: it carries its own golden render, and `verify` re-executes the ROM and
 * byte-compares — regenerating IS the check (gen(gen)==gen; the generator is the ECC).
 *
 * HONEST SCOPE: v1's "generator" is the degenerate one — literal sprite blits (a blit-list
 * program, the identity generator). It already gives content-proportional size (empty tiles
 * compile to nothing) and Cheat-Engine-searchable program-matter (bounded VM, deterministic,
 * finite step count), but it does NOT predict itself; the compile-to-generator compressor
 * (081KTH5N5ZJ) is the upgrade path that replaces blits with smaller programs. The photo->grid
 * front end (vector/semantic layers) is also NOT here: input is a hex color grid (0-7, the
 * chip9 3-plane gamut), which the paper-capture pipeline will produce upstream.
 */

import { colorAt, create, loadRom, step, W, H, type Frame } from "../chip9/chip9";

export interface CaptureCart {
  readonly format: "chip9-cart-capture/v1";
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly romHex: string; // the program+sprite bytes, hex text (diffable, byte-lockable)
  readonly steps: number; // exact instruction count to execute (straight-line program)
  readonly goldenRows: readonly string[]; // self-carried golden render, one hex row per line
}

const PROGRAM_START = 0x200;
const MEM_END = 0x1000; // NNN-addressable ceiling
const TILE_H = 15; // DXYN n <= 15

/** Parse a text grid of hex digits 0-7 (rows of equal length) into pixel colors. */
export function parseGrid(text: string): number[][] {
  const rows = text
    .split("\n")
    .map((r) => r.trim())
    .filter((r) => r.length > 0)
    .map((r) => [...r].map((ch) => parseInt(ch, 16)));
  if (rows.length === 0 || rows.length > H) throw new Error(`grid height must be 1..${H}`);
  const w = rows[0]!.length;
  if (w === 0 || w > W) throw new Error(`grid width must be 1..${W}`);
  for (const row of rows) {
    if (row.length !== w) throw new Error("ragged grid");
    for (const px of row) {
      if (Number.isNaN(px) || px < 0 || px > 7) throw new Error("pixel colors must be hex 0-7 (3 planes)");
    }
  }
  return rows;
}

interface Draw {
  plane: 1 | 2 | 4;
  x: number;
  y: number;
  sprite: number[]; // 1..15 bytes
}

/** Compile a color grid into a self-verifying chip9 cart. Content-proportional: empty tiles emit nothing. */
export function compile(name: string, grid: number[][]): CaptureCart {
  const h = grid.length;
  const w = grid[0]!.length;

  // Plan: per plane, per 8-wide band, per 15-tall tile — one sprite blit; skip all-zero tiles.
  const draws: Draw[] = [];
  for (const plane of [1, 2, 4] as const) {
    for (let x0 = 0; x0 < w; x0 += 8) {
      for (let y0 = 0; y0 < h; y0 += TILE_H) {
        const rows: number[] = [];
        for (let dy = 0; dy < TILE_H && y0 + dy < h; dy++) {
          let byte = 0;
          for (let dx = 0; dx < 8 && x0 + dx < w; dx++) {
            if (((grid[y0 + dy]![x0 + dx] ?? 0) & plane) !== 0) byte |= 0x80 >> dx;
          }
          rows.push(byte);
        }
        while (rows.length > 0 && rows[rows.length - 1] === 0) rows.pop(); // trim trailing blanks
        if (rows.some((b) => b !== 0)) draws.push({ plane, x: x0, y: y0, sprite: rows });
      }
    }
  }

  // Sprite CODEBOOK (compiler v1.1, the 081KTH5N5ZJ executable-codebook idea at its most
  // degenerate): identical sprite blobs are content-addressed and stored ONCE; every draw of the
  // same tile shares one data address. Dense uniform grounds (white paper) collapse to a handful
  // of distinct sprites. Plus peephole: skip re-setting I/V0/V1 when the register already holds
  // the value (straight-line program, so register state is statically known).
  const codebook = new Map<string, number>(); // sprite bytes -> ordinal
  const spriteOf = (d: Draw): number => {
    const key = d.sprite.join(",");
    let ord = codebook.get(key);
    if (ord === undefined) {
      ord = codebook.size;
      codebook.set(key, ord);
    }
    return ord;
  };
  const drawPlan = draws.map((d) => ({ d, ord: spriteOf(d) }));
  const blobs: number[][] = [...codebook.keys()].map((k) => k.split(",").map(Number));

  // Two-pass sizing: count instructions with peephole knowledge, then place the codebook after code.
  const plan = (): number => {
    let count = 0;
    let plane = 1;
    let iOrd = -1;
    let v0 = -1;
    let v1 = -1;
    for (const { d, ord } of drawPlan) {
      if (d.plane !== plane) { count += 1; plane = d.plane; }
      if (ord !== iOrd) { count += 1; iOrd = ord; }
      if (d.x !== v0) { count += 1; v0 = d.x; }
      if (d.y !== v1) { count += 1; v1 = d.y; }
      count += 1; // DRW
    }
    return count;
  };
  const instrCount = plan();
  const codeEnd = PROGRAM_START + instrCount * 2;
  const blobAddr: number[] = [];
  {
    let at = codeEnd;
    for (const blob of blobs) { blobAddr.push(at); at += blob.length; }
  }

  const ops: number[] = [];
  let steps = 0;
  let currentPlane = 1; // VM boot default
  let currentI = -1;
  let currentV0 = -1;
  let currentV1 = -1;
  const emit = (op: number): void => {
    ops.push((op >> 8) & 0xff, op & 0xff);
    steps += 1;
  };
  for (const { d, ord } of drawPlan) {
    if (d.plane !== currentPlane) {
      emit(0xf001 | (d.plane << 8)); // F{plane}01 plane select
      currentPlane = d.plane;
    }
    if (ord !== currentI) {
      emit(0xa000 | blobAddr[ord]!); // I := shared sprite
      currentI = ord;
    }
    if (d.x !== currentV0) {
      emit(0x6000 | d.x); // V0 := x
      currentV0 = d.x;
    }
    if (d.y !== currentV1) {
      emit(0x6100 | d.y); // V1 := y
      currentV1 = d.y;
    }
    emit(0xd010 | d.sprite.length); // DRW V0,V1,n
  }
  const spriteBytes: number[] = blobs.flat();
  const spriteAddr = codeEnd + spriteBytes.length;
  if (steps !== instrCount) throw new Error(`assembler drift: planned ${instrCount} instructions, emitted ${steps}`);
  if (spriteAddr > MEM_END) {
    throw new Error(`capture too complex for one cart: needs ${spriteAddr - PROGRAM_START} bytes, ceiling ${MEM_END - PROGRAM_START}`);
  }
  const rom = [...ops, ...spriteBytes];
  const romHex = rom.map((b) => b.toString(16).padStart(2, "0")).join("");
  const cart: Omit<CaptureCart, "goldenRows"> = {
    format: "chip9-cart-capture/v1",
    name,
    width: w,
    height: h,
    romHex,
    steps,
  };
  // Self-carried golden render: what the ROM actually draws (the treaty grid shape).
  const goldenRows = renderRows(cart);
  return { ...cart, goldenRows };
}

function runCart(cart: Omit<CaptureCart, "goldenRows">): Frame {
  const rom = new Uint8Array((cart.romHex.match(/.{2}/g) ?? []).map((hx) => parseInt(hx, 16)));
  let f = loadRom(rom, create());
  for (let s = 0; s < cart.steps; s++) f = step(f);
  return f;
}

/** Execute the cart on the treaty VM and read back the drawn region as hex rows. */
export function renderRows(cart: Omit<CaptureCart, "goldenRows">): string[] {
  const f = runCart(cart);
  const rows: string[] = [];
  for (let y = 0; y < cart.height; y++) {
    let row = "";
    for (let x = 0; x < cart.width; x++) row += colorAt(x, y, f).toString(16);
    rows.push(row);
  }
  return rows;
}

/** The ECC property: re-run the generator, byte-compare against the carried golden render. */
export function verify(cart: CaptureCart): boolean {
  const rendered = renderRows(cart);
  return rendered.length === cart.goldenRows.length && rendered.every((r, i) => r === cart.goldenRows[i]);
}

/** Round-trip check against the ORIGINAL grid (compile-time honesty: capture == render). */
export function roundTrips(grid: number[][], cart: CaptureCart): boolean {
  const rendered = renderRows(cart);
  return grid.every((row, y) => row.map((px) => px.toString(16)).join("") === rendered[y]);
}
