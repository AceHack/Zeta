import { describe, expect, test } from "bun:test";
import { BnnSocietyPredictor, EXPLORE_TICKS, thompsonKeyOf } from "./bnn-key-predictor";
import { WHY_TERMINAL, whyChain, type WhyContext } from "./why-chain";

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

describe("WHY chain payload (D5 of #14503)", () => {
  const fmt = (x: number): string => (Number.isInteger(x) ? String(x) : x.toFixed(2));

  /** Every number the payload holds, formatted exactly as the generator does. */
  function payloadNumbers(ctx: WhyContext): string[] {
    const out: string[] = [];
    if (ctx.huntValue !== null) out.push(fmt(ctx.huntValue));
    if (ctx.fleeValue !== null) out.push(fmt(ctx.fleeValue));
    out.push(fmt(ctx.rewardEvents));
    if (ctx.adversary) out.push(fmt(ctx.adversary.dist));
    out.push(fmt(ctx.explore.done), fmt(ctx.explore.total));
    if (ctx.fixation) out.push(fmt(ctx.fixation.tile), fmt(ctx.fixation.variance));
    return out;
  }

  /** Drive the flee scenario until the latch holds a REAL decision. */
  function fleeDecision(): BnnSocietyPredictor {
    const p = warmed(new BnnSocietyPredictor(3, 4));
    let hunterX = 50;
    for (let i = 0; i < 40; i++) {
      const d = blank();
      paintRect(d, 30, 14, 2, 2, 2); // self
      paintHollow(d, hunterX, 13, 4, 1); // big hunter closing from the right
      if (i % 2 === 0 && hunterX > 40) hunterX -= 1;
      p.predict([...d]);
    }
    return p;
  }

  test("the payload IS the deciding state — same mode, bucket, relation, fixation", () => {
    const p = fleeDecision();
    expect(p.lastMode).toBe("flee");
    const why = p.whyContext();
    expect(why.mode).toBe(p.lastMode);
    expect(why.bucket).toEqual(p.lastModeBucket);
    expect(why.adversary).toEqual(p.lastRelation);
    expect(why.adversary).not.toBeNull();
    expect(p.lastFixationTile).not.toBeNull();
    expect(why.fixation?.tile).toBe(p.lastFixationTile ?? -1);
    expect(why.rewardEvents).toBe(p.modeLearner.rewardEvents);
  });

  test("the payload survives the worker boundary verbatim (structured clone)", () => {
    const why = fleeDecision().whyContext();
    // postMessage structured-clones the frame; the WHY answers on the main
    // thread are generated from the CLONE, so the clone must be the context.
    expect(structuredClone(why)).toEqual(why);
  });

  test("for a real decision the chain terminates at the unknown state, and every non-terminal answer cites a payload value", () => {
    const why = structuredClone(fleeDecision().whyContext());
    const chain = whyChain(why);
    expect(chain[chain.length - 1]).toBe(WHY_TERMINAL);
    const numbers = payloadNumbers(why);
    for (const answer of chain.slice(0, -1)) {
      const cites = numbers.some((n) => answer.includes(n));
      // The penultimate rung states where the reasons stop — the boundary
      // itself, not a number; the terminal follows it.
      const isBoundary = answer.includes("where my reasons stop");
      expect(cites || isBoundary).toBe(true);
    }
  });
});

describe("the agent can act at all (the frozen-agent regression)", () => {
  const named: Record<number, string> = { 2: "UP", 8: "DOWN", 4: "LEFT", 6: "RIGHT" };

  test("posterior sampling commits a key without any absolute confidence gate", () => {
    // The live fusion asked `maxProb > 0.4`; the consensus over 17 keys peaks
    // near 0.38, so the gate was crossed ZERO times and the agent froze. A
    // rule with no constant in it cannot have that failure mode: sampling
    // always names a key.
    const flat: Record<number, number> = {};
    for (let k = -1; k <= 0xf; k++) flat[k] = 1 / 17;
    let draws = 0;
    const key = thompsonKeyOf(flat, () => {
      draws += 1;
      return 0;
    });
    expect(key).toBeGreaterThanOrEqual(-1);
    expect(draws).toBe(17); // every key got its own sample
  });

  test("a decisive belief still wins: sampling is not a coin flip", () => {
    const sharp: Record<number, number> = {};
    for (let k = -1; k <= 0xf; k++) sharp[k] = 0.001;
    sharp[6] = 0.9;
    // Zero-noise draw ⇒ pure argmax of the means.
    expect(thompsonKeyOf(sharp, () => 0)).toBe(6);
  });

  test("the key beliefs FORGET, so a stale habit cannot outlive its evidence", () => {
    // Feed one direction hard, then the opposite. Without forgetting the
    // posterior mean is an all-history average and the first direction wins
    // forever — measured live as RIGHT μ=0.391 vs UP μ=0.062, with vertical
    // intent honoured 0 times in 188 asks.
    const p = warmed(new BnnSocietyPredictor(3, 4));
    const paint = (x: number, y: number): number[] => {
      const d = blank();
      paintRect(d, 12, 14, 2, 2, 2); // self
      paintRect(d, x, y, 2, 2, 1); // adversary
      return d;
    };
    // 150 ticks with the adversary far to the RIGHT (horizontal pull).
    for (let i = 0; i < 150; i++) p.predict(paint(50, 14));
    const afterRight = p.predict(paint(50, 14));
    // Now 150 ticks with it directly BELOW (purely vertical pull).
    for (let i = 0; i < 150; i++) p.predict(paint(12, 30));
    const afterDown = p.predict(paint(12, 30));

    const rightPull = (afterRight[6] ?? 0) - (afterRight[8] ?? 0);
    const downPull = (afterDown[8] ?? 0) - (afterDown[6] ?? 0);
    // The distribution must have MOVED with the geometry, not stayed put.
    expect(rightPull).toBeGreaterThan(0);
    expect(downPull).toBeGreaterThan(0);
    expect(named[8]).toBe("DOWN");
  });
});

