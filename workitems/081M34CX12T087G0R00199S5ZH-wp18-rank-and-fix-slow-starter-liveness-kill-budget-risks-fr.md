---
id: 081M34CX12T087G0R00199S5ZH
type: task
state: in-progress
priority: P2
slug: wp18-rank-and-fix-slow-starter-liveness-kill-budget-risks-fr
title: "WP18: rank and fix slow-starter liveness kill-budget risks from the WP15 catalog audit"
created: 2026-09-22T11:09:32.634Z
depends_on: []
composes_with: []
---

# WP18: rank and fix slow-starter liveness kill-budget risks from the WP15 catalog audit

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M34CX12T087G0R00199S5ZH-*.md` glob. -->

## Origin

Follow-on to WP15 (`081M348VYZ1087G0R0002GQM11`, merged as #17516), which grandfathered
44 containers into `KILL_BUDGET_ALLOWLIST` (tracked by
`081M348H97G087G0R0020EA0NY`) rather than fixing them without evidence.

## What this WP did

Ranked the 44 against real evidence instead of guessing:

1. Extracted per-container restart counts / CRASHLOOP events from 5 recent
   `k8s-argocd-health-test.yml` "live kind included" runs (35713533700,
   35709838861, 35707656488, 35703810167, 35703051689) and one
   `first-boot-replica.yml` run (35700790207).
2. Fixed 17 containers: 5 with direct CI restart evidence (keda x3,
   argo-rollouts, kube-state-metrics, orleans-silo, spire-controller-manager --
   the last one turned out to have no fixable coordinate) plus 12 more in the
   known-slow-starter (JVM/DB/migration) category with a values coordinate
   (cockroachdb, loki x3, mimir-overrides-exporter, gitlab's
   postgresql/redis/gitlab-shell/registry/gitlab-runner).
3. Left 27 allowlisted with sharpened, evidence-backed reasons: 5 confirmed to
   have zero values coordinate (hardcoded probe timing -- upstream chart PR
   only), 22 re-classified (c) fast controller/binary, not observed restarting
   in the 6 CI runs examined.

PR: #17524 (branch `claude/slow-starter-liveness-budgets`).

See `src/Core.TypeScript/cluster/liveness-kill-budget.ts`'s
`KILL_BUDGET_ALLOWLIST` for the current state of the remaining 27 entries and
their reasons.
