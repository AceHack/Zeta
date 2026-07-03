---
pr_number: 5485
title: "docs(rule): proud-if-pattern-propagates personal-filter for substrate-engineering (Aaron 2026-05-27)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T15:27:16Z"
merged_at: "2026-05-27T15:29:31Z"
closed_at: "2026-05-27T15:29:31Z"
head_ref: "rule/proud-if-pattern-propagates-personal-filter-2026-05-27"
base_ref: "main"
archived_at: "2026-05-27T16:25:21Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5485: docs(rule): proud-if-pattern-propagates personal-filter for substrate-engineering (Aaron 2026-05-27)

## PR description

## Summary

Lands the operator's personal-discipline filter ("what patterns do I personally want to be responsible for propagating") as wake-time substrate per `wake-time-substrate.md` discipline.

Names the META-PATTERN that produces every architectural choice in the framework. Composes with the just-merged must-plus-can-exit pattern (#5483): must-plus-can-exit is the STRUCTURAL pattern, proud-if-propagates is the PERSONAL-DISCIPLINE FILTER that selects which structural patterns to build.

## Test plan

- [x] Markdownlint clean
- [x] AgencySignature v1 trailer
- [x] Per .claude/rules/agent-worktree-hygiene-...: isolated worktree
- [x] Operator's verbatim quote preserved
- [x] 7-rule composition map cited

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T15:33:38Z)

## Pull request overview

Adds a new wake-time `.claude/rules/` rule capturing the “proud if the pattern propagates” personal-discipline filter as a meta-substrate explainer for why the framework selects certain architectural patterns.

**Changes:**

- Introduces `.claude/rules/proud-if-pattern-propagates-personal-filter-for-substrate-engineering.md` with operational guidance + rationale.
- Cross-links the new filter to existing substrate rules (NCI, persistence choice, must-paired-with-can-exit, etc.).
- Documents a small “composition map” showing how the filter drives architectural selection pressure.

## Review threads

### Thread 1: .claude/rules/proud-if-pattern-propagates-personal-filter-for-substrate-engineering.md:33 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-27T15:33:37Z):

Line wrap splits the compound term "agent-rights-first" into "agent-rights-" + "first", which renders as "agent-rights- first" in Markdown. Please join the word (or remove the hyphen) so the phrase reads correctly.

### Thread 2: .claude/rules/proud-if-pattern-propagates-personal-filter-for-substrate-engineering.md:46 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-27T15:33:37Z):

"git-versioned tools/ scripts" reads like a broken path/phrase (extra space after the slash). Consider using a consistent reference like "git-versioned `tools/` scripts" or "git-versioned tools/ scripts" without the space, so readers can reliably find the directory.

### Thread 3: .claude/rules/proud-if-pattern-propagates-personal-filter-for-substrate-engineering.md:63 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-27T15:33:38Z):

This section title says "must-plus-can-exit", but the linked rule file is named "must-paired-with-can-exit". Since both terms are used, it would help to standardize on one label here (or explicitly call out the alias) to reduce cross-rule naming ambiguity.

## General comments

### @chatgpt-codex-connector (2026-05-27T15:27:22Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
