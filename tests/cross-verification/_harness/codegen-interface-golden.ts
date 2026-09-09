/**
 * codegen-interface-golden.ts — the byte-lock for every emitter in codegen-interface.ts.
 *
 * WHY THIS EXISTS. `codegen-interface.ts` mapped IR type names to each target
 * language by CHAINING `String.prototype.replace` calls. A chain is
 * order-dependent: every later pattern re-scans the OUTPUT of every earlier one,
 * so `int64 -> int` followed by `int -> long` silently yields `long` for `int64`.
 * The chains happened to be safe only because several of their links mapped a
 * token to ITSELF (`.replace(/\bint\b/g, "int")` — CodeQL js/identity-replacement
 * flagged ten of them), and a dead link reads exactly like a load-bearing one.
 *
 * Replacing the chains with a single-pass table is behaviour-preserving ONLY if
 * something checks the emitted bytes. This file is that something: it regenerates
 * every emitter's output for every committed IR fixture, and the test beside it
 * compares against `codegen-interface-golden.json`.
 *
 * The vectors are TEXT in JSON (`.claude/rules/no-binary-in-proof-lineage.md`), so
 * drift in any of the seven emitters is a readable `git` diff.
 *
 * Regenerate deliberately (and READ the diff):
 *   bun tests/cross-verification/_harness/codegen-interface-golden.ts --write
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  emitCSharp, emitTypeScript, emitRust, emitFSharp, emitPython, emitGo, emitQSharp,
  type InterfaceIr,
} from "./codegen-interface";

export const IR_DIR = join(import.meta.dir, "../zeta-ir-v2/interfaces");
export const GOLDEN_PATH = join(import.meta.dir, "codegen-interface-golden.json");

/** The seven emitters, keyed by the file extension each target uses. */
export const EMITTERS: Readonly<Record<string, (ir: InterfaceIr) => string>> = {
  cs: emitCSharp,
  ts: emitTypeScript,
  rs: emitRust,
  fs: emitFSharp,
  py: emitPython,
  go: emitGo,
  qs: emitQSharp,
};

export type GoldenVectors = Record<string, Record<string, string>>;

/** Emit every language for every committed IR fixture, in a deterministic order. */
export function generateVectors(): GoldenVectors {
  const fixtures = readdirSync(IR_DIR).filter(f => f.endsWith(".ir.json")).sort();
  if (fixtures.length === 0) {
    throw new Error(`no IR fixtures under ${IR_DIR} — the byte-lock would be vacuous`);
  }
  const out: GoldenVectors = {};
  for (const fixture of fixtures) {
    const ir: InterfaceIr = JSON.parse(readFileSync(join(IR_DIR, fixture), "utf-8"));
    const perLang: Record<string, string> = {};
    for (const lang of Object.keys(EMITTERS).sort()) {
      perLang[lang] = EMITTERS[lang]!(ir);
    }
    out[fixture] = perLang;
  }
  return out;
}

export function readVectors(): GoldenVectors {
  return JSON.parse(readFileSync(GOLDEN_PATH, "utf-8")) as GoldenVectors;
}

if (import.meta.main) {
  const vectors = generateVectors();
  const langs = Object.keys(EMITTERS).length;
  if (process.argv.includes("--write")) {
    writeFileSync(GOLDEN_PATH, `${JSON.stringify(vectors, null, 2)}\n`);
    console.log(
      `[codegen-interface-golden] wrote ${Object.keys(vectors).length} fixtures x ${langs} languages -> ${GOLDEN_PATH}`,
    );
  } else {
    console.log(
      `[codegen-interface-golden] ${Object.keys(vectors).length} fixtures x ${langs} languages (pass --write to update the byte-lock)`,
    );
  }
}
