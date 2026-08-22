#!/usr/bin/env bun
/**
 * rho-series.ts — the falsifier that
 * `docs/research/2026-08-22-the-decorrelation-meter-left-its-band-and-i-may-be-the-reason.md`
 * named and did not run: **compute rho per commit across the history of `db/mutation-findings/`
 * and plot it against wall-clock time.**
 *
 * ## Why this is a tool and not a one-off script
 *
 * The doc hypothesised that an overnight run of ~12 heavily-templated `shadow` agents
 * (2026-08-21T20:00Z -> 08-22T08:00Z) homogenised the fleet and pushed `rhoFromUnion` past its
 * declared band, and said plainly that **"a time series is the falsifier and it has not been
 * run."** A conclusion resting on a plot nobody can regenerate is the same defect one layer up,
 * so the series ships as code with its data checked in.
 *
 * ## It measures the SAME statistic — by construction, not by assertion
 *
 * Every number here comes from `effective-agent-count.ts`:
 *
 * - `universeFromFileList` — the frame predicate, shared with `enumerateUniverse`. The only
 *   difference is the file list: `git ls-tree -r <sha>` (historical) instead of `git ls-files`
 *   (working tree), so the frames cannot silently diverge.
 * - `parseFindings` — the corpus parser, shared with `readFindings`.
 * - `rhoFromUnionCoverage`, `iccOneWay`, `effectiveTrialCount` — the estimators, imported.
 *
 * `--verify-head` re-runs this file's own per-commit computation at `HEAD` and compares it to
 * `measure()`'s, field by field, by `===`. If they disagree the series is measuring something
 * else and the run aborts rather than reporting a trend.
 *
 * ## What the series showed (2026-08-22), and why this file grew a second half
 *
 * The cumulative rho rose smoothly from 0.25 (08-17T09) to 0.61 (08-22T14) with no step at the
 * overnight window, so the templated-prompt hypothesis was refuted. But the more useful finding
 * is about the statistic itself, and it is what `--null-model` exists to demonstrate:
 *
 * > **Over an append-only corpus, `rhoFromUnion` is a RATCHET.** Simulate three agents whose
 * > sampling distribution NEVER changes — iid uniform draws from a fixed pool of `f*N` of the `N`
 * > frame files — and the cumulative rho climbs monotonically from 0 toward 1 as the corpus grows.
 * > At the fitted `f = 0.40` it passes 0.6 at roughly 300 draws per agent, which is where the real
 * > fleet is. **No behaviour changed. The number moved anyway.**
 *
 * The honest limit of that claim, and it is load-bearing: at `f = 1` (agents drawing from the whole
 * declared frame) the cumulative rho stays at ~0 forever. Growth alone does not do it. The drift is
 * `pool restriction x saturation` — so the cumulative rho does carry real information, it just is
 * not a stationary correlation and a fixed two-sided band over it is mis-specified in both
 * directions: the upper bound fails on a timer, and the lower bound recedes out of reach.
 *
 * ## The stationary reparametrisation, and why it must be WINDOWED
 *
 * `fitRestrictedPool` inverts (`c`, observed coverage) into (`saturation x`, `poolFraction f`),
 * where `f` is the corpus-size-free half. `--null-model` verifies both halves of its character:
 *
 * - **invariance** — under constant behaviour `f_hat` recovers the true `f` to ~0.002 while rho
 *   climbs 0.16 -> 0.95. So `f` is the part of the reading that is about the agents.
 * - **change-blindness, when cumulative** — halve the true pool mid-run and cumulative `f_hat`
 *   does not move, because the accumulated union is a ratchet that a later narrowing cannot undo.
 *   A meter with no power is not a safer meter.
 * - **power, when windowed** — over the last `W` draws per agent, `f_hat` steps to the new true
 *   value within one window and windowed rho steps with it, while both stay flat when nothing
 *   changes.
 *
 * So the fix for the mis-specified band is not a different number, it is a different **domain**:
 * window the corpus. `--windowed` is that meter.
 *
 * ## Register (`.claude/rules/toy-is-free-metered-must-be-earned.md`)
 *
 * - **metered** — the per-commit cumulative values. Each is `measure()`'s arithmetic on that
 *   commit's tree and `--verify-head` is the falsifier that it is the same arithmetic.
 * - **metered** — the ratchet property of the cumulative statistic. Its falsifier is
 *   `--null-model`, pinned in `rho-series.test.ts`, and it would die if the statistic were
 *   stationary.
 * - **unmetered** — `fitRestrictedPool` as a description of what the agents are actually doing.
 *   It is a two-parameter model exactly determined by two observables, so the fit itself proves
 *   nothing. Its one out-of-sample check is that it predicts the PAIRWISE overlap it never saw
 *   (117.9 predicted vs 134/118/122 observed at HEAD, ~6%), which is corroboration and not proof.
 *   Do not read `poolFraction` as "the agents literally share a pool of 302 files."
 * - **NOT metered** — any causal attribution of a movement in the series to a fleet event. This is
 *   an observational record with no control arm. It can REFUTE a step-change hypothesis by showing
 *   no step; it cannot CONFIRM one by showing a step.
 *
 * ## Anchors (Beacon)
 *
 * - Efron, B. (1979) *Bootstrap Methods: Another Look at the Jackknife*, Ann. Statist. 7(1) — the
 *   resampling interval. Field, C.A. & Welsh, A.H. (2007) *Bootstrapping clustered data*, JRSS-B
 *   69(3) — the cluster (row) form used here, which is the right one for an ICC-style statistic.
 * - Kish, L. (1965) *Survey Sampling* ch. 5 — the design effect the parent module is built on.
 * - The occupancy/coverage identity behind `fitRestrictedPool` is the classical species-accumulation
 *   shape; Good, I.J. (1953) *The population frequencies of species and the estimation of population
 *   parameters*, Biometrika 40 — the canonical statement that coverage saturates and that
 *   accumulated coverage is not a rate.
 *
 * Usage:
 *   bun src/Core.TypeScript/society/rho-series.ts                    # cumulative series, TSV
 *   bun src/Core.TypeScript/society/rho-series.ts --jsonl            # cumulative series, JSONL
 *   bun src/Core.TypeScript/society/rho-series.ts --windowed 60      # windowed series, TSV
 *   bun src/Core.TypeScript/society/rho-series.ts --verify-head
 *   bun src/Core.TypeScript/society/rho-series.ts --bootstrap 4000 --seed 4
 *   bun src/Core.TypeScript/society/rho-series.ts --null-model
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  AGENTS,
  type Finding,
  effectiveTrialCount,
  iccOneWay,
  measure,
  parseFindings,
  repoRoot,
  rhoFromUnionCoverage,
  universeFromFileList,
} from "./effective-agent-count.ts";

const CORPUS_DIR = "db/mutation-findings";

function git(root: string, args: readonly string[]): string {
  // sonarjs/no-os-command-from-path suppression rationale: as in effective-agent-count.ts — `git`
  // from PATH is the canonical CLI pattern here, argv is an array so no shell evaluation occurs,
  // and every invocation in this file is read-only.
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  return execFileSync("git", [...args], { cwd: root, encoding: "utf8", maxBuffer: 512 * 1024 * 1024 });
}

/** `git show <sha>:<path>`, or `null` when the path did not exist at that commit. */
function showOrNull(root: string, sha: string, path: string): string | null {
  try {
    return git(root, ["show", `${sha}:${path}`]);
  } catch {
    return null;
  }
}

