---
pr_number: 4765
title: "backlog(081KS923C0008QG0R0032VJZPF): Soraya round-42 hand-off \u2014 register 11 unregistered formal-verification specs"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-23T20:54:09Z"
merged_at: "2026-05-23T20:55:24Z"
closed_at: "2026-05-23T20:55:24Z"
head_ref: "otto/b0709-soraya-kenji-handoff-registry-coverage-2026-05-23"
base_ref: "main"
archived_at: "2026-05-23T21:00:59Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #4765: backlog(081KS923C0008QG0R0032VJZPF): Soraya round-42 hand-off — register 11 unregistered formal-verification specs

## PR description

## Summary

Files Soraya's first-tick hand-off-to-Kenji as backlog row **081KS923C0008QG0R0032VJZPF**.

Soraya's autonomous formal-verification routing loop started today (2026-05-23, 17-min cadence, session-only `faf5893d`). Her **first scan** surfaced a Class 0 drift gap at portfolio scale:

- `verification-registry.md` covers **7 artifacts**
- On-disk portfolio: **20** (17 TLA+/Lean + 3 Alloy)
- **11 unregistered** = Class 0 drift per the registry's own definition
- Coverage ratio dropped from 0.83 (round 21) → **0.52 (round 42)**

## The 11 unregistered specs

`InfoTheoreticSharder` (TLA+ + Alloy), `EngagementLiveness`, `BftConsensus`, `FeatureFlagsResolution`, `AsyncStreamEnumerator`, `ChaosEnvDeterminism`, `ConsistentHashRebalance`, `DictionaryStripedCAS`, `RecursiveCountingLFP`, `RecursiveSignedSemiNaive`, `ThreeColoring`.

## Soraya's routing decision

**Use `verification-drift-auditor` skill** (already exists; under-utilized). NOT new TLA+. She explicitly named + rejected the TLA+-hammer trap: "RecursiveSignedSemiNaive's Z3 cross-check for S2 is unfilled per the notebook" tempting, but Round-42 single-property target; meta-surface fix first.

## Effort + assignee

M (one evening). Assignee: **kenji** (routes to original spec owners or `verification-drift-auditor` under backfill pass).

## Commit details

Landed via git plumbing (4th plumbing-fallback PR this session — sibling pattern to PR #4755 / #4761 / #4762). Dotgit saturation 539+ procs throughout.

## Test plan

- [x] Backlog row written with §33-compliant frontmatter + acceptance criteria
- [x] All 11 specs named explicitly
- [x] Soraya's TLA+-hammer guard preserved for future-Kenji context
- [x] Composes-with refs point at real files (verification-drift-auditor skill, verification-registry.md, proof-tool-coverage.md, soraya NOTEBOOK)
- [ ] CI green
- [ ] Auto-merge fires

## Reviews

### COMMENTED — @chatgpt-codex-connector (2026-05-23T20:56:52Z)


### 💡 Codex Review

Here are some automated review suggestions for this pull request.

**Reviewed commit:** `a4fe5303cc`


<details> <summary>ℹ️ About Codex in GitHub</summary>
<br/>

[Your team has set up Codex to review pull requests in this repo](https://chatgpt.com/codex/cloud/settings/general). Reviews are triggered when you
- Open a pull request for review
- Mark a draft as ready
- Comment "@codex review".

If Codex has suggestions, it will comment; otherwise it will react with 👍.


Codex can also answer questions or update the PR. Try commenting "@codex address that feedback".

</details>

## Review threads

### Thread 1: docs/backlog/P2/081KS923C0008QG0R0032VJZPF-soraya-registry-coverage-drift-register-11-unregistered-specs-2026-05-23.md:50 (unresolved)

**@chatgpt-codex-connector** (2026-05-23T20:56:52Z):

**<sub><sub>![P1 Badge](https://img.shields.io/badge/P1-orange?style=flat)</sub></sub>  Expand backlog scope to all unregistered artifacts**

This task hard-codes a target of only 11 registry rows, but the repo currently has additional unregistered verification artifacts (`DbspSpec`, `SpineAsyncProtocol`, `CircuitRegistration`, `SpineMergeInvariants`, and `Spine.als`) that are also absent from `docs/research/verification-registry.md`; completing this backlog item as written will therefore leave Class 0 drift unresolved while claiming the meta-surface was fixed.

Useful? React with 👍 / 👎.
