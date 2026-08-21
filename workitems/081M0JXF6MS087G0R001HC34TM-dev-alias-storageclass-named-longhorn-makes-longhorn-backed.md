---
id: 081M0JXF6MS087G0R001HC34TM
type: task
state: backlog
priority: P2
slug: dev-alias-storageclass-named-longhorn-makes-longhorn-backed
title: "Dev alias StorageClass named longhorn makes longhorn-backed Applications testable in the kind lane"
created: 2026-08-21T19:41:21.945Z
depends_on: []
composes_with: []
---

# Dev alias StorageClass named longhorn makes longhorn-backed Applications testable in the kind lane

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0JXF6MS087G0R001HC34TM-*.md` glob. -->

## The circle

`isExcludedFromIncludedProof` in `src/Core.TypeScript/cluster/argocd-health-test.ts`
auto-excluded any Application whose YAML tree said `storageClass: longhorn`. That
rule was circular: the apps were excluded because Longhorn was excluded from the
dev catalog, and Longhorn was excluded because a kind node has no second disk.

Cost: the included Synced+Healthy proof asserted **19 of 45** Applications, and
eleven of the exclusions came from this one rule -- most of the stateful core.

## The cut

A StorageClass is a NAME bound to a provisioner, and workloads only ever name it.
`full-ai-cluster/dev-cluster/manifests/longhorn.yaml` binds `longhorn` to
`rancher.io/local-path`, so the same unmodified manifests bind on a kind node.
Zero application manifests changed. Production is untouched structurally: that
file lives under `dev-cluster/`, which ArgoCD never reads.

The shape is not new -- `zeta-local-path` has been exactly this alias since it was
added. This adds the second name and routes both through one shared apply path,
which also fixes `bringUpK3dDevCluster` never having applied `zeta-local-path` at
all.

## Conditional, not deleted

An unbindable PVC does not fail -- it sits `Pending` until the harness times out,
and a timeout prints no verdict. So the old rule still applies in full whenever
the substrate is absent:

1. `devLonghornStorageClassAliasDeclared()` fails closed on absent / unparseable /
   wrong-kind / wrong-name / provisioner-less. `false` restores the blanket rule.
2. `ReadWriteMany` claims stay excluded regardless -- local-path is node-local and
   RWO-only. Read off the access mode, not a hand-kept list.
3. New `DevStorageClassMissing` failure: an included-scope run verifies the class
   is actually in the cluster before waiting on anything.

## Measured on run 32519516070

**19 -> 25 asserted.** Six of the eleven storage-excluded Applications reach
Synced+Healthy in the kind lane and are asserted from now on: `headscale`,
`mimir`, `nats`, `oz` (openziti-controller), `redis`, `tempo`.

The alias worked for the other five in the sense that matters -- their PVCs
BOUND and their pods run. Each then failed for a NON-storage defect, and every
one of those defects was invisible before this change because the storage rule
excluded the Application carrying it:

| Application | observed | storage? |
| --- | --- | --- |
| `cockroachdb` | 3/3 pods Running on bound PVCs, readiness 503 for 38m -- a 3-replica cluster nobody ran `cockroach init` on | no |
| `hindsight` | `hindsight-postgresql-0` FailedScheduling `Insufficient cpu` on the 1-node runner; api + control-plane CrashLoop | no -- capacity |
| `kube-prometheus-stack` | prometheus + alertmanager bound and Running 2/2; grafana `CreateContainerConfigError`, secret `grafana-admin-credentials` not found | no -- missing secret |
| `weaviate` | `weaviate-0` 1/1 Running on a bound 100Gi PVC; Application re-syncs every ~3m, never converges | no -- sync convergence |
| `arc-runner-set` | RWX 100Gi claim local-path cannot serve + a GitHub App credential CI has no secret for | partly -- RWX |

Each is deferred with that evidence in `APPLIED_BUT_UNASSERTED_REASONS`, so
`auditAppliedButUnasserted` keeps them findable rather than forgotten.

## Follow-ups this surfaced (not done here)

1. `cockroachdb` needs a cluster-init step or a single-node dev value.
2. `hindsight` needs CPU requests that fit a 1-node runner, or deferral by policy.
3. `kube-prometheus-stack` needs a dev grafana admin secret.
4. `weaviate` chart 17.6.0 never converges its sync -- diagnose the partial sync.
5. The RWX guard reads only checked-in YAML; the ten unlocked apps are chart-sourced,
   so closing it properly means reading access modes out of a `helm template` render.

Eleven mutations, all killed; each byte-verified with `cmp` against a saved
pristine copy before its result was read. See PR #13326.
