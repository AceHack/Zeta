// dual-score.test.ts -- falsifiers for the dual-score belief primitive.
//
// Every `it` here was checked by REVERTING the code it covers and watching it go red. The
// mutants used are named in `MUTANTS` below and recorded in the PR body, because a test that
// passes with the code removed is not a falsifier and counting it as one is the vacuity class
// (`.claude/rules/toy-is-free-metered-must-be-earned.md`).
//
// The FIRST describe block is the CONTROL, and it exists because a constructor that refuses
// EVERYTHING passes every single "it refuses X" test below. Without the control, `dualScore`
// could be `() => ({ ok: false, ... })` and this file would be all green.

import { describe, expect, it } from "bun:test";
import * as DualScoreModule from "./dual-score";
import {
  UNIT_MAX,
  UNIT_MIN,
  VACUOUS,
  contradiction,
  dualScore,
  equals,
  ignorance,
  mass,
  massShape,
  parseDualScore,
  swapLegs,
  toyClassify,
  toyJoin,
  type DualScore,
} from "./dual-score";

/** The mutants this file was verified against. Each name appears in the PR body's table. */
export const MUTANTS = [
  "constructor-refuses-everything",
  "constructor-clamps-instead-of-refusing",
  "falseChance-derived-as-1-minus-trueChance",
  "ignorance-and-contradiction-collapsed-to-one-signed-gap",
  "toyJoin-uses-min-instead-of-max",
  "toyClassify-ships-a-default-margin",
  "parseDualScore-defaults-a-missing-leg-to-zero",
  "combination-rule-added-under-a-plain-name",
] as const;

const ok = (t: number, f: number): DualScore => {
  const r = dualScore(t, f);
  if (!r.ok) throw new Error(`fixture is not constructible: ${r.refusal.detail}`);
  return r.score;
};

// ============================================================================================
// CONTROL -- without this, a constructor that refuses everything passes the whole file.
// ============================================================================================

describe("CONTROL: the constructor ACCEPTS legal values", () => {
  it("accepts an ordinary interior pair", () => {
    const r = dualScore(0.3, 0.4);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.score).toEqual({ trueChance: 0.3, falseChance: 0.4 });
  });

  it("accepts both closed ends of the unit interval on both legs", () => {
    for (const t of [UNIT_MIN, UNIT_MAX]) {
      for (const f of [UNIT_MIN, UNIT_MAX]) {
        expect(dualScore(t, f).ok).toBe(true);
      }
    }
  });

  it("accepts a SUM above 1 -- the legs float independently, so contradiction is legal", () => {
    // This is the control's sharpest case. A constructor that "validates a probability" by
    // refusing tc + fc > 1 would pass every refusal test in this file and destroy the entire
    // point of the type.
    const r = dualScore(0.9, 0.9);
    expect(r.ok).toBe(true);
    if (r.ok) expect(contradiction(r.score)).toBeCloseTo(0.8, 10);
  });

  it("accepts a SUM below 1 -- ignorance is legal, not an incomplete input", () => {
    expect(dualScore(0.1, 0.2).ok).toBe(true);
  });
});

// ============================================================================================
// REFUSALS -- mutant: constructor-clamps-instead-of-refusing
// ============================================================================================

describe("the constructor REFUSES rather than clamping", () => {
  it("refuses a trueChance above 1 instead of clamping it to 1", () => {
    const r = dualScore(1.4, 0);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.refusal.reason).toBe("outside-unit-interval");
      expect(r.refusal.leg).toBe("trueChance");
    }
  });

  it("refuses a negative falseChance instead of clamping it to 0", () => {
    const r = dualScore(0, -0.001);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal.leg).toBe("falseChance");
  });

  it("refuses NaN and both infinities on either leg", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(dualScore(bad, 0).ok).toBe(false);
      expect(dualScore(0, bad).ok).toBe(false);
    }
    const r = dualScore(Number.NaN, 0);
    if (!r.ok) expect(r.refusal.reason).toBe("not-finite");
  });

  it("names the offending leg, so a caller learns which one is wrong", () => {
    const r = dualScore(2, 2);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal.leg).toBe("trueChance");
    const r2 = dualScore(0.5, 2);
    if (!r2.ok) expect(r2.refusal.leg).toBe("falseChance");
  });
});

