---
pr_number: 5579
title: "docs(rule): four-corner ownership extension to asymmetric-authorship \u2014 stream/observable context co-owned TInFeedback (operator 2026-05-27 scope-bounded)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T18:23:51Z"
merged_at: "2026-05-27T18:25:16Z"
closed_at: "2026-05-27T18:25:16Z"
head_ref: "backlog/asymmetric-authorship-stream-observable-four-corner-coowned-tinfeedback-2026-05-27"
base_ref: "main"
archived_at: "2026-05-27T18:57:46Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5579: docs(rule): four-corner ownership extension to asymmetric-authorship — stream/observable context co-owned TInFeedback (operator 2026-05-27 scope-bounded)

## PR description

## Summary

Operator-directed substrate-engineering extension with explicit
scope-bounding:

> *\"Result<TResult, TOutFeedback> x(Input<TInput, TInFeedback> y) is
> also important for like streams here is the ownership model.
> TResult TInput owned by caller, TOutFeedback owned by function,
> TInFeedback coowned.\"*

> *\"i think it matters more for streams maybe not a hard shape/rule
> except when a function gets involved in a stream/observable at
> this point.\"*

## What lands

- 4-row ownership table (TInput / TResult / TOutFeedback / TInFeedback)
- CO-OWNED TInFeedback as structurally new substrate (collaborative
  not asymmetric)
- Operator-bounded scope: applies ONLY when function in stream/
  observable context; does NOT apply universally
- F# StreamInFeedback example with consumer-authored + producer-
  authored variants
- Composition with iterator/generator-asymmetry + monad-propagation +
  OPLE-T-TFeedback + scope-bounding rule

Extension to existing rule body (does NOT replace main 10-row
instantiation table). Two distinct patterns coexist: single-channel-
author (main rule) + stream/observable four-corner co-ownership
(this extension).

## Test plan

- [x] Markdownlint clean
- [x] Composes with PR #5516 main rule body
- [x] Operator scope-bounding clearly stated
- [ ] CI passes (auto-merge to fire on green)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-27T18:23:56Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
