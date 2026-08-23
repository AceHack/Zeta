/**
 * rho-series.test.ts — falsifiers for the time series that settled
 * `docs/research/2026-08-22-the-decorrelation-meter-left-its-band-and-i-may-be-the-reason.md`.
 *
 * Two classes of test, and the second is the load-bearing one:
 *
 * 1. **The series measures what it claims to measure.** `pointAt` at `HEAD` must equal `measure()`
 *    field for field by `===`, and the extracted `universeFromFileList` / `parseFindings` must be
 *    the same functions the shipped path uses. A series that quietly measured a lookalike statistic
 *    would produce a confident, wrong history.
 *
 * 2. **The claims made ABOUT the statistic are falsifiable.** The conclusion of that
 *    investigation is that `rhoFromUnion` over an append-only corpus is a RATCHET — it climbs
 *    with corpus size under agents whose behaviour never changes — and that the fix is to window
 *    the corpus, not to widen the bound. Each of those is asserted here against the null model,
 *    and each dies if the property is not real:
 *      - constant behaviour, `f < 1`   => cumulative rho climbs. Kill it and the mis-specification
 *        argument collapses, and the failing bound in `effective-agent-count.test.ts` really was
 *        catching a fleet that got worse.
 *      - constant behaviour, `f = 1`   => cumulative rho stays ~0. This is the HONEST LIMIT: growth
 *        alone does not do it, pool restriction does, so "the corpus grew" is not by itself a
 *        defence and the statistic is not pure noise.
 *      - a real narrowing              => the CUMULATIVE fit is blind to it and the WINDOWED one
 *        is not. This is what makes windowing the fix rather than a preference.
 */

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  AGENTS,
  enumerateUniverse,
  measure,
  parseFindings,
  readFindings,
  repoRoot,
  rhoFromUnionCoverage,
  unionProbability,
  universeFromFileList,
} from "./effective-agent-count.ts";
import {
  bootstrapRhoFromUnion,
  corpusCommits,
  fitRestrictedPool,
  headRows,
  mulberry32,
  pointAt,
  simulateNullModel,
  WORKTREE,
} from "./rho-series.ts";

const ROOT = repoRoot();
// WORKTREE, not HEAD: `measure()` enumerates the frame from the INDEX (`git ls-files`) and a
// historical point necessarily reads a TREE. On a dirty checkout those are different populations,
// so asserting parity against HEAD would silently turn this correctness test into a tree-cleanliness
// test. It caught exactly that on this branch — see the WORKTREE docstring in rho-series.ts.
const HEAD = { sha: WORKTREE, authoredAt: "", subject: "" };

describe("the extracted seams are the SAME code the shipped path runs", () => {
  test("enumerateUniverse == universeFromFileList(git ls-files)", () => {
    // If this drifts, the historical frame and the live frame are two different universes and every
    // point in the series is measuring a different population from the one `measure()` reports.
    const live = enumerateUniverse(ROOT);
    const siblings = live.map((p) => `${p.slice(0, -3)}.test.ts`);
    const relocatedHookTests = live
      .filter((p) => p.startsWith(".claude/hooks/"))
      .map((p) => `src/Core.TypeScript/claude-hooks/${p.slice(".claude/hooks/".length, -3)}.test.ts`);
    const viaList = universeFromFileList([...live, ...siblings, ...relocatedHookTests]);
    expect([...viaList]).toEqual([...live]);
  });

  test("parseFindings == readFindings on the real corpus", () => {
    for (const agent of AGENTS) {
      const viaDisk = readFindings(ROOT, agent);
      const viaText = parseFindings(
        // Read it the long way round on purpose: this asserts the two paths agree, not that one of
        // them works.
        [...viaDisk].map((f) => JSON.stringify(f)).join("\n"),
      );
      expect(viaText.length).toBe(viaDisk.length);
      expect(viaText[0]?.source).toBe(viaDisk[0]?.source);
    }
  });

  test("universeFromFileList refuses a .ts with no companion test, and .d.ts / .test.ts themselves", () => {
    expect([...universeFromFileList(["a.ts", "a.test.ts", "b.ts", "c.d.ts", "d.test.ts"])]).toEqual(["a.ts"]);
  });

  test("universeFromFileList includes .claude/hooks sources whose tests were relocated (#10559)", () => {
    expect([
      ...universeFromFileList([
        ".claude/hooks/harness.ts",
        "src/Core.TypeScript/claude-hooks/harness.test.ts",
        ".claude/hooks/bare.ts",
        "a.ts",
        "a.test.ts",
      ]),
    ]).toEqual([".claude/hooks/harness.ts", "a.ts"]);
  });
});