// ============================================================================================
// INDEPENDENCE -- mutant: falseChance-derived-as-1-minus-trueChance
// ============================================================================================

describe("the two legs are INDEPENDENT -- no 1 - p anywhere", () => {
  it("stores what it was given; falseChance is never 1 - trueChance", () => {
    const s = ok(0.7, 0.7);
    expect(s.trueChance).toBe(0.7);
    expect(s.falseChance).toBe(0.7);
    // If falseChance were derived it would be 0.3 here, and the sum would be pinned at 1.
    expect(mass(s)).toBeCloseTo(1.4, 10);
  });

  it("four scores with the SAME trueChance have four different falseChances", () => {
    const fs = [0, 0.25, 0.5, 1].map((f) => ok(0.5, f).falseChance);
    expect(new Set(fs).size).toBe(4);
  });

  it("VACUOUS is {0,0} -- no evidence -- and is NOT the balanced {0.5, 0.5}", () => {
    expect(VACUOUS).toEqual({ trueChance: 0, falseChance: 0 });
    expect(equals(VACUOUS, ok(0.5, 0.5))).toBe(false);
    // The state a single probability cannot express: both are "p = 0.5" under one number,
    // and they are opposite epistemic states.
    expect(ignorance(VACUOUS)).toBe(1);
    expect(ignorance(ok(0.5, 0.5))).toBe(0);
  });
});

// ============================================================================================
// THE GAP -- mutant: ignorance-and-contradiction-collapsed-to-one-signed-gap
// ============================================================================================

describe("the gap is first-class in BOTH directions", () => {
  it("sum below 1 is ignorance and zero contradiction", () => {
    const s = ok(0.2, 0.3);
    expect(ignorance(s)).toBeCloseTo(0.5, 10);
    expect(contradiction(s)).toBe(0);
    expect(massShape(s)).toBe("ignorant");
  });

  it("sum above 1 is contradiction and zero ignorance", () => {
    const s = ok(0.8, 0.7);
    expect(contradiction(s)).toBeCloseTo(0.5, 10);
    expect(ignorance(s)).toBe(0);
    expect(massShape(s)).toBe("contradictory");
  });

  it("sum exactly 1 is coherent, with neither ignorance nor contradiction", () => {
    const s = ok(0.25, 0.75);
    expect(massShape(s)).toBe("coherent");
    expect(ignorance(s)).toBe(0);
    expect(contradiction(s)).toBe(0);
  });

  it("NEITHER quantity is ever negative -- they are two one-sided readings, not one signed one", () => {
    for (const [t, f] of [
      [0, 0],
      [1, 1],
      [0.1, 0.2],
      [0.9, 0.9],
      [0.5, 0.5],
    ] as const) {
      const s = ok(t, f);
      expect(ignorance(s)).toBeGreaterThanOrEqual(0);
      expect(contradiction(s)).toBeGreaterThanOrEqual(0);
      // At most one of them is non-zero: they cannot both describe the same score.
      expect(ignorance(s) === 0 || contradiction(s) === 0).toBe(true);
    }
  });

  it("the extremes are reachable: {0,0} is ignorance 1, {1,1} is contradiction 1", () => {
    expect(ignorance(ok(0, 0))).toBe(1);
    expect(contradiction(ok(1, 1))).toBe(1);
  });
});

