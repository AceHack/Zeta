#!/usr/bin/env bun
import { describe, it, expect } from "bun:test";
import type { CascadeFinding } from "./missed-substrate-detector";
import {
  buildRecoveryBranchName,
  buildRecoveryPRBody,
  openRecoveryPR,
  type RecoveryAdapters,
} from "./missed-substrate-recovery";

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function makeFinding(overrides: Partial<CascadeFinding> = {}): CascadeFinding {
  return {
    prNumber: 1234,
    branchName: "feat/some-feature",
    missingCommits: ["aaaa111", "bbbb222"],
    urgency: "medium",
    ...overrides,
  };
}

type AdapterCallLog = {
  checkRecoveryPRExists: string[];
  gitCreateBranch: Array<{ branch: string; base: string }>;
  gitCherryPick: string[];
  gitPush: string[];
  ghPrCreate: Array<{ title: string; body: string; head: string }>;
};

function newCallLog(): AdapterCallLog {
  return {
    checkRecoveryPRExists: [],
    gitCreateBranch: [],
    gitCherryPick: [],
    gitPush: [],
    ghPrCreate: [],
  };
}

type AdapterStubOverrides = Partial<{
  checkRecoveryPRExists: (branchName: string) => boolean;
  gitCreateBranch: (branch: string, base: string) => boolean;
  gitCherryPick: (sha: string) => "ok" | "conflict" | "error";
  gitPush: (branch: string) => boolean;
  ghPrCreate: (title: string, body: string, head: string) => string | null;
}>;

function stubAdapters(
  log: AdapterCallLog,
  overrides: AdapterStubOverrides = {},
): RecoveryAdapters {
  return {
    checkRecoveryPRExists: (branchName) => {
      log.checkRecoveryPRExists.push(branchName);
      return overrides.checkRecoveryPRExists?.(branchName) ?? false;
    },
    gitCreateBranch: (branch, base) => {
      log.gitCreateBranch.push({ branch, base });
      return overrides.gitCreateBranch?.(branch, base) ?? true;
    },
    gitCherryPick: (sha) => {
      log.gitCherryPick.push(sha);
      return overrides.gitCherryPick?.(sha) ?? "ok";
    },
    gitPush: (branch) => {
      log.gitPush.push(branch);
      return overrides.gitPush?.(branch) ?? true;
    },
    ghPrCreate: (title, body, head) => {
      log.ghPrCreate.push({ title, body, head });
      // NOTE: don't use `??` here — when an override returns `null` (the
      // legitimate "PR-create failed" signal), `??` would collapse to the
      // default URL and the error-branch test would never trigger.
      if (overrides.ghPrCreate) return overrides.ghPrCreate(title, body, head);
      return "https://github.com/example/test/pull/9999";
    },
  };
}

// ─────────────────────────────────────────────────────────────────────
// buildRecoveryBranchName
// ─────────────────────────────────────────────────────────────────────

describe("buildRecoveryBranchName", () => {
  it("produces deterministic output from prNumber", () => {
    expect(buildRecoveryBranchName(3500)).toBe("recovery/3500");
  });

  it("is stable across two invocations (idempotency precondition)", () => {
    // The whole point of the post-cycle-2 fix: same prNumber must yield
    // the same branch name regardless of when openRecoveryPR is called,
    // so checkRecoveryPRExists(recoveryBranch) actually catches duplicates.
    expect(buildRecoveryBranchName(42)).toBe(buildRecoveryBranchName(42));
  });

  it("encodes only safe characters (digits + 'recovery/' prefix)", () => {
    const name = buildRecoveryBranchName(42);
    // The full output is "recovery/<digits>" — lowercase letters + slash + digits.
    expect(name).toMatch(/^recovery\/\d+$/);
  });
});

// ─────────────────────────────────────────────────────────────────────
// buildRecoveryPRBody
// ─────────────────────────────────────────────────────────────────────

