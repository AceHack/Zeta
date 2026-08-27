#!/usr/bin/env bun
/**
 * f4-question-bias-run.ts — sequences generations and writes raw JSONL. Nothing else.
 *
 * STATUS: toy. Every metric and its falsifier live in `f4-question-bias.ts` /
 * `.test.ts`; this file makes no claim and computes no statistic.
 *
 *   bun f4-question-bias-run.ts role               # domain R, small models, replicates 0-119
 *   bun f4-question-bias-run.ts preference         # domain P, small models, replicates 0-119
 *   bun f4-question-bias-run.ts role-large         # domain R on the 7B, for the size question
 *   bun f4-question-bias-run.ts role-block2        # domain R, replicates 120-239
 *   bun f4-question-bias-run.ts preference-block2  # domain P, replicates 120-239
 *
 * Raw generations land in `data/f4-question-bias/` as JSONL so every number in the
 * research doc is recomputable offline, without a model and without a GPU. Runs are
 * resumable: an interrupted run skips the rows already on disk, in the same order.
 */

import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { join, resolve, sep } from "node:path";
import { generate } from "./f3-hat-choice-decorrelation";
import { domainById, promptText, seedFor, type DomainSpec } from "./f4-question-bias";

const HOST = "http://127.0.0.1:11434";
const OUT_DIR = join(import.meta.dir, "..", "..", "..", "data", "f4-question-bias");

/** The sampler temperature is the ONLY entropy source separating replicates. */
const TEMPERATURE = 0.8;
const NUM_PREDICT = 24;

export const SMALL_MODELS = ["qwen2.5:0.5b", "llama3.2:1b", "gemma2:2b"] as const;
export const LARGE_MODEL = "qwen2.5:7b";
export const REPLICATES_SMALL = 120;
export const REPLICATES_LARGE = 80;
/**
 * Second block of replicates, appended to a separate file so the first run stays
 * resumable by row count. Seeds keep coming from `seedFor(promptIndex, replicate)`, so
 * block 2 shares no seed with block 1 and the two concatenate into one honest sample of
 * 240 — there is no re-use and no overlap to double-count.
 *
 * Why it exists: at 120 replicates the CALIBRATION PAIR read excess = 0.0305 on
 * qwen2.5:0.5b, above the pre-registered 0.02 equivalence delta. That is the instrument
 * failing its own zero check, and the fix for an instrument that cannot resolve below
 * its threshold is more samples, not a looser threshold.
 */
export const REPLICATES_BLOCK2_START = 120;
export const REPLICATES_BLOCK2_END = 240;

export interface AnswerRow {
  readonly domain: string;
  readonly model: string;
  readonly prompt: string;
  readonly replicate: number;
  readonly seed: number;
  readonly temperature: number;
  readonly raw: string;
  /** Wall-clock. LABELLED latency, used for nothing. It is not energy and not a cost. */
  readonly ms: number;
  readonly promptTokens: number;
  readonly evalTokens: number;
}

function outFile(domain: string, model: string): string {
  return `${domain}-${model.replace(/[:.]/g, "-")}.jsonl`;
}

/**
 * Upper bound on one generation's text, in UTF-16 code units.
 *
 * The instrument asks for `NUM_PREDICT` = 24 tokens and the longest response across the
 * 27,360 rows already on disk is 149 chars, so this is ~55x headroom over observed data.
 * It rejects a server that is not answering the question that was asked; it cannot reject
 * a legitimate generation.
 */
export const MAX_RAW_CHARS = 8192;

/**
 * The `/api/generate` response did not match the contract this harness was written
 * against. Distinct from a generation that FAILED (a dead server, a non-2xx) — that is a
 * missing datum. This is a datum whose shape is wrong, which is worse, because a wrong
 * shape survives `JSON.stringify` and reappears downstream looking like a measurement.
 */
export class ProtocolViolation extends Error {
  constructor(field: string, detail: string) {
    super(`ollama /api/generate: field '${field}' violates the contract — ${detail}`);
    this.name = "ProtocolViolation";
  }
}

/** Type name only. The offending VALUE is never echoed — it is the untrusted part. */
function describeType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function requireText(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new ProtocolViolation(field, `expected string, got ${describeType(value)}`);
  }
  if (value.length > MAX_RAW_CHARS) {
    throw new ProtocolViolation(field, `${value.length} chars exceeds the ${MAX_RAW_CHARS} cap`);
  }
  return value;
}

