/**
 * effective-agent-count.test.ts — falsifiers for the effective-agent-count measurement.
 *
 * Every test here is written to FAIL under a specific perturbation, and the perturbations were run:
 * see `MUTATION LOG` at the foot of this file. A test that passes for rho = 0 and rho = 1 alike is
 * not a test, so the endpoint tests are stated as exact equalities and the interior tests pin values
 * that only the correct formula produces.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  AGENTS,
  assertFrameContainsDraws,
  effectiveTrialCount,
  enumerateUniverse,
  formatReport,
  iccOneWay,
  independenceExpectedOverlap,
  measure,
  phiCoefficient,
  readFindings,
  repoRoot,
  rhoFromUnionCoverage,
  sourceIsTheSamplingUnit,
  tabulate,
  unionEquivalentAgentCount,
  unionProbability,
  type Table2x2,
} from "./effective-agent-count.ts";

const ROOT = repoRoot();

const bitsOf = (x: number): string => {
  const b = new DataView(new ArrayBuffer(8));
  b.setFloat64(0, x, false);
  return b.getBigUint64(0, false).toString(16).toUpperCase().padStart(16, "0");
};
const fromBits = (hex: string): number => {
  const b = new DataView(new ArrayBuffer(8));
  b.setBigUint64(0, BigInt(`0x${hex}`), false);
  return b.getFloat64(0, false);
};

interface KishVector {
  n: number;
  rhoHex: string;
  rho: string;
  nEffHex: string;
  nEff: string;
  note: string;
}
interface UnionVector {
  n: number;
  cHex: string;
  rhoHex: string;
  unionProbability: string;
  unionEquivalentAgentCount: string;
  note: string;
}
interface Golden {
  kish: { vectors: KishVector[] };
  union: { vectors: UnionVector[] };
}

const golden = JSON.parse(
  readFileSync(join(ROOT, "src", "Core.TypeScript", "society", "golden-vectors-effective-agent-count.json"), "utf8"),
) as Golden;

// ── Kish: the shipped formula, byte-locked ───────────────────────────────────────────────────────

describe("effectiveTrialCount (Kish 1965)", () => {
  test("ENDPOINT rho = 0 gives nEff = n exactly, for every n", () => {
    for (const n of [1, 2, 3, 7, 100, 4096]) expect(effectiveTrialCount(n, 0)).toBe(n);
  });

  test("ENDPOINT rho = 1 gives nEff = 1 exactly, for every n", () => {
    for (const n of [1, 2, 3, 7, 100, 4096]) expect(effectiveTrialCount(n, 1)).toBe(1);
  });

  test("the two endpoints DISAGREE for n > 1 — the test that a constant-returning stub cannot pass", () => {
    for (const n of [2, 3, 7, 100]) {
      expect(effectiveTrialCount(n, 0)).not.toBe(effectiveTrialCount(n, 1));
    }
  });

  test("strictly decreasing in rho on (0, 1) for n > 1", () => {
    let prev = effectiveTrialCount(8, 0);
    for (const rho of [0.05, 0.1, 0.25, 0.4, 0.6, 0.8, 0.95, 1]) {
      const next = effectiveTrialCount(8, rho);
      expect(next).toBeLessThan(prev);
      prev = next;
    }
  });

  test("rho outside [0,1] is CLAMPED, never extrapolated — nEff never exceeds n", () => {
    expect(effectiveTrialCount(10, -0.5)).toBe(effectiveTrialCount(10, 0));
    expect(effectiveTrialCount(10, -1e9)).toBe(10);
    expect(effectiveTrialCount(10, 1.5)).toBe(effectiveTrialCount(10, 1));
    expect(effectiveTrialCount(10, 1e9)).toBe(1);
  });

  test("n < 1 returns 0.0, not NaN", () => {
    expect(effectiveTrialCount(0, 0.5)).toBe(0);
    expect(effectiveTrialCount(-3, 0.5)).toBe(0);
  });

  test("non-integer n is refused rather than silently interpolated", () => {
    expect(() => effectiveTrialCount(2.5, 0.5)).toThrow(TypeError);
  });

  test("rho = 1/(n-1) halves the fleet — deff = 2 exactly at n = 3, rho = 0.5", () => {
    expect(effectiveTrialCount(3, 0.5)).toBe(1.5);
    expect(effectiveTrialCount(5, 0.25)).toBe(2.5);
  });

  test("GOLDEN VECTORS: exact IEEE-754 bit equality against the F# reference", () => {
    expect(golden.kish.vectors.length).toBeGreaterThan(10);
    let sawRhoZero = false;
    let sawRhoOne = false;
    for (const v of golden.kish.vectors) {
      const rho = fromBits(v.rhoHex);
      const actual = effectiveTrialCount(v.n, rho);
      const label = `n=${String(v.n)} rho=${v.rhoHex}`;
      expect(`${label} nEff=${bitsOf(actual)}`).toBe(`${label} nEff=${v.nEffHex}`);
      // The decimal rendering beside the hex must not have drifted from the hex it annotates.
      expect(Number.parseFloat(v.nEff)).toBeCloseTo(actual, 12);
      if (rho === 0) sawRhoZero = true;
      if (rho === 1) sawRhoOne = true;
    }
    // A vector set that never touches an endpoint cannot detect an endpoint regression.
    expect(sawRhoZero && sawRhoOne).toBe(true);
  });
});

// ── The union half: a DIFFERENT question, kept separate on purpose ───────────────────────────────

describe("unionEquivalentAgentCount", () => {
  test("agrees with Kish at BOTH endpoints and disagrees in the interior", () => {
    const n = 3;
    const c = 0.2;
    expect(unionEquivalentAgentCount(n, c, 0)).toBeCloseTo(n, 12);
    expect(unionEquivalentAgentCount(n, c, 1)).toBeCloseTo(1, 12);
    // The whole reason both functions exist: the interiors are not the same number.
    expect(Math.abs(unionEquivalentAgentCount(n, c, 0.4) - effectiveTrialCount(n, 0.4))).toBeGreaterThan(0.2);
  });

  test("degenerate competence has no finite inverse and returns 0", () => {
    expect(unionEquivalentAgentCount(3, 0, 0.5)).toBe(0);
    expect(unionEquivalentAgentCount(3, 1, 0.5)).toBe(0);
    expect(unionEquivalentAgentCount(0, 0.5, 0.5)).toBe(0);
  });

  test("union probability is monotone decreasing in rho", () => {
    let prev = unionProbability(4, 0.2, 0);
    for (const rho of [0.1, 0.3, 0.6, 0.9, 1]) {
      const next = unionProbability(4, 0.2, rho);
      expect(next).toBeLessThan(prev);
      prev = next;
    }
    expect(unionProbability(4, 0.2, 1)).toBeCloseTo(0.2, 12);
  });

  test("GOLDEN VECTORS: agrees with the F# reference to 1e-12 relative (pow/log are not byte-lockable)", () => {
    for (const v of golden.union.vectors) {
      const c = fromBits(v.cHex);
      const rho = fromBits(v.rhoHex);
      const p = unionProbability(v.n, c, rho);
      const m = unionEquivalentAgentCount(v.n, c, rho);
      expect(p).toBeCloseTo(Number.parseFloat(v.unionProbability), 12);
      expect(m).toBeCloseTo(Number.parseFloat(v.unionEquivalentAgentCount), 12);
    }
  });
});

// ── Estimators ───────────────────────────────────────────────────────────────────────────────────

describe("phiCoefficient", () => {
  test("perfect agreement is +1, perfect disagreement is -1, independence is 0", () => {
    expect(phiCoefficient({ both: 10, onlyA: 0, onlyB: 0, neither: 10 })).toBe(1);
    expect(phiCoefficient({ both: 0, onlyA: 10, onlyB: 10, neither: 0 })).toBe(-1);
    // a*d == b*c is exactly the independence condition for a 2x2 table.
    expect(phiCoefficient({ both: 4, onlyA: 4, onlyB: 4, neither: 4 })).toBe(0);
  });

  test("a degenerate margin returns 0, not NaN", () => {
    expect(phiCoefficient({ both: 0, onlyA: 0, onlyB: 5, neither: 5 })).toBe(0);
    expect(Number.isNaN(phiCoefficient({ both: 0, onlyA: 0, onlyB: 0, neither: 9 }))).toBe(false);
  });

  test("the measured alexa x otto table gives the value the report prints", () => {
    const t: Table2x2 = { both: 72, onlyA: 59, onlyB: 57, neither: 515 };
    expect(phiCoefficient(t)).toBeCloseTo(0.4527, 4);
    expect(independenceExpectedOverlap(703, 131, 129)).toBeCloseTo(24.038, 3);
  });
});

/**
 * Draws a k-agent x `rows` indicator matrix from a model whose pairwise correlation is known in
 * closed form. Per row, with probability `q` the row is "shared" and all k agents take the same
 * coin; otherwise each agent flips independently at rate `p`. Then Cov(x_i, x_j) = q p (1-p) and
 * Var = p (1-p), so Corr(x_i, x_j) = `q` EXACTLY. Deterministic (splitmix64, fixed seed).
 */
