---
pr_number: 4871
title: "fix(lint): remove 5 stray gitlinks introduced by #4851"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-24T21:07:29Z"
merged_at: "2026-05-24T21:09:45Z"
closed_at: "2026-05-24T21:09:45Z"
head_ref: "otto-vscode/fix-stray-gitlinks-from-4851-2026-05-24"
base_ref: "main"
archived_at: "2026-05-24T21:25:24Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4871: fix(lint): remove 5 stray gitlinks introduced by #4851

## PR description

## Summary

PR #4851 (`docs(archive): preserve recently merged PRs`, commit `9b94a274a`) accidentally committed five mode-160000 **gitlink** entries to repo root:

- `lior-fix-4746`
- `lior-fix-4768`
- `lior-fix-4773`
- `lior-fix-4780`
- `lior-fix-4781`

They have **no `.gitmodules` entries** — CI surfaces this as:

```
fatal: No url found for submodule path 'lior-fix-4746' in .gitmodules
```

The required `lint (no empty dirs)` check sees them as five _"unexpected empty directories"_ (uninitialised gitlinks resolve to empty), so it **fails on every PR opened off main since #4851 landed**. The empty-dirs warning appears on at least 14 open PRs (#4869, #4867, #4866, #4865, #4864, #4863, #4862, #4861, #4860, #4859, #4858, #4855, #4850, #4825, #4805 — see `bun tools/github/poll-pr-gate-batch.ts --all-open` warnings).

## Fix

`git rm --cached` the five gitlink entries. No `.gitmodules` changes (none ever existed for these). No working-tree files touched. Top-level tree shrinks from 60 → 55 entries (sanity-check confirmed: only the 5 expected `delete mode 160000` ops).

## Blast radius

After this lands:

- Lint `no-empty-dirs` becomes green on every downstream branch on its next rebase/merge of main.
- `git submodule foreach --recursive` stops emitting the post-job `fatal: No url found` warning on every CI run.
- No working-tree file is added, removed, or modified.

## Test plan

- [x] `git ls-tree HEAD | wc -l` = 55 (was 60); 5 removed entries match the gitlink set
- [x] No `.gitmodules` to update (file does not exist; confirmed)
- [ ] `lint (no empty dirs)` passes on this PR
- [ ] Once merged, re-poll fleet: empty-dirs warnings drop off the warning list

Reference failure: https://github.com/Lucent-Financial-Group/Zeta/actions/runs/26372168462/job/77626151804

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-24T21:08:54Z)

## Pull request overview

Removes five unintended mode-160000 gitlink (submodule) entries that were introduced at repo root without corresponding `.gitmodules` configuration, which has been breaking CI (submodule resolution) and the `lint (no empty dirs)` check.

**Changes:**

- Delete the stray gitlink entries: `lior-fix-4746`, `lior-fix-4768`, `lior-fix-4773`, `lior-fix-4780`, `lior-fix-4781`.
- No `.gitmodules` changes (file does not exist in the repo root in the current tree).

### Reviewed changes

Copilot reviewed 5 out of 5 changed files in this pull request and generated no comments.

<details>
<summary>Show a summary per file</summary>

| File | Description |
| ---- | ----------- |
| lior-fix-4746 | Removes unintended gitlink entry from repo root to stop submodule/lint failures. |
| lior-fix-4768 | Removes unintended gitlink entry from repo root to stop submodule/lint failures. |
| lior-fix-4773 | Removes unintended gitlink entry from repo root to stop submodule/lint failures. |
| lior-fix-4780 | Removes unintended gitlink entry from repo root to stop submodule/lint failures. |
| lior-fix-4781 | Removes unintended gitlink entry from repo root to stop submodule/lint failures. |
</details>
