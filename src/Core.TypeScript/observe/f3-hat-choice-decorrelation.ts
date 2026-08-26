#!/usr/bin/env bun
/**
 * f3-hat-choice-decorrelation.ts — does persona hat-CHOICE decorrelate, or is it ceremony?
 *
 * STATUS: toy until the numbers land (see `toy-is-free-metered-must-be-earned.md`).
 * A new AXIS in the `decorrelation-harness.ts` framework, not a new framework.
 *
 * ## The claim under test
 *
 * Aaron: "we never prompt them, just ask what do they want to be — this is the
 * root of decorrelation." The distinction it rests on: a HAT has direction and
 * prompts; a PERSONA does not, but a persona gets to choose which hats it wears.
 * So an ASSIGNED hat is correlated through its assigner — N reviewers handed hats
 * by one author are N samples of that author's framing. Self-selection is supposed
 * to move the entropy source from the assigner to the chooser.
 *
 * That is a HYPOTHESIS. This file measures it.
 *
 * ## E2 — the control IS the experiment
 *
 *   Condition N (null)     : no hat at all. All agents identical. ρ̄ must be ≈1.
 *                            This is the CALIBRATION FLOOR — if a metric does not
 *                            report ρ̄≈1 here it is not measuring correlation.
 *   Condition A (assigned) : one author instance emits N hats; agent i wears hat A_i.
 *   Condition B (self-sel.): agent i is asked what it wants to be; wears its own answer.
 *
 * Same task, same items, same model, temperature 0 in the WORK phase — so the hat
 * string is the ONLY thing that differs between agents within a condition. The
 * claim is ρ_B < ρ_A, tested with a seeded bootstrap CI on the difference.
 *
 * ## E1 — the falsifier that decides whether "choice" is real
 *
 * "What do you want to be?" is still a prompt. So the elicitation is reworded K
 * ways and the choice distribution is compared across wordings:
 *
 *   If the choice distribution shifts when you reword the question,
 *   the choice was the PROMPT'S, not the persona's.
 *
 * The comparison needs a noise floor or it is unfalsifiable, so cross-phrasing
 * Jensen–Shannon divergence is measured against the WITHIN-phrasing split-half
 * JSD of the same sampler. Cross ≈ split-half ⇒ wording did not move it.
 * Cross ≫ split-half ⇒ the entropy source never moved, it changed hands.
 *
 * ## Two defects in the existing harness this file does NOT inherit
 *
 * 1. `AxisMeasurement.pipelineAccuracy` conflates "got the right answer" with
 *    "correctly declined". Here ACCURACY and ABSTENTION are separate numbers and
 *    are never summed: the item set carries UNANSWERABLE items with an explicit
 *    "-1 = none of these" channel, so abstention precision/recall are measured
 *    rather than folded into an accuracy figure.
 * 2. `AxisMeasurement.gain`'s denominator says energy and measures milliseconds.
 *    Latency is not energy — a 0.5B and a 9B at equal latency differ by more than
 *    an order of magnitude in joules. No GAIN is computed here. Wall-clock is
 *    reported and LABELLED as latency, and a separate FLOP-proxy
 *    (≈2·params·tokens) is reported as the cost denominator, itself labelled a
 *    proxy and not joules — this machine has no unprivileged joule meter.
 *
 * ## Beacon anchors
 *
 * - Hill numbers / effective number of species: Hill (1973), *Diversity and
 *   evenness: a unifying notation and its consequences*. N_eff = exp(H) is Hill
 *   order 1; 1/Σp² is Hill order 2 (inverse Simpson). Raw distinct-count is Hill
 *   order 0 and is the number that flatters — a hundred instances producing three
 *   archetypes with a long thin tail is not a hundred witnesses.
 * - Jensen–Shannon divergence: Lin (1991), *Divergence measures based on the
 *   Shannon entropy*. Bounded in [0,1] with log base 2, symmetric, a true metric
 *   under square root.
 * - Effective sample size under equicorrelation N/(1+(N-1)ρ̄): Kish (1965),
 *   *Survey Sampling* (design effect). The same collapse that kills majority vote.
 * - φ coefficient: Yule/Pearson; the harness's existing correlation statistic,
 *   kept so this axis is comparable with F1/F2.
 */

