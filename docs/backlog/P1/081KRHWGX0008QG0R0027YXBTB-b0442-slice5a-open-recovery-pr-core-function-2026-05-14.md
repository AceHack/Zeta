---
id: 081KRHWGX0008QG0R0027YXBTB
priority: P1
status: closed
title: "081KRFA460008QG0R00061SXRW slice 5a — openRecoveryPR core function + RecoveryAdapters + DST tests"
tier: factory-infrastructure
effort: S
created: 2026-05-14
last_updated: 2026-05-15
closed: 2026-05-15
parent: 081KRFA460008QG0R00061SXRW
depends_on: []
composes_with: [081KRFA460008QG0R00061SXRW, 081KRHWGX0008QG0R000PVB6FF]
tags: [background-service, bus, mechanization, drift-detection, recovery-pr, git]
type: feature
---

# 081KRFA460008QG0R00061SXRW slice 5a — `openRecoveryPR` core function

## Origin

081KRFA460008QG0R00061SXRW acceptance criterion (still open):

> Optionally auto-opens recovery PR with the missing commits (gated by
> configuration) (slice 5 — pending; subscriber-agent layer)

Slices 1–4 + 6 shipped. The only remaining gap is the auto-recovery path.
This row is the first atomic sub-slice: the pure function + adapter interface
for opening a recovery PR, independently testable before any wiring into
`pollOnce` (081KRHWGX0008QG0R000PVB6FF).

## What this row does NOT do

- Does NOT modify `pollOnce`, `DetectorConfig`, or `parseArgs` — that is 081KRHWGX0008QG0R000PVB6FF.
- Does NOT add `--auto-recover` / `--dry-run` CLI flags — that is 081KRHWGX0008QG0R000PVB6FF.
- Does NOT publish bus envelopes for the recovery action — the detector already
  publishes `missed-substrate-cascade`; recovery is a secondary action.

## Acceptance criteria

- [x] New file `tools/bg/missed-substrate-recovery.ts` exports: (landed on origin/main; design sketch below has been reconciled with as-shipped — `buildRecoveryBranchName` simplified to `(prNumber)` per PR #3458 docs)
  - `RecoveryAdapters` — interface with five adapters injected by callers:
    - `checkRecoveryPRExists(branchName: string) => boolean`
      — calls `gh pr list --head <branchName> --state open` to detect existing
        open recovery PRs; returns `true` if one exists (idempotency gate).
    - `gitCreateBranch(branch: string, base: string) => boolean`
      — `git checkout -b <branch> <base>` from `origin/main`;
        returns `true` on success.
    - `gitCherryPick(sha: string) => "ok" | "conflict" | "error"`
      — `git cherry-pick <sha>`; distinguishes merge conflict (exit 1 with
        CHERRY_PICK_HEAD) from other errors.
    - `gitPush(branch: string) => boolean`
      — `git push origin <branch>`; returns `true` on success.
    - `ghPrCreate(title: string, body: string, head: string) => string | null`
      — `gh pr create --title ... --body ... --head ... --base main`;
        returns the new PR URL on success, `null` on failure.
  - `RecoveryResult` discriminated union:
    ```typescript
    | { status: "opened";         prUrl: string; cherryPickedCount: number }
    | { status: "already-exists"; reason: string }
    | { status: "cherry-pick-conflict"; sha: string; attemptedCount: number }
    | { status: "error";          reason: string }
    ```
  - `buildRecoveryBranchName(prNumber: number) => string`
    — deterministic branch name `recovery/<prNumber>`; pure function; no I/O.
  - `buildRecoveryPRBody(finding: CascadeFinding) => string`
    — markdown body for the recovery PR listing `missingCommits`,
      the original `prNumber`, and a note that this was auto-generated.
  - `openRecoveryPR(finding: CascadeFinding, dryRun: boolean, adapters: RecoveryAdapters) => RecoveryResult`
    — pure function composed with adapters; implements the recovery workflow:
      1. Call `checkRecoveryPRExists(recoveryBranch)` → if true return
         `already-exists`.
      2. If `dryRun` → return `{ status: "opened", prUrl: "dry-run", cherryPickedCount: 0 }`.
      3. `gitCreateBranch(recoveryBranch, "origin/main")` → on failure return
         `error`.
      4. For each commit in `finding.missingCommits`: cherry-pick; on `"conflict"`
         return `cherry-pick-conflict` immediately (does not push partial state).
      5. `gitPush(recoveryBranch)` → on failure return `error`.
      6. `ghPrCreate(title, body, recoveryBranch)` → null → return `error`;
         non-null URL → return `opened`.

- [x] New file `tools/bg/missed-substrate-recovery.test.ts` with tests
  covering all `RecoveryResult` arms:
  - `"opened"` — fresh finding, no existing PR, no conflicts, push+PR succeed.
  - `"already-exists"` — `checkRecoveryPRExists` returns `true`; no mutations.
  - `"cherry-pick-conflict"` — cherry-pick returns `"conflict"` on commit N;
    adapters confirm branch-create was called but push was NOT called.
  - `"error"` — branch-create failure; push failure; `ghPrCreate` returning `null`.
  - `"opened"` dry-run — `gitCreateBranch` NOT called; result URL is `"dry-run"`.
  - `buildRecoveryBranchName` — deterministic output matches expected pattern.
  - `buildRecoveryPRBody` — contains PR number and commit SHAs.

- [x] All tests pass: `bun tools/bg/missed-substrate-recovery.test.ts` (landed in 081KRHWGX0008QG0R0027YXBTB slice; on `origin/main`)
- [x] `bun tools/bg/missed-substrate-detector.test.ts` still passes (no regressions) (landed in 081KRHWGX0008QG0R0027YXBTB slice; on `origin/main`)

## Design sketch

```typescript
// tools/bg/missed-substrate-recovery.ts

import type { CascadeFinding } from "./missed-substrate-detector";

export type RecoveryAdapters = {
  checkRecoveryPRExists: (branchName: string) => boolean;
  gitCreateBranch: (branch: string, base: string) => boolean;
  gitCherryPick: (sha: string) => "ok" | "conflict" | "error";
  gitPush: (branch: string) => boolean;
  ghPrCreate: (title: string, body: string, head: string) => string | null;
};

export type RecoveryResult =
  | { status: "opened";                  prUrl: string; cherryPickedCount: number }
  | { status: "already-exists";          reason: string }
  | { status: "cherry-pick-conflict";    sha: string; attemptedCount: number }
  | { status: "error";                   reason: string };

export function buildRecoveryBranchName(prNumber: number): string {
  return `recovery/${prNumber}`;
}

export function buildRecoveryPRBody(finding: CascadeFinding): string {
  const commitList = finding.missingCommits.map(s => `- ${s}`).join("\n");
  return [
    `## Auto-generated recovery PR`,
    ``,
    `Original merged PR: **#${finding.prNumber}** (branch \`${finding.branchName}\`)`,
    ``,
    `Missing commits detected by \`missed-substrate-detector\`:`,
    commitList,
    ``,
    `Urgency at detection time: **${finding.urgency}**`,
    ``,
    `> This PR was opened automatically. Review before merging.`,
  ].join("\n");
}

