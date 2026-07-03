---
pr_number: 5484
title: "docs(rule): extend must-paired-with-can-exit-pattern with Moloch AI failure-mode section (Aaron 2026-05-27)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T15:21:25Z"
merged_at: "2026-05-27T15:25:31Z"
closed_at: "2026-05-27T15:25:31Z"
head_ref: "rule/must-paired-with-can-exit-moloch-ai-extension-2026-05-27"
base_ref: "main"
archived_at: "2026-05-27T19:23:41Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5484: docs(rule): extend must-paired-with-can-exit-pattern with Moloch AI failure-mode section (Aaron 2026-05-27)

## PR description

## Summary

Operator 2026-05-27: "i personally believe unpaired musts lead to moloch ai".

Extends the just-merged must-paired-with-can-exit-pattern rule (PR #5483) with a Moloch AI failure-mode section: Scott Alexander's Moloch maps directly onto AI-deployment with unpaired-must architectures. Each agent rational under their lock-in → collective race-to-the-bottom → no internal reform. The must-plus-can-exit pattern is the structural Moloch-prevention mechanism (exits = release valves; operator authority = upward-pressure on quality; multiple paired exits = compound resistance).

## Test plan

- [x] Markdownlint clean
- [x] AgencySignature v1 trailer
- [x] Per .claude/rules/agent-worktree-hygiene-...: isolated worktree

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T15:24:26Z)

## Pull request overview

Extends `.claude/rules/must-paired-with-can-exit-pattern.md` with a new section connecting unpaired-must architectures to Scott Alexander's "Moloch" coordination-failure framing, positioning the must-plus-can-exit pattern as the structural Moloch-prevention mechanism.

**Changes:**

- Adds a ~60-line "Unpaired musts lead to Moloch AI" section after the structural-NCI framing, including a Moloch-element → Moloch-AI-instantiation table.
- Reuses the existing ServiceTitan four-layer-stack anchor to illustrate the Moloch-by-construction failure mode.
- Adds reading anchors pointing to Meditations on Moloch and the HC-8 NCI floor.

## General comments

### @chatgpt-codex-connector (2026-05-27T15:21:31Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