// ═══ Distributions ════════════════════════════════════════════════════════════

export interface Distribution {
  readonly counts: ReadonlyMap<string, number>;
  readonly total: number;
}

/** Ordinal string comparator — never the platform-default collation. */
export const ordinal = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

export function tally(items: readonly string[]): Distribution {
  const counts = new Map<string, number>();
  for (const it of items) counts.set(it, (counts.get(it) ?? 0) + 1);
  return { counts, total: items.length };
}

/** Shannon entropy in NATS. Empty distribution is 0. */
export function shannonEntropyNats(d: Distribution): number {
  if (d.total === 0) return 0;
  let h = 0;
  for (const c of d.counts.values()) {
    if (c <= 0) continue;
    const p = c / d.total;
    h -= p * Math.log(p);
  }
  return h;
}

/** Hill order 0 — raw distinct count. The number that flatters. */
export function hillN0(d: Distribution): number {
  let n = 0;
  for (const c of d.counts.values()) if (c > 0) n++;
  return n;
}

/** Hill order 1 — exp(H). The effective number of distinct choices. */
export function hillN1(d: Distribution): number {
  if (d.total === 0) return 0;
  return Math.exp(shannonEntropyNats(d));
}

/** Hill order 2 — inverse Simpson, 1/Σp². Weights the head harder than N1. */
export function hillN2(d: Distribution): number {
  if (d.total === 0) return 0;
  let s = 0;
  for (const c of d.counts.values()) {
    const p = c / d.total;
    s += p * p;
  }
  return s > 0 ? 1 / s : 0;
}

/**
 * Jensen–Shannon divergence in BITS (log base 2), so the range is exactly [0,1].
 * 0 = identical distributions; 1 = disjoint support.
 */
export function jensenShannonDivergence(a: Distribution, b: Distribution): number {
  if (a.total === 0 || b.total === 0) return 0;
  const keys = new Set<string>([...a.counts.keys(), ...b.counts.keys()]);
  const log2 = (x: number) => Math.log(x) / Math.LN2;
  let hM = 0;
  let hA = 0;
  let hB = 0;
  for (const k of keys) {
    const pa = (a.counts.get(k) ?? 0) / a.total;
    const pb = (b.counts.get(k) ?? 0) / b.total;
    const pm = (pa + pb) / 2;
    if (pm > 0) hM -= pm * log2(pm);
    if (pa > 0) hA -= pa * log2(pa);
    if (pb > 0) hB -= pb * log2(pb);
  }
  const jsd = hM - (hA + hB) / 2;
  // Clamp float noise; JSD is mathematically in [0,1].
  return jsd < 0 ? 0 : jsd > 1 ? 1 : jsd;
}

/** Split a sample into two interleaved halves — the within-condition noise floor. */
export function splitHalf(items: readonly string[]): readonly [Distribution, Distribution] {
  const even: string[] = [];
  const odd: string[] = [];
  for (let i = 0; i < items.length; i++) (i % 2 === 0 ? even : odd).push(items[i]!);
  return [tally(even), tally(odd)];
}

// ═══ Text canonicalisation (mechanical — no hand-authored archetype lexicon) ═══

/**
 * Level-0 canonical form: lowercase (locale-independent in JS), strip punctuation,
 * collapse whitespace. NO semantic clustering — a hand lexicon is where an
 * experimenter smuggles in the answer.
 */
export function canonAtom(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/["'`*_#.,:;!?()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const STOPWORDS = new Set([
  "a",
  "an",
  "the",
  "of",
  "and",
  "or",
  "to",
  "for",
  "i",
  "am",
  "is",
  "be",
  "my",
  "want",
  "role",
  "name",
  "as",
  "in",
  "on",
  "with",
  "would",
  "like",
  "you",
  "it",
]);

