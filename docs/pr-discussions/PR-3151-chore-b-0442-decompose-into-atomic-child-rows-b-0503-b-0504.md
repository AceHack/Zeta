---
pr_number: 3151
title: "chore(b-0442): decompose into atomic child rows 081KRHWGX0008QG0R0027YXBTB/081KRHWGX0008QG0R000PVB6FF/081KRHWGX0008QG0R002C038BJ"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-14T18:06:30Z"
merged_at: "2026-05-14T18:08:43Z"
closed_at: "2026-05-14T18:08:43Z"
head_ref: "chore/b-0442-decompose-slice5-2026-05-14"
base_ref: "main"
archived_at: "2026-05-14T18:24:10Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
archive_note: "PR #3151 merged at 18:08Z; this archive PR was branched from commit 09fa6185 (pre-merge). The referenced files (081KRHWGX0008QG0R0027YXBTB, 081KRHWGX0008QG0R000PVB6FF, 081KRHWGX0008QG0R002C038BJ, docs/BACKLOG.md) were added to main by PR #3151 (commit 759af2d6) and are present on main. They do not appear in this archive PR's diff because this is a documentation-only record, not a re-application of those changes."
---

# PR #3151: chore(b-0442): decompose into atomic child rows 081KRHWGX0008QG0R0027YXBTB/081KRHWGX0008QG0R000PVB6FF/081KRHWGX0008QG0R002C038BJ

## PR description

## Summary

081KRFA460008QG0R00061SXRW (missed-substrate cascade detector) has slices 1–4 + 6 already landed
(`tools/bg/missed-substrate-detector.ts` + 24 DST tests + launchd + docs).
The only remaining acceptance criterion is slice 5 — auto-opening recovery PRs.

This PR decomposes slice 5 into three dependency-ordered atomic child rows:

| Row | Effort | What | Depends on |
|-----|--------|------|-----------|
| **081KRHWGX0008QG0R0027YXBTB** | S | `openRecoveryPR` core function + `RecoveryAdapters` interface + all `RecoveryResult` arms tested in isolation | — |
| **081KRHWGX0008QG0R000PVB6FF** | S | Wire `--auto-recover`/`--recovery-dry-run` into `pollOnce`; real `spawnSync` adapter impls; `PollResult` extension | 081KRHWGX0008QG0R0027YXBTB |
| **081KRHWGX0008QG0R002C038BJ** | XS | `docs/AUTONOMOUS-LOOP.md` + `tools/bg/README.md` updates; mark 081KRFA460008QG0R00061SXRW slice 5 `[x]` | 081KRHWGX0008QG0R000PVB6FF |

### What changed

- `docs/backlog/P1/081KRHWGX0008QG0R0027YXBTB-b0442-slice5a-open-recovery-pr-core-function-2026-05-14.md` — new child row
- `docs/backlog/P1/081KRHWGX0008QG0R000PVB6FF-b0442-slice5b-wire-auto-recover-into-pollonce-2026-05-14.md` — new child row
- `docs/backlog/P1/081KRHWGX0008QG0R002C038BJ-b0442-slice5c-docs-autonomous-loop-acceptance-close-2026-05-14.md` — new child row
- `docs/backlog/P1/081KRFA460008QG0R00061SXRW-...md` — added `children: [081KRHWGX0008QG0R0027YXBTB, 081KRHWGX0008QG0R000PVB6FF, 081KRHWGX0008QG0R002C038BJ]` frontmatter
- `docs/BACKLOG.md` — 3 new index rows under 081KRFA460008QG0R00061SXRW

### Focused checks

- `git diff --stat HEAD~1`: 5 files changed, 505 insertions(+), 1 deletion(-)
- `bun tools/bg/missed-substrate-detector.test.ts` — not modified; existing 24-test suite untouched
- No code changes in this PR — pure backlog substrate decomposition

### Decomposition rationale (per 081KRFA460008QG0R00061SXRW design)

081KRHWGX0008QG0R0027YXBTB separates the pure `openRecoveryPR` function (testable with injected adapters)
from the integration wiring in 081KRHWGX0008QG0R000PVB6FF. This mirrors the slice 3 vs slice 4 split
already in 081KRFA460008QG0R00061SXRW: `realCascadeDetector` (pure, adapter-injected) was kept separate
from `REAL_ADAPTERS` + `pollOnce` wiring. 081KRHWGX0008QG0R002C038BJ follows DV2.0 data-split discipline —
docs are satellites (fast-changing), code is hub (stable); separating them avoids
documentation tailing a code PR through review cycles.

operative-authorization: aaron 2026-05-13: "Cooling period: TBD. The memory file IS the durable record"

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-14T18:08:44Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `637b9e7410`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T18:10:39Z)

## Pull request overview

Decomposes 081KRFA460008QG0R00061SXRW slice 5 (“auto-opening recovery PRs”) into three dependency-ordered atomic backlog child rows (081KRHWGX0008QG0R0027YXBTB/081KRHWGX0008QG0R000PVB6FF/081KRHWGX0008QG0R002C038BJ), and wires the decomposition into the 081KRFA460008QG0R00061SXRW parent row plus the generated backlog index.