describe("buildRecoveryPRBody", () => {
  it("contains the original PR number, branch name, and all commit SHAs", () => {
    const body = buildRecoveryPRBody(makeFinding({
      prNumber: 9876,
      branchName: "feat/x",
      missingCommits: ["sha1", "sha2", "sha3"],
      urgency: "high",
    }));
    expect(body).toContain("**#9876**");
    expect(body).toContain("feat/x");
    expect(body).toContain("- sha1");
    expect(body).toContain("- sha2");
    expect(body).toContain("- sha3");
    expect(body).toContain("**high**");
    expect(body).toContain("Auto-generated");
  });

  it("handles single-commit findings", () => {
    const body = buildRecoveryPRBody(makeFinding({ missingCommits: ["just-one"] }));
    expect(body).toContain("- just-one");
  });

  it("sanitises backticks in branchName to avoid breaking inline-code spans", () => {
    // Defense per PR #3433 Copilot finding: a branchName containing a
    // backtick would close the inline-code span early and leak content.
    const body = buildRecoveryPRBody(makeFinding({ branchName: "feat/sneaky`backtick`name" }));
    // The original branch name must NOT appear (it has backticks); the
    // sanitised form ("feat/sneaky_backtick_name") must appear.
    expect(body).not.toContain("feat/sneaky`backtick`name");
    expect(body).toContain("feat/sneaky_backtick_name");
  });
});

// ─────────────────────────────────────────────────────────────────────
// openRecoveryPR
// ─────────────────────────────────────────────────────────────────────

describe("openRecoveryPR — opened", () => {
  it("happy path: no existing PR, cherry-picks succeed, push+PR succeed", () => {
    const log = newCallLog();
    const adapters = stubAdapters(log);
    const r = openRecoveryPR(makeFinding(), false, adapters);

    expect(r.status).toBe("opened");
    if (r.status !== "opened") throw new Error("narrowing");
    expect(r.prUrl).toBe("https://github.com/example/test/pull/9999");
    expect(r.cherryPickedCount).toBe(2);

    expect(log.checkRecoveryPRExists.length).toBe(1);
    expect(log.gitCreateBranch.length).toBe(1);
    expect(log.gitCreateBranch[0]!.base).toBe("origin/main");
    expect(log.gitCherryPick).toEqual(["aaaa111", "bbbb222"]);
    expect(log.gitPush.length).toBe(1);
    expect(log.ghPrCreate.length).toBe(1);
    expect(log.ghPrCreate[0]!.head).toBe("recovery/1234");
  });

  it("retry path: gitCreateBranch returns true even when stale branch exists (contract test)", () => {
    // Codex P1 catch on PR #3438: a partial-failure recovery attempt leaves
    // a stale local branch. The deterministic branch name means a retry
    // hits the same name. The gitCreateBranch adapter contract REQUIRES
    // handling this — return true on either delete-and-recreate or
    // reset-to-base. Verify openRecoveryPR doesn't impose any other
    // assumption: if the adapter says true, we proceed normally; the core
    // function makes no decisions about stale-branch handling itself.
    const log = newCallLog();
    let createCallCount = 0;
    // Simulate: first call detects stale branch internally, recovers,
    // returns true. We just verify openRecoveryPR proceeds.
    const adapters = stubAdapters(log, {
      gitCreateBranch: (branch, base) => {
        createCallCount++;
        // Real adapter would do: `git branch -D <branch>; git checkout -b <branch> <base>`
        // and return true on the recreated branch.
        return branch === "recovery/1234" && base === "origin/main";
      },
    });
    const r = openRecoveryPR(makeFinding(), false, adapters);
    expect(r.status).toBe("opened");
    expect(createCallCount).toBe(1); // called exactly once; no retry-loop in core
    // Cherry-pick + push + PR-create still happen on the recovered branch.
    expect(log.gitCherryPick.length).toBe(2);
    expect(log.gitPush.length).toBe(1);
    expect(log.ghPrCreate.length).toBe(1);
  });

  it("PR title encodes prNumber + missing commits count", () => {
    const log = newCallLog();
    const r = openRecoveryPR(
      makeFinding({ prNumber: 7777, missingCommits: ["a", "b", "c"] }),
      false,
      stubAdapters(log),
    );
    expect(r.status).toBe("opened");
    expect(log.ghPrCreate[0]!.title).toContain("#7777");
    expect(log.ghPrCreate[0]!.title).toContain("3 missed commits");
  });
});

