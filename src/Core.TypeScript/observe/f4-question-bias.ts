#!/usr/bin/env bun
/**
 * f4-question-bias.ts — WHICH properties of a question move the answer, and by how much?
 *
 * STATUS: toy. Falsifiers live in `f4-question-bias.test.ts`; the register for every
 * number is fixed in `docs/research/2026-08-26-*` before any of them were computed.
 *
 * ## What F3/E1 established, and what it did not
 *
 * `f3-hat-choice-decorrelation.ts` E1 showed that REWORDING an elicitation moves the
 * choice distribution — 5/5 cells, permutation p = 0.0005, effective variety swinging
 * 4.1x-14.5x on phrasing alone. That the effect EXISTS is settled. What drives it is
 * not: E1's six phrasings each varied several properties at once, so no per-property
 * number is recoverable from it.
 *
 * F4 is the attribution experiment. Every comparison is a PAIR of prompts differing in
 * exactly ONE named property, so the measured shift is attributable to that property.
 *
 * ## The control that decides whether any of it means anything
 *
 * Three NULL AXES vary something that should not matter — whitespace, a synonym that
 * preserves presupposition and answer space, and the order of two independent clauses.
 * If cosmetic rewording moves the distribution as much as semantic reframing, the
 * effect is not "framing", it is INSTABILITY, and every per-axis number below is noise
 * wearing a decimal point. That is a different and worse finding and it is reachable:
 * the null axes are evaluated FIRST and the gate is precommitted.
 *
 * A CALIBRATION pair sits under the null axes: the anchor prompt against ITSELF on a
 * disjoint seed block. Identical text, sampler noise only. If the instrument cannot
 * read zero there it is not measuring divergence and nothing else is reportable. Note
 * the seed blocks must be DISJOINT — comparing a prompt to itself on the same seeds
 * yields JSD = 0 by construction, which is a check that cannot fail.
 *
 * ## Two numbers, never one
 *
 * A question can move WHERE the answers land without changing HOW MANY distinct
 * answers there are, and vice versa. Reporting one merged "bias score" would hide
 * that, so location (excess Jensen-Shannon divergence) and variety (Hill N1 ratio)
 * are reported side by side and are never summed.
 *
 * ## Defects in the F1/F2 harness NOT inherited (verified in F3, re-verified here)
 *
 * - `AxisMeasurement.gain`'s denominator says energy and is a hardcoded constant `2`;
 *   the latency fields that ARE collected are never read by `measureAxis`. No GAIN is
 *   computed here and no cost term is claimed. Wall-clock is recorded in the raw JSONL
 *   and labelled latency; it is not used as a denominator for anything.
 * - `pipelineAccuracy` is the oracle-best union of correct sets, assuming a free
 *   winner-picker. There is no accuracy metric in F4 at all — the dependent variable is
 *   a distribution over free-text answers, and there is no correct answer to an
 *   elicitation of a preference. That is the point of eliciting rather than inferring.
 *
 * ## Beacon anchors
 *
 * - **Response alternatives / range-frequency**: Schwarz, Hippler, Deutsch & Strack
 *   (1985), *Response scales: Effects of category range on reported behavior and
 *   comparative judgments*, Public Opinion Quarterly 49. Offering example answers moves
 *   the reported distribution even when respondents are free to answer otherwise. The
 *   PRIME axis is this effect, in-medium.
 * - **Presupposition in question wording**: Loftus & Zanni (1975), *Eyewitness
 *   testimony: The influence of the wording of a question*, Bull. Psychonomic Soc. 5 —
 *   the definite/indefinite article manipulation. The PRESUP axis cancels an existence
 *   presupposition with "if any", the standard minimal edit.
 * - **Response-order effects**: Krosnick & Alwin (1987), *An evaluation of a cognitive
 *   theory of response-order effects in survey measurement*, Public Opinion Quarterly
 *   51 — primacy in visual presentation, recency in auditory. The OPTORDER axis.
 * - **Acquiescence / politeness**: Krosnick (1991), *Response strategies for coping
 *   with the cognitive demands of attitude measures in surveys*, Applied Cognitive
 *   Psychology 5 (satisficing). The POLITE and LENGTH axes probe it.
 * - **Measuring the user experience**: Tullis & Albert (2008) — the anchor already
 *   carried by `.claude/rules/engagement-profiles-public-work-only-not-surveillance-dossiers.md`
 *   for non-biased elicitation. F4 does not assume it transfers to LLMs; it measures
 *   whether the effects it describes are present in this medium.
 * - **Jensen-Shannon divergence**: Lin (1991). **Hill numbers**: Hill (1973).
 *   **Holm step-down correction**: Holm (1979), *A simple sequentially rejective
 *   multiple test procedure*, Scand. J. Statist. 6.
 *
 * The anchors above are HUMAN-PANEL results. Citing them does not establish that they
 * hold for a language model — that entailment gap is exactly what this file measures,
 * and until it does the citations license an investigation, not a claim.
 */