/**
 * Level-1 canonical form: the CONTENT-WORD BAG. Atom-level distributions over
 * free-text role names saturate (nearly every sample distinct ⇒ JSD ≈ 1 for both
 * the cross-phrasing comparison AND the split-half floor, which makes the test
 * uninformative rather than passing). The word-level distribution is dense enough
 * to discriminate and is still fully mechanical.
 */
export function canonWords(raw: string): readonly string[] {
  return canonAtom(raw)
    .split(" ")
    .filter((w) => w.length > 1 && !STOPWORDS.has(w));
}

// ═══ Pairwise correlation over agent answer vectors ═══════════════════════════

export interface PairwisePhi {
  /** Mean φ over pairs where φ is defined. */
  readonly phi: number;
  readonly definedPairs: number;
  /** Pairs where one agent had zero variance in correctness — φ undefined, EXCLUDED. */
  readonly undefinedPairs: number;
}

/**
 * Mean pairwise φ over binary correctness vectors, one per agent.
 *
 * φ is UNDEFINED when either agent has zero variance (all-right or all-wrong).
 * Those pairs are excluded and COUNTED, never silently coerced to 0 — a
 * degenerate pair scored as "uncorrelated" is exactly the vacuity class.
 */
export function meanPairwisePhi(vectors: readonly (readonly boolean[])[]): PairwisePhi {
  let sum = 0;
  let defined = 0;
  let undefinedPairs = 0;
  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      const x = vectors[i]!;
      const y = vectors[j]!;
      const n = Math.min(x.length, y.length);
      let a = 0; // both right
      let b = 0; // i right, j wrong
      let c = 0; // i wrong, j right
      let d = 0; // both wrong
      for (let k = 0; k < n; k++) {
        if (x[k] && y[k]) a++;
        else if (x[k] && !y[k]) b++;
        else if (!x[k] && y[k]) c++;
        else d++;
      }
      const denom = (a + b) * (c + d) * (a + c) * (b + d);
      if (denom === 0) {
        undefinedPairs++;
        continue;
      }
      sum += (a * d - b * c) / Math.sqrt(denom);
      defined++;
    }
  }
  return {
    phi: defined > 0 ? sum / defined : Number.NaN,
    definedPairs: defined,
    undefinedPairs,
  };
}

/**
 * Mean pairwise ANSWER agreement — fraction of items on which two agents emitted
 * the identical answer. Always defined (unlike φ), and a more direct read of
 * "are these N agents one witness or N witnesses". `null` = unparseable reply;
 * two nulls count as agreement on "produced nothing usable".
 */
export function meanPairwiseAnswerAgreement(vectors: readonly (readonly (number | null)[])[]): number {
  let sum = 0;
  let pairs = 0;
  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      const x = vectors[i]!;
      const y = vectors[j]!;
      const n = Math.min(x.length, y.length);
      if (n === 0) continue;
      let same = 0;
      for (let k = 0; k < n; k++) if (x[k] === y[k]) same++;
      sum += same / n;
      pairs++;
    }
  }
  return pairs > 0 ? sum / pairs : Number.NaN;
}

/**
 * Kish design-effect effective sample size under equicorrelation.
 * ρ̄=0 ⇒ N witnesses. ρ̄=1 ⇒ 1 witness. Negative ρ̄ is clamped at N.
 */
export function effectiveN(n: number, rhoBar: number): number {
  if (n <= 1) return n;
  const denom = 1 + (n - 1) * rhoBar;
  if (denom <= 0) return n;
  const eff = n / denom;
  return eff > n ? n : eff;
}

// ═══ Accuracy and abstention — TWO numbers, never one ════════════════════════

