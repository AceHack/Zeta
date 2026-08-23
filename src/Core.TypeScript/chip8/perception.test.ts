import { describe, expect, test } from "bun:test";
import {
  COAST_GRACE,
  createPerceptionState,
  detectBlobs,
  perceive,
  relationBetween,
  STATIC_AGE,
} from "./perception";

const W = 64;
const H = 32;

function blank(): number[] {
  return new Array(W * H).fill(0);
}

function paintRect(d: number[], x: number, y: number, w: number, h: number, color: number): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      d[yy * W + xx] = color;
    }
  }
}

describe("perception layer 1 — blob detection", () => {
  test("finds one rectangle with exact bbox, centroid and area", () => {
    const d = blank();
    paintRect(d, 10, 5, 4, 3, 1);
    const blobs = detectBlobs(d);
    expect(blobs).toHaveLength(1);
    const b = blobs[0]!;
    expect(b.color).toBe(1);
    expect([b.minX, b.minY, b.maxX, b.maxY]).toEqual([10, 5, 13, 7]);
    expect(b.area).toBe(12);
    expect(b.cx).toBeCloseTo(11.5);
    expect(b.cy).toBeCloseTo(6);
  });

  test("adjacent pixels of DIFFERENT colors are different blobs", () => {
    const d = blank();
    paintRect(d, 10, 10, 2, 2, 1);
    paintRect(d, 12, 10, 2, 2, 2); // touching, different color
    const blobs = detectBlobs(d);
    expect(blobs).toHaveLength(2);
    expect(blobs.map((b) => b.color).sort()).toEqual([1, 2]);
  });

  test("diagonal-only contact does not merge (4-connectivity)", () => {
    const d = blank();
    d[5 * W + 5] = 1;
    d[6 * W + 6] = 1;
    expect(detectBlobs(d)).toHaveLength(2);
  });

  test("a hollow square is one blob (its ring is connected)", () => {
    const d = blank();
    // The mutual-sim hunter shape: 4x4 hollow ring = 12 pixels.
    paintRect(d, 20, 10, 4, 4, 1);
    paintRect(d, 21, 11, 2, 2, 0); // punch the hole
    const blobs = detectBlobs(d);
    expect(blobs).toHaveLength(1);
    expect(blobs[0]!.area).toBe(12);
  });

  test("deterministic order: sorted by color then position", () => {
    const d = blank();
    paintRect(d, 40, 20, 2, 2, 2);
    paintRect(d, 5, 5, 2, 2, 1);
    paintRect(d, 30, 2, 2, 2, 1);
    const blobs = detectBlobs(d);
    expect(blobs.map((b) => [b.color, b.minY])).toEqual([
      [1, 2],
      [1, 5],
      [2, 20],
    ]);
  });
});

describe("perception layer 2 — tracking", () => {
  test("identity is stable and velocity is measured across frames", () => {
    let s = createPerceptionState();
    for (let i = 0; i < 6; i++) {
      const d = blank();
      paintRect(d, 10 + i, 8, 2, 2, 1); // moves 1px right per tick
      s = perceive(s, d);
    }
    expect(s.tracks).toHaveLength(1);
    const t = s.tracks[0]!;
    expect(t.id).toBe(1); // first minted id, never churned
    expect(t.age).toBe(5);
    expect(t.vx).toBeGreaterThan(0.5);
    expect(Math.abs(t.vy)).toBeLessThan(0.01);
    expect(t.everMoved).toBe(true);
    expect(t.isStatic).toBe(false);
  });

  test("a motionless object latches isStatic and never everMoved", () => {
    let s = createPerceptionState();
    for (let i = 0; i < STATIC_AGE + 3; i++) {
      const d = blank();
      paintRect(d, 30, 12, 4, 4, 1); // the wall
      s = perceive(s, d);
    }
    const t = s.tracks[0]!;
    expect(t.isStatic).toBe(true);
    expect(t.everMoved).toBe(false);
  });

  test("one-frame disappearance coasts instead of churning the identity", () => {
    let s = createPerceptionState();
    for (let i = 0; i < 4; i++) {
      const d = blank();
      paintRect(d, 10 + i, 8, 2, 2, 1);
      s = perceive(s, d);
    }
    const idBefore = s.tracks[0]!.id;
    // The XOR-erase flicker frame: object absent.
    s = perceive(s, blank());
    expect(s.tracks).toHaveLength(1);
    expect(s.tracks[0]!.coastTicks).toBe(1);
    // It reappears one pixel further along; same identity.
    const d = blank();
    paintRect(d, 15, 8, 2, 2, 1);
    s = perceive(s, d);
    expect(s.tracks).toHaveLength(1);
    expect(s.tracks[0]!.id).toBe(idBefore);
    expect(s.tracks[0]!.coastTicks).toBe(0);
  });

  test("permanent disappearance kills the track after COAST_GRACE", () => {
    let s = createPerceptionState();
    const d = blank();
    paintRect(d, 10, 8, 2, 2, 1);
    s = perceive(s, d);
    for (let i = 0; i <= COAST_GRACE; i++) s = perceive(s, blank());
    expect(s.tracks).toHaveLength(0);
  });
});

describe("perception layer 3 — relations", () => {
  test("closing speed is positive when objects approach", () => {
    let s = createPerceptionState();
    for (let i = 0; i < 5; i++) {
      const d = blank();
      paintRect(d, 10 + i, 10, 2, 2, 2); // mover heading right…
      paintRect(d, 40, 10, 2, 2, 1); // …toward a stationary block
      s = perceive(s, d);
    }
    const mover = s.tracks.find((t) => t.color === 2)!;
    const target = s.tracks.find((t) => t.color === 1)!;
    const rel = relationBetween(s, mover.id, target.id)!;
    expect(rel).not.toBeNull();
    expect(rel.dx).toBeGreaterThan(0); // target is to the right
    expect(rel.closingSpeed).toBeGreaterThan(0.5);
  });

  test("relation flips sign when queried from the other side", () => {
    let s = createPerceptionState();
    const d = blank();
    paintRect(d, 10, 10, 2, 2, 2);
    paintRect(d, 40, 10, 2, 2, 1);
    s = perceive(s, d);
    const a = s.tracks[0]!.id;
    const b = s.tracks[1]!.id;
    const ab = relationBetween(s, a, b)!;
    const ba = relationBetween(s, b, a)!;
    expect(ab.dx).toBeCloseTo(-ba.dx);
    expect(ab.dist).toBeCloseTo(ba.dist);
  });
});
