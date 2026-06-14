#!/usr/bin/env bun
/**
 * SHIM — delegates to the unified loop-tick.
 *
 * Pure utility functions extracted to src/Core.TypeScript/service/capacity/codex-harness.ts.
 * This file re-exports them for backward compatibility.
 *
 * New usage: `bun src/Core.TypeScript/service/loop-tick.ts --persona codex`
 */
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";

// Re-export pure functions for tests that import from this path
export { buildCodexPrompt, codexExecArgs, codexLoopEnv } from "../../src/Core.TypeScript/service/capacity/codex-harness";

// When run directly, delegate to unified tick
if (import.meta.main) {
  const repoRoot = join(dirname(new URL(import.meta.url).pathname), "../..");
  const tick = join(repoRoot, "src/Core.TypeScript/service/loop-tick.ts");

  const result = spawnSync("bun", [tick, "--persona", "codex"], {
    cwd: repoRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      ZETA_LOOP_WORKTREE: process.env["ZETA_CODEX_LOOP_WORKTREE"] ?? process.env["ZETA_LOOP_WORKTREE"],
      ZETA_LOOP_STATE_DIR: process.env["ZETA_CODEX_LOOP_STATE_DIR"] ?? process.env["ZETA_LOOP_STATE_DIR"],
      ZETA_LOOP_LOG_DIR: process.env["ZETA_CODEX_LOOP_LOG_DIR"] ?? process.env["ZETA_LOOP_LOG_DIR"],
      ZETA_LOOP_REF: process.env["ZETA_CODEX_LOOP_REF"] ?? process.env["ZETA_LOOP_REF"],
    },
  });

  process.exit(result.status ?? 1);
}