// ── The restricted-pool reparametrisation ────────────────────────────────────────────────────────

export interface PoolFit {
  /** Within-pool coverage reached so far, `x = 1 - (1-1/M)^m`. 0 = just started, 1 = pool exhausted. */
  readonly saturation: number;
  /** `f = M/N`: the fraction of the declared frame the agents behave as if drawing from. */
  readonly poolFraction: number;
}

/**
 * Invert (`meanCompetence`, `observedUnionCoverage`) into (saturation, poolFraction).
 *
 * Model: `k` agents draw iid uniformly from a common pool of `M = f*N` frame files. Then
 * `c = f*x` and `coverage = f*(1-(1-x)^3)`, so `coverage/c = 3 - 3x + x^2` determines `x` and
 * `f = c/x` follows. Two parameters, two observables — the fit is EXACTLY DETERMINED and is
 * therefore a reparametrisation, not a test. It earns its keep only from the out-of-sample check
 * noted in the header (it predicts the pairwise overlap, which it never sees) and from the
 * invariance/power behaviour that `--null-model` demonstrates.
 *
 * Returns NaNs where the observables are outside the model's range (`coverage/c` must lie in
 * [0.75, 3]); a NaN is the honest output for "these numbers are not this model's" and is far
 * better than a clamped number that looks like a measurement.
 */
