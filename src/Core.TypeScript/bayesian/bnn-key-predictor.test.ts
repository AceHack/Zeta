import { describe, expect, test } from "bun:test";
import { BnnSocietyPredictor, EXPLORE_TICKS } from "./bnn-key-predictor";

const W = 64;
const H = 32;

function blank(): number[] {
  return new Array(W * H).fill(0);
}

function paintRect(d: number[], x: number, y: number, w: number, h: number, color: number): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      if (xx >= 0 && xx < W && yy >= 0 && yy < H) d[yy * W + xx] = color;
    }
  }
}

function paintHollow(d: number[], x: number, y: number, size: number, color: number): void {
  paintRect(d, x, y, size, size, color);
  paintRect(d, x + 1, y + 1, size - 2, size - 2, 0);
}

/** Skip the exploration phase: restore a snapshot claiming it already ran. */
function warmed(p: BnnSocietyPredictor): BnnSocietyPredictor {
  p.importSnapshot({ ...p.exportSnapshot(), exploreTicksDone: EXPLORE_TICKS });
  return p;
}

describe("determinism — the seed is the whole story", () => {
  test("two predictors with the same seed emit byte-identical distributions", () => {
    const a = new BnnSocietyPredictor(3, 4);
    const b = new BnnSocietyPredictor(3, 4);
    for (let i = 0; i < 20; i++) {
      const d = blank();
      paintRect(d, 10 + i, 10, 2, 2, 2);
      paintRect(d, 40, 12, 2, 2, 1);
      const pa = a.predict([...d]);
      const pb = b.predict([...d]);
      expect(pa).toEqual(pb);
    }
  });

  test("different seeds diverge (the noise is real, just owned)", () => {
    const a = new BnnSocietyPredictor(3, 4);
    const b = new BnnSocietyPredictor(3, 5);
    const d = blank();
    paintRect(d, 10, 10, 2, 2, 2);
    const pa = a.predict([...d]);
    const pb = b.predict([...d]);
    expect(pa).not.toEqual(pb);
  });

  test("a NaN-free, normalized distribution on an empty display", () => {
    const p = new BnnSocietyPredictor(3, 4);
    for (let i = 0; i < 5; i++) {
      const probs = p.predict(blank());
      let sum = 0;
      for (let k = -1; k <= 0xf; k++) {
        const v = probs[k]!;
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        sum += v;
      }
      expect(sum).toBeCloseTo(1, 5);
    }
  });
});

describe("the wall regression — furniture is not an adversary", () => {
  test("adversary is the MOVING color-1 object, not the bigger static walls", () => {
    // The mutual-sim scene shape: two 4×4 static walls (color 1, 32 px total),
    // a small moving adversary (color 1), the player (color 2). The retired
    // centroid heuristic averaged the walls into the "target"; the perception
    // ladder must not.
    const p = warmed(new BnnSocietyPredictor(3, 4));
    let advX = 44;
    let lastAdvTrackX = 0;
    for (let i = 0; i < 30; i++) {
      const d = blank();
      paintRect(d, 32, 10, 4, 4, 1); // wall 1 (static)
      paintRect(d, 32, 20, 4, 4, 1); // wall 2 (static)
      paintRect(d, advX, 15, 2, 2, 1); // the real adversary, drifting left
      paintRect(d, 10, 15, 2, 2, 2); // self
      if (i % 2 === 0) advX -= 1;
      p.predict([...d]);
      const adv = p.lastPerception.tracks.find((t) => t.id === p.lastAdversaryId);
      if (adv) lastAdvTrackX = adv.cx;
    }
    expect(p.lastAdversaryId).not.toBeNull();
    // The adversary track sits near the drifting blob (~30), not at the wall
    // column (32..36 with centroid pinned at 33.5) — and crucially its area is
    // the sprite's 4, not the walls' 16.
    const adv = p.lastPerception.tracks.find((t) => t.id === p.lastAdversaryId)!;
    expect(adv.area).toBe(4);
    expect(adv.everMoved).toBe(true);
    expect(lastAdvTrackX).toBeLessThan(40);
    // And the walls latched static.
    const walls = p.lastPerception.tracks.filter((t) => t.area === 16);
    expect(walls.length).toBe(2);
    for (const wallTrack of walls) expect(wallTrack.isStatic).toBe(true);
  });

  test("hunt mode steers toward a small prey, flee steers away from a big hunter", () => {
    // The prey TRAVELS (net displacement is what earns everMoved — a sprite
    // jittering in place is indistinguishable from brushed furniture and is
    // deliberately not an adversary candidate any more).
    // Prey to the RIGHT: expect P(right) > P(left) once hunting.
    const hunt = warmed(new BnnSocietyPredictor(3, 4));
    let preyX = 50;
    for (let i = 0; i < 40; i++) {
      const d = blank();
      paintRect(d, 12, 14, 2, 2, 2); // self
      paintRect(d, preyX, 14, 2, 2, 1); // small prey drifting, stays right
      if (i % 2 === 0 && preyX > 40) preyX -= 1;
      hunt.predict([...d]);
    }
    expect(hunt.lastMode).toBe("hunt");
    const hp = hunt.predict((() => {
      const d = blank();
      paintRect(d, 12, 14, 2, 2, 2);
      paintRect(d, preyX, 14, 2, 2, 1);
      return d;
    })());
    expect(hp[6]!).toBeGreaterThan(hp[4]!); // right beats left

    // Big hollow hunter closing in from the RIGHT: expect flee, P(left) wins.
    const flee = warmed(new BnnSocietyPredictor(3, 4));
    let hunterX = 50;
    for (let i = 0; i < 40; i++) {
      const d = blank();
      paintRect(d, 30, 14, 2, 2, 2); // self (mid-screen so left is open)
      paintHollow(d, hunterX, 13, 4, 1); // hunter closing from the right
      if (i % 2 === 0 && hunterX > 40) hunterX -= 1;
      flee.predict([...d]);
    }
    expect(flee.lastMode).toBe("flee");
    const fp = flee.predict((() => {
      const d = blank();
      paintRect(d, 30, 14, 2, 2, 2);
      paintHollow(d, hunterX, 13, 4, 1);
      return d;
    })());
    expect(fp[4]!).toBeGreaterThan(fp[6]!); // left beats right
  });
});

