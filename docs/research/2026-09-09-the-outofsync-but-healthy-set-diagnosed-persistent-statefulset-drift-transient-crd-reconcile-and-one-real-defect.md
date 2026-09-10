# The OutOfSync-but-Healthy set, diagnosed: persistent StatefulSet drift, transient CRD reconcile, and one real defect wearing the same clothes

Author: shadow-subagent, 2026-09-09. Work-item 081M23C9ZM4087G0R001Q1MSD7.

Aaron, 2026-09-09: *"yes lets diagnose all those issues"* -- including the apps
that are OutOfSync but Healthy, which look like drift rather than breakage. This
is the answer, measured across two independent bring-ups.

## Method, and why one dump was not enough

The `Name the drifting resources (per-Application, failures only)` step runs
`if: always()`, AFTER the proof's verdict. ArgoCD re-syncs on a ~5-minute cycle,
so a single dump catches whatever reconcile happened to be in flight. Reading
drift from one dump is reading a moment.

So both runs were tallied and compared:

- `34338106811` -- GREEN, verdict at **513 s**, dump taken 2 s later. ArgoCD had barely settled.
- `34323056405` -- RED, verdict at **2400 s** (timeout), dump taken 18 s later. ArgoCD had 39 minutes to settle.

A class present in both is persistent. A class present only in the fast run is
reconcile in flight.

## The measurement

Drifting resources by kind:

| kind | GREEN (513 s) | RED (2400 s) | reading |
|---|---|---|---|
| **CustomResourceDefinition** | **54** | **2** | **TRANSIENT** -- comparison in flight, not drift |
| **StatefulSet** | **7** | **7** | **PERSISTENT** -- and the same seven apps |
| Gatekeeper Constraints (7 kinds) | 7 | 7 | PERSISTENT -- a REAL defect, see below |
| Namespace / SA / RBAC / Deployment / CDI / KubeVirt / PriorityClass | 20 | 20 | EXPECTED -- the two `manualSync` apps |
| Job (hooks, `sync=-`) | 3 | 2 | hook resources; ArgoCD reports them outside the sync status |
| Secret | 1 | 0 | transient (`openziti-controller`) |

## The persistent set is exactly seven Applications, identical in both runs

| Application | drifting resource | in roster? |
|---|---|---|
| `agent-memory` | `StatefulSet/agent-memory` | asserted |
| `cockroachdb` | `StatefulSet/cockroachdb` (+ `Job/cockroachdb-init`, a hook) | asserted |
| `headscale` | `StatefulSet/headscale` | asserted |
| `hindsight` | `StatefulSet/hindsight-postgresql` | `excludedFromDev` |
| `nats` | `StatefulSet/nats` | asserted |
| `opensearch` | `StatefulSet/opensearch-cluster-master` | asserted |
| `weaviate` | `StatefulSet/weaviate` | `excludedFromDev` |

One resource each, one kind, the same seven, twice. That is a steady-state
property of the tree, not a timing artifact.

**This VINDICATES the comment that justifies the allowance.** `isApplicationSynced`
says *"Helm apps with benign StatefulSet drift often stay OutOfSync while Healthy
after a successful sync"*, and that claim had never been measured -- it was doing
load-bearing work as prose. Measured, it names exactly the class that persists.
The 54 CRDs that looked like a bigger class in the green run are not drift at all.

**What is still unmeasured, and stated rather than guessed:** WHICH FIELD of each
StatefulSet differs. The dump names the resource, never the diff. The usual
suspect is the StatefulSet controller writing defaulted values into
`spec.volumeClaimTemplates` that the rendered manifest does not carry, so the
comparison never converges -- but nothing here measures that, and it is recorded
as a hypothesis with a named instrument rather than as a finding.

The instrument that would settle it is `argocd app diff --server-side-generate`,
which needs the argocd CLI, a port-forward and a login inside the job. That is a
real addition and a CI decision, so it is proposed rather than taken.

## The one that was NOT drift

`hat-system` presented identically -- `OutOfSync + Healthy`, persistent across both
runs -- and was a genuine failure: two ConstraintTemplates never compiled, so
Gatekeeper never generated their constraint CRDs, the Sync-hook Job exhausted its
backoffLimit, and all seven Constraints stayed unapplied. Every unapplied resource
was a kind ArgoCD has no health check for, so health stayed `Healthy` and the
allowance above admitted it.

Fixed in 081M23B24P5087G0R002BJWEN1. The allowance is narrowed in
081M23BCR90087G0R002GYP7TE, which refuses any Application carrying a `SyncError`
condition before the drift allowances are consulted.

**The lesson is the interesting part:** the persistent-StatefulSet class is
genuinely benign, and *because* it is benign the allowance that admits it was
widened until it also admitted a failed sync. Benign drift and a broken app were
indistinguishable by the two status strings alone. What separates them is a third
field -- the condition -- which was parsed and never read.

## The two that were never drift either

`cdi` and `kubevirt` show every resource `OutOfSync/Missing` in both runs, and
that is **correct**. Both declare `manualSync: true`, so ArgoCD never auto-syncs
them; they are asserted under `manualSyncAssertion` (exists, compares cleanly, not
Degraded) plus a dedicated `live kind kubevirt+cdi emulation proof` job, which
passed in every run examined. The roster is not over-claiming them, and the
earlier reading that it was came from the raw `kubectl get applications` dump
rather than from the proof's own verdict.

## Pointers

- `src/Core.TypeScript/cluster/argocd-health-test.ts` -- `isApplicationSynced`, the allowance this measures
- `src/Core.TypeScript/cluster/manual-sync-policy.ts` -- the weaker contract `cdi`/`kubevirt` are held to
- 081M23B24P5087G0R002BJWEN1 -- the hat-system Rego defect
- 081M23BCR90087G0R002GYP7TE -- the proof could not see a failed sync
- 081M23C5394087G0R000QS9J9D -- the smoke lane's 649 MiB clone
