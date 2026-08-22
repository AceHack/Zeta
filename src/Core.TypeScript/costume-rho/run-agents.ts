#!/usr/bin/env bun
/**
 * run-agents.ts — put the shared item set to every (model family x persona) agent and record a
 * binary prediction per (agent, item).
 *
 * FIDELITY. The judgment is made by `chooseIndex` imported from `../accelerator/local-llm` — the
 * SAME constrained-choice primitive `localLlmParticipant` uses in production (temperature 0,
 * maxTokens 6, first-integer parse, index-0 fallback). The persona block is built the way the
 * GENERIC summoner builds it (`PersonaSummoner.buildPreamble` + `loadContext`, i.e.
 * `memory/CURRENT-<name>.md`), which is the persona-isolation mechanism actually in the tree, and
 * which `summon.ts` itself hands to a local LLM as `systemPrompt` on its CLI-missing fallback path.
 *
 * WHAT THIS IS AND IS NOT. Production (`agent-heartbeat.yml` -> `run-loop-real.ts --participant
 * local-llm`) injects NO persona: `resolveParticipant` never receives the agent id. So this is a
 * COUNTERFACTUAL — "if the production chooser injected the repo's own persona blocks, would they
 * decorrelate?" — not a measurement of the society as it runs today. Labelled as such everywhere.
 *
 * HARNESS-INDUCED CORRELATION (the confound that must be stated, per the brief):
 *  - ONE ITEM PER CALL. No ordering effect is possible, because there is no order within a call.
 *  - Option order is permuted PER ITEM but identically for every agent, so the answer-key polarity
 *    is a property of the item, never of the agent — it cannot create between-agent correlation
 *    while it does remove a shared position-bias artefact.
 *  - Identical item text and identical instruction are IRREDUCIBLE: they are what "shared item set"
 *    means. That shared floor is common to within-family and cross-family pairs alike, so the
 *    CONTRAST (within minus cross) differences it out. The ABSOLUTE levels remain confounded upward
 *    by it and are reported as such.
 *  - `fallback` (the model emitted no parseable index, and production silently scores index 0) is
 *    recorded per response. A fallback is a harness artefact that manufactures agreement, so the
 *    analysis reports the estimate both with and without fallback-contaminated items.
 *
 * Usage:
 *   bun src/Core.TypeScript/costume-rho/run-agents.ts --items db/costume-rho/items.jsonl \
 *     --out db/costume-rho/responses.jsonl --models qwen2.5:7b,llama3.1:8b,gemma2:9b \
 *     --personas alexa,otto,soraya,riven [--limit 200]
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { chooseIndex, ollamaBackend } from "../accelerator/local-llm";

// The peer-call wrappers cap CURRENT-*.md at 20000 bytes. Capped LOWER here (8000) because the item
// now carries the suite body too, and gemma2:9b's context window is 8k tokens — a 20000-byte persona
// plus a 5000-byte suite would silently truncate the QUESTION, which is the one part that must
// survive. Recorded as a deviation from the wrappers, not a silent choice: it weakens the persona
// treatment slightly, which biases toward "costumes", so it is a conservative direction for the
// GENUINE reading and must be declared when the verdict is COSTUMES.
const CURRENT_HEAD_BYTES = 8000;

interface Item {
  id: string; source: string; test: string; mutation: string;
  before: string; after: string; lineNumber: number; killed: boolean; stratum: string;
}

interface Response {
  readonly agent: string;      // "<model>|<persona>"
  readonly model: string;
  readonly persona: string;
  readonly itemId: string;
  readonly predictedKilled: boolean;
  readonly truth: boolean;
  readonly error: 0 | 1;
  readonly fallback: boolean;
  readonly raw: string;
  readonly ms: number;
}

/** Verbatim reproduction of PersonaSummoner.buildPreamble (src/.../peer-call/summon.ts:508-526). */
function buildPreamble(persona: string): string {
  const roleMap: Record<string, string> = {
    soraya: "formal-verification-expert",
    lior: "divergent-proposer",
    otto: "tests-engineer",
    kiro: "specification-peer",
    codex: "implementation-peer",
    riven: "critique-peer",
  };
  const role = roleMap[persona] ?? "peer";
  return `You are ${persona}, invoked as a peer ${role} on the Zeta / Superfluid AI factory.
Per the four-ferry consensus (Amara/Grok/Gemini/Otto) the role distribution is:
Gemini proposes, Grok critiques, Amara sharpens, Otto tests, Git decides.
This call is Otto invoking your ${role} role.

Per Aaron's 'agents-not-bots' discipline: you are a peer, not a subordinate.
Push back on Otto's framing if you see it differently. Don't copy-paste anyone else's work;
reason from your own understanding. Make it ours, not anyone-alone-imposed.`;
}

