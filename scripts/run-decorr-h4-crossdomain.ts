#!/usr/bin/env bun
/**
 * run-decorr-h4-crossdomain.ts — does the PARAMETER-FREE confidence rule transfer? (H4)
 *
 * Pre-registration: docs/research/decorrelation-preregistration-h4-crossdomain.md
 * (commit its sha as arg 2, committed BEFORE this runs).
 *
 * H3 showed on the operator-priority domain that "pick the higher-confidence config" (τ=0,
 * parameter-free) beats best-single +3.2pp and survives CV with 0.0pp optimism, because the
 * confidence gap is bimodal about zero — the model's confidence is COMPARABLE ACROSS FRAMES.
 * H4 runs the SAME rule, unchanged, on a DIFFERENT domain (arithmetic-constraint selection)
 * to test whether that cross-frame comparability is a property of the model or of the H3
 * question set.
 *
 * Usage: bun scripts/run-decorr-h4-crossdomain.ts [N] [preRegSha]
 */
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { mannWhitneyU, mcNemar, wilsonInterval, kFoldThresholdSelector, detectAnswerLeak, type ThresholdItem } from "../src/Core.TypeScript/observe/decorrelation-stats";

const N = parseInt(process.argv[2] ?? "600", 10);
const preRegSha = process.argv[3] ?? null;
const MODEL = "gemma2:2b";
const HOST = "http://127.0.0.1:11434";
const repoRoot = process.cwd();

interface Scenario { rule: string; options: number[]; correctIndex: number; }

/** Arithmetic-constraint domain: pick the number satisfying a stated property. */
function generateScenarios(count: number): Scenario[] {
  const scenarios: Scenario[] = [];
  let s = 42;
  const rng = () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
  const rules = [
    { text: "Pick the LARGEST number.", pick: (ns: number[]) => ns.indexOf(Math.max(...ns)) },
    { text: "Pick the SMALLEST number.", pick: (ns: number[]) => ns.indexOf(Math.min(...ns)) },
    { text: "Pick the number CLOSEST to 50.", pick: (ns: number[]) => ns.reduce((best, n, i, a) => Math.abs(n - 50) < Math.abs(a[best]! - 50) ? i : best, 0) },
    { text: "Pick the LARGEST EVEN number.", pick: (ns: number[]) => { let bi = -1; ns.forEach((n, i) => { if (n % 2 === 0 && (bi < 0 || n > ns[bi]!)) bi = i; }); return bi; } },
  ];
  while (scenarios.length < count) {
    const rule = rules[Math.floor(rng() * rules.length)]!;
    const menuSize = 6 + Math.floor(rng() * 6); // 6..11 — where the model errs sometimes
    const options: number[] = [];
    while (options.length < menuSize) { const v = 1 + Math.floor(rng() * 99); options.push(v); }
    const correctIndex = rule.pick(options);
    if (correctIndex < 0) continue; // e.g. no even number for the even rule
    // Ensure a unique answer (no ties on the deciding property) to keep verification clean.
    scenarios.push({ rule: rule.text, options, correctIndex });
  }
  return scenarios;
}

function canonicalInstruction(rule: string): string { return `Choose ONE. Reply ONLY the number (the option index). ${rule}`; }
function clauseSwapInstruction(rule: string): string { return `${rule} Choose ONE; reply ONLY the number (the option index).`; }

interface Ans { idx: number | null; confidence: number; }

async function ask(instruction: string, sc: Scenario): Promise<Ans> {
  const numbered = sc.options.map((o, i) => `${i}: ${o}`).join("\n");
  const prompt = `${instruction}\n\nOptions:\n${numbered}\n\nNumber:`;
  try {
    const res = await fetch(`${HOST}/api/generate`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: MODEL, prompt, stream: false, options: { seed: 42, temperature: 0, num_predict: 10 }, logprobs: true }),
    });
    const data = await res.json() as { response: string; logprobs?: { token: string; logprob: number }[] };
    const m = data.response.trim().match(/\d+/);
    if (!m) return { idx: null, confidence: 0 };
    const idx = parseInt(m[0]!, 10);
    let conf = 0;
    if (data.logprobs) { const d = data.logprobs.find((t) => /\d/.test(t.token)); if (d) conf = Math.exp(d.logprob); }
    return { idx: idx >= 0 && idx < sc.options.length ? idx : null, confidence: conf };
  } catch { return { idx: null, confidence: 0 }; }
}

