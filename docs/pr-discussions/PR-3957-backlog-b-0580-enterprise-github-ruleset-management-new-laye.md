---
pr_number: 3957
title: "backlog(081KRQ1AB0008QG0R000522MPJ): Enterprise GitHub ruleset management \u2014 new layer above org/individual mapping"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-16T22:23:03Z"
merged_at: "2026-05-16T23:05:48Z"
closed_at: "2026-05-16T23:05:48Z"
head_ref: "backlog/b-0580-enterprise-ruleset-management-2026-05-16"
base_ref: "main"
archived_at: "2026-05-16T23:20:33Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #3957: backlog(081KRQ1AB0008QG0R000522MPJ): Enterprise GitHub ruleset management — new layer above org/individual mapping

## PR description

## Summary

Files 081KRQ1AB0008QG0R000522MPJ — Enterprise GitHub ruleset management work-stream. Per Aaron 2026-05-16, after creating the first enterprise-level ruleset (#16490134) under the 30-day Enterprise trial: the Enterprise tier adds a THIRD ruleset layer above org + per-repo, multiplying the existing ruleset-divergence smell from 081KRFA460008QG0R000VKJF0H.

## Why

Two reframings:

1. **Surface expansion** — was 2 layers (org/individual), now 3 (enterprise/org/individual). Cross-layer rule conflicts become a real failure mode without coherent governance
2. **DV2.0 ruleset-divergence smell composes** per `dv2-data-split-discipline-activated.md` — the smell was known for repo-split (081KRFA460008QG0R000VKJF0H); Enterprise multiplies it

## 5-slice decomposition

- Slice 1: `tools/github/list-rulesets.ts` — REST enumeration at all 3 layers
- Slice 2: manual audit of #16490134 + any other enterprise rulesets + LFG org rulesets + Zeta repo rulesets
- Slice 3: `tools/github/audit-ruleset-divergence.ts` — cross-layer diff, flag conflicts
- Slice 4: `docs/governance/RULESETS.md` — authoritative policy doc (which rule belongs at which layer)
- Slice 5 (deferred): `tools/github/apply-rulesets.ts` — policy-as-code apply

## Composes with

- [081KRFA460008QG0R000VKJF0H](docs/backlog/) (repo-split axis 3 — Code/English with ruleset-divergence smell)
- [081KRQ1AB0008QG0R000GZEMCR](https://github.com/Lucent-Financial-Group/Zeta/pull/3952) (LFG GitHub tier decision — Enterprise trial that created the layer)
- `.claude/rules/dv2-data-split-discipline-activated.md` (the smell-detection framework)
- `.claude/rules/methodology-hard-limits.md` (rulesets ARE policy-as-code substrate for governance hard-limits)

## Caveat re scope

Enterprise-layer writes (slice 5) require `admin:enterprise` scope — current local PAT lacks it. Slices 1-4 work with `read:org` scope (which the current PAT has). Authoritative policy doc + tooling can land before any policy-as-code apply.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## Reviews

### COMMENTED — @copilot-pull-request-reviewer (2026-05-16T22:28:45Z)

## Pull request overview

> [!NOTE]
> Copilot was unable to run its full agentic suite in this review.

Adds a new P2 backlog entry (081KRQ1AB0008QG0R000522MPJ) tracking enterprise-level GitHub ruleset management as a third governance layer above existing org/individual rulesets, and registers it in the main backlog index.

**Changes:**

- New backlog doc 081KRQ1AB0008QG0R000522MPJ describing motivation, slices, acceptance criteria, and first-discovery findings for the new enterprise ruleset created (`16490134`).
- Adds 081KRQ1AB0008QG0R000522MPJ entry to `docs/BACKLOG.md` under P2.

### Reviewed changes

Copilot reviewed 2 out of 2 changed files in this pull request and generated 1 comment.

| File | Description |
| ---- | ----------- |
| docs/backlog/P2/081KRQ1AB0008QG0R000522MPJ-enterprise-ruleset-management-2026-05-16.md | New backlog row defining the 5-slice work-stream for enterprise ruleset governance. |
| docs/BACKLOG.md | Registers 081KRQ1AB0008QG0R000522MPJ in the P2 backlog list. |

### COMMENTED — @AceHack (2026-05-16T23:05:41Z)

_(no body)_

### COMMENTED — @AceHack (2026-05-16T23:11:50Z)

Maji Antigravity Check: Drift detected. Metadata churn / narration-over-action identified. Next step: peel one slice off this design row and execute it to restore parity and operational alignment.

## Review threads

### Thread 1: docs/backlog/P2/081KRQ1AB0008QG0R000522MPJ-enterprise-ruleset-management-2026-05-16.md:22 (resolved)

**@copilot-pull-request-reviewer** (2026-05-16T22:28:44Z):

The quote contains several misspellings ('enterpirse', 'ruleselt', 'managment', 'individiual'). Since this is presented as a verbatim quote from Aaron, it may be intentional to preserve fidelity; if so, consider adding a `[sic]` marker. Otherwise, correct the typos.

**@AceHack** (2026-05-16T23:05:41Z):

Verbatim preservation — Aaron-quotes are kept as-typed across the repo (no `[sic]`); the typos are the signal of authentic real-time capture. Project convention; see `.claude/rules/substrate-or-it-didnt-happen.md` verbatim-preservation trigger. Resolving no-op.
