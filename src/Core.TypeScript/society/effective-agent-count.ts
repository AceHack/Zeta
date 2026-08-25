#!/usr/bin/env bun
/**
 * effective-agent-count.ts — **the first production caller of Kish's effective sample size.**
 *
 * `SocietyUsefulWork.effectiveTrialCount` (src/Core/SocietyUsefulWork.fs) has been shipped, proven
 * and mutation-verified since 2026-08-16 and, until this file, had **zero call sites**: one comment
 * in `tick-dial.ts` pointed at it and nothing invoked it. Every witness count and match count in
 * this repo was therefore a **head count** — 3 agents reported as 3 observations. This module
 * measures the inter-agent correlation over a real corpus and reports what those 3 are actually
 * worth.
 *
 * ## What is measured
 *
 * Three agents (alexa, otto, soraya) run mutation probes and append findings to
 * `db/mutation-findings/<agent>.jsonl`. Each finding names a **source file** it sampled. The
 * sampling unit is the SOURCE, not the (source, test, mutation) triple, because the measurement is
 * source coverage. Different operators applied to the same source and tick remain one sampled
 * source; `sourceIsTheSamplingUnit()` reports those operator collisions so this projection's loss
 * stays visible rather than silently multiplying a source into several draws.
 *
 * ## The universe MUST come from outside the agents' own behaviour
 *
 * This is the load-bearing methodological point and the reason this file enumerates the repo rather
 * than the findings.
 *
 * A Lincoln-Petersen capture-recapture estimate from the observed overlaps alone gives a universe of
 * roughly 230-250 files. Using that would be **circular**: L-P *assumes the two samples are
 * independent*, so estimating N from the overlaps and then testing independence against that N
 * proves exactly nothing — it is a check that cannot fail (`toy-is-free-metered-must-be-earned`, the
 * vacuity class). The estimate is only sound when the sampling frame is fixed by something the
 * agents did not produce.
 *
 * So the frame is enumerated from the committed tree at a named commit: every `.ts` tracked by git
 * that has a distinguishing test — a sibling `.test.ts`, or (for `.claude/hooks/` only) a relocated
 * test under `src/Core.TypeScript/claude-hooks/` per #10559, because bun cannot discover tests under
 * a dot-prefixed path. A mutation with no test to distinguish it is not a probe.
 * That is `N = 703` at the commit this was written against.
 *
 * **Frame validity check, and a correction to the first measurement.** An earlier pass restricted
 * the frame to `src/Core.TypeScript` and got `N = 616`. That frame is wrong, and provably so from
 * the data: 30 of the agents' 362 distinct draws (alexa 13, otto 10, soraya 7) land in `tools/setup`
 * and `tests/cross-verification`, i.e. **outside** it. A frame that does not contain the observed
 * draws is not the population that was sampled, and the resulting rho is biased. The repo-wide frame
 * contains **100%** of every agent's draws; `assertFrameContainsDraws()` enforces that property and
 * FAILS rather than silently dropping an out-of-frame draw.
 *
 * ## The estimator, named, with its assumptions
 *
 * A rho produced by an unnamed method is not a measurement, so:
 *
 * - **Primary: one-way ANOVA intraclass correlation, ICC(1)** (Fisher 1925; Shrout & Fleiss 1979
 *   ICC(1,1)). Rows = the 703 frame files, "raters" = the 3 agents, value = 1 if that agent sampled
 *   that file. `rho = (MSB - MSW) / (MSB + (k-1) MSW)`. This is precisely the quantity Kish's design
 *   effect is defined over: the correlation between two observations drawn from the same cluster.
 * - **Corroborating: mean pairwise phi**, the Pearson product-moment correlation of two binary
 *   indicator vectors. For a balanced exchangeable design ICC(1) and mean pairwise correlation
 *   coincide, so agreement between them is a real (if weak) check that neither is a coding error;
 *   disagreement would mean the marginals are too unequal to treat the agents as exchangeable.
 * - **Independent corroboration from a different statistic: `rhoFromUnionCoverage`**, which inverts
 *   the SHIPPED union formula `expectedSocietyIdentical` against the observed union coverage. It
 *   uses no pairwise information at all, so it is not a restatement of the first two.
 *
 * **Why phi and NOT tetrachoric here** — this repo already ships a tetrachoric estimator
 * (`src/Core.TypeScript/costume-rho/tetrachoric.ts`) and argues at length that phi is the wrong
 * choice there. Both are right, for different targets, and the difference is exactly the
 * numerology-vs-number-theory discipline applied to estimators:
 *
 * - `costume-rho` estimates the latent correlation of an explicit one-factor **Gaussian copula**
 *   (`SocietyUsefulWork.simulateHeterogeneous`), where rho *is* a latent-normal parameter. Phi
 *   attenuates under skewed marginals and would under-report it.
 * - Kish's `deff = 1 + (n-1) rho` is derived from the variance of a **sum of the observations
 *   themselves**: `Var(sum x_i) = sum Var(x_i) + 2 sum_{i<j} Cov(x_i, x_j)`. The rho that appears is
 *   the **product-moment** correlation of the observed variables. Substituting a tetrachoric
 *   coefficient there inflates `deff` and under-reports `nEff` — a different number answering a
 *   question nobody asked. Assumption stated: this treats each agent's per-file indicator as the
 *   observation, so `nEff` is the effective number of agents for **any statistic averaged over
 *   files across agents**.
 *
 * ## Why `rho*(N)` is NOT this meter's band — the connection, stated so it is not re-attempted
 *
 * `rho*(N) = (N-3)/(3(N-1))` (`docs/research/rhostar-analytic-proof.md`, frozen-core SS-A) is the
 * obvious-looking source for a *derived* bound to replace the hardcoded level band that used to
 * sit on this meter, and it is the wrong one. It has been reached for at least twice; the reasons
 * it fails are machine-checked in `rho-star-not-a-gate.ts` + its test, not merely asserted here.
 *
 * 1. **Different aggregation rule.** `rho*` exists only under MAJORITY vote. `rhoFromUnionCoverage`
 *    inverts `expectedSocietyIdentical`, the UNION/OR model, whose shipped gain
 *    `(1-rho)(1-c)(1-(1-c)^(n-1))` is strictly positive for every `rho < 1` — correlation attenuates
 *    it and never reverses it. There is no threshold in this regime to compare against.
 *    (`src/Core/SocietyUsefulWork.fs`; the split is named in the 2026-08-16 wiring doc SS1a-1c.)
 *
 * 2. **Different random variable.** `rho*`'s rho is the correlation of ERROR (was this voter wrong).
 *    This module's rho is the correlation of EXPOSURE (did this agent sample this file). They are not
 *    the same quantity: agents drawing disjoint files can still err identically wherever they
 *    overlap. And the draw here is not a judgement at all — `mutation-runner.ts` `selectTarget` picks
 *    `items[FNV1a(agent) ^ tick % items.length]` from the source+test pairs among files changed in
 *    the last 24 hours, so an agent's identity contributes one fixed 32-bit constant and nothing else.
 *    There is no shared proposition, hence no majority, hence nothing for `rho*` to bound.
 *
 * 3. **`rho` is not a sufficient statistic even where `rho*` does apply.** Two-point exchangeable
 *    mixing laws reverse the majority INSIDE the region `rho*` calls safe (`m = 51`, `rho = 0.2249`
 *    vs `rho*(51) = 0.32`, lift `-0.2744`). By de Finetti the verdict turns on where the mixing law
 *    sits relative to `theta = 1/2`, which a scalar correlation cannot express. `AggregationRule.fs`
 *    already carries the standing instruction: *"No correlation threshold appears here and none
 *    should be added."*
 *
 * 4. **And it could not be satisfied anyway.** `rho*` increases in N to a supremum of 1/3, while the
 *    measured coverage rho is ~0.60. No roster size, finite or infinite, reaches it — so "add a
 *    fourth persona" does not close this gap, though it may be worth doing for other reasons.
 *
 * **And the frame problem is UPSTREAM of the band question entirely.** Reason 2 above is not only an
 * argument against `rho*` — it says the quantity this module bounds is not the quantity its own
 * header declares. The declared universe is 757 frame files; the actual draw pool is the source+test
 * pairs among files changed in the last 24 hours, measured at 4-176 and typically 30-70.
 * `assertFrameContainsDraws` cannot catch that because the churn list is a SUBSET of the declared
 * frame. Three agents hashing into a short shared list collide at a rate set by its length, so this
 * meter substantially reads repo churn breadth — `[ran]` corr(poolFraction, rhoIcc) = -0.8555 over
 * the 741-point series, r^2 ~ 0.73. Consequence to state plainly: **no bound, neither `rho*` nor a
 * re-derived window, is the right answer while the frame is mis-specified** — a correct bound on the
 * wrong quantity is still wrong. Fixing the frame (draw from the declared universe, or record the
 * pool length per tick and condition on it) is the prerequisite; the assertions below are therefore
 * deliberately about ESTIMATOR CONSISTENCY, which is frame-independent, and not about the level.
 *
 * What a level band would have to be derived from is the DOMAIN, not a constant: see
 * `rho-series.ts` and `db/effective-agent-count/`, where a null model with agents whose behaviour
 * never changes still drives cumulative rho from 0.156 to 0.949 as the corpus grows. That is why
 * the level bound is REMOVED rather than re-centred. The 24h-frame finding leftover-on-main
 * #13753 named is still open — cited, not closed. Series depth is leftover-on-main #13785's
 * checked-in TSV (`db/effective-agent-count/rho-series-cumulative.tsv`); the 56756b29
 * shallow-and-blind hatch was a fetch-depth bypass, not a series claim, and is not reintroduced.
 *
 * ## Register (`.claude/rules/toy-is-free-metered-must-be-earned.md`)
 *
 * - **metered** — the rho over THIS corpus at THIS commit. It has a falsifier: the tests in
 *   `effective-agent-count.test.ts` fail if the estimator is perturbed, and the frame-validity
 *   assertion fails if the universe is mis-specified.
 * - **NOT metered, and not claimed** — that this rho generalises to the fleet's future behaviour.
 *   The measurement is entirely **backward-looking**: it records which files agents *did* sample. It
 *   says nothing about forward convergence, nothing about agents not in the corpus, and nothing
 *   about a different task. That limit is printed in this tool's own output, not only here.
 *
 * ## Anchors (Beacon)
 *
 * - Kish, L. (1965) *Survey Sampling*, ch. 5 — the design effect `deff = 1 + (n-1) rho`.
 * - Fisher, R.A. (1925) *Statistical Methods for Research Workers* — the intraclass correlation via
 *   ANOVA mean squares. Shrout, P.E. & Fleiss, J.L. (1979) — the ICC(1,1) one-way form used here.
 * - Yule, G.U. (1912) — the phi coefficient for a 2x2 table.
 * - Lincoln (1930) / Petersen (1896) — capture-recapture, cited above as the estimator this
 *   deliberately does NOT use, and why.
 *
 * Usage:
 *   bun src/Core.TypeScript/society/effective-agent-count.ts
 *   bun src/Core.TypeScript/society/effective-agent-count.ts --json
 */

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// ── The Kish half: TypeScript twin of src/Core/SocietyUsefulWork.fs ──────────────────────────────
//
// These three are ports, not re-derivations. `golden-vectors-effective-agent-count.json` pins them
// against the F# and is replayed by BOTH oracles (this file's test + SocietyUsefulWork.CrossVerify.
// Tests.fs), so the two cannot drift without a red test on one side or the other.

