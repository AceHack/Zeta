---
pr_number: 3056
title: "feat(bg/audit): duplicate-row-id audit tool + 081KRFA460008QG0R00308W7FJ substrate-cleanup row"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-13T23:05:20Z"
merged_at: "2026-05-13T23:38:20Z"
closed_at: "2026-05-13T23:38:21Z"
head_ref: "feat/duplicate-row-id-audit-tool-b0451-2026-05-13"
base_ref: "main"
archived_at: "2026-05-14T00:20:12Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3056: feat(bg/audit): duplicate-row-id audit tool + 081KRFA460008QG0R00308W7FJ substrate-cleanup row

## PR description

## Summary

While resolving the 081KRFA460008QG0R001SXP0C2 ID collision ([#3053](https://github.com/Lucent-Financial-Group/Zeta/pull/3053)), an inline audit revealed **12 ADDITIONAL duplicate-ID groups** across the backlog directory. Silently-overwriting substrate state is high-severity hygiene risk: a consumer of `id: 081KRA5AR0008QG0R000Y6102S` gets one of **three** files depending on load order; every other substrate consumer's implicit primary-key guarantee is broken.

This PR:

1. Ships the audit tool that mechanically detects the failure class
2. Files [081KRFA460008QG0R00308W7FJ](docs/backlog/P1/081KRFA460008QG0R00308W7FJ-duplicate-row-id-substrate-cleanup-2026-05-13.md) tracking the per-collision cleanup work

## Empirical findings on `origin/main`

```
$ bun tools/bg/audit-duplicate-row-ids.ts
audit-duplicate-row-ids: 12 duplicate-ID group(s) found across 559 rows:
  081KRA5AR0008QG0R001JVT5FX: forge-cli-ollama-research (×2)
  081KDVJT3E008QG0R003GV8BHV: lost-substrate vs ts-worktree-survey
  081KDVJT3E008QG0R00183ME0R: orphan-branch-survey vs worktree-branch-delta
  081KDVJT3E008QG0R000P3YGTX: closed-not-merged-pr vs ts-closed-pr-survey
  081KDVJT3E008QG0R002GGF22P: cadence-history-hook vs ts-draft-pr-survey
  081KR2E4K0008QG0R000ARCH0X: durable-checkpoint (P1) vs contributor-compliance-core (P2)
  081KR2E4K0008QG0R001733JTN: pages-seo (P1) vs contributor-cross-reference (P2)
  081KR2E4K0008QG0R0015BCPF7: pages-sitemap (P1) vs t1-t2-trajectories (P2)
  081KR50HA0008QG0R001NNPEXC: alignment-proof-ladder (P1) vs t4-t5-trajectories (P2)
  081KRA5AR0008QG0R000Y6102S: wallet-immune (P1) vs amara-persona-bootstrap vs peer-call-ts-audit [3-way]
  081KRA5AR0008QG0R0035N4S6C: amara-ts-core vs peer-call-persona-loader
  081KRA5AR0008QG0R000C3P8KP: amara-ts-readme-courier vs grok-ts-persona-flag
```

## Collision-class taxonomy

Two distinct patterns visible:

1. **Cross-priority namespace bleed** (`081KR2E4K0008QG0R000ARCH0X..081KR50HA0008QG0R001NNPEXC`): Otto-on-CLI filed P1 rows in the 0370 range while a parallel agent filed P2 rows in the same range. Same pattern produced the 081KRFA460008QG0R001SXP0C2 collision resolved by [#3053](https://github.com/Lucent-Financial-Group/Zeta/pull/3053).
2. **Within-priority concurrent decomposition** (`081KRA5AR0008QG0R001JVT5FX`, `081KDVJT3E008QG0R003GV8BHV-4`, `081KRA5AR0008QG0R000Y6102S-0411`): Two agents decomposed adjacent atomic sub-row series simultaneously. Most are 2026-05-10/11 timeframe — **pre-claim-acquire-rule** ([#3032](https://github.com/Lucent-Financial-Group/Zeta/pull/3032) landed 2026-05-13).

## Changes

- `tools/bg/audit-duplicate-row-ids.ts` — exits 0/1, prints colliding groups
- `tools/bg/audit-duplicate-row-ids.test.ts` — 14 tests covering id extraction, group sorting, real-world patterns
- `docs/backlog/P1/081KRFA460008QG0R00308W7FJ-duplicate-row-id-substrate-cleanup-2026-05-13.md` — tracks the per-collision cleanup work
- `docs/BACKLOG.md` regenerated

## Test plan

- [x] `bun test tools/bg/audit-duplicate-row-ids.test.ts` → 14/14 pass
- [x] Running tool against `origin/main` reports exactly 12 groups (matches inline audit)
- [x] Worktree-isolated build (`/tmp/zeta-dup-id-audit`)

## Future work (tracked in 081KRFA460008QG0R00308W7FJ)

- Per-collision cleanup (12 groups × ~5min each = ~60min mechanical work)
- CI wiring so future collisions block merge automatically

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-13T23:07:22Z)

## Pull request overview

Adds a backlog-substrate hygiene audit that detects duplicate `id:` values across `docs/backlog/**/B-*.md` rows, after a manual sweep (triggered by the 081KRFA460008QG0R001SXP0C2 collision resolved in #3053) found 12 additional collision groups. The new tool exits non-zero when duplicates are found and is intended to be CI-wired in follow-up work; a P1 backlog row (081KRFA460008QG0R00308W7FJ) tracks the per-collision cleanup.

**Changes:**

- New TypeScript CLI + library `tools/bg/audit-duplicate-row-ids.ts` walking `git ls-files docs/backlog/` and grouping rows by frontmatter `id:`.
- 14-test Bun test suite covering `extractId` (CRLF, sub-row IDs, missing fields), `findDuplicates` (sort determinism), and `auditRowFiles` (clean / pair / triple / no-id / unreadable cases).
- Files 081KRFA460008QG0R00308W7FJ (P1) tracking the 12-collision cleanup; regenerated `docs/BACKLOG.md` to index the new row.

### Reviewed changes

Copilot reviewed 5 out of 5 changed files in this pull request and generated 3 comments.

| File | Description |
| ---- | ----------- |
| tools/bg/audit-duplicate-row-ids.ts | New audit tool — extracts frontmatter IDs and reports duplicates with non-zero exit. |
| tools/bg/audit-duplicate-row-ids.test.ts | Unit tests for extractId / findDuplicates / auditRowFiles. |
| docs/backlog/P1/081KRFA460008QG0R00308W7FJ-duplicate-row-id-substrate-cleanup-2026-05-13.md | New P1 row tracking the 12-collision cleanup with a resolution rubric. |
| docs/BACKLOG.md | Regenerated index — adds the 081KRFA460008QG0R00308W7FJ entry. |

### COMMENTED — @copilot-pull-request-reviewer (2026-05-13T23:16:31Z)

## Pull request overview

Copilot reviewed 6 out of 6 changed files in this pull request and generated no new comments.

### COMMENTED — @chatgpt-codex-connector (2026-05-13T23:18:09Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `992386aa65`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you

- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

### COMMENTED — @copilot-pull-request-reviewer (2026-05-13T23:25:14Z)

## Pull request overview

Copilot reviewed 7 out of 7 changed files in this pull request and generated no new comments.

## Review threads

### Thread 1: tools/bg/audit-duplicate-row-ids.ts:132 (resolved)

**@copilot-pull-request-reviewer** (2026-05-13T23:07:21Z):

This `spawnSync("git", ...)` call lacks the `// eslint-disable-next-line sonarjs/no-os-command-from-path` comment that every other tools/**.ts spawnSync invocation in the repo carries (see tools/backlog/generate-index.ts:40, tools/bg/backlog-ready-notifier.ts:175, tools/bg/standing-by-detector.ts:84, etc.). Without it, the lint sweep will flag this file. Preferred form is the suffixed-rationale pattern used in tools/bg/backlog-ready-notifier.ts ("-- git invoked as explicit args array; no shell, no injection risk.").

### Thread 2: tools/bg/audit-duplicate-row-ids.ts:119 (resolved)

**@copilot-pull-request-reviewer** (2026-05-13T23:07:22Z):

`rowsScanned` is misleadingly named: it counts only rows that had an extractable `id:` field, not rows actually scanned. The test on lines 130-140 asserts `rowsScanned === 2` when three files were inspected (one lacked an id), and the unreadable-file test on lines 152-160 asserts `rowsScanned === 1` when two paths were passed in. The CLI's success message ("`${result.rowsScanned} rows scanned, no duplicate IDs`") therefore under-reports the actual scan size. Consider either renaming to `rowsWithId` / `idsScanned`, or tracking the true input count separately so the CLI output matches the user's expectation.

### Thread 3: tools/bg/audit-duplicate-row-ids.ts:95 (resolved)

**@copilot-pull-request-reviewer** (2026-05-13T23:07:22Z):

The `rowsScanned` ternary is unnecessary: `[].reduce((n, fs) => n + fs.length, 0)` already returns 0 for an empty iterable, so the `idToFiles.size > 0` guard is dead code. The expression can be simplified to `[...idToFiles.values()].reduce((n, fs) => n + fs.length, 0)` without changing behavior.

### Thread 4: tools/bg/audit-duplicate-row-ids.ts:89 (resolved)

**@chatgpt-codex-connector** (2026-05-13T23:18:10Z):

**<sub><sub>![P2 Badge](https://img.shields.io/badge/P2-yellow?style=flat)</sub></sub>  Fail audit when backlog files cannot be read**

`auditRowFiles` silently swallows `readFileSync` failures and continues, so the CLI can report success even when tracked backlog files are unreadable or missing in the worktree. That creates a false negative path where duplicate IDs in skipped files are never checked, which undermines this tool when used as a merge gate. Since this script is intended to protect substrate integrity, unreadable inputs should be surfaced as an error state rather than ignored.

Useful? React with 👍 / 👎.
