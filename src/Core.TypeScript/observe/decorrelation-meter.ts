/**
 * decorrelation-meter.ts — measure actual independence between agent decisions.
 *
 * ## The connection to 2√2
 *
 * The CHSH inequality bounds what classically-correlated observers can achieve:
 *   S ≤ 2 (classical, local hidden variables)
 *   S ≤ 2√2 ≈ 2.828 (quantum, non-local correlations — the Tsirelson bound)
 *
 * We do NOT assert 2√2. That would be numerology — a number matching a bound is
 * not an identification (the same category confusion the xorshift theorem retraction
 * caught). Instead we BUILD A METER that measures where our agents' decisions fall
 * on the decorrelation spectrum:
 *
 *   S ≈ 0:     perfectly correlated (same model, same prompt, useless redundancy)
 *   S close to 2: classical decorrelation (independent but mundane)
 *   S > 2:     violates classical bound (genuine independence beyond shared training)
 *   S ≈ 2√2:  would indicate maximum decorrelation (the quantum limit)
 *   S > 2√2:  impossible if measured honestly (flags a metering error)
 *
 * ## What we measure
 *
 * Given N agents making decisions on the same ticks, the CHSH-inspired metric is:
 *
 * For each pair of agents (A, B), across a window of concurrent ticks:
 *   - When both face the same menu, how often do they choose THE SAME action?
 *   - When facing different menus (different world views), how correlated are choices?
 *
 * Perfect correlation (same model, same input) → agreement rate ≈ 1.0 → S ≈ 0
 * Perfect independence → agreement rate ≈ 1/N_options → S approaches the bound
 * Real-world → somewhere between, and the NUMBER is what tells you whether
 * adding agents actually buys you anything via majority vote.
 *
 * ## Why this matters for fleet efficiency
 *
 * The 12.5x efficiency advantage from model-efficiency.ts assumes independent
 * errors. If errors are correlated (agreement rate > 1/N_options by a lot),
 * the actual advantage is:
 *
 *   effective_advantage = raw_advantage × decorrelation_coefficient
 *
 * where decorrelation_coefficient ∈ [0, 1]:
 *   0 = perfectly correlated (fleet adds nothing)
 *   1 = perfectly independent (majority vote works perfectly)
 *
 * ## Sources of decorrelation (structural, not hoped-for)
 *
 * 1. Different model families (qwen vs llama vs phi vs deepseek)
 *    → Different training data, different architectures, orthogonal error modes
 * 2. Different quantization levels (Q4 vs Q8 round differently)
 *    → Same model, divergent numerical errors at decision boundaries
 * 3. Different memories/histories (each agent's memory/ folder)
 *    → Same model, different context → different priors
 * 4. Different phase positions (HLC clocks diverge over time)
 *    → Same input data seen in different order
 *
 * ## Measurement, never assertion
 *
 * This module computes a MEASURED decorrelation coefficient from actual tick data.
 * It does not assume any theoretical value. The measurement could show:
 *   - Our agents are highly correlated (same model = useless redundancy)
 *   - Our agents are moderately decorrelated (justifies the fleet)
 *   - Our agents are maximally decorrelated (approaching 2√2 territory)
 *
 * Each of these is an honest finding. Only the measurement distinguishes them.
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

export interface PairwiseCorrelation {
  readonly agentA: string;
  readonly agentB: string;
  /** How many concurrent ticks were compared. */
  readonly sampleSize: number;
  /** Agreement rate: fraction of ticks where both chose the same action. */
  readonly agreementRate: number;
  /** Expected agreement under independence: 1/avg_menu_size. */
  readonly expectedByChance: number;
  /** Correlation excess: (agreementRate - expectedByChance) / (1 - expectedByChance). */
  readonly correlationExcess: number;
}

export interface DecorrelationMeasurement {
  /** The measured decorrelation coefficient ∈ [0, 1]. */
  readonly coefficient: number;
  /** CHSH-inspired S value. Mapped from coefficient: S = 2 × (1 + coefficient). */
  readonly chshS: number;
  /** Where this falls on the spectrum. */
  readonly band: "correlated" | "weakly-independent" | "independent" | "strongly-independent" | "suspicious";
  /** Pairwise correlations between all agent pairs. */
  readonly pairs: readonly PairwiseCorrelation[];
  /** Total tick-pairs analyzed. */
  readonly totalSamples: number;
  /** Human-readable summary. */
  readonly summary: string;
}

// ═══ Measurement ══════════════════════════════════════════════════════════════

/**
 * Load tick decisions from data/tick-reasoning.jsonl.
 */
export function loadTickDecisions(path: string): TickDecision[] {
  try {
    return readFileSync(path, "utf-8").trim().split("\n")
      .filter((l) => l.length > 0)
      .map((l) => {
        const r = JSON.parse(l);
        return {
          agent: r.agent,
          at: r.at,
          chosenIndex: r.chosenIndex,
          options: r.options ?? [],
          fallback: r.fallback ?? false,
        };
      })
      .filter((d) => !d.fallback); // only count non-fallback decisions
  } catch { return []; }
}

/**
 * Group decisions into concurrent ticks (within a time window).
 * Two decisions are "concurrent" if they're within `windowMs` of each other.
 */