/**
 * **Kish effective sample size** — for the VARIANCE OF A MEAN over correlated trials.
 *
 *   deff = 1 + (n - 1) * rho        nEff = n / deff
 *
 * Endpoints: rho = 0 gives nEff = n (independent); rho = 1 gives nEff = 1 (one observation counted
 * n times). rho is clamped to [0, 1] — negative intraclass correlation is real in survey work
 * (nEff > n) but is not a regime this substrate produces, so it is refused rather than silently
 * extrapolated.
 *
 * **Byte-lockable.** Only IEEE-754 correctly-rounded operations appear (`-`, `*`, `+`, `/`), so
 * every conforming runtime must produce the identical bit pattern. That is why the golden vectors
 * pin this function by exact IEEE-754 hex and not by tolerance.
 */
export function effectiveTrialCount(n: number, rho: number): number {
  if (!Number.isInteger(n)) throw new TypeError(`effectiveTrialCount: n must be an integer, got ${String(n)}`);
  if (n < 1) return 0;
  const r = Math.min(Math.max(rho, 0), 1);
  const deff = 1 + (n - 1) * r;
  return n / deff;
}

/**
 * Expected fraction of facts discovered by a society of n identical agents of competence c under
 * pairwise correlation rho — the shipped union probability.
 *
 *   p = rho*c + (1-rho)*(1 - (1-c)^n)
 *
 * **Tolerance-pinned, not byte-locked**: `Math.pow` is not required to be correctly rounded by
 * IEEE-754 and differs between .NET's libm and a JS engine's in the last ulp. Claiming a hex
 * byte-lock here would be a check that passes on one machine and fails on another for reasons that
 * have nothing to do with the model.
 */
