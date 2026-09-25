---
id: 081M3BTKNNB087G0R000EPCNJ1
type: bug
state: backlog
priority: P2
slug: k8s-bootstrap-has-no-inert-key-coverage-the-manifests-that-r
title: "k8s/bootstrap has no inert-key coverage: the manifests that run FIRST are the ones nothing scans"
created: 2026-09-25T08:23:47.115Z
depends_on: []
composes_with: []
---

# k8s/bootstrap has no inert-key coverage: the manifests that run FIRST are the ones nothing scans

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3BTKNNB087G0R000EPCNJ1-*.md` glob. -->

## The instance, measured 2026-09-25

`full-ai-cluster/k8s/bootstrap/argocd-install.yaml` carried
`applicationSet.enabled: true`. At the pinned argo-cd **10.8.0** that key **does not
exist**:

- the chart's `values.yaml` has no `applicationSet.enabled`
- `templates/argocd-applicationset/deployment.yaml` carries **no `{{- if }}` guard at
  all** — the ApplicationSet controller renders unconditionally

So the value governed nothing. It was real at **7.7.10**, and the 7.7.10 -> 10.6.0 bump
(2026-09-01) orphaned it. Removal was verified render-neutral before it was taken.

## Why nothing caught it, which is the actual finding

`src/Core.TypeScript/cluster/inert-valuesobject-keys.ts` scans **Application**
`valuesObject`s. A bootstrap HelmChart's values live in `spec.valuesContent` — a YAML
document embedded as a *string* — in a file that is not an Application. The scanner could
not see this key, and cannot see any key in `k8s/bootstrap/`.

**It surfaced only by accident.** WP32 repaired the bootstrap/Application values parity
(081M3BQ5GX6087G0R003N44WMZ), which copied the key into an Application for the first time
— and the scanner went red on it immediately. Had that parity work not happened, the dead
key would still be there.

## Why this class matters more than one dead key

The `k8s/bootstrap/` manifests are the ones K3S applies at **first boot, before ArgoCD
exists to correct anything**. They are the least-covered and earliest-running surface in
the tree, and a silently-discarded value there is a setting an operator believes is in
force during the exact window nothing is watching.

This is the recurring shape rather than a one-off: **a scanner whose scope nobody restated
when the tree grew a second home for the same shape.** The pin-parity auditor found the
same class on the same files (`audit-argocd-pin-parity.ts`'s own header: "There are FIVE
sites, not four").

## What to build

1. Extend `inert-valuesobject-keys.ts` to the bootstrap tree, parsing
   `spec.valuesContent` as an embedded YAML document — `audit-argocd-pin-parity.ts`'s
   `parseHelmChartValues` already does exactly that parse and can be reused rather than
   re-derived.
2. Do it for **every** `helm.cattle.io/v1` HelmChart in the declared cluster trees, not
   just argocd — `declared-cluster-trees.ts` already enumerates them.
3. Expect findings. The other bootstrap charts have been through the same chart bumps with
   the same absence of coverage, so treat a nonzero first run as the measurement rather
   than as a blocker; baseline them the way the Application-side scanner baselines its 15.

## Falsifier

Re-introduce `applicationSet.enabled: true` into
`full-ai-cluster/k8s/bootstrap/argocd-install.yaml` and the extended scanner must go red.
That is the exact key this item was written about, so it is a regression test with a real
history rather than a synthetic one.

## Pointers

- `src/Core.TypeScript/cluster/inert-valuesobject-keys.ts` — the scanner and its baseline
- `src/Core.TypeScript/hygiene/audit-argocd-pin-parity.ts` — `parseHelmChartValues`, the embedded-YAML parse to reuse
- `src/Core.TypeScript/cluster/declared-cluster-trees.ts` — `bootstrapManifests()`, the roster
- 081M3BQ5GX6087G0R003N44WMZ — the WP32 change that exposed it
