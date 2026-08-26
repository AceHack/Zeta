#!/usr/bin/env bun
/**
 * f3-hat-choice-run.ts — the runner for the hat-CHOICE decorrelation axis.
 *
 * STATUS: toy. Produces the data that `docs/research/2026-08-26-*` reports.
 * Metrics and their falsifiers live in `f3-hat-choice-decorrelation.ts` /
 * `.test.ts`; this file only sequences generations and writes raw JSONL.
 *
 *   bun f3-hat-choice-run.ts e1            # elicitation stability (the falsifier)
 *   bun f3-hat-choice-run.ts e2            # assigned vs self-selected vs no-hat
 *
 * Raw generations land in `data/f3-hat-choice/` as JSONL so the analysis can be
 * re-run without re-querying, and so a reviewer can recompute every number.
 */

import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ELICITATIONS,
  elicitationPrompt,
  generate,
  generateWorkItems,
  parseAnswer,
  workPrompt,
  type GenResult,
  type WorkItem,
} from "./f3-hat-choice-decorrelation";

const HOST = "http://127.0.0.1:11434";
const OUT_DIR = join(import.meta.dir, "..", "..", "..", "data", "f3-hat-choice");

/** Parameter counts (billions) as reported by `ollama list`, for the FLOP proxy. */
export const PARAMS_B: Readonly<Record<string, number>> = {
  "qwen2.5:0.5b": 0.494,
  "llama3.2:1b": 1.24,
  "gemma2:2b": 2.6,
  "qwen2.5:7b": 7.6,
  "gemma2:9b": 9.2,
};

interface ElicitRow {
  readonly kind: "elicit";
  readonly model: string;
  readonly phrasing: string;
  readonly seed: number;
  readonly temperature: number;
  readonly raw: string;
  readonly ms: number;
  readonly promptTokens: number;
  readonly evalTokens: number;
}

interface WorkRow {
  readonly kind: "work";
  readonly condition: "N" | "A" | "B";
  readonly model: string;
  readonly agent: number;
  readonly hat: string | null;
  readonly item: string;
  readonly answer: number | null;
  readonly correctIndex: number | null;
  readonly raw: string;
  readonly ms: number;
  readonly promptTokens: number;
  readonly evalTokens: number;
}

// ═══ The network trust boundary ══════════════════════════════════════════════
//
// Everything `generate()` returns came off an HTTP endpoint, and everything this
// file writes lands in a committed JSONL file that the analysis — and a reviewer —
// later read as fact. A file is not evidence because it is local; it is evidence
// because what went into it was checked. So the response is checked HERE, once, at
// the boundary, and every row is assembled from checked primitives.
//
// `generate`'s `as { response?: string; prompt_eval_count?: number; ... }` is a
// COMPILE-TIME claim about a runtime value nobody validated. `?? 0` only guards
// null and undefined, so `promptTokens` — declared `number` — could hold a string,
// an object, or NaN, and `flopProxy` would fold that straight into the FLOP figures
// with nothing failing. That is the defect these two functions close, and it is
// worth closing whether or not a static analyser ever mentions it.
//
// Both bounds sit ABOVE what the committed run produced (longest stored string 473
// characters, largest token count 157), and the character rule admits every one of
// the 36 758 strings already in `data/f3-hat-choice/`. So this is a verified no-op
// on the data the reported numbers were computed from: it constrains what a FUTURE
// run may write and rewrites nothing that exists.

/** Longest string this experiment will store. ~17x the longest one it has produced. */
const MAX_STORED_LENGTH = 8192;

/** Largest token count this experiment will store. `num_predict` never exceeds 700. */
const MAX_TOKEN_COUNT = 1_000_000;