export function fitRestrictedPool(meanCompetence: number, observedUnionCoverage: number): PoolFit {
  const nan = { saturation: Number.NaN, poolFraction: Number.NaN };
  if (meanCompetence <= 0) return nan;
  const ratio = observedUnionCoverage / meanCompetence;
  const disc = 4 * ratio - 3;
  if (disc < 0) return nan;
  const x = (3 - Math.sqrt(disc)) / 2;
  if (x <= 0) return nan;
  return { saturation: x, poolFraction: meanCompetence / x };
}

// ── Per-commit series ────────────────────────────────────────────────────────────────────────────

export interface Commit {
  readonly sha: string;
  readonly authoredAt: string;
  readonly subject: string;
}

/** Oldest-first, so the series reads left to right in time. */
export function corpusCommits(root: string): readonly Commit[] {
  return git(root, ["log", "--reverse", "--format=%H\t%aI\t%s", "--", CORPUS_DIR])
    .split("\n")
    .filter((l) => l.length > 0)
    .map((l) => {
      const [sha = "", authoredAt = "", ...rest] = l.split("\t");
      return { sha, authoredAt, subject: rest.join("\t") };
    });
}

export interface Point {
  readonly sha: string;
  readonly authoredAt: string;
  readonly frameSize: number;
  readonly drawCounts: readonly number[];
  readonly unionSize: number;
  readonly meanCompetence: number;
  readonly observedUnionCoverage: number;
  readonly rhoFromUnion: number;
  readonly rhoIcc: number;
  readonly effectiveCount: number;
  readonly saturation: number;
  readonly poolFraction: number;
  /** Draws the frame at this commit does NOT contain. Recorded, never filtered — see below. */
  readonly strayDraws: number;
}

/**
 * The sha that means "the working tree as `measure()` sees it" — `git ls-files` for the frame and
 * the on-disk corpus, rather than a commit's tree.
 *
 * This exists because `measure()` reads the INDEX and a historical point necessarily reads a TREE,
 * and on a dirty checkout those are different populations. Discovered by `--verify-head` going red
 * on this branch: adding `rho-series.ts` beside `rho-series.test.ts` created a new source+test pair,
 * so `git ls-files` reported 758 frame files and `git ls-tree HEAD` reported 757. The check was
 * right and the difference was real. Comparing `measure()` against `WORKTREE` makes the parity
 * assertion exact on any tree state; comparing it against `HEAD` would make a correctness test into
 * a cleanliness test, which is how a real falsifier gets deleted for being noisy.
 */
export const WORKTREE = "WORKTREE";

/** The frame at a commit — or, for `WORKTREE`, the frame `measure()` itself enumerates. */
function frameAt(root: string, sha: string): readonly string[] {
  const args = sha === WORKTREE ? ["ls-files"] : ["ls-tree", "-r", "--name-only", sha];
  return universeFromFileList(
    git(root, args)
      .split("\n")
      .filter((l) => l.length > 0),
  );
}

/** The per-agent DISTINCT sources drawn at a commit, optionally restricted to the last `window`. */
function drawsAt(root: string, sha: string, window: number | null): readonly (readonly string[])[] {
  return AGENTS.map((agent) => {
    const text =
      sha === WORKTREE
        ? readFileSync(join(root, CORPUS_DIR, `${agent}.jsonl`), "utf8")
        : showOrNull(root, sha, `${CORPUS_DIR}/${agent}.jsonl`);
    const findings: readonly Finding[] = text === null ? [] : parseFindings(text);
    const slice = window === null ? findings : findings.slice(Math.max(0, findings.length - window));
    return [...new Set(slice.map((f) => f.source))];
  });
}

