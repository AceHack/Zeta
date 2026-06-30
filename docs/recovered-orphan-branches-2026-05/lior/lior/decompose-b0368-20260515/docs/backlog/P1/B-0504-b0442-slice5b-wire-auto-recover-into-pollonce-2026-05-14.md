---
id: B-0504
priority: P1
status: closed
title: "B-0442 slice 5b — wire --auto-recover into pollOnce + real RecoveryAdapters + config flags"
tier: factory-infrastructure
effort: S
created: 2026-05-14
last_updated: 2026-05-15
closed: 2026-05-15
closed_by_pr: 3458
parent: B-0442
depends_on: [B-0503]
composes_with: [B-0442, B-0503, B-0505]
tags: [background-service, bus, mechanization, drift-detection, recovery-pr, config]
type: feature
---

# B-0442 slice 5b — wire `--auto-recover` into `pollOnce`

## Origin

Depends on B-0503 (core `openRecoveryPR` function). This row:

1. Adds `autoRecover` + `recoveryDryRun` to `DetectorConfig`.
2. Implements real `RecoveryAdapters` (production `spawnSync` wrappers).
3. Extends `Adapters` with `openRecoveryPR` adapter for testability.
4. Extends `pollOnce` to call recovery after cascade detection.
5. Updates `parseArgs` with `--auto-recover` / `--recovery-dry-run` flags.
6. Adds integration tests covering the new wiring.

## Acceptance criteria

- [ ] `DetectorConfig` gains two fields:
  - `autoRecover: boolean` — default `false`; when `true`, call `openRecoveryPR`
    for each `CascadeFinding` after detecting cascades.
  - `recoveryDryRun: boolean` — default `false`; when `true`, pass `dryRun: true`
    to `openRecoveryPR` (no git mutations; log intent only).

- [ ] `parseArgs` wires:
  - `--auto-recover` → sets `config.autoRecover = true`
  - `--recovery-dry-run` → sets `config.recoveryDryRun = true`
  - Both flags go into `KNOWN_FLAGS`.
  - `--recovery-dry-run` without `--auto-recover` is silently accepted (recoveryDryRun
    is stored but `pollOnce` only consults it when `autoRecover` is true).

- [ ] `Adapters` interface gains:
  ```typescript
  openRecoveryPR?: (finding: CascadeFinding, dryRun: boolean) => RecoveryResult;
  ```
  Optional (`?`) so existing tests that do not exercise recovery path do not need
  to provide it; `pollOnce` treats missing adapter as `autoRecover = false`
  regardless of config flag.

- [ ] `REAL_ADAPTERS.openRecoveryPR` implemented using real `spawnSync` wrappers
  for each `RecoveryAdapters` operation:
  - `checkRecoveryPRExists` — `gh pr list --head <branch> --state open --json number`
    → `[]` means no existing PR.
  - `gitCreateBranch` — `git checkout -b <branch> origin/main`.
  - `gitCherryPick` — `git cherry-pick <sha>`; exit code distinguishes conflict
    (`exit 1`, stderr contains "CONFLICT") vs error (`exit != 0`, other stderr).
  - `gitPush` — `git push origin <branch>`.
  - `ghPrCreate` — `gh pr create --title ... --body ... --head ... --base main`.
  - All inputs validated with the allow-list regex from `compareBranchToMerged`
    before passing to `spawnSync`.

- [ ] `pollOnce` updated: after the cascade-detection loop, if
  `config.autoRecover && adapters.openRecoveryPR !== undefined`:
  ```
  for each finding in findings:
    recoveryResult = adapters.openRecoveryPR(finding, config.recoveryDryRun)
    log result
  ```
  Recovery failures do NOT throw — they are logged to `PollResult.note`
  and the poll loop continues.

- [ ] `PollResult` gains:
  - `recoveryAttempts: number` — count of findings for which recovery was
    attempted (0 when `autoRecover` is false or adapter missing).
  - `recoveryOpened: number` — count of `"opened"` results.