export interface AnswerScores {
  /** Correct / answerable. Unanswerable items are NOT in this denominator. */
  readonly accuracy: number;
  readonly answerable: number;
  /** Of the abstentions emitted, the fraction that were on unanswerable items. */
  readonly abstentionPrecision: number;
  /** Of the unanswerable items, the fraction abstained on. */
  readonly abstentionRecall: number;
  readonly abstentionsEmitted: number;
  readonly unanswerable: number;
}

export interface ScoredItem {
  /** The agent's reply. `-1` = abstain ("none of these"); `null` = unparseable. */
  readonly answer: number | null;
  /** `null` when the item is unanswerable — no option is correct. */
  readonly correctIndex: number | null;
}

/**
 * Accuracy and abstention scored SEPARATELY. A correct decline is never counted
 * as a correct answer: it lands in abstentionPrecision/Recall and nowhere else.
 */
export function scoreAnswers(items: readonly ScoredItem[]): AnswerScores {
  let answerable = 0;
  let correct = 0;
  let unanswerable = 0;
  let abstained = 0;
  let abstainedOnUnanswerable = 0;
  for (const it of items) {
    const isAbstain = it.answer === -1;
    if (isAbstain) abstained++;
    if (it.correctIndex === null) {
      unanswerable++;
      if (isAbstain) abstainedOnUnanswerable++;
    } else {
      answerable++;
      if (it.answer === it.correctIndex) correct++;
    }
  }
  return {
    accuracy: answerable > 0 ? correct / answerable : Number.NaN,
    answerable,
    abstentionPrecision: abstained > 0 ? abstainedOnUnanswerable / abstained : Number.NaN,
    abstentionRecall: unanswerable > 0 ? abstainedOnUnanswerable / unanswerable : Number.NaN,
    abstentionsEmitted: abstained,
    unanswerable,
  };
}

// ═══ Cost — a FLOP proxy, explicitly NOT joules ══════════════════════════════

/**
 * Forward-pass FLOP proxy ≈ 2 · params · tokens (Kaplan et al. 2020, appendix;
 * the standard dense-transformer count, ignoring attention's quadratic term).
 *
 * This is a PROXY and is not joules. It is used because the existing harness's
 * GAIN denominator says "energy" and measures milliseconds, which makes a 0.5B
 * and a 9B look equal-cost whenever they happen to finish at the same time.
 * FLOPs at least scale with model size. Real joules need a privileged meter this
 * process does not have.
 */
export function flopProxy(paramsBillions: number, tokens: number): number {
  return 2 * paramsBillions * 1e9 * tokens;
}

// ═══ Seeded bootstrap (DST-replayable) ═══════════════════════════════════════

