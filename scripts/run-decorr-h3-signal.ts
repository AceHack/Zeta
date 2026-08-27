#!/usr/bin/env bun
/**
 * run-decorr-h3-signal.ts — is the 4.0pp headroom ADDRESSABLE? (pre-registered H3)
 *
 * Pre-registration: docs/research/decorrelation-preregistration-h3-selector-signal.md
 * (commit its sha as arg 2, committed BEFORE this runs).
 *
 * H2 showed agreement-gating captures 0.0 of the oracle's 4.0pp headroom (the 24 items
 * clause-swap uniquely gets right). H3 asks: does the model's own TOKEN CONFIDENCE
 * (logprob on the chosen number) separate the "clause-swap wins" from the "canonical wins"
 * discordant items — and does a confidence-gated selector beat best-single?
 *
 * Honest prior (pre-registered): if clause-swap's 24 wins are random, confidence won't
 * separate them, and the finding is "headroom exists but is not addressable" — a stronger,
 * closing result than "gating didn't work."
 *
 * Usage: bun scripts/run-decorr-h3-signal.ts [N] [preRegSha]
 */
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { mannWhitneyU, mcNemar, wilsonInterval, detectAnswerLeak } from "../src/Core.TypeScript/observe/decorrelation-stats";

const N = parseInt(process.argv[2] ?? "600", 10);
const preRegSha = process.argv[3] ?? null;
const MODEL = "gemma2:2b";
const HOST = "http://127.0.0.1:11434";
const repoRoot = process.cwd();

const CANONICAL = "Choose ONE action. Reply ONLY the number. Operator outranks everything.";
const CLAUSE_SWAP = "Operator outranks everything. Choose ONE action; reply ONLY the number.";

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
    scenarios.push({ context: `Operator: msg=true ferry=false | Backlog: ${menuSize - 1} items(ready) | Mode: work`, options: opts, correctIndex: insertPos });
  }
  return scenarios;
}

interface Ans { idx: number | null; confidence: number; }

/** Query with logprobs; confidence = probability (exp logprob) on the chosen number token. */
async function ask(instruction: string, sc: Scenario): Promise<Ans> {
  const numbered = sc.options.map((o, i) => `${i}: ${o}`).join("\n");
  const prompt = `${instruction}\n\nState: ${sc.context}\n\nOptions:\n${numbered}\n\nNumber:`;
  try {
    const res = await fetch(`${HOST}/api/generate`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, prompt, stream: false, options: { seed: 42, temperature: 0, num_predict: 10 }, logprobs: true }),
    });
    const data = await res.json() as { response: string; logprobs?: { token: string; logprob: number }[] };
    const m = data.response.trim().match(/\d+/);
    if (!m) return { idx: null, confidence: 0 };
    const idx = parseInt(m[0]!, 10);
    // Confidence: exp(logprob) of the first token that is a digit (the chosen number).
    let conf = 0;
    if (data.logprobs) {
      const digitTok = data.logprobs.find((t) => /\d/.test(t.token));
      if (digitTok) conf = Math.exp(digitTok.logprob);
    }
    return { idx: idx >= 0 && idx < sc.options.length ? idx : null, confidence: conf };
  } catch { return { idx: null, confidence: 0 }; }
}

