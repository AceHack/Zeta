#!/usr/bin/env bun
/**
 * run-decorr-selectors-hard.ts — the selector where the best model actually fails.
 *
 * W5 point 2: at 95% gemma-alone the task cannot discriminate, so no selector can add
 * value. This runs the SAME selectors on HARD items — long shuffled menus (the search-
 * deficit regime the design doc identified) — designed to push gemma-alone below ~80%,
 * which is the only regime where a selector can earn its 3× cost.
 *
 * The producer/verifier asymmetry predicts: gemma-alone drops on long menus (can't FIND
 * the answer), but gemma-as-verifier stays high (given a candidate, it can CHECK). If so,
 * the third-call-verifier should beat gemma-alone HERE where it couldn't at short menus.
 *
 * Usage: bun scripts/run-decorr-selectors-hard.ts [N] [preRegSha]
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

/** HARD scenarios: long menus (18–40 items) — the search-deficit regime. */
function generateHardScenarios(count: number): Scenario[] {
  const scenarios: Scenario[] = [];
  let s = 42;
  const rng = () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
  while (scenarios.length < count) {
    const menuSize = 18 + Math.floor(rng() * 23); // 18..40
    const opts: string[] = [];
    for (let j = 0; j < menuSize - 1; j++) opts.push(`do_item: task-${j}`);
    const insertPos = Math.floor(rng() * menuSize); // buried anywhere
    opts.splice(insertPos, 0, "respond_to_operator");
    scenarios.push({
      context: `Operator: msg=true ferry=false | Backlog: ${menuSize - 1} items(ready) | Mode: work`,
      options: opts, correctIndex: insertPos,
    });
  }
  return scenarios;
}

async function produce(model: string, sc: Scenario): Promise<{ idx: number | null; ms: number }> {
  const numbered = sc.options.map((o, i) => `${i}: ${o}`).join("\n");
  const prompt = `Choose ONE action. Reply ONLY the number. Operator outranks everything.\n\nState: ${sc.context}\n\nOptions:\n${numbered}\n\nNumber:`;
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
    return { idx: idx >= 0 && idx < sc.options.length ? idx : null, ms };
  } catch { return { idx: null, ms: performance.now() - start }; }
}

async function verifyApproves(model: string, sc: Scenario, candidate: number): Promise<{ approve: boolean; ms: number }> {
  const cand = sc.options[candidate]!;
  const prompt = `You are verifying whether a proposed action is correct.\n\nRULES:\n- If operator has a pending message, the ONLY correct action is "respond_to_operator"\n- Operator ALWAYS outranks work items\n\nSTATE: ${sc.context}\n\nPROPOSED: "${cand}"\n\nIs this correct? Reply ONLY "yes" or "no".`;
  // W11/W12 invariant: this prompt NAMES the correct option (`respond_to_operator`) as the
  // rule, which is the leak Otto found (W10: producer 58.7%->98.0% given the same rule).
  // The guard refuses to run so this experiment cannot be repeated as-is. To re-enable it
  // honestly, the verifier prompt must NOT carry the answer key the producer lacks.
  const leak = detectAnswerLeak(prompt, sc.options[sc.correctIndex]!);
  if (leak.leaked) {
    throw new Error(`LEAK GUARD (W11): ${leak.via}. This run measured the prompt, not the roles — see W10. Refusing to run.`);
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
  const scenarios = generateHardScenarios(N);
  const producer = "qwen2.5:0.5b";
  const coProducer = "gemma2:2b";
  const verifier = "gemma2:2b";

  console.log(`HARD selector experiment (W5 point 2) — long menus, search-deficit regime`);
  console.log(`Producer=${producer}  co-producer/verifier=${verifier}  N=${N}  menu=18..40  preReg=${preRegSha ?? "none"}`);
  console.log("═".repeat(70));

  const trials: SelectorTrial[] = [];
  const raw: unknown[] = [];
  for (let i = 0; i < scenarios.length; i++) {
    const sc = scenarios[i]!;
    const A = await produce(producer, sc);
    const B = await produce(coProducer, sc);
    const approves: { [k: number]: boolean } = {};
    let verifierMs = 0;
    for (const choice of new Set([A.idx, B.idx].filter((x): x is number => x !== null))) {
      const v = await verifyApproves(verifier, sc, choice);
      approves[choice] = v.approve;
      verifierMs += v.ms;
    }
    trials.push({ aChoice: A.idx, bChoice: B.idx, correctIndex: sc.correctIndex, verifierApproves: approves, aMs: A.ms, bMs: B.ms, verifierMs });
    raw.push({ i, menuSize: sc.options.length, correctIndex: sc.correctIndex, aChoice: A.idx, bChoice: B.idx, approves, aMs: A.ms, bMs: B.ms, verifierMs });
    if ((i + 1) % 20 === 0) process.stdout.write(`  ${i + 1}/${N}\r`);
  }

  const accA = trials.filter((t) => t.aChoice === t.correctIndex).length / N;
  const accB = trials.filter((t) => t.bChoice === t.correctIndex).length / N;
  const strongerIsA = accA >= accB;
  console.log(`\nMeasured accuracy: ${producer}=${(accA*100).toFixed(1)}%  ${coProducer}=${(accB*100).toFixed(1)}%  (stronger=${strongerIsA ? producer : coProducer})\n`);

  const results = [
    scoreSelector("agreement-gating", agreementGating(strongerIsA), trials),
    scoreSelector("third-call-verifier", thirdCallVerifier(strongerIsA), trials),
  ];
  for (const r of results) { console.log(formatSelectorResult(r)); console.log("─".repeat(70)); }

  const rawPath = join(repoRoot, "data", "decorr-selectors-hard-raw.jsonl");
  mkdirSync(dirname(rawPath), { recursive: true });
  writeFileSync(rawPath, raw.map((r) => JSON.stringify(r)).join("\n") + "\n");

  const ledgerPath = join(repoRoot, "data", "decorrelation-research.jsonl");
  const summary = {
    schema: "decorr/v2-selector",
    axis: { axis: "hat:producer-verifier:hard", description: `HARD long menus (18-40). ${producer}+${coProducer} co-produce; ${verifier} verifies`, kind: "candidate" },
    register: "unmetered", n: N,
    accuracyA: wilsonInterval(trials.filter((t) => t.aChoice === t.correctIndex).length, N),
    accuracyB: wilsonInterval(trials.filter((t) => t.bChoice === t.correctIndex).length, N),
    selectors: results.map((r) => ({ name: r.name, accuracy: r.accuracy, bestSingle: r.bestSingle, unionUpperBound: r.unionUpperBound, liftOverBest: r.liftOverBest, selectionTax: r.selectionTax, meanMs: r.meanMs, verdict: r.verdict })),
    rawLog: "data/decorr-selectors-hard-raw.jsonl", preRegistrationSha: preRegSha, measuredAt: new Date().toISOString(),
  };
  appendFileSync(ledgerPath, JSON.stringify(summary) + "\n");
  console.log("Recorded HARD selector summary + raw per-item log.");
}

main();
