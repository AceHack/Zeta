---
id: 081M3V23VFX087G0R002WDSN8W
type: bug
state: backlog
priority: P2
slug: hindsight-s-bundled-postgres-password-is-the-chart-literal-h
title: "hindsight's bundled postgres password is the chart literal hindsight:hindsight and the chart offers no way to mint it (0.9.2 and 0.10.2)"
created: 2026-10-01T06:23:33.885Z
depends_on: []
composes_with: []
---

# hindsight's bundled postgres password is the chart literal hindsight:hindsight and the chart offers no way to mint it (0.9.2 and 0.10.2)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3V23VFX087G0R002WDSN8W-*.md` glob. -->

## The measurement (2026-10-01, `helm pull` + `helm template`, chart 0.9.2 and 0.10.2)

`postgresql.auth.password` defaults to the literal `hindsight`. It reaches the render in TWO
places, both literal, neither able to take a Secret reference:

- `templates/postgresql-statefulset.yaml:34` — `POSTGRES_PASSWORD` is `value: {{ ...auth.password | quote }}`.
- `templates/_helpers.tpl` `hindsight.databaseUrl` (bundled branch) —
  `postgresql://hindsight:hindsight@hindsight-postgresql:5432/hindsight`, set as the api, worker and
  control-plane `HINDSIGHT_API_DATABASE_URL` env entry (an `env` entry, so it outranks `envFrom`).

The chart's ONLY secret-backed Postgres password is the EXTERNAL branch
(`postgresql.enabled: false`): `POSTGRES_PASSWORD` is read from key `postgres-password` of
`hindsight.secretName`, which is `existingSecret` -- i.e. `hindsight-llm-api-key`. Latest published
chart (0.10.2) is unchanged. So the password cannot be minted in-cluster, the way the repo mints
`zeta-blob-store`, by any values this Application can set.

Exposure, stated: a ClusterIP Service, reachable from any pod that can route to
`hindsight-postgresql:5432`, with a password published in the chart and in this issue.

## Why the obvious fixes were not shipped

1. **External CNPG + `postgres-password` in the existing Secret.** Works only if
   `hindsight-llm-api-key` also carries the minted password. On metal that Secret is EXTERNAL and
   operator-supplied (`METAL_NOT_SEEDED`), so the operator would have to copy our minted value in:
   not minted, and two producers of one Secret.
2. **Seed `hindsight-llm-api-key` ourselves on metal** (so it can hold both). That creates a
   placeholder LLM key where the repo's standing decision (INJECTION-POINTS.md, "hindsight-llm-api-key
   stays an EXTERNAL gap, on purpose") is that nothing may run without a real one. A policy change,
   not a mechanical fix.
3. **Fork or wrap the chart** so Postgres reads its password from a Secret. Correct, and the largest
   change; the same one-line upstream chart PR would also fix it for everyone.

## Options, cheapest first

- Upstream PR to vectorize-io/hindsight adding `postgresql.auth.existingSecret` (both the
  StatefulSet env and the URL via `$(VAR)`). Then this becomes the standard mint.
- Network-scope `hindsight-postgresql` to the hindsight workloads with a NetworkPolicy (Cilium
  enforces it). Needs a second source or a sibling Application for the object -- the chart has no
  `extraObjects`.
- Decide the policy question in (2).

## Done when

The Postgres password is minted per cluster and a test fails if a literal reappears in the rendered
StatefulSet env or the database URL.