function requireCount(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new ProtocolViolation(field, `expected a finite count >= 0, got ${describeType(value)}`);
  }
  return value;
}

/**
 * PARSE a generation result into an `AnswerRow`. Never cast one.
 *
 * `generate` reaches the model over HTTP and hands back `(await res.json()) as {...}` — a
 * CAST, which checks nothing at runtime. So every field arriving from the wire is
 * `unknown` in fact whatever it claims in the type, and this function is where that lie is
 * settled. `raw` / `promptTokens` / `evalTokens` are network-sourced; `ms` is measured
 * locally and is validated only so the row has one uniform gate.
 *
 * The defect this closes: with the cast alone, a response of `{"eval_count": {"a": 1}}`
 * put an object into a numeric field, `JSON.stringify` wrote it out happily, and
 * `f4-question-bias-analyze.ts` — which casts again on `JSON.parse(line) as Row` — folded
 * it into statistics without anything throwing. Nothing in the path could fail, which is
 * the vacuity class: a check that cannot fail is not a check.
 *
 * Note what is deliberately NOT rejected: control characters in `raw`. A model answering
 * in 24 tokens may legitimately emit a newline, and the newline is part of the datum.
 * `serializeRow` is what keeps that safe on disk.
 */
export function toAnswerRow(
  fixed: Pick<AnswerRow, "domain" | "model" | "prompt" | "replicate" | "seed">,
  gen: unknown,
): AnswerRow {
  if (gen === null || gen === undefined) {
    return { ...fixed, temperature: TEMPERATURE, raw: "", ms: 0, promptTokens: 0, evalTokens: 0 };
  }
  const g = gen as Record<string, unknown>;
  return {
    ...fixed,
    temperature: TEMPERATURE,
    raw: requireText(g["text"], "response"),
    ms: requireCount(g["ms"], "ms"),
    promptTokens: requireCount(g["promptTokens"], "prompt_eval_count"),
    evalTokens: requireCount(g["evalTokens"], "eval_count"),
  };
}

/**
 * One row, one line — the JSONL record boundary, asserted rather than assumed.
 *
 * `JSON.stringify` escapes every character that could end a record early: newline, CR,
 * NUL and lone surrogates all come back as backslash escape SEQUENCES (two characters
 * for newline and CR, six for NUL and surrogates), never as literal bytes. That is what
 * lets model text be stored VERBATIM without a response splitting one row into two.
 *
 * But that escaping is load-bearing and invisible — nothing in the old code said the
 * record boundary depended on it, so an edit swapping the serializer for a template
 * literal would have corrupted every downstream statistic silently. The check below makes
 * the dependency explicit and loud.
 *
 * `assertSingleRecord` is separate and exported for one reason: folded into `serializeRow`
 * it could not be reached through the public API, because `JSON.stringify` never emits a
 * literal newline — a guard nothing can trigger is a check that cannot fail. Split out, it
 * takes an arbitrary string and its falsifier is direct.
 */
export function assertSingleRecord(json: string): void {
  if (/[\n\r]/.test(json)) {
    throw new Error("serialized row contains a literal newline — the JSONL record boundary would break");
  }
}

export function serializeRow(row: AnswerRow): string {
  const json = JSON.stringify(row);
  assertSingleRecord(json);
  return `${json}\n`;
}

/**
 * The DESTINATION half of the write, enforced rather than assumed.
 *
 * `serializeRow` makes the network-sourced *content* safe on disk; nothing made the
 * *path* safe. Today `outFile` builds the name from `domain.id` and a model id — both
 * local registry constants — so no wire value reaches it. That is a property of the
 * current call graph, not of the code, and CodeQL is right that it is unstated: alerts
 * #801 / #803 (`js/http-to-file-access`) flag exactly this write.
 *
 * The response to an unstated property is to state it as a check, not to argue that the
 * call graph happens to be fine. So every read and every write in this file resolves its
 * path through here, and the three properties the dismissal rationale rests on become
 * falsifiable:
 *
 *   1. **contained** — the resolved path is inside `OUT_DIR`, checked after `resolve`
 *      rather than by inspecting the string, because `..` is not the only way out
 *   2. **no separators** — a name is a name, never a path; this is what stops a write
 *      landing in a SUBDIRECTORY of the dataset dir, which containment alone permits
 *   3. **`.jsonl` only** — the sink is a data extension; nothing in this repo executes one
 *
 * The order is load-bearing and was fixed by mutation testing, not by taste. Written with
 * the name rules first, the containment clause was unreachable — every input that could
 * have escaped was rejected one line earlier, so deleting containment broke no test. A
 * guard nothing can trigger is a check that cannot fail, which is the defect this file's
 * other comments keep naming. Containment runs first because it is the property that
 * actually matters; each of the three now dies under its own mutant.
 *
 * A future edit that lets a model-supplied string choose the filename fails here instead
 * of silently writing outside the dataset directory.
 */
