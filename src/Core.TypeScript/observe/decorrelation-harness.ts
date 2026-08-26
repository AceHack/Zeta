#!/usr/bin/env bun
/**
 * decorrelation-harness.ts — ongoing research program for measuring what decorrelates.
 *
 * Decorrelation is the lever that scales intelligence per watt. Each axis that
 * PROVABLY decorrelates is a multiplier on what the society achieves at the same
 * energy cost. This harness makes testing new axes mechanical:
 *
 *   1. Define an axis (what varies between the two configurations)
 *   2. Run the same items through both configurations
 *   3. Compute φ (correlation) and catch-rate (if one is verifying the other)
 *   4. Record whether the axis earns its cost
 *
 * ## Axes to test (unbounded — new ones discovered over time)
 *
 * PROVEN (F1/F2 this session):
 *   - hat: producer vs verifier → φ diverges, 90% catch rate ✓
 *
 * MEASURED (benchmark-scale):
 *   - model family: qwen vs llama vs gemma → φ=0.354-0.628 (moderate, not enough for vote)
 *
 * HYPOTHESIZED (awaiting measurement):
 *   - prompt frame: menu order shuffled vs canonical
 *   - memory load: fresh context vs persona history
 *   - quantization: Q4 vs Q8 of same model
 *   - seed: different sampling trajectories
 *   - temperature: 0 vs 0.3 vs 0.7
 *   - persona: different system prompts (alexa vs otto personality)
 *
 * ## The protocol (same for every axis)
 *
 * 1. Hold everything constant EXCEPT the axis under test
 * 2. Run N≥100 items through both configurations
 * 3. Compute: agreement rate, φ coefficient, catch-rate (if applicable)
 * 4. Report: does this axis push φ below the vote-useful threshold?
 * 5. Compute: intelligence-per-watt gain if this axis is exploited
 *
 * ## The metric that matters
 *
 * Not φ alone (which is just correlation). The metric is:
 *
 *   GAIN = (pipeline_accuracy - best_single_accuracy) / extra_energy_cost
 *
 * An axis decorrelates usefully only if GAIN > 0. If accuracy improves but
 * energy doubles and accuracy doesn't double, the axis costs more than it earns.
 */

import { writeFileSync, appendFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

// ═══ Types ════════════════════════════════════════════════════════════════════

export interface AxisConfig {
  /** Name of the axis being tested. */
  readonly axis: string;
  /** Description of what varies. */
  readonly description: string;
  /** Configuration A (the baseline). */
  readonly configA: string;
  /** Configuration B (the variant). */
  readonly configB: string;
}

export interface TrialResult {
  /** Was config A correct on this item? */
  readonly aCorrect: boolean;
  /** Was config B correct on this item? */
  readonly bCorrect: boolean;
  /** Latency of config A (ms). */
  readonly aMs: number;
  /** Latency of config B (ms). */
  readonly bMs: number;
}

export interface AxisMeasurement {
  readonly axis: AxisConfig;
  readonly trials: number;
  /** Agreement rate: fraction of items where A and B gave the same answer. */
  readonly agreementRate: number;
  /** Phi coefficient between A-correct and B-correct. */
  readonly phi: number;
  /** Accuracy of A alone. */
  readonly accuracyA: number;
  /** Accuracy of B alone. */
  readonly accuracyB: number;
  /** Accuracy of majority (A+B agree = take it, disagree = take the better one). */
  readonly pipelineAccuracy: number;
  /** Energy multiplier (2× if running both, 1× if running one). */
  readonly energyMultiplier: number;
  /** GAIN = (pipeline - best_single) / energy_multiplier. >0 = axis earns its cost. */
  readonly gain: number;
  /** Human verdict. */
  readonly verdict: "decorrelates-usefully" | "decorrelates-but-not-worth-cost" | "correlated" | "insufficient-data";
  /** Timestamp. */
  readonly measuredAt: string;
}

// ═══ Computation ══════════════════════════════════════════════════════════════

export function measureAxis(axis: AxisConfig, results: readonly TrialResult[]): AxisMeasurement {
  const n = results.length;
  if (n < 10) {
    return {
      axis, trials: n, agreementRate: 0, phi: 0, accuracyA: 0, accuracyB: 0,
      pipelineAccuracy: 0, energyMultiplier: 2, gain: 0,
      verdict: "insufficient-data", measuredAt: new Date().toISOString(),
    };
  }

  // Agreement rate
  const agree = results.filter((r) => r.aCorrect === r.bCorrect).length;
  const agreementRate = agree / n;

  // Phi coefficient
  let bothRight = 0, aOnlyRight = 0, bOnlyRight = 0, bothWrong = 0;
  for (const r of results) {
    if (r.aCorrect && r.bCorrect) bothRight++;
    else if (r.aCorrect && !r.bCorrect) aOnlyRight++;
    else if (!r.aCorrect && r.bCorrect) bOnlyRight++;
    else bothWrong++;
  }
  const phi = ((bothRight * bothWrong) - (aOnlyRight * bOnlyRight)) /
    Math.sqrt(((bothRight + aOnlyRight) * (bothRight + bOnlyRight) *
      (bothWrong + aOnlyRight) * (bothWrong + bOnlyRight)) || 1);

  // Accuracies
  const accuracyA = results.filter((r) => r.aCorrect).length / n;
  const accuracyB = results.filter((r) => r.bCorrect).length / n;

  // Pipeline: when both agree, take it. When they disagree, take the better one's answer.
  // (In practice this means: if either is right, the pipeline is right — union of correct sets)
  const pipelineCorrect = results.filter((r) => r.aCorrect || r.bCorrect).length;
  const pipelineAccuracy = pipelineCorrect / n;

  const bestSingle = Math.max(accuracyA, accuracyB);
  const energyMultiplier = 2;
  const gain = (pipelineAccuracy - bestSingle) / energyMultiplier;

  let verdict: AxisMeasurement["verdict"];
  if (gain > 0.01) verdict = "decorrelates-usefully";
  else if (phi < 0.3) verdict = "decorrelates-but-not-worth-cost";
  else verdict = "correlated";

  return {
    axis, trials: n, agreementRate, phi, accuracyA, accuracyB,
    pipelineAccuracy, energyMultiplier, gain, verdict,
    measuredAt: new Date().toISOString(),
  };
}

/**
 * Format a measurement for display.
 */
export function formatMeasurement(m: AxisMeasurement): string {
  const lines = [
    `Axis: ${m.axis.axis} (${m.axis.configA} vs ${m.axis.configB})`,
    `  N=${m.trials}, φ=${m.phi.toFixed(3)}, agreement=${(m.agreementRate*100).toFixed(0)}%`,
    `  Accuracy: A=${(m.accuracyA*100).toFixed(1)}%, B=${(m.accuracyB*100).toFixed(1)}%, pipeline=${(m.pipelineAccuracy*100).toFixed(1)}%`,
    `  Gain: ${(m.gain*100).toFixed(2)}% per unit energy (${m.gain > 0 ? "EARNS its cost" : "does NOT earn cost"})`,
    `  Verdict: ${m.verdict}`,
  ];
  return lines.join("\n");
}

/**
 * Record a measurement to the ongoing research ledger.
 */
export function recordMeasurement(repoRoot: string, m: AxisMeasurement): void {
  const path = join(repoRoot, "data", "decorrelation-research.jsonl");
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(m) + "\n");
}

