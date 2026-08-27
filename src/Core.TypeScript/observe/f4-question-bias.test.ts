#!/usr/bin/env bun
/**
 * f4-question-bias.test.ts — the falsifiers.
 *
 * A test that cannot fail is not a test, so each block below states what defect it is
 * meant to catch. Two families deserve calling out because they are the ones that would
 * otherwise let a wrong answer through looking right:
 *
 * 1. **The null axes are checked MECHANICALLY, not asserted.** §"the null axes really
 *    are null" verifies from the prompt strings themselves that the whitespace variant
 *    differs only in whitespace, the synonym variant in exactly one token, and the
 *    clause-order variant not at all as a multiset of words. Without this, "we varied
 *    something that should not matter" is a claim about intent, and a future edit that
 *    quietly made a null axis semantic would silently invalidate the whole gate.
 *
 * 2. **Both halves of G2 are falsified separately.** A gate built from `A && B` passes
 *    its happy-path test whichever half is load-bearing, so a broken half hides behind
 *    the working one — a test can pass because an EARLIER guard fired. §"G2 needs both
 *    halves" fixes each half at its failing value with the other passing.
 */

import { describe, expect, test } from "bun:test";
import { canonAtom, makeRng, permutationTest } from "./f3-hat-choice-decorrelation";
import { cellKey, parseCellKey } from "./f4-question-bias-analyze";
import {
  assertSingleRecord,
  MAX_RAW_CHARS,
  ProtocolViolation,
  resolveOutPath,
  serializeRow,
  writeRow,
  toAnswerRow,
  type AnswerRow,
} from "./f4-question-bias-run";
import {
  ALPHA,
  AXIS_PAIRS,
  atomDistribution,
  bagJsd,
  centroidRank,
  checkAdditivity,
  DOMAINS,
  domainById,
  EQUIVALENCE_DELTA,
  evaluateGates,
  holmAdjust,
  measurePair,
  permutationSummary,
  promptText,
  seedFor,
  wordBag,
  type AxisKind,
  type PairMeasurement,
} from "./f4-question-bias";

const OPTS = { permutations: 400, seed: 12345 };
const PAIR = AXIS_PAIRS[0]!;

function repeat(words: readonly string[], n: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) out.push(words[i % words.length]!);
  return out;
}

function stubMeasurement(over: Partial<PairMeasurement> & { kind: AxisKind }): PairMeasurement {
  return {
    axis: "STUB",
    nLeft: 100,
    nRight: 100,
    jsd: 0.1,
    nullMean: 0.1,
    nullSd: 0.005,
    mde: 0.008,
    excess: 0,
    excessLo: -0.01,
    excessHi: 0.01,
    p: 0.5,
    permutations: 400,
    n1Left: 10,
    n1Right: 10,
    varietyRatio: 1,
    ...over,
  };
}

// ═══ The null axes really are null — checked from the strings, not asserted ═══

describe("the null axes really are null", () => {
  const strip = (s: string): string => s.replace(/\s+/g, "");
  const words = (s: string): string[] =>
    canonAtom(s)
      .split(" ")
      .filter((w) => w.length > 0)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));

  for (const domain of DOMAINS) {
    test(`${domain.id}: WS differs from A in WHITESPACE ONLY`, () => {
      const a = domain.prompts.find((p) => p.id === "A")!;
      const ws = domain.prompts.find((p) => p.id === "WS")!;
      // Catches: someone "improves" the whitespace variant into a semantic one.
      expect(strip(promptText(domain, ws))).toBe(strip(promptText(domain, a)));
      // ...and catches the opposite defect: a WS variant that is not actually different,
      // which would make NULL-WHITESPACE a second calibration pair wearing a null's name.
      expect(promptText(domain, ws)).not.toBe(promptText(domain, a));
    });

    test(`${domain.id}: SYN differs from A in exactly ONE token`, () => {
      const a = canonAtom(domain.prompts.find((p) => p.id === "A")!.text).split(" ");
      const syn = canonAtom(domain.prompts.find((p) => p.id === "SYN")!.text).split(" ");
      expect(syn.length).toBe(a.length);
      let differing = 0;
      for (let i = 0; i < a.length; i++) if (a[i] !== syn[i]) differing++;
      expect(differing).toBe(1);
    });

    test(`${domain.id}: CLA-L and CLA-R are the same words in a different order`, () => {
      const l = domain.prompts.find((p) => p.id === "CLA-L")!.text;
      const r = domain.prompts.find((p) => p.id === "CLA-R")!.text;
      expect(words(r)).toEqual(words(l));
      expect(r).not.toBe(l);
    });

    test(`${domain.id}: CLOSED-REV is CLOSED with the option list reversed`, () => {
      const c = domain.prompts.find((p) => p.id === "CLOSED")!.text;
      const rev = domain.prompts.find((p) => p.id === "CLOSED-REV")!.text;
      const list = (s: string): string[] =>
        s
          .slice(s.indexOf(":") + 1, s.indexOf("."))
          .split(",")
          .map((x) => x.trim());
      expect(list(rev)).toEqual([...list(c)].reverse());
      // The rest of the prompt must be identical, or OPTION-ORDER measures two things.
      expect(rev.slice(rev.indexOf(". ") + 2)).toBe(c.slice(c.indexOf(". ") + 2));
    });

    test(`${domain.id}: A and A2 are byte-identical — the calibration pair is text-free`, () => {
      const a = domain.prompts.find((p) => p.id === "A")!;
      const a2 = domain.prompts.find((p) => p.id === "A2")!;
      expect(promptText(domain, a2)).toBe(promptText(domain, a));
    });
  }
});

