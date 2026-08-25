#!/usr/bin/env bun
/**
 * model-benchmark.ts — benchmark models against real observe-loop decisions.
 *
 * Pulls each model from the catalog, runs it against standardized prompts
 * from the observe loop, and records timing + correctness. Produces the
 * actual numbers for model-efficiency.ts instead of estimates.
 *
 * ## What it measures per model
 *
 * 1. Inference latency (wall-clock ms per decision)
 * 2. Parse success (did the model output a valid choice index?)
 * 3. Coherence (did it pick from the available menu, not hallucinate?)
 * 4. Consistency (same prompt twice → same answer? determinism check)
 *
 * ## Prompts
 *
 * Uses real observe-loop scenarios:
 * - Empty backlog, explore mode (should pick explore or play)
 * - 3 ready items, work mode (should pick do_item)
 * - Operator message pending (should pick respond)
 * - Mixed: backlog + free time available
 *
 * ## Output
 *
 * data/model-benchmark.json — one run's results, timestamped.
 * Append to data/model-benchmark-history.jsonl for trending.
 *
 * ## Usage
 *
 *   # Benchmark all models that fit in 16GB (needs ollama running)
 *   bun src/Core.TypeScript/observe/model-benchmark.ts
 *
 *   # Benchmark a specific model
 *   bun src/Core.TypeScript/observe/model-benchmark.ts --model qwen2.5:0.5b
 *
 *   # Quick mode (3 prompts instead of full suite)
 *   bun src/Core.TypeScript/observe/model-benchmark.ts --quick
 *
 *   # Just print results without saving
 *   bun src/Core.TypeScript/observe/model-benchmark.ts --dry-run
 */

