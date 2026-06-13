#!/usr/bin/env bun
/**
 * src/Core.TypeScript/kiro/kiro-loop-wrapper.ts — launchd entry point for Kiro autonomous loop.
 *
 * TS port of tools/kiro/kiro-loop-wrapper.sh. The plist ProgramArguments
 * should point to: bun src/Core.TypeScript/kiro/kiro-loop-wrapper.ts
 *
 * This wrapper:
 *   1. Resolves the repo root from its own location
 *   2. Sets ZETA_KIRO_LOOP_WORKTREE env var
 *   3. Execs the actual loop tick (kiro-loop-tick.ts)
 */

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { existsSync } from "node:fs";

function main(): number {
  // Resolve repo root relative to this script
  const scriptDir = dirname(new URL(import.meta.url).pathname);
  const repoRoot = resolve(scriptDir, "../..");

  // Source shellenv if available (adds mise/bun/node paths)
  const shellenvPath = resolve(process.env.HOME ?? "", ".config/zeta/shellenv.sh");
  if (existsSync(shellenvPath)) {
    // Read shellenv and extract PATH-like exports
    const result = spawnSync("bash", ["-c", `source "${shellenvPath}" && echo "$PATH"`], { encoding: "utf8" });
    if (result.status === 0 && result.stdout.trim()) {
      process.env.PATH = result.stdout.trim();
    }
  }

  // Set worktree env
  process.env.ZETA_KIRO_LOOP_WORKTREE = process.env.ZETA_KIRO_LOOP_WORKTREE ?? repoRoot;

  // Run the tick
  const tick = resolve(repoRoot, "src/Core.TypeScript/kiro/kiro-loop-tick.ts");
  const result = spawnSync("bun", [tick], {
    cwd: repoRoot,
    stdio: "inherit",
    env: process.env,
  });

  return result.status ?? 1;
}

if (import.meta.main) {
  process.exit(main());
}

export { main };