describe("domain registry integrity", () => {
  test("every axis pair resolves in every domain", () => {
    for (const d of DOMAINS) {
      const ids = new Set(d.prompts.map((p) => p.id));
      for (const pair of AXIS_PAIRS) {
        expect(ids.has(pair.left)).toBe(true);
        expect(ids.has(pair.right)).toBe(true);
      }
    }
  });

  test("both domains define the same prompt ids — the axis ranking is comparable", () => {
    const ids = DOMAINS.map((d) => d.prompts.map((p) => p.id).sort((a, b) => (a < b ? -1 : 1)));
    for (const set of ids) expect(set).toEqual(ids[0]!);
  });

  test("prompt ids are unique within a domain", () => {
    for (const d of DOMAINS) expect(new Set(d.prompts.map((p) => p.id)).size).toBe(d.prompts.length);
  });

  test("every combo axis names two semantic axes that exist", () => {
    const semantic = new Set(AXIS_PAIRS.filter((p) => p.kind === "semantic").map((p) => p.axis));
    for (const p of AXIS_PAIRS.filter((x) => x.kind === "combo")) {
      expect(p.combineOf).toBeDefined();
      for (const part of p.combineOf!) expect(semantic.has(part)).toBe(true);
    }
  });

  test("domainById refuses an unknown domain rather than returning a default", () => {
    expect(() => domainById("nope")).toThrow();
  });
});

describe("seed blocks are disjoint across prompts", () => {
  // Catches the defect that would put the calibration pair on a different footing from
  // every pair it is meant to calibrate: if a variant shared seeds with the anchor, the
  // instrument's zero would be measured under conditions nothing else is measured under.
  test("no seed is reused by two prompts", () => {
    const seen = new Set<number>();
    for (let p = 0; p < 20; p++) {
      for (let r = 0; r < 200; r++) {
        const s = seedFor(p, r);
        expect(seen.has(s)).toBe(false);
        seen.add(s);
      }
    }
  });

  test("seeds are positive — ollama treats 0 as unseeded", () => {
    expect(seedFor(0, 0)).toBeGreaterThan(0);
  });
});

// ═══ The distribution primitives ═════════════════════════════════════════════

describe("answer distributions", () => {
  test("only the FIRST line of a reply is the answer", () => {
    const d = atomDistribution(["Navigator\nbecause I like maps", "Navigator\nand also this"]);
    expect(d.counts.get("navigator")).toBe(2);
    expect(d.total).toBe(2);
  });

  test("empty replies are dropped from the variety count, not counted as an answer", () => {
    expect(atomDistribution(["", "  ", "scout"]).total).toBe(1);
  });

  test("the word bag drops stopwords", () => {
    const bag = wordBag(["I want to be the navigator"]);
    expect(bag.counts.has("navigator")).toBe(true);
    expect(bag.counts.has("the")).toBe(false);
    expect(bag.counts.has("want")).toBe(false);
  });

  test("JSD is 0 for identical samples and 1 for disjoint ones", () => {
    const a = ["navigator", "archivist", "navigator"];
    expect(bagJsd(a, a)).toBeCloseTo(0, 10);
    expect(bagJsd(["navigator"], ["referee"])).toBeCloseTo(1, 10);
  });

  test("JSD is symmetric", () => {
    const a = repeat(["navigator", "scout", "archivist"], 30);
    const b = repeat(["scout", "referee"], 30);
    expect(bagJsd(a, b)).toBeCloseTo(bagJsd(b, a), 12);
  });
});

// ═══ measurePair ═════════════════════════════════════════════════════════════

