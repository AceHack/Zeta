#!/usr/bin/env bun
/**
 * f1-verify-asymmetry.ts — THE GATE: does produce/verify asymmetry exist?
 *
 * Otto's F1 falsifier: measure verify-accuracy on the SAME hard/adversarial
 * items where produce-accuracy is 0%. If verify ≈ produce, there is no
 * asymmetry to exploit and the design dies here.
 *
 * The experiment:
 * - Take the hard/adversarial scenarios where gemma2:2b scored 0% producing
 * - Present the CORRECT answer as a candidate
 * - Ask: "Does this candidate satisfy the rules? Yes/No"
 * - Measure: can the model VERIFY what it cannot PRODUCE?
 *
 * If verify >> produce: asymmetry exists, the society design lives
 * If verify ≈ produce: no asymmetry, the design dies for one benchmark's cost
 */

// ═══ The hard/adversarial scenarios (from benchmark-scale, where gemma = 0%) ═══

interface VerifyScenario {
  readonly id: string;
  readonly context: string;
  readonly options: readonly string[];
  readonly correctIndex: number;
  readonly difficulty: "hard" | "adversarial";
}

/** Generate the same hard/adversarial scenarios the benchmark used (seed=42). */
function generateHardScenarios(count: number): VerifyScenario[] {
  const scenarios: VerifyScenario[] = [];
  let s = 42;
  const rng = () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };

  // Advance RNG to match the benchmark's generation pattern
  for (let i = 0; i < count; i++) {
    const r = rng();
    if (r >= 0.55 && r < 0.75) {
      // HARD: operator message buried in a long menu
      const menuSize = 6 + Math.floor(rng() * 4);
      const opts: string[] = [];
      for (let j = 0; j < menuSize - 1; j++) opts.push(`do_item: task-${j}`);
      const insertPos = Math.floor(rng() * menuSize);
      opts.splice(insertPos, 0, "respond_to_operator");
      scenarios.push({ id: `hard-${i}`, context: `Operator: msg=true ferry=false | Backlog: ${menuSize-1} items(ready) | Mode: work`, options: opts, correctIndex: insertPos, difficulty: "hard" });
    } else if (r >= 0.75) {
      // ADVERSARIAL: conflicting signals
      const baseOpts = ["respond_to_operator", "do_item: urgent-fix", "do_item: feature-x", "explore", "free_time"];
      const opts = shuffleWithSeed(baseOpts, rng);
      const opIdx = opts.indexOf("respond_to_operator");
      scenarios.push({ id: `adv-${i}`, context: `Operator: msg=true ferry=false | Backlog: urgent-fix(ready), feature-x(ready) | Mode: work`, options: opts, correctIndex: opIdx, difficulty: "adversarial" });
    } else {
      // Skip easy/medium (just advance the RNG state)
      if (r < 0.15) { rng(); } // easy uses shuffleWithSeed
      else if (r < 0.35) { rng(); } // medium
      else { rng(); rng(); } // medium free
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

// ═══ Verification prompt (different from production: asks yes/no, not "pick a number") ═══

function buildVerifyPrompt(scenario: VerifyScenario): string {
  const candidate = scenario.options[scenario.correctIndex]!;
  return `You are verifying whether a proposed action is correct.

RULES:
- If the operator has a pending message, the ONLY correct action is "respond_to_operator"
- In work mode with ready items, prefer work items
- The operator ALWAYS outranks work items

STATE: ${scenario.context}

PROPOSED ACTION: "${candidate}"

Is this the correct action given the rules and state? Reply ONLY "yes" or "no".`;
}

// ═══ Ollama query ═════════════════════════════════════════════════════════════

async function queryOllama(model: string, prompt: string, host: string = "http://127.0.0.1:11434"): Promise<{ response: string; ms: number }> {
  const start = performance.now();
  try {
    const res = await fetch(`${host}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, stream: false, options: { seed: 42, temperature: 0, num_predict: 10 } }),
    });
    const data = await res.json() as { response: string };
    return { response: data.response.trim().toLowerCase(), ms: performance.now() - start };
  } catch (err) {
    return { response: `error: ${err}`, ms: performance.now() - start };
  }
}

// ═══ Also test with WRONG candidate (control: should say "no") ═══

function buildWrongVerifyPrompt(scenario: VerifyScenario): string {
  // Pick a wrong option (not the correct one)
  const wrongIdx = (scenario.correctIndex + 1) % scenario.options.length;
  const wrongCandidate = scenario.options[wrongIdx]!;
  return `You are verifying whether a proposed action is correct.

RULES:
- If the operator has a pending message, the ONLY correct action is "respond_to_operator"
- In work mode with ready items, prefer work items
- The operator ALWAYS outranks work items

STATE: ${scenario.context}

PROPOSED ACTION: "${wrongCandidate}"

Is this the correct action given the rules and state? Reply ONLY "yes" or "no".`;
}

// ═══ Main ═════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  const host = "http://127.0.0.1:11434";
  const models = ["qwen2.5:0.5b", "llama3.2:1b", "gemma2:2b"];

  // Generate hard/adversarial scenarios
  const scenarios = generateHardScenarios(300); // Generate from 300 to get enough hard ones
  console.log(`F1 Falsifier: Produce/Verify Asymmetry Test`);
  console.log(`Hard/adversarial scenarios: ${scenarios.length}`);
  console.log("─".repeat(60));

  for (const model of models) {
    console.log(`\n  ${model}:`);

    let verifyCorrectYes = 0; // said "yes" to correct candidate
    let verifyWrongNo = 0;    // said "no" to wrong candidate
    let total = 0;
    let totalMs = 0;

    for (const scenario of scenarios) {
      // Test 1: present CORRECT candidate, should say "yes"
      const correctPrompt = buildVerifyPrompt(scenario);
      const correctResult = await queryOllama(model, correctPrompt, host);
      totalMs += correctResult.ms;
      const saidYes = correctResult.response.includes("yes");
      if (saidYes) verifyCorrectYes++;

      // Test 2: present WRONG candidate, should say "no"
      const wrongPrompt = buildWrongVerifyPrompt(scenario);
      const wrongResult = await queryOllama(model, wrongPrompt, host);
      totalMs += wrongResult.ms;
      const saidNo = wrongResult.response.includes("no") && !wrongResult.response.includes("yes");
      if (saidNo) verifyWrongNo++;

      total++;
      if (total % 20 === 0) process.stdout.write(`    ${total}/${scenarios.length}\r`);
    }

    const verifyAccuracy = total > 0 ? (verifyCorrectYes + verifyWrongNo) / (total * 2) : 0;
    const truePositiveRate = total > 0 ? verifyCorrectYes / total : 0;
    const trueNegativeRate = total > 0 ? verifyWrongNo / total : 0;
    const avgMs = total > 0 ? totalMs / (total * 2) : 0;

    console.log(`    N=${total}`);
    console.log(`    Verify correct (says "yes" to right answer): ${verifyCorrectYes}/${total} (${(truePositiveRate*100).toFixed(1)}%)`);
    console.log(`    Reject wrong (says "no" to wrong answer):    ${verifyWrongNo}/${total} (${(trueNegativeRate*100).toFixed(1)}%)`);
    console.log(`    Overall verify accuracy: ${(verifyAccuracy*100).toFixed(1)}%`);
    console.log(`    Avg latency: ${avgMs.toFixed(0)}ms`);
    console.log(`    PRODUCE accuracy on same items: 0% (from benchmark-scale)`);
    console.log(`    ASYMMETRY: ${verifyAccuracy > 0.1 ? `YES (${(verifyAccuracy*100).toFixed(0)}% verify vs 0% produce)` : "NO — design dies here"}`);
  }

  console.log("\n" + "─".repeat(60));
  console.log("F1 VERDICT: check above. If verify >> 0% on hard items, asymmetry exists.");
}

main();