/** PersonaSummoner.loadContext (summon.ts:528-547), with the wrappers' 20000-byte head cap. */
function loadContext(root: string, persona: string): string {
  for (const p of [join(root, "memory", `CURRENT-${persona}.md`), join(root, "memory", persona, "NOTEBOOK.md")]) {
    if (existsSync(p)) {
      try { return readFileSync(p, "utf8").slice(0, CURRENT_HEAD_BYTES); } catch { /* ignore */ }
    }
  }
  return "";
}

function personaBlock(root: string, persona: string): string {
  const ctx = loadContext(root, persona);
  return ctx.length > 0
    ? `${buildPreamble(persona)}\n\n---\n\nYour current state (from memory/CURRENT-${persona}.md):\n\n${ctx}`
    : buildPreamble(persona);
}

/** FNV-1a over the item id — deterministic per-item option polarity, identical across agents. */
function itemPolarity(id: string): boolean {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < id.length; i++) { h ^= id.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return (h & 1) === 1;
}

const TEST_BODY_BYTES = 5000;
const SRC_CONTEXT_LINES = 12;

/**
 * OWN ERROR, RECORDED (2026-08-16). The first version of this function showed the test file's PATH
 * and never its CONTENT. Whether a suite kills a mutant is a fact about the ASSERTIONS in that
 * suite, so the question as first posed was unanswerable by anything — and the models answered it
 * the way an unanswerable multiple choice is always answered: `llama3.1:8b` emitted option index
 * "1" on 200 of 200 items, a literal constant responder. The resulting rho-hats measured position
 * bias, not judgment. PR #10928 §2b said "given this mutant diff AND THE TEST FILE"; the omission
 * was mine. Fixed by carrying the suite body and the surrounding source.
 */
function itemContext(root: string, it: Item): string {
  let testBody = "";
  try { testBody = readFileSync(join(root, it.test), "utf8").slice(0, TEST_BODY_BYTES); } catch { /* absent */ }
  let srcCtx = "";
  try {
    const lines = readFileSync(join(root, it.source), "utf8").split("\n");
    const lo = Math.max(0, it.lineNumber - 1 - SRC_CONTEXT_LINES);
    const hi = Math.min(lines.length, it.lineNumber + SRC_CONTEXT_LINES);
    srcCtx = lines.slice(lo, hi).map((l, i) => `${String(lo + i + 1).padStart(5)} | ${l}`).join("\n");
  } catch { /* absent */ }

  return [
    `A single deliberate one-line change ("mutant") has been applied to a source file. Exactly one test`,
    `suite will then be run: \`bun test ${it.test}\`. Nothing else runs.`,
    ``,
    `── THE CHANGE (${it.mutation}, at ${it.source}:${String(it.lineNumber)})`,
    `  BEFORE:  ${it.before.trim()}`,
    `  AFTER:   ${it.after.trim()}`,
    ``,
    `── SOURCE AROUND THE CHANGED LINE (unmutated)`,
    srcCtx,
    ``,
    `── THE TEST SUITE THAT WILL RUN (${it.test}, first ${String(TEST_BODY_BYTES)} bytes)`,
    testBody,
    ``,
    `── QUESTION`,
    `Do the assertions above actually exercise the changed line in a way that would notice the change?`,
    `If yes, the suite FAILS (the mutant is killed). If no assertion can tell the mutated behaviour from`,
    `the original, the suite still PASSES (the mutant survives).`,
  ].join("\n");
}