describe("measurePair", () => {
  test("identical generators read excess ~0 and a large p", () => {
    const a = repeat(["navigator", "scout", "archivist", "referee"], 120);
    const b = repeat(["scout", "archivist", "referee", "navigator"], 120);
    const m = measurePair(PAIR, a, b, OPTS);
    expect(Math.abs(m.excess)).toBeLessThan(EQUIVALENCE_DELTA);
    expect(m.p).toBeGreaterThan(ALPHA);
    expect(m.varietyRatio).toBeCloseTo(1, 6);
  });

  test("disjoint generators read a large excess and the smallest attainable p", () => {
    const a = repeat(["navigator", "scout"], 120);
    const b = repeat(["referee", "archivist"], 120);
    const m = measurePair(PAIR, a, b, OPTS);
    expect(m.excess).toBeGreaterThan(0.5);
    expect(m.p).toBeLessThan(ALPHA);
  });

  test("p is never exactly 0 — the observed labelling is itself a permutation", () => {
    const m = measurePair(PAIR, repeat(["a1", "b1"], 60), repeat(["c1", "d1"], 60), OPTS);
    expect(m.p).toBeGreaterThan(0);
    expect(m.p).toBeCloseTo(1 / (m.permutations + 1), 8);
  });

  test("a collapse in variety is visible in varietyRatio even when JSD barely moves", () => {
    // Both sides use the SAME two words, so the word-bag JSD is near zero — but the
    // right-hand side is a single answer repeated. A merged score would call this
    // "no effect". Two numbers do not.
    const a = repeat(["deep scout", "scout deep"], 120);
    const b = new Array<string>(120).fill("deep scout");
    const m = measurePair(PAIR, a, b, OPTS);
    expect(m.excess).toBeLessThan(0.05);
    expect(m.varietyRatio).toBeLessThan(0.6);
  });

  test("excess subtracts the finite-sample bias: raw JSD is LARGE where the effect is zero", () => {
    // The load-bearing property of `excess`, and the one a happy-path test misses. Both
    // sides here are iid draws from the SAME 80-word distribution, so the true effect is
    // exactly zero — but with 70 short answers over 80 words the two samples barely
    // overlap by chance, and the RAW JSD is enormous. Reporting raw JSD would call this
    // a large effect; only the permutation null, which sees the same sparsity, cancels
    // it. Without this test, dropping the `- nullMean` term survives the whole suite —
    // it did, on the first mutation run.
    const rng = makeRng(7);
    const vocab = Array.from({ length: 80 }, (_, i) => `word${i}`);
    const left: string[] = [];
    const right: string[] = [];
    for (let i = 0; i < 140; i++) {
      const w = vocab[Math.floor(rng() * vocab.length)]!;
      (i % 2 === 0 ? left : right).push(w);
    }
    const m = measurePair(PAIR, left, right, OPTS);
    expect(m.jsd).toBeGreaterThan(0.25);
    // The assertion is RELATIVE, not against the equivalence delta: at this sparsity a
    // single split is itself one draw from a null with real spread, so demanding
    // |excess| < 0.02 here would be asserting that the estimator has no variance. What
    // must hold is that the subtraction removes most of the raw value.
    expect(Math.abs(m.excess)).toBeLessThan(m.jsd / 3);
    expect(m.p).toBeGreaterThan(ALPHA);
  });

  test("the measurement is deterministic under a fixed seed (DST)", () => {
    const a = repeat(["navigator", "scout", "archivist"], 90);
    const b = repeat(["scout", "referee", "navigator"], 90);
    expect(measurePair(PAIR, a, b, OPTS)).toEqual(measurePair(PAIR, a, b, OPTS));
  });

  test("a different seed moves the null estimate — the permutation null is really random", () => {
    const a = repeat(["navigator", "scout", "archivist"], 90);
    const b = repeat(["scout", "referee", "navigator"], 90);
    const x = measurePair(PAIR, a, b, OPTS);
    const y = measurePair(PAIR, a, b, { ...OPTS, seed: 999 });
    expect(x.nullMean).not.toBe(y.nullMean);
    // ...but the OBSERVED statistic must not move: it is not a function of the seed.
    expect(x.jsd).toBe(y.jsd);
  });

  test("the interval brackets its own point estimate — the defect the calibration pair caught", () => {
    // The percentile bootstrap this replaced returned [0.0123, 0.1498] around a point
    // estimate of 0.0087 on IDENTICAL text. An interval that excludes what it estimates
    // is wrong, not conservative, and no happy-path test noticed. This one does.
    for (const [a, b] of [
      [repeat(["navigator", "scout"], 120), repeat(["scout", "referee"], 120)],
      [repeat(["alpha", "beta", "gamma", "delta"], 120), repeat(["beta", "gamma", "delta", "alpha"], 120)],
      [repeat(["one"], 100), repeat(["one"], 100)],
    ] as [string[], string[]][]) {
      const m = measurePair(PAIR, a, b, OPTS);
      expect(m.excessLo).toBeLessThanOrEqual(m.excess + 1e-9);
      expect(m.excessHi).toBeGreaterThanOrEqual(m.excess - 1e-9);
    }
  });

  test("the interval half-width comes from the null SD, symmetric about the point", () => {
    const a = repeat(["navigator", "scout", "archivist"], 120);
    const b = repeat(["scout", "referee", "navigator"], 120);
    const m = measurePair(PAIR, a, b, OPTS);
    expect(m.excessHi - m.excess).toBeCloseTo(m.excess - m.excessLo, 12);
    expect(m.excessHi - m.excess).toBeCloseTo(1.959963984540054 * m.nullSd, 12);
  });

  test("MDE bounds what a non-significant axis could have moved", () => {
    // A non-significant result must come with the effect size it COULD have missed, or
    // "not significant" silently reads as "not there".
    const a = repeat(["navigator", "scout", "archivist", "referee"], 120);
    const b = repeat(["scout", "archivist", "referee", "navigator"], 120);
    const m = measurePair(PAIR, a, b, OPTS);
    expect(m.p).toBeGreaterThan(ALPHA);
    expect(m.mde).toBeGreaterThan(0);
    expect(m.excess).toBeLessThanOrEqual(m.mde + 1e-9);
  });

  test("the local permutation reproduces F3's p-value on the same seed", () => {
    // The equivalence test needs the null's SPREAD, which F3's permutationTest does not
    // return, so F4 runs its own. This pins the two together: if either shuffle, tail
    // convention or +1 correction ever drifts, this fails.
    const a = repeat(["navigator", "scout", "archivist"], 60);
    const b = repeat(["scout", "referee"], 60);
    const mine = permutationSummary(a, b, bagJsd, 500, 4242);
    const theirs = permutationTest(a, b, bagJsd, 500, 4242, "greater");
    expect(mine.observed).toBe(theirs.observed);
    expect(mine.pValue).toBeCloseTo(theirs.pValue, 12);
    expect(mine.nullMean).toBeCloseTo(theirs.nullMean, 12);
  });
});

