#!/usr/bin/env bun
// check-orchestrator-state.ts -- diagnostic: emits structured JSON showing
// current branch, git status, and worktree list for orchestrator start-of-tick
// health checks.
//
// Per docs/backlog/P1/B-0191-orchestrator-branch-verify-mechanization-design-aaron-2026-05-04.md
// (AC5 worktree status sub-row). Rule 0: TS not bash.
//
// Exit codes:
//   0 -- state is clean (branch matches expected if set; no drifted worktrees)
//   1 -- branch mismatch or drifted worktrees detected
//
// Usage:
//   bun tools/orchestrator-checks/check-orchestrator-state.ts
//   ZETA_EXPECTED_BRANCH=feat/my-branch bun tools/orchestrator-checks/check-orchestrator-state.ts

import { spawnSync } from "node:child_process";

export interface WorktreeEntry {
  readonly path: string;
  readonly head: string;
  readonly branch: string;
  readonly bare: boolean;
}

export interface OrchestratorState {
  readonly currentBranch: string;
  readonly expectedBranch: string;
  readonly branchMatch: boolean;
  readonly dirtyFiles: string[];
  readonly worktrees: WorktreeEntry[];
  /** Worktrees (other than the caller's own) that are on the same branch as
   *  expectedBranch. Non-empty signals the CWD-bleed-over hazard. */
  readonly driftedWorktrees: WorktreeEntry[];
}

function run(cmd: string, args: string[]): string {
  const r = spawnSync(cmd, args, { encoding: "utf8" });
  if (r.status !== 0) {
    throw new Error(`${cmd} ${args.join(" ")} failed: ${r.stderr}`);
  }
  return r.stdout;
}

export function parseWorktreeList(raw: string): WorktreeEntry[] {
  const entries: WorktreeEntry[] = [];
  // --porcelain format: key-value lines, blocks separated by blank lines.
  for (const block of raw.split(/\n\n+/)) {
    const lines = block.trim().split("\n");
    if (!lines[0]) continue;
    const get = (prefix: string) =>
      lines.find((l) => l.startsWith(prefix))?.slice(prefix.length) ?? "";
    const branchRef = get("branch ");
    entries.push({
      path: get("worktree "),
      head: get("HEAD "),
      // strip refs/heads/ prefix; keep "(detached)" or bare as-is.
      branch: branchRef.startsWith("refs/heads/")
        ? branchRef.slice("refs/heads/".length)
        : branchRef || "(detached)",
      bare: lines.includes("bare"),
    });
  }
  return entries;
}

export function checkOrchestratorState(
  env: NodeJS.ProcessEnv = process.env,
): OrchestratorState {
  const currentBranch = run("git", ["branch", "--show-current"]).trim();
  const expectedBranch = env.ZETA_EXPECTED_BRANCH ?? "";
  const dirtyFiles = run("git", ["status", "--short"])
    .split("\n")
    .filter(Boolean);
  const worktrees = parseWorktreeList(
    run("git", ["worktree", "list", "--porcelain"]),
  );
  // Identify caller's own worktree by matching CWD (first entry is always main worktree per git docs).
  // Exclude it when scanning for other worktrees on expectedBranch (CWD-bleed-over hazard).
  const cwd = process.cwd();
  // Use exact-boundary comparison: bare startsWith("/Zeta") would wrongly match "/Zeta-feature".
  const ownIdx = worktrees.findIndex(
    (w) => cwd === w.path || cwd.startsWith(w.path + "/"),
  );
  const driftedWorktrees =
    expectedBranch && worktrees.length > 1
      ? worktrees
          .filter((_, i) => i !== ownIdx)
          .filter((w) => w.branch === expectedBranch)
      : [];
  return {
    currentBranch,
    expectedBranch,
    branchMatch: !expectedBranch || currentBranch === expectedBranch,
    dirtyFiles,
    worktrees,
    driftedWorktrees,
  };
}

function main(): number {
  const state = checkOrchestratorState();
  console.log(JSON.stringify(state, null, 2));

  if (!state.branchMatch) {
    console.error(
      `\nWARNING: current branch '${state.currentBranch}' != expected '${state.expectedBranch}'`,
    );
    return 1;
  }
  if (state.driftedWorktrees.length > 0) {
    console.error(
      `\nWARNING: ${state.driftedWorktrees.length} other worktree(s) are on branch '${state.expectedBranch}' -- CWD-bleed-over risk.`,
    );
    for (const w of state.driftedWorktrees) {
      console.error(`  ${w.path}`);
    }
    return 1;
  }
  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
