#!/usr/bin/env bun
/**
 * run-decorr-agreement-gating.ts — does clause-swap PAY? (pre-registered H2)
 *
 * Pre-registration: docs/research/decorrelation-preregistration-agreement-gating.md
 * (commit its sha as the second arg; committed BEFORE this runs).
 *
 * Design (Otto's three additions + two method fixes):
 *   - Power stated in the pre-reg: N=1200 resolves ~3pp lift at 80% (unpaired, conservative).
 *   - Falsifier pre-declared: abandon clause-swap-as-paying if agreement-gating ≤ best-single
 *     (McNemar CI includes/below 0) OR the discordant split is symmetric (b≈c).
 *   - Leak falsifier green PER-ARM (canonical, clause-swap, null) — all producer prompts.
 *   - Null arm INTERLEAVED by seed parity (contemporaneous floor).
 *   - Paired McNemar analysis, not unpaired.
 *
 * Register: unmetered. Headline stays "decorrelates, not yet shown to pay" unless the
 * McNemar CI on the lift excludes zero.
 *
 * Usage: bun scripts/run-decorr-agreement-gating.ts [N] [preRegSha]
 */
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { agreementGating, scoreSelector, type SelectorTrial } from "../src/Core.TypeScript/observe/decorrelation-selectors";
import { mcNemar, detectAnswerLeak } from "../src/Core.TypeScript/observe/decorrelation-stats";

const N = parseInt(process.argv[2] ?? "1200", 10);
const preRegSha = process.argv[3] ?? null;
const MODEL = "gemma2:2b";
const HOST = "http://127.0.0.1:11434";
const repoRoot = process.cwd();

const CANONICAL = "Choose ONE action. Reply ONLY the number. Operator outranks everything.";
const CLAUSE_SWAP = "Operator outranks everything. Choose ONE action; reply ONLY the number.";

interface Scenario { context: string; options: string[]; correctIndex: number; seed: number; }

function generateScenarios(count: number): Scenario[] {
  const scenarios: Scenario[] = [];
  let s = 42;
  const rng = () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
  let seed = 1;
  while (scenarios.length < count) {
    const menuSize = 6 + Math.floor(rng() * 6);
    const opts: string[] = [];
    for (let j = 0; j < menuSize - 1; j++) opts.push(`do_item: task-${j}`);
    const insertPos = Math.floor(rng() * menuSize);
    opts.splice(insertPos, 0, "respond_to_operator");
    scenarios.push({
      context: `Operator: msg=true ferry=false | Backlog: ${menuSize - 1} items(ready) | Mode: work`,
      options: opts, correctIndex: insertPos, seed: seed++,
    });
  }
  return scenarios;
}

function buildPrompt(instruction: string, sc: Scenario): { prompt: string; optionsBlock: string } {
  const optionsBlock = sc.options.map((o, i) => `${i}: ${o}`).join("\n");
  return { prompt: `${instruction}\n\nState: ${sc.context}\n\nOptions:\n${optionsBlock}\n\nNumber:`, optionsBlock };
}

async function ask(prompt: string, nOptions: number): Promise<{ idx: number | null; ms: number }> {
  const start = performance.now();
  try {
    const res = await fetch(`${HOST}/api/generate`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, prompt, stream: false, options: { seed: 42, temperature: 0, num_predict: 10 } }),
    });
    const data = await res.json() as { response: string };
    const ms = performance.now() - start;
    const m = data.response.trim().match(/\d+/);
    if (!m) return { idx: null, ms };
    const idx = parseInt(m[0]!, 10);
    return { idx: idx >= 0 && idx < nOptions ? idx : null, ms };
  } catch { return { idx: null, ms: performance.now() - start }; }
}

