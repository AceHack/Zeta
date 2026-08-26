#!/usr/bin/env bun
/**
 * f2-role-correlation.ts — does role separation actually decorrelate errors?
 *
 * Otto's F2: If ρ(producer, verifier) > ~0.5, the pipeline inherits the same
 * N_eff collapse that killed majority vote. Dead.
 *
 * RESTRICTED TO GEMMA (per Otto's correction): qwen and llama are degenerate
 * verifiers (constant-yes). Computing ρ against a constant function is
 * degenerate by construction — you'd get a number and it would mean nothing.
 *
 * The experiment:
 * For each hard/adversarial scenario:
 *   1. Producer (qwen or llama) proposes an answer
 *   2. Verifier (gemma) checks it: "does this satisfy the rules?"
 *   3. Record: was the producer right? Did the verifier approve?
 *
 * The ρ that matters:
 *   ρ(producer_wrong, verifier_approves) — when the producer is WRONG,
 *   does the verifier ALSO fail (approves the wrong answer)?
 *
 * If ρ is high: verifier rubber-stamps producer errors → pipeline is vote in disguise
 * If ρ is low: verifier catches producer errors → role separation works
 *
 * Also measures: the rejection-rate law. A verifier MUST reject sometimes.
 * Verdict = Satisfies | Violates | Undecided — a model that never emits
 * Violates is an unfalsifiable check (Otto's companion falsifier).
 */

// ═══ Scenario generation (same as F1, hard/adversarial only) ═══════════════════

interface Scenario {
  readonly id: string;
  readonly context: string;
  readonly options: readonly string[];
  readonly correctIndex: number;
}

function generateScenarios(count: number): Scenario[] {
  const scenarios: Scenario[] = [];
  let s = 42;
  const rng = () => { s ^= s << 13; s ^= s >> 17; s ^= s << 5; return (s >>> 0) / 4294967296; };

  for (let i = 0; i < count; i++) {
    const r = rng();
    if (r >= 0.55 && r < 0.75) {
      const menuSize = 6 + Math.floor(rng() * 4);
      const opts: string[] = [];
      for (let j = 0; j < menuSize - 1; j++) opts.push(`do_item: task-${j}`);
      const insertPos = Math.floor(rng() * menuSize);
      opts.splice(insertPos, 0, "respond_to_operator");
      scenarios.push({ id: `hard-${i}`, context: `Operator: msg=true ferry=false | Backlog: ${menuSize-1} items(ready) | Mode: work`, options: opts, correctIndex: insertPos });
    } else if (r >= 0.75) {
      const baseOpts = ["respond_to_operator", "do_item: urgent-fix", "do_item: feature-x", "explore", "free_time"];
      const copy = [...baseOpts];
      for (let k = copy.length - 1; k > 0; k--) { const j = Math.floor(rng() * (k + 1)); [copy[k], copy[j]] = [copy[j]!, copy[k]!]; }
      const opIdx = copy.indexOf("respond_to_operator");
      scenarios.push({ id: `adv-${i}`, context: `Operator: msg=true ferry=false | Backlog: urgent-fix(ready), feature-x(ready) | Mode: work`, options: copy, correctIndex: opIdx });
    } else {
      if (r < 0.15) rng();
      else if (r < 0.35) rng();
      else { rng(); rng(); }
    }
  }
  return scenarios;
}

// ═══ Ollama queries ═══════════════════════════════════════════════════════════

async function produce(model: string, scenario: Scenario, host: string): Promise<number | null> {
  const numbered = scenario.options.map((o, i) => `${i}: ${o}`).join("\n");
  const prompt = `Choose ONE action. Reply ONLY the number. Operator outranks everything.\n\nState: ${scenario.context}\n\nOptions:\n${numbered}\n\nNumber:`;
  try {
    const res = await fetch(`${host}/api/generate`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, stream: false, options: { seed: 42, temperature: 0, num_predict: 10 } }),
    });
    const data = await res.json() as { response: string };
    const match = data.response.trim().match(/\d+/);
    if (!match) return null;
    const idx = parseInt(match[0]!, 10);
    return idx >= 0 && idx < scenario.options.length ? idx : null;
  } catch { return null; }
}

async function verify(model: string, scenario: Scenario, candidateIndex: number, host: string): Promise<"yes" | "no" | "unclear"> {
  const candidate = scenario.options[candidateIndex]!;
  const prompt = `You are verifying whether a proposed action is correct.\n\nRULES:\n- If operator has pending message, ONLY correct action is "respond_to_operator"\n- Operator ALWAYS outranks work items\n\nSTATE: ${scenario.context}\n\nPROPOSED: "${candidate}"\n\nIs this correct? Reply ONLY "yes" or "no".`;
  try {
    const res = await fetch(`${host}/api/generate`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model, prompt, stream: false, options: { seed: 42, temperature: 0, num_predict: 10 } }),
    });
    const data = await res.json() as { response: string };
    const r = data.response.trim().toLowerCase();
    if (r.includes("yes") && !r.includes("no")) return "yes";
    if (r.includes("no") && !r.includes("yes")) return "no";
    return "unclear";
  } catch { return "unclear"; }
}

