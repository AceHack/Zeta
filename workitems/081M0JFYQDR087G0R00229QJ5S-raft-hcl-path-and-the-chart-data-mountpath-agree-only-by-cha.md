---
id: 081M0JFYQDR087G0R00229QJ5S
type: bug
state: backlog
priority: P2
slug: raft-hcl-path-and-the-chart-data-mountpath-agree-only-by-cha
title: "raft HCL path and the chart data mountPath agree only by chart default -- nothing compares them, and divergence is a Ready pod with an empty raft store"
created: 2026-08-21T15:45:10.584Z
depends_on: []
composes_with: []
---

# raft HCL path and the chart data mountPath agree only by chart default -- nothing compares them, and divergence is a Ready pod with an empty raft store

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0JFYQDR087G0R00229QJ5S-*.md` glob. -->

## Measured on origin/main (1dd875f7de)

`full-ai-cluster/k8s/applications/vault/Application.yaml`:

    :137   storage "raft" { path = "/vault/data" }
    :140   dataStorage:
             enabled: true
             storageClass: zeta-local-path
             size: 20Gi          # <- no mountPath

The HCL states its path EXPLICITLY. `dataStorage` states no `mountPath` at all,
so the volume lands wherever the chart defaults it. The two agree today only
because the vault-helm default happens to be the same string the HCL names.
**Nothing in the tree compares them.**

## Why the failure is worse than a crash

If they diverge, Vault starts, passes its probes, and reports **Ready** --
while writing raft state to a path that is not the mounted volume. The store is
lost on every restart. A crash would be honest; this is a healthy-looking pod
silently discarding the thing it exists to keep.

## Two ways it diverges without anyone editing the HCL

1. **A chart-default change.** The coupling is inherited, not declared, so a
   chart bump can move one side while the other stays.
2. **The OpenBao migration**, which is live work: openbao-helm defaults its data
   path to `/openbao/data`. Repointing the Application without also editing the
   HCL produces exactly this state. Found while measuring that migration
   (`docs/research/` OpenBao feasibility, PR #13241) -- the audit was run against
   an OpenBao fixture and did **not** flag the mismatch.

## Not fixed here, on purpose

The obvious rule -- "compare the HCL path to the chart's data mountPath" --
needs to know the chart's DEFAULT when `mountPath` is absent, which is exactly
the unchecked assumption this item is about. Hardcoding `/vault/data` as the
vault-helm default would replace an unstated assumption with an unverified one.

Two candidate shapes, neither built:

* Require `dataStorage.mountPath` to be stated explicitly whenever a raft
  `path` is set, so the coupling is declared rather than inherited. Cheap, and
  it makes silent divergence impossible to introduce -- but it must first be
  confirmed that `mountPath` is a real vault-helm value.
* Compare against the RENDERED chart output rather than the values, which needs
  `helm` in the checking lane.

## Related

* PR #13241 -- OpenBao feasibility; names this and the sibling
  `MEASURED_CHART_VERSION` collision (vault-helm and openbao-helm both publish
  0.29.1, and the constant is chart-agnostic).
* `src/Core.TypeScript/hygiene/audit-vault-topology-coherence.ts` -- where such a
  rule would live; note it greps HCL only, so an env-var-configured seal or path
  would be invisible to it.

