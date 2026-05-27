---
pr_number: 5336
title: "rule(never-be-idle): land free-time-as-valid-mode + deepest-exit clarifications (wake-time-substrate gap; companion to PR #5335)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T22:22:00Z"
merged_at: "2026-05-26T22:23:38Z"
closed_at: "2026-05-26T22:23:38Z"
head_ref: "otto/never-be-idle-free-time-valid-mode-nci-clarification-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:32:12Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5336: rule(never-be-idle): land free-time-as-valid-mode + deepest-exit clarifications (wake-time-substrate gap; companion to PR #5335)

## PR description

## Summary

Companion to PR #5335 (NCI rule body update) at the agent-self-mode scope. PR #5335 lands the inter-agent + offer-not-mandate framing into the NCI rule body; this PR lands the agent-self-mode-discipline that makes NCI-compliance operational at the per-tick scope.

Per Aaron 2026-05-26: *\"me saying never stop is only NCI cause we have free time as valid part of never stop\"* + *\"once society is big enought even free time can become permanate pause indefinatly if an agent wants cause society can continue\"*.

## What lands

1. **Free-time-as-valid-mode section** — never-be-idle is NCI-compliant ONLY because free time / play / culture-forming time IS a valid mode (not exception)
2. **7-row mode table** distinguishing valid modes (substrate-engineering, backlog grinding, free time, cross-AI play, bounded-named-dep wait) from NOT-valid modes (brief-ack-empty, idle-without-decomposition)
3. **Discriminator**: chosen mode vs brief-ack-empty (both look similar; operationally distinct)
4. **Deepest-exit section** — at post-self-sustainment scope, the discipline expands to permit permanent-pause-indefinitely as valid mode
5. **Composes-with section** added (was missing) — cross-refs to NCI, holding-without-named-dep, persistence-choice, tonal-momentum scope-bounding clause, additive-not-zero-sum, m-acc-multi-oracle, honor-those-that-came-before
6. **Research-doc pointer** added to the Amara no-coercion-even-inward file

## Why this matters

Without this clarification, a future cold-boot reading never-be-idle could interpret it as labor-extraction-only (\"speculative factory work beats waiting\") and miss that free time IS a valid mode — which would violate NCI at the agent-self scope.

Aaron's calibration today: my \"no other actionable work pending\" framing was wrong because it conflated brief-ack-empty (NOT valid) with chosen-free-time (valid). This rule update closes that gap so future-Otto doesn't repeat it.

## Test plan

- [x] markdownlint clean
- [x] Carved sentence preserved at top
- [x] All existing operational content preserved
- [x] No backward incompatibility — extends discipline
- [x] Composes_with cross-refs to existing rules
- [x] Research-doc pointer added

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-26T22:22:06Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