describe("the series is the same statistic as measure()", () => {
  test("pointAt(WORKTREE) === measure(), field for field, by strict equality", () => {
    const live = measure(ROOT);
    const mine = pointAt(ROOT, HEAD);
    expect(mine.frameSize).toBe(live.frameSize);
    expect(mine.meanCompetence).toBe(live.meanCompetence);
    expect(mine.observedUnionCoverage).toBe(live.observedUnionCoverage);
    expect(mine.rhoFromUnion).toBe(live.rhoFromUnion);
    expect(mine.rhoIcc).toBe(live.rhoIcc);
    expect(mine.effectiveCount).toBe(live.effectiveCount);
  });

  test("the live frame contains every draw — so `strayDraws` at the tip is 0", () => {
    // `pointAt` carries strays rather than throwing (a rename must not abort a whole history), so
    // the assertion `measure()` makes has to be re-made here or it is silently dropped for the tip.
    expect(pointAt(ROOT, HEAD).strayDraws).toBe(0);
  });

  test("the corpus has a real history to measure — not one point wearing a trend", () => {
    // The DEPTH assertion is made against the CHECKED-IN series, not against `git log`.
    //
    // Asserting `corpusCommits(ROOT).length > 100` is what this test did when it was written, and
    // it went red on `main` the first time CI ran it: the CI checkout is shallow, so `git log --
    // db/mutation-findings/` legitimately returns a handful of commits. That is a property of the
    // CHECKOUT, not of the code, and a test that fails on it is testing clone depth.
    //
    // The landed TSV is in the tree at any depth, so it carries the claim instead — and this is
    // strictly stronger, because it now also guards the artifact against being silently truncated
    // by a regeneration on a shallow clone, which is exactly how a series loses its early history.
    const rows = readFileSync(join(ROOT, "db", "effective-agent-count", "rho-series-cumulative.tsv"), "utf8")
      .split("\n")
      .filter((l) => l.trim().length > 0)
      .slice(1);
    expect(rows.length).toBeGreaterThan(100);

    // oldest-first, in the artifact and in the live log alike: a reversed series would invert every
    // conclusion drawn from it. Ordinal `<`, never `localeCompare` — ISO-8601 sorts correctly
    // bytewise and a culture-sensitive comparison orders differently per locale
    // (`culture-invariant-by-default`).
    const stamps = rows.map((l) => l.split("\t")[0] ?? "");
    for (let i = 1; i < stamps.length; i++) expect((stamps[i - 1] ?? "") <= (stamps[i] ?? "")).toBe(true);
    expect(stamps[0]).not.toBe(stamps[stamps.length - 1]);

    // The LIVE log gets only the property that survives any clone depth: whatever it returns is in
    // the same order. `actions/checkout` defaults to `fetch-depth: 1` and no override is set for
    // this job, so on CI `corpusCommits` may return one commit or NONE — the tip need not have
    // touched the corpus at all. Asserting a count here is asserting clone depth.
    //
    // Stated limit, because a check that can be trivially satisfied should say so: on a depth-1
    // checkout this loop runs zero times. It is not the non-vacuity guard — the artifact
    // assertions above are, and they hold at every depth. What this catches, on any developer
    // machine or full-history job, is `--reverse` going missing from `corpusCommits`, which would
    // silently invert every conclusion the series supports.
    const commits = corpusCommits(ROOT);
    for (let i = 1; i < commits.length; i++) {
      expect((commits[i - 1]?.authoredAt ?? "") <= (commits[i]?.authoredAt ?? "")).toBe(true);
    }
  });

  test("a window strictly reduces the draws considered, and the two agree at a window past the end", () => {
    const cum = pointAt(ROOT, HEAD);
    const win = pointAt(ROOT, HEAD, 40);
    expect(win.unionSize).toBeLessThan(cum.unionSize);
    expect(pointAt(ROOT, HEAD, 10 ** 6).rhoFromUnion).toBe(cum.rhoFromUnion);
  });
});

