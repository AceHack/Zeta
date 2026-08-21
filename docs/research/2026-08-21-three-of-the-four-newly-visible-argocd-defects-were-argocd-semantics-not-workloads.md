# Three of the four newly-visible ArgoCD defects were ArgoCD semantics, not workloads

**Date:** 2026-08-21 · **Lane:** `k8s-argocd-health-test` / `live kind included Synced+Healthy proof`
**Predecessor:** [`2026-08-21-what-each-deferred-argocd-application-needs-to-boot.md`](2026-08-21-what-each-deferred-argocd-application-needs-to-boot.md)

## CORRECTION, same day, from the live run this document was written before

**`weaviate` is re-deferred.** Live run 32532470499 — the first run to test the
fixes below on a cluster — passed `cockroachdb` and `kube-prometheus-stack` and
failed on `weaviate` alone, `OutOfSync/Progressing`, with the ~3-minute resync
loop unchanged.

The cause is one this document did not look for. weaviate renders **two
`type: LoadBalancer` Services** (`weaviate`, `weaviate-grpc`), and gitops-engine
`getCorev1ServiceHealth` reports a LoadBalancer Service whose
`status.loadBalancer.ingress` is empty as **Progressing, unconditionally**. A
kind node runs no LoadBalancer implementation, so those Services never get an
address and the Application **could never have been Healthy in this lane** —
whatever its sync status did. `weaviate-0` was 1/1 Running for 39 minutes while
that held, which is exactly how the blocker stayed hidden behind the one that
*was* found.

**The error was the inference, not the measurement.** §3 below establishes, by
byte diff, that the desired state moves — that is still true and still proven.
What §3 then did was treat a confirmed cause of `OutOfSync` as *the* cause of the
failure, and never ask what made it `Progressing`. Two independent blockers, one
checked. The `ignoreDifferences` rule is **kept** (the nondeterminism is real,
and on metal, where cilium-lb-ipam assigns LB addresses, it may be the whole
story) but its status is now **unmetered**: implemented, plausible, and *not*
falsified — the loop survived it live, and this lane cannot meter it until the
health half lifts.

**LIFTS WHEN:** the dev/CI substrate provides a LoadBalancer implementation
(cloud-provider-kind or MetalLB) — the same shape as the dev `longhorn`
StorageClass alias, one resource type over — **and** the residual `OutOfSync` is
*named* by diagnostics rather than reconstructed by hand a second time. The lane
now prints, on every failure, each non-Synced/non-Healthy Application's
per-resource `status.resources` rows and `status.conditions`; that output is what
would have named `Service/weaviate: Waiting for load balancer to be assigned` in
the first run instead of costing a wrong fix.

**Asserted roster: 28 → 30 from this work** (31 including `vault`, landed
separately). Read §3 below as a correct account of one drift source and an
incorrect account of why the Application failed.

## What this is

PR #13326's dev `longhorn` StorageClass alias made eleven Applications reachable
for the first time. Six went straight to Synced+Healthy. Four bound their
volumes, ran their pods, and then failed for reasons that had nothing to do with
storage — and those four had been invisible for as long as the storage rule hid
them. This is what each of them actually was.

The headline: **three of the four were not workload problems at all** (and one of those three, `weaviate`, turned out to have a *second* non-workload blocker that re-deferred it — see the correction above). They were
ArgoCD's own reconciliation semantics — hook phases, `helm template`'s inability
to run `lookup`, and a Secret the chart deliberately does not create. None of the
three needed the app to be asserted less; each is fixed and asserted under the
full auto-sync contract. The fourth, `hindsight`, is a genuine capacity fact plus
a defect nobody had noticed.

Asserted roster from this work: **28 → 30** of 46 discovered Applications.

## 1. `cockroachdb` — a deadlock between a PostSync hook and the health it produces

**Symptom, measured (run 32519516070):** `cockroachdb-0/1/2` Running on bound
PVCs for 38 minutes, every readiness probe 503, and **no `cockroachdb-init` Job
anywhere in the namespace**.

**Cause.** A multi-node CockroachDB serves nothing until `cockroach init` runs
once, so 503 was the *correct* behaviour of an uninitialised cluster. The chart
already ships the fix — `cockroachdb-14.0.5/templates/job.init.yaml` renders
`cockroachdb-init` whenever `conf.join` is empty and `single-node` is false, both
true for us — and annotates it `helm.sh/hook: post-install,post-upgrade`.

ArgoCD maps those to **PostSync**, and PostSync runs only after every Sync-phase
resource is Synced *and Healthy*. Read from the source rather than the docs:
gitops-engine `pkg/sync/sync_context.go` keeps a running non-hook task pending
until `health.GetResourceHealth` returns Healthy, and `setRunningPhase` prints
the literal string `waiting for healthy state of`. So:

> StatefulSet healthy ⟸ pods Ready ⟸ `cockroach init` ⟸ PostSync ⟸ StatefulSet healthy.