// ═══ Holm ════════════════════════════════════════════════════════════════════

describe("holmAdjust", () => {
  test("m=1 is the identity", () => {
    expect(holmAdjust([0.03])).toEqual([0.03]);
  });

  test("known step-down values", () => {
    // p = [0.01, 0.02, 0.04], m=3 -> 3*0.01=0.03, 2*0.02=0.04, 1*0.04=0.04
    const adj = holmAdjust([0.01, 0.02, 0.04]);
    expect(adj[0]!).toBeCloseTo(0.03, 12);
    expect(adj[1]!).toBeCloseTo(0.04, 12);
    expect(adj[2]!).toBeCloseTo(0.04, 12);
  });

  test("adjusted values are monotone in rank — the step-down carry is applied", () => {
    // Without the running max, p=[0.01, 0.011] gives [0.02, 0.011]: the SECOND value
    // would be reported as more significant than the first, which is incoherent.
    const adj = holmAdjust([0.01, 0.011]);
    expect(adj[0]!).toBeLessThanOrEqual(adj[1]!);
  });

  test("results come back in INPUT order, not sorted order", () => {
    const adj = holmAdjust([0.5, 0.001]);
    expect(adj[1]!).toBeLessThan(adj[0]!);
  });

  test("adjusted p is never below the raw p and never above 1", () => {
    const raw = [0.001, 0.2, 0.6, 0.9, 0.95];
    const adj = holmAdjust(raw);
    for (let i = 0; i < raw.length; i++) {
      expect(adj[i]!).toBeGreaterThanOrEqual(raw[i]! - 1e-12);
      expect(adj[i]!).toBeLessThanOrEqual(1);
    }
  });

  test("empty input is empty output, not a crash", () => {
    expect(holmAdjust([])).toEqual([]);
  });
});

// ═══ The gates ═══════════════════════════════════════════════════════════════

describe("gates", () => {
  const goodCalib = stubMeasurement({ kind: "calibration", axis: "CALIB", excess: 0.001, p: 0.6 });
  const goodNull = stubMeasurement({ kind: "null", axis: "NULL-X", excess: 0.002, excessHi: 0.01, p: 0.4 });
  const strongSemantic = stubMeasurement({ kind: "semantic", axis: "SEM-X", excess: 0.4, p: 0.0002 });

  test("a clean cell passes all three gates", () => {
    const g = evaluateGates([goodCalib, goodNull, strongSemantic]);
    expect(g.calibrationPass).toBe(true);
    expect(g.nullAxesPass).toBe(true);
    expect(g.separationPass).toBe(true);
  });

  test("G1 fails when the instrument cannot read zero on identical text", () => {
    const g = evaluateGates([{ ...goodCalib, excess: 0.05 }, goodNull, strongSemantic]);
    expect(g.calibrationPass).toBe(false);
  });

  test("G1 fails when the calibration pair is SIGNIFICANT even at a small excess", () => {
    const g = evaluateGates([{ ...goodCalib, p: 0.001 }, goodNull, strongSemantic]);
    expect(g.calibrationPass).toBe(false);
  });

  test("G1 fails when there is no calibration pair at all", () => {
    // A missing calibration pair must not read as a pass. A gate with nothing to check
    // is the vacuity class: it looks like a check and constrains nothing.
    expect(evaluateGates([goodNull, strongSemantic]).calibrationPass).toBe(false);
  });

  test("G2 fails when there are no null axes at all", () => {
    expect(evaluateGates([goodCalib, strongSemantic]).nullAxesPass).toBe(false);
  });

  test("G3 fails when nothing is significant — a deaf instrument is not a clean one", () => {
    const g = evaluateGates([goodCalib, goodNull, { ...strongSemantic, p: 0.4 }]);
    expect(g.separationPass).toBe(false);
  });

  test("G3 accounts for multiplicity — one marginal axis among many does not pass", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      stubMeasurement({ kind: "semantic", axis: `S${i}`, p: i === 0 ? 0.03 : 0.7 }),
    );
    // Raw 0.03 < 0.05, but Holm-adjusted 12*0.03 = 0.36 is not.
    expect(evaluateGates([goodCalib, goodNull, ...many]).separationPass).toBe(false);
  });
});