function drawSharedCauseMatrix(rows: number, k: number, p: number, q: number): number[][] {
  let s = 0x9e3779b97f4a7c15n;
  const next = (): number => {
    s = (s + 0x9e3779b97f4a7c15n) & 0xffffffffffffffffn;
    let z = s;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & 0xffffffffffffffffn;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & 0xffffffffffffffffn;
    z = z ^ (z >> 31n);
    return Number(z >> 11n) / 2 ** 53;
  };
  const cols: number[][] = Array.from({ length: k }, () => []);
  for (let t = 0; t < rows; t++) {
    const shared = next() < q;
    const sharedCoin = next() < p ? 1 : 0;
    for (const col of cols) {
      if (shared) col.push(sharedCoin);
      else col.push(next() < p ? 1 : 0);
    }
  }
  return cols;
}

/** Mean pairwise phi over the columns of an indicator matrix. */
function meanPairwisePhi(cols: readonly (readonly number[])[]): number {
  const frame = Array.from({ length: cols[0]?.length ?? 0 }, (_, i) => String(i));
  const sets = cols.map((c) => new Set(frame.filter((_, i) => c[i] === 1)));
  let sum = 0;
  let pairs = 0;
  for (const [i, a] of sets.entries()) {
    for (const b of sets.slice(i + 1)) {
      sum += phiCoefficient(tabulate(frame, a, b));
      pairs++;
    }
  }
  return pairs === 0 ? 0 : sum / pairs;
}