function groupConcurrentTicks(
  decisions: readonly TickDecision[],
  windowMs: number = 120_000, // 2 minutes — within a single tick cycle
): Map<string, TickDecision[]> {
  const groups = new Map<string, TickDecision[]>();
  // ORDINAL, never `localeCompare` -- `.claude/rules/culture-invariant-by-default.md`.
  // `localeCompare` with no locale is culture-SENSITIVE and ICU-dependent, so two machines
  // can order the same decisions differently and the fold stops being DST-replayable.
  // `stringCompare` is the repo's treaty collation (code point == UTF-8 byte order), not the
  // `<`/`>` fallback: the fallback is UTF-16 code-unit order, which is deterministic but
  // DIVERGES from the other oracles above the BMP, and this fold is a cross-oracle surface.
  const sorted = [...decisions].sort((a, b) => stringCompare(a.at, b.at));

  for (const d of sorted) {
    const t = new Date(d.at).getTime();
    // Quantize to window
    const bucket = Math.floor(t / windowMs).toString();
    const list = groups.get(bucket) || [];
    list.push(d);
    groups.set(bucket, list);
  }

  return groups;
}

/**
 * Compute pairwise correlation between two agents' decisions.
 */
function computePairwise(
  agentA: string,
  agentB: string,
  groups: Map<string, TickDecision[]>,
): PairwiseCorrelation {
  let agreements = 0;
  let comparisons = 0;
  let totalMenuSize = 0;

  for (const [, decisions] of groups) {
    const dA = decisions.find((d) => d.agent === agentA);
    const dB = decisions.find((d) => d.agent === agentB);
    if (!dA || !dB) continue;

    comparisons++;
    if (dA.chosenIndex === dB.chosenIndex) agreements++;
    totalMenuSize += (dA.options.length + dB.options.length) / 2;
  }

  if (comparisons === 0) {
    return { agentA, agentB, sampleSize: 0, agreementRate: 0, expectedByChance: 0, correlationExcess: 0 };
  }

  const agreementRate = agreements / comparisons;
  const avgMenuSize = totalMenuSize / comparisons;
  const expectedByChance = avgMenuSize > 0 ? 1 / avgMenuSize : 0;

  // Correlation excess: how much more agreement than chance would predict.
  // 0 = exactly chance (perfectly independent)
  // 1 = always agree (perfectly correlated)
  // Negative = anti-correlated (actively disagreeing)
  const denominator = 1 - expectedByChance;
  const correlationExcess = denominator > 0 ? (agreementRate - expectedByChance) / denominator : 0;

  return { agentA, agentB, sampleSize: comparisons, agreementRate, expectedByChance, correlationExcess };
}

/**
 * Measure the decorrelation across all agent pairs.
 *
 * Returns a coefficient ∈ [0, 1] where:
 *   0 = all pairs perfectly correlated (same decisions always)
 *   1 = all pairs perfectly independent (agreement = chance)
 */
export function measureDecorrelation(repoRoot: string): DecorrelationMeasurement {
  const path = join(repoRoot, "data", "tick-reasoning.jsonl");
  const decisions = loadTickDecisions(path);

  if (decisions.length < 6) {
    return {
      coefficient: 0,
      chshS: 2, // classical floor
      band: "correlated",
      pairs: [],
      totalSamples: 0,
      summary: `INSUFFICIENT DATA — need at least 6 non-fallback decisions, have ${decisions.length}`,
    };
  }

  const groups = groupConcurrentTicks(decisions);
  const agents = [...new Set(decisions.map((d) => d.agent))];

  // Compute all pairwise correlations
  const pairs: PairwiseCorrelation[] = [];
  for (let i = 0; i < agents.length; i++) {
    for (let j = i + 1; j < agents.length; j++) {
      pairs.push(computePairwise(agents[i]!, agents[j]!, groups));
    }
  }

  const validPairs = pairs.filter((p) => p.sampleSize > 0);
  if (validPairs.length === 0) {
    return {
      coefficient: 0,
      chshS: 2,
      band: "correlated",
      pairs,
      totalSamples: 0,
      summary: "NO CONCURRENT TICKS — agents never decided at the same time",
    };
  }

  // Average correlation excess across all pairs
  const avgCorrelationExcess = validPairs.reduce((s, p) => s + p.correlationExcess, 0) / validPairs.length;

  // Decorrelation coefficient: 1 - correlationExcess (clamped to [0,1])
  const coefficient = Math.max(0, Math.min(1, 1 - avgCorrelationExcess));

  // Map to CHSH-inspired S value: S = 2 × (1 + coefficient)
  // At coefficient=0 (correlated): S = 2 (classical bound)
  // At coefficient=1 (independent): S = 4 (above Tsirelson — would need verification)
  // The 2√2 ≈ 2.828 would correspond to coefficient ≈ 0.414
  const chshS = 2 * (1 + coefficient);

  // Band classification
  let band: DecorrelationMeasurement["band"];
  if (coefficient < 0.1) band = "correlated";
  else if (coefficient < 0.3) band = "weakly-independent";
  else if (coefficient < 0.6) band = "independent";
  else if (coefficient <= 1.0) band = "strongly-independent";
  else band = "suspicious"; // should not happen with the clamp

  const TSIRELSON = 2 * Math.SQRT2; // ≈ 2.828
  const totalSamples = validPairs.reduce((s, p) => s + p.sampleSize, 0);

  const summary = `decorrelation=${coefficient.toFixed(3)}, S=${chshS.toFixed(3)} ` +
    `(classical≤2, Tsirelson≤${TSIRELSON.toFixed(3)}), band=${band}, ` +
    `${validPairs.length} pairs, ${totalSamples} samples`;

  return { coefficient, chshS, band, pairs, totalSamples, summary };
}

/**
 * Format for logging.
 */
export function formatDecorrelation(m: DecorrelationMeasurement): string {
  return `[decorrelation] ${m.summary}`;
}
