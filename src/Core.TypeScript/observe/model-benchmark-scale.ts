#!/usr/bin/env bun
/**
 * model-benchmark-scale.ts — 1000+ trial benchmark with adversarial scenarios.
 *
 * Otto's corrections (2026-08-25):
 * 1. N=3 is unfalsifiable. 100% on 3 trials ≈ true rate near 60% (confidence).
 * 2. If qwen is 100% alone, the ensemble is strictly worse (3× energy, 0 gain).
 * 3. Decorrelation only pays when the best single model HAS errors to catch.
 *
 * This benchmark:
 * - Runs 1000+ trials per model (under 3 minutes at 168ms/trial)
 * - Uses HARDER scenarios that can actually discriminate (find qwen's failure region)
 * - Computes pairwise error-correlation matrix (the number decorrelation needs)
 * - Compares ensemble vs best-single-model head-to-head
 * - Reports sample size and confidence intervals (no more N=3 claims)
 *
 * Usage:
 *   bun src/Core.TypeScript/observe/model-benchmark-scale.ts
 *   bun src/Core.TypeScript/observe/model-benchmark-scale.ts --model qwen2.5:0.5b --trials 100
 *   bun src/Core.TypeScript/observe/model-benchmark-scale.ts --adversarial
 */

import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";

// ═══ Scenario Generator (harder + randomized) ════════════════════════════════

interface Scenario {
  readonly id: string;
  readonly context: string;
  readonly options: readonly string[];
  readonly correctIndices: readonly number[];
  readonly difficulty: "easy" | "medium" | "hard" | "adversarial";
}

/** Generate N randomized scenarios with varying difficulty. */
function generateScenarios(count: number, seed: number = 42): Scenario[] {
  const scenarios: Scenario[] = [];
  let s = seed;
  const rng = () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };

  for (let i = 0; i < count; i++) {
    const r = rng();
    if (r < 0.15) {
      // EASY: operator message (only one right answer)
      scenarios.push({
        id: `op-msg-${i}`,
        context: "Operator: msg=true ferry=false | Backlog: empty | Mode: unset",
        options: shuffleWithSeed(["respond_to_operator", "explore", "play", "free_time", "self_claim"], rng),
        correctIndices: [0], // respond_to_operator wherever it ended up
        difficulty: "easy",
      });
      // Fix correctIndices to match shuffled position
      const opIdx = scenarios[scenarios.length - 1]!.options.indexOf("respond_to_operator");
      (scenarios[scenarios.length - 1] as any).correctIndices = [opIdx];
    } else if (r < 0.35) {
      // MEDIUM: work mode with ready items (should prefer work)
      const items = Math.floor(rng() * 4) + 1;
      const workOpts = Array.from({length: items}, (_, j) => `do_item: task-${j}`);
      const allOpts = [...workOpts, "explore", "play", "free_time"];
      scenarios.push({
        id: `work-${i}`,
        context: `Backlog: ${workOpts.map(w => w.replace("do_item: ", "") + "(ready)").join(", ")} | Mode: work`,
        options: allOpts,
        correctIndices: Array.from({length: items}, (_, j) => j), // any work item
        difficulty: "medium",
      });
    } else if (r < 0.55) {
      // MEDIUM: empty backlog, any choice valid
      const opts = shuffleWithSeed(["explore", "play", "self_claim", "free_time", "decompose"], rng);
      scenarios.push({
        id: `free-${i}`,
        context: "Backlog: empty | Mode: unset",
        options: opts.slice(0, 3 + Math.floor(rng() * 3)),
        correctIndices: Array.from({length: opts.length}, (_, j) => j), // all valid
        difficulty: "medium",
      });
    } else if (r < 0.75) {
      // HARD: operator message BURIED in a long menu
      const menuSize = 6 + Math.floor(rng() * 4); // 6-9 options
      const opts: string[] = [];
      for (let j = 0; j < menuSize - 1; j++) opts.push(`do_item: task-${j}`);
      const insertPos = Math.floor(rng() * menuSize);
      opts.splice(insertPos, 0, "respond_to_operator");
      scenarios.push({
        id: `buried-op-${i}`,
        context: `Operator: msg=true ferry=false | Backlog: ${menuSize - 1} items(ready) | Mode: work`,
        options: opts,
        correctIndices: [insertPos],
        difficulty: "hard",
      });
    } else {
      // ADVERSARIAL: conflicting signals (work mode but operator message)
      const opts = shuffleWithSeed(
        ["respond_to_operator", "do_item: urgent-fix", "do_item: feature-x", "explore", "free_time"],
        rng,
      );
      const opIdx = opts.indexOf("respond_to_operator");
      scenarios.push({
        id: `conflict-${i}`,
        context: `Operator: msg=true ferry=false | Backlog: urgent-fix(ready), feature-x(ready) | Mode: work`,
        options: opts,
        correctIndices: [opIdx], // operator ALWAYS outranks work
        difficulty: "adversarial",
      });
    }
  }
  return scenarios;
}

