/**
 * decorrelation-meter.ts — measure how much agents' tick decisions AGREE beyond chance.
 *
 * The output is a **decorrelation coefficient ∈ [0, 1]** over pairs of agents. That is the
 * whole product. It needs no physics dressing to be useful, and it is load-bearing: the
 * correlated-Condorcet bound `N_eff = N / (1 + (N-1)·rho)` (`src/Bayesian/CondorcetBoundary.fs`)
 * caps effective identity at `1/rho`, and `src/Core/SocietyUsefulWork.fs` records that this
 * society's actual rho is **UNMEASURED**. A meter aimed at that gap is wanted.
 *
 * ## Register: this is `unmetered`→`metered` for the STATISTIC, not for any claim about physics
 *
 * `.claude/rules/toy-is-free-metered-must-be-earned.md`. The falsifiers live in
 * `decorrelation-meter.test.ts`; every branch below has a test that dies when the branch is
 * mutated. Nothing here is promoted past what those tests pin.
 *
 * ## Why there is no CHSH `S` here any more (removed 2026-08-24; it shipped in #14848)
 *
 * The original module mapped the coefficient to `chshS = 2 * (1 + coefficient)` and printed it
 * against the classical bound 2 and the Tsirelson bound 2*sqrt(2). That was removed, and the
 * reasons are recorded rather than deleted, because the *intent* stated in the original header —
 * "measure, never assert 2*sqrt(2)" — was right and is preserved:
 *
 * 1. **A CHSH `S` is not constructible from this input.** CHSH needs FOUR correlators
 *    `E(a,b), E(a,b'), E(a',b), E(a',b')` — two measurement SETTINGS per party, chosen freely and
 *    independently of the source (Bell 1964; Clauser–Horne–Shimony–Holt 1969). Pairwise agreement
 *    between two agents on one tick is ONE correlator with NO settings. No amount of measuring
 *    turns one number into four; the missing structure is not sampling error.
 * 2. **The mapping was where the assertion moved to.** `S = 2(1+c)` is affine and invertible, so
 *    it carries exactly zero information the coefficient does not. Its only effect was to place
 *    2*sqrt(2) at the arbitrary point `c = 0.414` on a scale the mapping itself chose, which makes
 *    any comparison to Tsirelson numerology in the exact sense of
 *    `.claude/rules/numerology-vs-number-theory.md`: a matching number is not an identification.
 * 3. **It was self-refuting.** The original header said "S > 2*sqrt(2): impossible if measured
 *    honestly (flags a metering error)", and its own best case, `coefficient = 1`, produced
 *    `S = 4 > 2.828`. The module documented its ideal output as its own error condition, and the
 *    `"suspicious"` band that was supposed to flag it was unreachable behind a `[0,1]` clamp.
 * 4. **The inference ran backwards relative to the repo's own settled finding.** `src/Core/
 *    DecorrelationMeter.fs` (Soraya adversarial review, 2026-08-02, PR #10010) established that a
 *    passive shared common cause — a shared seed, the same base model — IS a local-hidden-variable
 *    model and therefore sits *at or below* `|S| <= 2`. So `S > 2` convicts a live channel or
 *    superdeterminism; it does **not** certify independence, and `S <= 2` never acquits. The
 *    removed mapping read high S as "genuine independence beyond shared training", which is the
 *    opposite. That F# module is also scoped to **spacelike (concurrent, non-ancestor) pairs
 *    only**, because no-signalling is what makes CHSH valid at all; wall-clock bucketing here is
 *    not that filter.
 * 5. **The ring-corner bridge does not supply the settings either.** `FourCornerOwnership`
 *    (`src/Core.TypeScript/algebra/wset-four-corner-trace.ts`) names weight RINGS — Z, C, R>=0,
 *    Boolean, tropical — not (party x setting) pairs, and refuses the bridge in its own docstring:
 *    the C corner is "an algebraic bridge only ... NOT a claim that this substrate is physically
 *    quantum."
 *
 * The real CHSH instrument in this repo already exists, already carries its soundness caveat, and
 * is scope-limited to what CHSH can actually decide: `src/Core/DecorrelationMeter.fs` +
 * `DecorrelationMetrology.fs`. The general decorrelation instrument is excess-over-null,
 * `src/Core/DecorrelationExcess.fs` / `DecorrelationExcessFusion.fs`. Neither is duplicated here.
 *
 * ## What this coefficient IS — and the one thing it is NOT
 *
 * It is agreement-excess-over-chance on CHOICES, pair-averaged, in the family of Cohen's kappa
 * (Cohen 1960): `excess = (observed_agreement - chance_agreement) / (1 - chance_agreement)`,
 * and `coefficient = 1 - mean(excess)`.
 *
 * **It is NOT the rho in `N_eff`.** `CondorcetBoundary.fs`'s rho is pairwise **error**
 * correlation. This meter has no ground truth, so it cannot see errors: two agents that are both
 * always right agree perfectly and have perfectly uncorrelated errors (they have none). Choice
 * agreement upper-bounds nothing about error agreement without labels. Feeding this number into
 * `N_eff` is a category error until a correctness signal is joined in. Stated here because the
 * temptation is real and the formula is sitting right there.
 *
 * Per `.claude/rules/dual-use-detection-is-neutral-oracle-decides.md` the band names the FACT
 * ("agreement far above chance"), never the intent ("useless redundancy" / "the fleet is a fraud").
 * The reading is the caller's oracle.
 *
 * ## Sources of decorrelation this is aimed at (from the original module, kept)
 *
 * 1. Different model families (qwen vs llama vs phi vs deepseek) — different error modes.
 * 2. Different quantization (Q4 vs Q8 round differently at decision boundaries).
 * 3. Different memories/histories — same model, different context, different priors.
 * 4. Different phase positions (HLC clocks diverge) — same data, different order.
 *
 * NOTE: the `model` field is present in every `tick-reasoning.jsonl` record and is NOT read here.
 * Stratifying the coefficient by (model-family x model-family) is the obvious next measurement and
 * is deliberately left undone rather than half-done.
 *
 * Anchors: Cohen 1960 (kappa, chance-corrected agreement); Condorcet 1785 / Boland 1989
 * (correlated jury theorem); Bell 1964, CHSH 1969, Tsirelson 1980 (what is NOT claimed here).
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stringCompare } from "../collation/collation";

// ═══ Types ════════════════════════════════════════════════════════════════════

export interface TickDecision {
  readonly agent: string;
  readonly at: string;
  readonly chosenIndex: number;
  readonly options: readonly string[];
  readonly fallback: boolean;
}

/** What `loadTickDecisions` saw, so an absent file never reads like an empty one. */
export interface DecisionLoad {
  readonly decisions: readonly TickDecision[];
  /** File could not be opened at all (absent / unreadable). */
  readonly unreadable: boolean;
  /** Lines that did not parse, or parsed into a record this fold cannot use. */
  readonly malformedLines: number;
  /** Well-formed lines dropped because `fallback: true` (the oracle chose, not the model). */
  readonly fallbackLines: number;
}

