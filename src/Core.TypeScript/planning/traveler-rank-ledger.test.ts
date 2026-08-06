import { describe, test, expect } from "bun:test";
import {
  freshBelief,
  trustBand,
  updateBelief,
  emptyLedger,
  beliefOf,
  recordOutcome,
  trustBandOf,
  obsCountOf,
  isAboveThreshold,
  isPositiveSkill,
  MU_0,
  SIGMA_0,
} from "./traveler-rank-ledger";

// ── TRL-TS-1: freshBelief structure ───────────────────────────────────────────────────────────────
describe("TRL-TS-1 freshBelief", () => {
  test("has mu=0, sigma2=1, obsCount=0", () => {
    expect(freshBelief.mu).toBe(MU_0);
    expect(freshBelief.sigma2).toBe(SIGMA_0 * SIGMA_0);
    expect(freshBelief.obsCount).toBe(0);
  });
});

// ── TRL-TS-2: honest prior floor ──────────────────────────────────────────────────────────────────
describe("TRL-TS-2 trustBand of freshBelief", () => {
  test("is 0.5 (honest prior, not 0.0 clamp)", () => {
    expect(trustBand(freshBelief)).toBeCloseTo(0.5, 4);
  });
});

// ── TRL-TS-3: trustBand increases after a hit ─────────────────────────────────────────────────────
describe("TRL-TS-3 trustBand after hit", () => {
  test("increases after a hit", () => {
    const before = trustBand(freshBelief);
    const after = trustBand(updateBelief(true, freshBelief));
    expect(after).toBeGreaterThan(before);
  });
});

// ── TRL-TS-4: trustBand decreases after a miss ────────────────────────────────────────────────────
describe("TRL-TS-4 trustBand after miss", () => {
  test("decreases after a miss", () => {
    const before = trustBand(freshBelief);
    const after = trustBand(updateBelief(false, freshBelief));
    expect(after).toBeLessThan(before);
  });
});

// ── TRL-TS-5: monotone in hits ────────────────────────────────────────────────────────────────────
describe("TRL-TS-5 monotone in hits", () => {
  test("trustBand is monotone increasing with more hits", () => {
    let b = freshBelief;
    let prev = trustBand(b);
    for (let i = 0; i < 20; i++) {
      b = updateBelief(true, b);
      const curr = trustBand(b);
      expect(curr).toBeGreaterThan(prev);
      prev = curr;
    }
  });
});

// ── TRL-TS-6: monotone in misses ──────────────────────────────────────────────────────────────────
describe("TRL-TS-6 monotone in misses", () => {
  test("trustBand is monotone decreasing with more misses", () => {
    let b = freshBelief;
    let prev = trustBand(b);
    for (let i = 0; i < 20; i++) {
      b = updateBelief(false, b);
      const curr = trustBand(b);
      expect(curr).toBeLessThan(prev);
      prev = curr;
    }
  });
});

// ── TRL-TS-7: 10 hits → trustBand > 0.9 ──────────────────────────────────────────────────────────
describe("TRL-TS-7 10 hits", () => {
  test("gives trustBand above 0.9", () => {
    let b = freshBelief;
    for (let i = 0; i < 10; i++) b = updateBelief(true, b);
    expect(trustBand(b)).toBeGreaterThan(0.9);
  });
});

// ── TRL-TS-8: 10 misses → trustBand < 0.1 ────────────────────────────────────────────────────────
describe("TRL-TS-8 10 misses", () => {
  test("gives trustBand below 0.1", () => {
    let b = freshBelief;
    for (let i = 0; i < 10; i++) b = updateBelief(false, b);
    expect(trustBand(b)).toBeLessThan(0.1);
  });
});

// ── TRL-TS-9: whitewash window closed ─────────────────────────────────────────────────────────────
describe("TRL-TS-9 whitewash window", () => {
  test("1 hit then 2 misses gives trustBand above 0.0 (not clamped)", () => {
    let b = freshBelief;
    b = updateBelief(true, b);
    b = updateBelief(false, b);
    b = updateBelief(false, b);
    expect(trustBand(b)).toBeGreaterThan(0.0);
  });

  test("1 hit then 2 misses gives trustBand below 0.5 (below honest prior)", () => {
    let b = freshBelief;
    b = updateBelief(true, b);
    b = updateBelief(false, b);
    b = updateBelief(false, b);
    expect(trustBand(b)).toBeLessThan(0.5);
  });

  test("1 hit then 2 misses gives trustBand approximately 0.39", () => {
    let b = freshBelief;
    b = updateBelief(true, b);
    b = updateBelief(false, b);
    b = updateBelief(false, b);
    expect(trustBand(b)).toBeGreaterThan(0.2);
    expect(trustBand(b)).toBeLessThan(0.5);
  });
});

// ── TRL-TS-10: domain isolation ───────────────────────────────────────────────────────────────────
describe("TRL-TS-10 domain isolation", () => {
  test("hits in domain A do not affect trustBand in domain B", () => {
    let ledger = emptyLedger;
    ledger = recordOutcome("alice", "finance", true, ledger);
    ledger = recordOutcome("alice", "finance", true, ledger);
    ledger = recordOutcome("alice", "finance", true, ledger);
    expect(trustBandOf("alice", "finance", ledger)).toBeGreaterThan(0.5);
    expect(trustBandOf("alice", "weather", ledger)).toBeCloseTo(0.5, 4);
  });

  test("different travelers are independent in the same domain", () => {
    let ledger = emptyLedger;
    ledger = recordOutcome("alice", "finance", true, ledger);
    ledger = recordOutcome("alice", "finance", true, ledger);
    ledger = recordOutcome("alice", "finance", true, ledger);
    expect(trustBandOf("bob", "finance", ledger)).toBeCloseTo(0.5, 4);
  });
});