describe("G2 needs both halves", () => {
  const goodCalib = stubMeasurement({ kind: "calibration", axis: "CALIB", excess: 0.001, p: 0.6 });
  const strongSemantic = stubMeasurement({ kind: "semantic", axis: "SEM-X", excess: 0.4, p: 0.0002 });

  test("the p-value half alone is not enough: p is fine, the CI is not", () => {
    // This is the case a p-value-only gate would wave through. An underpowered null axis
    // can be non-significant AND have an upper bound well above anything callable "no
    // movement" — "we failed to detect it" is not "it is not there".
    const m = stubMeasurement({ kind: "null", axis: "NULL-X", excess: 0.03, excessHi: 0.09, p: 0.5 });
    expect(evaluateGates([goodCalib, m, strongSemantic]).nullAxesPass).toBe(false);
  });

  test("the equivalence half alone is not enough: the CI is fine, p is not", () => {
    const m = stubMeasurement({ kind: "null", axis: "NULL-X", excess: 0.005, excessHi: 0.008, p: 0.001 });
    expect(evaluateGates([goodCalib, m, strongSemantic]).nullAxesPass).toBe(false);
  });

  test("a non-finite CI bound fails rather than passes", () => {
    // A bootstrap that produced nothing usable must not read as "no movement detected".
    const m = stubMeasurement({ kind: "null", axis: "NULL-X", excess: 0.001, excessHi: Number.NaN, p: 0.6 });
    expect(evaluateGates([goodCalib, m, strongSemantic]).nullAxesPass).toBe(false);
  });

  test("ONE failing null axis fails the gate even when the others pass", () => {
    const ok1 = stubMeasurement({ kind: "null", axis: "N1", excess: 0.001, excessHi: 0.005, p: 0.8 });
    const ok2 = stubMeasurement({ kind: "null", axis: "N2", excess: 0.002, excessHi: 0.006, p: 0.7 });
    const bad = stubMeasurement({ kind: "null", axis: "N3", excess: 0.2, excessHi: 0.3, p: 0.0002 });
    expect(evaluateGates([goodCalib, ok1, ok2, bad, strongSemantic]).nullAxesPass).toBe(false);
  });
});

// ═══ Additivity ══════════════════════════════════════════════════════════════

describe("checkAdditivity", () => {
  const part = (excess: number): PairMeasurement => stubMeasurement({ kind: "semantic", excess });

  test("exactly additive lands in the band", () => {
    const combo = stubMeasurement({ kind: "combo", axis: "C", excess: 0.3 });
    expect(checkAdditivity(combo, [part(0.15), part(0.15)]).verdict).toBe("additive");
  });

  test("saturation reads sub-additive", () => {
    const combo = stubMeasurement({ kind: "combo", axis: "C", excess: 0.35 });
    const a = checkAdditivity(combo, [part(0.3), part(0.3)]);
    expect(a.verdict).toBe("sub-additive");
    expect(a.ratio).toBeCloseTo(0.35 / 0.6, 10);
  });

  test("amplification reads super-additive", () => {
    const combo = stubMeasurement({ kind: "combo", axis: "C", excess: 0.5 });
    expect(checkAdditivity(combo, [part(0.1), part(0.1)]).verdict).toBe("super-additive");
  });

  test("a zero or negative prediction is undefined, not a division by zero", () => {
    const combo = stubMeasurement({ kind: "combo", axis: "C", excess: 0.2 });
    expect(checkAdditivity(combo, [part(0), part(0)]).verdict).toBe("undefined");
    expect(checkAdditivity(combo, [part(-0.1), part(0.05)]).verdict).toBe("undefined");
  });

  test("the band edges are where the pre-registration put them", () => {
    const at = (ratio: number): string =>
      checkAdditivity(stubMeasurement({ kind: "combo", excess: 0.2 * ratio }), [part(0.1), part(0.1)]).verdict;
    expect(at(0.79)).toBe("sub-additive");
    expect(at(0.81)).toBe("additive");
    expect(at(1.19)).toBe("additive");
    expect(at(1.21)).toBe("super-additive");
  });
});

// ═══ The centroid procedure ══════════════════════════════════════════════════