// ============================================================================================
// SCOPE -- mutant: combination-rule-added-under-a-plain-name
//
// The algebra is under math-team review (Dempster-Shafer / Josang / Belnap / Walley /
// quasi-probability), and Dempster's rule is known-pathological under high conflict (Zadeh).
// So the module must ship NO plainly-named combination rule. This block is the guard: it
// reads the module's own export list, so adding `combine` tomorrow fails here rather than
// being noticed in review a month later.
// ============================================================================================

describe("no combination rule ships under a plain name", () => {
  const FORBIDDEN = ["merge", "combine", "and", "or", "fuse", "normalise", "normalize", "consensus", "join"];

  it("exports none of merge/combine/and/or/fuse/normalise/consensus/join", () => {
    const names = Object.keys(DualScoreModule);
    // Control for this test: the module really does export things, so an empty module would
    // not pass vacuously.
    expect(names.length).toBeGreaterThan(5);
    for (const forbidden of FORBIDDEN) {
      expect(names).not.toContain(forbidden);
    }
  });

  it("the one combining operation is prefixed `toy`, so it is greppable when the ruling lands", () => {
    expect(Object.keys(DualScoreModule)).toContain("toyJoin");
    expect(typeof toyJoin).toBe("function");
  });
});

// ============================================================================================
// toyJoin -- mutant: toyJoin-uses-min-instead-of-max
// ============================================================================================

describe("toyJoin is componentwise max -- a display aid, explicitly not a fusion rule", () => {
  const a = ok(0.6, 0.1);
  const b = ok(0.2, 0.4);
  const c = ok(0.3, 0.9);

  it("takes the max on each leg independently", () => {
    expect(toyJoin(a, b)).toEqual({ trueChance: 0.6, falseChance: 0.4 });
  });

  it("is idempotent, commutative and associative -- safe under replay and reorder", () => {
    expect(equals(toyJoin(a, a), a)).toBe(true);
    expect(equals(toyJoin(a, b), toyJoin(b, a))).toBe(true);
    expect(equals(toyJoin(toyJoin(a, b), c), toyJoin(a, toyJoin(b, c)))).toBe(true);
  });

  it("VACUOUS is the identity", () => {
    expect(equals(toyJoin(a, VACUOUS), a)).toBe(true);
    expect(equals(toyJoin(VACUOUS, a), a)).toBe(true);
  });

  it("SURFACES conflict when two witnesses each saw one side", () => {
    const joined = toyJoin(ok(1, 0), ok(0, 1));
    expect(joined).toEqual({ trueChance: 1, falseChance: 1 });
    expect(contradiction(joined)).toBe(1);
    // A min-join would report {0,0} here: two witnesses who each saw decisive evidence would
    // reconcile to "nobody has looked", which is the collapse this design refuses. A
    // Dempster-style rule would instead renormalise the conflict away, which is Zadeh's
    // counterexample -- and is why the real rule is not being guessed at here.
  });

  it("does NOT accumulate independent evidence -- proof it is not a fusion rule", () => {
    // Two weak, independent witnesses against the same claim. Any genuine evidence-combination
    // rule strengthens the result; max leaves it exactly where the stronger witness was. This
    // test asserts the LIMITATION, so the placeholder cannot be quietly promoted.
    const weak1 = ok(0, 0.3);
    const weak2 = ok(0, 0.3);
    expect(toyJoin(weak1, weak2).falseChance).toBe(0.3);
  });

  it("never decreases either leg -- grow-only", () => {
    for (const x of [a, b, c, VACUOUS]) {
      for (const y of [a, b, c, VACUOUS]) {
        const m = toyJoin(x, y);
        expect(m.trueChance).toBeGreaterThanOrEqual(x.trueChance);
        expect(m.falseChance).toBeGreaterThanOrEqual(x.falseChance);
      }
    }
  });
});

