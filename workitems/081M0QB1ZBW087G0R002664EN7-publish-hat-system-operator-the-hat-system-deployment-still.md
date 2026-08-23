---
id: 081M0QB1ZBW087G0R002664EN7
type: task
state: backlog
priority: P2
slug: publish-hat-system-operator-the-hat-system-deployment-still
title: "Publish hat-system-operator — the hat-system Deployment still pins the literal tag placeholder"
created: 2026-08-23T12:55:46.300Z
depends_on: []
composes_with: []
---

# Publish hat-system-operator — the hat-system Deployment still pins the literal tag placeholder

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QB1ZBW087G0R002664EN7-*.md` glob. -->

## The measurement

`full-ai-cluster/k8s/applications/hat-system/deployment.yaml:46` pins the literal
`ghcr.io/lucent-financial-group/hat-system-operator:placeholder`. `:placeholder` is not a
tag anyone published; it is a word.

Measured 2026-08-23:

```
$ gh api /orgs/lucent-financial-group/packages/container/hat-system-operator
{"message":"Package not found.", "status":"404"}
```

Same class as 081M0QB1Q6Z087G0R00091JH3Q: the registry says 401, which reads as "private",
and the truth is that **no package exists**, so no visibility change can help.

The Application's own header already says so ("The operator image itself is NOT built /
pushed yet — see operator/ README for the local build path"), and the Deployment ships
`replicas: 0`, so nothing in a live cluster is failing. `operator/` holds the Go source.

## What was fixed alongside this, and what was not

This item's sibling — `bitnami/kubectl:1.32.3` in
`full-ai-cluster/k8s/applications/hat-system/gatekeeper-crd-wait.yaml` — WAS a live bug
and is fixed on
`fix/unpriced-charts-measurable`: Bitnami withdrew the tag, so the Job that waits for every
hat ConstraintTemplate could not pull its only container. It now pins
`bitnamilegacy/kubectl:1.32.3`.

That leaves `:placeholder` as `hat-system`'s only remaining pricing blocker.

## Done when

The operator under `full-ai-cluster/k8s/applications/hat-system/operator/` is built and
pushed (a workflow beside `build-platform-images.yml` is the obvious shape), the Deployment
pins that image, and `hat-system` leaves the partitioner's CANNOT BE PRICED quarantine.