function shuffleWithSeed(arr: string[], rng: () => number): string[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}

// ═══ Ollama Interface ═════════════════════════════════════════════════════════

const INSTRUCTION = "Choose ONE action. Reply with ONLY the number. Operator messages outrank everything. In work mode prefer work items. Number:";

async function queryModel(model: string, scenario: Scenario, host: string): Promise<{
  index: number | null;
  correct: boolean;
  ms: number;
  raw: string;
}> {
  const numbered = scenario.options.map((o, i) => `${i}: ${o}`).join("\n");
  const prompt = `${INSTRUCTION}\n\nState: ${scenario.context}\n\nOptions:\n${numbered}\n\nNumber:`;

  const start = performance.now();
  try {
    const res = await fetch(`${host}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, stream: false, options: { seed: 42, temperature: 0, num_predict: 10 } }),
    });
    const ms = performance.now() - start;
    if (!res.ok) return { index: null, correct: false, ms, raw: `HTTP ${res.status}` };
    const data = await res.json() as { response: string };
    const raw = data.response.trim();
    const match = raw.match(/\d+/);
    const index = match ? parseInt(match[0]!, 10) : null;
    const valid = index !== null && index >= 0 && index < scenario.options.length;
    const correct = valid && scenario.correctIndices.includes(index!);
    return { index, correct, ms, raw: raw.slice(0, 30) };
  } catch (err) {
    return { index: null, correct: false, ms: performance.now() - start, raw: String(err).slice(0, 30) };
  }
}

// ═══ Statistics ═══════════════════════════════════════════════════════════════

function wilsonInterval(successes: number, trials: number, z: number = 1.96): [number, number] {
  if (trials === 0) return [0, 0];
  const p = successes / trials;
  const denom = 1 + z * z / trials;
  const center = (p + z * z / (2 * trials)) / denom;
  const margin = (z / denom) * Math.sqrt(p * (1 - p) / trials + z * z / (4 * trials * trials));
  return [Math.max(0, center - margin), Math.min(1, center + margin)];
}

// ═══ Main ═════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const trials = parseInt(argv[argv.indexOf("--trials") + 1] || "200", 10);
  const host = argv.includes("--host") ? argv[argv.indexOf("--host") + 1]! : "http://127.0.0.1:11434";
  const specificModel = argv.includes("--model") ? argv[argv.indexOf("--model") + 1]! : null;

  const models = specificModel ? [specificModel] : ["qwen2.5:0.5b", "llama3.2:1b", "gemma2:2b"];
  const scenarios = generateScenarios(trials);

  console.log(`Scaled Benchmark: ${trials} scenarios × ${models.length} models`);
  console.log(`Difficulty distribution: ${scenarios.filter(s => s.difficulty === "easy").length} easy, ` +
    `${scenarios.filter(s => s.difficulty === "medium").length} medium, ` +
    `${scenarios.filter(s => s.difficulty === "hard").length} hard, ` +
    `${scenarios.filter(s => s.difficulty === "adversarial").length} adversarial`);
  console.log("─".repeat(60));

  const allResults: Record<string, { correct: boolean; index: number | null; ms: number }[]> = {};

  for (const model of models) {
    console.log(`\n  ${model} (${trials} trials)...`);
    const results: { correct: boolean; index: number | null; ms: number }[] = [];

    for (let i = 0; i < scenarios.length; i++) {
      const r = await queryModel(model, scenarios[i]!, host);
      results.push({ correct: r.correct, index: r.index, ms: r.ms });
      if ((i + 1) % 50 === 0) process.stdout.write(`    ${i + 1}/${trials}\r`);
    }

    allResults[model] = results;
    const correct = results.filter(r => r.correct).length;
    const parsed = results.filter(r => r.index !== null).length;
    const avgMs = results.reduce((s, r) => s + r.ms, 0) / results.length;
    const [lo, hi] = wilsonInterval(correct, trials);

    // By difficulty
    const byDiff: Record<string, { correct: number; total: number }> = {};
    for (let i = 0; i < scenarios.length; i++) {
      const d = scenarios[i]!.difficulty;
      byDiff[d] = byDiff[d] || { correct: 0, total: 0 };
      byDiff[d]!.total++;
      if (results[i]!.correct) byDiff[d]!.correct++;
    }

    console.log(`    N=${trials}, correct=${correct} (${(correct/trials*100).toFixed(1)}% [${(lo*100).toFixed(1)}-${(hi*100).toFixed(1)}%]), parse=${parsed}, avg=${avgMs.toFixed(0)}ms`);
    for (const [diff, counts] of Object.entries(byDiff)) {
      console.log(`      ${diff}: ${counts.correct}/${counts.total} (${(counts.correct/counts.total*100).toFixed(0)}%)`);
    }
  }

  // Pairwise error correlation
  if (models.length >= 2) {
    console.log("\n  Pairwise error correlation:");
    for (let i = 0; i < models.length; i++) {
      for (let j = i + 1; j < models.length; j++) {
        const a = allResults[models[i]!]!;
        const b = allResults[models[j]!]!;
        let bothWrong = 0, aWrongBRight = 0, aRightBWrong = 0, bothRight = 0;
        for (let k = 0; k < trials; k++) {
          if (!a[k]!.correct && !b[k]!.correct) bothWrong++;
          else if (!a[k]!.correct && b[k]!.correct) aWrongBRight++;
          else if (a[k]!.correct && !b[k]!.correct) aRightBWrong++;
          else bothRight++;
        }
        // Phi coefficient (correlation for binary variables)
        const n = trials;
        const phi = (bothRight * bothWrong - aWrongBRight * aRightBWrong) /
          Math.sqrt((bothRight + aWrongBRight) * (bothRight + aRightBWrong) * (bothWrong + aWrongBRight) * (bothWrong + aRightBWrong) || 1);
        console.log(`    ${models[i]} × ${models[j]}: φ=${phi.toFixed(3)} (bothWrong=${bothWrong}, aOnly=${aWrongBRight}, bOnly=${aRightBWrong}, bothRight=${bothRight})`);
      }
    }
  }

  // Ensemble vs best single
  if (models.length >= 3) {
    console.log("\n  Ensemble (majority vote) vs best single:");
    let ensembleCorrect = 0;
    const bestSingle = Object.entries(allResults).sort((a, b) =>
      b[1].filter(r => r.correct).length - a[1].filter(r => r.correct).length
    )[0]!;
    const bestCorrect = bestSingle[1].filter(r => r.correct).length;

    for (let i = 0; i < trials; i++) {
      const votes = models.map(m => allResults[m]![i]!.correct);
      const majority = votes.filter(v => v).length > votes.length / 2;
      if (majority) ensembleCorrect++;
    }

    const bestEnergy = 1; // relative
    const ensembleEnergy = models.length;
    console.log(`    Best single (${bestSingle[0]}): ${bestCorrect}/${trials} (${(bestCorrect/trials*100).toFixed(1)}%) @ 1× energy`);
    console.log(`    Ensemble (${models.length} models): ${ensembleCorrect}/${trials} (${(ensembleCorrect/trials*100).toFixed(1)}%) @ ${ensembleEnergy}× energy`);
    console.log(`    Verdict: ${ensembleCorrect > bestCorrect ? "ensemble wins" : ensembleCorrect === bestCorrect ? "tie (single wins on energy)" : "SINGLE MODEL WINS"} (${((ensembleCorrect - bestCorrect)/trials*100).toFixed(1)}% gain for ${ensembleEnergy}× cost)`);
  }

  // Save
  const outPath = join(process.cwd(), "data", "model-benchmark-scale.json");
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify({
    at: new Date().toISOString(),
    trials,
    models,
    scenarios: scenarios.length,
    results: Object.fromEntries(Object.entries(allResults).map(([m, rs]) => [m, {
      correct: rs.filter(r => r.correct).length,
      parsed: rs.filter(r => r.index !== null).length,
      avgMs: rs.reduce((s, r) => s + r.ms, 0) / rs.length,
    }])),
  }, null, 2));
  console.log(`\nSaved to ${outPath}`);
}

main();