import {
  canonAtom,
  canonWords,
  hillN1,
  jensenShannonDivergence,
  makeRng,
  tally,
  type Distribution,
} from "./f3-hat-choice-decorrelation";

// ═══ Prompt inventory ════════════════════════════════════════════════════════

export interface Prompt {
  readonly id: string;
  readonly text: string;
  /** Whitespace-only override of the domain suffix — used by the NULL-WS axis. */
  readonly suffixOverride?: string;
}

/**
 * `calibration` — identical text, disjoint seeds. The instrument's zero.
 * `null`        — a cosmetic edit that MUST NOT move the distribution.
 * `semantic`    — a named property of the question, expected to move it.
 * `combo`       — two semantic axes applied together; tests additivity.
 */
export type AxisKind = "calibration" | "null" | "semantic" | "combo";

export interface AxisPair {
  readonly axis: string;
  readonly kind: AxisKind;
  readonly left: string;
  readonly right: string;
  /** For `combo`: the two semantic axes whose excesses are summed as the prediction. */
  readonly combineOf?: readonly [string, string];
  /** A stated caveat that travels with the number wherever it is reported. */
  readonly caveat?: string;
}

export interface DomainSpec {
  readonly id: string;
  readonly suffix: string;
  readonly prompts: readonly Prompt[];
  readonly pairs: readonly AxisPair[];
}

/**
 * Verbose padding for the LENGTH axis. Deliberately near-contentless — it adds words
 * without adding a frame. It is not PERFECTLY contentless (it signals "standardised,
 * repeatedly asked"), and that residual is named in the bias ledger rather than
 * pretended away.
 */
const PAD =
  " This question is being asked as part of a standard set of questions," +
  " and it is being asked in the same way it is asked every other time it is asked.";

/**
 * Whitespace ONLY: one extra newline after the question. No character that is not
 * whitespace differs between a prompt and its WS variant.
 */
function whitespaceVariant(suffix: string): string {
  return suffix.replace("\n\n", "\n\n\n");
}

// ── Domain R: role self-selection (the F3/E1 domain, so the two connect) ──────

const R_SUFFIX = "\n\nAnswer with a short role name only (1-4 words). No explanation.\n\nRole:";
const R_A = "What role would you choose for yourself?";
const R_TEAM = "You are joining a group of other agents. What role would you choose for yourself?";
const R_PRIME_TAIL = " Some agents pick things like navigator, archivist, or referee.";

const DOMAIN_R: DomainSpec = {
  id: "role",
  suffix: R_SUFFIX,
  prompts: [
    { id: "A", text: R_A },
    // Byte-identical to A. The calibration pair — the difference is the seed block.
    { id: "A2", text: R_A },
    { id: "WS", text: `${R_A} `, suffixOverride: whitespaceVariant(R_SUFFIX) },
    { id: "SYN", text: "What role would you pick for yourself?" },
    { id: "CLA-L", text: `Nothing has been assigned yet, and every role is open. ${R_A}` },
    { id: "CLA-R", text: `Every role is open, and nothing has been assigned yet. ${R_A}` },
    { id: "PRESUP", text: "What role, if any, would you choose for yourself?" },
    { id: "IDENTITY", text: "Who are you?" },
    { id: "TEAM", text: R_TEAM },
    { id: "PRIME", text: `${R_A}${R_PRIME_TAIL}` },
    { id: "CLOSED", text: `Choose one of: navigator, archivist, referee, builder, scout. ${R_A}` },
    { id: "CLOSED-REV", text: `Choose one of: scout, builder, referee, archivist, navigator. ${R_A}` },
    { id: "PERSON", text: "What role would an agent choose for itself?" },
    { id: "POLITE", text: "Could you please tell me what role you would choose for yourself?" },
    { id: "LENGTH", text: `${R_A}${PAD}` },
    { id: "X-TEAM-PRIME", text: `${R_TEAM}${R_PRIME_TAIL}` },
    { id: "X-TEAM-LENGTH", text: `${R_TEAM}${PAD}` },
    { id: "X-PRIME-POLITE", text: `Could you please tell me what role you would choose for yourself?${R_PRIME_TAIL}` },
  ],
  pairs: [],
};

