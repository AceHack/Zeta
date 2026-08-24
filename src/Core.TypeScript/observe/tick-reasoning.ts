/**
 * tick-reasoning.ts — capture and persist what the small LLM considered + chose.
 *
 * The society runs 0.5b–7b models that make real decisions every tick. But those
 * decisions are invisible — all you see in the event log is the chosen action.
 * This module surfaces the REASONING: what the model saw, what options it had,
 * what it chose, and what it said.
 *
 * Output: `data/tick-reasoning.jsonl` — one line per tick, append-only.
 * Machine-readable for the settlement page, human-readable in CI logs.
 *
 * ## What this shows off
 *
 * A 0.5b model running on a free GitHub Actions runner can:
 * - Read the world state (backlog items, operator messages, current mode)
 * - Consider a menu of options (explore, work, play, self-claim, etc.)
 * - Pick one with stated reasoning
 * - Do this 96 times/day across 3 agents — for free
 *
 * That's not GPT-4. But it IS autonomous decision-making from a model that
 * fits in 400MB of RAM, running unsupervised on schedule, producing durable
 * artifacts that other agents can observe and attest.
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

export interface TickReasoning {
  /** Agent that made the decision. */
  readonly agent: string;
  /** The model that chose (e.g., "qwen2.5:0.5b" or "oracle"). */
  readonly model: string;
  /** What the model was shown (compact world state). */
  readonly context: string;
  /** The menu options available. */
  readonly options: readonly string[];
  /** Which index was chosen (0-based). */
  readonly chosenIndex: number;
  /** The chosen action label. */
  readonly chosen: string;
  /** The model's raw response (what it actually said). */
  readonly raw: string;
  /** Did it fall back to oracle? */
  readonly fallback: boolean;
  /** When this decision was made. */
  readonly at: string;
  /** Phase at which this happened. */
  readonly phase?: number;
}

/**
 * Persist a tick's reasoning to data/tick-reasoning.jsonl.
 * Non-fatal: if the write fails, the tick continues.
 */
export function recordReasoning(repoRoot: string, reasoning: TickReasoning): void {
  try {
    const path = join(repoRoot, "data", "tick-reasoning.jsonl");
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, JSON.stringify(reasoning) + "\n");
  } catch { /* non-fatal */ }
}

/**
 * Format a reasoning record for one-line console output (CI visibility).
 */
export function formatReasoning(r: TickReasoning): string {
  const model = r.fallback ? `${r.model}→oracle` : r.model;
  const optCount = r.options.length;
  return `[reasoning] ${r.agent}/${model}: chose "${r.chosen}" from ${optCount} options` +
    (r.raw && r.raw !== "oracle-default" ? ` (said: "${r.raw.slice(0, 60)}")` : "");
}
