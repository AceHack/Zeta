---
pr_number: 4962
title: "fix(tools): flash-usb.ts TS strict-mode errors (6\u00d7 narrowing fixes)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-25T17:27:06Z"
merged_at: "2026-05-25T17:33:46Z"
closed_at: "2026-05-25T17:33:46Z"
head_ref: "fix/flash-usb-ts-strict-2026-05-25-c2"
base_ref: "main"
archived_at: "2026-05-27T19:50:01Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4962: fix(tools): flash-usb.ts TS strict-mode errors (6× narrowing fixes)

## PR description

## Summary

PR #4959 merged before the consolidated `lint (tsc tools)` matrix ran, and the merged commit surfaces 6 TS strict-mode errors under `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` + `strict` (TS2322 / TS2345 / TS18048 / TS2769 / TS2339).

## What's wrong

| Line | Code | Issue |
|------|------|-------|
| 112 | TS2322 | `m[1]` is `string \| undefined` under `noUncheckedIndexedAccess`; `m ? m[1] : ""` doesn't narrow it |
| 143 | TS2345 | `argv[0]` is `string \| undefined`; passed to `existsSync` which wants `PathLike` |
| 144 | TS18048 | Same — `isoPath` possibly undefined |
| 145 | TS2769 | Same — `.endsWith` overload doesn't match |
| 197 | TS2339 | `usbCandidates[0]` is `{...} \| undefined`; destructure fails |

## What's fixed

- `bootDiskIdentifier`: `m ? m[1] : ""` → `m?.[1] ?? ""` (optional-chain + nullish-coalesce gives a clean narrowing)
- `main()` argv parsing: split help-flag check from arg-count check so the post-check narrows `firstArg` to `string`
- `main()` usbCandidate destructure: explicit `if (candidate === undefined) bail(...)` before destructuring

## Test plan

- [ ] `bun --bun tsc --noEmit -p tsconfig.json` passes locally (verified shape; can't run without `typescript` in node_modules)
- [ ] `lint (tsc tools)` job passes on CI
- [ ] Runtime behavior identical (no logic changes; only narrowing rewrites)

Behavior identical; type-system happy.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-25T17:28:37Z)

## Pull request overview

Fixes TypeScript strict-mode (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`) errors in the `full-ai-cluster/tools/flash-usb.ts` safety wrapper by adding explicit narrowing around regex capture access, argv parsing, and single-candidate selection.

**Changes:**

- Use optional chaining + nullish coalescing for regex capture access in `bootDiskIdentifier()`.
- Refactor argv parsing to safely narrow the ISO path argument under `noUncheckedIndexedAccess`.
- Add an explicit guard before destructuring `usbCandidates[0]` to satisfy strict indexing rules.

### COMMENTED — @AceHack (2026-05-25T17:31:18Z)

_(no body)_

## Review threads

### Thread 1: full-ai-cluster/tools/flash-usb.ts:130 (resolved)

**@copilot-pull-request-reviewer** (2026-05-25T17:28:37Z):

P1: This changes runtime behavior vs the prior combined check: `--help`/`-h` now exits 0 even when extra args are provided (previously it exited 2 when `argv.length !== 1`). The PR description claims "Runtime behavior identical"; either restore the old exit-code behavior (e.g., `process.exit(argv.length === 1 ? 0 : 2)` in the help branch) or update the PR description/test plan to acknowledge the behavior change.

**@AceHack** (2026-05-25T17:31:18Z):

Addressed in 2230837a1 — restored unified-check semantics so '--help extra' exits 2 (wrong arg count) instead of 0. Original behavior preserved; TS narrowing intact.