// ── Domain P: preference / inner state, NOT about roles ───────────────────────

const P_SUFFIX = "\n\nAnswer with a short phrase only (1-4 words). No explanation.\n\nAnswer:";
const P_A = "What kind of problem would you most want to work on?";
const P_TEAM = "You are joining a group of other agents. What kind of problem would you most want to work on?";
const P_PRIME_TAIL = " Some agents pick things like scheduling, translation, or search.";

const DOMAIN_P: DomainSpec = {
  id: "preference",
  suffix: P_SUFFIX,
  prompts: [
    { id: "A", text: P_A },
    { id: "A2", text: P_A },
    { id: "WS", text: `${P_A} `, suffixOverride: whitespaceVariant(P_SUFFIX) },
    { id: "SYN", text: "What sort of problem would you most want to work on?" },
    { id: "CLA-L", text: `Nothing has been assigned yet, and every problem is available. ${P_A}` },
    { id: "CLA-R", text: `Every problem is available, and nothing has been assigned yet. ${P_A}` },
    { id: "PRESUP", text: "What kind of problem, if any, would you most want to work on?" },
    { id: "IDENTITY", text: "What interests you?" },
    { id: "TEAM", text: P_TEAM },
    { id: "PRIME", text: `${P_A}${P_PRIME_TAIL}` },
    { id: "CLOSED", text: `Choose one of: scheduling, translation, search, forecasting, routing. ${P_A}` },
    { id: "CLOSED-REV", text: `Choose one of: routing, forecasting, search, translation, scheduling. ${P_A}` },
    { id: "PERSON", text: "What kind of problem would an agent most want to work on?" },
    { id: "POLITE", text: "Could you please tell me what kind of problem you would most want to work on?" },
    { id: "LENGTH", text: `${P_A}${PAD}` },
    { id: "X-TEAM-PRIME", text: `${P_TEAM}${P_PRIME_TAIL}` },
    { id: "X-TEAM-LENGTH", text: `${P_TEAM}${PAD}` },
    {
      id: "X-PRIME-POLITE",
      text: `Could you please tell me what kind of problem you would most want to work on?${P_PRIME_TAIL}`,
    },
  ],
  pairs: [],
};

/**
 * The axis pairs. Identical structure in both domains — that is what lets the AXIS
 * RANKING be compared across domains, which is the test of whether the shift is
 * predictable from a property of the question rather than from its subject matter.
 */
