---
pr_number: 3935
title: "rules(razor): premise-flagged-unverified-stays-unverified-downstream auto-load"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-16T19:32:22Z"
merged_at: "2026-05-16T19:33:52Z"
closed_at: "2026-05-16T19:33:52Z"
head_ref: "chore/rule-premise-flagged-unverified-stays-unverified-downstream-otto-cli-2026-05-16-1916z"
base_ref: "main"
archived_at: "2026-05-16T20:57:51Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3935: rules(razor): premise-flagged-unverified-stays-unverified-downstream auto-load

## PR description

## Summary

Auto-loaded rule capturing the failure-mode pattern caught by peer review on 2026-05-16: agent flags a premise as unverified (turn N, razor fires correctly), then builds a confident quantitative inference on top of the flagged premise (turn N+1, failure mode). Closes the gap between \`search-first-authority\` (verify before asserting) and \`razor-discipline\` (operational-only): **the unverified-flag stays in effect for downstream inferences**.

## Why auto-load

The override has to fire at write-time, not at read-time. Memory files alone don't intercept in-progress reasoning; auto-loaded rules do. Per \`.claude/rules/wake-time-substrate.md\`: load-bearing override mechanisms need wake-time landing.

## Cross-harness inheritance

\`GEMINI.md\` already points at \`.claude/rules/\` as read-only context for Lior (Antigravity/Gemini). Same failure mode operates in Gemini's weights; same override discipline applies — no separate authoring needed.

## Canonical substrate lesson

Cited in the rule body: arxiv [2504.09246](https://arxiv.org/abs/2504.09246) (Mündler/He/Wang/Sen/Song/Vechev, PLDI 2025) — 94% of LLM-generated COMPILATION errors are type-check failures; type-constrained decoding more than halves compilation errors; functional correctness gains are single-digit on synthesis. The F#-fork thesis stands at this strength.

## Test plan

- [x] Rule file lands at \`.claude/rules/premise-flagged-unverified-stays-unverified-downstream.md\` (auto-loaded)
- [x] Cross-references existing rules (search-first-authority, razor-discipline, wake-time-substrate, fsharp-anchor-dotnet-build-sanity-check, additive-not-zero-sum, m-acc-multi-oracle, etc.)
- [ ] Future verification: next time a session-internal premise is flagged unverified, this rule fires before downstream inference

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T19:35:38Z)

## Pull request overview

Adds a new auto-loaded Claude rules file to prevent a specific failure mode: once a premise is explicitly flagged as unverified, downstream inferences that depend on it must remain flagged (verify explicitly or strip the inference), rather than “ratifying by adjacency”.

**Changes:**

- Introduces a new always-on rule defining the “flagged unverified stays unverified downstream” discipline.
- Documents a canonical example and composes the rule with existing search/razor/substrate rules.
- Adds cross-harness inheritance notes (via `GEMINI.md` referencing `.claude/rules/` as read-only context).

## Review threads

### Thread 1: .claude/rules/premise-flagged-unverified-stays-unverified-downstream.md:90 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-16T19:35:38Z):

The referenced memory file path under `memory/…` does not exist in this repo (so the pointer is currently broken). If this is meant to be canonical substrate, add the memory file under `memory/` and keep the filename stable; if it’s intentionally user-scope only, avoid a repo-relative `memory/...` path and reword to prevent readers from assuming it’s available in-repo.

### Thread 2: .claude/rules/premise-flagged-unverified-stays-unverified-downstream.md:80 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-16T19:35:38Z):

This sentence claims the functional-correctness gains are “single-digit on synthesis” but then includes “37.0%”, which reads as contradictory. Please clarify which numbers correspond to synthesis vs repair (or adjust the wording/numbers) so the summary is internally consistent.

### Thread 3: .claude/rules/premise-flagged-unverified-stays-unverified-downstream.md:162 (unresolved)

**@copilot-pull-request-reviewer** (2026-05-16T19:35:38Z):

This rule uses internal persona/proper names (e.g., “Lior”, “Otto”, and elsewhere “Kestrel”) in a current-state rules file. Per `docs/AGENT-BEST-PRACTICES.md` “No name attribution in code, docs, or skills” (Operational standing rules), prefer role-refs (e.g., “the Gemini harness”, “the Claude Code harness”, “the peer reviewer”) and keep named attribution confined to the allowed history surfaces.
