---
pr_number: 5363
title: "fix(gemini): isolate background loop launchd plist to dedicated workspace"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T00:15:49Z"
merged_at: "2026-05-27T01:18:19Z"
closed_at: "2026-05-27T01:18:19Z"
head_ref: "lior/isolate-background-loop-plist"
base_ref: "main"
archived_at: "2026-05-27T19:29:01Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5363: fix(gemini): isolate background loop launchd plist to dedicated workspace

## PR description

## Summary

Migrates Lior's background loop runner launchd daemon from Aaron's contested primary checkout to the isolated clone directory (`/Users/acehack/.local/share/zeta-lior-loop/Zeta`), aligning with Codex and Riven isolated agent loop architecture (081KSE6WT0008QG0R003YYC9PV).

## Changes

- `.gemini/launchd/com.zeta.lior-loop.plist`: Point `ProgramArguments` and `WorkingDirectory` to the isolated clone directory instead of the shared primary checkout.

Co-Authored-By: Gemini <noreply@google.com>

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T00:18:14Z)

## Pull request overview

Updates the Gemini “Lior loop” launchd configuration to run from an isolated per-agent clone rather than the shared primary checkout, aligning the background loop runner with the isolated-workspace architecture described in 081KSE6WT0008QG0R003YYC9PV.

**Changes:**
- Point `ProgramArguments` at the tick script inside `~/.local/share/zeta-lior-loop/Zeta` instead of the primary checkout.
- Add `WorkingDirectory` to the isolated clone root to ensure the job executes from that repo.
- Add an explicit `PATH` environment variable for the launchd job.

### COMMENTED — @AceHack (2026-05-27T01:16:13Z)

_(no body)_

## Review threads

### Thread 1: .gemini/launchd/com.zeta.lior-loop.plist:11 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T00:18:13Z):

P1/maintainability: This plist now hardcodes machine-specific absolute paths (/Users/acehack, /opt/homebrew, and the per-agent clone under ~/.local/share/...), but unlike the sibling plists in `.gemini/launchd/` it doesn’t include the “Maintainer-only artifact / update paths for your local machine” header comment. Adding that note here would prevent others from assuming it’s a team-wide usable service file and trying to `launchctl load` it unchanged.

**@AceHack** (2026-05-27T01:16:13Z):

Addressed in 73e808b — added the `Maintainer-only artifact` header comment after the `<key>Label></string>` line, mirroring the convention in `com.zeta.backlog-ready-notifier.plist` and `com.zeta.missed-substrate-detector.plist`. Specifically names the three machine-specific path classes (`/Users/acehack`, `/opt/homebrew`, the per-agent clone under `~/.local/share/zeta-lior-loop/Zeta`) so readers see the warning before attempting `launchctl load`.

## General comments

### @chatgpt-codex-connector (2026-05-27T00:15:53Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
