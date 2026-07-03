---
pr_number: 5078
title: "docs(persona/max): recommend Otto + foreground autonomous-loop tick for onboarding"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T03:36:36Z"
merged_at: "2026-05-26T03:39:54Z"
closed_at: "2026-05-26T03:39:54Z"
head_ref: "otto-cli/max-otto-cron-loop-onboarding-2026-05-25"
base_ref: "main"
archived_at: "2026-05-27T19:44:48Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5078: docs(persona/max): recommend Otto + foreground autonomous-loop tick for onboarding

## PR description

## Summary

Aaron 2026-05-25: *"he's not used to otto yet but it would be cool if it got used to otto and the foreground cron loop."*

Recommends **Otto (Claude Code)** as Max's primary AI tool + documents the foreground autonomous-loop tick pattern so Max's AI sees the framing on cold-boot. The cron-loop substrate per `.claude/rules/tick-must-never-stop.md` is Claude-Code-native today; hooking Max into it lets him reuse the existing tick-by-tick bounded-wait substrate immediately.

## Files changed

- `memory/max/STARTING-POINT.md` — new "Otto + the foreground autonomous-loop tick" section covering what the loop is, auto-arm on first session, what Max sees, how he stays in control, why it matters for tier-2 (most tier-2 work is install→wait→fix→push→wait cycles), and the Standing-by failure mode auto-caught by `holding-without-named-dependency-is-standing-by-failure.md`
- `memory/max/PERSONA.md` — added bullet to "How agents work with Max" naming Otto as recommended primary tool + cross-referencing the STARTING-POINT.md section

## Why it composes naturally with tier-2

Most tier-2 Docker Desktop substrate-engineering Max owns is bounded-wait work: install something, wait for CI, fix a finding, push, wait for CI, repeat. The autonomous loop fills wait windows so Max comes back to a branch further along than when he left. Composes directly with the install.sh validation + onboarding-doc + dev-machine-tracking deliverables from PR #5076 — each is an iterative scaffolding task where the tick-by-tick cadence compounds value across the work session.

## Test plan

- [x] markdownlint clean
- [x] Cross-references resolve (.claude/rules/tick-must-never-stop.md, docs/AUTONOMOUS-LOOP-PER-TICK.md, .claude/rules/dont-ask-permission.md, .claude/rules/holding-without-named-dependency-is-standing-by-failure.md)
- [ ] CI passes (gate workflow + CodeQL)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T03:40:04Z)

## Pull request overview

Updates Max’s persona onboarding docs to recommend using Otto (Claude Code) and to explain the factory’s foreground autonomous-loop tick pattern so Max can reuse the existing bounded-wait “install → wait → fix → push → wait” workflow substrate.

**Changes:**

- Added a new onboarding section describing Otto + the foreground autonomous-loop tick mechanics and how it helps with tier-2 work.
- Updated Max’s persona guidance to recommend Otto as the primary AI tool and point to the new onboarding section.

### Reviewed changes

Copilot reviewed 3 out of 3 changed files in this pull request and generated 3 comments.

| File | Description |
| ---- | ----------- |
| memory/max/STARTING-POINT.md | Adds an onboarding section explaining Otto + the autonomous-loop tick workflow and control surfaces. |
| memory/max/PERSONA.md | Adds a recommendation bullet for using Otto and links to the STARTING-POINT operational details. |

## Review threads

### Thread 1: memory/max/STARTING-POINT.md:125 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-26T03:40:03Z):

The per-tick flow summary here drops the required “commit” step from the canonical checklist (speculative work → verify → commit → write tick shard → CronList → visibility signal). Since this section is onboarding guidance, it should match `tick-must-never-stop.md` / `AUTONOMOUS-LOOP-PER-TICK.md` exactly (or explicitly say it’s an abbreviated summary).

### Thread 2: memory/max/STARTING-POINT.md:132 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-26T03:40:03Z):

Commit trailer guidance is too specific here. Repo convention (AGENTS.md “Commit attribution — harness-specific trailers”) requires at minimum `Co-Authored-By: Claude <noreply@anthropic.com>` for Otto; model/version suffixes are optional. Suggest rewording to the required baseline (and optionally mention the model suffix may be appended) so this doesn’t conflict with the project’s commit-discipline doc.

### Thread 3: memory/max/STARTING-POINT.md:139 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-26T03:40:04Z):

This control-plane section is slightly inconsistent with the canonical autonomous-loop doc: (1) `docs/AUTONOMOUS-LOOP.md` explicitly says the factory does not use `/loop` as the invocation path (it wires `CronCreate` directly), so recommending `/loop` to adjust cadence is likely to mislead; and (2) session persistence is nuanced — `--resume`/`--continue` can restore scheduled tasks, while a new thread won’t. Consider aligning these bullets with the “Session-restart recovery” section in `docs/AUTONOMOUS-LOOP.md` and use `CronDelete`/`CronCreate` terminology if cadence changes are supported.

## General comments

### @chatgpt-codex-connector (2026-05-26T03:36:42Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
