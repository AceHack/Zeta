---
pr_number: 5507
title: "docs(rule): force-push-policy follow-on \u2014 Java-checked-exceptions-as-sum-type TFeedback discipline (Aaron 2026-05-27)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T16:40:21Z"
merged_at: "2026-05-27T16:41:46Z"
closed_at: "2026-05-27T16:41:46Z"
head_ref: "backlog/force-push-policy-tfeedback-sum-type-extension-2026-05-27"
base_ref: "main"
archived_at: "2026-05-27T16:45:27Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5507: docs(rule): force-push-policy follow-on — Java-checked-exceptions-as-sum-type TFeedback discipline (Aaron 2026-05-27)

## PR description

## Summary

Follow-on to PR #5505 (merged 16:38Z). Operator's Java-checked-
exceptions-as-sum-type framing landed too late to make the original
PR; lands here as composable extension to the merged rule.

Operator's substrate-engineering insight:

> *\"it also give a nice kind of monad like if the function could declar
> every tfeedback type like java exceptions in the type signature then
> you can make sure consumer handle every case or pass it up\"*

Completes the rule's 4-layer substrate:

- Layer 1: assumption-validation (merged in #5505)
- Layer 2: exceptions-as-signals (merged in #5505)
- Layer 3: Result<T, TFeedback> wrapping (merged in #5505)
- **Layer 4 (this PR)**: TFeedback as sum-type with exhaustive-match
  enforcement (Java-checked-exceptions discipline ergonomic via F#
  sum-types + monadic composition)

8-row comparison table; F# canonical instantiation with concrete
code; why-monadic-like framing; composition with F# Result/Option/
Async monad substrate; 6-step operational discipline.

## Test plan

- [x] Markdownlint clean (no MD004 leading-+ / no MD024 dup headings)
- [x] All backtick paths on single lines (lint MD032 compliance)
- [ ] CI passes (auto-merge to fire on green)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-27T16:40:26Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
