---
id: 081M0QB1Q6Z087G0R00091JH3Q
type: task
state: backlog
priority: P2
slug: publish-zeta-orleans-silo-the-orleans-application-names-a-co
title: "Publish zeta-orleans-silo — the orleans Application names a container image nobody has ever built"
created: 2026-08-23T12:55:37.951Z
depends_on: []
composes_with: []
---

# Publish zeta-orleans-silo — the orleans Application names a container image nobody has ever built

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QB1Q6Z087G0R00091JH3Q-*.md` glob. -->

## The measurement

`full-ai-cluster/k8s/applications/orleans/statefulset.yaml` and
`infra/k8s/applications/orleans/deployment.yaml` both pin
`ghcr.io/lucent-financial-group/zeta-orleans-silo:latest`;
`infra/k8s/bootstrap/initial-orleans.yaml` pins `:bootstrap`.

Measured 2026-08-23, by asking GitHub rather than by reading the 401:

```
$ gh api /orgs/lucent-financial-group/packages?package_type=container
zeta-platform-controller  private
zeta-portal               private
$ gh api /orgs/lucent-financial-group/packages/container/zeta-orleans-silo
{"message":"Package not found.", "status":"404"}
```

**The org publishes exactly two container packages and this is not one of them.** The
registry answers `manifest HTTP 401` for it, which reads like "private" and is not — GHCR
returns 401 for a repository that does not exist, so the status code alone cannot tell the
two apart. That distinction is the whole point of this item: **making a package public
would not fix it, because there is no package.**

There is also no build: `.github/workflows/build-platform-images.yml` builds
`zeta-portal` and `zeta-platform-controller` and nothing builds a silo.

## Consequence

`orleans` is one of the three Applications the lane partitioner still quarantines as
CANNOT BE PRICED (`bun src/Core.TypeScript/cluster/lane-partition.ts --rung dev`). It is
its ONLY blocker — every other image in that Application measures.

The manifest is honest about this already ("Replicas start at 0 until you publish a real
silo image") and ships `replicas: 0`, so nothing is broken in a running cluster. What is
missing is the artifact.

## Done when

`ghcr.io/lucent-financial-group/zeta-orleans-silo` exists, is readable without a
credential, and `measure-lane-footprints.ts` sizes it — at which point `orleans` leaves
quarantine and the dev-rung coverage rises by one.