- [ ] Tests added (DST-replayable; injected adapters):
  - `autoRecover: false` (default) → `recoveryAttempts: 0`; adapter never called
    even when cascade detected.
  - `autoRecover: true`, adapter returns `"opened"` → `recoveryOpened: 1`;
    note contains `"opened"`.
  - `autoRecover: true`, `recoveryDryRun: true`, adapter returns
    `{ status: "opened", prUrl: "dry-run" }` → note contains `"dry-run"`.
  - `autoRecover: true`, adapter returns `"already-exists"` → `recoveryOpened: 0`;
    note contains `"already-exists"`.
  - `autoRecover: true`, adapter throws → `recoveryOpened: 0`; note contains
    `"recovery error"`; poll completes successfully.
  - `parseArgs(["--auto-recover"])` → `config.autoRecover === true`.
  - `parseArgs(["--recovery-dry-run"])` → `config.recoveryDryRun === true`.
  - `parseArgs([])` → `config.autoRecover === false`,
    `config.recoveryDryRun === false`.

- [ ] All tests pass: `bun tools/bg/missed-substrate-detector.test.ts`
- [ ] `bun tools/bg/missed-substrate-recovery.test.ts` still passes (no regressions)

## Design sketch

```typescript
// In missed-substrate-detector.ts

// Config additions:
export const DEFAULT_CONFIG: DetectorConfig = {
  // ...existing...
  autoRecover: false,
  recoveryDryRun: false,
};

// Adapters extension (optional — existing tests need no change):
export type Adapters = {
  // ...existing fields...
  openRecoveryPR?: (finding: CascadeFinding, dryRun: boolean) => RecoveryResult;
};

// pollOnce extension — after the existing finding-publish block:
let recoveryAttempts = 0;
let recoveryOpened = 0;
const recoveryNotes: string[] = [];

if (config.autoRecover && adapters.openRecoveryPR !== undefined) {
  for (const finding of findings) {
    recoveryAttempts++;
    try {
      const rr = adapters.openRecoveryPR(finding, config.recoveryDryRun);
      if (rr.status === "opened") {
        recoveryOpened++;
        recoveryNotes.push(`recovery PR ${rr.prUrl} (${rr.cherryPickedCount} commits)`);
      } else {
        recoveryNotes.push(`recovery skipped for #${finding.prNumber}: ${rr.status}`);
      }
    } catch (e) {
      recoveryNotes.push(`recovery error for #${finding.prNumber}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }
}

return {
  ...existing fields,
  recoveryAttempts,
  recoveryOpened,
  note: [existingNote, ...recoveryNotes].filter(Boolean).join("; "),
};
```

## Real adapters implementation note

`REAL_ADAPTERS.openRecoveryPR` wraps `openRecoveryPR` from B-0503 with
real `spawnSync` sub-adapters:

```typescript
REAL_ADAPTERS.openRecoveryPR = (finding, dryRun) =>
  openRecoveryPR(finding, dryRun, REAL_RECOVERY_ADAPTERS);
```

`REAL_RECOVERY_ADAPTERS` is defined in `missed-substrate-detector.ts` and
imports `openRecoveryPR` from `missed-substrate-recovery.ts`. This keeps
`missed-substrate-recovery.ts` as a pure module (no imports from the detector)
and `missed-substrate-detector.ts` as the integration point.

## SHA allow-list for real adapters

The real `gitCherryPick` adapter must validate the SHA with:

```typescript
if (!/^[0-9a-f]{7,40}$/.test(sha)) {
  return "error"; // reject non-SHA inputs before spawnSync
}
```

Same pattern already in `compareBranchToMerged`. Prevents the SHA coming
from a crafted `missed-substrate-cascade` envelope from causing argument
injection (defense-in-depth; envelopes are written by the same process that
reads git, so the SHA is already validated once upstream).

## Dependency chain

```
B-0442 (slices 1–4 + 6 shipped)
  └─ B-0503 (openRecoveryPR core + RecoveryAdapters — MUST LAND FIRST)
       └─ B-0504 (THIS ROW — wire into pollOnce + real adapters + config + tests)
            └─ B-0505 (docs + acceptance criteria close)
```

## Pre-start checklist (per backlog-item-start-gate)

- [ ] B-0503 must be merged before this row starts (depends_on B-0503)
- [ ] Run full test suite: `bun tools/bg/missed-substrate-detector.test.ts`
      and `bun tools/bg/missed-substrate-recovery.test.ts`
- [ ] Verify `REAL_ADAPTERS` can import from `missed-substrate-recovery.ts`
      (circular import check — detector imports recovery, not the reverse)
- [ ] Confirm `PollResult` type is re-exported via test file so type changes
      don't silently break consumers