export function resolveOutPath(dir: string, file: string): string {
  const base = resolve(dir);
  const full = resolve(base, file);
  if (!full.startsWith(base + sep)) {
    throw new Error(`output path '${full}' escapes the dataset directory '${base}'`);
  }
  if (file.includes("/") || file.includes("\\") || file.includes("\0")) {
    throw new Error(`output name '${file}' contains a path separator — it must be a bare filename`);
  }
  if (!file.endsWith(".jsonl")) {
    throw new Error(`output name '${file}' is not .jsonl — this sink writes data, never code or config`);
  }
  return full;
}

/**
 * Exported for one reason: a guard that is tested but not WIRED is the same vacuity one
 * level up. Unhooking `resolveOutPath` from this function kills no test while the
 * function is private, so the seam has to be reachable for the wiring itself to be
 * falsifiable. Resolution happens BEFORE `mkdirSync` so a refused name creates nothing.
 */
export function writeRow(file: string, row: AnswerRow): void {
  const line = serializeRow(row);
  const path = resolveOutPath(OUT_DIR, file);
  mkdirSync(OUT_DIR, { recursive: true });
  appendFileSync(path, line);
}

/**
 * Read and interpret ENOENT rather than asking `existsSync` first: the answer to a
 * separate existence question is stale the instant it returns, and this fleet has
 * concurrent writers. (TOCTTOU — Bishop & Dilger 1996; CWE-367.)
 */
function rowsOnDisk(file: string): number {
  try {
    return readFileSync(resolveOutPath(OUT_DIR, file), "utf8")
      .split("\n")
      .filter((l) => l.length > 0).length;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw err;
  }
}

async function runDomain(
  domain: DomainSpec,
  models: readonly string[],
  from: number,
  to: number,
  suffix = "",
): Promise<void> {
  const replicates = to - from;
  for (const model of models) {
    const file = outFile(domain.id, model).replace(".jsonl", `${suffix}.jsonl`);
    const done = rowsOnDisk(file);
    const total = domain.prompts.length * replicates;
    console.log(`${domain.id} / ${model}: ${total} generations (${done} already on disk)`);
    let n = 0;
    const t0 = performance.now();
    for (let pi = 0; pi < domain.prompts.length; pi++) {
      const prompt = domain.prompts[pi]!;
      const text = promptText(domain, prompt);
      for (let rep = from; rep < to; rep++) {
        n++;
        if (n <= done) continue;
        const seed = seedFor(pi, rep);
        const r = await generate(HOST, model, text, seed, TEMPERATURE, NUM_PREDICT);
        writeRow(file, toAnswerRow({ domain: domain.id, model, prompt: prompt.id, replicate: rep, seed }, r));
        if (n % 100 === 0) {
          const rate = (n - done) / ((performance.now() - t0) / 1000);
          process.stdout.write(`  ${n}/${total} (${rate.toFixed(1)}/s)\r`);
        }
      }
    }
    console.log(`\n  ${domain.id} / ${model} complete -> ${resolveOutPath(OUT_DIR, file)}`);
  }
}

if (import.meta.main) {
  const cmd = process.argv[2];
  if (cmd === "role") await runDomain(domainById("role"), SMALL_MODELS, 0, REPLICATES_SMALL);
  else if (cmd === "preference") await runDomain(domainById("preference"), SMALL_MODELS, 0, REPLICATES_SMALL);
  else if (cmd === "role-large") await runDomain(domainById("role"), [LARGE_MODEL], 0, REPLICATES_LARGE);
  else if (cmd === "role-block2")
    await runDomain(domainById("role"), SMALL_MODELS, REPLICATES_BLOCK2_START, REPLICATES_BLOCK2_END, "-b2");
  else if (cmd === "preference-block2")
    await runDomain(domainById("preference"), SMALL_MODELS, REPLICATES_BLOCK2_START, REPLICATES_BLOCK2_END, "-b2");
  else {
    console.log("usage: bun f4-question-bias-run.ts <role|preference|role-large|role-block2|preference-block2>");
    process.exit(2);
  }
}