// ── TRL-TS-11: ledger operations ──────────────────────────────────────────────────────────────────
describe("TRL-TS-11 ledger operations", () => {
  test("emptyLedger has no entries", () => {
    expect(emptyLedger.size).toBe(0);
  });

  test("beliefOf returns freshBelief for unknown traveler-domain pair", () => {
    const b = beliefOf("unknown", "domain", emptyLedger);
    expect(b).toEqual(freshBelief);
  });

  test("recordOutcome updates the ledger and belief is retrievable", () => {
    const ledger = recordOutcome("t1", "d1", true, emptyLedger);
    const b = beliefOf("t1", "d1", ledger);
    expect(b.obsCount).toBe(1);
    expect(b.mu).toBeGreaterThan(0.0);
  });

  test("obsCountOf counts observations correctly", () => {
    let ledger = emptyLedger;
    ledger = recordOutcome("t1", "d1", true, ledger);
    ledger = recordOutcome("t1", "d1", false, ledger);
    ledger = recordOutcome("t1", "d1", true, ledger);
    expect(obsCountOf("t1", "d1", ledger)).toBe(3);
    expect(obsCountOf("t1", "d2", ledger)).toBe(0);
  });

  test("trustBandOf returns 0.5 for unknown traveler (honest prior)", () => {
    expect(trustBandOf("nobody", "nowhere", emptyLedger)).toBeCloseTo(0.5, 4);
  });
});

// ── TRL-TS-12: anti-whitewash gates ───────────────────────────────────────────────────────────────
describe("TRL-TS-12 anti-whitewash gates", () => {
  test("isAboveThreshold: fresh identity is above 0.0 but not above 0.9", () => {
    expect(isAboveThreshold("t", "d", 0.0, emptyLedger)).toBe(true);
    expect(isAboveThreshold("t", "d", 0.9, emptyLedger)).toBe(false);
  });

  test("isPositiveSkill is false for fresh identity (mu=0)", () => {
    expect(isPositiveSkill("t", "d", emptyLedger)).toBe(false);
  });

  test("isPositiveSkill is true after 5 hits", () => {
    let ledger = emptyLedger;
    for (let i = 0; i < 5; i++) ledger = recordOutcome("t", "d", true, ledger);
    expect(isPositiveSkill("t", "d", ledger)).toBe(true);
  });

  test("10 hits gives isPositiveSkill = true (anti-whitewash gate)", () => {
    let ledger = emptyLedger;
    for (let i = 0; i < 10; i++) ledger = recordOutcome("t", "d", true, ledger);
    expect(isPositiveSkill("t", "d", ledger)).toBe(true);
  });
});

// ── TRL-TS-13: sigma2 decreases ───────────────────────────────────────────────────────────────────
describe("TRL-TS-13 sigma2 decreases", () => {
  test("sigma2 is strictly decreasing with more observations", () => {
    let b = freshBelief;
    let prevSigma2 = b.sigma2;
    for (let i = 0; i < 20; i++) {
      b = updateBelief(i % 2 === 0, b);
      expect(b.sigma2).toBeLessThan(prevSigma2);
      prevSigma2 = b.sigma2;
    }
  });
});

// ── TRL-TS-14: trustBand in [0, 1] ───────────────────────────────────────────────────────────────
describe("TRL-TS-14 trustBand in [0,1]", () => {
  test("trustBand is always in [0, 1]", () => {
    let b = freshBelief;
    for (let i = 0; i < 50; i++) {
      b = updateBelief(i % 3 !== 0, b);
      const band = trustBand(b);
      expect(band).toBeGreaterThanOrEqual(0.0);
      expect(band).toBeLessThanOrEqual(1.0);
    }
  });
});

// ── TRL-TS-15: DST replay ─────────────────────────────────────────────────────────────────────────
describe("TRL-TS-15 DST replay", () => {
  test("same sequence gives same belief (deterministic)", () => {
    const obs = [true, false, true, true, false, true, false, false, true, true];
    const apply = () => obs.reduce((b, hit) => updateBelief(hit, b), freshBelief);
    const first = apply();
    const second = apply();
    expect(first).toEqual(second);
  });
});

// ── TRL-TS-16: F# parity ─────────────────────────────────────────────────────────────────────────
describe("TRL-TS-16 F# parity", () => {
  test("10 hits trustBand matches F# result (0.9165 ± 0.001)", () => {
    let b = freshBelief;
    for (let i = 0; i < 10; i++) b = updateBelief(true, b);
    expect(trustBand(b)).toBeCloseTo(0.9165, 2);
  });

  test("10 misses trustBand matches F# result (0.0835 ± 0.001)", () => {
    let b = freshBelief;
    for (let i = 0; i < 10; i++) b = updateBelief(false, b);
    expect(trustBand(b)).toBeCloseTo(0.0835, 2);
  });

  test("1 hit, 2 misses trustBand matches F# result (0.391 ± 0.005)", () => {
    let b = freshBelief;
    b = updateBelief(true, b);
    b = updateBelief(false, b);
    b = updateBelief(false, b);
    expect(trustBand(b)).toBeCloseTo(0.391, 2);
  });
});