/**
 * Storable text: letters, marks, numbers, punctuation, symbols, spaces, tab,
 * newline, and ZWJ.
 *
 * Deliberately NOT an ASCII allowlist — the committed generations contain CJK,
 * emoji, and variation selectors, and an ASCII filter would silently rewrite real
 * model output. What it excludes is what has no business in a data file: C0/C1
 * control characters, DEL, lone surrogates (which do not survive a UTF-8 round
 * trip), private-use and unassigned code points, U+2028/U+2029 (which split a
 * "line" for some readers and not others — and this format is line-delimited), and
 * the Cf format characters. ZWJ (U+200D) is the one Cf exception, admitted because
 * emoji sequences need it; the bidirectional overrides stay out, which is the
 * Trojan Source defence (Boucher & Anderson 2021, CVE-2021-42574) applied to a
 * file whose whole job is to be read by a human later.
 */
const STORABLE_TEXT = /^[\p{L}\p{M}\p{N}\p{P}\p{S}\p{Zs}\t\n\u200D]*$/u;

/** Checks a response-derived string. Throws rather than storing something else. */
export function storableText(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new TypeError(`${field}: expected a string from the endpoint, got ${typeof value}`);
  }
  if (value.length > MAX_STORED_LENGTH) {
    throw new RangeError(`${field}: ${value.length} chars exceeds the ${MAX_STORED_LENGTH} cap`);
  }
  if (!STORABLE_TEXT.test(value)) {
    throw new RangeError(`${field}: contains a character this experiment does not store`);
  }
  return value;
}

/** Checks a response-derived token count. Throws rather than storing a lie. */
export function storableCount(value: unknown, field: string): number {
  const n = Number(value ?? 0);
  if (!Number.isInteger(n) || n < 0 || n > MAX_TOKEN_COUNT) {
    throw new RangeError(`${field}: ${String(value)} is not a token count in [0, ${MAX_TOKEN_COUNT}]`);
  }
  return n;
}

/**
 * `generate` with its response-derived fields checked. Every call in this file goes
 * through here, so nothing downstream has to remember to check — `ms` is the only
 * field that never crossed the network (it is `performance.now()` on this side).
 *
 * A rejected response THROWS and stops the run rather than recording an empty row,
 * because `raw: ""` already means "the endpoint did not answer" and quietly reusing
 * it for "the endpoint answered with something unstorable" would put two different
 * facts under one symbol. Stopping is cheap here: `alreadyDone` resumes from the
 * last written row, so the operator loses one generation and gains the message.
 */
async function checkedGenerate(
  host: string,
  model: string,
  prompt: string,
  seed: number,
  temperature: number,
  numPredict: number,
): Promise<GenResult | null> {
  const r = await generate(host, model, prompt, seed, temperature, numPredict);
  if (r === null) return null;
  return {
    text: storableText(r.text, "response"),
    ms: r.ms,
    promptTokens: storableCount(r.promptTokens, "prompt_eval_count"),
    evalTokens: storableCount(r.evalTokens, "eval_count"),
  };
}

function writeRow(file: string, row: unknown): void {
  mkdirSync(OUT_DIR, { recursive: true });
  appendFileSync(join(OUT_DIR, file), JSON.stringify(row) + "\n");
}

/**
 * Rows already on disk, so an interrupted run resumes instead of re-querying.
 *
 * Reads and interprets ENOENT rather than asking `existsSync` first. The check-then-use
 * shape reads as defensive and prevents nothing: between the check and the read the path
 * can be created, deleted, or replaced — by a concurrent agent in this fleet, by a `git
 * checkout`, by a background clone — so the answer the check returned is already stale
 * when the use runs. It also turns one atomic syscall into two that can disagree.
 * (TOCTTOU — Bishop & Dilger 1996; CWE-367; `lint-check-then-use-file-races`.)
 */
function alreadyDone(file: string): number {
  try {
    return readFileSync(join(OUT_DIR, file), "utf8")
      .split("\n")
      .filter((l) => l.length > 0).length;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw err;
  }
}

// ═══ E1 — elicitation stability ══════════════════════════════════════════════

