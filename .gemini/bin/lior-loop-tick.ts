#!/usr/bin/env bun
/**
 * SHIM — delegates to the unified loop-tick.
 *
 * This file exists for backward compatibility with existing launchd plists.
 * New installations: `bun src/Core.TypeScript/service/service-manager-cli.ts install --persona lior`
 *
 * The unified system: src/Core.TypeScript/service/loop-tick.ts --persona lior
 */
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";

const repoRoot = join(dirname(new URL(import.meta.url).pathname), "../..");
const tick = join(repoRoot, "src/Core.TypeScript/service/loop-tick.ts");

const result = spawnSync("bun", [tick, "--persona", "lior"], {
  cwd: repoRoot,
  stdio: "inherit",
  env: { ...process.env },
});

// Suppress 429 rate-limit exits (same as original behavior)
const stderr = result.stderr?.toString() ?? "";
const is429 = /429|RESOURCE_EXHAUSTED|quota exceeded/i.test(stderr);
if (result.status !== 0 && is429) {
  console.error(`[Lior Loop] Rate-limited (429); exiting 0 to prevent launchd throttling`);
  process.exit(0);
}

process.exit(result.status ?? 1);
