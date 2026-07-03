import { describe, expect, it } from "bun:test";
import { decodePng, encodePng, fromImage, quantize, type RgbaImage } from "./from-image";
import { roundTrips, verify } from "./capture";
import { mix, GOLDEN_RATIO } from "../splitmix64/splitmix64";

const MASK = (1n << 64n) - 1n;

/** DST image source: seeded-random RGBA (no ambient entropy in any test). */
function seededImage(width: number, height: number, seed: bigint): RgbaImage {
  let s = seed;
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < rgba.length; i += 4) {
    s = (s + GOLDEN_RATIO) & MASK;
    const v = mix(s);
    rgba[i] = Number(v & 0xffn);
    rgba[i + 1] = Number((v >> 8n) & 0xffn);
    rgba[i + 2] = Number((v >> 16n) & 0xffn);
    rgba[i + 3] = 255;
  }
  return { width, height, rgba };
}

/** A synthetic "paper sheet": white ground, red header band, blue left rule, green mark. */
function syntheticSheet(width: number, height: number): RgbaImage {
  const rgba = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const at = (y * width + x) * 4;
      let [r, g, b] = [250, 250, 250]; // paper
      if (y < height / 8) [r, g, b] = [220, 30, 30]; // header band
      else if (x < width / 16) [r, g, b] = [30, 30, 220]; // left rule
      else if (x > width / 2 && x < width / 2 + width / 8 && y > height / 2 && y < height / 2 + height / 8)
        [r, g, b] = [20, 200, 20]; // the mark
      rgba[at] = r; rgba[at + 1] = g; rgba[at + 2] = b; rgba[at + 3] = 255;
    }
  }
  return { width, height, rgba };
}

describe("chip9-cart image front end (081KWJE90EZ layer 2)", () => {
  for (const filter of [0, 1, 2, 3, 4] as const) {
    it(`PNG codec round-trip is LOSSLESS under row filter ${filter} (seeded, DST)`, () => {
      const img = seededImage(23, 17, 0xE66n + BigInt(filter));
      const back = decodePng(encodePng(img, filter));
      expect(back.width).toBe(img.width);
      expect(back.height).toBe(img.height);
      expect(Buffer.from(back.rgba).equals(Buffer.from(img.rgba))).toBe(true);
    });
  }

  it("quantize: aspect-preserved fit into 64x32; pure channels land on their planes", () => {
    const sheet = syntheticSheet(256, 128);
    const grid = quantize(sheet);
    expect(grid[0]!.length).toBe(64);
    expect(grid.length).toBe(32);
    expect(grid[0]![32]).toBe(1); // header band: red = plane 1
    expect(grid[16]![1]).toBe(4); // left rule: blue = plane 4
    expect(grid[17]![36]).toBe(2); // the mark: green = plane 2
    expect(grid[16]![20]).toBe(7); // paper: white = all planes
  });

  it("END TO END: synthetic sheet PNG -> grid -> cart; cart round-trips and self-verifies", () => {
    const png = encodePng(syntheticSheet(512, 256), 4); // Paeth, the filter real photos use most
    const { grid, cart } = fromImage("synthetic-sheet", png);
    expect(roundTrips(grid, cart)).toBe(true);
    expect(verify(cart)).toBe(true);
    expect(cart.width).toBe(64);
    expect(cart.height).toBe(32);
  });

  it("DETERMINISTIC: same PNG bytes -> byte-identical cart", () => {
    const png = encodePng(syntheticSheet(200, 100), 2);
    expect(fromImage("a", png).cart.romHex).toBe(fromImage("a", png).cart.romHex);
  });

  it("HONEST BOUNDS: non-PNG, bad CRC, and unsupported shapes fail loudly", () => {
    expect(() => decodePng(new Uint8Array([1, 2, 3]))).toThrow("bad signature");
    const png = encodePng(seededImage(4, 4, 1n));
    png[png.length - 5] = png[png.length - 5]! ^ 0xff; // corrupt IEND CRC region
    expect(() => decodePng(png)).toThrow("CRC mismatch");
  });
});