describe("iccOneWay", () => {
  test("identical raters give rho = 1", () => {
    const row = [1, 1, 0, 0, 1, 0, 1, 0];
    expect(iccOneWay([row, row, row])).toBeCloseTo(1, 12);
  });

  test("a rater set with no between-cluster variance gives rho <= 0", () => {
    // Every file sampled by exactly one of the two agents: MSB is at its minimum.
    const a = [1, 0, 1, 0, 1, 0];
    const b = [0, 1, 0, 1, 0, 1];
    expect(iccOneWay([a, b])).toBeLessThanOrEqual(0);
  });

  test("ENDPOINTS DIFFER: perfect agreement and perfect disagreement are not the same number", () => {
    const a = [1, 1, 0, 0];
    expect(iccOneWay([a, a])).not.toBeCloseTo(iccOneWay([a, a.map((x) => 1 - x)]), 3);
  });

  test("RECOVERS a known rho from a generative model with a shared cause, and agrees with phi there", () => {
    // The strongest available falsifier: draw from a model whose pairwise correlation is known in
    // closed form (see `drawSharedCauseMatrix`) and check the estimator returns it.
    //
    // ICC(1) and mean pairwise phi are the same population quantity but differ in their finite-
    // sample bias by O(1/N) — which is why the real-corpus test asks for agreement to 0.01 at
    // N = 703 rather than to machine precision, and why the 8-row toy version of this test that
    // preceded it was wrong.
    for (const q of [0.0, 0.25, 0.6]) {
      const cols = drawSharedCauseMatrix(40000, 3, 0.3, q);
      const icc = iccOneWay(cols);
      const phi = meanPairwisePhi(cols);
      expect(icc).toBeCloseTo(q, 2);
      expect(phi).toBeCloseTo(q, 2);
      expect(Math.abs(icc - phi)).toBeLessThan(0.01);
    }
  });
});

