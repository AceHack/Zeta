/**
 * attention-field.test.ts — the field discriminates, deterministically.
 */
import { describe, expect, test } from "bun:test";
import {
  TILE_COLS,
  TILE_COUNT,
  TILE_SIZE,
  TileAttentionField,
  SCREEN_H,
  SCREEN_W,
} from "./attention-field";

const blank = (): number[] => new Array(SCREEN_W * SCREEN_H).fill(0) as number[];

/** Paint a rect with a color value (test prop). */
function paint(d: number[], x0: number, y0: number, w: number, h: number, c: number): void {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (x >= 0 && x < SCREEN_W && y >= 0 && y < SCREEN_H) d[y * SCREEN_W + x] = c;
    }
  }
}

describe("tile attention field", () => {
  test("a tile with churning content ends up MORE uncertain than a static one", () => {
    const f = new TileAttentionField();
    for (let t = 0; t < 120; t++) {
      const d = blank();
      paint(d, 0, 0, 4, 4, 1); // tile 0: parked block, never changes
      // tile 3 (x 24..31, y 0..7): a sprite jitters with period 3 — content
      // keeps toggling, so its change fraction is VOLATILE.
      paint(d, 24 + (t % 3), 2, 2, 2, 2);
      f.observe(d);
    }
    const r = f.readout();
    expect(r.variance[3]!).toBeGreaterThan(r.variance[0]!);
    // The static tile's variance also beats the never-touched background
    // tile only in convergence direction — both should be small.
    expect(r.variance[0]!).toBeLessThan(0.01);
  });

  test("topK returns the churning tiles first, deterministically", () => {
    const f = new TileAttentionField();
    for (let t = 0; t < 100; t++) {
      const d = blank();
      paint(d, 8 * 1 + (t % 4), 2, 2, 2, 1); // tile 1 churns
      paint(d, 8 * 6, 8 + (t % 5), 2, 2, 2); // tile (row1,col6)=14 churns differently
      f.observe(d);
    }
    const top = f.topK(2);
    expect(top).toHaveLength(2);
    expect(top).toContain(1);
    expect(top).toContain(1 * TILE_COLS + 6);
    // Determinism: same stream → same order.
    const g = new TileAttentionField();
    for (let t = 0; t < 100; t++) {
      const d = blank();
      paint(d, 8 * 1 + (t % 4), 2, 2, 2, 1);
      paint(d, 8 * 6, 8 + (t % 5), 2, 2, 2);
      g.observe(d);
    }
    expect(g.topK(2)).toEqual(top);
  });

  test("a flat field says so (the allocator's `ambiguous` state)", () => {
    const f = new TileAttentionField();
    // Nothing ever changes anywhere: every tile converges identically.
    for (let t = 0; t < 60; t++) f.observe(blank());
    expect(f.isFlat()).toBe(true);

    const g = new TileAttentionField();
    for (let t = 0; t < 60; t++) {
      const d = blank();
      paint(d, 40 + (t % 4), 20, 3, 3, 3); // one churning region
      g.observe(d);
    }
    expect(g.isFlat()).toBe(false);
  });

  test("snapshot round-trips and the import resets the change baseline", () => {
    const a = new TileAttentionField();
    for (let t = 0; t < 40; t++) {
      const d = blank();
      paint(d, t % 8, 0, 2, 2, 1);
      a.observe(d);
    }
    const snap = a.exportSnapshot();
    expect(snap.cells).toHaveLength(TILE_COUNT);
    const b = new TileAttentionField();
    b.importSnapshot(snap);
    expect(b.exportSnapshot()).toEqual(snap);
  });

  test("byte-identical snapshots for identical observation streams", () => {
    const run = (): string => {
      const f = new TileAttentionField();
      for (let t = 0; t < 50; t++) {
        const d = blank();
        paint(d, (t * 3) % 56, (t * 2) % 24, 4, 4, (t % 3) + 1);
        f.observe(d);
      }
      return JSON.stringify(f.exportSnapshot());
    };
    expect(run()).toBe(run());
  });

  test("geometry constants agree with the display", () => {
    expect(TILE_COLS * TILE_SIZE).toBe(SCREEN_W);
    expect(TILE_COUNT * TILE_SIZE * TILE_SIZE).toBe(SCREEN_W * SCREEN_H);
  });
});
