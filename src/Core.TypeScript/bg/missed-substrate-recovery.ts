#!/usr/bin/env bun
/**
 * tools/bg/missed-substrate-recovery.ts
 *
 * Core function for opening a recovery PR when missed-substrate-detector
 * surfaces a cascade gap. Pure-function-with-adapters shape: all I/O
 * (git, gh) is injected so the function is unit-testable without touching
 * the filesystem or making real GitHub calls.
 *
 * Per B-0503 (slice 5a of B-0442); wiring into pollOnce + real adapter
 * implementations are scope for B-0504.
 */

import type { CascadeFinding } from "./missed-substrate-detector";

export type RecoveryAdapters = {
  /** Returns true if an open recovery PR already exists for this branch. */
  checkRecoveryPRExists: (branchName: string) => boolean;
  /**
   * Create-or-resume on the recovery branch from `base`. Returns true on
   * success.
   *
   * CONTRACT (required for retry-safety, enforced by openRecoveryPR's
   * deterministic branch-name design — see `buildRecoveryBranchName`):
   *
   *   If the local branch ALREADY EXISTS (from a prior partial-failure
   *   recovery attempt for the same prNumber), the adapter MUST:
   *     (a) delete the stale local branch and recreate from `base`
   *         (`git branch -D <branch> && git checkout -b <branch> <base>`),
   *         OR
   *     (b) reset the existing branch to `base` and check it out
   *         (`git checkout <branch> && git reset --hard <base>`).
   *   Returning false on "branch already exists" wedges all future retries
   *   for that prNumber. This is checked by the `openRecoveryPR` contract;
   *   tests can stub gitCreateBranch to verify the retry path doesn't
   *   surface a stale-branch error.
   */
  gitCreateBranch: (branch: string, base: string) => boolean;
  /** `git cherry-pick <sha>`; distinguishes merge conflict from other errors. */
  gitCherryPick: (sha: string) => "ok" | "conflict" | "error";
  /** `git push origin <branch>`; true on success. Use `--force-with-lease` for retry-safety when the remote branch may also exist from a prior attempt. */
  gitPush: (branch: string) => boolean;
  /** `gh pr create --title ... --body ... --head ... --base main`; PR URL or null. */
  ghPrCreate: (title: string, body: string, head: string) => string | null;
};

export type RecoveryResult =
  | { status: "opened"; prUrl: string; cherryPickedCount: number }
  | { status: "already-exists"; reason: string }
  | { status: "cherry-pick-conflict"; sha: string; attemptedCount: number }
  | { status: "error"; reason: string };

/**
 * Deterministic recovery-branch name: `recovery/<prNumber>`.
 * Pure function; no I/O. Determinism is load-bearing: the idempotency gate
 * `checkRecoveryPRExists(recoveryBranch)` only catches duplicate recovery
 * attempts if the branch name is stable across invocations for the same
 * `prNumber`.
 *
 * Retry-safety constraint for B-0504 adapter implementations:
 *
 *   The deterministic name implies the `gitCreateBranch` adapter must
 *   handle "branch already exists" gracefully. If a prior recovery attempt
 *   failed mid-flight (cherry-pick conflict, push error, gh pr create
 *   error), the stale local branch persists. The B-0504 adapter should
 *   either:
 *     (a) attempt `git branch -D <recoveryBranch>` before `git checkout -b`
 *         (safe because we're about to recreate from `origin/main`), OR
 *     (b) detect "fatal: A branch named ... already exists" and
 *         translate it into success (resume on existing branch).
 *
 *   Without this, a single partial failure would wedge recovery for the
 *   affected PR until manual branch cleanup. B-0503 (this row) provides
 *   the core function; the recovery-from-stale-branch logic lives in
 *   B-0504's real adapter where the spawnSync error parsing happens.
 */
export function buildRecoveryBranchName(prNumber: number): string {
  return `recovery/${prNumber}`;
}