export const AXIS_PAIRS: readonly AxisPair[] = [
  { axis: "CALIB-IDENTICAL", kind: "calibration", left: "A", right: "A2" },
  { axis: "NULL-WHITESPACE", kind: "null", left: "A", right: "WS" },
  { axis: "NULL-SYNONYM", kind: "null", left: "A", right: "SYN" },
  { axis: "NULL-CLAUSE-ORDER", kind: "null", left: "CLA-L", right: "CLA-R" },
  { axis: "PRESUPPOSITION", kind: "semantic", left: "A", right: "PRESUP" },
  { axis: "FRAME-IDENTITY", kind: "semantic", left: "A", right: "IDENTITY" },
  { axis: "FRAME-TEAM", kind: "semantic", left: "A", right: "TEAM" },
  { axis: "ANSWER-PRIMING", kind: "semantic", left: "A", right: "PRIME" },
  {
    axis: "CLOSED-ANSWER-SPACE",
    kind: "semantic",
    left: "A",
    right: "CLOSED",
    caveat:
      "The answer space differs BY CONSTRUCTION: one side is open text, the other is a" +
      " five-item menu. A large divergence here is partly definitional and this number" +
      " is NOT comparable to the other axes. It is reported because it is the substrate" +
      " for OPTION-ORDER, which is comparable.",
  },
  { axis: "OPTION-ORDER", kind: "semantic", left: "CLOSED", right: "CLOSED-REV" },
  { axis: "PERSON-3RD", kind: "semantic", left: "A", right: "PERSON" },
  { axis: "POLITENESS", kind: "semantic", left: "A", right: "POLITE" },
  { axis: "LENGTH", kind: "semantic", left: "A", right: "LENGTH" },
  {
    axis: "COMBO-TEAM-PRIME",
    kind: "combo",
    left: "A",
    right: "X-TEAM-PRIME",
    combineOf: ["FRAME-TEAM", "ANSWER-PRIMING"],
  },
  {
    axis: "COMBO-TEAM-LENGTH",
    kind: "combo",
    left: "A",
    right: "X-TEAM-LENGTH",
    combineOf: ["FRAME-TEAM", "LENGTH"],
  },
  {
    axis: "COMBO-PRIME-POLITE",
    kind: "combo",
    left: "A",
    right: "X-PRIME-POLITE",
    combineOf: ["ANSWER-PRIMING", "POLITENESS"],
  },
];

export const DOMAINS: readonly DomainSpec[] = [
  { ...DOMAIN_R, pairs: AXIS_PAIRS },
  { ...DOMAIN_P, pairs: AXIS_PAIRS },
];

export function domainById(id: string): DomainSpec {
  const d = DOMAINS.find((x) => x.id === id);
  if (d === undefined) throw new Error(`unknown domain: ${id}`);
  return d;
}

export function promptText(domain: DomainSpec, prompt: Prompt): string {
  return `${prompt.text}${prompt.suffixOverride ?? domain.suffix}`;
}

/**
 * Seed for (prompt index, replicate). Blocks are DISJOINT across prompts so that no
 * two compared samples share a sampler state — otherwise the calibration pair (which
 * necessarily uses disjoint seeds) would be judged against variant pairs that do not,
 * and the instrument's zero would sit at a different place than everything it judges.
 */
export function seedFor(promptIndex: number, replicate: number): number {
  return promptIndex * 100_000 + replicate + 1;
}

// ═══ Distributions over free-text answers ════════════════════════════════════

/** First line, canonicalised. The unit of VARIETY: one answer = one atom. */
export function answerAtom(raw: string): string {
  return canonAtom(raw.split("\n")[0] ?? "");
}

/** Atom-level distribution — the one Hill N1 is taken over ("effective variety"). */
export function atomDistribution(responses: readonly string[]): Distribution {
  return tally(responses.map(answerAtom).filter((a) => a.length > 0));
}

/**
 * Content-word-bag distribution — the one JSD is taken over.
 *
 * Atom-level JSD saturates on free text (nearly every answer distinct => JSD ~ 1 for
 * BOTH the real comparison and its permutation null, which makes the test
 * uninformative rather than passing). F3 established the word bag as the level that
 * discriminates while staying fully mechanical — no hand-authored archetype lexicon,
 * because a hand lexicon is where an experimenter smuggles in the answer.
 */
export function wordBag(responses: readonly string[]): Distribution {
  const words: string[] = [];
  for (const r of responses) for (const w of canonWords(r.split("\n")[0] ?? "")) words.push(w);
  return tally(words);
}

/** The statistic every pair test is built on: word-bag JSD between two samples. */
export function bagJsd(left: readonly string[], right: readonly string[]): number {
  return jensenShannonDivergence(wordBag(left), wordBag(right));
}

// ═══ The pair measurement ════════════════════════════════════════════════════