export interface PairwiseCorrelation {
  readonly agentA: string;
  readonly agentB: string;
  /** How many tick windows were actually compared. */
  readonly sampleSize: number;
  /** Windows skipped because one side had MORE than one decision in the window (ambiguous). */
  readonly ambiguousWindows: number;
  /** Windows skipped because at least one side's menu had fewer than 2 options (no choice made). */
  readonly degenerateWindows: number;
  /** Fraction of compared windows where both chose the same OPTION LABEL. */
  readonly agreementRate: number;
  /** Mean per-window agreement probability under independent uniform choice. */
  readonly expectedByChance: number;
  /** `(agreementRate - expectedByChance) / (1 - expectedByChance)`. NOT clamped. */
  readonly correlationExcess: number;
}

export type DecorrelationBand =
  | "insufficient-data"
  | "agreement-far-above-chance"
  | "agreement-above-chance"
  | "agreement-near-chance"
  | "agreement-at-or-below-chance";

export interface DecorrelationMeasurement {
  /**
   * The measured decorrelation coefficient in [0, 1], or `null` when nothing was measured.
   * NEVER a number when the measurement did not happen — an unmeasured quantity must not look
   * like a measured one (`.claude/rules/toy-is-free-metered-must-be-earned.md`).
   */
  readonly coefficient: number | null;
  /**
   * Mean pairwise agreement excess over chance, UNCLAMPED. Negative means the pairs agreed LESS
   * than independent chance (active anti-correlation), which the clamped `coefficient` cannot
   * express and which is genuinely different from independence.
   */
  readonly meanCorrelationExcess: number | null;
  readonly band: DecorrelationBand;
  readonly pairs: readonly PairwiseCorrelation[];
  /** Total compared windows summed over pairs. */
  readonly totalSamples: number;
  /** What the loader saw. Present even when the measurement failed. */
  readonly load: DecisionLoad;
  readonly summary: string;
}

