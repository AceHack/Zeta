import { describe, expect, it } from "bun:test";
import { compile, parseGrid, renderRows, roundTrips, verify } from "./capture";
import { mix, GOLDEN_RATIO } from "../splitmix64/splitmix64";

const MASK = (1n << 64n) - 1n;

// A small multi-color "capture" (a Z glyph in color 7 on a color-2 underline, color-5 dot).
const zGlyph = `
77777770
00000700
00007000
00070000
00700005
77777770
22222222
`;

describe("chip9-cart capture format v1 (081KWJE90EZ)", () => {
  it("ROUND-TRIP BYTE-LOCK: compile -> execute on the treaty VM -> every pixel equals the source", () => {
    const grid = parseGrid(zGlyph);
    const cart = compile("z-glyph", grid);
    expect(roundTrips(grid, cart)).toBe(true);
    expect(verify(cart)).toBe(true); // self-carried golden render agrees with re-execution
  });

  it("WORST CASE: a seeded-random full 64x32 8-color grid still round-trips exactly (DST source)", () => {
    let s = 0xE66n;
    const grid = Array.from({ length: 32 }, () =>
      Array.from({ length: 64 }, () => {
        s = (s + GOLDEN_RATIO) & MASK;
        return Number(mix(s) & 7n);
      }),
    );
    const cart = compile("worst-case-random", grid);
    expect(roundTrips(grid, cart)).toBe(true);
    expect(cart.romHex.length / 2).toBeLessThan(0xe00); // fits the NNN-addressable cart ceiling
  });

  it("CONTENT-PROPORTIONAL: a nearly-empty capture compiles to a far smaller cart than a dense one", () => {
    const sparse = Array.from({ length: 32 }, (_, y) =>
      Array.from({ length: 64 }, (_, x) => (x === 5 && y === 5 ? 7 : 0)),
    );
    const dense = Array.from({ length: 32 }, () => Array.from({ length: 64 }, () => 7));
    const sparseCart = compile("sparse", sparse);
    const denseCart = compile("dense", dense);
    expect(sparseCart.romHex.length).toBeLessThan(denseCart.romHex.length / 10);
    expect(roundTrips(sparse, sparseCart)).toBe(true);
    expect(roundTrips(dense, denseCart)).toBe(true);
  });

  it("SELF-VERIFYING (generator IS the ECC): tampering ROM or golden render fails verify", () => {
    const cart = compile("z-glyph", parseGrid(zGlyph));
    const flip = (hex: string, at: number): string =>
      hex.slice(0, at) + ((parseInt(hex[at]!, 16) ^ 0x8) & 0xf).toString(16) + hex.slice(at + 1);
    // corrupt a sprite byte (tail of the ROM) -> render drifts -> caught
    const tamperedRom = { ...cart, romHex: flip(cart.romHex, cart.romHex.length - 1) };
    expect(verify(tamperedRom)).toBe(false);
    // corrupt the carried golden render -> caught
    const rows = [...cart.goldenRows];
    rows[0] = flip(rows[0]!, 0);
    expect(verify({ ...cart, goldenRows: rows })).toBe(false);
  });

  it("DETERMINISTIC: same grid -> byte-identical cart; render is replay-stable", () => {
    const grid = parseGrid(zGlyph);
    const a = compile("z", grid);
    const b = compile("z", grid);
    expect(a.romHex).toBe(b.romHex);
    expect(a.steps).toBe(b.steps);
    expect(renderRows(a)).toEqual(renderRows(a)); // re-execution is stable (no ambient entropy)
  });

  it("HONEST BOUNDS: rejects >3-plane colors and ragged/oversized grids", () => {
    expect(() => parseGrid("8")).toThrow();
    expect(() => parseGrid("77\n7")).toThrow();
    expect(() => parseGrid(Array.from({ length: 33 }, () => "7").join("\n"))).toThrow();
  });
});
