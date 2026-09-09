---
id: 081M23C9ZM4087G0R001Q1MSD7
type: task
state: backlog
priority: P2
slug: the-outofsync-but-healthy-set-decomposes-into-persistent-sta
title: "the OutOfSync-but-Healthy set decomposes into persistent StatefulSet drift and transient CRD reconcile"
created: 2026-09-09T15:24:12.292Z
depends_on: []
composes_with: []
---

# the OutOfSync-but-Healthy set decomposes into persistent StatefulSet drift and transient CRD reconcile

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M23C9ZM4087G0R001Q1MSD7-*.md` glob. -->


Analysis: `docs/research/2026-09-09-the-outofsync-but-healthy-set-diagnosed-persistent-statefulset-drift-transient-crd-reconcile-and-one-real-defect.md`

## The short version

Tallied across TWO bring-ups -- run `34338106811` (green, dump 2 s after a 513 s
verdict) and run `34323056405` (red, dump 18 s after a 2400 s timeout):

| kind | green | red | reading |
|---|---|---|---|
| CustomResourceDefinition | 54 | 2 | TRANSIENT -- reconcile in flight, not drift |
| StatefulSet | 7 | 7 | PERSISTENT, same seven apps both times |
| Gatekeeper Constraints | 7 | 7 | a REAL defect (081M23B24P5087G0R002BJWEN1) |
| manual-sync resources | 20 | 20 | expected by declaration |

The persistent set is exactly `agent-memory`, `cockroachdb`, `headscale`,
`hindsight`, `nats`, `opensearch`, `weaviate` -- one StatefulSet each.

This VINDICATES the comment justifying the `OutOfSync + Healthy` allowance in
`isApplicationSynced`, which had never been measured. It also shows why the
allowance became dangerous: benign StatefulSet drift and a genuinely failed sync
are indistinguishable by the two status strings, which is what
081M23BCR90087G0R002GYP7TE closes.

## Left open, on purpose

WHICH FIELD of each StatefulSet differs is NOT measured. The diagnostics dump
names the resource, never the diff. The usual suspect is defaulted
`spec.volumeClaimTemplates` values the rendered manifest does not carry, but that
is a hypothesis here, not a finding.

The instrument that would settle it is `argocd app diff --server-side-generate`,
which needs the argocd CLI, a port-forward and a login inside the job -- a real
addition and a CI decision, so it is proposed rather than taken.
