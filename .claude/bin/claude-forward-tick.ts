#!/usr/bin/env bun
/**
 * SHIM — forward-tick functionality is now handled by the unified loop-tick's
 * observe-inline path (ForgeState → merge-ready PR detection → auto-merge action).
 *
 * This file exists for backward compatibility with existing launchd plists.
 * New installations: use the unified system with ZETA_LOOP_OBSERVE_INLINE=1.
 *
 * The unified system at src/Core.TypeScript/service/loop-tick.ts handles forward
 * actions via the observe controller's ForgeState (PR merge-readiness detection).
 */
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";

const repoRoot = join(dirname(new URL(import.meta.url).pathname), "../..");
const tick = join(repoRoot, "src/Core.TypeScript/service/loop-tick.ts");

const result = spawnSync("bun", [tick, "--persona", "otto"], {
  cwd: repoRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    ZETA_LOOP_OBSERVE_INLINE: "1", // forward-tick uses the observe path
    ZETA_LOOP_WORKTREE: process.env["ZETA_CLAUDE_FORWARD_WORKTREE"] ?? process.env["ZETA_LOOP_WORKTREE"],
    ZETA_LOOP_STATE_DIR: process.env["ZETA_CLAUDE_FORWARD_STATE_DIR"] ?? process.env["ZETA_LOOP_STATE_DIR"],
    ZETA_LOOP_LOG_DIR: process.env["ZETA_CLAUDE_FORWARD_LOG_DIR"] ?? process.env["ZETA_LOOP_LOG_DIR"],
  },
});

process.exit(result.status ?? 1);
