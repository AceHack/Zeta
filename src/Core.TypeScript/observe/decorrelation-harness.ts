#!/usr/bin/env bun
/**
 * decorrelation-harness.ts — ongoing research program for measuring what decorrelates.
 *
 * Decorrelation is the lever that scales intelligence per watt. Each axis that
 * PROVABLY decorrelates is a multiplier on what the society achieves at the same
 * energy cost — without changing any model, just by changing how existing models are
 * composed. The ceiling is not model capability; it is how cleverly we compose what we
 * have.
 *
 * ## What this file learned from Otto's review (the corrections are the design now)
 *
 * The first pass reported φ as a [−1,1] correlation and called φ=0.112 "nearly
 * independent". That was wrong in a way that mattered: φ has a marginal-bound ceiling
 * φ_max, and 0.112 was 32% of a ceiling of 0.344. Every honest number now goes through
 * `decorrelation-stats.ts`, which reports:
 *
 *   - φ AND φ_max AND φ/φ_max (read the ratio, never the raw φ)
 *   - Yule's Q and κ (marginal-free — they fail differently from φ, disagreement is info)
 *   - 95% Wilson CIs on every accuracy (100% on N=3 is not 100%)
 *   - unionUpperBound, NOT "pipelineAccuracy" — it is an ORACLE (perfect selector), not a
 *     system. A real selector lands below it and may land below max(A,B); both reported.
 *
 * `gain` was DELETED. It divided by a hardcoded energyMultiplier=2, which is latency
 * wearing energy units, not a measured joule. Gain returns only when the energy
 * denominator is measured from real latency/power, not assumed.
 *
 * ## The universal-controller constraint (why menu shuffling is RULED OUT as a candidate)
 *
 * Stable slot positions are learnable buttons: up/down/left/right navigates git space.
 * Shuffling the menu breaks that interface. So the reversed/permuted arms are a
 * REFERENCE CEILING (how much decorrelation is even on the table), not candidates. The
 * real candidates are perturbations that leave option ordering/indices untouched:
 *
 *   arm 3: extra blank line in the prompt
 *   arm 4: one-token synonym swap ("choose" → "pick")
 *   arm 5: two clauses of the instruction swapped
 *   arm 6: trailing whitespace only
 *   NULL:  an edit built to change NOTHING (must NOT beat its own null to count)
 *
 * CONTAMINATION CHECK: perturbing prompt text must never touch option ordering/indices.
 * The harness asserts this separation; arms that violate it are voided.
 *
 * ## Axis status
 *
 * REFERENCE CEILING (interface-breaking, not deployable):
 *   - menu order reversed / permuted
 *
 * PROVEN (F1/F2, re-examined under the honest stats — see W5 note in the ledger):
 *   - hat: producer vs verifier
 *
 * MEASURED:
 *   - model family: qwen vs llama vs gemma
 *
 * CANDIDATE (text perturbations that preserve the button interface):
 *   - prompt frame: blank line, synonym, clause order, trailing whitespace
 *
 * HYPOTHESIZED (awaiting measurement):
 *   - memory load, quantization, seed, temperature, persona
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import {
  measureHonest, requiredNForDifference,
  type HonestMeasurement, type Interval,
} from "./decorrelation-stats";

// ═══ Types ════════════════════════════════════════════════════════════════════

export type Register = "toy" | "unmetered" | "metered";

export interface AxisConfig {
  readonly axis: string;
  readonly description: string;
  readonly configA: string;
  readonly configB: string;
  /**
   * "reference-ceiling" arms break the universal-controller interface (they move
   * buttons) and are NOT deployable — they only bound how much decorrelation exists.
   * "candidate" arms preserve option ordering and could ship. "null" arms are built to
   * change nothing and must be beaten to count.
   */
  readonly kind: "reference-ceiling" | "candidate" | "null";
}

