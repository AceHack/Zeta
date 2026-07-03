---
pr_number: 3108
title: "fix(tsc): guard undefined capture group in validate-memory-parity"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-14T06:55:18Z"
merged_at: "2026-05-14T06:58:55Z"
closed_at: "2026-05-14T06:58:55Z"
head_ref: "fix/tsc-validate-memory-parity-undefined-group-2026-05-14"
base_ref: "main"
archived_at: "2026-05-14T08:01:31Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3108: fix(tsc): guard undefined capture group in validate-memory-parity

## PR description

## Summary

- TypeScript 6.0 types `RegExpMatchArray` capture groups as `string | undefined` — even non-optional groups like ours — causing five `TS18048`/`TS2345` errors in `tools/memory/validate-memory-parity.ts`
- Adds a two-line guard (`const captured = m[1]; if (captured === undefined) continue;`) that narrows the type to `string`, fixes all five errors, and eliminates the `lint (tsc tools)` failure on every future CI run
- No functional change: the regex's single capture group will never actually be `undefined`, so the guard is only type-level

## Test plan

- [x] `bun --bun tsc --noEmit -p tsconfig.json` exits 0 locally
- [ ] `lint (tsc tools)` CI check passes green

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-14T06:57:04Z)

## Pull request overview

This PR fixes TypeScript 6.0 strict typing in `validate-memory-parity` by narrowing a regex capture group before using it as a string.

**Changes:**

- Adds an explicit `undefined` guard for `m[1]`.
- Preserves existing runtime behavior while satisfying stricter `RegExpMatchArray` typing.