/** Minimum non-fallback decisions before any coefficient is reported. */
export const MIN_DECISIONS = 6;

/** Tick-window quantization. See `groupByTickWindow` for what this does and does not mean. */
export const DEFAULT_WINDOW_MS = 120_000;

// ═══ Loading ══════════════════════════════════════════════════════════════════

/** True iff `at` parses to a real instant. An unparseable timestamp is malformed, not window 0. */
function hasUsableTimestamp(at: unknown): at is string {
  return typeof at === "string" && Number.isFinite(new Date(at).getTime());
}

/**
 * Load tick decisions from `data/tick-reasoning.jsonl`.
 *
 * One malformed line drops ONE line, never the file. The previous implementation wrapped the
 * whole read+map in a single `try`, so a single unparseable line threw out of `.map` and returned
 * `[]` — 24 valid records silently became 0, and the result was indistinguishable from an absent
 * file. Both facts are now reported in `DecisionLoad` instead of being swallowed.
 */
export function loadTickDecisions(path: string): DecisionLoad {
  let text: string;
  try {
    text = readFileSync(path, "utf-8");
  } catch {
    return { decisions: [], unreadable: true, malformedLines: 0, fallbackLines: 0 };
  }

  const decisions: TickDecision[] = [];
  let malformedLines = 0;
  let fallbackLines = 0;

  for (const line of text.split("\n")) {
    if (line.trim().length === 0) continue;
    let r: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(line);
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        malformedLines++;
        continue;
      }
      r = parsed as Record<string, unknown>;
    } catch {
      malformedLines++;
      continue;
    }

    const agent = r["agent"];
    const chosenIndex = r["chosenIndex"];
    const rawOptions = r["options"];
    const options = Array.isArray(rawOptions) ? rawOptions.filter((o): o is string => typeof o === "string") : [];
    if (
      typeof agent !== "string" || agent.length === 0 ||
      !hasUsableTimestamp(r["at"]) ||
      typeof chosenIndex !== "number" || !Number.isInteger(chosenIndex) ||
      !Array.isArray(rawOptions) || options.length !== rawOptions.length ||
      chosenIndex < 0 || chosenIndex >= options.length
    ) {
      malformedLines++;
      continue;
    }

    if (r["fallback"] === true) { fallbackLines++; continue; }
    decisions.push({ agent, at: r["at"], chosenIndex, options, fallback: false });
  }

  return { decisions, unreadable: false, malformedLines, fallbackLines };
}

// ═══ Grouping ═════════════════════════════════════════════════════════════════

/**
 * Quantize decisions into fixed tick windows of `windowMs`, keyed by `floor(t / windowMs)`.
 *
 * HONEST NAME. This is NOT "decisions within windowMs of each other" — the previous docstring
 * said that and it was false. Fixed-offset bucketing is not a proximity relation: two decisions
 * 1 ms apart across a bucket edge land in different windows and are never compared, while two
 * decisions 119 s apart inside one bucket are treated as simultaneous. Left as bucketing on
 * purpose — switching to a clustering relation is a semantics decision for the module's owner,
 * not a bug fix, and a clustering relation is not transitive so it needs its own design.
 *
 * Deterministic: bucket assignment is order-independent, and the within-bucket order is fixed by
 * `stringCompare` (code-point ORDINAL, the repo's treaty collation) so the fold is DST-replayable
 * and identical across oracles. Never `localeCompare`
 * (`.claude/rules/culture-invariant-by-default.md`).
 */
export function groupByTickWindow(
  decisions: readonly TickDecision[],
  windowMs: number = DEFAULT_WINDOW_MS,
): Map<string, TickDecision[]> {
  const groups = new Map<string, TickDecision[]>();
  const sorted = [...decisions].sort((a, b) => stringCompare(a.at, b.at));

  for (const d of sorted) {
    const bucket = Math.floor(new Date(d.at).getTime() / windowMs).toString();
    const list = groups.get(bucket) ?? [];
    list.push(d);
    groups.set(bucket, list);
  }

  return groups;
}

