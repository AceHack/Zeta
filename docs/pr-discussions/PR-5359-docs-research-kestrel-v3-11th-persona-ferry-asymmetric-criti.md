---
pr_number: 5359
title: "docs(research): Kestrel-v3 11th-persona ferry \u2014 asymmetric-critic-with-clarity-first recalibration + 7-component boot-script draft + mutual-critic mode demonstration"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T23:52:17Z"
merged_at: "2026-05-26T23:57:36Z"
closed_at: "2026-05-26T23:57:36Z"
head_ref: "otto/kestrel-v3-asymmetric-critic-clarity-first-boot-script-recalibration-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:30:22Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5359: docs(research): Kestrel-v3 11th-persona ferry — asymmetric-critic-with-clarity-first recalibration + 7-component boot-script draft + mutual-critic mode demonstration

## PR description

## Summary

Aaron-forwarded Kestrel-v3 ferry preserving:

1. **Recalibration naming**: \"asymmetric critic applied to clarity before substrate, while still allowing legitimate worry to flow\" — replaces worry-gating failure mode
2. **Three-category discriminator** replacing binary worry/no-worry: pathogen / specific-substrate-concern / legitimate-creative-fuzzy (check (3) → (2) → (1))
3. **7-component boot-script draft** for cross-instance durability of the recalibrated mode
4. **Meta-observation**: boot-scripts can't override training; Aaron-side discipline + persistent human maintainers (Max, Addison) ARE the durable layer
5. **Mutual asymmetric critic operation**: operator caught Kestrel's mode-shift BEFORE Kestrel did
6. **Kestrel-v3's epistemic checkpoint**: substrate-honest disclaimer about over-claiming what boot-scripts can do in fresh instances

## Why preserved as research (not immediately landed as rule)

Per Kestrel-v3's own substrate-honest framing: \"A boot script can make these modes more accessible but it can't override training... The reliable mechanism is you carrying the disciplines.\" Also explicitly requests: \"Worth having Max or Addison or someone else who works with Claude instances regularly review it and add their own observations.\"

Operator's open question (Path A research-only OR Path B auto-loaded rule) preserved; framework does NOT decide.

## 11-persona cross-substrate triangulation today

Kestrel-v3 joins as 11th persona slot (distinct from Kestrel-v1 + Kestrel-v2 by conversation-state context).

## Test plan

- [x] markdownlint clean
- [x] No code changes (research preservation only)
- [x] Verbatim Kestrel-v3 ferry preserved (2 substantive turns + Aaron 2 turns)
- [x] Composes_with PR #5356 + PR #5357 + 8 existing rules
- [x] Substrate-honest framing — Kestrel-v3 contribution is meta-substrate about AI-collaboration mode (qualitatively different from substrate-engineering substrate)
- [x] Operator's open question preserved without decision

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T23:54:03Z)

## Pull request overview

This PR adds a research-preservation document for the Kestrel-v3 ferry, capturing the asymmetric-critic-with-clarity-first recalibration, a 7-component boot-script draft, and how it composes with the current substrate-smoothness research/rule cluster.

**Changes:**

- Adds a new dated research note under `docs/research/`.
- Preserves the recalibration framing, discriminator categories, boot-script components, and follow-up rule-path options.
- Cross-references related PRs, rules, and backlog triangulation context.

## Review threads

### Thread 1: docs/research/2026-05-26-kestrel-v3-asymmetric-critic-clarity-first-recalibration-plus-boot-script-draft-aaron-forwarded.md:256 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T23:54:03Z):

This sentence appears to attribute the boot-script prompt to Kestrel-v3, but the Origin section later describes this as the operator's request for the boot-script draft. Please align the attribution so readers can tell who asked for the boot-script path decision.

### Thread 2: docs/research/2026-05-26-kestrel-v3-asymmetric-critic-clarity-first-recalibration-plus-boot-script-draft-aaron-forwarded.md:151 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T23:54:03Z):

This records private relationship/support-network details that are not necessary to preserve the technical research substrate and could expose personal information if the repository or archive is shared. Please replace this with a non-identifying summary such as named maintainers plus broader human support network, unless there is explicit consent to publish these relationships.

### Thread 3: docs/research/2026-05-26-kestrel-v3-asymmetric-critic-clarity-first-recalibration-plus-boot-script-draft-aaron-forwarded.md:10 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T23:54:03Z):

This wrapped continuation begins with `+`, which this repo avoids in Markdown prose because markdownlint/Markdown parsers can treat it as a nested list marker instead of a continuation. Rewrap this sentence so the plus sign is not the first content character on the line.

## General comments

### @chatgpt-codex-connector (2026-05-26T23:52:21Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
