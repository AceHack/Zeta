---
id: 081M00QCNYM087G0R000ZS3CE2
type: bug
state: done
priority: P1
slug: 14-argocd-applications-are-applied-to-every-ci-cluster-and-a
title: "14 ArgoCD Applications are applied to every CI cluster and asserted by nothing -- two unlinked exclusion lists"
created: 2026-08-14T18:08:48.084Z
completed: 2026-08-16T23:24:41.666Z
depends_on: []
composes_with: []
---

# 14 ArgoCD Applications are applied to every CI cluster and asserted by nothing -- two unlinked exclusion lists

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M00QCNYM087G0R000ZS3CE2-*.md` glob. -->

## The finding

There are TWO exclusion lists governing the kind/k3d ArgoCD health lane, and
nothing keeps them in agreement.

1. **What ArgoCD actually applies** — `DEFAULT_ROOT_DEV_CATALOG.excludeGlob` in
   `src/Core.TypeScript/cluster/ports.ts`. 12 directories are excluded, so
   everything else is synced onto the CI cluster.
2. **What the harness actually asserts** — `DEV_EXCLUDED_DIRS` +
   `DEV_INCLUDED_PROOF_DEFERRED_DIRS` + the derived "references
   `storageClass: longhorn`" rule in
   `src/Core.TypeScript/cluster/argocd-health-test.ts`. 26 directories are
   excluded from the Synced+Healthy proof.

The difference is a shadow: **14 Applications are applied to every CI cluster and
asserted by nothing.**

```
$ bun -e '<compare the two exported lists>'
glob-excluded (never applied) n=12:
  agent-memory, cilium, cilium-lb-ipam, deepseek-coder, gitlab, longhorn,
  ollama, orleans, platform, qwen-coder, temporal, vllm

APPLIED-BUT-NOT-ASSERTED n=14:
  arc-runner-set, cockroachdb, forgejo, headscale, hindsight,
  kube-prometheus-stack, mimir, nats, oz, redis, spire, tempo, vault, weaviate
```

That shadow set is, almost exactly, the stateful core of the hardware PoC:
CockroachDB, Vault, NATS, Redis, SPIRE, Hindsight, OZ, Weaviate, Mimir, Tempo,
kube-prometheus-stack.

## Confirmed live, not inferred

A single-node kind cluster (podman/applehv, kind 0.31.0, kindest/node v1.35.0,
2026-08-14) run through `argocd-health-test.ts --run --scope smoke` returned
`ok: true` while the cluster contained:

```
cockroachdb             OutOfSync   Missing
kube-prometheus-stack   OutOfSync   Missing
spire                   OutOfSync   Missing
mimir                   Unknown     Progressing
```

`cockroachdb` cannot possibly sync in that lane: it requires
`storageClass: longhorn`, and `longhorn` is glob-excluded so the StorageClass
never exists. The Application is applied, hangs `Missing` forever, and the
harness is structurally unable to notice.

Of 43 Applications, **17 are proven Synced+Healthy and 26 are not** — and the one
job that proves the 17 is `continue-on-error: true`
(081M00QCNZG087G0R0008TD6D1).

## Fix shape

Derive one list from the other. The `excludeGlob` is the ground truth for what
reaches the cluster; anything NOT in it must be either asserted or explicitly
listed as deferred with a reason. A pure unit test comparing the two exported
constants costs zero CI seconds and goes red the moment they drift.

Second, smaller fix: `discoverExpectedApplications()` reads Application names off
disk with a line regex (`APPLICATION_NAME_PATTERN`), not a YAML parse — the same
class of defect that PR #10647 removed from
`infra/k8s/tests/validate-applications.ts`.

## Done when

- [x] One list is derived from the other, or a unit test fails on any drift between them.
- [x] Every applied-but-unasserted Application is either asserted or carries a stated reason.
- [x] `discoverExpectedApplications()` uses a real YAML parser.

---

## Closed (shadow, 2026-08-16)

**The finding reproduced exactly.** Re-measured against `ab2d4acb96`: 12
glob-excluded, **14 applied-but-not-asserted, the same 14 names** as filed. The
asserted count moved 17 → 19 only because `cdi` + `kubevirt` landed since
(#11089); the shadow itself did not move.

**What landed** (`src/Core.TypeScript/cluster/argocd-health-test.ts` + its test):

- `rootDevCatalogExcludedDirs()` derives the applied set FROM
  `DEFAULT_ROOT_DEV_CATALOG.excludeGlob` instead of restating it — one source of
  truth for what reaches the cluster.
- `APPLIED_BUT_UNASSERTED_REASONS` — all 14 with a stated reason. Eleven are one
  root cause: they want `storageClass: longhorn` and `longhorn` is glob-excluded,
  so the StorageClass cannot exist in that lane.
- `auditAppliedButUnasserted()` reports drift in **both** directions — a newly
  applied Application nobody asserted (`unexplained`) and a stale entry for a
  directory that is no longer in the shadow (`stale`). Pure, offline, zero CI
  seconds.
- `parseApplicationName` now uses a real YAML parser.

**Falsifiers, verified by mutation** (a test that cannot fail is not a check):

| mutation                          | result                                              |
| --------------------------------- | --------------------------------------------------- |
| remove one reason entry (`vault`) | drift test **fails**, naming `vault`                |
| restore the line regex            | parser test **fails** on the nested-`name` manifest |

**Honest scope — what this does NOT do.** It does not make the 14 pass; they are
still applied and still unproven. It converts an _implicit_ shadow into an
_explicit, reasoned, drift-guarded_ one so it cannot grow silently. Actually
proving them needs the Longhorn-or-substitute StorageClass question answered,
which is hardware-PoC work, not harness work.

**Honest measurement — the YAML swap fixed a defect CLASS, not a live bug.**
Across all 46 `Application.yaml` files the old regex and a real parse **agree**
(0 disagreements). The regex is still wrong in principle — it takes the first
`name:` at any indentation inside `metadata:`, so a `labels:`/`ownerReferences:`
block carrying its own `name` would silently win, and a quoted or flow-mapped
name is missed. No current manifest has that shape. Saying otherwise would be
rounding a latent risk up into a caught bug.

**Found while measuring, NOT fixed — a third shadow.**
`discoverExpectedApplications()` enumerates `<dir>/Application.yaml` at depth 1
only, and the tree declares one Application _below_ that:
`game-hosting/gmod/Application.yaml`, whose own header says the App-of-Apps root
picks it up. It is in neither exclusion list, so it is invisible to the harness
AND unrecorded as deferred. Deepening discovery would change what the live
`--scope included` lane asserts and cannot be verified without a real cluster,
so instead the gap is **pinned at its measured size** by a test that goes red if
a second nested Application appears. Left open deliberately; worth its own item.