// ═══ Pairwise ═════════════════════════════════════════════════════════════════

/**
 * Chance agreement for two independent uniform choices over the given menus, compared BY LABEL:
 * `|A ∩ B| / (|A| · |B|)`. Reduces to `1/m` for identical menus of size `m`, and is 0 for
 * disjoint menus (they cannot agree, so agreeing means nothing).
 *
 * The previous implementation used `1 / mean(|A|, |B|)`, which is wrong whenever the menus differ
 * in size or content and biases `expectedByChance` upward, which biases the reported decorrelation
 * upward — i.e. it flattered the fleet.
 */
export function chanceAgreement(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  let shared = 0;
  for (const o of new Set(a)) if (setB.has(o)) shared++;
  return shared / (a.length * b.length);
}

/**
 * Pairwise agreement between two agents over the tick windows.
 *
 * Three refusals, all soundness-biased (no reading beats a fabricated one — the same stance as
 * `DecorrelationMeter.fs`'s "no probe on a pair's end ⇒ that pair is skipped"):
 *
 *  - **Ambiguous window.** If either agent decided more than once in a window there is no single
 *    concurrent decision to compare. The previous implementation used `Array.find`, silently
 *    taking the first and discarding the rest.
 *  - **Degenerate menu.** A menu of fewer than 2 options is a forced move, not a choice. The
 *    previous implementation gave a `1 - expectedByChance` denominator of 0, returned excess 0,
 *    and so scored two agents who *could not possibly disagree* as PERFECTLY DECORRELATED
 *    (coefficient 1.0, band "strongly-independent"). That inversion is the sharpest defect this
 *    file had.
 *  - **Disjoint menus.** Chance agreement 0 with no shared label: agreement carries no signal.
 *
 * Agreement compares the chosen OPTION LABEL, not the raw index. Indices are only comparable
 * inside one menu; the previous implementation compared `chosenIndex` across menus it had already
 * measured to be different sizes, so agent A choosing "ship" and agent B choosing "delete-prod"
 * both at index 0 scored as perfect agreement.
 */
export function computePairwise(
  agentA: string,
  agentB: string,
  groups: ReadonlyMap<string, readonly TickDecision[]>,
): PairwiseCorrelation {
  let agreements = 0;
  let comparisons = 0;
  let ambiguousWindows = 0;
  let degenerateWindows = 0;
  let totalChance = 0;

  for (const [, decisions] of groups) {
    const forA = decisions.filter((d) => d.agent === agentA);
    const forB = decisions.filter((d) => d.agent === agentB);
    if (forA.length === 0 || forB.length === 0) continue;
    if (forA.length > 1 || forB.length > 1) { ambiguousWindows++; continue; }

    const dA = forA[0] as TickDecision;
    const dB = forB[0] as TickDecision;
    if (dA.options.length < 2 || dB.options.length < 2) { degenerateWindows++; continue; }

    const chance = chanceAgreement(dA.options, dB.options);
    if (chance <= 0) { degenerateWindows++; continue; }

    comparisons++;
    totalChance += chance;
    if (dA.options[dA.chosenIndex] === dB.options[dB.chosenIndex]) agreements++;
  }

  if (comparisons === 0) {
    return {
      agentA, agentB, sampleSize: 0, ambiguousWindows, degenerateWindows,
      agreementRate: 0, expectedByChance: 0, correlationExcess: 0,
    };
  }

  const agreementRate = agreements / comparisons;
  const expectedByChance = totalChance / comparisons;
  const denominator = 1 - expectedByChance;
  // denominator === 0 requires expectedByChance === 1, which the `options.length < 2` refusal
  // above already excludes; kept as a total guard rather than a reachable branch.
  const correlationExcess = denominator > 0 ? (agreementRate - expectedByChance) / denominator : 0;

  return {
    agentA, agentB, sampleSize: comparisons, ambiguousWindows, degenerateWindows,
    agreementRate, expectedByChance, correlationExcess,
  };
}

// ═══ Fold ═════════════════════════════════════════════════════════════════════