export function unionProbability(n: number, c: number, rho: number): number {
  if (n < 1) return 0;
  const r = Math.min(Math.max(rho, 0), 1);
  return r * c + (1 - r) * (1 - Math.pow(1 - c, n));
}

/**
 * **Union-equivalent agent count** — for the COVERAGE of a union. NOT the Kish count, and it
 * generally disagrees with it in the interior (they agree only at rho = 0 and rho = 1). Kept here
 * because this tool reports both, and reporting only one is how the two questions get conflated.
 *
 *   m = ln(1 - p) / ln(1 - c)
 */
export function unionEquivalentAgentCount(n: number, c: number, rho: number): number {
  if (n < 1 || c <= 0 || c >= 1) return 0;
  const p = unionProbability(n, c, rho);
  if (p >= 1) return n;
  return Math.log(1 - p) / Math.log(1 - c);
}

// ── Estimators ───────────────────────────────────────────────────────────────────────────────────

/** A 2x2 contingency table over the frame: both sampled / only A / only B / neither. */
export interface Table2x2 {
  readonly both: number;
  readonly onlyA: number;
  readonly onlyB: number;
  readonly neither: number;
}

/** Cross-tabulate two agents' draws against the frame. */
export function tabulate(frame: readonly string[], a: ReadonlySet<string>, b: ReadonlySet<string>): Table2x2 {
  let both = 0;
  let onlyA = 0;
  let onlyB = 0;
  let neither = 0;
  for (const f of frame) {
    const inA = a.has(f);
    const inB = b.has(f);
    if (inA && inB) both++;
    else if (inA) onlyA++;
    else if (inB) onlyB++;
    else neither++;
  }
  return { both, onlyA, onlyB, neither };
}