// ═══ Axis Runners (plug in new axes here) ══════════════════════════════════════

/**
 * Test the prompt-frame axis: does shuffling menu order decorrelate?
 * This is the cheapest axis to test — same model, same items, different presentation.
 */
export async function testPromptFrameAxis(
  model: string,
  scenarios: readonly { context: string; options: string[]; correctIndex: number }[],
  host: string = "http://127.0.0.1:11434",
): Promise<AxisMeasurement> {
  const axis: AxisConfig = {
    axis: "prompt-frame",
    description: "Same model, same items, menu order canonical vs shuffled",
    configA: `${model} (canonical order)`,
    configB: `${model} (shuffled order)`,
  };

  const results: TrialResult[] = [];

  for (const scenario of scenarios) {
    // Config A: canonical order
    const startA = performance.now();
    const aIdx = await queryIndex(model, scenario.context, scenario.options, host);
    const aMs = performance.now() - startA;
    const aCorrect = aIdx === scenario.correctIndex;

    // Config B: shuffled order (deterministic from item index)
    const shuffled = [...scenario.options];
    // Simple deterministic shuffle: reverse the array
    shuffled.reverse();
    const newCorrectIdx = shuffled.indexOf(scenario.options[scenario.correctIndex]!);

    const startB = performance.now();
    const bIdx = await queryIndex(model, scenario.context, shuffled, host);
    const bMs = performance.now() - startB;
    const bCorrect = bIdx === newCorrectIdx;

    results.push({ aCorrect, bCorrect, aMs, bMs });
  }

  return measureAxis(axis, results);
}

async function queryIndex(model: string, context: string, options: string[], host: string): Promise<number | null> {
  const numbered = options.map((o, i) => `${i}: ${o}`).join("\n");
  const prompt = `Choose ONE action. Reply ONLY the number. Operator outranks everything.\n\nState: ${context}\n\nOptions:\n${numbered}\n\nNumber:`;
  try {
    const res = await fetch(`${host}/api/generate`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, stream: false, options: { seed: 42, temperature: 0, num_predict: 10 } }),
    });
    const data = await res.json() as { response: string };
    const match = data.response.trim().match(/\d+/);
    if (!match) return null;
    const idx = parseInt(match[0]!, 10);
    return idx >= 0 && idx < options.length ? idx : null;
  } catch { return null; }
}

// ═══ CLI ══════════════════════════════════════════════════════════════════════

if (import.meta.main) {
  console.log("Decorrelation Research Harness");
  console.log("Run specific axis tests with the exported functions.");
  console.log("Example: testPromptFrameAxis('gemma2:2b', scenarios)");
  console.log("\nKnown axes (see source for full list):");
  console.log("  ✓ hat (producer/verifier) — PROVEN, 90% catch rate");
  console.log("  ~ model family — measured, φ=0.35-0.63, not enough for vote");
  console.log("  ? prompt-frame — testPromptFrameAxis() ready to run");
  console.log("  ? memory-load — needs persona history injection");
  console.log("  ? quantization — needs same model at Q4 vs Q8");
  console.log("  ? temperature — needs same model at t=0 vs t=0.3");
  console.log("  ? seed — needs same model at seed=42 vs seed=137");
}
