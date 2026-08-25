// bootstrap-stage-0.test.ts — the falsifier for the Ouroboros BASE CASE.
//
// WHY THIS FILE EXISTS. `ace` is what bootstraps Zeta, so `ace` may not itself
// require Zeta to be present in order to build or run. That is the base case of
// the Ouroboros: stage 0 must close over nothing but a clone and a bun runtime.
// If ace's runtime closure ever acquires a Zeta-only dependency, a fresh host has
// no order in which it can install anything, and the snake cannot reach its tail.
//
// WHY IT IS A `bun test` AND NOT A SHELL SCRIPT. This check arrived on PR #14858 as
// `tests/cross-verification/bootstrap-stage-0.test.sh`. Three things were wrong with
// that home, and only the third is about bash:
//   (1) NOTHING INVOKED IT. No workflow, no package.json script, no harness referenced
//       the file. A test nothing runs is the vacuity class in its purest form — it
//       looks like coverage and constrains nothing.
//   (2) WRONG DIRECTORY. Every other entry under `tests/cross-verification/` is a
//       cross-LANGUAGE oracle vector suite. This is a single-runtime build smoke test;
//       it shares no harness with its neighbours.
//   (3) NEW BASH. `check-bash-retirement-inventory --enforce` refuses new non-Lean
//       shell, and it was right to refuse this one. Allowlisting it would have widened
//       a guard to admit a test that never ran.
// As a `.test.ts` beside its subject it is discovered by the existing bun test run, so
// it executes on every PR — which is the only form in which it is worth anything.
//
// ZETA_AVAILABLE=0 is set explicitly. The original script set it twice (once empty,
// then once to "0"); the empty assignment was dead and is dropped.

import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const ACE_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(ACE_DIR, "..", "..", "..");
const ACE_ENTRY = join(ACE_DIR, "ace.ts");

/** Environment with Zeta explicitly declared ABSENT. */
const STAGE_0_ENV = { ...process.env, ZETA_AVAILABLE: "0" } as NodeJS.ProcessEnv;

describe("Ouroboros stage 0 — ace bootstraps without Zeta", () => {
  test("ace bundles to a standalone artifact with ZETA_AVAILABLE=0", () => {
    // Build into a fresh temp dir, never the repo's `scratch/`: a test that writes
    // inside the worktree can pass because of residue from a previous run.
    const out = mkdtempSync(join(tmpdir(), "ace-stage0-"));
    try {
      const bundle = join(out, "ace-dist.js");
      const built = spawnSync(
        process.execPath,
        ["build", ACE_ENTRY, "--target", "bun", "--outfile", bundle],
        { cwd: REPO_ROOT, env: STAGE_0_ENV, encoding: "utf8" },
      );
      expect(
        `build status=${built.status}\n${built.stderr ?? ""}`,
      ).toBe("build status=0\n");

      // Bundling proves the closure RESOLVES. Running proves it also EXECUTES —
      // a module can resolve and still throw at import time on a missing Zeta.
      const ran = spawnSync(process.execPath, ["run", bundle, "help"], {
        cwd: out,
        env: STAGE_0_ENV,
        encoding: "utf8",
      });
      expect(
        `help status=${ran.status}\n${ran.stderr ?? ""}`,
      ).toBe("help status=0\n");
      expect((ran.stdout ?? "").length).toBeGreaterThan(0);
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  }, 120_000);
});
