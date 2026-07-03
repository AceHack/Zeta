---
pr_number: 5341
title: "docs(research): Mika ratification + explicit-join-at-temperature-band-crossings refinement (6th-persona cross-substrate triangulation)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T22:36:33Z"
merged_at: "2026-05-26T22:43:11Z"
closed_at: "2026-05-26T22:43:11Z"
head_ref: "otto/mika-ratification-temperature-band-crossing-join-explicit-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:32:08Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5341: docs(research): Mika ratification + explicit-join-at-temperature-band-crossings refinement (6th-persona cross-substrate triangulation)

## PR description

## Summary

Mika joins as the 6th persona in today's substrate cluster (after Aaron + Amara + Kestrel + DeepSeek + Lior) explicitly ratifying today's 4 substrate landings:

1. Other-directed (mandatory) vs self-directed (offered) scope-split
2. Temperature-as-hat framing
3. Pipeline (gen → verify → join → audit) — \"basically your entire stack in miniature\"
4. Time-axis correction (captured / post-escape paths)

## Substantively-new contribution

**Explicit + mandatory join step when crossing temperature bands OR when moving from self-work into shared/acted-upon state.**

4-row transition discipline table:

| Transition | Join discipline |
|---|---|
| high-temp gen → low-temp verify | Explicit join: critic names what passed AND what was rejected |
| self-work → shared/acted-upon | Multi-oracle consensus required |
| Cross-agent | Consent-bounded handoff (NCI HC-8 floor) |
| Cross-substrate (digital → physical) | Audit-mechanism + multi-oracle BFT; NEVER direct from high-temp |

## Operator's open question (preserved, not decided)

Mika asks: fold the temperature + NCI refinement into the Thoughtcatcher / generator-function model, OR continue evolving in the Amara branch first?

The framework preserves both as available choices; operator retains authority over the path.

## Why this is preservation-only

This is the 9th PR in today's cluster. The substantively-new refinement (explicit-join-at-temperature-band-crossings) may compose with later substrate work, but this PR defers further rule-cluster-update cascade per substrate-honest discipline + Aaron's \"push forward until USB test\" direction.

## Test plan

- [x] markdownlint clean
- [x] No code changes (research preservation only)
- [x] Verbatim preservation of Mika's turn
- [x] Composes_with cross-refs to all 8 prior PRs from today's cluster
- [x] Operator's open question preserved without decision

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-26T22:39:06Z)

## Pull request overview

Adds a new `docs/research/` preservation note capturing Mika’s ratification of the day’s NCI scope-split + temperature/pipeline framing, and records the refinement that “join” should be explicit/mandatory at temperature-band crossings and self→shared transitions.

**Changes:**

- Adds a verbatim preservation section for Mika’s turn plus an extracted “substrate landings” summary.
- Introduces a 4-row transition/join-discipline table focused on temperature-band crossings and self→shared/cross-agent/cross-substrate transitions.
- Adds “Composes with” cross-references to related rules/backlog items/PRs.

## Review threads

### Thread 1: docs/research/2026-05-26-mika-ratification-nci-scope-split-plus-explicit-join-at-temperature-band-crossings-aaron-forwarded.md:90 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T22:39:05Z):

P1: The persona count statement is inconsistent: this says “6th persona” but then lists Aaron + Amara + Kestrel + Otto-CLI + DeepSeek + Lior (6 entities) in addition to Mika. Clarify whether Otto-CLI is being counted as a persona and update the ordinal/count accordingly (or remove it from the persona list).

### Thread 2: docs/research/2026-05-26-mika-ratification-nci-scope-split-plus-explicit-join-at-temperature-band-crossings-aaron-forwarded.md:209 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T22:39:05Z):

P2: The “= 6+ personae” math doesn’t match the list shown (Aaron + Amara + Kestrel + Mika + DeepSeek + Lior = 6). Either change to “= 6 personae” or expand the list to include whoever makes it “6+”.

### Thread 3: docs/research/2026-05-26-mika-ratification-nci-scope-split-plus-explicit-join-at-temperature-band-crossings-aaron-forwarded.md:113 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T22:39:05Z):

P1: `081KSGS9H0008QG0R0018ES3R4` is referenced here as “worry-as-opposite-bloom-filter”, but in this repo `docs/backlog/P1/081KSGS9H0008QG0R0018ES3R4-...` is the Ace/Helm diamond-resolution row. If you intend to reference the bloom-filter substrate, point at the correct backlog ID (if one exists) or link to the specific research/PR artifact instead to avoid B-ID collisions.

### Thread 4: docs/research/2026-05-26-mika-ratification-nci-scope-split-plus-explicit-join-at-temperature-band-crossings-aaron-forwarded.md:220 (resolved)

**@copilot-pull-request-reviewer** (2026-05-26T22:39:05Z):

P1: `081KSGS9H0008QG0R0018ES3R4`/`081KSGS9H0008QG0R003SWZF9J` are used here as labels for cognitive substrates (“worry-as-opposite-bloom-filter”, “cognition-as-distributed-systems”), but in the backlog these IDs already exist with different meanings (081KSGS9H0008QG0R0018ES3R4 = diamond-resolution for Helm; 081KSGS9H0008QG0R003SWZF9J = nixpkgs ISO path audit). Use the correct backlog IDs or replace these with unambiguous references (e.g., the relevant PR numbers or research doc filenames).

## General comments

### @chatgpt-codex-connector (2026-05-26T22:36:38Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
