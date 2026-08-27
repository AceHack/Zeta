#!/usr/bin/env bun
/**
 * run-decorr-clauseswap.ts — W15: the one arm that cleared the floor, at the pre-reg N.
 *
 * clause-swap was the only prompt-frame arm to exceed the 2.7% noise floor (7.3% at
 * N=150) — the sole live hypothesis. The pre-registration stop-rule is N=400; the power
 * calc for the union-vs-best gap suggested N~1861. This runs clause-swap AND the null arm
 * (fresh noise floor for THIS run) at a configurable N and reports whether the flip rate
 * beats the floor with CIs that separate.
 *
 * It reuses the harness's arms and contamination check, so options are never touched.
 *
 * Usage: bun scripts/run-decorr-clauseswap.ts [N] [preRegSha]
 */
import { appendFileSync } from "node:fs";
import { join } from "node:path";
import { PROMPT_ARMS, testPromptArm, formatMeasurement, recordMeasurement } from "../src/Core.TypeScript/observe/decorrelation-harness";
import { proportionDiffInterval } from "../src/Core.TypeScript/observe/decorrelation-stats";

const N = parseInt(process.argv[2] ?? "400", 10);
const preRegSha = process.argv[3] ?? undefined;
const MODEL = "gemma2:2b";
const HOST = "http://127.0.0.1:11434";
const repoRoot = process.cwd();

function generateScenarios(count: number) {
  const scenarios: { context: string; options: string[]; correctIndex: number }[] = [];
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

async function main() {
  const scenarios = generateScenarios(N);
  const nullArm = PROMPT_ARMS.find((a) => a.name === "null-identity")!;
  const clauseArm = PROMPT_ARMS.find((a) => a.name === "clause-swap")!;

  console.log(`W15 clause-swap at pre-registered N (${N})`);
  console.log(`Model=${MODEL}  preReg=${preRegSha ?? "none"}`);
  console.log("═".repeat(70));

  console.log("\nNULL ARM (fresh noise floor for this run):");
  const nullR = await testPromptArm(MODEL, nullArm, scenarios, HOST);
  console.log(formatMeasurement(nullR));
  const floor = 1 - nullR.agreementRate;
  const nullArmVerdict = `NOISE FLOOR = ${(floor * 100).toFixed(1)}% (${Math.round(floor * N)}/${N} flips)`;
  recordMeasurement(repoRoot, nullR, { preRegistrationSha: preRegSha, nullArmVerdict });

  console.log("\n" + "─".repeat(70));
  console.log("CLAUSE-SWAP:");
  const clauseR = await testPromptArm(MODEL, clauseArm, scenarios, HOST);
  console.log(formatMeasurement(clauseR));
  const clauseFlip = 1 - clauseR.agreementRate;

  // Is the clause-swap flip rate distinguishable from the null flip rate, with CIs?
  const nullFlips = Math.round(floor * N);
  const clauseFlips = Math.round(clauseFlip * N);
  const diff = proportionDiffInterval(clauseFlips, N, nullFlips, N);
  const separates = diff.lo > 0;
  console.log(`\n  clause-swap flip=${(clauseFlip*100).toFixed(1)}%  null floor=${(floor*100).toFixed(1)}%`);
  console.log(`  difference = ${(diff.point*100).toFixed(1)}pp  95% CI [${(diff.lo*100).toFixed(1)}, ${(diff.hi*100).toFixed(1)}]`);
  console.log(`  VERDICT: ${separates ? "clause-swap EXCEEDS the noise floor (CI excludes 0) — a real prompt-frame axis" : "NOT distinguishable from the noise floor at this N — still underpowered"}`);
  recordMeasurement(repoRoot, clauseR, { preRegistrationSha: preRegSha, nullArmVerdict });

  // Record the head-to-head diff as its own ledger line.
  appendFileSync(join(repoRoot, "data", "decorrelation-research.jsonl"), JSON.stringify({
    schema: "decorr/v2-arm-vs-null",
    axis: { axis: "prompt-frame:clause-swap-vs-null", description: "clause-swap flip rate vs null-arm noise floor at pre-registered N", kind: "candidate" },
    register: "unmetered", n: N,
    clauseFlipRate: clauseFlip, nullFloor: floor,
    diffPoint: diff.point, diffLo: diff.lo, diffHi: diff.hi,
    separatesFromFloor: separates,
    verdict: separates ? "exceeds-floor" : "underpowered",
    preRegistrationSha: preRegSha, measuredAt: new Date().toISOString(),
  }) + "\n");
  console.log("\nRecorded clause-swap-vs-null head-to-head.");
}

main();
