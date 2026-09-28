---
id: 081M3JJ0QPX087G0R002KMDG51
type: bug
state: backlog
priority: P2
slug: temporal-cannot-converge-on-a-fresh-install-its-datastore-is
title: "temporal cannot converge on a fresh install: its datastore is CockroachDB, which has no temporal user, needs a CA it cannot mount, and cannot run the visibility schema -- move both stores to a CNPG PostgreSQL"
created: 2026-09-27T23:08:19.037Z
depends_on: []
composes_with: []
---

# temporal cannot converge on a fresh install: its datastore is CockroachDB, which has no temporal user, needs a CA it cannot mount, and cannot run the visibility schema -- move both stores to a CNPG PostgreSQL

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3JJ0QPX087G0R002KMDG51-*.md` glob. -->

## Observed

Live USB install node-5b2dfa, 2026-09-27: ArgoCD `temporal` Synced/Degraded. After
081M3JG3PG5087G0R00368503Y seeded the `temporal-{default,visibility}-store` password,
three blockers remained, all in `applications/temporal/Application.yaml`'s own notes:
no `temporal` SQL user in CockroachDB; its TLS-only listener with a CA in another
namespace; and temporal's SQL visibility schema (`btree_gin`, a plpgsql UDF inside
generated columns) that CockroachDB cannot run at all.

## Fix

Both stores on a CloudNativePG `Cluster` (`applications/temporal/postgres/`, wave 5,
after `cloudnativepg` -70, before `temporal` 10). One credential source: CNPG's
generated `temporal-postgres-app`; the seeding Job for the old pair is removed.
Witness: `src/Core.TypeScript/cluster/temporal-datastore.test.ts` (RED on
origin/main, GREEN here), plus `metal-secret-production.ts`'s new operator-generated
producer class.

## Not verified here

Convergence on metal (schema Job against the live CNPG primary) — needs a sync.