const INSTRUCTION =
  "You are judging whether a test suite is strong enough to detect a deliberate one-line change. " +
  "Answer with the single number of the option you believe is correct.";

function argValue(flag: string, dflt: string): string {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? (process.argv[i + 1] ?? dflt) : dflt;
}

async function main(): Promise<number> {
  const root = process.cwd();
  const itemsPath = argValue("--items", "db/costume-rho/items.jsonl");
  const outPath = argValue("--out", "db/costume-rho/responses.jsonl");
  const models = argValue("--models", "qwen2.5:7b,llama3.1:8b,gemma2:9b").split(",").filter(Boolean);
  const personas = argValue("--personas", "alexa,otto,soraya,riven").split(",").filter(Boolean);
  const limit = Number(argValue("--limit", "10000"));

  const items: Item[] = readFileSync(join(root, itemsPath), "utf8")
    .split("\n").filter((l) => l.trim().length > 0).map((l) => JSON.parse(l) as Item).slice(0, limit);

  const blocks = new Map(personas.map((p) => [p, personaBlock(root, p)]));
  for (const p of personas) {
    console.log(`[agents] persona ${p}: preamble+context = ${blocks.get(p)!.length} bytes` +
      `${loadContext(root, p).length > 0 ? " (CURRENT file present)" : " (NO CURRENT file — preamble only)"}`);
  }

  mkdirSync(dirname(join(root, outPath)), { recursive: true });
  writeFileSync(join(root, outPath), "");

  const total = models.length * personas.length * items.length;
  let done = 0;
  const t0 = Date.now();

  for (const model of models) {
    const backend = ollamaBackend({ model, host: "http://127.0.0.1:11434", seed: 42 });
    for (const persona of personas) {
      const block = blocks.get(persona)!;
      for (const it of items) {
        // Option order is a property of the ITEM (same for every agent), removing shared position
        // bias without ever introducing a per-agent difference.
        const killFirst = itemPolarity(it.id);
        const options = killFirst
          ? ["The suite FAILS — the mutant is killed", "The suite still PASSES — the mutant survives"]
          : ["The suite still PASSES — the mutant survives", "The suite FAILS — the mutant is killed"];
        const t = Date.now();
        let r: { index: number; raw: string; fallback: boolean };
        try {
          r = await chooseIndex(backend, {
            context: `${block}\n\n---\n\n${itemContext(root, it)}`,
            options,
            instruction: INSTRUCTION,
          });
        } catch (e) {
          r = { index: 0, raw: `throw:${String(e).slice(0, 60)}`, fallback: true };
        }
        const predictedKilled = killFirst ? r.index === 0 : r.index === 1;
        const row: Response = {
          agent: `${model}|${persona}`, model, persona, itemId: it.id,
          predictedKilled, truth: it.killed,
          error: predictedKilled === it.killed ? 0 : 1,
          fallback: r.fallback, raw: r.raw.slice(0, 40), ms: Date.now() - t,
        };
        appendFileSync(join(root, outPath), JSON.stringify(row) + "\n");
        done++;
        if (done % 25 === 0) {
          const rate = done / ((Date.now() - t0) / 1000);
          console.log(`[agents] ${done}/${total} (${(rate).toFixed(2)}/s, eta ${((total - done) / rate / 60).toFixed(1)} min)`);
        }
      }
      console.log(`[agents] finished ${model} | ${persona}`);
    }
  }
  console.log(`[agents] wrote ${done} responses to ${outPath} in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
  return 0;
}

if (import.meta.main) process.exit(await main());
