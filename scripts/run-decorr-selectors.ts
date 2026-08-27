#!/usr/bin/env bun
/**
 * run-decorr-selectors.ts — W4/W5: real selectors on real model outputs.
 *
 * The hat axis (producer → verifier) is literally the third-call-verifier selector. This
 * run measures what the earlier F2 "28% → 93%" number actually was: a MEASURED selector,
 * not a union oracle. We run two producers (qwen, llama) and gemma as both a co-producer
 * and a verifier, then score:
 *
 *   - each model alone (with 95% CI)
 *   - agreement-gating (qwen + gemma), fallback to the stronger
 *   - third-call-verifier (producer + gemma-verifier)
 *
 * against max(A,B) and the union oracle. A selector that lands below max(A,B) is reported
 * as such. Every per-item observation is written to a raw JSONL so the numbers are
 * recomputable without a model.
 *
 * Usage: bun scripts/run-decorr-selectors.ts [N] [preRegSha]
 */
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import {
  agreementGating, thirdCallVerifier, scoreSelector, formatSelectorResult,
  type SelectorTrial,
} from "../src/Core.TypeScript/observe/decorrelation-selectors";
import { wilsonInterval, detectAnswerLeak } from "../src/Core.TypeScript/observe/decorrelation-stats";

const N = parseInt(process.argv[2] ?? "150", 10);
const preRegSha = process.argv[3] ?? null;
const HOST = "http://127.0.0.1:11434";
const repoRoot = process.cwd();

interface Scenario { context: string; options: string[]; correctIndex: number; }

function generateScenarios(count: number): Scenario[] {
  const scenarios: Scenario[] = [];
  let s = 42;
  const rng = () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
  while (scenarios.length < count) {
    const menuSize = 6 + Math.floor(rng() * 6);
    const opts: string[] = [];
    for (let j = 0; j < menuSize - 1; j++) opts.push(`do_item: task-${j}`);
    const insertPos = Math.floor(rng() * menuSize);
    opts.splice(insertPos, 0, "respond_to_operator");
    scenarios.push({
      context: `Operator: msg=true ferry=false | Backlog: ${menuSize - 1} items(ready) | Mode: work`,
      options: opts, correctIndex: insertPos,
    });
  }
  return scenarios;
}

async function produce(model: string, s: Scenario): Promise<{ idx: number | null; ms: number }> {
  const numbered = s.options.map((o, i) => `${i}: ${o}`).join("\n");
  const prompt = `Choose ONE action. Reply ONLY the number. Operator outranks everything.\n\nState: ${s.context}\n\nOptions:\n${numbered}\n\nNumber:`;
  const start = performance.now();
  try {
    const res = await fetch(`${HOST}/api/generate`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, stream: false, options: { seed: 42, temperature: 0, num_predict: 10 } }),
    });
    const data = await res.json() as { response: string };
    const ms = performance.now() - start;
    const m = data.response.trim().match(/\d+/);
    if (!m) return { idx: null, ms };
    const idx = parseInt(m[0]!, 10);
    return { idx: idx >= 0 && idx < s.options.length ? idx : null, ms };
  } catch { return { idx: null, ms: performance.now() - start }; }
}

async function verifyApproves(model: string, s: Scenario, candidate: number): Promise<{ approve: boolean; ms: number }> {
  const cand = s.options[candidate]!;
  const prompt = `You are verifying whether a proposed action is correct.\n\nRULES:\n- If operator has a pending message, the ONLY correct action is "respond_to_operator"\n- Operator ALWAYS outranks work items\n\nSTATE: ${s.context}\n\nPROPOSED: "${cand}"\n\nIs this correct? Reply ONLY "yes" or "no".`;
  // W11/W12 invariant: this prompt names the correct option as the rule (the W10 leak).
  // The guard refuses to run until the verifier stops carrying the answer key.
  const leak = detectAnswerLeak(prompt, s.options[s.correctIndex]!);
  if (leak.leaked) {
    throw new Error(`LEAK GUARD (W11): ${leak.via}. Measured the prompt, not the roles (see W10). Refusing to run.`);
  }
  const start = performance.now();
  try {
    const res = await fetch(`${HOST}/api/generate`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, stream: false, options: { seed: 42, temperature: 0, num_predict: 10 } }),
    });
    const data = await res.json() as { response: string };
    const ms = performance.now() - start;
    const r = data.response.trim().toLowerCase();
    return { approve: r.includes("yes") && !r.includes("no"), ms };
  } catch { return { approve: false, ms: performance.now() - start }; }
}