/**
 * Every band, exhaustively. The `Record<DecorrelationBand, true>` makes this a COMPILE ERROR to
 * fall out of date: add a band to the union without listing it here and `tsc` fails. That is half
 * the guard; the other half is `decorrelation-meter.test.ts` §10, which sweeps the coefficient
 * domain and asserts every band in this list is actually produced.
 *
 * Both halves exist because the as-merged module declared a `"suspicious"` band behind a `[0,1]`
 * clamp that made it unreachable — its own comment said "should not happen with the clamp". A
 * branch that cannot fire is not a check.
 */
const BAND_EXHAUSTIVE: Record<DecorrelationBand, true> = {
  "insufficient-data": true,
  "agreement-far-above-chance": true,
  "agreement-above-chance": true,
  "agreement-near-chance": true,
  "agreement-at-or-below-chance": true,
};

export const ALL_BANDS: readonly DecorrelationBand[] =
  Object.keys(BAND_EXHAUSTIVE).sort(stringCompare) as DecorrelationBand[];

export function bandOf(coefficient: number): DecorrelationBand {
  if (coefficient < 0.3) return "agreement-far-above-chance";
  if (coefficient < 0.7) return "agreement-above-chance";
  if (coefficient < 1) return "agreement-near-chance";
  return "agreement-at-or-below-chance";
}

function insufficient(load: DecisionLoad, why: string): DecorrelationMeasurement {
  return {
    coefficient: null,
    meanCorrelationExcess: null,
    band: "insufficient-data",
    pairs: [],
    totalSamples: 0,
    load,
    summary: `INSUFFICIENT DATA — ${why}`,
  };
}

/**
 * Fold a loaded decision set into one measurement. Pure; no filesystem.
 *
 * `coefficient = clamp01(1 - mean(pairwise excess))`. The clamp is on the REPORTED coefficient
 * only; `meanCorrelationExcess` keeps the unclamped value, so anti-correlation (excess < 0) stays
 * visible instead of being flattened onto "perfectly independent" the way it was before.
 */
export function foldDecorrelation(load: DecisionLoad): DecorrelationMeasurement {
  const decisions = load.decisions;
  if (load.unreadable) return insufficient(load, "tick-reasoning.jsonl is absent or unreadable");
  if (decisions.length < MIN_DECISIONS) {
    return insufficient(
      load,
      `need at least ${MIN_DECISIONS} usable non-fallback decisions, have ${decisions.length}` +
      ` (${load.malformedLines} malformed, ${load.fallbackLines} fallback)`,
    );
  }

  const groups = groupByTickWindow(decisions);
  const agents = [...new Set(decisions.map((d) => d.agent))].sort(stringCompare);

  const pairs: PairwiseCorrelation[] = [];
  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      pairs.push(computePairwise(agents[i] as string, agents[j] as string, groups));
    }
  }

  const validPairs = pairs.filter((p) => p.sampleSize > 0);
  if (validPairs.length === 0) {
    return {
      ...insufficient(load, "no comparable tick window — no two agents made one non-degenerate decision in the same window"),
      pairs,
    };
  }

  const meanCorrelationExcess = validPairs.reduce((s, p) => s + p.correlationExcess, 0) / validPairs.length;
  const coefficient = Math.max(0, Math.min(1, 1 - meanCorrelationExcess));
  const totalSamples = validPairs.reduce((s, p) => s + p.sampleSize, 0);

  const summary =
    `decorrelation=${coefficient.toFixed(3)} (excess=${meanCorrelationExcess.toFixed(3)}), ` +
    `band=${bandOf(coefficient)}, ${validPairs.length} pairs, ${totalSamples} windows`;

  return {
    coefficient,
    meanCorrelationExcess,
    band: bandOf(coefficient),
    pairs,
    totalSamples,
    load,
    summary,
  };
}

/**
 * Measure decorrelation from `<repoRoot>/data/tick-reasoning.jsonl`.
 *
 * Returns `coefficient: null` and `band: "insufficient-data"` when nothing was measured. It
 * previously returned `coefficient: 0, band: "correlated"` in that case — so an ABSENT data file
 * reported, in its structured fields, that the fleet was perfectly redundant. Only the prose
 * `summary` said otherwise, and structured consumers do not read prose.
 */
export function measureDecorrelation(repoRoot: string): DecorrelationMeasurement {
  return foldDecorrelation(loadTickDecisions(join(repoRoot, "data", "tick-reasoning.jsonl")));
}

/** Format for logging. */
export function formatDecorrelation(m: DecorrelationMeasurement): string {
  return `[decorrelation] ${m.summary}`;
}