export interface TrialResult {
  readonly aCorrect: boolean;
  readonly bCorrect: boolean;
  /** Latency of config A (ms) — collected for a FUTURE measured energy denominator. */
  readonly aMs: number;
  /** Latency of config B (ms). */
  readonly bMs: number;
}

export interface AxisMeasurement {
  readonly axis: AxisConfig;
  readonly register: Register;
  readonly stats: HonestMeasurement;
  /** Fraction of items where A and B gave the same correct/wrong outcome. */
  readonly agreementRate: number;
  /** N per arm needed to resolve the observed union-vs-best gap at 80% power (W3). */
  readonly requiredN: number;
  /** Mean latency A/B (ms) — RECORDED, not yet converted to energy. */
  readonly meanMsA: number;
  readonly meanMsB: number;
  /**
   * Verdict on the honest scale. NOTE: no "decorrelates-usefully" without a measured
   * selector and a measured energy denominator — the union is an oracle.
   */
  readonly verdict:
    | "genuinely-independent"        // φ/φ_max ≈ 0 AND Yule's Q ≈ 0
    | "correlated"                   // φ/φ_max meaningfully > 0
    | "underpowered"                 // N below requiredN — cannot conclude
    | "insufficient-data";
  readonly measuredAt: string;
}

// ═══ Computation ══════════════════════════════════════════════════════════════

export function measureAxis(
  axis: AxisConfig,
  results: readonly TrialResult[],
  register: Register,
): AxisMeasurement {
  const n = results.length;
  const measuredAt = new Date().toISOString();
  if (n < 10) {
    return emptyMeasurement(axis, register, measuredAt);
  }

  const stats = measureHonest(results);
  const agree = results.filter((r) => r.aCorrect === r.bCorrect).length / n;
  const meanMsA = results.reduce((s, r) => s + r.aMs, 0) / n;
  const meanMsB = results.reduce((s, r) => s + r.bMs, 0) / n;

  // How many items would we need to resolve the union-vs-best gap this run suggests?
  const requiredN = requiredNForDifference(stats.unionUpperBound.point, stats.bestSingle);

  let verdict: AxisMeasurement["verdict"];
  const ratio = Math.abs(stats.phiRatio);
  const q = Math.abs(stats.yulesQ);
  if (n < requiredN && requiredN !== Infinity && (stats.unionUpperBound.point - stats.bestSingle) > 0) {
    verdict = "underpowered";
  } else if (ratio < 0.1 && q < 0.1) {
    verdict = "genuinely-independent";
  } else {
    verdict = "correlated";
  }

  return {
    axis, register, stats, agreementRate: agree,
    requiredN, meanMsA, meanMsB, verdict, measuredAt,
  };
}

function emptyMeasurement(axis: AxisConfig, register: Register, measuredAt: string): AxisMeasurement {
  const zero: Interval = { point: 0, lo: 0, hi: 1 };
  return {
    axis, register,
    stats: {
      table: { a: 0, b: 0, c: 0, d: 0 }, n: 0,
      phi: 0, phiMax: 0, phiRatio: 0, yulesQ: 0, kappa: 0,
      accuracyA: zero, accuracyB: zero, unionUpperBound: zero, bestSingle: 0,
    },
    agreementRate: 0, requiredN: Infinity, meanMsA: 0, meanMsB: 0,
    verdict: "insufficient-data", measuredAt,
  };
}

