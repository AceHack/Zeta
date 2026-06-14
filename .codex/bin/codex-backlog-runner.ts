#!/usr/bin/env bun
/**
 * SHIM — delegates to the unified loop-tick with observe-inline.
 *
 * Pure utility functions extracted to src/Core.TypeScript/service/capacity/capacity.ts.
 * This file re-exports them for backward compatibility and delegates execution
 * to the unified service.
 *
 * New usage: `bun src/Core.TypeScript/service/loop-tick.ts --persona codex`
 */
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";

// Re-export pure functions for tests that import from this path
export {
  parseOpenPrListOutput,
  capacityPrCount,
  activeClaimsFromOpenPrs,
  activeClaimsFromRemoteClaimDiffs,
  activeClaimsFromHeartbeatSignals,
  capacityGate,
} from "../../src/Core.TypeScript/service/capacity/capacity";
export type {
  OpenPrListItem,
  RemoteClaimDiff,
  HeartbeatSignal,
  CapacityGate,
} from "../../src/Core.TypeScript/service/capacity/capacity";

// When run directly, delegate to unified tick with observe-inline
if (import.meta.main) {
  const repoRoot = join(dirname(new URL(import.meta.url).pathname), "../..");
  const tick = join(repoRoot, "src/Core.TypeScript/service/loop-tick.ts");

  const result = spawnSync("bun", [tick, "--persona", "codex"], {
    cwd: repoRoot,
    stdio: "inherit",
    env: { ...process.env, ZETA_LOOP_OBSERVE_INLINE: "1" },
  });

  process.exit(result.status ?? 1);
}