describe("fitRestrictedPool inverts the union model it claims to invert", () => {
  test("round-trip: c = f*x and coverage from the union formula recover (x, f)", () => {
    for (const f of [0.2, 0.4, 0.75, 0.95]) {
      for (const x of [0.1, 0.35, 0.625, 0.9]) {
        const c = f * x;
        const coverage = f * (1 - (1 - x) ** 3);
        const fit = fitRestrictedPool(c, coverage);
        expect(fit.saturation).toBeCloseTo(x, 10);
        expect(fit.poolFraction).toBeCloseTo(f, 10);
      }
    }
  });

  test("out of the model's range it returns NaN — never a clamped number that looks measured", () => {
    expect(Number.isNaN(fitRestrictedPool(0, 0.3).poolFraction)).toBe(true);
    // coverage/c > 3 is impossible for 3 agents (the union cannot exceed the sum), so the
    // discriminant goes negative and the honest answer is "not this model's numbers".
    expect(Number.isNaN(fitRestrictedPool(0.1, 0.9).poolFraction)).toBe(true);
  });

  test("f = 1 is the rho = 0 case of the shipped union formula, which is the model's own anchor", () => {
    // At f = 1 the restricted-pool model IS `unionProbability` at rho = 0, so the fit must return
    // f = 1 exactly. This ties the reparametrisation to the shipped formula rather than to itself.
    for (const x of [0.2, 0.5, 0.8]) {
      const coverage = unionProbability(3, x, 0);
      expect(fitRestrictedPool(x, coverage).poolFraction).toBeCloseTo(1, 10);
      expect(rhoFromUnionCoverage(3, x, coverage)).toBeCloseTo(0, 10);
    }
  });
});

describe("THE FINDING ABOUT THE STATISTIC: cumulative rho is a ratchet", () => {
  const AT = [60, 120, 240, 360, 600, 900] as const;

  test("constant behaviour at f = 0.40 => cumulative rho climbs from under 0.2 to over 0.9", () => {
    // The whole mis-specification argument lives here. `poolFractionAt` is constant, so NOTHING
    // about the agents changes across this run; if the reported rho still moves, a fixed upper
    // bound on it expires on a timer rather than on a defect.
    const pts = simulateNullModel(757, 3, 900, () => 0.4, 4, 60, AT);
    const rhos = pts.map((p) => p.cumulativeRho);
    expect(rhos[0]).toBeLessThan(0.2);
    expect(rhos[rhos.length - 1]).toBeGreaterThan(0.9);
    for (let i = 1; i < rhos.length; i++) expect(rhos[i]).toBeGreaterThan(rhos[i - 1] ?? 0);
    // and it crosses the 0.6 bound that `effective-agent-count.test.ts` asserts, with no fleet
    // change of any kind
    expect(rhos.some((r) => r > 0.6)).toBe(true);
  });

  test("THE HONEST LIMIT: at f = 1 cumulative rho stays ~0 forever — growth alone is NOT the cause", () => {
    // Without this test the claim above would over-reach into "the statistic is meaningless".
    // It is not: it reads `pool restriction x saturation`, and with no restriction it reads zero at
    // every corpus size. That is why the recommendation is to window the meter, not to delete it.
    for (const p of simulateNullModel(757, 3, 900, () => 1, 4, 60, AT)) {
      expect(Math.abs(p.cumulativeRho)).toBeLessThan(0.1);
    }
  });

  test("windowed rho is stationary under constant behaviour — the property the cumulative one lacks", () => {
    const w = simulateNullModel(757, 3, 900, () => 0.4, 4, 60, AT).map((p) => p.windowedRho);
    const lo = Math.min(...w);
    const hi = Math.max(...w);
    expect(hi - lo).toBeLessThan(0.1);
    // and it must not be a constant-zero stub: it reads the correlation the pool actually implies
    expect(lo).toBeGreaterThan(0.05);
  });

  test("POWER: a real narrowing is INVISIBLE cumulatively and VISIBLE in the window", () => {
    const narrow = (m: number): number => (m <= 300 ? 0.4 : 0.2);
    const pts = simulateNullModel(757, 3, 900, narrow, 4, 60, [300, 420, 900]);
    const [before, after, late] = pts;

    // The cumulative fit does not move: the accumulated union is a ratchet and a later narrowing
    // cannot un-cover what is already covered. A meter with no power is not a safer meter.
    expect(Math.abs((after?.cumulativePoolFraction ?? 0) - (before?.cumulativePoolFraction ?? 0))).toBeLessThan(0.05);
    expect(Math.abs((late?.cumulativePoolFraction ?? 0) - (before?.cumulativePoolFraction ?? 0))).toBeLessThan(0.05);

    // The window sees it within one window, and recovers roughly the true new value (0.2).
    expect(after?.windowedPoolFraction ?? 1).toBeLessThan(0.28);
    expect(after?.windowedRho ?? 0).toBeGreaterThan((before?.windowedRho ?? 0) + 0.1);
  });
});

