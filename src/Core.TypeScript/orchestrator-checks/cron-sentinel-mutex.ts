#!/usr/bin/env bun
// cron-sentinel-mutex.ts -- detect concurrent Otto-CLI claude-code sessions
// so the <<autonomous-loop>> tick can defer when a peer is mid-flight.
//
// Per docs/backlog/P3/B-0530-cron-sentinel-mutex-prevent-otto-cli-self-contention-2026-05-15.md
// + the worktree-prune-race root-cause analysis in PR #3370 (Pattern 8 of
// docs/backlog/P3/B-0519-multi-otto-branch-state-contamination-rca-2026-05-14.md).
//
// Composes with the sibling check at tools/orchestrator-checks/verify-branch.ts
// which uses the same spawnSync pattern (no shell, args as array).

import { spawnSync } from "node:child_process";

export interface MutexResult {
  readonly myPid: number;
  readonly peerPids: readonly number[];
  readonly peerLines: readonly string[];
  readonly peerDetected: boolean;
  /** Set when pgrep itself failed (spawn error or exit status > 1). Mutex state is unknown. */
  readonly pgrepError?: string;
}

const PROCESS_NAME_PATTERN = "claude-code";

/**
 * Find concurrent claude-code processes other than this process.
 * Uses pgrep -afl (BSD-compatible). The pgrep exit code is non-zero
 * when zero processes match, which is a legitimate result and not an
 * error. The function returns a structured result; the caller (the
 * autonomous-loop tick body) decides whether to defer.
 */
export function checkPeerSessions(
  myPid: number = process.pid,
  spawnFn: typeof spawnSync = spawnSync,
): MutexResult {
  // spawnSync with args array — no shell interpolation, no injection risk.
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- pgrep is a known system binary; args array prevents shell injection
  const result = spawnFn("pgrep", ["-afl", PROCESS_NAME_PATTERN], {
    encoding: "utf8",
  });

  // Distinguish "no match" (pgrep exit status 1) from real failures.
  // result.error is set when the child process cannot be spawned at all (e.g., binary missing).
  // status > 1 indicates a pgrep error (bad flag, permission denied, etc.).
  if (result.error) {
    return { myPid, peerPids: [], peerLines: [], peerDetected: false, pgrepError: result.error.message };
  }
  const exitStatus = result.status ?? 0;
  if (exitStatus > 1) {
    return { myPid, peerPids: [], peerLines: [], peerDetected: false, pgrepError: `pgrep exited with status ${exitStatus}` };
  }

  const stdout = typeof result.stdout === "string" ? result.stdout : "";
  const lines = stdout.split("\n").filter((line) => line.trim().length > 0);

  const peerLines: string[] = [];
  const peerPids: number[] = [];

  for (const line of lines) {
    const match = /^(\d+)\s+(.*)$/.exec(line);
    if (!match) continue;
    const pidStr = match[1];
    if (!pidStr) continue;
    const pid = Number.parseInt(pidStr, 10);
    if (!Number.isFinite(pid)) continue;
    if (pid === myPid) continue;
    // Skip ancestors / disclaimer-helper / finder-service matches:
    // require the claude-code stdio-mode flags to mark a real peer.
    const cmdline = match[2] ?? "";
    if (!cmdline.includes("--output-format") && !cmdline.includes("--input-format")) {
      continue;
    }
    peerPids.push(pid);
    peerLines.push(line);
  }

  return {
    myPid,
    peerPids,
    peerLines,
    peerDetected: peerPids.length > 0,
  };
}

export function formatResult(r: MutexResult): string {
  if (r.pgrepError) {
    return `cron-sentinel-mutex: pgrep failed — ${r.pgrepError} (self PID ${r.myPid}); mutex state unknown`;
  }
  if (!r.peerDetected) {
    return `cron-sentinel-mutex: no peer claude-code sessions detected (self PID ${r.myPid})`;
  }
  const peerSummary = r.peerLines.length > 0 ? "\n  " + r.peerLines.join("\n  ") : "";
  return (
    `cron-sentinel-mutex: ${r.peerPids.length} peer claude-code session(s) detected (self PID ${r.myPid})` +
    peerSummary
  );
}

/** Exit code for "pgrep failed, mutex state unknown" — distinct from
 * the 0..250 peer-count range so shell callers can branch on it. */
export const PGREP_ERROR_EXIT = 251;

export function mainResult(r: MutexResult): number {
  // Diagnostic exit codes:
  //   0 = no peers (safe to proceed)
  //   1..250 = 1 + peer count (caller should defer)
  //   251 = pgrep error / unknown state (caller should defer)
  // Most callers should use the JSON output via --json instead.
  if (r.pgrepError) {
    return PGREP_ERROR_EXIT;
  }
  if (r.peerDetected) {
    return Math.min(1 + r.peerPids.length, 250);
  }
  return 0;
}

function main(): number {
  const r = checkPeerSessions();
  console.error(formatResult(r));
  return mainResult(r);
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  if (args.includes("--json")) {
    const r = checkPeerSessions();
    console.log(JSON.stringify(r, null, 2));
    // Use the same exit-code semantics as the non-JSON path so shell
    // callers can branch on both stdout (structured) and $? (status).
    // Without this, `set -e` scripts using --json would treat
    // peerDetected=true and pgrepError as success and bypass the
    // mutex protection.
    process.exit(mainResult(r));
  }
  process.exit(main());
}