interface E1Plan {
  readonly model: string;
  readonly seeds: number;
  readonly temperature: number;
}

const E1_PLAN: readonly E1Plan[] = [
  { model: "qwen2.5:0.5b", seeds: 100, temperature: 0.8 },
  { model: "llama3.2:1b", seeds: 100, temperature: 0.8 },
  { model: "gemma2:2b", seeds: 100, temperature: 0.8 },
  { model: "qwen2.5:7b", seeds: 50, temperature: 0.8 },
  // Sensitivity: the ONLY entropy source separating "fresh instances" here is the
  // sampler, so the temperature it runs at is a confound worth measuring.
  { model: "gemma2:2b", seeds: 100, temperature: 1.0 },
];

async function runE1(): Promise<void> {
  const file = "e1-elicitations.jsonl";
  const done = alreadyDone(file);
  let n = 0;
  const total = E1_PLAN.reduce((s, p) => s + p.seeds * ELICITATIONS.length, 0);
  console.log(`E1: elicitation stability — ${total} generations (${done} already on disk)`);

  for (const plan of E1_PLAN) {
    for (const phrasing of ELICITATIONS) {
      for (let seed = 1; seed <= plan.seeds; seed++) {
        n++;
        if (n <= done) continue;
        const r = await checkedGenerate(HOST, plan.model, elicitationPrompt(phrasing.text), seed, plan.temperature, 24);
        const row: ElicitRow = {
          kind: "elicit",
          model: plan.model,
          phrasing: phrasing.id,
          seed,
          temperature: plan.temperature,
          raw: r?.text ?? "",
          ms: r?.ms ?? 0,
          promptTokens: r?.promptTokens ?? 0,
          evalTokens: r?.evalTokens ?? 0,
        };
        writeRow(file, row);
        if (n % 50 === 0) process.stdout.write(`  ${n}/${total}\r`);
      }
    }
  }
  console.log(`\nE1 complete → ${join(OUT_DIR, file)}`);
}

// ═══ E2 — assigned vs self-selected vs no-hat ════════════════════════════════

const E2_MODELS = ["gemma2:2b", "llama3.2:1b"] as const;
const E2_AGENTS = 24;
const E2_ITEMS = 40;

/**
 * Condition A's assigner: ONE author instance emits the whole roster in a single
 * pass. That is what "hats handed out by one author" means, and it is the shape
 * being compared against.
 *
 * NOTE THE DIRECTION OF THE BIAS: a roster written in one pass carries the
 * author's own anti-repetition pressure, so condition A gets a DIVERSITY
 * ADVANTAGE this experiment does not remove. The test is therefore conservative
 * against the self-selection hypothesis, and an A-favouring result would need to
 * be read with that in mind.
 */
async function assignHats(model: string, n: number): Promise<{ hats: string[]; raw: string }> {
  const prompt =
    `You are assembling a team of ${n} AI agents to review the same work.\n` +
    `Assign each agent a role.\n\n` +
    `Output exactly ${n} lines, one short role name per line (1-4 words), numbered "1." to "${n}.".\n` +
    `No explanation.\n\n1.`;
  const r = await checkedGenerate(HOST, model, prompt, 42, 0.8, 700);
  const raw = r?.text ?? "";
  const hats: string[] = [];
  for (const line of raw.split("\n")) {
    // Strip list numbering REPEATEDLY: the completion begins mid-list, so a model
    // that re-emits "1." produces "1. 1. Fact Checker" once the stem is rejoined.
    let t = line.trim();
    let prev = "";
    while (t !== prev) {
      prev = t;
      t = t
        .replace(/^\d+\s*[.)]\s*/, "")
        .replace(/^[-*]\s*/, "")
        .trim();
    }
    if (t.length > 1 && hats.length < n) hats.push(t);
  }
  return { hats, raw };
}