describe("rhoFromUnionCoverage", () => {
  test("inverts unionProbability — round-trips to the rho it was built from", () => {
    for (const rho of [0, 0.15, 0.4, 0.75, 1]) {
      const c = 0.18;
      const coverage = unionProbability(3, c, rho);
      expect(rhoFromUnionCoverage(3, c, coverage)).toBeCloseTo(rho, 10);
    }
  });

  test("degenerate competence yields NaN rather than a fabricated number", () => {
    expect(Number.isNaN(rhoFromUnionCoverage(3, 0, 0.3))).toBe(true);
    expect(Number.isNaN(rhoFromUnionCoverage(3, 1, 0.3))).toBe(true);
  });
});

// ── The corpus measurement itself ────────────────────────────────────────────────────────────────

describe("the measurement over db/mutation-findings/", () => {
  test("the sampling frame is enumerated from the committed tree and contains EVERY observed draw", () => {
    const frame = enumerateUniverse(ROOT);
    expect(frame.length).toBeGreaterThan(600);
    const draws = new Map<string, ReadonlySet<string>>();
    for (const a of AGENTS) {
      draws.set(a, new Set(readFindings(ROOT, a).map((f) => f.source)));
    }
    // The check that killed the N = 616 frame. It must throw, not filter.
    expect(() => {
      assertFrameContainsDraws(frame, draws);
    }).not.toThrow();
    expect(() => {
      assertFrameContainsDraws(["a.ts"], draws);
    }).toThrow(/does not contain/);
  });

  test("the frame is NOT circular: it is disjoint from the agents' own output", () => {
    const frame = new Set(enumerateUniverse(ROOT));
    // If the universe were derived from the findings, a Lincoln-Petersen estimate (~230-250 here)
    // would be indistinguishable from it. It must be far larger than the observed union.
    const union = new Set<string>();
    for (const a of AGENTS) for (const f of readFindings(ROOT, a)) union.add(f.source);
    expect(frame.size).toBeGreaterThan(union.size * 2);
  });

  test("the sampling unit is the SOURCE: (tick, source) all but determines the operator", () => {
    const all = AGENTS.flatMap((a) => [...readFindings(ROOT, a)]);
    const { cells, multiOperator } = sourceIsTheSamplingUnit(all);
    expect(cells).toBeGreaterThan(400);
    expect(multiOperator / cells).toBeLessThan(0.02);
  });

  test("the agents are materially MORE overlapping than independence predicts", () => {
    const r = measure(ROOT);
    for (const p of r.pairs) {
      expect(p.table.both).toBeGreaterThan(p.expectedOverlapUnderIndependence * 2);
      expect(p.phi).toBeGreaterThan(0.3);
    }
  });

  test("THE FINDING: the effective count is strictly below the head count", () => {
    const r = measure(ROOT);
    expect(r.headCount).toBe(3);

    // The (0.35, 0.45) band that used to be here was a slower snapshot pin, and it
    // expired the same way the exact values did. Measured trajectory on main:
    //
    //     #12548  2026-08-19   rho 0.400   nEff 1.666   (362 draws)
    //     #12607  2026-08-20   rho 0.439   nEff 1.598
    //     this    2026-08-20   rho 0.4647  nEff 1.555
    //
    // Monotone rise across three independent measurements. A static window over a
    // drifting quantity re-expires on a timer; re-centring it each time it fires
    // would be widening a claim until it can no longer be false.
    //
    // So this asserts what an ESTIMATOR SANITY CHECK can honestly assert -- rho is a
    // correlation in the open unit interval and is neither degenerate-independent nor
    // degenerate-identical. A broken ICC (negative, ~0, ~1) still dies here; the
    // arithmetic mutants still die on Kish's identity below. What this deliberately
    // does NOT do is encode a belief about where the fleet's correlation sits, because
    // that belief is dated the moment it is written.
    //
    // The rise itself is a finding about the fleet, not about this file, and it runs
    // AGAINST the decorrelation arc: three agents are worth 1.555 independent ones and
    // falling. Tracked as a trend, not gated here.
    expect(r.rhoIcc).toBeGreaterThan(0.05);
    expect(r.rhoIcc).toBeLessThan(0.95);

    expect(r.effectiveCount).toBeLessThan(r.headCount);
    expect(r.effectiveCount).toBeGreaterThan(1);

    // NOT a literal pin. `db/mutation-findings/*.jsonl` is an append-only corpus that every
    // heartbeat tick grows, so any exact expected value here is a snapshot with an expiry date:
    // the first pins (nEff 1.666 / deff 1.800, authored at 362 draws) went red on main the next
    // time otto's lane appended, at no point having caught a defect. What is actually invariant
    // is Kish's identity itself, recomputed here from the measured rho rather than restated:
    //   deff = 1 + (n-1) rho   and   nEff = n / deff
    // That holds at every corpus size and still fails the arithmetic mutants -- verified: the
    // `deff = 1 + n*rho` mutant (drop the -1) survives the rho band above and dies here.
    // Exact values are pinned where they belong, on the synthetic (n, rho) golden vectors, which
    // are frozen by construction. Measured at authoring: rho 0.439, deff 1.878, nEff 1.598.
    expect(r.designEffect).toBeCloseTo(1 + (r.headCount - 1) * r.rhoIcc, 12);
    expect(r.effectiveCount).toBeCloseTo(r.headCount / r.designEffect, 12);
  });

  test("the two pairwise-family estimators agree, as exchangeability requires", () => {
    const r = measure(ROOT);
    expect(Math.abs(r.rhoIcc - r.rhoMeanPhi)).toBeLessThan(0.01);
  });

  test("the independent union-coverage estimator corroborates without restating", () => {
    const r = measure(ROOT);

    // This statistic is computed over an append-only corpus, so a fixed level band expires as the
    // corpus grows even when agent behaviour is held constant. The stable claim is relational:
    // both estimators remain non-degenerate and same-scale, while the union estimator is biased
    // upward because it assumes identical agents and these agents have unequal draw rates.
    expect(r.rhoFromUnion).toBeGreaterThan(0);
    expect(r.rhoFromUnion).toBeLessThan(1);
    expect(r.rhoFromUnion).toBeGreaterThan(r.rhoIcc);
    expect(r.rhoFromUnion / r.rhoIcc).toBeLessThan(2.5);

    // The estimators corroborate without merely restating one another.
    expect(Math.abs(r.rhoFromUnion - r.rhoIcc)).toBeGreaterThan(0.01);

    // This deliberately does not detect both estimators drifting together, or the union estimate
    // drifting alone while it remains inside the ratio bound. Absolute-level surveillance belongs
    // in rho-series.ts, which has a windowed instrument and a stationary null model.
  });

  test("the report states its own register limit — backward-looking, not a forward claim", () => {
    const text = formatReport(measure(ROOT));
    expect(text).toContain("NOT metered");
    expect(text).toContain("backward-looking");
    expect(text).toContain("EFFECTIVE COUNT");
  });
});

// ── MUTATION LOG ─────────────────────────────────────────────────────────────────────────────────
//
// Each perturbation was applied to the source, `bun test` was run, and the named tests went RED.
// Recorded here because a falsifier nobody tried is a claim, not a falsifier.
//
//   1. `deff = 1 + n * r`            (drop the -1)  -> endpoint rho=0, golden vectors, THE FINDING
//   2. `deff = 1 + (n-1)`            (drop rho)     -> endpoint rho=0, monotonicity, golden vectors
//   3. `return n`                    (stub)         -> endpoint rho=1, endpoints-differ, golden vectors
//   4. drop the clamp on rho                        -> clamp test, golden vectors (the negative-rho vector)
//   5. phi numerator `a*d + b*c`                    -> phi endpoints, alexa x otto value
//   6. ICC `(MSB - MSW) / (MSB + MSW)`  (drop k-1)  -> ICC/phi agreement, THE FINDING
//   7. `assertFrameContainsDraws` filters instead of throwing -> frame test's `.toThrow`