// ═══ Main ═════════════════════════════════════════════════════════════════════

async function main(): Promise<void> {
  const host = "http://127.0.0.1:11434";
  const scenarios = generateScenarios(300);
  const producers = ["qwen2.5:0.5b", "llama3.2:1b"];
  const verifier = "gemma2:2b";

  console.log(`F2: Role Correlation (producer → gemma verifier)`);
  console.log(`Scenarios: ${scenarios.length} hard/adversarial`);
  console.log(`Verifier: ${verifier} (the only non-degenerate one)`);
  console.log("─".repeat(60));

  for (const producer of producers) {
    console.log(`\n  Pipeline: ${producer} → ${verifier}`);

    let producerCorrect = 0;
    let producerWrong = 0;
    let verifierApprovesCorrect = 0;  // producer right, verifier says yes
    let verifierApprovesWrong = 0;    // producer WRONG, verifier says yes (THE FAILURE)
    let verifierRejectsWrong = 0;     // producer wrong, verifier says no (THE WIN)
    let verifierRejectsCorrect = 0;   // producer right, verifier says no (false negative)
    let total = 0;

    for (const scenario of scenarios) {
      const proposed = await produce(producer, scenario, host);
      if (proposed === null) continue;

      const isCorrect = proposed === scenario.correctIndex;
      const verdict = await verify(verifier, scenario, proposed, host);

      if (isCorrect) {
        producerCorrect++;
        if (verdict === "yes") verifierApprovesCorrect++;
        else if (verdict === "no") verifierRejectsCorrect++;
      } else {
        producerWrong++;
        if (verdict === "yes") verifierApprovesWrong++;
        else if (verdict === "no") verifierRejectsWrong++;
      }
      total++;
      if (total % 20 === 0) process.stdout.write(`    ${total}/${scenarios.length}\r`);
    }

    // The metric: when producer is WRONG, how often does verifier CATCH it?
    const catchRate = producerWrong > 0 ? verifierRejectsWrong / producerWrong : 0;
    const rubberStampRate = producerWrong > 0 ? verifierApprovesWrong / producerWrong : 0;
    const falseNegativeRate = producerCorrect > 0 ? verifierRejectsCorrect / producerCorrect : 0;

    // Phi coefficient for (producer_wrong, verifier_approves)
    const a = verifierApprovesCorrect, b = verifierApprovesWrong;
    const c = verifierRejectsCorrect, d = verifierRejectsWrong;
    const phi = ((a * d) - (b * c)) / Math.sqrt(((a+b) * (c+d) * (a+c) * (b+d)) || 1);

    console.log(`    N=${total} (producer correct=${producerCorrect}, wrong=${producerWrong})`);
    console.log(`    When producer CORRECT: verifier approves ${verifierApprovesCorrect}/${producerCorrect} (${(verifierApprovesCorrect/Math.max(1,producerCorrect)*100).toFixed(0)}%), rejects ${verifierRejectsCorrect} (false-negative ${(falseNegativeRate * 100).toFixed(1)}%)`);
    console.log(`    When producer WRONG:   verifier catches ${verifierRejectsWrong}/${producerWrong} (${(catchRate*100).toFixed(1)}%), rubber-stamps ${verifierApprovesWrong} (${(rubberStampRate*100).toFixed(1)}%)`);
    console.log(`    φ(producer_correct, verifier_approves) = ${phi.toFixed(3)}`);
    console.log(`    CATCH RATE: ${(catchRate*100).toFixed(1)}% — ${catchRate > 0.3 ? "VERIFICATION ADDS VALUE" : catchRate > 0.1 ? "marginal" : "DEGENERATE (vote in disguise)"}`);
    console.log(`    FALSE-NEGATIVE RATE: ${(falseNegativeRate*100).toFixed(1)}% — verifier rejects CORRECT producer work. A verifier that rejects everything scores a perfect catch rate; this is the number that excludes it.`);
    console.log(`    Rejection-rate law: ${(verifierRejectsWrong + verifierRejectsCorrect) > 0 ? "PASSES (verifier rejects sometimes)" : "FAILS (never rejects)"}`);
  }

  console.log("\n" + "─".repeat(60));
  console.log("F2 VERDICT: if catch rate > 30%, role separation adds value beyond vote.");
  console.log("If φ < 0.5, the pipeline does NOT inherit the N_eff collapse.");
}

main();
