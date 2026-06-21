---
pr_number: 5353
title: "docs(backlog): 081KSGS9H0008QG0R001VVEZQ9 \u2014 hardware-inventory-vs-cluster reconciliation + buying-decisions substrate (no more buying willy nilly)"
author: "AceHack"
state: "MERGED"
created_at: "2026-05-26T23:27:51Z"
merged_at: "2026-05-26T23:29:23Z"
closed_at: "2026-05-26T23:29:23Z"
head_ref: "otto/b-0836-hardware-inventory-vs-cluster-reconciliation-gap-analysis-buying-decisions-2026-05-26"
base_ref: "main"
archived_at: "2026-05-27T19:30:27Z"
archive_tool: "tools/pr-preservation/archive-pr.ts"
---

# PR #5353: docs(backlog): 081KSGS9H0008QG0R001VVEZQ9 — hardware-inventory-vs-cluster reconciliation + buying-decisions substrate (no more buying willy nilly)

## PR description

## Summary

Per operator 2026-05-26: \"we will also have an inventory for every machine and know if some are missing registration when she is done with her hardware inventory work. and know what and how we need to expand so we are not buying willy nilly anymore.\"

Combined with the architectural clarification: \"git for source of truth and coackroach can be repopulated from\".

## 4-phase decomposition

| Phase | Scope | Depends on |
|---|---|---|
| 1 | Addison's CSV → DuckDB ingestion | Immediate (doesn't need cluster) |
| 2 | tools/cluster/reconcile-inventory-vs-cluster.ts (3 gap types) | At least one 081KSGS9H0008QG0R0037H3W4T self-reg PR merged |
| 3 | CockroachDB ingestion from git source-of-truth | Cluster operational + CockroachDB deployed |
| 4 | tools/cluster/buying-recommendations.ts (closes the loop) | Phases 2+3 + workload metrics |

## 3 operational questions the reconciliation answers

| Question | Action |
|---|---|
| Missing registration? (in inventory; not in git cluster-nodes) | Either not deployed yet OR self-reg failed |
| Phantom node? (in git cluster-nodes; not in inventory) | Either stale inventory OR unknown machine registered |
| Expansion-buying-decision? | What hardware to buy — informed by data not guesswork |

## Architecture

```
Addison's inventory ──┐                    ┌── Reconciliation tool
(paper → scan → CSV   │                    │   (this row 081KSGS9H0008QG0R001VVEZQ9)
 → DuckDB → CRDB)     │                    │
                      ▼                    ▼
              GIT SOURCE OF TRUTH ──── Gap analysis
                      ▲                    │
                      │                    ▼
              081KSGS9H0008QG0R0037H3W4T iter-5.4.1     Buying decisions
              self-registration       (data-driven)
```

## Highest-value operator outcome

Shifts hardware-purchase decisions from \"guess what we need\" to \"data says we need N more of make/model X for workload Y.\" Materially affects operator cost-management.

## Test plan

- [x] markdownlint clean
- [x] BACKLOG.md regenerated
- [x] Composes_with 081KSGS9H0008QG0R0037H3W4T (cluster-side data source; PR #5352 in flight) + 081KSGS9H0008QG0R0027HJZYH + 081KSE6WT0008QG0R003CMCX84 + 081KSGS9H0008QG0R002T3BJ2R + Addison's inventory work

🤖 Generated with [Claude Code](https://claude.com/claude-code)

## General comments

### @chatgpt-codex-connector (2026-05-26T23:27:56Z)

You have reached your Codex usage limits for code reviews. You can see your limits in the [Codex usage dashboard](https://chatgpt.com/codex/cloud/settings/usage).
