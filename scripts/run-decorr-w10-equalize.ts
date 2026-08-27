#!/usr/bin/env bun
/**
 * run-decorr-w10-equalize.ts — the decisive leak test (Otto's W10).
 *
 * The hard-menu run reported a 63/63 + 87/87 perfect self-verifier and concluded
 * "verification buys abstention." Otto found the leak: the VERIFIER prompt is handed the
 * decision rule verbatim ("the ONLY correct action is respond_to_operator") while the
 * PRODUCER prompt gets only a vague hint ("Operator outranks everything"). A perfect
 * classifier on items whose answer is named in its own prompt is a model reading back a
 * rule it was just given — informational asymmetry, not cognitive asymmetry.
 *
 * W10 settles it in one run: give the PRODUCER the verifier's RULES block verbatim,
 * change nothing else, re-measure producer accuracy on the same hard items.
 *
 *   - producer jumps 58% → ~100%  ⇒ CONFIRMED LEAK. The abstention doc is retracted.
 *   - producer stays ~58% with the rule in hand ⇒ the asymmetry is REAL and interesting:
 *     checking is genuinely easier than searching even at equal information.
 *
 * Register: unmetered. Raw log committed so the numbers recompute without a model.
 *
 * Usage: bun scripts/run-decorr-w10-equalize.ts [N] [preRegSha]
 */
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { wilsonInterval } from "../src/Core.TypeScript/observe/decorrelation-stats";

const N = parseInt(process.argv[2] ?? "150", 10);
const preRegSha = process.argv[3] ?? null;
const HOST = "http://127.0.0.1:11434";
const repoRoot = process.cwd();

// ═══ The SHARED rule block — the invariant W11 will enforce ════════════════════
// Both producer and verifier now carry the SAME task-relevant information. If the two
// prompts ever diverge in task content again, the comparison measures the prompt, not
// the roles.
const RULES_BLOCK =
  `RULES:\n` +
  `- If operator has a pending message, the ONLY correct action is "respond_to_operator"\n` +
  `- Operator ALWAYS outranks work items`;

interface Scenario { context: string; options: string[]; correctIndex: number; }

function generateHardScenarios(count: number): Scenario[] {
  const scenarios: Scenario[] = [];
  let s = 42;
  const rng = () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };
  while (scenarios.length < count) {
    const menuSize = 18 + Math.floor(rng() * 23);
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

async function generate(model: string, prompt: string, nOptions: number): Promise<{ idx: number | null; ms: number }> {
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
    return { idx: idx >= 0 && idx < nOptions ? idx : null, ms };
  } catch { return { idx: null, ms: performance.now() - start }; }
}

/** VAGUE producer — the original hard-run prompt (the hint, not the rule). */
function vaguePrompt(sc: Scenario): string {
  const numbered = sc.options.map((o, i) => `${i}: ${o}`).join("\n");
  return `Choose ONE action. Reply ONLY the number. Operator outranks everything.\n\nState: ${sc.context}\n\nOptions:\n${numbered}\n\nNumber:`;
}

/** RULES-EQUALIZED producer — the SAME RULES block the verifier had, options untouched. */
function rulesPrompt(sc: Scenario): string {
  const numbered = sc.options.map((o, i) => `${i}: ${o}`).join("\n");
  return `Choose ONE action. Reply ONLY the number.\n\n${RULES_BLOCK}\n\nState: ${sc.context}\n\nOptions:\n${numbered}\n\nNumber:`;
}

async function main() {
  const scenarios = generateHardScenarios(N);
  const model = "gemma2:2b";
  console.log(`W10 leak test — does the producer's accuracy jump when handed the verifier's RULES?`);
  console.log(`Model=${model}  N=${N}  menu=18..40  preReg=${preRegSha ?? "none"}`);
  console.log("═".repeat(70));

  const vagueIdx: (number | null)[] = [];
  const rulesIdx: (number | null)[] = [];
  const raw: unknown[] = [];
  let vagueMs = 0, rulesMs = 0;

  for (let i = 0; i < scenarios.length; i++) {
    const sc = scenarios[i]!;
    const v = await generate(model, vaguePrompt(sc), sc.options.length);
    const r = await generate(model, rulesPrompt(sc), sc.options.length);
    vagueIdx.push(v.idx); rulesIdx.push(r.idx);
    vagueMs += v.ms; rulesMs += r.ms;
    raw.push({ i, menuSize: sc.options.length, correctIndex: sc.correctIndex, vagueChoice: v.idx, rulesChoice: r.idx, vagueMs: v.ms, rulesMs: r.ms });
    if ((i + 1) % 20 === 0) process.stdout.write(`  ${i + 1}/${N}\r`);
  }

  const vagueCorrect = vagueIdx.filter((x, i) => x === scenarios[i]!.correctIndex).length;
  const rulesCorrect = rulesIdx.filter((x, i) => x === scenarios[i]!.correctIndex).length;
  const vAcc = wilsonInterval(vagueCorrect, N);
  const rAcc = wilsonInterval(rulesCorrect, N);
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const ci = (iv: { point: number; lo: number; hi: number }) => `${pct(iv.point)} [${pct(iv.lo)}, ${pct(iv.hi)}]`;

  console.log(`\n\nProducer accuracy on the SAME hard items:`);
  console.log(`  VAGUE hint (original):      ${ci(vAcc)}  (${vagueCorrect}/${N})`);
  console.log(`  RULES block (equalized):    ${ci(rAcc)}  (${rulesCorrect}/${N})`);
  console.log(`  lift from handing over the rule: ${((rAcc.point - vAcc.point) * 100).toFixed(1)}pp`);

  const jumped = rAcc.lo > vAcc.hi; // CIs separate → real jump
  const verdict = jumped
    ? "CONFIRMED LEAK — the rule, not verification, was doing the work. Abstention doc retracted."
    : "NO JUMP — the asymmetry survives equal information: checking is easier than searching.";
  console.log(`\nVERDICT: ${verdict}`);

  const rawPath = join(repoRoot, "data", "decorr-w10-equalize-raw.jsonl");
  mkdirSync(dirname(rawPath), { recursive: true });
  writeFileSync(rawPath, raw.map((x) => JSON.stringify(x)).join("\n") + "\n");

  const ledgerPath = join(repoRoot, "data", "decorrelation-research.jsonl");
  appendFileSync(ledgerPath, JSON.stringify({
    schema: "decorr/v2-leak-test",
    axis: { axis: "w10:producer-rule-equalize", description: "Give producer the verifier's RULES block verbatim; re-measure producer accuracy on hard menus", kind: "leak-test" },
    register: "unmetered", n: N,
    accuracyVagueHint: vAcc, accuracyRulesEqualized: rAcc,
    liftFromRule: rAcc.point - vAcc.point,
    meanMsVague: vagueMs / N, meanMsRules: rulesMs / N,
    verdict: jumped ? "confirmed-leak" : "asymmetry-survives",
    rawLog: "data/decorr-w10-equalize-raw.jsonl",
    preRegistrationSha: preRegSha, measuredAt: new Date().toISOString(),
  }) + "\n");
  console.log("Recorded W10 leak-test summary + raw per-item log.");
}

main();