/**
 * Phi coefficient (Yule 1912) — the Pearson product-moment correlation of two binary indicators.
 *
 *   phi = (ad - bc) / sqrt((a+b)(c+d)(a+c)(b+d))
 *
 * Returns 0 for a degenerate table (a marginal of 0 or of N): a variable with no variance has no
 * correlation, and returning NaN here would silently poison the mean.
 */
export function phiCoefficient(t: Table2x2): number {
  const { both: a, onlyA: b, onlyB: c, neither: d } = t;
  const denom = Math.sqrt((a + b) * (c + d) * (a + c) * (b + d));
  if (denom === 0) return 0;
  return (a * d - b * c) / denom;
}

/** Expected overlap of two agents' draws if they had chosen independently: |A| |B| / N. */
export function independenceExpectedOverlap(frameSize: number, sizeA: number, sizeB: number): number {
  if (frameSize <= 0) return 0;
  return (sizeA * sizeB) / frameSize;
}

/**
 * One-way ANOVA intraclass correlation, ICC(1,1) — the PRIMARY estimator.
 *
 * `indicators[i][t]` is 1 if agent i sampled frame file t. Rows are the clusters (files), agents are
 * the within-cluster observations.
 *
 *   MSB = k/(N-1) * sum_t (rowMean_t - grandMean)^2
 *   MSW = 1/(N(k-1)) * sum_t sum_i (x_it - rowMean_t)^2
 *   rho = (MSB - MSW) / (MSB + (k-1) MSW)
 *
 * Assumptions, stated: the k agents are exchangeable (no agent-specific main effect is modelled);
 * files are treated as a random sample of the frame; and the indicator is the observation. The
 * exchangeability assumption is the one that can bite, which is why mean pairwise phi is reported
 * beside it — the two coincide under exchangeability and diverge without it.
 */