describe("centroidRank", () => {
  test("the formulation between the extremes wins, and the extremes lose", () => {
    // X is half-A, half-B: it is closer to both than either is to the other.
    const samples = new Map<string, readonly string[]>([
      ["A", repeat(["alpha"], 100)],
      ["B", repeat(["beta"], 100)],
      ["X", repeat(["alpha", "beta"], 100)],
    ]);
    const ranked = centroidRank(samples);
    expect(ranked[0]!.promptId).toBe("X");
    expect(ranked[ranked.length - 1]!.meanJsd).toBeGreaterThan(ranked[0]!.meanJsd);
  });

  test("a formulation is never compared against itself", () => {
    // Self-comparison would contribute a free 0 and hand the win to whichever candidate
    // the map happened to list — f(x) = f(x) proves nothing and would bias every rank.
    const samples = new Map<string, readonly string[]>([
      ["A", repeat(["alpha"], 50)],
      ["B", repeat(["beta"], 50)],
    ]);
    const ranked = centroidRank(samples);
    for (const r of ranked) expect(r.meanJsd).toBeCloseTo(1, 10);
  });

  test("maxJsd is the worst case, and is never below the mean", () => {
    const samples = new Map<string, readonly string[]>([
      ["A", repeat(["alpha"], 60)],
      ["B", repeat(["beta"], 60)],
      ["X", repeat(["alpha", "beta"], 60)],
    ]);
    for (const r of centroidRank(samples)) {
      expect(r.maxJsd).toBeGreaterThanOrEqual(r.meanJsd - 1e-12);
      expect(r.maxJsd).toBeLessThanOrEqual(1);
    }
    // A and B are disjoint from each other, so each has a worst case of exactly 1 while
    // X — the centroid — does not. A mean-only report would not show that gap.
    const byId = new Map(centroidRank(samples).map((r) => [r.promptId, r]));
    expect(byId.get("A")!.maxJsd).toBeCloseTo(1, 10);
    expect(byId.get("X")!.maxJsd).toBeLessThan(1);
  });

  test("output is sorted ascending by mean JSD", () => {
    const samples = new Map<string, readonly string[]>([
      ["A", repeat(["alpha"], 60)],
      ["B", repeat(["beta"], 60)],
      ["C", repeat(["alpha", "beta", "gamma"], 60)],
      ["D", repeat(["gamma"], 60)],
    ]);
    const ranked = centroidRank(samples);
    for (let i = 1; i < ranked.length; i++) expect(ranked[i]!.meanJsd).toBeGreaterThanOrEqual(ranked[i - 1]!.meanJsd);
  });

  test("ranking does not depend on insertion order", () => {
    const a: [string, readonly string[]][] = [
      ["A", repeat(["alpha"], 60)],
      ["B", repeat(["beta"], 60)],
      ["X", repeat(["alpha", "beta"], 60)],
    ];
    const r1 = centroidRank(new Map(a)).map((r) => r.promptId);
    const r2 = centroidRank(new Map([...a].reverse())).map((r) => r.promptId);
    expect(r1).toEqual(r2);
  });
});

// ═══ The cell key ════════════════════════════════════════════════════════════

describe("cellKey", () => {
  // The first version joined (domain, model) with a raw NUL — the classic "delimiter
  // that cannot appear in the data" trick. It failed `cross-verify (no-raw-nul-in-source)`
  // on the first CI run, and the rule is right: a source file carrying a NUL stops being
  // text to grep, diff, and every reviewer's editor. The deeper defect is that "cannot
  // appear in the data" was an unchecked assumption about ollama tags and model output,
  // and a collision would have silently MERGED two cells rather than failing.
  test("round-trips", () => {
    expect(parseCellKey(cellKey("role", "qwen2.5:0.5b"))).toEqual(["role", "qwen2.5:0.5b"]);
  });

  test("no delimiter can collide two distinct cells into one key", () => {
    const nasty = ['a"b', "a\\b", "a\u0000b", "a b", "a,b", "a|b", "a:b", "a\tb", "a\nb", "", "a"];
    const keys = new Set<string>();
    for (const d of nasty) {
      for (const m of nasty) {
        const k = cellKey(d, m);
        expect(keys.has(k)).toBe(false);
        keys.add(k);
        expect(parseCellKey(k)).toEqual([d, m]);
      }
    }
    expect(keys.size).toBe(nasty.length * nasty.length);
  });

  test("the key itself contains no NUL, whatever it is given", () => {
    expect(cellKey("a\u0000b", "c\u0000d")).not.toContain("\u0000");
  });
});

