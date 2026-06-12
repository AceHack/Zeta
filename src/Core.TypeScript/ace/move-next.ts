#!/usr/bin/env bun
/**
 * move-next.ts — Universal action grammar for the Ace package manager.
 *
 * Reads the current state of the world (installed packages, manifests,
 * cluster cells, git state) and returns a list of possible next actions.
 * Both humans and AI agents call this in a loop:
 *
 *   get options → pick one → execute → repeat
 *
 * Per Aaron-Ani 2026-05-23 architecture conversation:
 * "it's like a universal action grammar that looks at the current state
 *  of the world and gives the AI options"
 *
 * Usage:
 *   bun src/Core.TypeScript/ace/move-next.ts [--json] [--limit N]
 *
 * Output: a ranked list of MoveOption discriminated union values.
 */

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve as resolvePath } from "node:path";
import { spawnSync } from "node:child_process";
import { listInstalled, defaultStorePath } from "./store";

// --- Discriminated union: all possible moves ---

export type MoveOption =
  | { readonly type: "install-package"; readonly name: string; readonly version: string; readonly source: string; readonly reason: string }
  | { readonly type: "update-package"; readonly name: string; readonly currentVersion: string; readonly availableVersion: string; readonly reason: string }
  | { readonly type: "provision-cell"; readonly cellId: string; readonly agent: string; readonly harness: string; readonly reason: string }
  | { readonly type: "file-backlog-row"; readonly title: string; readonly priority: string; readonly reason: string }
  | { readonly type: "open-pr"; readonly branch: string; readonly title: string; readonly reason: string }
  | { readonly type: "merge-pr"; readonly prNumber: number; readonly reason: string }
  | { readonly type: "run-verifier"; readonly target: string; readonly verifier: string; readonly reason: string }
  | { readonly type: "refresh-state"; readonly reason: string }
  | { readonly type: "idle"; readonly reason: string };

// --- State readers ---

function repoRoot(): string {
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8", timeout: 5000 });
  return result.stdout?.trim() || process.cwd();
}

function readManifest(root: string): { cellId: string; harness: string; agent: string; interval: string; forward: string }[] {
  const hostname = spawnSync("hostname", ["-s"], { encoding: "utf8", timeout: 2000 }).stdout?.trim() || "unknown";
  const manifestDir = join(root, "tools/setup/manifests");
  const hostSpecific = join(manifestDir, `cluster-cells.${hostname}`);
  const defaultManifest = join(manifestDir, "cluster-cells");
  const path = existsSync(hostSpecific) ? hostSpecific : defaultManifest;
  if (!existsSync(path)) return [];

  const lines = readFileSync(path, "utf8").split("\n");
  const cells: { cellId: string; harness: string; agent: string; interval: string; forward: string }[] = [];
  for (const line of lines) {
    if (line.trim().startsWith("#") || line.trim().length === 0) continue;
    const cellId = line.split(/\s+/)[0] || "";
    const harness = line.match(/harness=(\S+)/)?.[1] || "auto";
    const agent = line.match(/agent=(\S+)/)?.[1] || "";
    const interval = line.match(/interval=(\S+)/)?.[1] || "60";
    const forward = line.match(/forward=(\S+)/)?.[1] || "1";
    if (cellId && agent) cells.push({ cellId, harness, agent, interval, forward });
  }
  return cells;
}

function getRunningCells(): string[] {
  const result = spawnSync("launchctl", ["list"], { encoding: "utf8", timeout: 5000 });
  if (result.status !== 0) return [];
  return result.stdout
    .split("\n")
    .filter(l => l.includes("com.lucent.zeta."))
    .map(l => l.split("\t").pop()?.replace("com.lucent.zeta.", "") || "")
    .filter(Boolean);
}

function getOpenPRs(): { number: number; title: string; mergeable: string }[] {
  const result = spawnSync("gh", [
    "pr", "list", "--state", "open", "--limit", "10",
    "--json", "number,title,mergeStateStatus",
  ], { encoding: "utf8", timeout: 30000 });
  if (result.status !== 0) return [];
  try { return JSON.parse(result.stdout); } catch { return []; }
}

// --- Move generators ---

function* generateCellMoves(root: string): Generator<MoveOption> {
  const manifest = readManifest(root);
  const running = getRunningCells();
  for (const cell of manifest) {
    if (!running.includes(cell.agent)) {
      yield {
        type: "provision-cell",
        cellId: cell.cellId,
        agent: cell.agent,
        harness: cell.harness,
        reason: `Cell ${cell.cellId} (${cell.agent}) declared in manifest but not running`,
      };
    }
  }
}

function* generatePRMoves(): Generator<MoveOption> {
  const prs = getOpenPRs();
  for (const pr of prs) {
    if (pr.mergeable === "CLEAN") {
      yield {
        type: "merge-pr",
        prNumber: pr.number,
        reason: `PR #${pr.number} is CLEAN and ready to merge: ${pr.title}`,
      };
    }
  }
}

function* generatePackageMoves(root: string): Generator<MoveOption> {
  const storePath = defaultStorePath();
  if (!existsSync(storePath)) {
    yield {
      type: "refresh-state",
      reason: "Ace store directory does not exist — run ace install first",
    };
    return;
  }
  // Check for outdated packages by comparing installed vs registry
  const registryPath = join(root, "src/Core.TypeScript/ace/registry.json");
  if (!existsSync(registryPath)) return;
  const registry = JSON.parse(readFileSync(registryPath, "utf8"));
  const installed = listInstalled(storePath);
  for (const [name, versions] of Object.entries(registry as Record<string, { version: string; url: string }[]>)) {
    const latest = (versions as { version: string }[]).sort((a, b) => b.version.localeCompare(a.version))[0];
    const inst = installed.find((p: { name: string }) => p.name === name);
    if (!inst && latest) {
      yield {
        type: "install-package",
        name,
        version: latest.version,
        source: "registry",
        reason: `Package ${name}@${latest.version} available but not installed`,
      };
    }
  }
}

// --- Main ---

export function moveNext(options?: { limit?: number }): MoveOption[] {
  const root = repoRoot();
  const limit = options?.limit ?? 10;
  const moves: MoveOption[] = [];

  // Priority order: cells → PRs → packages → idle
  for (const move of generateCellMoves(root)) {
    moves.push(move);
    if (moves.length >= limit) return moves;
  }
  for (const move of generatePRMoves()) {
    moves.push(move);
    if (moves.length >= limit) return moves;
  }
  for (const move of generatePackageMoves(root)) {
    moves.push(move);
    if (moves.length >= limit) return moves;
  }

  if (moves.length === 0) {
    moves.push({ type: "idle", reason: "All cells running, no CLEAN PRs, no package updates available" });
  }

  return moves;
}

// --- CLI ---

if (import.meta.main) {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const limitIdx = args.indexOf("--limit");
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : 10;

  const moves = moveNext({ limit });

  if (json) {
    process.stdout.write(JSON.stringify(moves, null, 2) + "\n");
  } else {
    console.log(`\n=== move-next: ${moves.length} option(s) ===\n`);
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i]!;
      console.log(`  ${i + 1}. [${m.type}] ${m.reason}`);
    }
    console.log("");
  }
}