export function iccOneWay(indicators: readonly (readonly number[])[]): number {
  const k = indicators.length;
  if (k < 2) return 0;
  const nRows = indicators[0]?.length ?? 0;
  if (nRows < 2) return 0;

  let grandTotal = 0;
  const rowMeans = new Array<number>(nRows);
  for (let t = 0; t < nRows; t++) {
    let s = 0;
    for (let i = 0; i < k; i++) s += indicators[i]?.[t] ?? 0;
    rowMeans[t] = s / k;
    grandTotal += s;
  }
  const grandMean = grandTotal / (nRows * k);

  let ssb = 0;
  for (let t = 0; t < nRows; t++) ssb += k * ((rowMeans[t] ?? 0) - grandMean) ** 2;
  const msb = ssb / (nRows - 1);

  let ssw = 0;
  for (let t = 0; t < nRows; t++) {
    for (let i = 0; i < k; i++) ssw += ((indicators[i]?.[t] ?? 0) - (rowMeans[t] ?? 0)) ** 2;
  }
  const msw = ssw / (nRows * (k - 1));

  const denom = msb + (k - 1) * msw;
  if (denom === 0) return 0;
  return (msb - msw) / denom;
}

/**
 * Invert the shipped union formula for rho given the OBSERVED union coverage — a third estimator
 * that touches no pairwise statistic, so it corroborates rather than restates.
 *
 *   observed = rho*c + (1-rho)*(1-(1-c)^n)   =>   rho = (U0 - observed) / (U0 - c)
 *   where U0 = 1 - (1-c)^n is the rho = 0 (independent) union coverage.
 *
 * Assumption, and it is a real one: identical agents of equal competence c. The three agents here
 * have unequal draw rates, so this estimator is expected to disagree with ICC(1) somewhat — and the
 * size of that disagreement is itself information, which is why it is reported rather than averaged
 * in.
 */
export function rhoFromUnionCoverage(n: number, c: number, observedCoverage: number): number {
  if (n < 1 || c <= 0 || c >= 1) return Number.NaN;
  const independentUnion = 1 - Math.pow(1 - c, n);
  const spread = independentUnion - c;
  if (spread === 0) return Number.NaN;
  return (independentUnion - observedCoverage) / spread;
}

// ── Corpus ───────────────────────────────────────────────────────────────────────────────────────

/** One line of `db/mutation-findings/<agent>.jsonl`. */
export interface Finding {
  readonly source: string;
  readonly test: string;
  readonly mutation: string;
  readonly agent: string;
  readonly tick: number;
  readonly outcome: string;
}

export const AGENTS: readonly string[] = ["alexa", "otto", "soraya"];

/** Repo root — 3 levels up from src/Core.TypeScript/society/. */
export function repoRoot(): string {
  return resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
}

/**
 * The external sampling frame: every git-TRACKED `.ts` with a distinguishing test.
 *
 * Enumerated from `git ls-files` rather than from a directory walk so the frame is a pure function
 * of a commit — untracked scratch files cannot silently enlarge the universe, and the result
 * replays deterministically from the recorded sha (DST, discipline #4).
 *
 * Distinguishing test means a sibling `.test.ts`, except `.claude/hooks/*.ts` whose tests live at
 * `src/Core.TypeScript/claude-hooks/*.test.ts` (#10559: bun does not discover tests under a
 * dot-prefixed path, and `unexecuted-test-files` refuses putting them back).
 */