describe("priors in source — snapshot round-trip", () => {
  test("export → import reproduces the beliefs exactly", () => {
    const a = new BnnSocietyPredictor(3, 4);
    for (let i = 0; i < 15; i++) {
      const d = blank();
      paintRect(d, 10 + i, 10, 2, 2, 2);
      paintRect(d, 50 - i, 12, 2, 2, 1);
      a.predict([...d]);
    }
    const snap = a.exportSnapshot();
    const b = new BnnSocietyPredictor(3, 4);
    b.importSnapshot(snap);
    expect(b.exportSnapshot()).toEqual(snap);
  });

  test("a restored predictor skips the exploration it already performed", () => {
    const fresh = new BnnSocietyPredictor(3, 4);
    fresh.predict(blank());
    expect(fresh.lastMode).toBe("explore");

    const restored = warmed(new BnnSocietyPredictor(3, 4));
    const d = blank();
    paintRect(d, 10, 10, 2, 2, 2);
    restored.predict([...d]);
    expect(restored.lastMode).not.toBe("explore");
  });

  test("importSnapshot refuses a corrupt tail index", () => {
    const p = new BnnSocietyPredictor(3, 4);
    const snap = p.exportSnapshot();
    const corrupt = {
      ...snap,
      agents: [
        {
          beliefs: snap.agents[0]!.beliefs.map((b0) =>
            b0.key === 0 ? { ...b0, nu: Number.NaN } : b0,
          ),
        },
        ...snap.agents.slice(1),
      ],
    };
    expect(() => p.importSnapshot(corrupt)).toThrow(RangeError);
  });
});

describe("attention wiring (D1–D4 of #14503)", () => {
  test("a churning region frosts less than it clears: variance discriminates and topK finds it", () => {
    const p = warmed(new BnnSocietyPredictor(3, 4));
    for (let i = 0; i < 80; i++) {
      const d = blank();
      paintRect(d, 12, 14, 2, 2, 2); // self, parked
      paintRect(d, 48 + (i % 4), 20, 3, 3, 1); // churn in tile (row2, col6) = 22
      p.predict([...d]);
    }
    const readout = p.attentionField.readout();
    const churnTile = 2 * 8 + 6;
    const quietTile = 1 * 8 + 1;
    const churnVar = readout.variance[churnTile] ?? 0;
    const quietVar = readout.variance[quietTile] ?? Infinity;
    expect(churnVar).toBeGreaterThan(quietVar);
    expect(p.attentionField.topK(4)).toContain(churnTile);
    // The attended set carries top-K + the sweep tile at minimum.
    expect(p.lastAttendedTiles.length).toBeGreaterThan(0);
    // The meter is numeric (the field is not flat) and the fixation latched.
    expect(p.lastUsefulWork).not.toBe("ambiguous");
    expect(p.lastFixationTile).not.toBeNull();
  });

  test("societyRho reports a full pairwise panel with sane bounds", () => {
    const p = warmed(new BnnSocietyPredictor(3, 4));
    for (let i = 0; i < 30; i++) {
      const d = blank();
      paintRect(d, 10 + (i % 6), 10, 2, 2, 2);
      p.predict([...d]);
    }
    const rho = p.societyRho();
    expect(rho.pairs).toBe(3); // 3 agents → 3 pairs
    expect(rho.mean).toBeGreaterThanOrEqual(-1);
    expect(rho.max).toBeLessThanOrEqual(1);
    expect(rho.max).toBeGreaterThanOrEqual(rho.mean);
  });

  test("v3 snapshots round-trip the attention field; v2 snapshots still import", () => {
    const a = warmed(new BnnSocietyPredictor(3, 4));
    for (let i = 0; i < 40; i++) {
      const d = blank();
      paintRect(d, (i * 2) % 56, 8, 3, 3, 1);
      a.predict([...d]);
    }
    const snap = a.exportSnapshot();
    expect(snap.version).toBe(3);
    expect(snap.attention).toBeDefined();
    const b = new BnnSocietyPredictor(3, 4);
    b.importSnapshot(snap);
    expect(b.attentionField.exportSnapshot()).toEqual(a.attentionField.exportSnapshot());
    // A v2 snapshot (no attention) imports without error — fresh field prior.
    const v2Record: Record<string, unknown> = { ...snap, version: 2 };
    delete v2Record["attention"];
    const c = new BnnSocietyPredictor(3, 4);
    c.importSnapshot(v2Record as unknown as Parameters<typeof c.importSnapshot>[0]);
    expect(c.exportSnapshot().agents).toEqual(snap.agents);
  });
});