describe("openRecoveryPR — already-exists", () => {
  it("queries checkRecoveryPRExists with the deterministic branch name (regression: PR #3433 P0)", () => {
    // Regression test for PR #3433 Copilot P0: the earlier
    // `recovery/<prNumber>-<timestamp>` form defeated this gate because
    // each invocation generated a fresh branch name. The fix is the
    // deterministic `recovery/<prNumber>` form. Verify the adapter is
    // called with EXACTLY that name so future regressions are caught.
    const log = newCallLog();
    openRecoveryPR(makeFinding({ prNumber: 5555 }), false, stubAdapters(log));
    expect(log.checkRecoveryPRExists).toEqual(["recovery/5555"]);
  });

  it("returns already-exists when checkRecoveryPRExists returns true; no mutations", () => {
    const log = newCallLog();
    const adapters = stubAdapters(log, { checkRecoveryPRExists: () => true });
    const r = openRecoveryPR(makeFinding(), false, adapters);

    expect(r.status).toBe("already-exists");
    if (r.status !== "already-exists") throw new Error("narrowing");
    expect(r.reason).toContain("already open");

    // No mutations should have happened.
    expect(log.gitCreateBranch.length).toBe(0);
    expect(log.gitCherryPick.length).toBe(0);
    expect(log.gitPush.length).toBe(0);
    expect(log.ghPrCreate.length).toBe(0);
  });
});

describe("openRecoveryPR — dry-run", () => {
  it("does not call gitCreateBranch and returns prUrl=\"dry-run\"", () => {
    const log = newCallLog();
    const r = openRecoveryPR(makeFinding(), true, stubAdapters(log));

    expect(r.status).toBe("opened");
    if (r.status !== "opened") throw new Error("narrowing");
    expect(r.prUrl).toBe("dry-run");
    expect(r.cherryPickedCount).toBe(0);

    // Dry-run still checks for existing PR (idempotency) but performs no mutations.
    expect(log.checkRecoveryPRExists.length).toBe(1);
    expect(log.gitCreateBranch.length).toBe(0);
    expect(log.gitCherryPick.length).toBe(0);
    expect(log.gitPush.length).toBe(0);
    expect(log.ghPrCreate.length).toBe(0);
  });
});

describe("openRecoveryPR — cherry-pick-conflict", () => {
  it("returns cherry-pick-conflict on the conflicting sha; push NOT called", () => {
    const log = newCallLog();
    // Conflict on the 2nd commit specifically.
    const adapters = stubAdapters(log, {
      gitCherryPick: (sha) => (sha === "bbbb222" ? "conflict" : "ok"),
    });
    const r = openRecoveryPR(makeFinding(), false, adapters);

    expect(r.status).toBe("cherry-pick-conflict");
    if (r.status !== "cherry-pick-conflict") throw new Error("narrowing");
    expect(r.sha).toBe("bbbb222");
    expect(r.attemptedCount).toBe(2);

    // Branch was created; push was NOT called because cherry-pick aborted.
    expect(log.gitCreateBranch.length).toBe(1);
    expect(log.gitCherryPick).toEqual(["aaaa111", "bbbb222"]);
    expect(log.gitPush.length).toBe(0);
    expect(log.ghPrCreate.length).toBe(0);
  });
});

describe("openRecoveryPR — error branches", () => {
  it("returns error when gitCreateBranch fails", () => {
    const log = newCallLog();
    const r = openRecoveryPR(makeFinding(), false, stubAdapters(log, { gitCreateBranch: () => false }));
    expect(r.status).toBe("error");
    if (r.status !== "error") throw new Error("narrowing");
    expect(r.reason).toContain("git checkout -b");
    expect(log.gitCherryPick.length).toBe(0);
  });

  it("returns error when gitCherryPick returns \"error\"", () => {
    const log = newCallLog();
    const r = openRecoveryPR(
      makeFinding(),
      false,
      stubAdapters(log, { gitCherryPick: () => "error" }),
    );
    expect(r.status).toBe("error");
    if (r.status !== "error") throw new Error("narrowing");
    expect(r.reason).toContain("git cherry-pick");
    expect(log.gitPush.length).toBe(0);
  });

  it("returns error when gitPush fails", () => {
    const log = newCallLog();
    const r = openRecoveryPR(makeFinding(), false, stubAdapters(log, { gitPush: () => false }));
    expect(r.status).toBe("error");
    if (r.status !== "error") throw new Error("narrowing");
    expect(r.reason).toContain("git push");
    expect(log.ghPrCreate.length).toBe(0);
  });

  it("returns error when ghPrCreate returns null", () => {
    const log = newCallLog();
    const r = openRecoveryPR(makeFinding(), false, stubAdapters(log, { ghPrCreate: () => null }));
    expect(r.status).toBe("error");
    if (r.status !== "error") throw new Error("narrowing");
    expect(r.reason).toContain("gh pr create");
  });
});
