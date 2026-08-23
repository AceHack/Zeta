---
id: 081M0QB1ZE7087G0R002A1YMWH
type: task
state: backlog
priority: P2
slug: leave-bitnamilegacy-it-is-a-frozen-archive-so-redis-and-gitl
title: "Leave bitnamilegacy — it is a frozen archive, so redis and gitlab are pinned to images that will stop being updated"
created: 2026-08-23T12:55:46.375Z
depends_on: []
composes_with: []
---

# Leave bitnamilegacy — it is a frozen archive, so redis and gitlab are pinned to images that will stop being updated

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QB1ZE7087G0R002A1YMWH-*.md` glob. -->

## Why this exists the day the pin landed

`fix/unpriced-charts-measurable` moved six image references off `docker.io/bitnami/*`
(HTTP 404 — Bitnami withdrew its free versioned tags) onto `docker.io/bitnamilegacy/*`,
which resolves at the same tags:

| image | compressed bytes |
|---|---|
| `bitnamilegacy/redis:7.4.1-debian-12-r2` | 51,672,225 |
| `bitnamilegacy/kubectl:1.32.3` | 111,998,161 |
| `bitnamilegacy/postgresql:14.8.0` | 91,714,366 |
| `bitnamilegacy/postgres-exporter:0.12.0-debian-11-r86` | 41,797,683 |
| `bitnamilegacy/redis:6.2.16-debian-12-r1` | 48,916,895 |
| `bitnamilegacy/redis-exporter:1.46.0-debian-11-r8` | 36,654,360 |

That unblocked `redis` and `gitlab` and is the right call today. It is **not** a durable
answer, and this item is here so that fact does not decay into an assumption.

## The honest limit

`bitnamilegacy` is an ARCHIVE. It receives no updates — no CVE patches, no rebuilds — and
its publisher reserves the right to remove it. Every pin above is therefore a **frozen
image with a stated expiry that nobody controls**, and the failure mode when it is removed
is the one just fixed: a 404 that reads as "unmeasurable" long after it started meaning
"unpullable".

The chart-side guard has to be disabled to use it at all
(`global.security.allowInsecureImages: true` in
`full-ai-cluster/k8s/applications/redis/Application.yaml`), which is the
chart telling us the same thing in its own voice.

## The routes, none of which is a lookup

- **redis** — a non-Bitnami redis chart, or the upstream `redis` image with our own thin
  chart. Note `full-ai-cluster/argocd` already pulls `public.ecr.aws/docker/library/redis`,
  so a maintained redis image is already in this tree.
- **gitlab** — the production-documented path is external PostgreSQL and Redis
  (`global.psql.host` / `global.redis.host`), which deletes both bundled subcharts and all
  four pins with them. `full-ai-cluster/k8s/applications/forgejo/Application.yaml` already
  took the equivalent decision for itself and recorded it.
- **kubectl** (`full-ai-cluster/k8s/applications/hat-system/gatekeeper-crd-wait.yaml`) —
  `registry.k8s.io/kubectl:v1.32.3`
  is upstream-maintained and 18,750,205 bytes against Bitnami's 111,998,161, but its config
  reads `ENTRYPOINT ["/bin/kubectl"]` on the distroless `go-runner` base: **no shell.** The
  Job's `/bin/bash -ec` script has to be rewritten shell-free first. That rewrite is the
  cheapest of the three and probably the one to do first.

## Done when

No manifest in this repo references `bitnamilegacy`, and the partition still prices every
Application that this branch made priceable.