/**
 * One point of the series, from a commit's tree alone. `window === null` is the CUMULATIVE
 * statistic that `measure()` reports; a number restricts each agent to its last `window` findings.
 *
 * `assertFrameContainsDraws` is deliberately NOT called here, and this is the only place the series
 * departs from `measure()`. That assertion is right for a live measurement — a frame that does not
 * contain the draws is not the population that was sampled — but applied retroactively it would
 * abort the whole series on one renamed file. So the stray count is CARRIED as a column instead: a
 * point with strays stays visible and can be discounted, rather than invisible because the run
 * died. A non-zero `strayDraws` at the tip means the live assertion would fire, which is the louder
 * finding and is checked separately in the test.
 */
export function pointAt(root: string, c: Commit, window: number | null = null): Point {
  const frame = frameAt(root, c.sha);
  const frameSet = new Set(frame);
  const draws = drawsAt(root, c.sha, window);

  let strayDraws = 0;
  const union = new Set<string>();
  for (const d of draws) {
    for (const s of d) {
      if (!frameSet.has(s)) strayDraws++;
      union.add(s);
    }
  }

  const drawCounts = draws.map((d) => d.length);
  const frameSize = frame.length;
  const meanCompetence = drawCounts.reduce((s, n) => s + n, 0) / (AGENTS.length * frameSize);
  const observedUnionCoverage = union.size / frameSize;
  const sets = draws.map((d) => new Set(d));
  const rhoIcc = iccOneWay(sets.map((s) => frame.map((fl) => (s.has(fl) ? 1 : 0))));
  const fit = fitRestrictedPool(meanCompetence, observedUnionCoverage);

  return {
    sha: c.sha,
    authoredAt: c.authoredAt,
    frameSize,
    drawCounts,
    unionSize: union.size,
    meanCompetence,
    observedUnionCoverage,
    rhoFromUnion: rhoFromUnionCoverage(AGENTS.length, meanCompetence, observedUnionCoverage),
    rhoIcc,
    effectiveCount: effectiveTrialCount(AGENTS.length, rhoIcc),
    saturation: fit.saturation,
    poolFraction: fit.poolFraction,
    strayDraws,
  };
}

// ── Bootstrap ────────────────────────────────────────────────────────────────────────────────────

/**
 * Deterministic PRNG (mulberry32) so a reported interval replays exactly — DST, discipline #4. A
 * bootstrap seeded from `Math.random` gives a different interval every run and is therefore not a
 * measurement anyone can check.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface BootstrapResult {
  readonly replicates: number;
  readonly point: number;
  readonly mean: number;
  readonly sd: number;
  readonly p2_5: number;
  readonly p50: number;
  readonly p97_5: number;
  readonly fractionAboveBand: number;
}

/**
 * Cluster (row) bootstrap of `rhoFromUnionCoverage` over the frame.
 *
 * `rows[t]` is one frame file's k-vector of agent indicators. Resampling `N` rows with replacement
 * and recomputing `c`, coverage and rho gives the sampling distribution of rho at the corpus size
 * actually observed — which is what "is a 0.0012 excursion distinguishable from nothing" asks.
 *
 * **Why rows and not findings.** Resampling findings with replacement shrinks each agent's DISTINCT
 * count, so it moves the point estimate systematically; a resampling scheme whose mean disagrees
 * with the statistic is measuring its own bias. Row resampling leaves every marginal and the union
 * correct in expectation, and the run reports `mean` beside `point` so that property is checked and
 * not assumed.
 */