**Changes:**
- Added three new P1 backlog row files describing the slice 5a/5b/5c plan and acceptance criteria.
- Updated 081KRFA460008QG0R00061SXRW frontmatter to record the new child rows and refreshed `last_updated`.
- Regenerated `docs/BACKLOG.md` to include the new rows in the P1 index.

### Reviewed changes

Copilot reviewed 5 out of 5 changed files in this pull request and generated 3 comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| docs/backlog/P1/081KRHWGX0008QG0R0027YXBTB-b0442-slice5a-open-recovery-pr-core-function-2026-05-14.md | New child row defining the `openRecoveryPR` core + adapter interface and test plan (slice 5a). |
| docs/backlog/P1/081KRHWGX0008QG0R000PVB6FF-b0442-slice5b-wire-auto-recover-into-pollonce-2026-05-14.md | New child row describing wiring/config/real adapters + integration tests (slice 5b). |
| docs/backlog/P1/081KRHWGX0008QG0R002C038BJ-b0442-slice5c-docs-autonomous-loop-acceptance-close-2026-05-14.md | New child row for docs updates + acceptance-criteria close steps (slice 5c). |
| docs/backlog/P1/081KRFA460008QG0R00061SXRW-missed-substrate-cascade-detector-background-service-2026-05-13.md | Adds `children: [081KRHWGX0008QG0R0027YXBTB, 081KRHWGX0008QG0R000PVB6FF, 081KRHWGX0008QG0R002C038BJ]` and updates `last_updated`. |
| docs/BACKLOG.md | Updates the generated index to list 081KRHWGX0008QG0R0027YXBTB/081KRHWGX0008QG0R000PVB6FF/081KRHWGX0008QG0R002C038BJ under P1. |
</details>

## Review threads

### Thread 1: docs/backlog/P1/081KRHWGX0008QG0R0027YXBTB-b0442-slice5a-open-recovery-pr-core-function-2026-05-14.md:146 (unresolved)

**@chatgpt-codex-connector** (2026-05-14T18:08:44Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Fix idempotency check to avoid duplicate recovery PRs**

The workflow checks for an existing recovery PR using a branch name that is generated with `new Date()`, so each run usually queries a brand-new head branch and misses already-open recovery PRs for the same source PR. In repeated detector runs, this can open duplicate recovery PRs instead of being idempotent. The existence check needs to key off stable identity (e.g., original PR number/marker) rather than the timestamped branch name.

Useful? React with 👍 / 👎.

### Thread 2: docs/backlog/P1/081KRHWGX0008QG0R0027YXBTB-b0442-slice5a-open-recovery-pr-core-function-2026-05-14.md:165 (unresolved)

**@chatgpt-codex-connector** (2026-05-14T18:08:44Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Abort cherry-pick state before continuing poll loop**

On a cherry-pick conflict this flow returns immediately without any cleanup, but the planned real adapter runs raw `git cherry-pick`; that leaves `CHERRY_PICK_HEAD`/conflicted index and the recovery branch checked out. Since the design also says polling should continue after recovery failures, the service can get stuck failing subsequent git operations until manual intervention. The conflict/error path should include explicit rollback/abort steps before returning.

Useful? React with 👍 / 👎.

### Thread 3: docs/backlog/P1/081KRHWGX0008QG0R0027YXBTB-b0442-slice5a-open-recovery-pr-core-function-2026-05-14.md:34 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T18:10:37Z):

P1: This row says it does not add `--auto-recover` / `--dry-run` CLI flags, but the planned flag name elsewhere (including 081KRHWGX0008QG0R000PVB6FF/081KRHWGX0008QG0R002C038BJ) is `--recovery-dry-run`. Update this bullet to use the correct flag name to avoid implementing/documenting a mismatched CLI surface.

### Thread 4: docs/backlog/P1/081KRHWGX0008QG0R002C038BJ-b0442-slice5c-docs-autonomous-loop-acceptance-close-2026-05-14.md:49 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T18:10:38Z):

P1: The acceptance-criteria snippet hard-codes "landed 2026-05-14". Since the actual landing date for slice 5 may differ, this risks baking an incorrect historical record into 081KRFA460008QG0R00061SXRW. Consider using a placeholder (or omitting the date) and filling it in when the slice actually lands.

### Thread 5: docs/backlog/P1/081KRHWGX0008QG0R002C038BJ-b0442-slice5c-docs-autonomous-loop-acceptance-close-2026-05-14.md:52 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-14T18:10:38Z):

The acceptance criteria includes updating 081KRFA460008QG0R00061SXRW frontmatter to add `children: [081KRHWGX0008QG0R0027YXBTB, 081KRHWGX0008QG0R000PVB6FF, 081KRHWGX0008QG0R002C038BJ]`, but this PR already makes that change in the 081KRFA460008QG0R00061SXRW row. To avoid a future "already done" checkbox, either drop this criterion from 081KRHWGX0008QG0R002C038BJ or mark it as satisfied with a note that it was completed in the decomposition PR.