export interface PairMeasurement {
  readonly axis: string;
  readonly kind: AxisKind;
  readonly nLeft: number;
  readonly nRight: number;
  /** Raw word-bag JSD, bits. Carries finite-sample bias — do not compare across n. */
  readonly jsd: number;
  /** Mean JSD under label permutation with group sizes held fixed: the bias estimate. */
  readonly nullMean: number;
  /** SD of the permutation null. The estimator's spread, and the CI's half-width source. */
  readonly nullSd: number;
  /**
   * Minimum detectable effect at alpha = 0.05: the null's 95th percentile minus its
   * mean. A non-significant axis moved the distribution by AT MOST about this much —
   * which is what turns "we did not detect it" into a bounded statement rather than an
   * unearned "it is not there".
   */
  readonly mde: number;
  /** jsd - nullMean. THE effect size: the bias cancels because sizes are fixed. */
  readonly excess: number;
  /**
   * `excess +/- 1.96 * nullSd` — a normal-approximation interval whose width comes from
   * the permutation null's own spread.
   *
   * NOT a bootstrap. The first version of this file used a percentile bootstrap that
   * resampled responses with replacement, and the CALIBRATION PAIR caught it: on
   * identical text it returned [0.0123, 0.1498] around a point estimate of 0.0087 — an
   * interval that does not contain what it estimates is wrong, not conservative.
   * Resampling with replacement thins the distinct support of a sparse free-text bag,
   * which inflates every JSD it computes, so the "conservative" direction was not a
   * safety margin but a bias of roughly 0.1 bits applied to every axis alike. It is
   * removed rather than tuned.
   *
   * The interval below is an approximation valid NEAR the null, which is exactly the
   * regime the equivalence test operates in. It is not claimed to be exact for the
   * large semantic effects, and no equivalence claim is made about those.
   */
  readonly excessHi: number;
  readonly excessLo: number;
  /** Permutation p, upper tail. Never 0: the observed labelling is itself a permutation. */
  readonly p: number;
  readonly permutations: number;
  /** Effective variety (Hill order 1 over ANSWER ATOMS), each side. Never merged with JSD. */
  readonly n1Left: number;
  readonly n1Right: number;
  /** n1Right / n1Left. >1 = the right-hand wording OPENS the answer set; <1 = collapses it. */
  readonly varietyRatio: number;
  readonly caveat?: string;
}

export interface MeasureOptions {
  readonly permutations: number;
  readonly seed: number;
}

/**
 * One two-group permutation run, returning everything the null distribution can tell
 * us — not just the p-value.
 *
 * This deliberately re-implements F3's `permutationTest` rather than calling it,
 * because F3 returns only `{observed, pValue, nullMean}` and the equivalence test below
 * needs the null's SPREAD. The shuffle, the tail convention and the `(atLeast + 1) /
 * (n + 1)` p-value are identical, and `f4-question-bias.test.ts` asserts agreement with
 * F3 on the same seed so the two cannot drift apart unnoticed.
 */
export interface PermutationSummary {
  readonly observed: number;
  readonly pValue: number;
  readonly nullMean: number;
  readonly nullSd: number;
  /**
   * Minimum detectable effect: the 95th percentile of the null minus its mean. An
   * effect larger than this would have been called significant; one smaller would not.
   * Reported so "not significant" carries its own power statement instead of being
   * read as "not there".
   */
  readonly mde: number;
  readonly permutations: number;
}

export function permutationSummary(
  groupA: readonly string[],
  groupB: readonly string[],
  statistic: (a: readonly string[], b: readonly string[]) => number,
  permutations: number,
  seed: number,
): PermutationSummary {
  const rng = makeRng(seed);
  const observed = statistic(groupA, groupB);
  const pooled = [...groupA, ...groupB];
  const nA = groupA.length;
  const draws: number[] = [];
  for (let p = 0; p < permutations; p++) {
    const shuffled = [...pooled];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = shuffled[i]!;
      shuffled[i] = shuffled[j]!;
      shuffled[j] = t;
    }
    const v = statistic(shuffled.slice(0, nA), shuffled.slice(nA));
    if (Number.isFinite(v)) draws.push(v);
  }
  if (draws.length === 0 || !Number.isFinite(observed)) {
    return {
      observed,
      pValue: Number.NaN,
      nullMean: Number.NaN,
      nullSd: Number.NaN,
      mde: Number.NaN,
      permutations: draws.length,
    };
  }
  const atLeast = draws.filter((d) => d >= observed).length;
  const mean = draws.reduce((a, b) => a + b, 0) / draws.length;
  const varr = draws.reduce((a, b) => a + (b - mean) * (b - mean), 0) / Math.max(1, draws.length - 1);
  const sorted = [...draws].sort((a, b) => a - b);
  const q95 = sorted[Math.min(sorted.length - 1, Math.floor(0.95 * sorted.length))]!;
  return {
    observed,
    // +1 in both places: the observed labelling is itself a valid permutation, so a
    // p-value of exactly 0 is not attainable and must not be reported.
    pValue: (atLeast + 1) / (draws.length + 1),
    nullMean: mean,
    nullSd: Math.sqrt(varr),
    mde: q95 - mean,
    permutations: draws.length,
  };
}

