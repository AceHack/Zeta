---
pr_number: 5511
title: "docs(rule): land monad-propagation-pattern-cross-language-substrate-shape rule (Aaron 2026-05-27)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T16:49:54Z"
merged_at: "2026-05-27T16:59:39Z"
closed_at: "2026-05-27T16:59:39Z"
head_ref: "backlog/monad-propagation-pattern-cross-language-substrate-shape-2026-05-27"
base_ref: "main"
archived_at: "2026-05-27T19:20:49Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5511: docs(rule): land monad-propagation-pattern-cross-language-substrate-shape rule (Aaron 2026-05-27)

## PR description

## Summary

Operator-directed substrate-landing of the monad-propagation pattern
identified through the 2026-05-27 substrate-engineering thread that
produced PR #5505 + #5507:

> *\"we should save that modan propatation pattern we can generate
> code from specs easlier in the future if we build around these
> patterns our code becomes more similar shapped across languages.
> and we have some amount of composiblity in what's ususaly not
> composable like recursive CTE composiblity.\"*

## Three-component pattern

1. **Discriminator-carrier** — existing primitive (sum-type / NULL /
   sentinel / enum)
2. **Lazy-propagation via composition primitive** — Result.bind /
   recursive CTE UNION ALL / ? operator / Promise.then / monadic do
3. **Consumer must handle exhaustively or propagate** — compile-time
   match-warning / lint discipline / CHECK constraint / sealed-type /
   explicit early-return

## What the rule adds

- 10-row cross-language instantiation table (F# / Rust / TypeScript /
  T-SQL / Postgres / C# / Java / C++ / Go / Python)
- 3-section operational benefits analysis: spec-to-code generation +
  cross-language similarity + composability-where-usually-missing
- SQL recursive CTE composability example via feedback_type column
  flowing through CTE chains
- Composition with 6 substrate elements + 8 framework rules
- 6-step authoring discipline + 3-step review discipline
- Substrate-honest framing

## Test plan

- [x] Markdownlint clean (no MD004 leading-+ continuations)
- [x] No MD024 duplicate-heading issues
- [x] All backtick paths on single lines
- [ ] CI passes (auto-merge to fire on green)

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T16:55:14Z)

## Pull request overview

This PR adds an always-on Claude rule documenting a cross-language “monad-propagation” substrate pattern for uniform feedback/error propagation across languages and SQL recursive CTEs.

**Changes:**

- Adds a new `.claude/rules/` rule defining the three-part pattern.
- Provides cross-language instantiation examples and operational benefits.
- Connects the rule to related framework rules and substrate concepts.

## Review threads

### Thread 1: .claude/rules/monad-propagation-pattern-cross-language-substrate-shape.md:7 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T16:55:13Z):

This wrapped blockquote line starts with `+`, which Markdown treats as a list marker rather than prose. Reword it (for example, use “and consumer…” or move the plus to the previous line) so the carved sentence renders as one sentence and follows the repo’s no-leading-`+` continuation convention.

### Thread 2: .claude/rules/monad-propagation-pattern-cross-language-substrate-shape.md:155 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T16:55:14Z):

This claims the new substrate was identified through grep, but the rule body does not include the required inline substrate-inventory audit trail from `verify-existing-substrate-before-authoring.md` (what was searched, top hits, and conclusion). Add that audit trail and include the existing SQL NULL/Maybe recursive-CTE substrate hits such as 081KSGS9H0008QG0R0031PBNGA and `docs/research/zeta-sql-null-maybe-recursive-cte-generate-join.md`, which cover the same monad/recursive-CTE pattern.

## General comments

### @chatgpt-codex-connector (2026-05-27T16:50:01Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