Circular. It resolves never. **This is not a dev-lane artefact** — no 3-replica
CockroachDB under this chart has ever come up healthy under ArgoCD on any
substrate, metal included.

**Fix.** One value: `init.jobAnnotations: {argocd.argoproj.io/hook: Sync}`.
gitops-engine `pkg/sync/hook/hook.go` `Types()` reads the Argo annotation first
and says so in its own comment — *"we ignore Helm hooks if we have Argo hook"* —
so this **replaces** the PostSync mapping rather than fighting it, and no YAML
key is duplicated.

Idempotent by construction, which is what a hook that re-runs every sync
requires: the chart's command loops until it sees *either* `Cluster successfully
initialized` *or* `cluster has already been initialized`, so a second run against
a live store exits 0 without touching data. `DeletePolicies()` unions the Argo and
Helm delete annotations, so the policy resolves to `BeforeHookCreation` with
nothing added.

**Offline evidence.** Rendering the chart from the Application's own valuesObject
before and after produces a **one-line diff**, on the init Job:
`+    argocd.argoproj.io/hook: Sync`. The rendered document strict-parses with
duplicate-key detection on, and the Job's annotation map carries all three keys.

## 2. `kube-prometheus-stack` — a Secret the chart is configured never to create

**Symptom:** prometheus and alertmanager bound and ran 2/2; **grafana** was
`CreateContainerConfigError`, `secret "grafana-admin-credentials" not found`.

**Cause.** The Application sets `grafana.admin.existingSecret`, deliberately, so
that no admin password is committed to this repository. Nothing in the dev lane
ever created one. kubelet resolves `env.valueFrom` at container-create time and a
missing Secret is a hard config error, so Grafana could not start.

**Fix, and where it does NOT go.** Weakening `existingSecret` — letting the chart
generate its own password, or inlining one — would change what the **metal**
cluster deploys in order to make a CI lane green. That is asserting less about
the app. Instead the credential is minted at bring-up by
`applyDevBootstrapSecrets`, beside the StorageClass aliases and before the
app-of-apps root, from `full-ai-cluster/dev-cluster/` — a directory ArgoCD never
reads, so the blast radius is structural rather than conventional.

The value is **drawn per cluster** (`randomBytes(24)`), never committed and never
logged. A well-known constant would have worked and been simpler; a drawn one
cannot be promoted to a real deployment by anyone copying it, because there is
nothing to copy. It is idempotent by asking first (`resourceExists`), so
re-running a bring-up against a standing cluster does not silently rotate
Grafana's admin password.

`assertDevGrafanaAdminSecretPresent` is the live half: an included run whose
cluster lacks the Secret is refused in seconds, naming the Secret, instead of
burning 2400s and reporting a Progressing Deployment.

## 3. `weaviate` — the DESIRED state was moving, not the live state

**Symptom:** `weaviate-0` 1/1 Running on a bound 100Gi PVC, and the Application
logging `Partial sync operation to 17.6.0 succeeded` every ~3 minutes for the
full 40-minute window without ever reaching Synced.

**Cause, reproduced offline with no cluster involved.** Render weaviate 17.6.0
from the Application's own valuesObject twice and diff. Exactly two lines differ:

```
<   username: "eVJ6bFJwREhiZnBMR1RvbmZ4cmdOUmFhZUNZT2R4bHA="
<   password: "VFR3ZlZPcUxWaU95UWVSUVFIZlZ5WW9US252eFhIRE4="
---
>   username: "WFdDcEg5cHFFcjBoY1ZRR253cGVCWjd5b1dsVVpXQkU="
>   password: "S0twbUFyeVlpRkozZTlGOVBUdVQ1QlhMZlMwc08xQXQ="
```

Both in `Secret/weaviate-cluster-api-basic-auth`. Everything else in ~1000
rendered lines is byte-identical, so that is the **whole** of the drift — which
is the fact that makes an ignore rule honest here rather than a cover.

`templates/_helpers.tpl` `cluster_api.secret` *tries* to be idempotent: it
`lookup`s the existing Secret and reuses it, falling back to `randAlphaNum 32`.
ArgoCD's repo-server renders with `helm template` and no cluster connection, so
`lookup` is always empty there and only the fallback branch ever runs. Nothing
in the cluster was mutating anything; git was holding noise.

**Fix.** `ignoreDifferences` scoped to one named Secret and two named keys, plus
`RespectIgnoreDifferences=true`. This is the mechanism ArgoCD's own
`docs/user-guide/diffing.md` names for exactly this cause — it lists *"A Helm
chart is using a template function such as `randAlphaNum`, which generates
different data every time `helm template` is invoked"* among the reasons an
Application is OutOfSync right after a successful sync.

**What it costs, stated:** ArgoCD stops comparing those two keys, so a third
party rewriting them goes unnoticed. There is no desired value to compare
against; comparing live state to noise is what produced the loop. The scope is
the narrowest ArgoCD allows, and `argocd-health-test.test.ts` refuses a widening
(`/data` wholesale, a nameless rule, a jq expression, a managed-fields manager).

`RespectIgnoreDifferences` is load-bearing and not decoration: without it ArgoCD
reports Synced and still *pushes* the freshly minted credential on the next sync
of any other resource. It only takes effect once the resource exists, so the
first sync still creates the Secret normally.

The hazard worth checking rather than assuming is its interaction with
`ServerSideApply=true`, which this Application also sets: under SSA a field
manager that stops sending a field it owns has that field **removed** from the
live object, so "strip the ignored fields from the desired state" would read as
"delete the credential on the second sync". It is not what happens — argo-cd
`controller/sync.go` says so at that branch, in its own comment: it *"should
normalize the target resources which in this case **applies the live values** in
the configured ignore differences fields."* The applied object carries the live
username and password, so SSA sees them owned and unchanged.

## 4. `hindsight` — left deferred, on three blockers instead of one

Not fixed. The reason recorded in `APPLIED_BUT_UNASSERTED_REASONS` now names
three independent blockers, any one of which defers it.

**(1) Capacity, measured.** `hindsight-postgresql-0` FailedScheduling
`0/1 nodes are available: 1 Insufficient cpu`; api and control-plane CrashLoop
waiting on a database with nowhere to run. Chart defaults are 500m + 250m + 250m
against an applied-set total of 4131m on a 4-vCPU runner whose kind system pods
already reserve ~950m.

**(2) The `dev` resource rung cannot reach this lane — the part that looked like
the fix and is not.** `storage-profiles.ts --resource-profile dev --apply`
rewrites the **working tree**; ArgoCD syncs the **committed** tree at
`--git-ref`, and the only rung CI runs is `--budget`, a report. There is no
dev-only resource override today, so lowering these numbers lowers them for
metal too — where the cost of an under-request is a pod that is evictable under
node pressure rather than one that is refused a node. That trade is a maintainer
call, not a CI convenience.

**(3) The `valuesObject` is largely inert against the pinned chart** — a defect
in its own right, and the finding worth carrying forward. The Application sets
`postgresql.primary.persistence.{storageClass,size}`, `api.llm.{provider,existingSecret}`
and a top-level `service`. hindsight 0.3.0 reads `postgresql.persistence.*`,
`api.env` / `api.secrets` / a top-level `existingSecret`, and
`api.service` / `controlPlane.service`. Its bundled Postgres is an in-chart
StatefulSet on `ankane/pgvector:latest`, not a Bitnami subchart, which is where
the `primary.` shape came from.

Rendered proof:

| the manifest says | what actually renders |
| --- | --- |
| `storageClass: longhorn` | **no `storageClassName`** on the PVC — it takes the cluster default |
| `size: 10Gi` | `8Gi`, the chart default |
| `api.llm.existingSecret: hindsight-llm-api-key` | no `HINDSIGHT_API_LLM_API_KEY` reaches the api container |

The third row matters beyond this lane: the storage-profile ladder governs
`postgresql.primary.persistence.size` for `hindsight`, which means that governed
number has never had an effect on anything. A profile row pointed at a dead path
is a governor that is not governing.

**LIFTS WHEN:** the valuesObject is rewritten against the schema the pinned chart
actually has, **and** a per-substrate resource override exists (or the maintainer
accepts the metal-side cost of the dev numbers).

## What was checked, and how

Everything above except the live-cluster verdict is reproducible offline, and was
run before the PR opened:

* both chart renders (`helm template` from the Applications' own valuesObject),
  including the double-render diff that reproduces the weaviate loop;
* strict YAML parse with duplicate-key detection over the rendered cockroachdb
  output;
* ArgoCD/gitops-engine source read at the two points the argument rests on —
  hook-type precedence and the health wait — rather than cited from docs;
* `bun test src/Core.TypeScript/cluster/` (430 pass), `tsc --noEmit`,
  `lint:typescript`, the five offline audits the `dry-run` job runs, and the
  `helm-validate` ratchet (317 passed / 21 failed, exactly at the recorded
  ceiling);
* fifteen mutations, each asserted APPLIED by byte `cmp` against a pristine copy
  before its result was read. All fifteen go red.

The one thing offline work cannot supply is the live verdict, which is what the
`live kind included Synced+Healthy proof` job on the PR is for.

## Pointers

* `src/Core.TypeScript/cluster/argocd-health-test.ts` — the deferral registries and the two live substrate guards
* `src/Core.TypeScript/cluster/dev-cluster/lib.ts` · `use-cases.ts` — the credential mint and its one shared constant
* `full-ai-cluster/k8s/applications/{cockroachdb,weaviate}/Application.yaml` — the two manifest fixes, each carrying its own evidence
* [`2026-08-21-what-45-applications-cost-a-dev-runner-cpu-memory-measured-and-the-image-bytes-nobody-counted.md`](2026-08-21-what-45-applications-cost-a-dev-runner-cpu-memory-measured-and-the-image-bytes-nobody-counted.md) — where the 4131m and the runner envelope come from
