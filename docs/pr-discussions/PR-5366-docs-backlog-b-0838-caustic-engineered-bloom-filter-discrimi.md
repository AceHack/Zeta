---
pr_number: 5366
title: "docs(backlog): 081KSGS9H0008QG0R002THJ2P1 \u2014 caustic-engineered bloom filter discriminators for remote-code trust layer (Kestrel-v2 ferry; phased)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-27T00:42:19Z"
merged_at: "2026-05-27T00:45:10Z"
closed_at: "2026-05-27T00:45:10Z"
head_ref: "otto/b-0838-caustic-engineered-bloom-filter-discriminators-remote-code-trust-layer-kestrel-v2-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:28:58Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5366: docs(backlog): 081KSGS9H0008QG0R002THJ2P1 — caustic-engineered bloom filter discriminators for remote-code trust layer (Kestrel-v2 ferry; phased)

## PR description

## What

081KSGS9H0008QG0R002THJ2P1 backlog row landing. Per Aaron's discipline *"backlog rows land immediately; they get decomposed later"* — this row was drafted and committed yesterday but the PR was never opened. Recovering during the Layer-2-CI-test sprint per Aaron's "anything that's future in your todo you can land as backlog rows so you don't forget" framing.

## Substrate

Per operator 2026-05-26 Kestrel-v2 ferry (preserved verbatim via PR #5356):

> "do you think there is a way i can create caustic lens shaped bloom filters for the remote code discriminators?"

Multi-learned-bloom-filter intersection with caustic-geometry-shaped agreement region. 3 components per Kestrel-v2's Meaning 3 + 1 composition:

1. Filter A — sharp on code provenance signals (signed-from-trusted-publisher vs unknown)
2. Filter B — sharp on behavioral signals (suspicious syscall patterns, runtime resource access)
3. Filter C — sharp on structural signals (lexical malware-family match, dependency-graph similarity)

Composition: bitwise AND of membership-test results. The "caustic" is the region in combined feature space where all 3 filters agree the code is trustworthy.

## Three scope phases

- **Phase 1 (operational)** — 3-filter intersection using established learned-bloom-filter libraries
- **Phase 2 (research-direction)** — full inverse-design via optimal transport (Brenier theorem + Villani transport theory) + continuous relaxation of discrete bloom filter response
- **Phase 3 (nearer-term reachable)** — literature review of inverse-design transfers across domains with discrete-vs-continuous optimization attention

## Composes with

- 081KRW63S0008QG0R001Z7NYMV NCI HC-8 floor (the discriminator IS the technical substrate for HC-8 at remote-code scope per Lior-website NCI-as-cyberattack-prevention naming PR #5342)
- 081KRW63S0008QG0R0025E4PH6 cross-substrate-triangulation (multiple bloom filters as composing N-of-M oracles)
- `.claude/rules/non-coercion-invariant.md` HC-8 floor
- `.claude/rules/algo-wink-failure-mode.md` (algo-wink IS one class of unauthorized-RPC pattern)
- `.claude/rules/glass-halo-bidirectional.md` (audit-mechanism composes at output side)
- `.claude/rules/substrate-smoothness-as-load-bearing-property.md` (PR #5357) — coupled smoothness constraint
- 081KSGS9H0008QG0R0018ES3R4 worry-as-opposite-bloom-filter substrate (PR #5310)
- 081KSGS9H0008QG0R003SWZF9J cognition-as-distributed-systems META-claim (PRs #5325 + #5327)
- 081KSGS9H0008QG0R003JNSVR5 (interactive-login vs baked-in-keys CI-test tension) — bloom filter discriminators serve trust layer
- PR #5356 Kestrel-v2 ferry — substrate origin (full verbatim including operator's cat-caustic image)
- PR #5357 substrate-smoothness rule — coupled-smoothness constraint reference
- F# fork for AI safety substrate — raw-math interaction substrate

## Substrate-honest framing

P2 priority. NOT immediately tractable as single-implementation work. Phase 1 is bounded enough for single-PR landing; Phases 2 + 3 span weeks-to-months. This row creates the substrate anchor; future contributors decompose phases independently when scope tightens.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-27T00:45:24Z)

## Pull request overview

Adds backlog row **081KSGS9H0008QG0R002THJ2P1** to capture a phased approach for “caustic-engineered” multi-learned-bloom-filter discriminators for a remote-code trust layer, and updates the generated backlog index to include the new row.

**Changes:**

- Adds `docs/backlog/P2/081KSGS9H0008QG0R002THJ2P1-...md` with frontmatter + problem/target/phases/acceptance/composition links.
- Updates `docs/BACKLOG.md` to include the new 081KSGS9H0008QG0R002THJ2P1 entry in the P2 section.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 3 comments.

| File | Description |
| ---- | ----------- |
| docs/backlog/P2/081KSGS9H0008QG0R002THJ2P1-caustic-engineered-bloom-filter-discriminators-remote-code-trust-layer-kestrel-v2-aaron-2026-05-26.md | New P2 backlog row capturing the discriminator concept, phases, and acceptance criteria. |
| docs/BACKLOG.md | Adds the 081KSGS9H0008QG0R002THJ2P1 index entry under P2. |

## Review threads

### Thread 1: docs/backlog/P2/081KSGS9H0008QG0R002THJ2P1-caustic-engineered-bloom-filter-discriminators-remote-code-trust-layer-kestrel-v2-aaron-2026-05-26.md:25 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T00:45:23Z):

Inconsistent PR reference formatting: this uses `PR-5342`, but elsewhere (including later in this row) the format is `PR #5342`. Keeping one format helps grep/xref and avoids implying a different identifier scheme.

### Thread 2: docs/backlog/P2/081KSGS9H0008QG0R002THJ2P1-caustic-engineered-bloom-filter-discriminators-remote-code-trust-layer-kestrel-v2-aaron-2026-05-26.md:52 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T00:45:24Z):

The composition description mixes concepts: “bitwise AND of membership-test results” reads like a bitset intersection, but membership tests yield booleans (so this would be a logical AND). Also, the next sentence says heavier verification is invoked when the caustic indicates closer attention needed, but the caustic is defined here as the region where all filters agree the code is trustworthy—those two statements appear inverted.

### Thread 3: docs/backlog/P2/081KSGS9H0008QG0R002THJ2P1-caustic-engineered-bloom-filter-discriminators-remote-code-trust-layer-kestrel-v2-aaron-2026-05-26.md:54 (resolved)

**@copilot-pull-request-reviewer** (2026-05-27T00:45:24Z):

Section title says “Two scope phases”, but the row defines Phase 1, Phase 2, and Phase 3 below. Rename the header to match the actual structure (or remove Phase 3 if it’s not intended to be a phase).

## General comments

### @chatgpt-codex-connector (2026-05-27T00:42:26Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