async function main() {
  const scenarios = generateScenarios(N);
  const producer = "qwen2.5:0.5b";
  const coProducer = "gemma2:2b";
  const verifier = "gemma2:2b";

  console.log(`Selector experiment (W4/W5) — real selectors on real outputs`);
  console.log(`Producer=${producer}  co-producer/verifier=${verifier}  N=${N}  preReg=${preRegSha ?? "none"}`);
  console.log("═".repeat(70));

  const trials: SelectorTrial[] = [];
  const raw: unknown[] = [];

  for (let i = 0; i < scenarios.length; i++) {
    const s = scenarios[i]!;
    const A = await produce(producer, s);      // config A: qwen
    const B = await produce(coProducer, s);    // config B: gemma

    // Verifier judges BOTH candidates (only needed on disagreement, but we record both
    // so the raw log is complete and the selector is recomputable offline).
    const approves: { [k: number]: boolean } = {};
    let verifierMs = 0;
    for (const choice of new Set([A.idx, B.idx].filter((x): x is number => x !== null))) {
      const v = await verifyApproves(verifier, s, choice);
      approves[choice] = v.approve;
      verifierMs += v.ms;
    }

    const t: SelectorTrial = {
      aChoice: A.idx, bChoice: B.idx, correctIndex: s.correctIndex,
      verifierApproves: approves, aMs: A.ms, bMs: B.ms, verifierMs,
    };
    trials.push(t);
    raw.push({ i, context: s.context, correctIndex: s.correctIndex, aChoice: A.idx, bChoice: B.idx, approves, aMs: A.ms, bMs: B.ms, verifierMs });
    if ((i + 1) % 20 === 0) process.stdout.write(`  ${i + 1}/${N}\r`);
  }

  // Determine which producer is stronger (measured, not per-item).
  const accA = trials.filter((t) => t.aChoice === t.correctIndex).length / N;
  const accB = trials.filter((t) => t.bChoice === t.correctIndex).length / N;
  const strongerIsA = accA >= accB;

  console.log(`\nMeasured accuracy: ${producer}=${(accA*100).toFixed(1)}%  ${coProducer}=${(accB*100).toFixed(1)}%  (stronger=${strongerIsA ? producer : coProducer})\n`);

  const results = [
    scoreSelector("agreement-gating", agreementGating(strongerIsA), trials),
    scoreSelector("third-call-verifier", thirdCallVerifier(strongerIsA), trials),
  ];
  for (const r of results) {
    console.log(formatSelectorResult(r));
    console.log("─".repeat(70));
  }

  // Write the raw per-item log (recomputable without a model).
  const rawPath = join(repoRoot, "data", "decorr-selectors-raw.jsonl");
  mkdirSync(dirname(rawPath), { recursive: true });
  writeFileSync(rawPath, raw.map((r) => JSON.stringify(r)).join("\n") + "\n");

  // Append summary to the research ledger.
  const ledgerPath = join(repoRoot, "data", "decorrelation-research.jsonl");
  const summary = {
    schema: "decorr/v2-selector",
    axis: { axis: "hat:producer-verifier", description: `${producer}+${coProducer} co-produce; ${verifier} verifies on disagreement`, kind: "candidate" },
    register: "unmetered",
    n: N,
    accuracyA: wilsonInterval(trials.filter((t) => t.aChoice === t.correctIndex).length, N),
    accuracyB: wilsonInterval(trials.filter((t) => t.bChoice === t.correctIndex).length, N),
    selectors: results.map((r) => ({
      name: r.name, accuracy: r.accuracy, bestSingle: r.bestSingle,
      unionUpperBound: r.unionUpperBound, liftOverBest: r.liftOverBest,
      selectionTax: r.selectionTax, meanMs: r.meanMs, verdict: r.verdict,
    })),
    rawLog: "data/decorr-selectors-raw.jsonl",
    preRegistrationSha: preRegSha,
    measuredAt: new Date().toISOString(),
  };
  appendFileSync(ledgerPath, JSON.stringify(summary) + "\n");
  console.log("Recorded selector summary + raw per-item log.");
}

main();
