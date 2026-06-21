---
id: 081KV13CRJF08QG0R001NFZTFH
type: task
state: backlog
priority: P1
slug: b-0967-full-scope-prove-every-non-excluded-argocd-applicatio
title: "081KSXN940008QG0R000SCP2H1 full scope — prove every non-excluded ArgoCD Application Synced+Healthy on k3d/kind"
created: 2026-06-13T18:20:04.559Z
depends_on: ["081KSXN940008QG0R000SCP2H1"]
composes_with: ["081KSNY2Z0008QG0R0008PN7RQ", "081KSGS9H0008QG0R0011BC7T2", "081KSE6WT0008QG0R000YYH3DY", "081KSGS9H0008QG0R00367G209"]
---

# 081KSXN940008QG0R000SCP2H1 full scope — prove every non-excluded ArgoCD Application Synced+Healthy on k3d/kind

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081KV13CRJF08QG0R001NFZTFH-*.md` glob. -->

Parent **081KSXN940008QG0R000SCP2H1** (`081KSXN940008QG0R000SCP2H1`) closed at **included scope** (14 kind-eligible apps, #7911).
This row is ladder rung 2: the **full** ArgoCD graph outside the ISO.

## Problem

Included proof deliberately excludes Longhorn, Cilium, GPU stacks, deferred git hosts,
and hat-system Gatekeeper policies. Homelab and USB/ISO acceptance need the **default
full stack** proven Synced+Healthy, not just the kind CI subset.

## Target

Extend `src/Core.TypeScript/cluster/argocd-health-test.ts` and CI so `--scope full`:

- Runs on **k3d** (primary Cilium-parity substrate) with kind fallback where documented.
- Asserts every **non-excluded** Application under `full-ai-cluster/k8s/applications/` is
  Synced+Healthy (same structured failure reporting as included).
- Adds the **drift-repair** acceptance slice deferred from 081KSXN940008QG0R000SCP2H1: mutate a
  fixture-owned non-destructive resource, assert ArgoCD self-heal reconverges.

## Acceptance

- [ ] `bun src/Core.TypeScript/cluster/argocd-health-test.ts --run --provider k3d --scope full` green locally on Docker (or documented named blocker).
- [ ] CI job (path-filtered) runs full scope on an appropriate runner cadence.
- [ ] `--drift-check` (or equivalent) mutates + reconverges without destructive cluster ops.
- [ ] Failure output names the failing Application(s), not an opaque timeout.

## Notes

k3d smoke is still not fully green (redis pre-install, Cilium/K3S pin work in 081KSXN940008QG0R000SCP2H1
live-evidence). Expect substrate fixes before full-scope CI goes mandatory.
