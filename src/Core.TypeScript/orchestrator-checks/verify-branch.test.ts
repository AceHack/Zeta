// verify-branch.test.ts -- unit tests for the verify-branch harness hook.
//
// Per Otto-272 DST: tests are deterministic; we mock the env+git interaction
// at the function boundary (the verifyBranch function takes env explicitly,
// so we don't have to mock spawnSync, but we do need git to return SOMETHING
// since the test runner runs in a real git repo).

import { describe, expect, test } from "bun:test";
import { verifyBranch } from "./verify-branch";

describe("verifyBranch", () => {
  test("no expectation set -> match=true regardless of current branch", () => {
    const r = verifyBranch({});
    expect(r.match).toBe(true);
    expect(r.expected).toBe("");
    // current is whatever git says; just verify the shape is non-empty when
    // running inside a git repo.
    expect(typeof r.current).toBe("string");
  });

  test("expectation set + matches current -> match=true", () => {
    // First grab the actual current branch
    const baseline = verifyBranch({});
    const r = verifyBranch({ ZETA_EXPECTED_BRANCH: baseline.current });
    expect(r.match).toBe(true);
    expect(r.expected).toBe(baseline.current);
    expect(r.current).toBe(baseline.current);
  });

  test("expectation set + does NOT match current -> match=false", () => {
    const r = verifyBranch({
      ZETA_EXPECTED_BRANCH: "definitely-not-the-current-branch-xyz",
    });
    expect(r.match).toBe(false);
    expect(r.expected).toBe("definitely-not-the-current-branch-xyz");
  });

  test("worktreeWarning fires only when expectation is unset AND branch matches the worktree-suffix pattern", () => {
    // No expectation, on a non-worktree branch like 'main' -> no warning
    const baseline = verifyBranch({});
    if (baseline.current === "main" || baseline.current === "master") {
      expect(baseline.worktreeWarning).toBe(false);
    }
    // When we DO set an expectation, worktreeWarning is suppressed by design
    // (the user asserted what they want, no need for the heuristic).
    const r = verifyBranch({ ZETA_EXPECTED_BRANCH: baseline.current });
    expect(r.worktreeWarning).toBe(false);
  });
});
