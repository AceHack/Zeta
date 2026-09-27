---
id: 081M3JG3PG5087G0R00368503Y
type: bug
state: backlog
priority: P2
slug: metal-install-never-creates-temporal-default-store-temporal
title: "Metal install never creates temporal-default-store / temporal-visibility-store; temporal pods CreateContainerConfigError"
created: 2026-09-27T22:34:58.949Z
depends_on: []
composes_with: []
---

# Metal install never creates temporal-default-store / temporal-visibility-store; temporal pods CreateContainerConfigError

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3JG3PG5087G0R00368503Y-*.md` glob. -->

## Evidence (live, read-only, node-5b2dfa USB install, 2026-09-27)

ArgoCD `temporal` Synced/Degraded; frontend/history/matching/worker and the
`temporal-schema-1` init all `CreateContainerConfigError: secret
"temporal-default-store" not found`. No ExternalSecret/SealedSecret in the cluster;
the other first-boot seeded Secrets (grafana, opensearch, redis-auth, ...) exist.

## Root cause

`temporal/Application.yaml` names `existingSecret: temporal-default-store` and
`temporal-visibility-store` (chart reads key `password`), and nothing on metal
produced either: `internal-secret-seeding.yaml` had no temporal step, and the two
existing Secret audits could not see it (dev-roster check acknowledges it as
dev-excluded; raw-manifest check never reads the seeding Jobs).

## Fix

- `seed-temporal-store` Job in `internal-secret-seeding.yaml`: one CSPRNG draw,
  two create-only Secrets (same SQL user `temporal`).
- `src/Core.TypeScript/cluster/metal-secret-production.ts` (+ test): every Secret
  the catalogue names must be seeded in the Application's namespace, committed as
  a Secret/SealedSecret/ExternalSecret, or exempted with a reason.

## Still open (not this item)

CockroachDB `temporal` SQL user carrying the seeded password, client TLS material
in the `temporal` namespace, and the CockroachDB-incompatible visibility schema --
the Application's own BLOCKED notes.