export function openRecoveryPR(
  finding: CascadeFinding,
  dryRun: boolean,
  adapters: RecoveryAdapters,
): RecoveryResult {
  const recoveryBranch = buildRecoveryBranchName(finding.prNumber);

  const exists = adapters.checkRecoveryPRExists(recoveryBranch);
  if (exists) {
    return { status: "already-exists", reason: `PR for ${recoveryBranch} already open` };
  }

  if (dryRun) {
    return { status: "opened", prUrl: "dry-run", cherryPickedCount: 0 };
  }

  const created = adapters.gitCreateBranch(recoveryBranch, "origin/main");
  if (!created) {
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

  const pushed = adapters.gitPush(recoveryBranch);
  if (!pushed) {
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
```

## Security note

`buildRecoveryBranchName` produces a branch name composed only of digits,
`/`, and `-` — safe to pass as an argument to `spawnSync` calls in the real
adapter implementations. The real adapters (in 081KRHWGX0008QG0R000PVB6FF) must validate SHA
inputs from `CascadeFinding.missingCommits` with the same allow-list regex
already used in `compareBranchToMerged`.

## Why the recovery branch name is `recovery/<prNumber>` (no timestamp)

The original sketch included a `<YYYYMMDDHHMMSS>` suffix to guarantee
uniqueness across multiple recovery attempts. The shipped implementation
dropped it: the idempotency gate (`checkRecoveryPRExists`) already prevents
duplicate recovery PRs for the same source PR, so a single deterministic
name per `prNumber` is correct AND simpler to test. Documented in PR #3458's
`docs/AUTONOMOUS-LOOP.md` update — "deterministic branch name
`recovery/<prNumber>`".

## Dependency chain

```
081KRFA460008QG0R00061SXRW (slices 1–4 + 6 shipped — missed-substrate-detector.ts functional)
  └─ 081KRHWGX0008QG0R0027YXBTB (THIS ROW — openRecoveryPR core + RecoveryAdapters + tests)
       └─ 081KRHWGX0008QG0R000PVB6FF (wire --auto-recover into pollOnce; real adapter impls)
            └─ 081KRHWGX0008QG0R002C038BJ (docs + 081KRFA460008QG0R00061SXRW acceptance criteria close)
```

## Pre-start checklist (per backlog-item-start-gate)

- [ ] Confirm `CascadeFinding` type is exported from `missed-substrate-detector.ts`
      (it is — used in the test file already)
- [ ] Run `bun tools/bg/missed-substrate-detector.test.ts` to confirm baseline
      passes before touching any file
- [ ] Grep for existing cherry-pick utility in `tools/` to avoid duplication
      (not expected to exist; this is the first cherry-pick caller)
- [ ] Verify `spawnSync` pattern from `missed-substrate-detector.ts` for real
      adapter implementations in 081KRHWGX0008QG0R000PVB6FF
