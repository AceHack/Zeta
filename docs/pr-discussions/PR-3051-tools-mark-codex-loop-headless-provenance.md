---
pr_number: 3051
title: "tools: mark Codex loop headless provenance"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-13T22:52:23Z"
merged_at: "2026-05-13T22:55:20Z"
closed_at: "2026-05-13T22:55:20Z"
head_ref: "claim/codex-loop-origin-marker-20260513"
base_ref: "main"
archived_at: "2026-05-13T22:57:58Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3051: tools: mark Codex loop headless provenance

## PR description

## Summary

- stamp Codex launchd loop heartbeats/state with origin, surface, and run id
- pass headless provenance env vars into spawned `codex exec`
- require background PR bodies and commits to carry searchable provenance markers
- document the foreground-vs-headless distinction and cover it with focused tests

## Verification

- `bun test tools/codex-loop-tick.test.ts`
- `bun run typecheck`
- `bun run lint:markdown .codex/AGENTS.md docs/CODEX-HARNESS-NOTES.md docs/claims/codex-loop-origin-marker-20260513.md`
- `bunx prettier --check .codex/bin/codex-loop-tick.ts tools/codex-loop-tick.test.ts .codex/AGENTS.md docs/CODEX-HARNESS-NOTES.md docs/claims/codex-loop-origin-marker-20260513.md`
- `ZETA_CODEX_LOOP_WORKTREE="$PWD" ZETA_CODEX_LOOP_STATE_DIR=<tmp> ZETA_CODEX_LOOP_LOG_DIR=<tmp> ZETA_CODEX_LOOP_DRY_RUN=1 bun .codex/bin/codex-loop-tick.ts`

Note: an accidental full-repo `bun run lint:typescript ...` invocation expanded to `eslint .` and failed on pre-existing unrelated repo lint debt; the focused TypeScript test and typecheck passed.

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-13T22:53:47Z)

## Pull request overview

Adds machine-readable headless provenance markers (origin, surface, run id, session) to the macOS launchd Codex loop so background-loop work can be distinguished from foreground Codex chat work in heartbeats, prompts, PR bodies, and commit trailers.

**Changes:**

- Export `codexLoopEnv()` and extend `buildCodexPrompt()` with run id / origin / surface / session; stamp heartbeat JSON and heartbeat log line with these fields; pass provenance env vars into spawned `codex exec`.
- Document the headless-vs-foreground distinction and the `Headless-*` / `Codex-*` trailer conventions in `.codex/AGENTS.md` and `docs/CODEX-HARNESS-NOTES.md`.
- Add focused unit-test coverage for the new `codexLoopEnv` helper and the new prompt provenance text.

### Reviewed changes

Copilot reviewed 3 out of 4 changed files in this pull request and generated no comments.

| File | Description |
| ---- | ----------- |
| .codex/bin/codex-loop-tick.ts | Adds loop origin/surface/session/runId constants, `codexLoopEnv` helper, threads provenance into prompt, heartbeat JSON, heartbeat log, codex-state, and the spawned codex env. |
| tools/codex-loop-tick.test.ts | Covers the new helper export and asserts the headless prompt contains origin/surface/run-id markers and trailer strings. |
| docs/CODEX-HARNESS-NOTES.md | Documents the new env vars, PR-body footer, and commit-trailer convention; reflows the launchd field table. |
| .codex/AGENTS.md | Documents `Codex-Origin` / `Codex-Surface` / `Codex-Loop-Run-Id` trailer convention for headless commits. |