// ═══ The write path: what reaches the results file ═══════════════════════════
//
// CodeQL alert #801 (`js/http-to-file-access`, medium) flagged `appendFileSync(...,
// JSON.stringify(row) + "\n")` in `f4-question-bias-run.ts`: model text arrives over
// HTTP from ollama and is written to disk. The flow is real and, for this harness,
// irreducible — persisting generations verbatim is the entire point of the file. What
// was NOT acceptable is that nothing between the socket and the file could fail.
//
// `generate` ends in `(await res.json()) as { response?: string; ... }`, a CAST that
// checks nothing at runtime, and `f4-question-bias-analyze.ts` casts a second time on
// `JSON.parse(line) as Row`. Between those two casts a malformed response could put an
// object into a numeric field and every statistic folded over it would silently change.
//
// Two properties are pinned below, and they are different properties:
//   1. RECORD BOUNDARY — one row is one line, whatever the model emits.
//   2. SHAPE — a response that violates the contract is REJECTED, not recorded.

describe("the JSONL record boundary", () => {
  const row = (raw: string): AnswerRow => ({
    domain: "role",
    model: "qwen2.5:0.5b",
    prompt: "A",
    replicate: 0,
    seed: 1,
    temperature: 0.8,
    raw,
    ms: 1,
    promptTokens: 2,
    evalTokens: 3,
  });

  // The hazards a JSONL writer must survive. Each one, written raw, would end the
  // record early or turn the file binary. `JSON.stringify` escapes all of them — this
  // test is what says so out loud, and it fails the moment the serializer stops.
  const hazards: readonly (readonly [string, string])[] = [
    ["newline", "yes\nno"],
    ["CR", "yes\rno"],
    ["CRLF", "yes\r\nno"],
    ["NUL", "yes\u0000no"],
    ["lone surrogate", "yes\ud800no"],
    ["line separator U+2028", "yes\u2028no"],
    ["tab", "yes\tno"],
    ["quote and backslash", 'yes"\\no'],
    ["a whole fake record", '{"domain":"forged"}\n{"domain":"forged2"}'],
    ["long field", "x".repeat(4000)],
  ];

  for (const [name, raw] of hazards) {
    test(`${name} stays inside one record and round-trips verbatim`, () => {
      const line = serializeRow(row(raw));
      // Exactly one record: one trailing newline, none in the body.
      expect(line.endsWith("\n")).toBe(true);
      expect(line.slice(0, -1)).not.toContain("\n");
      expect(line.split("\n").filter((l) => l.length > 0)).toHaveLength(1);
      // And the datum survives unchanged — escaping must not mean lossy.
      expect((JSON.parse(line) as AnswerRow).raw).toBe(raw);
    });
  }

  test("a file of hazard rows parses to exactly one row per entry", () => {
    const body = hazards.map(([, raw]) => serializeRow(row(raw))).join("");
    const lines = body.split("\n").filter((l) => l.length > 0);
    expect(lines).toHaveLength(hazards.length);
    expect(lines.map((l) => (JSON.parse(l) as AnswerRow).raw)).toEqual(hazards.map(([, raw]) => raw));
  });

  // The boundary guard is exported separately so it can actually be reached. Folded
  // into serializeRow it would be unfalsifiable — JSON.stringify never emits a literal
  // newline, so no input could trigger it, and a guard nothing can trigger is not a guard.
  test("assertSingleRecord rejects a line that would break the boundary", () => {
    expect(() => assertSingleRecord('{"a":1}\n{"a":2}')).toThrow(/record boundary/);
    expect(() => assertSingleRecord('{"a":1}\r')).toThrow(/record boundary/);
  });

  test("assertSingleRecord accepts a well-formed line", () => {
    expect(() => assertSingleRecord('{"a":"b\\nc"}')).not.toThrow();
  });
});

/**
 * The DESTINATION half of the write — the property CodeQL alerts #801 / #803 named as
 * unstated. `serializeRow`'s tests above cover the CONTENT; these cover the PATH.
 *
 * Each case is the shape a real defect would take, not a synthetic string: a model id
 * carrying a slash, a domain id that is `..`, a suffix swap that turns a data sink into a
 * config sink, and an absolute path handed in where a bare name was expected. The last is
 * the one an eyeball check misses — `join(base, "/etc/passwd")` stays inside `base`, so
 * containment alone passes it and only the separator rule catches it.
 */