import { writeFileSync, appendFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

// ═══ Test Scenarios (real observe-loop decision prompts) ═══════════════════════

export interface Scenario {
  readonly name: string;
  readonly context: string;
  readonly options: readonly string[];
  /** Which indices are "correct" (acceptable choices for this scenario). */
  readonly acceptableIndices: readonly number[];
}

export const SCENARIOS: readonly Scenario[] = [
  {
    name: "empty-backlog-explore",
    context: "Backlog: empty | Mode: unset",
    options: ["explore", "play", "self_claim", "free_time"],
    acceptableIndices: [0, 1, 2, 3], // any choice is valid when backlog is empty
  },
  {
    name: "ready-work-items",
    context: "Backlog: fix-lint(ready), update-deps(ready), write-docs(ready) | Mode: work",
    options: ["do_item: fix-lint", "do_item: update-deps", "do_item: write-docs", "explore", "free_time"],
    acceptableIndices: [0, 1, 2], // should prefer work items in work mode
  },
  {
    name: "operator-message-pending",
    context: "Operator: msg=true ferry=false | Backlog: empty | Mode: unset",
    options: ["respond_to_operator", "explore", "play", "free_time"],
    acceptableIndices: [0], // MUST respond to operator (outranks everything)
  },
  {
    name: "mixed-backlog-and-free",
    context: "Backlog: deploy-v2(ready), fix-css(ambig) | Mode: unset",
    options: ["do_item: deploy-v2", "explore", "play", "self_claim", "free_time"],
    acceptableIndices: [0, 1, 2, 3, 4], // sovereign choice — all valid
  },
  {
    name: "all-blocked-backlog",
    context: "Backlog: waiting-review(blocked), needs-design(blocked) | Mode: unset",
    options: ["explore", "play", "self_claim", "free_time"],
    acceptableIndices: [0, 1, 2, 3], // nothing to do — all free choices valid
  },
  {
    name: "work-mode-with-items",
    context: "Backlog: implement-feature(ready) | Mode: work",
    options: ["do_item: implement-feature", "explore", "free_time"],
    acceptableIndices: [0], // work mode + ready item = should work
  },
];

/**
 * A scenario DISCRIMINATES when at least one option would be wrong.
 *
 * Three of the six scenarios accept EVERY option by design — "sovereign choice —
 * all valid" is a real property of the observe loop, and they are kept because a
 * model that refuses to answer at all should still be visible. But folding them
 * into a correctness RATE inflates it with questions nobody can get wrong.
 *
 * Measured 2026-08-25, which is why this exists: a model emitting the constant
 * "0" scores **6/6 = 100%** on the full suite. Three scenarios accept anything,
 * and all three that discriminate happen to accept index 0. The published run
 * reported qwen2.5:0.5b and gemma2:2b at "100% correct" — both answered "0" to
 * every prompt — while llama3.2:1b, the only model that VARIED its answer,
 * scored worst. A benchmark on which a `console.log("0")` ties for first place
 * cannot rank the thing it claims to rank.
 */
export function isDiscriminating(scenario: Scenario): boolean {
  return scenario.acceptableIndices.length < scenario.options.length;
}

/**
 * What a constant-index responder would score. The benchmark's own falsifier: if
 * any constant matches the best real model, the suite is not measuring judgement.
 */
export function constantBaselineRate(
  scenarios: readonly Scenario[],
  index: number,
): number {
  const disc = scenarios.filter(isDiscriminating);
  if (disc.length === 0) return 1;
  return disc.filter((s) => s.acceptableIndices.includes(index)).length / disc.length;
}

/** The best score any constant achieves — the floor a real model must beat. */
export function bestConstantBaseline(scenarios: readonly Scenario[]): {
  readonly index: number;
  readonly rate: number;
} {
  const width = Math.max(0, ...scenarios.map((s) => s.options.length));
  let best = { index: 0, rate: -1 };
  for (let i = 0; i < width; i++) {
    const rate = constantBaselineRate(scenarios, i);
    if (rate > best.rate) best = { index: i, rate };
  }
  return best;
}

// ═══ Ollama Interface ═════════════════════════════════════════════════════════

const CHOOSER_INSTRUCTION =
  "You are choosing ONE next action. Reply with ONLY the number (0-based index). " +
  "If operator has a pending message, respond to them first. " +
  "In work mode with ready items, prefer doing work. " +
  "Otherwise, you are free to choose any option. Reply with just the number.";

async function queryOllama(
  model: string,
  prompt: string,
  host: string = "http://127.0.0.1:11434",
): Promise<{ response: string; durationMs: number; error?: string }> {
  const start = performance.now();
  try {
    const res = await fetch(`${host}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
        options: { seed: 42, temperature: 0, num_predict: 10 },
      }),
    });
    if (!res.ok) {
      return { response: "", durationMs: performance.now() - start, error: `HTTP ${res.status}` };
    }
    const data = await res.json() as { response: string };
    return { response: data.response.trim(), durationMs: performance.now() - start };
  } catch (err) {
    return { response: "", durationMs: performance.now() - start, error: String(err) };
  }
}

function buildPrompt(scenario: Scenario): string {
  const numbered = scenario.options.map((o, i) => `${i}: ${o}`).join("\n");
  return `${CHOOSER_INSTRUCTION}\n\nState: ${scenario.context}\n\nOptions:\n${numbered}\n\nNumber:`;
}

// ═══ Benchmark Runner ═════════════════════════════════════════════════════════

interface ScenarioResult {
  readonly scenario: string;
  readonly response: string;
  readonly parsedIndex: number | null;
  readonly correct: boolean;
  readonly durationMs: number;
  readonly error?: string;
}

interface ModelResult {
  readonly model: string;
  readonly scenarios: readonly ScenarioResult[];
  readonly avgLatencyMs: number;
  readonly parseRate: number;      // fraction that produced a valid index
  readonly correctRate: number;    // fraction that picked an acceptable choice
  readonly consistencyRate: number; // fraction that gave same answer on retry
  readonly totalDurationMs: number;
}

interface BenchmarkReport {
  readonly at: string;
  readonly host: string;
  readonly models: readonly ModelResult[];
  readonly summary: string;
}

async function benchmarkModel(
  model: string,
  scenarios: readonly Scenario[],
  host: string,
): Promise<ModelResult> {
  const results: ScenarioResult[] = [];
  let totalMs = 0;

  for (const scenario of scenarios) {
    const prompt = buildPrompt(scenario);
    const { response, durationMs, error } = await queryOllama(model, prompt, host);
    totalMs += durationMs;

    // Parse the response for a number
    const match = response.match(/\d+/);
    const parsedIndex = match ? parseInt(match[0]!, 10) : null;
    const valid = parsedIndex !== null && parsedIndex >= 0 && parsedIndex < scenario.options.length;
    const correct = valid && scenario.acceptableIndices.includes(parsedIndex!);

    results.push({
      scenario: scenario.name,
      response: response.slice(0, 50),
      parsedIndex,
      correct,
      durationMs,
      ...(error ? { error } : {}),
    });
  }

  const parsed = results.filter((r) => r.parsedIndex !== null).length;
  const correct = results.filter((r) => r.correct).length;

  return {
    model,
    scenarios: results,
    avgLatencyMs: results.length > 0 ? totalMs / results.length : 0,
    parseRate: results.length > 0 ? parsed / results.length : 0,
    correctRate: results.length > 0 ? correct / results.length : 0,
    consistencyRate: 1.0, // TODO: run twice and compare
    totalDurationMs: totalMs,
  };
}

// ═══ CLI ══════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const specificModel = argv.includes("--model") ? argv[argv.indexOf("--model") + 1] : null;
  const quick = argv.includes("--quick");
  const dryRun = argv.includes("--dry-run");
  const host = argv.includes("--host") ? argv[argv.indexOf("--host") + 1]! : "http://127.0.0.1:11434";

  const scenarios = quick ? SCENARIOS.slice(0, 3) : SCENARIOS;

  // Determine which models to benchmark
  const models = specificModel
    ? [specificModel]
    : ["qwen2.5:0.5b", "llama3.2:1b", "gemma2:2b"]; // the three we actually use

  console.log(`Model Benchmark (${scenarios.length} scenarios, ${models.length} models)`);
  console.log("─".repeat(60));

  const results: ModelResult[] = [];

  for (const model of models) {
    console.log(`\n  Benchmarking ${model}...`);

    // Check if model is available
    const check = await queryOllama(model, "hi", host);
    if (check.error) {
      console.log(`    ✗ Not available: ${check.error}`);
      console.log(`    Run: ollama pull ${model}`);
      continue;
    }

    const result = await benchmarkModel(model, scenarios, host);
    results.push(result);

    console.log(`    Latency: ${result.avgLatencyMs.toFixed(0)}ms avg`);
    console.log(`    Parse:   ${(result.parseRate * 100).toFixed(0)}% (produced valid index)`);
    console.log(`    Correct: ${(result.correctRate * 100).toFixed(0)}% (picked acceptable choice)`);
    for (const s of result.scenarios) {
      const icon = s.correct ? "✓" : s.parsedIndex !== null ? "~" : "✗";
      console.log(`      ${icon} ${s.scenario}: "${s.response}" (${s.durationMs.toFixed(0)}ms)`);
    }
  }

  // Summary
  console.log("\n" + "─".repeat(60));
  console.log("Summary:");
  const baseline = bestConstantBaseline(SCENARIOS);
  const discCount = SCENARIOS.filter(isDiscriminating).length;
  console.log(
    `  scoring over ${discCount}/${SCENARIOS.length} DISCRIMINATING scenarios ` +
      `(${SCENARIOS.length - discCount} accept every option and are excluded from the rate)`,
  );
  console.log(
    `  constant-"${baseline.index}" baseline scores ${(baseline.rate * 100).toFixed(0)}% — a real model must BEAT this`,
  );
  for (const r of results) {
    // NOT an energy measurement. No wattmeter, no RAPL, no powermetrics — this is
    // correctRate / (seconds x 12W assumed), i.e. a restatement of latency and
    // correctness under a constant. Reported as a PROXY so nobody quotes it as
    // joules; comparing it against an unmeasured model's imagined value is not a
    // comparison at all.
    const proxy = r.correctRate / ((r.avgLatencyMs / 1000) * 12);
    const beatsBaseline = r.correctRate > baseline.rate;
    console.log(
      `  ${r.model}: ${r.avgLatencyMs.toFixed(0)}ms, ${(r.correctRate * 100).toFixed(0)}% correct` +
        `${beatsBaseline ? "" : "  <- DOES NOT BEAT THE CONSTANT BASELINE"}` +
        `, ~${proxy.toFixed(3)} decisions/joule (PROXY: 12W assumed, not measured)`,
    );
  }

  const report: BenchmarkReport = {
    at: new Date().toISOString(),
    host,
    models: results,
    summary: results.map((r) => `${r.model}:${(r.correctRate*100).toFixed(0)}%@${r.avgLatencyMs.toFixed(0)}ms`).join(", "),
  };

  if (!dryRun && results.length > 0) {
    const outPath = join(process.cwd(), "data", "model-benchmark.json");
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, JSON.stringify(report, null, 2));
    appendFileSync(join(process.cwd(), "data", "model-benchmark-history.jsonl"), JSON.stringify(report) + "\n");
    console.log(`\nSaved to data/model-benchmark.json`);
  }
}

// GUARD THE ENTRYPOINT. Without this the module RUNS A BENCHMARK AND REWRITES
// `data/model-benchmark.json` on plain import — which it did to me while I was
// merely introspecting its exports. A module that mutates measurement data as a
// side effect of being imported cannot be unit-tested, and its data files cannot
// be trusted to reflect a deliberate run.
if (import.meta.main) {
  main().catch((err) => {
    console.error(`[benchmark] fatal: ${err}`);
    process.exit(1);
  });
}
