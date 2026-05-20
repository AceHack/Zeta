---
id: B-0676
status: open
priority: P2
title: B-0620 slice 4 consolidator script
created: 2026-05-20
last_updated: 2026-05-20
type: feature
---

# B-0676: B-0620 slice 4 consolidator script

## Scope

Implement the central consolidator script (`tools/inventory/consolidate.ts`) that merges outputs from N different vendor adapters into a single unified inventory file. This slice creates the `tools/inventory/` directory if it does not already exist; `tools/inventory/consolidate.ts` is the planned entrypoint. This preserves the B-0620 slice 4 decomposition while using a numeric backlog id compatible with autonomous claim bootstrap tooling.

## Output categories

The unified inventory file must preserve the three-category financial substrate split:

- Revenue-generating: inventory tied to deployed or revenue-facing work.
- R&D-gift: inventory deliberately assigned to research, prototyping, or gifted exploration.
- Pending: inventory awaiting classification, reconciliation, or operator decision.

## Acceptance

- [ ] Implement a script that reads from all active vendor adapters.
- [ ] Handle deduplication across vendors (e.g., identical product purchased from two vendors).
- [ ] Output a single committable hardware inventory substrate that preserves the revenue-generating / R&D-gift / pending category split.