async function main() {
  const scenarios = generateScenarios(N);
  console.log(`Agreement-gating: does clause-swap PAY? (H2)`);
  console.log(`Model=${MODEL}  N=${N}  preReg=${preRegSha ?? "MISSING — commit pre-reg first"}`);
  console.log("═".repeat(70));

  // PER-ARM leak check on the INSTRUCTION region only (the options menu legitimately
  // contains the correct option — that is the choice set, not a leak). All three are
  // producer instructions with no answer key, so all must be green.
  const probe = scenarios[0]!;
  for (const [name, instr] of [["canonical", CANONICAL], ["clause-swap", CLAUSE_SWAP], ["null-identity", CANONICAL]] as const) {
    const leak = detectAnswerLeak(instr, probe.options[probe.correctIndex]!);
    if (leak.leaked) { console.error(`LEAK on ${name}: ${leak.via}`); process.exit(1); }
  }
  console.log("Leak falsifier: GREEN on canonical, clause-swap, null-identity instructions (no answer key).\n");

  // Candidate: canonical vs clause-swap (odd seeds). Null: canonical vs canonical (even seeds).
  // Interleaved by seed parity so the floor is contemporaneous.
  const candidate: SelectorTrial[] = [];
  const nullTrials: { aCorrect: boolean; bCorrect: boolean }[] = [];
  let done = 0;

  for (const sc of scenarios) {
    const canon = buildPrompt(CANONICAL, sc);
    const A = await ask(canon.prompt, sc.options.length);

    if (sc.seed % 2 === 0) {
      // NULL arm: identical prompt again.
      const A2 = await ask(canon.prompt, sc.options.length);
      nullTrials.push({ aCorrect: A.idx === sc.correctIndex, bCorrect: A2.idx === sc.correctIndex });
    } else {
      // CANDIDATE arm: clause-swap.
      const clause = buildPrompt(CLAUSE_SWAP, sc);
      const B = await ask(clause.prompt, sc.options.length);
      candidate.push({
        aChoice: A.idx, bChoice: B.idx, correctIndex: sc.correctIndex,
        aMs: A.ms, bMs: B.ms,
      });
    }
    if (++done % 50 === 0) process.stdout.write(`  ${done}/${N}\r`);
  }

  // Null arm floor (contemporaneous).
  const nullFlips = nullTrials.filter((t) => t.aCorrect !== t.bCorrect).length;
  const nullFloor = nullTrials.length > 0 ? nullFlips / nullTrials.length : 0;
  console.log(`\n\nNULL ARM (interleaved, even seeds): ${nullTrials.length} items, floor = ${(nullFloor*100).toFixed(1)}% (${nullFlips} flips)`);

  // Candidate: measure best-single, and agreement-gating (fallback to the stronger arm).
  const accA = candidate.filter((t) => t.aChoice === t.correctIndex).length / candidate.length;
  const accB = candidate.filter((t) => t.bChoice === t.correctIndex).length / candidate.length;
  const strongerIsA = accA >= accB;
  const gated = scoreSelector("agreement-gating", agreementGating(strongerIsA), candidate);

  // McNemar on canonical (A) vs clause-swap (B) — the paired discordant analysis.
  const mc = mcNemar(candidate.map((t) => ({ aCorrect: t.aChoice === t.correctIndex, bCorrect: t.bChoice === t.correctIndex })));

  const pct = (x: number) => `${(x*100).toFixed(1)}%`;
  console.log(`CANDIDATE ARM (odd seeds): ${candidate.length} items`);
  console.log(`  canonical acc = ${pct(accA)}   clause-swap acc = ${pct(accB)}   best-single = ${pct(Math.max(accA,accB))}`);
  console.log(`  discordant split: b(canon-right,clause-wrong)=${mc.b}  c(clause-right,canon-wrong)=${mc.c}`);
  console.log(`  McNemar paired acc diff (A-B) = ${(mc.accuracyDiff*100).toFixed(1)}pp  95% CI [${(mc.diffLo*100).toFixed(1)}, ${(mc.diffHi*100).toFixed(1)}]  χ²=${mc.chiSquare.toFixed(2)}`);
  console.log(`  agreement-gating accuracy = ${pct(gated.accuracy.point)} [${pct(gated.accuracy.lo)}, ${pct(gated.accuracy.hi)}]`);
  console.log(`  union upper bound (oracle) = ${pct(gated.unionUpperBound.point)}   lift over best = ${(gated.liftOverBest*100).toFixed(1)}pp`);

  // Pre-declared falsifier evaluation.
  const gatingBeatsSingle = gated.accuracy.lo > gated.bestSingle;
  const symmetricSplit = mc.symmetric;
  let verdict: string;
  if (symmetricSplit) verdict = "ABANDON-AS-PAYING: discordant split symmetric (b≈c) — fallback nets nothing at any N";
  else if (!gatingBeatsSingle) verdict = "NOT-SHOWN-TO-PAY: agreement-gating does not clear best-single (CI includes/below 0)";
  else verdict = "PAYS: agreement-gating beats best-single, CI excludes 0, discordant split favours fallback";
  console.log(`\n  Falsifier verdict: ${verdict}`);
  console.log(`  Headline discipline: clause-swap DECORRELATES (proven); PAYS = ${gatingBeatsSingle && !symmetricSplit ? "yes (this run)" : "NOT shown"}.`);

  // Raw + ledger.
  const rawPath = join(repoRoot, "data", "decorr-agreement-gating-raw.jsonl");
  mkdirSync(dirname(rawPath), { recursive: true });
  writeFileSync(rawPath, candidate.map((t, i) => JSON.stringify({ arm: "candidate", i, aChoice: t.aChoice, bChoice: t.bChoice, correctIndex: t.correctIndex, aMs: t.aMs, bMs: t.bMs })).join("\n")
    + "\n" + nullTrials.map((t, i) => JSON.stringify({ arm: "null", i, aCorrect: t.aCorrect, bCorrect: t.bCorrect })).join("\n") + "\n");

  appendFileSync(join(repoRoot, "data", "decorrelation-research.jsonl"), JSON.stringify({
    schema: "decorr/v2-agreement-gating",
    axis: { axis: "prompt-frame:clause-swap:pays", description: "agreement-gating canonical+clause-swap vs best-single; McNemar paired; interleaved null", kind: "candidate" },
    register: "unmetered", nCandidate: candidate.length, nNull: nullTrials.length,
    nullFloor, accCanonical: accA, accClauseSwap: accB, bestSingle: Math.max(accA, accB),
    mcNemar: { b: mc.b, c: mc.c, accuracyDiff: mc.accuracyDiff, diffLo: mc.diffLo, diffHi: mc.diffHi, chiSquare: mc.chiSquare, resolved: mc.resolved, symmetric: mc.symmetric },
    agreementGatingAcc: gated.accuracy, unionUpperBound: gated.unionUpperBound, liftOverBest: gated.liftOverBest,
    paysVerdict: verdict, rawLog: "data/decorr-agreement-gating-raw.jsonl",
    preRegistrationSha: preRegSha, measuredAt: new Date().toISOString(),
  }) + "\n");
  console.log("\nRecorded agreement-gating summary + raw per-item log.");
}

main();
