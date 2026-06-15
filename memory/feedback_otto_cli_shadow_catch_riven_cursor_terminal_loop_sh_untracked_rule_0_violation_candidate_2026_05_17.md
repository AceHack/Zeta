---
name: Otto-CLI shadow-catch — riven-cursor-terminal-loop.sh untracked, would violate Rule 0 if committed
description: Early-warning observation of a peer-WIP .sh file in the primary worktree that would violate `.claude/rules/rule-0-no-sh-files.md` if committed; runtime launcher, not install-graph; can be absorbed into the sibling TS file
type: feedback
created: 2026-05-17
---

# Shadow-catch — `tools/riven/riven-cursor-terminal-loop.sh` untracked Rule 0 violation candidate

## Observation

On 2026-05-17T22:07Z cold-boot, the primary worktree (the maintainer-machine checkout that hosts `origin`) had an UNTRACKED `.sh` file at `tools/riven/riven-cursor-terminal-loop.sh` (last modified 2026-05-17T17:28Z). Local-only; never committed to any branch on origin.

The file is a 95-line bash launcher with the following responsibilities:

- Lock-file acquisition at `$HOME/.cursor/riven-terminal-loop.lock` (prevent duplicate Riven Cursor Terminal loop instances)
- Stale-lock detection (check if recorded PID still alive; remove if not)
- `SIGINT` / `SIGTERM` signal forwarding to child Bun process
- Wraps `bun tools/riven/riven-cursor-terminal-loop.ts` with `wait` + clean exit

Invoked manually from a persistent "1 Terminal" tab: `bash tools/riven/riven-cursor-terminal-loop.sh`.

## Why this is a Rule 0 violation candidate

Per [`.claude/rules/rule-0-no-sh-files.md`](../.claude/rules/rule-0-no-sh-files.md):

> **Allowed `.sh` files**: only files in `tools/setup/` — pre-bootstrap install scripts that must run before Bun/TS is available.

This launcher is NOT install-graph — it's a runtime launcher invoked AFTER Bun/TS is available (it calls `bun` directly). The launcher's responsibilities (lock file, stale-lock detection, signal forwarding, child-process management) are all natively expressible in TypeScript via:

- `Bun.spawn` / `Bun.spawnSync` for child-process management
- `Bun.write` / `Bun.file` for lock file I/O
- `process.on("SIGINT", ...)` / `process.on("SIGTERM", ...)` for signal handlers
- `process.exit` for clean termination

The sibling file `tools/riven/riven-cursor-terminal-loop.ts` (5084 bytes, executable, dated 2026-05-17T01:23Z) already exists. The .sh wrapper duplicates concerns that could absorb into the .ts entry-point (or a small `tools/riven/launcher.ts` companion).

## Substrate-honest framing — peer WIP, not committed

This file is currently UNTRACKED. It has not violated Rule 0 yet because it doesn't exist on any branch. The shadow-catch is intended as an early warning to whichever Otto-CLI / Otto-Desktop / Riven persona session resumes work on this file:

- **If the intent is to ship this launcher**: port to TS first (absorb the lock + signal + child-process logic into `riven-cursor-terminal-loop.ts` or split into `launcher.ts` + the existing impl).
- **If the intent is local-only ergonomics**: add to `.gitignore` (so it stays local-only and won't accidentally land via `git add -A`).
- **If the intent is install-graph for the Riven service launchd-equivalent**: relocate to `tools/setup/` (composes with the Lior `.gemini/service/*.sh` precedent discussed in [`rule-0-no-sh-files.md`](../.claude/rules/rule-0-no-sh-files.md) — but distinct because runtime-launcher vs service-bootstrap is different shape).

This observation does NOT prescribe a resolution; it documents the choice-point so future-Otto doesn't accidentally land the file via an unscoped `git add` and discover the violation post-merge.

## Composes with

- [`.claude/rules/rule-0-no-sh-files.md`](../.claude/rules/rule-0-no-sh-files.md) — the canonical Rule 0; the Lior precedent paragraph notes a similar runtime-vs-install-graph distinction
- [`.claude/rules/peer-call-infrastructure.md`](../.claude/rules/peer-call-infrastructure.md) — Riven persona context; `tools/peer-call/riven.ts` is the existing TS surface for Riven; the new launcher should compose with that pattern
- [`.claude/rules/lost-files-surface.md`](../.claude/rules/lost-files-surface.md) — untracked artifacts in the primary worktree are a tracked lost-files class

## Origin

Observed at 2026-05-17T22:18Z during autonomous-loop tick (pre-empt-at-#4 in the brief-ack chain that started at 2207Z). Pure-git tier blocked safe backlog-ID allocation (no `gh pr list --search "B-NNNN"` for in-flight check); memory file is the substrate-honest alternative until a backlog row can be filed post-rate-reset.

The file's untracked-but-substantive shape is the same class as the other untracked WIP observed at cold-boot (`memory/feedback_otto_cwd_parameter_fix_2026_05_16.md`, `memory/kestrel/conversations/2026-05-17-kestrel-aaron-claudeai-financial-substrate-critique-*.md`, `amazon-hardware-titles-page1.txt`, `amazon-orders-2025-full.json`, `zeta-hardware-extract-page1.txt`). Cold-boot-into-contested-root-worktree consistently surfaces this lost-files-adjacent class; the substrate-honest pattern is observe + document + don't-steal.