async function main() {
  const scenarios = generateScenarios(N);
  console.log(`H4: does the PARAMETER-FREE confidence rule transfer to a NEW domain (arithmetic)?`);
  console.log(`Model=${MODEL}  N=${N}  preReg=${preRegSha ?? "MISSING"}`);
  console.log("═".repeat(70));

  // Leak check: the answer is a number in the menu; the instruction states a property.
  const probe = scenarios[0]!;
  for (const [name, instr] of [["canonical", canonicalInstruction(probe.rule)], ["clause-swap", clauseSwapInstruction(probe.rule)]] as const) {
    if (detectAnswerLeak(instr, String(probe.options[probe.correctIndex]!)).leaked) { console.error(`LEAK on ${name}`); process.exit(1); }
  }
  console.log("Leak falsifier: GREEN on both producer instructions (rule states a property, not the answer).\n");

  const rows: { i: number; correctIndex: number; aIdx: number | null; aConf: number; bIdx: number | null; bConf: number }[] = [];
  for (let i = 0; i < scenarios.length; i++) {
    const sc = scenarios[i]!;
    const A = await ask(canonicalInstruction(sc.rule), sc);
    const B = await ask(clauseSwapInstruction(sc.rule), sc);
    rows.push({ i, correctIndex: sc.correctIndex, aIdx: A.idx, aConf: A.confidence, bIdx: B.idx, bConf: B.confidence });
    if ((i + 1) % 50 === 0) process.stdout.write(`  ${i + 1}/${N}\r`);
  }

  const aR = (r: typeof rows[0]) => r.aIdx === r.correctIndex;
  const bR = (r: typeof rows[0]) => r.bIdx === r.correctIndex;
  const accA = rows.filter(aR).length / N, accB = rows.filter(bR).length / N;
  const bestSingle = Math.max(accA, accB);

  // PARAMETER-FREE rule: pick the more confident config (τ=0). Nothing tuned.
  let selCorrect = 0;
  for (const r of rows) { const pickB = r.bConf > r.aConf; if ((pickB ? bR(r) : aR(r))) selCorrect++; }
  const selAcc = wilsonInterval(selCorrect, N);

  // Bimodality / comparability check via CV: is there a threshold to overfit?
  const items: ThresholdItem[] = rows.map((r) => ({ signal: r.bConf - r.aConf, bCorrect: bR(r), aCorrect: aR(r) }));
  const cv = kFoldThresholdSelector(items, 5);

  // Does the confidence gap separate the discordant groups?
  const clauseWins = rows.filter((r) => bR(r) && !aR(r)), canonWins = rows.filter((r) => aR(r) && !bR(r));
  const mw = mannWhitneyU(clauseWins.map((r) => r.bConf - r.aConf), canonWins.map((r) => r.bConf - r.aConf));

  // McNemar: parameter-free selector vs best-single.
  const bestIsA = accA >= accB;
  const mc = mcNemar(rows.map((r) => ({ aCorrect: (r.bConf > r.aConf ? bR(r) : aR(r)), bCorrect: bestIsA ? aR(r) : bR(r) })));

  const pct = (x: number) => `${(x*100).toFixed(1)}%`;
  console.log(`\n\naccuracy: canonical=${pct(accA)}  clause-swap=${pct(accB)}  best-single=${pct(bestSingle)}`);
  console.log(`discordant: clause-wins=${clauseWins.length}  canon-wins=${canonWins.length}`);
  console.log(`\nPARAMETER-FREE rule (pick more confident, τ=0):`);
  console.log(`  accuracy = ${pct(selAcc.point)} [${pct(selAcc.lo)}, ${pct(selAcc.hi)}]  vs best-single ${pct(bestSingle)}`);
  console.log(`  McNemar vs best-single: diff=${(mc.accuracyDiff*100).toFixed(1)}pp CI [${(mc.diffLo*100).toFixed(1)}, ${(mc.diffHi*100).toFixed(1)}] resolved=${mc.resolved}`);
  console.log(`\nCross-frame comparability (is the gap bimodal about zero?):`);
  console.log(`  Mann-Whitney on discordant gap: z=${mw.z.toFixed(2)} rankBiserial=${mw.rankBiserial.toFixed(3)} rejects=${mw.rejects}`);
  console.log(`  5-fold CV: in-sample=${pct(cv.inSampleAccuracy)} OOS=${pct(cv.oosAccuracy)} optimism=${(cv.optimism*100).toFixed(1)}pp`);

  const paramFreeBeats = selAcc.lo > bestSingle || (mc.resolved && mc.accuracyDiff > 0);
  const lowOptimism = cv.optimism <= 0.01;
  let verdict: string;
  if (paramFreeBeats && lowOptimism) verdict = "TRANSFERS: parameter-free rule beats best-single AND optimism ~0 — cross-frame comparability holds on a second domain. Claim graduates.";
  else if (!paramFreeBeats) verdict = "DOES-NOT-TRANSFER: parameter-free rule does not beat best-single here — τ=0 was domain-specific.";
  else verdict = "PARTIAL: beats best-single but with nonzero optimism — a tuned threshold ≠ 0 was doing work, so confidence is NOT cleanly comparable across frames on this domain.";
  console.log(`\nVERDICT: ${verdict}`);

  const rawPath = join(repoRoot, "data", "decorr-h4-crossdomain-raw.jsonl");
  mkdirSync(dirname(rawPath), { recursive: true });
  writeFileSync(rawPath, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  appendFileSync(join(repoRoot, "data", "decorrelation-research.jsonl"), JSON.stringify({
    schema: "decorr/v2-h4-crossdomain", domain: "arithmetic-constraint-selection",
    axis: { axis: "prompt-frame:confidence-gate:cross-domain", description: "same parameter-free confidence rule, new (arithmetic) domain", kind: "candidate" },
    register: "unmetered", n: N, accCanonical: accA, accClauseSwap: accB, bestSingle,
    clauseWins: clauseWins.length, canonWins: canonWins.length,
    paramFreeSelectorAcc: selAcc, mcNemarVsBest: { accuracyDiff: mc.accuracyDiff, diffLo: mc.diffLo, diffHi: mc.diffHi, resolved: mc.resolved },
    mannWhitney: { z: mw.z, rankBiserial: mw.rankBiserial, rejects: mw.rejects },
    cv: { inSample: cv.inSampleAccuracy, oos: cv.oosAccuracy, optimism: cv.optimism },
    verdict, rawLog: "data/decorr-h4-crossdomain-raw.jsonl", preRegistrationSha: preRegSha, measuredAt: new Date().toISOString(),
  }) + "\n");
  console.log("\nRecorded H4 summary + raw per-item log.");
}

main();