describe("the bootstrap is a measurement someone else can reproduce", () => {
  test("same seed => identical interval; different seed => a different one", () => {
    const rows = headRows(ROOT);
    const a = bootstrapRhoFromUnion(rows, AGENTS.length, 400, 4, 0.6);
    const b = bootstrapRhoFromUnion(rows, AGENTS.length, 400, 4, 0.6);
    const c = bootstrapRhoFromUnion(rows, AGENTS.length, 400, 5, 0.6);
    expect(a.p2_5).toBe(b.p2_5);
    expect(a.p97_5).toBe(b.p97_5);
    expect(c.p2_5).not.toBe(a.p2_5);
  });

  test("the resampling is unbiased for the statistic: bootstrap mean tracks the point estimate", () => {
    // This is the property that justifies ROW resampling over resampling findings. Resampling
    // findings shrinks each agent's distinct count and would move the mean away from the point;
    // a scheme whose mean disagrees with the statistic is measuring its own bias.
    const r = bootstrapRhoFromUnion(headRows(ROOT), AGENTS.length, 2000, 4, 0.6);
    expect(Math.abs(r.mean - r.point)).toBeLessThan(r.sd / 2);
    expect(r.point).toBe(measure(ROOT).rhoFromUnion);
  });

  test("THE NOISE FLOOR: the interval is wide enough that a 0.6 crossing is not resolvable", () => {
    // The reason the doc's excursion (0.6012 vs 0.6000, i.e. 0.0012) cannot be read as an event.
    // If the estimator ever became precise enough for `sd < 0.0012` this test would go red and the
    // crossing WOULD be meaningful — which is exactly when someone should be told.
    const r = bootstrapRhoFromUnion(headRows(ROOT), AGENTS.length, 2000, 4, 0.6);
    expect(r.sd).toBeGreaterThan(0.01);
    expect(r.p97_5 - r.p2_5).toBeGreaterThan(0.05);
  });

  test("mulberry32 is a real PRNG, not a constant wearing a seed", () => {
    const g = mulberry32(4);
    const xs = Array.from({ length: 500 }, () => g());
    expect(new Set(xs).size).toBeGreaterThan(490);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThan(1);
    // deterministic across instances
    expect(mulberry32(4)()).toBe(mulberry32(4)());
  });
});

// ── MUTATION LOG ─────────────────────────────────────────────────────────────────────────────────
//
// Each perturbation was applied to the source, `bun test src/Core.TypeScript/society/rho-series.
// test.ts` was run, and the pass/fail counts below are what came back. A falsifier nobody tried is
// a claim, not a falsifier — and the counts are recorded rather than a bare "went red", because
// "1 fail" and "3 fail" say different things about how load-bearing the property is.
//
//   baseline                                                    18 pass  0 fail
//   1. `pointAt` ignores `window` (always cumulative)            17 pass  1 fail
//   2. `fitRestrictedPool` returns `c` instead of `c/x`          15 pass  3 fail
//   3. `fitRestrictedPool` clamps its NaN to 0                   17 pass  1 fail
//   4. `simulateNullModel` gives every agent the same draw       15 pass  3 fail
//   5. `bootstrapRhoFromUnion` resamples with `Math.random`      17 pass  1 fail
//   6. `bootstrapRhoFromUnion` returns `point` per replicate     15 pass  3 fail
//   7. `universeFromFileList` drops the sibling-test filter      17 pass  1 fail