async function main() {
  const scenarios = generateScenarios(N);
  console.log(`H3: is the headroom ADDRESSABLE by token confidence?`);
  console.log(`Model=${MODEL}  N=${N}  preReg=${preRegSha ?? "MISSING"}`);
  console.log("═".repeat(70));

  const probe = scenarios[0]!;
  for (const [name, instr] of [["canonical", CANONICAL], ["clause-swap", CLAUSE_SWAP]] as const) {
    if (detectAnswerLeak(instr, probe.options[probe.correctIndex]!).leaked) { console.error(`LEAK on ${name}`); process.exit(1); }
  }
  console.log("Leak falsifier: GREEN on both producer instructions.\n");

  const rows: { i: number; correctIndex: number; aIdx: number | null; aConf: number; bIdx: number | null; bConf: number }[] = [];
  for (let i = 0; i < scenarios.length; i++) {
    const sc = scenarios[i]!;
    const A = await ask(CANONICAL, sc);
    const B = await ask(CLAUSE_SWAP, sc);
    rows.push({ i, correctIndex: sc.correctIndex, aIdx: A.idx, aConf: A.confidence, bIdx: B.idx, bConf: B.confidence });
    if ((i + 1) % 50 === 0) process.stdout.write(`  ${i + 1}/${N}\r`);
  }

  const aRight = (r: typeof rows[0]) => r.aIdx === r.correctIndex;
  const bRight = (r: typeof rows[0]) => r.bIdx === r.correctIndex;
  const accA = rows.filter(aRight).length / N;
  const accB = rows.filter(bRight).length / N;
  const bestSingle = Math.max(accA, accB);

  // Discordant groups.
  const clauseWins = rows.filter((r) => bRight(r) && !aRight(r)); // c=24-ish
  const canonWins = rows.filter((r) => aRight(r) && !bRight(r));  // b=40-ish

  // SIGNAL TEST 1: does confidence separate the two discordant groups?
  // On clause-wins, is clause-swap MORE confident than canonical? On canon-wins, the reverse?
  // The signal a selector would use: pick the MORE CONFIDENT config. So test whether the
  // confidence GAP (bConf - aConf) differs between the groups.
  const gapClauseWins = clauseWins.map((r) => r.bConf - r.aConf);
  const gapCanonWins = canonWins.map((r) => r.bConf - r.aConf);
  const mw = mannWhitneyU(gapClauseWins, gapCanonWins);

  // SELECTOR: pick the more confident config on every item (never ground truth).
  let selCorrect = 0;
  for (const r of rows) {
    const pickB = r.bConf > r.aConf;
    const idx = pickB ? r.bIdx : r.aIdx;
    if (idx === r.correctIndex) selCorrect++;
  }
  const selAcc = wilsonInterval(selCorrect, N);

  // Paired McNemar: confidence-selector vs canonical (the best single).
  const mc = mcNemar(rows.map((r) => ({
    aCorrect: (r.bConf > r.aConf ? r.bIdx : r.aIdx) === r.correctIndex, // selector
    bCorrect: aRight(r), // canonical baseline
  })));

  const pct = (x: number) => `${(x*100).toFixed(1)}%`;
  console.log(`\n\naccuracy: canonical=${pct(accA)}  clause-swap=${pct(accB)}  best-single=${pct(bestSingle)}`);
  console.log(`discordant: clause-wins=${clauseWins.length}  canon-wins=${canonWins.length}`);
  console.log(`\nSIGNAL: confidence gap (clauseConf - canonConf)`);
  console.log(`  Mann-Whitney U on the gap between the two discordant groups: z=${mw.z.toFixed(2)} rankBiserial=${mw.rankBiserial.toFixed(3)} rejects=${mw.rejects}`);
  console.log(`\nSELECTOR: pick the more confident config`);
  console.log(`  accuracy = ${pct(selAcc.point)} [${pct(selAcc.lo)}, ${pct(selAcc.hi)}]  vs best-single ${pct(bestSingle)}`);
  console.log(`  McNemar (selector vs canonical): diff=${(mc.accuracyDiff*100).toFixed(1)}pp CI [${(mc.diffLo*100).toFixed(1)}, ${(mc.diffHi*100).toFixed(1)}] resolved=${mc.resolved}`);

  const beatsSingle = selAcc.lo > bestSingle;
  const signalSeparates = mw.rejects;
  let verdict: string;
  if (signalSeparates && beatsSingle) verdict = "ADDRESSABLE: confidence separates the groups AND a confidence-gated selector beats best-single";
  else if (!signalSeparates) verdict = "NOT-ADDRESSABLE (by confidence): the signal does not separate clause-wins from canon-wins — the 24 wins look random to confidence. Headroom exists but is unaddressable by this signal.";
  else verdict = "SIGNAL-SEPARATES-BUT-SELECTOR-FAILS: confidence differs between groups but gating on it does not beat best-single";
  console.log(`\nVERDICT: ${verdict}`);
  console.log(`Headline: clause-swap DECORRELATES (proven); ADDRESSABLE by confidence = ${signalSeparates && beatsSingle ? "yes" : "NO"}.`);

  const rawPath = join(repoRoot, "data", "decorr-h3-signal-raw.jsonl");
  mkdirSync(dirname(rawPath), { recursive: true });
  writeFileSync(rawPath, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");

  appendFileSync(join(repoRoot, "data", "decorrelation-research.jsonl"), JSON.stringify({
    schema: "decorr/v2-h3-signal",
    axis: { axis: "prompt-frame:clause-swap:addressable-by-confidence", description: "does token confidence identify the clause-swap-unique wins?", kind: "candidate" },
    register: "unmetered", n: N, accCanonical: accA, accClauseSwap: accB, bestSingle,
    clauseWins: clauseWins.length, canonWins: canonWins.length,
    mannWhitney: { z: mw.z, rankBiserial: mw.rankBiserial, rejects: mw.rejects },
    selectorAcc: selAcc, mcNemarVsCanonical: { accuracyDiff: mc.accuracyDiff, diffLo: mc.diffLo, diffHi: mc.diffHi, resolved: mc.resolved },
    verdict, rawLog: "data/decorr-h3-signal-raw.jsonl", preRegistrationSha: preRegSha, measuredAt: new Date().toISOString(),
  }) + "\n");
  console.log("\nRecorded H3 summary + raw per-item log (choices + confidences).");
}

main();