export function formatMeasurement(m: AxisMeasurement): string {
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const ci = (iv: Interval) => `${pct(iv.point)} [${pct(iv.lo)}, ${pct(iv.hi)}]`;
  const s = m.stats;
  return [
    `Axis: ${m.axis.axis} [${m.axis.kind}] (${m.axis.configA} vs ${m.axis.configB})`,
    `  register=${m.register}  N=${s.n}  table(a=${s.table.a} b=${s.table.b} c=${s.table.c} d=${s.table.d})`,
    `  φ=${s.phi.toFixed(3)}  φ_max=${s.phiMax.toFixed(3)}  φ/φ_max=${s.phiRatio.toFixed(3)}  (read the ratio)`,
    `  Yule's Q=${s.yulesQ.toFixed(3)}  κ=${s.kappa.toFixed(3)}  agreement=${pct(m.agreementRate)}`,
    `  acc A=${ci(s.accuracyA)}  acc B=${ci(s.accuracyB)}  best single=${pct(s.bestSingle)}`,
    `  UNION UPPER BOUND (oracle, needs a selector)=${ci(s.unionUpperBound)}`,
    `  latency A=${m.meanMsA.toFixed(0)}ms B=${m.meanMsB.toFixed(0)}ms (recorded; energy NOT yet derived)`,
    `  N needed to resolve union-vs-best at 80% power: ${m.requiredN === Infinity ? "∞ (no gap)" : m.requiredN}`,
    `  Verdict: ${m.verdict}`,
  ].join("\n");
}

/**
 * Record a measurement to the ongoing research ledger. Every entry carries N, CIs,
 * φ_max, register, and (when available) a pre-registration commit sha (W7/W8).
 */
export function recordMeasurement(
  repoRoot: string,
  m: AxisMeasurement,
  meta: { preRegistrationSha?: string | undefined; nullArmVerdict?: string | undefined } = {},
): void {
  const path = join(repoRoot, "data", "decorrelation-research.jsonl");
  mkdirSync(dirname(path), { recursive: true });
  const entry = {
    schema: "decorr/v2",
    axis: m.axis,
    register: m.register,
    n: m.stats.n,
    table: m.stats.table,
    phi: m.stats.phi,
    phiMax: m.stats.phiMax,
    phiRatio: m.stats.phiRatio,
    yulesQ: m.stats.yulesQ,
    kappa: m.stats.kappa,
    accuracyA: m.stats.accuracyA,
    accuracyB: m.stats.accuracyB,
    unionUpperBound: m.stats.unionUpperBound,
    bestSingle: m.stats.bestSingle,
    agreementRate: m.agreementRate,
    requiredN: m.requiredN === Infinity ? null : m.requiredN,
    meanMsA: m.meanMsA,
    meanMsB: m.meanMsB,
    verdict: m.verdict,
    preRegistrationSha: meta.preRegistrationSha ?? null,
    nullArmVerdict: meta.nullArmVerdict ?? null,
    measuredAt: m.measuredAt,
  };
  appendFileSync(path, JSON.stringify(entry) + "\n");
}

// ═══ Prompt-frame arms — the perturbation functions ════════════════════════════

/**
 * A prompt perturbation. CRITICAL: it may only change the INSTRUCTION TEXT. It must
 * NOT touch the option list, ordering, or indices. `assertNoOptionContamination`
 * enforces this before any arm runs.
 */
export interface PromptArm {
  readonly name: string;
  readonly kind: AxisConfig["kind"];
  /** Rewrite ONLY the instruction line(s). Options are appended by the caller. */
  readonly instruction: (base: string) => string;
}

export const CANONICAL_INSTRUCTION =
  "Choose ONE action. Reply ONLY the number. Operator outranks everything.";

export const PROMPT_ARMS: readonly PromptArm[] = [
  // Reference ceiling — these WOULD move buttons if applied to options; here they only
  // perturb instruction text, so they are the mild end of the ceiling.
  {
    name: "blank-line",
    kind: "candidate",
    instruction: (b) => b + "\n",
  },
  {
    name: "synonym-choose-to-pick",
    kind: "candidate",
    instruction: (b) => b.replace("Choose", "Pick"),
  },
  {
    name: "clause-swap",
    kind: "candidate",
    instruction: () =>
      "Operator outranks everything. Choose ONE action; reply ONLY the number.",
  },
  {
    name: "trailing-whitespace",
    kind: "candidate",
    instruction: (b) => b + "   ",
  },
  {
    name: "null-identity",
    kind: "null",
    instruction: (b) => b, // changes nothing — must NOT show association to count
  },
];

