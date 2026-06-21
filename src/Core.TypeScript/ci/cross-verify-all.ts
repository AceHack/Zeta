#!/usr/bin/env bun
// cross-verify-all.ts — CI runner for the trust-core cross-verification oracles.
//
// Runs every tests/cross-verification/<primitive>/ oracle and FAILS if any oracle fails OR
// any primitive dir lacks a runnable oracle. The "no oracle = fail" rule is assert-don't-skip
// (.claude/rules/automated-tests-are-the-shield-assert-dont-skip.md): a cross-verification
// primitive with no oracle is an UNCHECKED primitive, not a silent pass.
//
// Two oracle shapes (each exits non-zero on mismatch, each reads RELATIVE paths from its own
// dir — so each MUST run with cwd = the primitive dir):
//   - compare.ts      : 4-language byte-lock — TS/F#/C#/Rust committed outputs vs the canonical
//                       vectors. This is the non-Byzantine compile-time agreement, baked in:
//                       it catches a lone-wrong oracle even if two agree wrongly.
//   - cross-verify.ts : TS golden-vector oracle (newer TS-only primitives; 4-lang deferred).
//
// This is the ENFORCEMENT half of the canonical-primitive gate (proof + 4-language byte-lock);
// the proof half lives in the Soraya formal-coverage / lean-proof lane. It does NOT regenerate
// the F#/C#/Rust outputs (no dotnet/rust toolchain needed) — it asserts the committed outputs,
// which is what makes a regression to a committed vector fail CI.
import { readdirSync, existsSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

const ROOT = "tests/cross-verification";

const dirs = readdirSync(ROOT)
  // `_`-prefixed dirs are shared infrastructure (e.g. `_harness/`), NOT primitives —
  // they carry the differ + its self-test, not an oracle. Skipping them keeps the
  // assert-don't-skip rule honest (no false "unchecked primitive" on the harness).
  .filter((name) => !name.startsWith("_"))
  .map((name) => join(ROOT, name))
  .filter((p) => statSync(p).isDirectory())
  .sort();

if (dirs.length === 0) {
  console.error(`cross-verify-all: no primitive dirs under ${ROOT}/ — refusing to pass on an empty surface`);
  process.exit(1);
}

let failed = 0;
for (const dir of dirs) {
  const entry = existsSync(join(dir, "compare.ts"))
    ? "compare.ts"
    : existsSync(join(dir, "cross-verify.ts"))
      ? "cross-verify.ts"
      : null;
  if (entry === null) {
    console.error(`✗ ${dir}: no oracle (compare.ts | cross-verify.ts) — unchecked primitive (assert-don't-skip)`);
    failed++;
    continue;
  }
  console.log(`→ ${dir}: ${entry}`);
  // process.execPath under bun is the bun binary — run the oracle with the same runtime,
  // cwd set to the primitive dir so its relative reads resolve.
  const r = spawnSync(process.execPath, [entry], { cwd: dir, stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`✗ ${dir}: ${entry} exited ${r.status === null ? `signal ${r.signal}` : r.status}`);
    failed++;
  } else {
    console.log(`✓ ${dir}: ${entry} passed`);
  }
}

console.log(`\ncross-verify-all: ${dirs.length - failed}/${dirs.length} primitives passed`);
process.exit(failed === 0 ? 0 : 1);
