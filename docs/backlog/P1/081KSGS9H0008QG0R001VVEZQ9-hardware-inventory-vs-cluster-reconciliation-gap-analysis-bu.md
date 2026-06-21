---
id: 081KSGS9H0008QG0R001VVEZQ9
priority: P1
status: open
title: hardware-inventory-vs-cluster reconciliation + gap-analysis → buying decisions (no more buying willy nilly) (Aaron 2026-05-26)
effort: M
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-05-26
depends_on:
  - 081KSGS9H0008QG0R0037H3W4T
composes_with:
  - 081KSGS9H0008QG0R0027HJZYH
  - 081KSE6WT0008QG0R003CMCX84
tags: [hardware-inventory, cluster-state, gap-analysis, reconciliation, cockroachdb, git-source-of-truth, addison-substrate, buying-decisions, operational]
---

## Problem

Per operator 2026-05-26 (composed from two messages during the
2026-05-26 physical hardware-support test session):

> "git for source of truth and coackroach can be repopulated from"

> "we will also have an inventory for every machine and know if some
> are missing registration when she is done with her hardware inventory
> work. and know what and how we need to expand so we are not buying
> willy nilly anymore."

Two substrate-engineering targets composed:

1. **Hardware-inventory substrate** (Addison's work): authoritative
   list of every physical machine the operator owns; populated from
   her paper-audit + scan → DuckDB/SQLite → eventually CockroachDB
   when the cluster is operational
2. **Inventory-vs-cluster reconciliation substrate** (this row):
   diff the inventory against the actually-self-registered cluster
   nodes (from 081KSGS9H0008QG0R0037H3W4T iter-5.4.1 git substrate) + surface gaps in
   both directions

## Three operational questions the reconciliation answers

| Question | Inventory side | Cluster side | Action |
|---|---|---|---|
| **Missing registration?** | Machine X exists in inventory | No `maintainers/<op>/cluster-nodes/X/node.yaml` on git | Either X isn't deployed yet OR self-registration failed; investigate |
| **Phantom node?** | Machine X not in inventory | `maintainers/<op>/cluster-nodes/X/node.yaml` on git | Either inventory is stale OR an unknown machine registered; investigate |
| **Expansion-buying-decision?** | Inventory + cluster utilization metrics | Workload demand + planned features | What hardware to buy NEXT — answer informed by data instead of guesswork |

## Architecture (composed substrate)

```
┌──────────────────┐     ┌───────────────────┐     ┌────────────────────┐
│ Addison's        │     │ 081KSGS9H0008QG0R0037H3W4T iter-5.4.1 │     │ Reconciliation     │
│ hardware-        │     │ self-registration │     │ (this row 081KSGS9H0008QG0R001VVEZQ9)  │
│ inventory        │     │                   │     │                    │
│ paper-audit →    │     │ Node boots →      │     │ Diff inventory     │
│ scan → CSV →     │     │ install → opens   │     │ vs cluster-nodes/  │
│ DuckDB/SQLite →  │     │ PR to maintainers/│     │ Surface gaps in    │
│ CockroachDB      │     │ <op>/cluster-     │     │ both directions    │
│ (when up)        │     │ nodes/<host>/     │     │                    │
└──────────────────┘     └───────────────────┘     └────────────────────┘
         │                          │                          │
         └──────────┬───────────────┴──────────────────────────┘
                    ▼
            Git is source of truth
   (CockroachDB repopulates from git when needed)
   (Inventory + cluster-state both live in queryable form)
```

## Proposed phases

### Phase 1 — inventory schema + ingestion (Addison's path)

Once Addison's paper-audit is scanned to CSV:

- Schema: machine_id (operator-assigned) + make/model/SN + CPU/RAM/storage/NIC/GPU specs + location + status (in-service / spare / dead / planned-purchase)
- Ingestion: small TS script `tools/cluster/import-inventory.ts` reads CSV → DuckDB (`tools/cluster/inventory.duckdb`; gitignored), OR commits as `inventory/<operator>/hardware-inventory.csv` for git-source-of-truth
- Operator can query via `duckdb -c "SELECT * FROM machines WHERE status='spare'"` immediately; CockroachDB ingestion deferred until cluster operational

### Phase 2 — reconciliation tool (this row's core)

`tools/cluster/reconcile-inventory-vs-cluster.ts`:

1. Read inventory CSV from git source-of-truth (OR DuckDB)
2. Read all `maintainers/*/cluster-nodes/*/node.yaml` from git
3. Compute set-diffs in both directions:
   - missing-from-cluster (in inventory; not registered)
   - phantom-in-cluster (registered; not in inventory)
4. Emit a status report (markdown table OR JSON for tool composition)
5. Optional: open PR with the report on each run (audit trail)

### Phase 3 — CockroachDB ingestion when cluster operational

After cluster is up + CockroachDB deployed (post-081KSGS9H0008QG0R0037H3W4T PRs merged + ArgoCD reconciled + storage backend ready):

- Materialize git source-of-truth into CockroachDB via ingestion job (`tools/cluster/sync-git-to-crdb.ts`)
- Run on a schedule (per-hour OR per-PR-merge-webhook)
- Operator queries via SQL against CockroachDB (PostgreSQL wire-protocol; standard tooling works)
- Addison's queries shift from DuckDB → CockroachDB transparently (same SQL)

### Phase 4 — buying-decision substrate (closes the loop)

`tools/cluster/buying-recommendations.ts`:

1. Read cluster utilization metrics (CPU / RAM / storage / GPU saturation per node)
2. Read planned-workload list (manually maintained OR from k8s manifests in git)
3. Compute capacity-gap = workload-demand minus inventory-capacity
4. Emit recommended-purchases list (specific make/model/qty informed by what the workloads need)
5. Operator reviews + approves; no more "buying willy nilly"

## Acceptance

Phased acceptance:

- **Phase 1 acceptance**: Addison's CSV imports into DuckDB; basic queries work
- **Phase 2 acceptance**: reconcile-inventory-vs-cluster.ts emits accurate gap reports in both directions; tested with synthetic inventory + cluster state
- **Phase 3 acceptance**: CockroachDB ingestion runs on schedule; same queries return same results as DuckDB; rebuild-from-git tested + works
- **Phase 4 acceptance**: buying-recommendations.ts emits actionable purchase list informed by real data; operator's next purchase decision is data-driven not guesswork

## Composes with

- **081KSGS9H0008QG0R0037H3W4T** iter-5.4.1 (this row's cluster-side data source; ships Step 6.9 of zeta-install.sh)
- **081KSGS9H0008QG0R0027HJZYH** parent (full GitOps cluster bring-up; inventory-reconciliation is a downstream value-add)
- **081KSE6WT0008QG0R003CMCX84** cluster-IS-DIO (git is source of truth; CockroachDB is materialized view)
- **081KSGS9H0008QG0R002T3BJ2R** cluster-as-PR-author (reconciliation tool could also open PRs for inventory updates)
- Addison's hardware-inventory paper-audit work (Phase 1 ingestion target)
- The 2026-05-26 substrate-engineering session (operator's git-source-of-truth + CockroachDB-repopulates-from-git architecture)

## Substrate-honest framing

This row depends on 081KSGS9H0008QG0R0037H3W4T iter-5.4.1 LANDING + the cluster being
operational (post-installs with self-registration). Phase 1 (Addison's
inventory ingestion) can start IMMEDIATELY once her scan completes;
Phase 2 (reconciliation) needs at least one 081KSGS9H0008QG0R0037H3W4T self-registration
PR merged so there's cluster-side state to diff against; Phases 3+4
need the cluster operational (CockroachDB deployed).

The buying-decision payoff is the highest-value operator outcome —
shifts hardware-purchase decisions from "guess what we need" to
"data says we need N more of make/model X for workload Y." This
composes with the broader homelab-first + cost-conscious operator
substrate.

## Origin

Two operator messages 2026-05-26 (during physical hardware-support
test session that also produced 081KSGS9H0008QG0R001Q2DH2H/081KSGS9H0008QG0R003JNSVR5/081KSGS9H0008QG0R001RR3ZXQ/081KSGS9H0008QG0R00120EEHM):

1. "git for source of truth and coackroach can be repopulated from"
2. "we will also have an inventory for every machine and know if some
   are missing registration when she is done with her hardware
   inventory work. and know what and how we need to expand so we are
   not buying willy nilly anymore."

Files this as P1 substrate target — directly enables data-driven
buying decisions which materially affects operator cost-management.