describe("the output path is contained, not merely assumed", () => {
  const DIR = "/tmp/zeta-f4-out";

  test("a legitimate name resolves inside the dataset directory", () => {
    expect(resolveOutPath(DIR, "R-qwen2-5-0-5b.jsonl")).toBe("/tmp/zeta-f4-out/R-qwen2-5-0-5b.jsonl");
  });

  test("a separator in the name is refused — a name is a name, never a path", () => {
    expect(() => resolveOutPath(DIR, "a\\b.jsonl")).toThrow(/path separator/);
  });

  test("an absolute path escapes containment — the case an eyeball check misses", () => {
    expect(() => resolveOutPath(DIR, "/etc/cron.d/R.jsonl")).toThrow(/escapes the dataset directory/);
  });

  test("traversal out of the dataset directory is refused", () => {
    expect(() => resolveOutPath(DIR, "..")).toThrow(/escapes the dataset directory/);
    expect(() => resolveOutPath(DIR, "../R.jsonl")).toThrow(/escapes the dataset directory/);
  });

  test("a SUBDIRECTORY is refused — containment alone would allow it", () => {
    expect(() => resolveOutPath(DIR, "sub/R.jsonl")).toThrow(/path separator/);
  });

  test("a NUL byte is refused — the truncation trick that makes a suffix check lie", () => {
    expect(() => resolveOutPath(DIR, "R.jsonl\0.sh")).toThrow(/path separator/);
  });

  test("writeRow is WIRED to the guard, and refuses before it creates anything", () => {
    const row = {
      domain: "R", model: "m", prompt: "p", replicate: 0, seed: 1,
      temperature: 0.8, raw: "x", ms: 1, promptTokens: 1, evalTokens: 1,
    };
    expect(() => writeRow("../escape.jsonl", row)).toThrow(/escapes the dataset directory/);
    expect(() => writeRow("payload.sh", row)).toThrow(/not \.jsonl/);
  });

  test("a non-.jsonl sink is refused — this write is data, never code or config", () => {
    expect(() => resolveOutPath(DIR, "R.sh")).toThrow(/not \.jsonl/);
    expect(() => resolveOutPath(DIR, "R.jsonl.bak")).toThrow(/not \.jsonl/);
  });
});

describe("toAnswerRow rejects a response that violates the contract", () => {
  const fixed = { domain: "role", model: "qwen2.5:0.5b", prompt: "A", replicate: 0, seed: 1 };
  const ok = { text: "hello", ms: 1, promptTokens: 2, evalTokens: 3 };

  test("the happy path is preserved verbatim", () => {
    expect(toAnswerRow(fixed, ok)).toEqual({
      ...fixed,
      temperature: 0.8,
      raw: "hello",
      ms: 1,
      promptTokens: 2,
      evalTokens: 3,
    });
  });

  // A failed generation is a MISSING datum and stays representable — this is the
  // pre-existing behaviour and the 27,360 rows on disk contain no empty raw, so the
  // path has never fired in practice. It is pinned so the fix does not change the
  // experiment's semantics.
  test("a failed generation still records an empty row", () => {
    expect(toAnswerRow(fixed, null).raw).toBe("");
    expect(toAnswerRow(fixed, undefined).evalTokens).toBe(0);
  });

  // THE DEFECT. Each of these sailed through the old cast straight into the file.
  const violations: readonly (readonly [string, Record<string, unknown>])[] = [
    ["text is an object", { ...ok, text: { a: 1 } }],
    ["text is a number", { ...ok, text: 42 }],
    ["text is an array", { ...ok, text: ["a"] }],
    ["text is missing", { ms: 1, promptTokens: 2, evalTokens: 3 }],
    ["evalTokens is an object", { ...ok, evalTokens: { a: 1 } }],
    ["evalTokens is a string", { ...ok, evalTokens: "lots" }],
    ["promptTokens is an array", { ...ok, promptTokens: [1, 2] }],
    ["promptTokens is NaN", { ...ok, promptTokens: Number.NaN }],
    ["evalTokens is Infinity", { ...ok, evalTokens: Number.POSITIVE_INFINITY }],
    ["evalTokens is negative", { ...ok, evalTokens: -1 }],
    ["promptTokens is missing", { text: "hi", ms: 1, evalTokens: 3 }],
    ["text exceeds the cap", { ...ok, text: "x".repeat(MAX_RAW_CHARS + 1) }],
  ];

  for (const [name, gen] of violations) {
    test(`${name} throws ProtocolViolation`, () => {
      expect(() => toAnswerRow(fixed, gen)).toThrow(ProtocolViolation);
    });
  }

  test("a response exactly at the cap is accepted — the bound is not off by one", () => {
    expect(toAnswerRow(fixed, { ...ok, text: "x".repeat(MAX_RAW_CHARS) }).raw).toHaveLength(MAX_RAW_CHARS);
  });

  // The error names the field and its TYPE, never the value: the value is the
  // untrusted part, and echoing it into a log is how a sanitiser leaks its own input.
  //
  // The claim is a NONINTERFERENCE one — the untrusted value must not flow into the
  // message — so it is pinned by EXACT EQUALITY on the whole message, not by
  // `not.toContain(secret)`. An absence search witnesses ONE RENDERING of a leak: it
  // passes for a message that carries the value reversed, base64'd, or truncated. Pinning
  // the entire output leaves the value nowhere to hide, and it fails just as loudly if
  // the field name or the type name is what goes wrong.
  test("the violation message does not echo the offending value", () => {
    const secret = "SENTINEL-SHOULD-NOT-APPEAR";
    try {
      toAnswerRow(fixed, { ...ok, evalTokens: secret });
      throw new Error("expected a ProtocolViolation");
    } catch (err) {
      expect(err).toBeInstanceOf(ProtocolViolation);
      expect((err as Error).message).toBe(
        "ollama /api/generate: field 'eval_count' violates the contract — expected a finite count >= 0, got string",
      );
    }
  });
});
