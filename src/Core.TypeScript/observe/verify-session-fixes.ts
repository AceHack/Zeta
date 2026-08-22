#!/usr/bin/env bun
/**
 * verify-session-fixes.ts — confirm the 2026-08-22 session fixes took effect.
 *
 * Run after a few heartbeat ticks to verify:
 * 1. data/ci-runs.jsonl exists and is growing (drift-rate recording)
 * 2. RS blocks show real phase ranges (not all 1-1)
 * 3. Vault status reflects actual activity
 * 4. Connectivity is capped at 100%
 *
 * Exit 0 = all confirmed. Exit 1 = some still pending.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = process.cwd();
let issues = 0;

function check(name: string, ok: boolean, detail: string): void {
  const icon = ok ? "✓" : "✗";
  console.log(`${icon} ${name}: ${detail}`);
  if (!ok) issues++;
}

/** Read, then map ENOENT. existsSync-then-read is a check-then-use race. */
function readTextIfPresent(path: string): string | undefined {
  try {
    return readFileSync(path, "utf-8");
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw err;
  }
}

// 1. Drift-rate accumulating
const ciRunsPath = join(repoRoot, "data", "ci-runs.jsonl");
const ciRunsText = readTextIfPresent(ciRunsPath);
if (ciRunsText !== undefined) {
  const lines = ciRunsText.trim().split("\n").filter((l) => l);
  check("Drift-rate", lines.length > 0, `${lines.length} run(s) recorded`);
} else {
  check("Drift-rate", false, "data/ci-runs.jsonl does not exist yet — wait for next heartbeat tick");
}

// 2. RS blocks with real phase ranges
const rsBlocksPath = join(repoRoot, "data", "rs-blocks.jsonl");
const rsBlocksText = readTextIfPresent(rsBlocksPath);
if (rsBlocksText !== undefined) {
  const lines = rsBlocksText.trim().split("\n").filter((l) => l);
  const blocks = lines.map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  const realBlocks = blocks.filter((b: any) => b.endPhase - b.startPhase > 1);
  check("RS blocks", realBlocks.length > 0,
    realBlocks.length > 0
      ? `${realBlocks.length} block(s) with real phase ranges (fix confirmed)`
      : `${blocks.length} total blocks but all show phases 1-1 (buffer fix pending next tick)`);
} else {
  check("RS blocks", false, "data/rs-blocks.jsonl does not exist");
}

// 3. Vault status
// 4. Connectivity capped
const vaultPath = join(repoRoot, "data", "vault-state.json");
const vaultText = readTextIfPresent(vaultPath);
if (vaultText !== undefined) {
  const vault = JSON.parse(vaultText);
  const liveVaults = vault.vaults.filter((v: any) => v.status === "live").length;
  check("Vault status", liveVaults >= 3,
    `${liveVaults}/5 vaults live (action-recognition fix ${liveVaults >= 3 ? "confirmed" : "pending"})`);
  const connectivity = vault.connectivity ?? [];
  const allCapped = connectivity.every((c: any) => c.connectivity <= 1.0);
  check("Connectivity", allCapped && connectivity.length > 0,
    connectivity.length > 0
      ? `all agents ≤100% (max: ${Math.max(...connectivity.map((c: any) => c.connectivity)) * 100}%)`
      : "no connectivity data");
} else {
  check("Vault status", false, "data/vault-state.json does not exist");
  check("Connectivity", false, "no vault-state");
}

console.log(`\n${issues === 0 ? "All fixes confirmed ✓" : `${issues} item(s) still pending — run again after a few ticks`}`);
process.exit(issues > 0 ? 1 : 0);