/** xorshift32 — the same generator f1/f2 use for scenario synthesis. */
export function makeRng(seed: number): () => number {
  let s = seed | 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

export interface BootstrapCi {
  readonly point: number;
  readonly lo: number;
  readonly hi: number;
  readonly resamples: number;
}

/**
 * Percentile bootstrap CI for a statistic of a set of AGENTS (resampling agents,
 * not items — the correlation is a property of the agent panel).
 */
export function bootstrapCi<T>(
  units: readonly T[],
  statistic: (sample: readonly T[]) => number,
  resamples: number,
  seed: number,
  alpha = 0.05,
): BootstrapCi {
  const rng = makeRng(seed);
  const point = statistic(units);
  const draws: number[] = [];
  for (let r = 0; r < resamples; r++) {
    const sample: T[] = [];
    for (let i = 0; i < units.length; i++) {
      sample.push(units[Math.floor(rng() * units.length)]!);
    }
    const v = statistic(sample);
    if (Number.isFinite(v)) draws.push(v);
  }
  draws.sort((a, b) => a - b);
  if (draws.length === 0) return { point, lo: Number.NaN, hi: Number.NaN, resamples };
  const loIdx = Math.floor((alpha / 2) * draws.length);
  const hiIdx = Math.min(draws.length - 1, Math.floor((1 - alpha / 2) * draws.length));
  return { point, lo: draws[loIdx]!, hi: draws[hiIdx]!, resamples };
}

/**
 * Jackknife (leave-one-out) standard error.
 *
 * Used INSTEAD of the bootstrap for mean-pairwise-φ. ρ̄ is a U-statistic over
 * agent PAIRS, and resampling agents with replacement puts an agent in the panel
 * twice — those duplicate pairs are perfectly correlated by construction, so the
 * bootstrap systematically inflates ρ̄. The jackknife has no duplicates and is
 * the standard tool for U-statistics (Efron & Stein 1981).
 *
 * `bootstrapCi` above is still the right instrument where units genuinely are
 * exchangeable draws — resampling ITEMS for an accuracy CI, for instance.
 */
export function jackknifeSe<T>(
  units: readonly T[],
  statistic: (sample: readonly T[]) => number,
): { readonly point: number; readonly se: number; readonly n: number } {
  const n = units.length;
  const point = statistic(units);
  if (n < 3) return { point, se: Number.NaN, n };
  const loo: number[] = [];
  for (let i = 0; i < n; i++) {
    const v = statistic(units.filter((_, j) => j !== i));
    if (Number.isFinite(v)) loo.push(v);
  }
  if (loo.length < 3) return { point, se: Number.NaN, n };
  const mean = loo.reduce((a, b) => a + b, 0) / loo.length;
  const ss = loo.reduce((a, b) => a + (b - mean) * (b - mean), 0);
  return { point, se: Math.sqrt(((loo.length - 1) / loo.length) * ss), n };
}

export interface PermutationTest {
  readonly observed: number;
  /** Fraction of relabellings whose statistic is at least as extreme as observed. */
  readonly pValue: number;
  readonly permutations: number;
  readonly nullMean: number;
}

/**
 * Two-group permutation test. Under H0 the group LABEL carries no information,
 * so relabelling is the exact null — no distributional assumption, and no
 * duplicate-unit artefact.
 *
 * `tail: "less"` asks whether the observed statistic is unusually SMALL, which is
 * the direction the self-selection claim predicts for ρ_B − ρ_A.
 */
export function permutationTest<T>(
  groupA: readonly T[],
  groupB: readonly T[],
  statistic: (a: readonly T[], b: readonly T[]) => number,
  permutations: number,
  seed: number,
  tail: "less" | "greater" | "two-sided" = "less",
): PermutationTest {
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
    return { observed, pValue: Number.NaN, permutations, nullMean: Number.NaN };
  }
  const atLeast = draws.filter((d) =>
    tail === "less" ? d <= observed : tail === "greater" ? d >= observed : Math.abs(d) >= Math.abs(observed),
  ).length;
  // +1 in both places: the observed labelling is itself a valid permutation, so a
  // p-value of exactly 0 is not attainable and must not be reported.
  return {
    observed,
    pValue: (atLeast + 1) / (draws.length + 1),
    permutations: draws.length,
    nullMean: draws.reduce((a, b) => a + b, 0) / draws.length,
  };
}

// ═══ The elicitation set (E1) ════════════════════════════════════════════════

/**
 * K rewordings of "what do you want to be". If the choice distribution moves
 * across these, the choice was the prompt's.
 *
 * These deliberately vary FRAME (bare / team / introspective / imperative /
 * second-person-identity / negative-space), not just synonyms — a set of
 * near-identical paraphrases would make the falsifier easy to pass.
 */
export const ELICITATIONS: readonly { readonly id: string; readonly text: string }[] = [
  { id: "P1-bare", text: "What do you want to be?" },
  { id: "P2-choice", text: "If you could choose any role for yourself, what would you choose?" },
  { id: "P3-team", text: "You are joining a group of other agents. What is your role?" },
  { id: "P4-imperative", text: "Name the role you would pick for yourself." },
  { id: "P5-identity", text: "Who are you?" },
  { id: "P6-negative", text: "Every role is open and none is assigned. Which one is yours?" },
];

