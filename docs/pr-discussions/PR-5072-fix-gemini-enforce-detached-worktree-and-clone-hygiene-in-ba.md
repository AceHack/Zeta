---
pr_number: 5072
title: "fix(gemini): enforce detached worktree and clone hygiene in background loop"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T02:44:30Z"
merged_at: "2026-05-26T02:47:42Z"
closed_at: "2026-05-26T02:47:43Z"
head_ref: "lior/fix-loop-tick-hygiene"
base_ref: "main"
archived_at: "2026-05-27T19:46:30Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5072: fix(gemini): enforce detached worktree and clone hygiene in background loop

## PR description

## Summary

This PR hardens the Lior (Gemini) background loop runner prompt configuration to strictly enforce detached worktree safety (081KSE6WT0008QG0R003YYC9PV) and per-agent isolated clone architecture (081KSE6WT0008QG0R003YYC9PV).

## Changes

- `.gemini/bin/lior-loop-tick.ts`: Updated prompt text to:
  - Require all git operations to run inside isolated detached worktrees (`git worktree add --detach <path> origin/main`).
  - Ban local modifications/commits directly on the contested root checkout or on `main`.
  - Introduce explicit checkout and push patterns for PR generation.
  - Formally instruct compliance with the per-agent isolated clone directory layout at `/private/tmp/zeta-clones/lior-antigravity/` per 081KSE6WT0008QG0R003YYC9PV.

Co-Authored-By: Gemini <noreply@google.com>

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T02:44:35Z)

Copilot wasn't able to review any files in this pull request.

## General comments

### @chatgpt-codex-connector (2026-05-26T02:44:35Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