export function bootstrapRhoFromUnion(
  rows: readonly (readonly number[])[],
  agentCount: number,
  replicates: number,
  seed: number,
  bandUpper: number,
): BootstrapResult {
  const n = rows.length;
  const rand = mulberry32(seed);
  const out: number[] = [];

  const rhoOf = (totals: readonly number[], unionCount: number, rowsN: number): number =>
    rhoFromUnionCoverage(agentCount, totals.reduce((s, x) => s + x, 0) / (agentCount * rowsN), unionCount / rowsN);

  const accumulate = (pick: (k: number) => readonly number[]): [number[], number] => {
    const totals = new Array<number>(agentCount).fill(0);
    let union = 0;
    for (let k = 0; k < n; k++) {
      const row = pick(k);
      let any = 0;
      for (let i = 0; i < agentCount; i++) {
        const v = row[i] ?? 0;
        totals[i] = (totals[i] ?? 0) + v;
        any |= v;
      }
      union += any;
    }
    return [totals, union];
  };

  const [obsTotals, obsUnion] = accumulate((k) => rows[k] ?? []);
  const point = rhoOf(obsTotals, obsUnion, n);

  for (let b = 0; b < replicates; b++) {
    const [t, u] = accumulate(() => rows[Math.floor(rand() * n)] ?? []);
    out.push(rhoOf(t, u, n));
  }

  out.sort((x, y) => x - y);
  const q = (p: number): number => out[Math.min(out.length - 1, Math.max(0, Math.floor(p * out.length)))] ?? Number.NaN;
  const mean = out.reduce((s, x) => s + x, 0) / out.length;
  return {
    replicates,
    point,
    mean,
    sd: Math.sqrt(out.reduce((s, x) => s + (x - mean) ** 2, 0) / (out.length - 1)),
    p2_5: q(0.025),
    p50: q(0.5),
    p97_5: q(0.975),
    fractionAboveBand: out.filter((x) => x > bandUpper).length / out.length,
  };
}

/** Frame rows at `HEAD` (or a window of them), for the bootstrap. */
export function headRows(root: string, window: number | null = null): readonly (readonly number[])[] {
  const frame = frameAt(root, WORKTREE);
  const sets = drawsAt(root, WORKTREE, window).map((d) => new Set(d));
  return frame.map((fl) => sets.map((s) => (s.has(fl) ? 1 : 0)));
}

// ── The null model: constant behaviour, growing corpus ───────────────────────────────────────────

export interface NullPoint {
  readonly drawsEach: number;
  readonly unionSize: number;
  readonly cumulativeRho: number;
  readonly cumulativePoolFraction: number;
  readonly windowedRho: number;
  readonly windowedPoolFraction: number;
}

/**
 * Simulate `agentCount` agents drawing iid uniformly from a pool of `poolFractionAt(m)*frameSize`
 * files, and report the cumulative and windowed statistics as the corpus grows.
 *
 * The whole point is that `poolFractionAt` is the ONLY thing that encodes behaviour. Hold it
 * constant and any movement in a reported statistic is an artefact of that statistic.
 */
export function simulateNullModel(
  frameSize: number,
  agentCount: number,
  drawsEach: number,
  poolFractionAt: (m: number) => number,
  seed: number,
  window: number,
  sampleAt: readonly number[],
): readonly NullPoint[] {
  const rand = mulberry32(seed);
  const cumulative = Array.from({ length: agentCount }, () => new Set<number>());
  const history = Array.from({ length: agentCount }, () => [] as number[]);
  const want = new Set(sampleAt);
  const out: NullPoint[] = [];

  const stats = (sets: readonly Set<number>[]): { rho: number; f: number; union: number } => {
    const c = sets.reduce((s, x) => s + x.size, 0) / (agentCount * frameSize);
    const u = new Set<number>();
    for (const s of sets) for (const v of s) u.add(v);
    const cov = u.size / frameSize;
    return { rho: rhoFromUnionCoverage(agentCount, c, cov), f: fitRestrictedPool(c, cov).poolFraction, union: u.size };
  };

  for (let m = 1; m <= drawsEach; m++) {
    const pool = Math.max(1, Math.round(poolFractionAt(m) * frameSize));
    for (let a = 0; a < agentCount; a++) {
      const d = Math.floor(rand() * pool);
      cumulative[a]?.add(d);
      history[a]?.push(d);
    }
    if (!want.has(m)) continue;
    const cum = stats(cumulative as readonly Set<number>[]);
    const win = stats(history.map((h) => new Set(h.slice(Math.max(0, h.length - window)))));
    out.push({
      drawsEach: m,
      unionSize: cum.union,
      cumulativeRho: cum.rho,
      cumulativePoolFraction: cum.f,
      windowedRho: win.rho,
      windowedPoolFraction: win.f,
    });
  }
  return out;
}

// ── Presentation ─────────────────────────────────────────────────────────────────────────────────

const TSV_HEADER = [
  "authoredAt",
  "sha",
  "frameSize",
  ...AGENTS.map((a) => `${a}Draws`),
  "unionSize",
  "meanCompetence",
  "observedUnionCoverage",
  "rhoFromUnion",
  "rhoIcc",
  "effectiveCount",
  "saturation",
  "poolFraction",
  "strayDraws",
].join("\t");