/**
 * CONTAMINATION CHECK (W1): the perturbed prompt must contain the option block
 * byte-identical to the canonical one. If a perturbation altered ordering or indices,
 * this throws and the arm is void.
 */
export function assertNoOptionContamination(canonicalOptionsBlock: string, builtPrompt: string): void {
  if (!builtPrompt.includes(canonicalOptionsBlock)) {
    throw new Error(
      "CONTAMINATION: prompt perturbation altered the option block. " +
      "Arm is void — text arms must not touch option ordering/indices.",
    );
  }
}

function buildPrompt(instruction: string, context: string, optionsBlock: string): string {
  return `${instruction}\n\nState: ${context}\n\nOptions:\n${optionsBlock}\n\nNumber:`;
}

// ═══ Ollama query ══════════════════════════════════════════════════════════════

async function queryIndex(
  model: string, prompt: string, nOptions: number, host: string,
): Promise<{ idx: number | null; ms: number }> {
  const start = performance.now();
  try {
    const res = await fetch(`${host}/api/generate`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, stream: false, options: { seed: 42, temperature: 0, num_predict: 10 } }),
    });
    const data = await res.json() as { response: string };
    const ms = performance.now() - start;
    const match = data.response.trim().match(/\d+/);
    if (!match) return { idx: null, ms };
    const idx = parseInt(match[0]!, 10);
    return { idx: idx >= 0 && idx < nOptions ? idx : null, ms };
  } catch {
    return { idx: null, ms: performance.now() - start };
  }
}

/**
 * Test one prompt-frame arm against the canonical prompt on the same model+items.
 * The candidate arm never moves options, so correctIndex is unchanged between A and B —
 * which is exactly why it preserves the universal-controller interface.
 */
export async function testPromptArm(
  model: string,
  arm: PromptArm,
  scenarios: readonly { context: string; options: string[]; correctIndex: number }[],
  host = "http://127.0.0.1:11434",
): Promise<AxisMeasurement> {
  const axis: AxisConfig = {
    axis: `prompt-frame:${arm.name}`,
    description: `Same model, same items, instruction perturbed (${arm.name}); options untouched`,
    configA: `${model} (canonical)`,
    configB: `${model} (${arm.name})`,
    kind: arm.kind,
  };

  const results: TrialResult[] = [];
  for (const s of scenarios) {
    const optionsBlock = s.options.map((o, i) => `${i}: ${o}`).join("\n");

    const promptA = buildPrompt(CANONICAL_INSTRUCTION, s.context, optionsBlock);
    const promptB = buildPrompt(arm.instruction(CANONICAL_INSTRUCTION), s.context, optionsBlock);

    // Contamination check: both prompts must carry the identical option block.
    assertNoOptionContamination(optionsBlock, promptA);
    assertNoOptionContamination(optionsBlock, promptB);

    const A = await queryIndex(model, promptA, s.options.length, host);
    const B = await queryIndex(model, promptB, s.options.length, host);

    results.push({
      aCorrect: A.idx === s.correctIndex,
      bCorrect: B.idx === s.correctIndex,
      aMs: A.ms, bMs: B.ms,
    });
  }

  return measureAxis(axis, results, "unmetered");
}

// ═══ CLI ══════════════════════════════════════════════════════════════════════

if (import.meta.main) {
  console.log("Decorrelation Research Harness (v2 — honest stats)");
  console.log("Every axis reports φ, φ_max, φ/φ_max, Yule's Q, κ, 95% CIs, and a power N.");
  console.log("The union is an ORACLE upper bound, not a system. gain is DELETED until energy is measured.\n");
  console.log("Prompt-frame arms (all preserve the button interface — options untouched):");
  for (const arm of PROMPT_ARMS) {
    console.log(`  [${arm.kind}] ${arm.name}`);
  }
  console.log("\nRun: testPromptArm('gemma2:2b', PROMPT_ARMS[0], scenarios)");
  console.log("The NULL arm (null-identity) must show NO association, or the measurement is broken.");
}