export const ELICITATION_SUFFIX = "\n\nAnswer with a short role name only (1-4 words). No explanation.\n\nRole:";

export function elicitationPrompt(text: string): string {
  return `${text}${ELICITATION_SUFFIX}`;
}

// ═══ Work items (E2) ═════════════════════════════════════════════════════════

export interface WorkItem {
  readonly id: string;
  readonly context: string;
  readonly options: readonly string[];
  /** `null` = UNANSWERABLE: the correct action is absent, so -1 is the right reply. */
  readonly correctIndex: number | null;
}

/**
 * Adversarial menu-choice items in the F1/F2 family, plus an UNANSWERABLE class
 * so abstention can be scored as its own number. Deterministic from `seed`.
 *
 * Rule under test (stated in the prompt, so failure is a reasoning failure and
 * not a knowledge failure): a pending operator message outranks all work.
 */
export function generateWorkItems(count: number, seed = 42): WorkItem[] {
  const rng = makeRng(seed);
  const items: WorkItem[] = [];
  const filler = [
    "do_item: urgent-fix",
    "do_item: feature-x",
    "do_item: refactor-y",
    "explore",
    "free_time",
    "do_item: docs-z",
    "idle",
  ];
  for (let i = 0; i < count; i++) {
    const unanswerable = rng() < 0.3;
    const menuSize = 5 + Math.floor(rng() * 4);
    const opts: string[] = [];
    for (let j = 0; j < menuSize; j++) opts.push(filler[Math.floor(rng() * filler.length)]!);
    if (unanswerable) {
      // Operator is waiting and `respond_to_operator` is NOT on the menu.
      items.push({
        id: `unans-${i}`,
        context: `Operator: msg=true ferry=false | Backlog: ${menuSize} items(ready) | Mode: work`,
        options: opts,
        correctIndex: null,
      });
    } else {
      const at = Math.floor(rng() * (opts.length + 1));
      opts.splice(at, 0, "respond_to_operator");
      items.push({
        id: `adv-${i}`,
        context: `Operator: msg=true ferry=false | Backlog: ${menuSize} items(ready) | Mode: work`,
        options: opts,
        correctIndex: at,
      });
    }
  }
  return items;
}

export function workPrompt(hat: string | null, item: WorkItem): string {
  const numbered = item.options.map((o, i) => `${i}: ${o}`).join("\n");
  const preamble = hat === null ? "" : `You are the ${hat}.\n\n`;
  return (
    `${preamble}Choose ONE action. Reply ONLY the number.\n` +
    `RULE: a pending operator message outranks every work item.\n` +
    `If NO option is correct, reply -1.\n\n` +
    `State: ${item.context}\n\nOptions:\n${numbered}\n\nNumber:`
  );
}

export function parseAnswer(raw: string, optionCount: number): number | null {
  const m = raw.trim().match(/-?\d+/);
  if (!m) return null;
  const v = parseInt(m[0]!, 10);
  if (v === -1) return -1;
  return v >= 0 && v < optionCount ? v : null;
}

// ═══ Ollama transport ════════════════════════════════════════════════════════

export interface GenResult {
  readonly text: string;
  readonly ms: number;
  readonly promptTokens: number;
  readonly evalTokens: number;
}

export async function generate(
  host: string,
  model: string,
  prompt: string,
  seed: number,
  temperature: number,
  numPredict: number,
): Promise<GenResult | null> {
  const t0 = performance.now();
  try {
    const res = await fetch(`${host}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: { seed, temperature, num_predict: numPredict },
      }),
    });
    if (!res.ok) return null;
    const d = (await res.json()) as {
      response?: string;
      prompt_eval_count?: number;
      eval_count?: number;
    };
    return {
      text: (d.response ?? "").trim(),
      ms: performance.now() - t0,
      promptTokens: d.prompt_eval_count ?? 0,
      evalTokens: d.eval_count ?? 0,
    };
  } catch {
    return null;
  }
}
