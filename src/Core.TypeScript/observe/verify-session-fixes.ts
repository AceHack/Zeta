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

export type ReadTextResult =
  | { readonly kind: "present"; readonly text: string }
  | { readonly kind: "missing" }
  | { readonly kind: "unreadable"; readonly detail: string };

export interface VaultDocument {
  readonly vaults: readonly { readonly status?: unknown }[];
  readonly connectivity: readonly { readonly connectivity?: unknown }[];
}

export type ParseVaultResult =
  | { readonly kind: "parsed"; readonly value: VaultDocument }
  | { readonly kind: "invalid"; readonly detail: string };

function errorCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null || !("code" in error)) return null;
  return typeof error.code === "string" ? error.code : null;
}

function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function readText(path: string): ReadTextResult {
  try {
    return { kind: "present", text: readFileSync(path, "utf-8") };
  } catch (error) {
    return errorCode(error) === "ENOENT" ? { kind: "missing" } : { kind: "unreadable", detail: errorDetail(error) };
  }
}

export function parseVault(text: string): ParseVaultResult {
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value !== "object" || value === null || !("vaults" in value) || !Array.isArray(value.vaults)) {
      return { kind: "invalid", detail: "vaults must be an array" };
    }

    const connectivity = "connectivity" in value && Array.isArray(value.connectivity) ? value.connectivity : [];
    return { kind: "parsed", value: { vaults: value.vaults, connectivity } };
  } catch (error) {
    return { kind: "invalid", detail: errorDetail(error) };
  }
}

export function verifySessionFixes(repoRoot: string): number {
  let issues = 0;
  const check = (name: string, ok: boolean, detail: string): void => {
    const icon = ok ? "✓" : "✗";
    console.log(`${icon} ${name}: ${detail}`);
    if (!ok) issues++;
  };

  // 1. Drift-rate accumulating
  const ciRunsPath = join(repoRoot, "data", "ci-runs.jsonl");
  const ciRuns = readText(ciRunsPath);
  if (ciRuns.kind === "present") {
    const lines = ciRuns.text.trim().split("\n").filter(Boolean);
    check("Drift-rate", lines.length > 0, `${lines.length} run(s) recorded`);
  } else if (ciRuns.kind === "unreadable") {
    check("Drift-rate", false, `data/ci-runs.jsonl is unreadable: ${ciRuns.detail}`);
  } else {
    check("Drift-rate", false, "data/ci-runs.jsonl does not exist yet — wait for next heartbeat tick");
  }

  // 2. RS blocks with real phase ranges
  const rsBlocksPath = join(repoRoot, "data", "rs-blocks.jsonl");
  const rsBlocks = readText(rsBlocksPath);
  if (rsBlocks.kind === "present") {
    const lines = rsBlocks.text.trim().split("\n").filter(Boolean);
    const blocks = lines
      .map((line) => {
        try {
          return JSON.parse(line) as unknown;
        } catch {
          return null;
        }
      })
      .filter((value): value is Record<string, unknown> => typeof value === "object" && value !== null);
    const realBlocks = blocks.filter(
      (block) =>
        typeof block.endPhase === "number" &&
        typeof block.startPhase === "number" &&
        block.endPhase - block.startPhase > 1,
    );
    check(
      "RS blocks",
      realBlocks.length > 0,
      realBlocks.length > 0
        ? `${realBlocks.length} block(s) with real phase ranges (fix confirmed)`
        : `${blocks.length} total blocks but all show phases 1-1 (buffer fix pending next tick)`,
    );
  } else if (rsBlocks.kind === "unreadable") {
    check("RS blocks", false, `data/rs-blocks.jsonl is unreadable: ${rsBlocks.detail}`);
  } else {
    check("RS blocks", false, "data/rs-blocks.jsonl does not exist");
  }

  // 3. Vault status
  const vaultPath = join(repoRoot, "data", "vault-state.json");
  const vaultText = readText(vaultPath);
  const vault = vaultText.kind === "present" ? parseVault(vaultText.text) : null;
  if (vault?.kind === "parsed") {
    const liveVaults = vault.value.vaults.filter((value) => value.status === "live").length;
    check(
      "Vault status",
      liveVaults >= 3,
      `${liveVaults}/5 vaults live (action-recognition fix ${liveVaults >= 3 ? "confirmed" : "pending"})`,
    );
  } else if (vault?.kind === "invalid") {
    check("Vault status", false, `data/vault-state.json is invalid: ${vault.detail}`);
  } else if (vaultText.kind === "unreadable") {
    check("Vault status", false, `data/vault-state.json is unreadable: ${vaultText.detail}`);
  } else {
    check("Vault status", false, "data/vault-state.json does not exist");
  }

  // 4. Connectivity capped
  if (vault?.kind === "parsed") {
    const connectivity = vault.value.connectivity
      .map((value) => value.connectivity)
      .filter((value): value is number => typeof value === "number");
    const allCapped = connectivity.every((value) => value <= 1.0);
    check(
      "Connectivity",
      allCapped && connectivity.length > 0,
      connectivity.length > 0 ? `all agents ≤100% (max: ${Math.max(...connectivity) * 100}%)` : "no connectivity data",
    );
  } else if (vault?.kind === "invalid") {
    check("Connectivity", false, `invalid vault-state: ${vault.detail}`);
  } else if (vaultText.kind === "unreadable") {
    check("Connectivity", false, `unreadable vault-state: ${vaultText.detail}`);
  } else {
    check("Connectivity", false, "no vault-state");
  }

  return issues;
}

if (import.meta.main) {
  const issueCount = verifySessionFixes(process.cwd());
  console.log(
    `\n${issueCount === 0 ? "All fixes confirmed ✓" : `${issueCount} item(s) still pending — run again after a few ticks`}`,
  );
  process.exit(issueCount > 0 ? 1 : 0);
}
