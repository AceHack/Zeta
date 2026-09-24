---
id: 081M397QHX8087G0R003DQSY0B
type: task
state: backlog
priority: P2
slug: report-schedulable-longhorn-demand-beside-declared-exclude-c
title: "report SCHEDULABLE longhorn demand beside declared: exclude claims whose workload carries a nodeSelector no registered node satisfies"
created: 2026-09-24T08:15:22.536Z
depends_on: []
composes_with: []
---

# report SCHEDULABLE longhorn demand beside declared: exclude claims whose workload carries a nodeSelector no registered node satisfies

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M397QHX8087G0R003DQSY0B-*.md` glob. -->

## The measurement (WP28, 2026-09-24)

`single-node-readiness.ts`'s `longhorn-geometry` check compares the committed
roster's `driver.longhorn.io`-class demand (943 GiB) against the pool
`zeta-install.sh` actually partitions. That demand number is **inflated by 400
GiB — 47% of the pool — for two Applications that cannot schedule on any
registered node.**

| app | claim | why it cannot run here |
|---|---|---|
| `ollama` | 200 GiB, `zeta-block-replicated` (`Application.yaml`, chart value `storageClass`) | `nodeSelector: zeta.io/gpu: nvidia`; manual-sync only (no `automated` in `syncPolicy`) |
| `vllm` | 200 GiB, `zeta-block-replicated` (`deployment.yaml` PVC `vllm-cache`) | `nodeSelector: zeta.io/gpu: nvidia` (`deployment.yaml:23-24`); manual-sync only |

Every checked-in `ClusterNode` registration records an **Intel Arc Pro 140T**
(`maintainers/Addisons820/cluster-nodes/node-ad1efd/node.yaml`,
`.../node-b1e1b5/node.yaml`), not an NVIDIA GPU. No node carries
`zeta.io/gpu: nvidia`, so those pods stay Pending on the selector.

And all three capability classes are `volumeBindingMode: WaitForFirstConsumer`
(`full-ai-cluster/nixos/modules/local-storage.nix`), so a PVC with no
schedulable consumer **provisions nothing and reserves nothing**. These 400 GiB
are a number no current node is ever asked for.

## What to build

Report **schedulable** demand beside **declared** demand in the capacity
comparators, derived rather than listed:

- read each claim's owning workload's `nodeSelector` / `affinity` out of the
  manifests (the storage extractor already walks to the owning workload for
  `replicas`);
- read the labels every registered `ClusterNode` can satisfy out of
  `maintainers/*/cluster-nodes/*/node.yaml` plus whatever `k3s` `--node-label`
  flags the nix modules set;
- a claim whose selector **no** registration satisfies is counted in DECLARED
  and excluded from SCHEDULABLE.

Both numbers get printed. **Declared keeps the exit code** — a GPU arriving
tomorrow makes the demand real, so schedulable must not become a discount. This
is the same REPORT-never-DISCOUNT discipline the bring-up subset already has.

## Why it is not folded into the geometry PR

It needs its own selector/label parsing on both sides and its own falsifiers.
Bolting it on would make neither half reviewable. It also may answer a question
left open there: if declared-minus-unschedulable is really 543 GiB, the proposed
`ollama`/`vllm` re-binding to `zeta-block-local` may not need to happen at all —
which is the better outcome, and the reason to measure before moving anything.

## Falsifiers it needs

- a claim whose selector no registration satisfies is excluded from SCHEDULABLE
  and still counted in DECLARED (both asserted, so neither can silently become
  the other);
- a claim with no selector is in both;
- **no registration at all ⇒ REFUSE**, never "everything is schedulable" — the
  same absent-comparator refusal `capacity-provenance`, `compute-provenance` and
  `longhorn-geometry` already make;
- the exit code follows DECLARED, pinned by a case where schedulable fits and
  declared does not.

## Pointers

- `src/Core.TypeScript/cluster/single-node-readiness.ts` — `findLonghornGeometry`, `longhornPoolDemandGib`, `collectMeasuredNodes`
- `src/Core.TypeScript/installer/longhorn-capacity-preflight.ts` — `COMMITTED_LONGHORN_DEMAND_GIB`, which this would give a second, smaller companion
- `full-ai-cluster/nixos/modules/local-storage.nix` — the `WaitForFirstConsumer` bindings that make unschedulable claims cost nothing
- PR #17611 — the geometry comparator this extends