describe("swapLegs is an involution and is NOT 1 - p", () => {
  it("swaps the two legs", () => {
    expect(swapLegs(ok(0.2, 0.7))).toEqual({ trueChance: 0.7, falseChance: 0.2 });
  });

  it("applied twice, returns the original", () => {
    const s = ok(0.2, 0.7);
    expect(equals(swapLegs(swapLegs(s)), s)).toBe(true);
  });

  it("leaves mass, ignorance and contradiction invariant -- the legs really are symmetric", () => {
    const s = ok(0.8, 0.9);
    expect(mass(swapLegs(s))).toBeCloseTo(mass(s), 10);
    expect(contradiction(swapLegs(s))).toBeCloseTo(contradiction(s), 10);
    expect(ignorance(swapLegs(ok(0.1, 0.2)))).toBeCloseTo(0.7, 10);
  });

  it("is not complementation: swapping {0.2, 0.7} does not give {0.8, 0.3}", () => {
    expect(swapLegs(ok(0.2, 0.7))).not.toEqual({ trueChance: 0.8, falseChance: 0.3 });
  });
});

// ============================================================================================
// REGISTER -- mutant: toyClassify-ships-a-default-margin
// ============================================================================================

describe("toyClassify is the ONLY judging function and ships no default margin", () => {
  it("requires a margin: its arity is 2, so a caller cannot inherit an uncalibrated default", () => {
    // A default parameter would make this 1. The register rule
    // (.claude/rules/toy-is-free-metered-must-be-earned.md) is what this asserts: no
    // calibration study backs any threshold for this primitive, so none is shipped.
    expect(toyClassify.length).toBe(2);
  });

  it("reads contradiction FIRST, whatever the margin", () => {
    for (const margin of [0.1, 0.5, 0.99]) {
      const r = toyClassify(ok(0.9, 0.9), margin);
      if (r.ok) expect(r.reading).toBe("contradicted");
    }
  });

  it("leans true / leans false / unknown at a supplied margin", () => {
    const at = (s: DualScore, m: number): string => {
      const r = toyClassify(s, m);
      return r.ok ? r.reading : `refused:${r.refusal.reason}`;
    };
    expect(at(ok(0.8, 0.1), 0.5)).toBe("leans-true");
    expect(at(ok(0.1, 0.8), 0.5)).toBe("leans-false");
    expect(at(ok(0.1, 0.1), 0.5)).toBe("unknown");
  });

  it("the SAME score reads differently at different margins -- the judgement is the caller's", () => {
    const s = ok(0.4, 0.05);
    const loose = toyClassify(s, 0.3);
    const strict = toyClassify(s, 0.6);
    if (loose.ok && strict.ok) {
      expect(loose.reading).toBe("leans-true");
      expect(strict.reading).toBe("unknown");
    }
  });

  it("refuses a margin outside the unit interval", () => {
    expect(toyClassify(VACUOUS, 1.2).ok).toBe(false);
    const r = toyClassify(VACUOUS, Number.NaN);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal.detail).toContain("margin");
  });
});

// ============================================================================================
// PARSING -- mutant: parseDualScore-defaults-a-missing-leg-to-zero
// ============================================================================================

describe("parseDualScore refuses absence rather than defaulting it", () => {
  it("accepts a well-formed object (control for this block)", () => {
    const r = parseDualScore({ trueChance: 0.1, falseChance: 0.9 });
    expect(r.ok).toBe(true);
  });

  it("refuses a MISSING leg -- 0 is a measurement and absence is not", () => {
    const r = parseDualScore({ trueChance: 0.1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal.reason).toBe("not-a-dual-score");
  });

  it("refuses a string leg, null, an array, and a bare number", () => {
    for (const bad of [{ trueChance: "0.1", falseChance: 0.9 }, null, [0.1, 0.9], 0.5, "x"]) {
      expect(parseDualScore(bad).ok).toBe(false);
    }
  });

  it("refuses an out-of-range leg through the same constructor", () => {
    const r = parseDualScore({ trueChance: 3, falseChance: 0 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal.reason).toBe("outside-unit-interval");
  });
});