describe("which body is mine (the wall-as-self regression)", () => {
  const KEY_RIGHT = 6;

  test("a wall drawn before the movers does not become the body", () => {
    // The EXACT live sequence. mutual-sim draws its two walls one frame before
    // the player and the AI exist, and `mutual-sim.priors` bakes
    // exploreTicksDone: 240 into its snapshot — so the retired clock-gated
    // election ("commit once exploration ends") was already satisfied on the
    // first frame that had any track at all, and that frame contains ONLY
    // walls. It committed to wall 1 and set committedSelfColor = 1, after
    // which `elect(committedSelfColor) ?? elect(null)` could never fall
    // through, because a wall is always on screen. Measured on the merged
    // arena: the body was correct on 0 of 2999 ticks, on every one of 6 seeds.
    const p = warmed(new BnnSocietyPredictor(3, 4));
    const wallsOnly = (): number[] => {
      const d = blank();
      paintRect(d, 32, 10, 4, 4, 1);
      paintRect(d, 32, 20, 4, 4, 1);
      return d;
    };
    // Frames 0–1: walls only. This is where the old election was decided.
    p.predict(wallsOnly());
    p.predict(wallsOnly());

    // Then the movers appear and the body answers to the key it is given.
    let bodyX = 8;
    for (let i = 0; i < 60; i++) {
      const d = wallsOnly();
      paintRect(d, bodyX, 15, 2, 2, 2); // the body — moves under RIGHT
      paintRect(d, 50, 25, 2, 2, 3); // the opponent, elsewhere
      p.predict(d, KEY_RIGHT);
      if (bodyX < 26) bodyX += 1;
    }

    const self = p.lastPerception.tracks.find((t) => t.id === p.lastSelfId);
    expect(self).toBeDefined();
    // A wall is a 4×4 block pinned at column 32; the body is a 2×2 that has
    // travelled. Both assertions, because either alone could pass by accident.
    expect(self!.area).toBe(4);
    expect(Math.abs(self!.cx - bodyX)).toBeLessThanOrEqual(3);
    expect(self!.cx).toBeLessThan(30);
  });

  test("the null action is evidence: a pursuer that moves when I command nothing is not me", () => {
    // Agreement alone cannot separate my body from something that CHASES it —
    // when I go right, my pursuer goes right too, and scores just as well.
    // Contingency can: my body moves when I command it AND holds still when I
    // do not. Here the pursuer is deliberately the BETTER match on agreement
    // (the body is blocked every 4th key tick, as a real body against a wall
    // is), so a test that passes on agreement-only evidence cannot exist.
    const p = warmed(new BnnSocietyPredictor(3, 4));
    let bodyX = 6;
    let pursuerX = 40;
    // The pursuer is painted on the UPPER row deliberately: tracks are born in
    // scan order, so it takes the lower id and therefore wins every tie. The
    // retired election welded itself to that first-past-the-post winner and
    // never revisited it, so without a revisable latch this test cannot pass
    // by luck — the body has to actually out-evidence the pursuer and TAKE the
    // identity back.
    const paint = (): number[] => {
      const d = blank();
      paintRect(d, pursuerX, 8, 2, 2, 1); // same colour: no plane prior to lean on
      paintRect(d, bodyX, 24, 2, 2, 1);
      return d;
    };
    for (let i = 0; i < 80; i++) {
      const commanded = i % 2 === 0;
      p.predict(paint(), commanded ? KEY_RIGHT : undefined);
      // The pursuer drifts right EVERY tick — including the ones where I
      // commanded nothing at all. That is the tell, and it is the only one.
      if (pursuerX < 58) pursuerX += 1;
      // The body moves only when commanded, and not even always.
      if (commanded && i % 8 !== 0 && bodyX < 28) bodyX += 1;
    }

    const self = p.lastPerception.tracks.find((t) => t.id === p.lastSelfId);
    expect(self).toBeDefined();
    // The pursuer sits on row 8; the body on row 24. Rows are the identity here.
    expect(self!.cy).toBeGreaterThan(16);
  });
});