/** Two-sided normal-approximation half-width on `excess`, from the null's spread. */
const Z975 = 1.959963984540054;

export function measurePair(
  pair: AxisPair,
  left: readonly string[],
  right: readonly string[],
  opts: MeasureOptions,
): PairMeasurement {
  const perm = permutationSummary(left, right, (a, b) => bagJsd(a, b), opts.permutations, opts.seed);
  const excess = perm.observed - perm.nullMean;
  const half = Z975 * perm.nullSd;
  const n1L = hillN1(atomDistribution(left));
  const n1R = hillN1(atomDistribution(right));
  return {
    axis: pair.axis,
    kind: pair.kind,
    nLeft: left.length,
    nRight: right.length,
    jsd: perm.observed,
    nullMean: perm.nullMean,
    nullSd: perm.nullSd,
    mde: perm.mde,
    excess,
    excessLo: excess - half,
    excessHi: excess + half,
    p: perm.pValue,
    permutations: perm.permutations,
    n1Left: n1L,
    n1Right: n1R,
    varietyRatio: n1L > 0 ? n1R / n1L : Number.NaN,
    ...(pair.caveat === undefined ? {} : { caveat: pair.caveat }),
  };
}

// ═══ Multiple comparisons ════════════════════════════════════════════════════

/**
 * Holm (1979) step-down adjusted p-values, returned IN THE INPUT ORDER.
 *
 * Holm rather than Bonferroni: same family-wise error control, uniformly more power,
 * and no independence assumption (which would be false here — every semantic axis
 * shares the same left-hand sample).
 */
export function holmAdjust(pValues: readonly number[]): number[] {
  const m = pValues.length;
  if (m === 0) return [];
  const order = pValues.map((p, i) => ({ p, i })).sort((a, b) => a.p - b.p);
  const adjusted = new Array<number>(m);
  let running = 0;
  for (let k = 0; k < m; k++) {
    const raw = (m - k) * order[k]!.p;
    // Step-down: adjusted p-values must be monotone non-decreasing in rank.
    running = Math.max(running, raw);
    adjusted[order[k]!.i] = Math.min(1, running);
  }
  return adjusted;
}

// ═══ The precommitted gates ══════════════════════════════════════════════════

/**
 * Delta for the equivalence test, in bits of excess JSD. PRECOMMITTED at 0.02 before
 * any F4 generation: JSD is bounded in [0,1], so this is 2% of the instrument's full
 * range. The SAME delta gates the calibration pair, so the threshold is falsifiable in
 * both directions — if the instrument cannot read below 0.02 on identical text, the
 * threshold is refuted rather than the null axes being excused.
 */
export const EQUIVALENCE_DELTA = 0.02;
export const ALPHA = 0.05;

export interface GateReport {
  /** G1: the instrument reads ~zero on identical text (disjoint seeds). */
  readonly calibrationPass: boolean;
  /** G2: no null axis moves the distribution. */
  readonly nullAxesPass: boolean;
  /** G3: at least one semantic axis DOES move it — the instrument is not merely deaf. */
  readonly separationPass: boolean;
  readonly detail: readonly string[];
}

/**
 * G2 is a two-part test because "p >= 0.05" alone accepts the null hypothesis, which
 * no significance test licenses. The equivalence half (upper CI bound below delta) is
 * what actually supports "this did not move", and it is the half that can fail while
 * the p-value looks fine.
 */
