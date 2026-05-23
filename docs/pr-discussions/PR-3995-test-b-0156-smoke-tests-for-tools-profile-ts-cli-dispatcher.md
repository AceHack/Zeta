---
pr_number: 3995
title: "test(B-0156): smoke tests for tools/profile.ts CLI dispatcher"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-17T00:58:49Z"
merged_at: "2026-05-17T01:02:44Z"
closed_at: "2026-05-17T01:02:44Z"
head_ref: "otto/b0156-profile-test-2026-05-16"
base_ref: "main"
archived_at: "2026-05-17T02:12:16Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3995: test(B-0156): smoke tests for tools/profile.ts CLI dispatcher

## PR description

## Summary

Adds `tools/profile.test.ts` — 9 smoke tests covering the CLI
dispatch surface of `tools/profile.ts`. Closes the last gap in
[B-0156](../blob/main/docs/backlog/P1/B-0156-typescript-standardization-non-install-scripts-aaron-2026-05-01.md)
acceptance criterion #2 ("each TS sibling has at least one
`bun test` covering its primary entry path").

`amara.ts` + `ani.ts` are already covered by
`tools/peer-call/smoke.test.ts` (B-0421 #4). `profile.ts` was
the lone remaining TS port without a sibling test.

## Scope discipline — dispatch only, NOT live dotnet tools

Mirrors `tools/peer-call/smoke.test.ts`: validates the
switch-statement entry path, NOT the `dotnet-counters` /
`dotnet-trace` / `dotnet-gcdump` / `BenchmarkDotNet` /
`reportgenerator` invocations. Those tools are not guaranteed
installed in CI, so live subcommand testing is out of scope.

The 9 tests:

1. File exists at canonical path
2. No-args → help + exit 0
3. `-h` → help + exit 0
4. `--help` → help + exit 0
5. Unknown command → exit 64 (EX_USAGE)
6. `counters` without pid → exit 64 + stderr usage
7. `trace` without pid → exit 64 + stderr usage
8. `gcdump` without pid → exit 64 + stderr usage
9. Help text references every documented subcommand
   (doc-drift catcher — every `case` in the switch must
   appear in the default `printf` help block)

## Substrate-drift step-0 result

Per
[`backlog-item-start-gate.md`](../blob/main/.claude/rules/backlog-item-start-gate.md):

- B-0156's "3 ports remaining" audit baseline is stale —
  all three `.sh` files (`profile.sh`, `peer-call/amara.sh`,
  `peer-call/ani.sh`) have been deleted; TS siblings present.
- Phase 5 (bash sweep) already complete.
- BUT row is NOT pure-drift: AC #2 unmet for `profile.ts`.
- Bounded slice = add the missing test. This PR.

After this PR lands, AC #2 is fully met across all 6
non-install TS ports. The remaining ACs (#5 package.json
script update audit, #6 no-regression confirmation) can be
addressed in follow-up slices or the row can be closed
substrate-honestly.

## Test plan

- [x] `bun test tools/profile.test.ts` → 9 pass / 0 fail
      / 21 expect() calls / 1158ms
- [x] No new `.sh` introduced; no `.py` introduced
- [x] No changes to `tools/profile.ts` itself (test-only PR)
- [ ] CI green on required checks

## Operative authorization

aaron 2026-05-14: "- **Devil-pole** (edge-runner drive):
keep pushing, discover, go hard, never-be-idle"

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-17T01:03:05Z)

## Pull request overview

Adds Bun smoke-test coverage for the `tools/profile.ts` CLI dispatcher (B-0156 AC #2), ensuring the help/dispatch surface is exercised without invoking external `dotnet-*` tooling in CI.

**Changes:**
- Added `tools/profile.test.ts` with 9 dispatch-surface smoke tests (help paths, EX_USAGE handling, missing pid handling, and help text subcommand coverage).
- Added a hygiene-history tick shard documenting the work session and verification.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 1 comment.

| File | Description |
| ---- | ----------- |
| tools/profile.test.ts | New Bun smoke tests for `tools/profile.ts` CLI dispatch behavior (no live dotnet tool execution). |
| docs/hygiene-history/ticks/2026/05/17/0057Z.md | Tick shard documenting the bounded slice and local verification. |

## Review threads

### Thread 1: docs/hygiene-history/ticks/2026/05/17/0057Z.md:8 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-17T01:03:05Z):

P2 (nit): This tick shard uses YAML frontmatter but does not include the canonical pipe-row entry (`| <timestamp> | <model id> | ... |`) described in docs/hygiene-history/ticks/README.md. Adding the pipe-row (even if you also keep the richer narrative) would keep the shard machine-parseable by existing hygiene tooling and reduce further schema drift.
