---
pr_number: 5981
title: "docs(backlog): close B-0273 as pure drift \u2014 safe/unsafe ROM split shipped in #5874"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-29T12:23:15Z"
merged_at: "2026-05-29T12:32:19Z"
closed_at: "2026-05-29T12:32:19Z"
head_ref: "backlog/b-0273-close-as-drift-2026-05-29"
base_ref: "main"
archived_at: "2026-05-29T12:41:10Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5981: docs(backlog): close B-0273 as pure drift — safe/unsafe ROM split shipped in #5874

## PR description

## What

Close **B-0273** (Atari 2600 ROM safe/unsafe folder split) as **pure substrate-drift**. The implementation shipped via PR #5874 (merged 2026-05-29T10:08:47Z at `75802ccb5`) but the backlog row was left `status: open` — the implementation-doesn't-close-the-row drift pattern that the `backlog-item-start-gate.md` step-0 discriminator is built to catch.

## Bounded step

This is the single bounded step: flip the row to `closed`, add a Resolution section with per-acceptance-criterion verification, fix the stale `classification: blocked-on-B-0272` (B-0272 closed 2026-05-16), and regenerate `docs/BACKLOG.md`. No new code; mirrors sibling B-0272's pure-drift close.

## Per-acceptance-criterion verification

| Acceptance | Status |
|---|---|
| safe/ folder not gitignored, checked in | shipped — `roms-safe/README.md` + `roms-safe/atari/2600/README.md` tracked; `roms/.gitignore` governs only `roms/`, so `roms-safe/` is checked in by default |
| unsafe/ folder gitignored | shipped — `roms/` stays gitignored via existing depth-limited rule (`*` + `!*/` + sentinel re-includes) |
| README documents which ROMs are safe to distribute | shipped — `roms-safe/atari/2600/README.md` carries a per-ROM table (canonical name, author, license class, citation) for 7 homebrew titles |

## Focused checks (outcomes)

- `git merge-base --is-ancestor 75802ccb5 HEAD` → **YES** (PR #5874 merge commit reachable on origin/main)
- Existence-check: all 4 artifacts present (`roms-safe/README.md`, `roms-safe/atari/2600/README.md`, `tools/roms/split-by-license.ts`, `tools/roms/manifests/atari-2600-allowlist`)
- `bun tools/backlog/lint-frontmatter.ts` → exit 0; **0 findings on B-0273** (429 pre-existing findings are on 294 other files)
- `BACKLOG_WRITE_FORCE=1 bun tools/backlog/generate-index.ts` → wrote `docs/BACKLOG.md`; B-0273 now renders `[x]` (closed)
- Diff scope: exactly 2 files (row + regenerated index)
- No in-flight PRs referencing B-0273; claim acquired (`otto-cli`)

operative-authorization: aaron 2026-05-14: "- **Devil-pole** (edge-runner drive): keep pushing, discover, go hard, never-be-idle"

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-29T12:25:56Z)

## Pull request overview

Closes backlog item **B-0273** as shipped/pure-drift by updating its row metadata (status/classification/dates) and regenerating the root backlog index so the item renders as closed.

**Changes:**
- Mark B-0273 as `status: closed`, update `last_updated`, and record `closed` date.
- Add a “Resolution” section documenting acceptance-criterion verification and provenance to PR #5874.
- Regenerate `docs/BACKLOG.md` so B-0273 renders as checked off.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 1 comment.

| File | Description |
| ---- | ----------- |
| docs/backlog/P1/B-0273-atari-rom-safe-unsafe-folder-split-2026-05-08.md | Close the row and add resolution/provenance notes for the already-shipped implementation. |
| docs/BACKLOG.md | Regenerated index reflecting B-0273 as closed. |

### COMMENTED — @AceHack (2026-05-29T12:30:41Z)

_(no body)_

## Review threads

### Thread 1: docs/backlog/P1/B-0273-atari-rom-safe-unsafe-folder-split-2026-05-08.md:59 (resolved)

**@copilot-pull-request-reviewer** (2026-05-29T12:25:55Z):

Line starts with a leading `+`, which Markdown parsers treat as a list marker. This can break rendering and will trip markdownlint (the repo specifically warns against starting wrapped prose lines with `+`). Reword to avoid a line-start `+` and use plain prose separators (e.g., commas / “and”).

**@AceHack** (2026-05-29T12:30:41Z):

Fixed in 6b9db410e — reworded the verification sentence to use comma/`and` separators so no continuation line begins with `+`. Same root cause cleared the failed markdownlint MD032 check too. markdownlint-cli2 with the repo `.markdownlint-cli2.jsonc` config now exits 0 on this file.

## General comments

### @chatgpt-codex-connector (2026-05-29T12:23:21Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