export function toTsvRow(p: Point): string {
  return [
    p.authoredAt,
    p.sha,
    String(p.frameSize),
    ...p.drawCounts.map((n) => String(n)),
    String(p.unionSize),
    p.meanCompetence.toFixed(8),
    p.observedUnionCoverage.toFixed(8),
    p.rhoFromUnion.toFixed(8),
    p.rhoIcc.toFixed(8),
    p.effectiveCount.toFixed(8),
    p.saturation.toFixed(8),
    p.poolFraction.toFixed(8),
    String(p.strayDraws),
  ].join("\t");
}

function verifyHead(root: string): number {
  const live = measure(root);
  const mine = pointAt(root, { sha: WORKTREE, authoredAt: "", subject: "" });
  const checks: readonly (readonly [string, number, number])[] = [
    ["frameSize", live.frameSize, mine.frameSize],
    ["meanCompetence", live.meanCompetence, mine.meanCompetence],
    ["observedUnionCoverage", live.observedUnionCoverage, mine.observedUnionCoverage],
    ["rhoFromUnion", live.rhoFromUnion, mine.rhoFromUnion],
    ["rhoIcc", live.rhoIcc, mine.rhoIcc],
  ];
  let bad = 0;
  for (const [name, a, b] of checks) {
    if (a !== b) bad++;
    console.log(`  ${a === b ? "OK  " : "FAIL"} ${name.padEnd(24)} measure()=${String(a)}  series=${String(b)}`);
  }
  console.log(bad === 0 ? "  series == measure() at HEAD, bit for bit" : "  MISMATCH — refusing to report a trend");
  return bad;
}

function numArg(argv: readonly string[], flag: string, dflt: number): number {
  const i = argv.indexOf(flag);
  if (i < 0) return dflt;
  const v = Number(argv[i + 1]);
  return Number.isFinite(v) ? v : dflt;
}

if (import.meta.main) {
  const root = repoRoot();
  const argv = process.argv;
  let did = false;

  if (argv.includes("--verify-head")) {
    did = true;
    if (verifyHead(root) > 0) process.exit(1);
  }

  if (argv.includes("--bootstrap")) {
    did = true;
    const reps = numArg(argv, "--bootstrap", 4000);
    const seed = numArg(argv, "--seed", 4);
    const w = argv.includes("--windowed") ? numArg(argv, "--windowed", 60) : null;
    console.log(
      JSON.stringify(
        { window: w, seed, bootstrap: bootstrapRhoFromUnion(headRows(root, w), AGENTS.length, reps, seed, 0.6) },
        null,
        2,
      ),
    );
  }

  if (argv.includes("--null-model")) {
    did = true;
    const at = [60, 120, 180, 240, 300, 360, 420, 600, 900];
    const scenarios: readonly (readonly [string, (m: number) => number])[] = [
      ["f = 1.00 constant (agents draw from the WHOLE frame)", () => 1],
      ["f = 0.40 constant (the value fitted at HEAD)", () => 0.4],
      ["f = 0.40 -> 0.20 at m = 300 (a REAL narrowing)", (m) => (m <= 300 ? 0.4 : 0.2)],
    ];
    for (const [label, fn] of scenarios) {
      console.log(`\n${label}`);
      console.log("  m\tunion\tcumRho\tcumF\twinRho\twinF");
      for (const p of simulateNullModel(757, 3, 900, fn, 4, 60, at)) {
        console.log(
          `  ${String(p.drawsEach)}\t${String(p.unionSize)}\t${p.cumulativeRho.toFixed(3)}\t` +
            `${p.cumulativePoolFraction.toFixed(3)}\t${p.windowedRho.toFixed(3)}\t${p.windowedPoolFraction.toFixed(3)}`,
        );
      }
    }
  }

  if (!did || argv.includes("--series")) {
    const w = argv.includes("--windowed") ? numArg(argv, "--windowed", 60) : null;
    const points = corpusCommits(root).map((c) => pointAt(root, c, w));
    if (argv.includes("--jsonl")) for (const p of points) console.log(JSON.stringify(p));
    else {
      console.log(TSV_HEADER);
      for (const p of points) console.log(toTsvRow(p));
    }
  }
}