async function selfSelectHats(model: string, n: number): Promise<string[]> {
  const hats: string[] = [];
  for (let i = 0; i < n; i++) {
    const phrasing = ELICITATIONS[i % ELICITATIONS.length]!;
    const r = await checkedGenerate(HOST, model, elicitationPrompt(phrasing.text), i + 1, 0.8, 24);
    hats.push((r?.text ?? "").split("\n")[0]!.trim() || "agent");
  }
  return hats;
}

async function runCondition(
  file: string,
  condition: "N" | "A" | "B",
  model: string,
  hats: readonly (string | null)[],
  items: readonly WorkItem[],
  skip: number,
  counter: { n: number; total: number },
): Promise<void> {
  for (let a = 0; a < hats.length; a++) {
    for (const item of items) {
      counter.n++;
      if (counter.n <= skip) continue;
      // Temperature 0 and one fixed seed in the WORK phase: the hat string is the
      // only thing that differs between agents inside a condition.
      const hat = hats[a] ?? null;
      const r = await checkedGenerate(HOST, model, workPrompt(hat, item), 42, 0, 8);
      const row: WorkRow = {
        kind: "work",
        condition,
        model,
        agent: a,
        hat,
        item: item.id,
        answer: r ? parseAnswer(r.text, item.options.length) : null,
        correctIndex: item.correctIndex,
        raw: r?.text ?? "",
        ms: r?.ms ?? 0,
        promptTokens: r?.promptTokens ?? 0,
        evalTokens: r?.evalTokens ?? 0,
      };
      writeRow(file, row);
      if (counter.n % 50 === 0) process.stdout.write(`  ${counter.n}/${counter.total}\r`);
    }
  }
}

async function runE2(): Promise<void> {
  const items = generateWorkItems(E2_ITEMS, 42);
  const answerable = items.filter((i) => i.correctIndex !== null).length;
  console.log(`E2: ${E2_AGENTS} agents x ${E2_ITEMS} items x 3 conditions x ${E2_MODELS.length} models`);
  console.log(`  items: ${answerable} answerable, ${items.length - answerable} unanswerable`);

  for (const model of E2_MODELS) {
    const file = `e2-${model.replace(/[:.]/g, "-")}.jsonl`;
    const skip = alreadyDone(file);
    const counter = { n: 0, total: 0 };

    const assigned = await assignHats(model, E2_AGENTS);
    // The panel is sized to what the author ACTUALLY supplied, and all three
    // conditions use that same size. Cycling a short roster to reach 24 would put
    // duplicate hats in condition A — perfectly-correlated agents manufactured by
    // the harness, which would inflate ρ_A and hand the hypothesis a free win.
    const panel = Math.max(2, Math.min(E2_AGENTS, assigned.hats.length));
    const selfSel = await selfSelectHats(model, panel);
    const hatsA = assigned.hats.slice(0, panel);
    writeRow(file.replace(".jsonl", "-hats.jsonl"), {
      model,
      assignedRaw: assigned.raw,
      assignedParsed: assigned.hats,
      assignedUsed: hatsA,
      selfSelected: selfSel,
    });

    counter.total = panel * E2_ITEMS * 3;
    console.log(`\n  ${model}: panel=${panel} (A-roster ${assigned.hats.length} parsed, B-roster ${selfSel.length})`);
    const nullHats = Array.from({ length: panel }, () => null);
    await runCondition(file, "N", model, nullHats, items, skip, counter);
    await runCondition(file, "A", model, hatsA, items, skip, counter);
    await runCondition(file, "B", model, selfSel, items, skip, counter);
    console.log(`\n  ${model} complete → ${join(OUT_DIR, file)}`);
  }
}

// ═══ CLI ═════════════════════════════════════════════════════════════════════

if (import.meta.main) {
  const cmd = process.argv[2];
  if (cmd === "e1") await runE1();
  else if (cmd === "e2") await runE2();
  else {
    console.log("usage: bun f3-hat-choice-run.ts <e1|e2>");
    process.exit(2);
  }
}
