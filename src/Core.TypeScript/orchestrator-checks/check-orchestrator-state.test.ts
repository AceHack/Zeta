// check-orchestrator-state.test.ts -- unit tests for the orchestrator state check.
//
// Per Otto-272 DST: deterministic; the exported functions take explicit env so
// we don't mock process.env or spawnSync globally.

import { describe, expect, test } from "bun:test";
import {
  checkOrchestratorState,
  parseWorktreeList,
} from "./check-orchestrator-state";

describe("parseWorktreeList", () => {
  test("parses a single non-bare worktree block", () => {
    const raw = `worktree /repo\nHEAD abc123\nbranch refs/heads/main\n\n`;
    const entries = parseWorktreeList(raw);
    expect(entries).toHaveLength(1);
    const e0 = entries[0]!;
    expect(e0.path).toBe("/repo");
    expect(e0.head).toBe("abc123");
    expect(e0.branch).toBe("main");
    expect(e0.bare).toBe(false);
  });

  test("strips refs/heads/ prefix from branch field", () => {
    const raw = `worktree /repo\nHEAD abc\nbranch refs/heads/feat/my-task\n\n`;
    const entry = parseWorktreeList(raw)[0]!;
    expect(entry.branch).toBe("feat/my-task");
  });

  test("handles detached HEAD (no branch line)", () => {
    const raw = `worktree /repo\nHEAD deadbeef\n\n`;
    const entry = parseWorktreeList(raw)[0]!;
    expect(entry.branch).toBe("(detached)");
  });

  test("handles bare worktree marker", () => {
    const raw = `worktree /bare.git\nHEAD 0000000\nbranch refs/heads/main\nbare\n\n`;
    const entry = parseWorktreeList(raw)[0]!;
    expect(entry.bare).toBe(true);
  });

  test("parses multiple worktree blocks", () => {
    const raw = [
      `worktree /repo\nHEAD aaa\nbranch refs/heads/main`,
      `worktree /repo/.git/worktrees/wt1\nHEAD bbb\nbranch refs/heads/feat/one`,
      `worktree /repo/.git/worktrees/wt2\nHEAD ccc\nbranch refs/heads/feat/two`,
      "",
    ].join("\n\n");
    const entries = parseWorktreeList(raw);
    expect(entries).toHaveLength(3);
    expect(entries[1]!.branch).toBe("feat/one");
    expect(entries[2]!.branch).toBe("feat/two");
  });
});

describe("checkOrchestratorState", () => {
  test("no expectation set -> branchMatch=true regardless of current branch", () => {
    const state = checkOrchestratorState({});
    expect(state.branchMatch).toBe(true);
    expect(state.expectedBranch).toBe("");
    expect(typeof state.currentBranch).toBe("string");
    expect(Array.isArray(state.dirtyFiles)).toBe(true);
    expect(Array.isArray(state.worktrees)).toBe(true);
    expect(state.driftedWorktrees).toHaveLength(0);
  });

  test("expectation set + matches current -> branchMatch=true", () => {
    const baseline = checkOrchestratorState({});
    const state = checkOrchestratorState({
      ZETA_EXPECTED_BRANCH: baseline.currentBranch,
    });
    expect(state.branchMatch).toBe(true);
  });

  test("expectation set + does NOT match current -> branchMatch=false", () => {
    const state = checkOrchestratorState({
      ZETA_EXPECTED_BRANCH: "definitely-not-the-current-branch-xyz",
    });
    expect(state.branchMatch).toBe(false);
  });
});
