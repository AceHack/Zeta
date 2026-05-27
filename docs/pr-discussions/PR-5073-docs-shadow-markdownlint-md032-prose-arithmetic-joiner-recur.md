---
pr_number: 5073
title: "docs(shadow): markdownlint MD032 prose-arithmetic-joiner recurring failure class"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T02:57:00Z"
merged_at: "2026-05-26T02:58:14Z"
closed_at: "2026-05-26T02:58:14Z"
head_ref: "otto-cli/shadow-md032-prose-joiner-2026-05-25"
base_ref: "main"
archived_at: "2026-05-27T19:46:29Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5073: docs(shadow): markdownlint MD032 prose-arithmetic-joiner recurring failure class

## PR description

## Summary

Per Aaron 2026-05-25 framing — *"reoccuring failures belong in shadow logs for class identification"* — this PR lands the shadow-lesson log for the markdownlint MD032 prose-arithmetic-joiner failure class observed on PR #5068.

## Empirical anchor

PR #5068 (Mika substrate batch) hit 8 MD032 errors. Direct inspection showed **4 of the 8 were not real list-bullet typos** — they were prose continuations where `+` or `-` landed at the start of a wrap line. markdownlint can't distinguish prose-`+` from list-`+`; operator-side rewrap is the simplest-first mitigation.

## What ships

- `docs/research/2026-05-25-shadow-lesson-log-markdownlint-md032-prose-arithmetic-joiner-recurring-class.md` — the lesson log with failure-class definition, 4 empirical examples, 4 ranked mitigations (simplest-first), and the next-step trigger (promote to tooling mitigation only if class recurs 2+ more times in 30 days)

## Composes with

- `.claude/rules/blocked-green-ci-investigate-threads.md` empirical FP catalog
- `.claude/rules/all-complexity-is-accidental-in-greenfield.md` (simplest-first response)
- Sibling shadow-lesson-logs under `docs/research/2026-05-{07,13,14}-shadow-lesson-log-*.md`

## Test plan

- [x] markdownlint clean on the new file
- [x] Filename follows existing `YYYY-MM-DD-shadow-lesson-log-*.md` convention
- [ ] CI passes (gate workflow + CodeQL)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-26T02:57:04Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