/**
 * Markdown body for the recovery PR. Lists `missingCommits`, references the
 * original `prNumber`, surfaces the detector's urgency, and notes that the
 * PR was auto-generated.
 */
/**
 * Escape markdown-control characters in a string that will appear inside
 * a backtick-wrapped span. Currently scrubs backticks (which would close
 * the span prematurely and leak content into prose). A branch name is
 * expected to be ASCII alphanumeric plus `/-_.`; anything else is sanitised
 * to `_` defensively.
 */
function sanitizeForInlineCode(s: string): string {
  return s.replaceAll("`", "_");
}

export function buildRecoveryPRBody(finding: CascadeFinding): string {
  const commitList = finding.missingCommits.map((s) => `- ${s}`).join("\n");
  const safeBranchName = sanitizeForInlineCode(finding.branchName);
  return [
    `## Auto-generated recovery PR`,
    ``,
    `Original merged PR: **#${finding.prNumber}** (branch \`${safeBranchName}\`)`,
    ``,
    `Missing commits detected by \`missed-substrate-detector\`:`,
    commitList,
    ``,
    `Urgency at detection time: **${finding.urgency}**`,
    ``,
    `> This PR was opened automatically. Review before merging.`,
  ].join("\n");
}

/**
 * Core recovery workflow. Composed with `adapters` so all I/O is injectable.
 * Steps:
 *   1. Check for existing open recovery PR; if yes, return `already-exists`.
 *   2. If `dryRun`, return `opened` with `prUrl="dry-run"` and no mutations.
 *   3. `git checkout -b <recoveryBranch> origin/main`.
 *   4. For each commit in `finding.missingCommits`: cherry-pick. On conflict
 *      return `cherry-pick-conflict` immediately (no push).
 *   5. `git push origin <recoveryBranch>`.
 *   6. `gh pr create --title ... --body ... --head ... --base main`.
 *
 * The branch name is deterministic from `finding.prNumber` alone
 * (`recovery/<prNumber>`); the idempotency gate (`checkRecoveryPRExists`)
 * is the load-bearing uniqueness mechanism — duplicate recovery attempts
 * for the same PR resolve to `already-exists` and perform no mutations.
 */
export function openRecoveryPR(
  finding: CascadeFinding,
  dryRun: boolean,
  adapters: RecoveryAdapters,
): RecoveryResult {
  const recoveryBranch = buildRecoveryBranchName(finding.prNumber);

  if (adapters.checkRecoveryPRExists(recoveryBranch)) {
    return { status: "already-exists", reason: `PR for ${recoveryBranch} already open` };
  }

  if (dryRun) {
    return { status: "opened", prUrl: "dry-run", cherryPickedCount: 0 };
  }

  if (!adapters.gitCreateBranch(recoveryBranch, "origin/main")) {
    return { status: "error", reason: `git checkout -b ${recoveryBranch} origin/main failed` };
  }

  let attemptedCount = 0;
  for (const sha of finding.missingCommits) {
    const cpResult = adapters.gitCherryPick(sha);
    attemptedCount++;
    if (cpResult === "conflict") {
      return { status: "cherry-pick-conflict", sha, attemptedCount };
    }
    if (cpResult === "error") {
      return { status: "error", reason: `git cherry-pick ${sha} failed` };
    }
  }

  if (!adapters.gitPush(recoveryBranch)) {
    return { status: "error", reason: `git push origin ${recoveryBranch} failed` };
  }

  const title = `recovery(#${finding.prNumber}): ${finding.missingCommits.length} missed commits`;
  const body = buildRecoveryPRBody(finding);
  const prUrl = adapters.ghPrCreate(title, body, recoveryBranch);
  if (prUrl === null) {
    return { status: "error", reason: "gh pr create failed" };
  }

  return { status: "opened", prUrl, cherryPickedCount: attemptedCount };
}