export function enumerateUniverse(root: string): readonly string[] {
  // sonarjs/no-os-command-from-path suppression rationale: `git` is spawned from PATH, the
  // canonical CLI pattern across Zeta's TS tooling. No argument is caller-supplied — the argv is a
  // literal, passed as an array so no shell evaluation occurs — and the command is read-only.
  // eslint-disable-next-line sonarjs/no-os-command-from-path
  const out = execFileSync("git", ["ls-files"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  return universeFromFileList(out.split("\n").filter((l) => l.length > 0));
}

const CLAUDE_HOOKS_PREFIX = ".claude/hooks/";
const RELOCATED_HOOK_TEST_DIR = "src/Core.TypeScript/claude-hooks/";

function hasDistinguishingTest(sourcePath: string, tracked: ReadonlySet<string>): boolean {
  if (tracked.has(`${sourcePath.slice(0, -3)}.test.ts`)) return true;
  if (sourcePath.startsWith(CLAUDE_HOOKS_PREFIX) && sourcePath.endsWith(".ts")) {
    const base = sourcePath.slice(CLAUDE_HOOKS_PREFIX.length, -3);
    return tracked.has(`${RELOCATED_HOOK_TEST_DIR}${base}.test.ts`);
  }
  return false;
}

/**
 * The frame predicate, factored out of `enumerateUniverse` so it can be applied to a file list
 * obtained some other way — specifically `git ls-tree -r <sha>` for a HISTORICAL commit, which is
 * what `rho-series.ts` needs and what `git ls-files` (working-tree only) cannot give.
 *
 * `enumerateUniverse` is now exactly `universeFromFileList(git ls-files)`, so the time series and
 * the shipped measurement share one definition of the universe by construction rather than by a
 * comment asking you to believe they match.
 */
export function universeFromFileList(files: readonly string[]): readonly string[] {
  const tracked = new Set(files);
  return files
    .filter((p) => p.endsWith(".ts") && !p.endsWith(".test.ts") && !p.endsWith(".d.ts"))
    .filter((p) => hasDistinguishingTest(p, tracked))
    .sort();
}

/** The commit the frame was enumerated at. */
export function frameCommit(root: string): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- see enumerateUniverse above
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
}

export function readFindings(root: string, agent: string): readonly Finding[] {
  const path = join(root, "db", "mutation-findings", `${agent}.jsonl`);
  return parseFindings(readFileSync(path, "utf8"));
}

/**
 * Parse one agent's JSONL corpus from TEXT. Factored out of `readFindings` for the same reason as
 * `universeFromFileList`: the historical series reads the corpus from `git show <sha>:<path>`, not
 * from the working tree, and must parse it with the shipped parser rather than a lookalike.
 */
export function parseFindings(text: string): readonly Finding[] {
  return text
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .map((l) => JSON.parse(l) as Finding);
}

/**
 * Re-derives the "the sampling unit is the SOURCE" claim from the data every run.
 *
 * Returns the number of (tick, source) cells and how many carry more than one operator. The latter
 * is the information discarded by projecting findings onto source coverage, so it belongs in the
 * report. It is an observation over an append-only corpus, not a fixed acceptance threshold.
 */
export function sourceIsTheSamplingUnit(all: readonly Finding[]): { cells: number; multiOperator: number } {
  const cells = new Map<string, Set<string>>();
  for (const f of all) {
    const key = `${String(f.tick)}|${f.source}`;
    let s = cells.get(key);
    if (!s) {
      s = new Set<string>();
      cells.set(key, s);
    }
    s.add(f.mutation);
  }
  let multi = 0;
  for (const s of cells.values()) if (s.size > 1) multi++;
  return { cells: cells.size, multiOperator: multi };
}

/**
 * The frame must contain every observed draw. Throws with the offending paths if it does not.
 *
 * This is the check that caught the `N = 616` frame. It is an assertion and not a filter on purpose:
 * dropping out-of-frame draws would let a wrong universe produce a confident number.
 */
export function assertFrameContainsDraws(
  frame: readonly string[],
  draws: ReadonlyMap<string, ReadonlySet<string>>,
): void {
  const inFrame = new Set(frame);
  const stray: string[] = [];
  for (const [agent, sources] of draws) {
    for (const s of sources) if (!inFrame.has(s)) stray.push(`${agent}: ${s}`);
  }
  if (stray.length > 0) {
    throw new Error(
      `sampling frame does not contain ${String(stray.length)} observed draw(s) — the frame is not ` +
        `the population that was sampled:\n  ${stray.slice(0, 10).join("\n  ")}`,
    );
  }
}

// ── The measurement ──────────────────────────────────────────────────────────────────────────────

export interface PairReport {
  readonly a: string;
  readonly b: string;
  readonly table: Table2x2;
  readonly expectedOverlapUnderIndependence: number;
  readonly overlapRatio: number;
  readonly phi: number;
}

export interface Report {
  readonly commit: string;
  readonly frameSize: number;
  readonly agents: readonly string[];
  readonly drawCounts: readonly number[];
  readonly samplingUnit: { cells: number; multiOperator: number };
  readonly pairs: readonly PairReport[];
  readonly rhoIcc: number;
  readonly rhoMeanPhi: number;
  readonly rhoFromUnion: number;
  readonly meanCompetence: number;
  readonly observedUnionCoverage: number;
  readonly predictedUnionCoverage: number;
  readonly headCount: number;
  readonly effectiveCount: number;
  readonly designEffect: number;
  readonly unionEquivalentCount: number;
}

export function measure(root: string): Report {
  const frame = enumerateUniverse(root);
  const draws = new Map<string, ReadonlySet<string>>();
  const all: Finding[] = [];
  for (const agent of AGENTS) {
    const findings = readFindings(root, agent);
    all.push(...findings);
    draws.set(agent, new Set(findings.map((f) => f.source)));
  }
  assertFrameContainsDraws(frame, draws);

  const indicators = AGENTS.map((a) => {
    const s = draws.get(a) ?? new Set<string>();
    return frame.map((f) => (s.has(f) ? 1 : 0));
  });

  const pairs: PairReport[] = [];
  const roster = [...AGENTS];
  for (const [i, a] of roster.entries()) {
    for (const b of roster.slice(i + 1)) {
      const table = tabulate(frame, draws.get(a) ?? new Set(), draws.get(b) ?? new Set());
      const expected = independenceExpectedOverlap(frame.length, table.both + table.onlyA, table.both + table.onlyB);
      pairs.push({
        a,
        b,
        table,
        expectedOverlapUnderIndependence: expected,
        overlapRatio: expected === 0 ? 0 : table.both / expected,
        phi: phiCoefficient(table),
      });
    }
  }

  const rhoIcc = iccOneWay(indicators);
  const rhoMeanPhi = pairs.reduce((s, p) => s + p.phi, 0) / pairs.length;

  const union = new Set<string>();
  for (const s of draws.values()) for (const f of s) union.add(f);
  const observedUnionCoverage = union.size / frame.length;
  const drawCounts = AGENTS.map((a) => (draws.get(a) ?? new Set()).size);
  const meanCompetence = drawCounts.reduce((s, n) => s + n, 0) / (AGENTS.length * frame.length);

  const headCount = AGENTS.length;
  const effectiveCount = effectiveTrialCount(headCount, rhoIcc);

  return {
    commit: frameCommit(root),
    frameSize: frame.length,
    agents: AGENTS,
    drawCounts,
    samplingUnit: sourceIsTheSamplingUnit(all),
    pairs,
    rhoIcc,
    rhoMeanPhi,
    rhoFromUnion: rhoFromUnionCoverage(headCount, meanCompetence, observedUnionCoverage),
    meanCompetence,
    observedUnionCoverage,
    predictedUnionCoverage: unionProbability(headCount, meanCompetence, rhoIcc),
    headCount,
    effectiveCount,
    designEffect: headCount / effectiveCount,
    unionEquivalentCount: unionEquivalentAgentCount(headCount, meanCompetence, rhoIcc),
  };
}

// ── Presentation ─────────────────────────────────────────────────────────────────────────────────

const f = (x: number, d = 4): string => x.toFixed(d);

export function formatReport(r: Report): string {
  const lines: string[] = [];
  lines.push("effective agent count — inter-agent correlation over db/mutation-findings/");
  lines.push(`  commit                ${r.commit}`);
  lines.push(`  sampling frame        ${String(r.frameSize)} git-tracked .ts files with a distinguishing test`);
  lines.push(`                        (enumerated OUTSIDE the agents' behaviour — see module header)`);
  lines.push(
    `  sampling unit         source file; ${String(r.samplingUnit.multiOperator)}/${String(r.samplingUnit.cells)} ` +
      `(tick,source) cells carry >1 operator`,
  );
  const drawList = r.agents.map((a, i) => `${a}=${String(r.drawCounts[i] ?? 0)}`).join("  ");
  lines.push(`  draws                 ${drawList}`);
  lines.push("");
  lines.push("  pairwise overlap");
  for (const p of r.pairs) {
    lines.push(
      `    ${p.a.padEnd(7)} x ${p.b.padEnd(7)} observed ${String(p.table.both).padStart(3)}   ` +
        `independence predicts ${f(p.expectedOverlapUnderIndependence, 1).padStart(5)}   ` +
        `${f(p.overlapRatio, 2)}x   phi ${f(p.phi)}`,
    );
  }
  lines.push("");
  lines.push("  rho estimates");
  lines.push(`    ICC(1,1), one-way ANOVA   ${f(r.rhoIcc)}   <- PRIMARY (Kish's rho by definition)`);
  lines.push(`    mean pairwise phi         ${f(r.rhoMeanPhi)}   corroborating (equal under exchangeability)`);
  lines.push(`    inverted union coverage   ${f(r.rhoFromUnion)}   independent: uses no pairwise statistic`);
  lines.push(
    `    union coverage observed ${f(r.observedUnionCoverage)} vs model ${f(r.predictedUnionCoverage)} at rho=ICC`,
  );
  lines.push("");
  lines.push("  Kish effective sample size    deff = 1 + (n-1) rho,  nEff = n / deff");
  lines.push(`    head count      ${String(r.headCount)}`);
  lines.push(`    design effect   ${f(r.designEffect)}`);
  lines.push(`    EFFECTIVE COUNT ${f(r.effectiveCount, 3)}`);
  lines.push(
    `    -> ${String(r.headCount)} agents are worth ${f(r.effectiveCount, 2)} independent ones; ` +
      `${f((1 - r.effectiveCount / r.headCount) * 100, 0)}% of the apparent independence is not there.`,
  );
  lines.push("");
  lines.push(`  union-equivalent agent count  ${f(r.unionEquivalentCount, 3)}   (a DIFFERENT question)`);
  lines.push("    coverage of a union, not variance of a mean. Reported beside the Kish count precisely so the");
  lines.push("    two are not conflated; they agree only at rho=0 and rho=1. See SocietyUsefulWork.fs.");
  lines.push("");
  lines.push("  REGISTER");
  lines.push("    metered      the rho above, over THIS corpus at THIS commit. Falsifier: the tests in");
  lines.push("                 effective-agent-count.test.ts go red if the estimator is perturbed.");
  lines.push("    NOT metered  any claim that this rho describes the fleet's FUTURE behaviour. This");
  lines.push("                 measurement is entirely backward-looking — it records which files these");
  lines.push("                 three agents DID sample. It is not evidence about forward convergence,");
  lines.push("                 about agents outside the corpus, or about a different task.");
  return lines.join("\n");
}

if (import.meta.main) {
  const report = measure(repoRoot());
  if (process.argv.includes("--json")) console.log(JSON.stringify(report, null, 2));
  else console.log(formatReport(report));
}
