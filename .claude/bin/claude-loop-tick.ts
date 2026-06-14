#!/usr/bin/env bun
/**
 * SHIM — delegates to the unified loop-tick.
 *
 * This file exists for backward compatibility with existing launchd plists
 * that reference `.claude/bin/claude-loop-tick.ts`. New installations should
 * use `src/Core.TypeScript/service/service-manager-cli.ts install --persona otto`.
 *
 * The unified system lives at: src/Core.TypeScript/service/loop-tick.ts
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
    // Preserve legacy env vars by mapping to unified schema
    ZETA_LOOP_WORKTREE: process.env["ZETA_CLAUDE_LOOP_WORKTREE"] ?? process.env["ZETA_LOOP_WORKTREE"],
    ZETA_LOOP_STATE_DIR: process.env["ZETA_CLAUDE_LOOP_STATE_DIR"] ?? process.env["ZETA_LOOP_STATE_DIR"],
    ZETA_LOOP_LOG_DIR: process.env["ZETA_CLAUDE_LOOP_LOG_DIR"] ?? process.env["ZETA_LOOP_LOG_DIR"],
    ZETA_LOOP_REF: process.env["ZETA_CLAUDE_LOOP_REF"] ?? process.env["ZETA_LOOP_REF"],
  },
});

process.exit(result.status ?? 1);
