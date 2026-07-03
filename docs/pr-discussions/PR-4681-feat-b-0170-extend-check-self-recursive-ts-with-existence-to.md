---
pr_number: 4681
title: "feat(081KQNJ500008QG0R003SCWBDV): extend check-self-recursive.ts with `existence` topic (v0.9.1)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-22T21:49:59Z"
merged_at: "2026-05-22T21:52:23Z"
closed_at: "2026-05-22T21:52:23Z"
head_ref: "backlog/b-0170-self-recursive-existence-topic-2026-05-22"
base_ref: "main"
archived_at: "2026-05-22T22:22:13Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4681: feat(081KQNJ500008QG0R003SCWBDV): extend check-self-recursive.ts with `existence` topic (v0.9.1)

## PR description

## Summary

Smallest safe slice of [081KQNJ500008QG0R003SCWBDV](../blob/main/docs/backlog/P1/081KQNJ500008QG0R003SCWBDV-substrate-claim-checker-ts-tool-aaron-2026-05-03.md): extend `check-self-recursive.ts` to dispatch a second topic (`existence`), cashing the README v0.9.0 promise that *"Adding additional topics (existence, path-forms, cross-surface, convention) is a 1-line dispatch each"*. No new file, no architecture change.

**Operative-authorization**: aaron 2026-05-14: *"- **Devil-pole** (edge-runner drive): keep pushing, discover, go hard, never-be-idle"*.

## Changes

- `tools/substrate-claim-checker/check-self-recursive.ts`
  - `SelfCheckTopic = "count"` → `"count" | "existence"`
  - `SUPPORTED_TOPICS` gains `"existence"`
  - Dispatch branch composes `check-existence.ts`
  - Only **drift**-severity findings surface from existence (gitignored-but-extant `warning` findings are a distinct sub-class concern, not self-recursive failure)
  - Bump v0.9.0 → v0.9.1
- `tools/substrate-claim-checker/check-self-recursive.test.ts` — +3 tests:
  - `parseDirective` of bare `existence`
  - `parseDirective` of mixed `[count, existence]` preserves order
  - `checkFile` detects existence drift in self-check memo
  - `checkFile` clean existence case (no path claims)
  - `checkFile` mixed dispatch emits findings for both topics
- `tools/substrate-claim-checker/README.md` — version bump, supported-topics list, severity-treatment doc
- `docs/backlog/P1/081KQNJ500008QG0R003SCWBDV-...md` — `last_updated: 2026-05-22`; sub-class table row reflects `count + existence` shipped

## Focused checks

| Check | Result |
|---|---|
| `bun test tools/substrate-claim-checker/check-self-recursive.test.ts` | **23 pass / 0 fail** (was 20; +3 new) |
| `bun test tools/substrate-claim-checker/` | **140 pass / 0 fail** across 7 files; no regressions |
| End-to-end sanity: `[count, existence]` directive on memo with both drift shapes | **2 findings** (one per topic), **exit 1** |
| Commit canary: `git ls-tree HEAD \| wc -l` vs parent | **54 = 54** (no broken-commit corruption) |

## Bounded slice discipline

Stays well within "exactly one bounded step":

- One new topic case + tests + doc-bump
- No new file
- No architecture change
- Remaining v1 sub-classes (semantic-equivalence, empirical-output) and remaining self-recursive topics (path-forms, cross-surface, convention) stay deferred per the 081KQNJ500008QG0R003SCWBDV done-criteria

## Composes with

- `.claude/rules/skill-router-as-substrate-inventory.md` — extend existing substrate before authoring new; the check-self-recursive.ts dispatch was the substrate to extend
- `.claude/rules/refresh-world-model-poll-pr-gate.md` — Pure-git tier traversal during this session (GraphQL was 0/5000 at slice start; PR opened post-reset)
- `.claude/rules/zeta-expected-branch.md` — `ZETA_EXPECTED_BRANCH` set + `git branch --show-current` guard before commit
- 081KQNJ500008QG0R003SCWBDV done-criteria item #1: each sub-class has at least one check-type. Count + existence now both routed through the self-recursive dispatch, narrowing the v1+ deficit

## Test plan

- [x] `bun test tools/substrate-claim-checker/` clean (140/140)
- [x] End-to-end sanity reproduces both drift findings
- [x] Branch pushed; PR opened; auto-merge can be armed once CI is green

🤖 Generated with [Claude Code](https://claude.com/claude-code)