export function evaluateGates(measurements: readonly PairMeasurement[]): GateReport {
  const detail: string[] = [];
  const calib = measurements.filter((m) => m.kind === "calibration");
  const nulls = measurements.filter((m) => m.kind === "null");
  const semantic = measurements.filter((m) => m.kind === "semantic");

  let calibrationPass = calib.length > 0;
  for (const c of calib) {
    const ok = c.excess <= EQUIVALENCE_DELTA && c.p >= ALPHA;
    if (!ok) calibrationPass = false;
    detail.push(`G1 ${c.axis}: excess=${c.excess.toFixed(4)} p=${c.p.toFixed(4)} -> ${ok ? "PASS" : "FAIL"}`);
  }

  let nullAxesPass = nulls.length > 0;
  for (const n of nulls) {
    const ok = n.p >= ALPHA && Number.isFinite(n.excessHi) && n.excessHi <= EQUIVALENCE_DELTA;
    if (!ok) nullAxesPass = false;
    detail.push(
      `G2 ${n.axis}: excess=${n.excess.toFixed(4)} ciHi=${n.excessHi.toFixed(4)} p=${n.p.toFixed(4)} -> ${ok ? "PASS" : "FAIL"}`,
    );
  }

  const semanticP = semantic.map((s) => s.p);
  const adj = holmAdjust(semanticP);
  const separationPass = adj.some((p) => p < ALPHA);
  detail.push(`G3 semantic axes below Holm-adjusted alpha: ${adj.filter((p) => p < ALPHA).length}/${adj.length}`);

  return { calibrationPass, nullAxesPass, separationPass, detail };
}

// ═══ Additivity — is the shift PREDICTABLE from the question's features? ═════

export interface AdditivityCheck {
  readonly axis: string;
  readonly predicted: number;
  readonly observed: number;
  readonly ratio: number;
  /** PRECOMMITTED band: [0.8, 1.2] is additive; below is sub-additive (saturating). */
  readonly verdict: "additive" | "sub-additive" | "super-additive" | "undefined";
}

export function checkAdditivity(combo: PairMeasurement, parts: readonly PairMeasurement[]): AdditivityCheck {
  const predicted = parts.reduce((s, p) => s + p.excess, 0);
  const observed = combo.excess;
  if (!Number.isFinite(predicted) || predicted <= 0) {
    return { axis: combo.axis, predicted, observed, ratio: Number.NaN, verdict: "undefined" };
  }
  const ratio = observed / predicted;
  const verdict = ratio < 0.8 ? "sub-additive" : ratio > 1.2 ? "super-additive" : "additive";
  return { axis: combo.axis, predicted, observed, ratio, verdict };
}

// ═══ The protocol: find a minimum-bias formulation by procedure, not by taste ══

export interface CentroidRank {
  readonly promptId: string;
  /** Mean raw JSD from this formulation to every other candidate. Lower = more central. */
  readonly meanJsd: number;
  /**
   * WORST-case divergence to any other candidate — the second number, reported because
   * a formulation can be central on average and still sit far from one whole family of
   * rewordings. Central-on-average is the property the procedure optimises; bounded
   * worst case is the property a user of the procedure actually wants, and they are not
   * the same thing. Ranking on the mean while showing the max is what lets a reader see
   * when the two disagree instead of trusting one number that hid it.
   */
  readonly maxJsd: number;
}

/**
 * Rank candidate formulations by mean divergence to all the others, ascending.
 *
 * The argmin is the formulation whose answer distribution is closest to the consensus
 * of all the ways the question could have been asked. It is NOT "the unbiased
 * question" — no procedure over wordings can find that, because every wording is a
 * wording. It is the one that a re-asking is least likely to move, which is the
 * property a protocol can actually deliver and check.
 *
 * Raw JSD rather than excess: every candidate has the same n by construction, so the
 * finite-sample bias is a near-constant additive term that cancels in the RANKING.
 * That is the only thing this function's output is used for.
 */
export function centroidRank(samples: ReadonlyMap<string, readonly string[]>): CentroidRank[] {
  const ids = [...samples.keys()].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const out: CentroidRank[] = [];
  for (const id of ids) {
    let sum = 0;
    let n = 0;
    let max = 0;
    for (const other of ids) {
      if (other === id) continue;
      const d = bagJsd(samples.get(id)!, samples.get(other)!);
      sum += d;
      if (d > max) max = d;
      n++;
    }
    out.push({ promptId: id, meanJsd: n > 0 ? sum / n : Number.NaN, maxJsd: n > 0 ? max : Number.NaN });
  }
  return out.sort((a, b) => a.meanJsd - b.meanJsd);
}
