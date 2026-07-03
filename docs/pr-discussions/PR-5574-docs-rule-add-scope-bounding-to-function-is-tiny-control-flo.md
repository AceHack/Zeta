---
pr_number: 5574
title: "docs(rule): add scope-bounding to function-is-tiny-control-flow-generator rule \u2014 closedness matters more than purity (operator 2026-05-27)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T18:10:55Z"
merged_at: "2026-05-27T18:13:07Z"
closed_at: "2026-05-27T18:13:07Z"
head_ref: "backlog/function-control-flow-generator-rule-add-closedness-scope-bounding-2026-05-27"
base_ref: "main"
archived_at: "2026-05-27T18:51:26Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5574: docs(rule): add scope-bounding to function-is-tiny-control-flow-generator rule — closedness matters more than purity (operator 2026-05-27)

## PR description

## Summary

Operator-directed scope-bounding extension to the function-is-tiny-
control-flow-generator + OCP rule (PR #5523 landed).

> *\"mathematicaly closed pure functions don't need NCI cause they
> don't have side effects / control flow needs\"*

Sharpened with the critical insight:

> *\"even in memtics control flow can bleed out across conversations
> so even two ephemeral llms communicating over memory channels in
> process still need control flow cause they are pure but not closed
> the meme control flows bleed out\"*

## What this adds

3-class taxonomy as scope-decision discipline:

| Class | NCI/TFeedback applies? |
|---|---|
| **Pure AND closed** (`add`, `sin`, `compose`, `List.length`) | NO — exempt; would be overhead |
| **Pure but NOT closed** (LLM-conversation-turns; functions whose output bleeds into memetic substrate) | YES — meme-propagation IS control-flow vector |
| **Impure / effectful** (file IO, network, mutation) | YES — full discipline |

Plus worked F# examples per class, 4-step scope-decision operational discipline, composition with tonal-momentum-equals-meme + NCI HC-8 + glass-halo + m/acc multi-oracle.

Prevents the discipline from becoming over-applied attractor that converts every function into Result-wrapper-ceremony.

## Test plan

- [x] Markdownlint clean
- [x] Composes with PR #5523 rule (extension; preserves prior content)
- [x] Composes with tonal-momentum-equals-meme substrate
- [ ] CI passes (auto-merge to fire on green)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T18:13:39Z)

## Pull request overview

Extends the existing `.claude/rules/function-is-tiny-control-flow-generator-ocp-applied-to-control-flow.md` rule with a scope-bounding refinement: the Result/TFeedback/NCI discipline is exempt for *pure-and-closed* functions, but still applies to *pure-but-not-closed* functions where outputs propagate into memetic/conversational substrate.

**Changes:**

- Adds a “pure & closed / pure but not closed / impure” taxonomy to decide when Result<T, TFeedback> applies.
- Adds worked F# examples for each class plus a 4-step operational decision procedure.
- Adds explicit composition links to related rules (tonal-momentum, NCI, glass-halo, m/acc).

## Review threads

### Thread 1: .claude/rules/function-is-tiny-control-flow-generator-ocp-applied-to-control-flow.md:176 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-27T18:13:38Z):

The “Pure AND closed” examples include higher-order functions (`map`, `compose`) whose purity/closedness in F# depends on the supplied functions (`f`, `g`). As written this reads as if `List.map`/`compose` are always pure/closed, which isn’t true when `f`/`g` capture mutation, do IO, etc. Consider qualifying these examples (e.g., “when f/g are pure+closed”) or replacing with examples that are unconditionally pure+closed in F#.

### Thread 2: .claude/rules/function-is-tiny-control-flow-generator-ocp-applied-to-control-flow.md:150 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-27T18:13:38Z):

This row mentions an “empty discriminated-union (never type)” as the hypothetical `TFeedback`. F# doesn’t support a true empty DU, and the repo doesn’t appear to define a standard `Never`/uninhabited type, so this may be confusing or misleading. Suggest rephrasing to something implementable/idiomatic (e.g., “no meaningful feedback channel; wrapping in Result would be overhead”).

## General comments

### @chatgpt-codex-connector (2026-05-27T18:11:00Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
