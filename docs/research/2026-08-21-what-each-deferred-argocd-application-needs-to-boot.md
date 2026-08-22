# What each deferred ArgoCD Application needs to boot

**Work-item:** `081M0JXXFV0087G0R001PGEEM4`
**Question (Aaron, verbatim):** _"what do we need to do to get all of them booting."_
**Date:** 2026-08-21 · base `origin/main` `681a6e1e`

---

## 0. The measured starting point

`src/Core.TypeScript/cluster/argocd-health-test.ts` discovers **45** ArgoCD
Applications and asserted **19** of them under the `--scope included`
Synced+Healthy contract. Three exclusion rules do the cutting:

| #   | rule                                                                       | where                         |
| --- | -------------------------------------------------------------------------- | ----------------------------- |
| 1   | `DEV_EXCLUDED_DIRS`                                                        | `argocd-health-test.ts`       |
| 2   | `DEV_INCLUDED_PROOF_DEFERRED_DIRS`                                         | `argocd-health-test.ts`       |
| 3   | "references `storageClass: longhorn`" (derived, walks the app's YAML tree) | `isExcludedFromIncludedProof` |

And a fourth, upstream of all three, that is easy to miss and turned out to be
the dominant one:

| #   | rule                                                                                         | where                                  |
| --- | -------------------------------------------------------------------------------------------- | -------------------------------------- |
| 0   | `DEFAULT_ROOT_DEV_CATALOG.excludeGlob` — what the dev/CI app-of-apps root **applies at all** | `src/Core.TypeScript/cluster/ports.ts` |

**Nine of the twelve Applications in this scope were never applied to a CI
cluster in the first place.** Not asserted-and-failing, not
applied-and-unasserted — absent. `agent-memory`, `gitlab`, `orleans`,
`platform`, `temporal`, `ollama`, `vllm`, `deepseek-coder` and `qwen-coder` were
all named in the `excludeGlob`. Only `forgejo`, `spire` and `vault` actually
reach a CI cluster and go unasserted, and those three are precisely the three
that carry entries in `APPLIED_BUT_UNASSERTED_REASONS`.

That asymmetry is the first finding: _the deferred set was two different
populations wearing one label._

### Which rule is load-bearing for which app (measured, not read off the source)

Each app directory was copied into a scratch repo root under a name
(`probeapp`) that is in **neither** hand list, and `isExcludedFromIncludedProof`
was called on it. A `true` there is the longhorn rule acting **alone**:

```
agent-memory     longhornRuleExcludes= true      platform   longhornRuleExcludes= true
ollama           longhornRuleExcludes= true      vllm       longhornRuleExcludes= true
forgejo / gitlab / orleans / spire / temporal / vault / deepseek-coder / qwen-coder = false
```

So `agent-memory`, `platform`, `ollama` and `vllm` are held by the **storage
class**, independently of any hand list — removing them from the deferred set
changes nothing until the dev StorageClass work (another agent's scope) lands.
The other eight are held only by a hand list, i.e. by a decision.

---

## 1. The twelve rows

`WHY DEFERRED` is established from the manifests. Where the repo already had a
recorded reason it is marked _(recorded)_; the rest were blank and are new.

| #   | app                | why deferred (blocker, named)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | what it would take to boot in CI                                                                                                                                                                                                                                            | verdict                                   |
| --- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| 1   | **deepseek-coder** | _(none recorded)_ — swept into `DEV_EXCLUDED_DIRS` under a blanket "GPU model-serving" label. **The manifest declares no GPU.** `configmap.yaml` is one `Namespace` (`models`) + one `ConfigMap` of endpoint strings; `Application.yaml` carries `automated: {prune: true, selfHeal: true}`. No image, no pod, no PVC, no CRD.                                                                                                                                                                                                                                                                                                             | Remove from the `excludeGlob` and from `DEV_EXCLUDED_DIRS`. Nothing else.                                                                                                                                                                                                   | **CHEAP — LANDED**                        |
| 2   | **qwen-coder**     | _(none recorded)_ — identical to the above. One `ConfigMap` in namespace `models`, auto-sync, no GPU.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Same one-line pair of removals.                                                                                                                                                                                                                                             | **CHEAP — LANDED**                        |
| 3   | **orleans**        | _(none recorded)_ — deferred for a silo image it **never pulls**. `statefulset.yaml` ships `replicas: 0`, so `ghcr.io/lucent-financial-group/zeta-orleans-silo:latest` is never resolved. Everything else is Namespace + ServiceAccount + Role + RoleBinding + ConfigMap + 3 Services.                                                                                                                                                                                                                                                                                                                                                     | Remove from the `excludeGlob` and from `DEV_INCLUDED_PROOF_DEFERRED_DIRS`. ArgoCD reports a `replicas: 0` StatefulSet **Healthy** — see §2.                                                                                                                                 | **CHEAP — LANDED**                        |
| 4   | **agent-memory**   | _(none recorded)_ — `statefulset.yaml`'s `volumeClaimTemplates` pin `storageClassName: longhorn`, and `longhorn` is itself excluded (needs real block devices + `open-iscsi`). The PVC can never bind, so the StatefulSet stays Pending forever.                                                                                                                                                                                                                                                                                                                                                                                           | The dev StorageClass work — a `longhorn` class that exists on a kind node, or a manifest-level swap to `zeta-local-path`. **Owned by another agent; out of this scope.** Removing it from the hand list alone changes nothing (rule 3 catches it anyway).                   | **COSTLY** (blocked on storage substrate) |
| 5   | **platform**       | _(none recorded)_ — **three independent blockers.** (a) renders `monitoring.coreos.com/v1` `ServiceMonitor` + `PrometheusRule`, CRDs owned by `kube-prometheus-stack`, itself longhorn-blocked; (b) renders `gateway.networking.k8s.io/v1 Gateway`, and the two `cert-manager.io/v1` ClusterIssuers solve HTTP-01 **through that Gateway**; (c) `controller.yaml` and `portal.yaml` run `ghcr.io/lucent-financial-group/zeta-platform-controller:latest` and `.../zeta-portal:latest` at `replicas: 1` — images `build-platform-images.yml` builds but which no CI cluster can pull. `portal.yaml` also pins `storageClassName: longhorn`. | Prometheus-Operator CRDs + Gateway API CRDs installed ahead of it (the bootstrap already vendors `gateway-api-crds.yaml`, so (b) is the nearest), **plus** two published images, **plus** the storage class. Four dependencies, not one.                                    | **COSTLY**                                |
| 6   | **gitlab**         | _(none recorded)_ — `charts.gitlab.io/gitlab` 8.7.0: ~40 subcharts, a `gitlab-initial-root-password` Secret CI has no source for, and a Gitaly/Postgres/Redis/MinIO stack wanting several PVCs and multi-GB images.                                                                                                                                                                                                                                                                                                                                                                                                                        | A secret store CI can reach + several GiB of default-class storage + an image-pull budget a kind runner does not have inside the assertion window.                                                                                                                          | **COSTLY**                                |
| 7   | **temporal**       | _(none recorded)_ — **the chart has no datastore.** `go.temporal.io/temporal` 0.59.0 is configured with `cassandra.enabled: false`, `elasticsearch.enabled: false`, and the `server.config.persistence` block that would point it at CockroachDB is **commented out**. The schema-setup job therefore has nothing to migrate against and the server never becomes ready.                                                                                                                                                                                                                                                                   | A working persistence backend first — the commented CockroachDB wiring, and `cockroachdb` is itself longhorn-blocked in this lane. Two apps deep.                                                                                                                           | **COSTLY**                                |
| 8   | **forgejo**        | _(recorded — sync policy)_ Standby half of the either/or Git-host pair; `gitlab` is the default-on one. It ships `zeta.io/sync-policy: manual` **by design**, and its own header says only one of the pair may reconcile at a time.                                                                                                                                                                                                                                                                                                                                                                                                        | Asserting it here would assert the **manual-sync** contract — exists + compared, never synced. That is exactly the cdi/kubevirt vacuity `#13084` had to fix. Asserting it for real means running **both** Git hosts simultaneously, the configuration its manifest forbids. | **WRONG-TO-TEST**                         |
| 9   | **spire**          | _(recorded)_ "Vault upstream CA + kind PVC wiring not ready in included CI." Confirmed: the chart's `upstreamAuthority.vault` block is commented out pending a Vault that is **initialised** — so this app is gated behind row 10. Its own storage is `zeta-local-path`, which does exist, so **the PVC is not actually the blocker any more**; the CA is.                                                                                                                                                                                                                                                                                 | Row 10 first. Alternatively pin the recorded reason to what is still true (self-signed CA, `zeta-local-path` PVC) and re-measure — plausibly cheaper than it reads, but it is a security-substrate change, not a config fix.                                                | **COSTLY** (revisit after vault)          |
| 10  | **vault**          | _(recorded)_ "comes up SEALED by design; readiness needs the gated operator-init ceremony CI must not run." Confirmed from `vault/Application.yaml` and `TOPOLOGY.md`: `vault operator init` + `unseal` **mint root and unseal key material** and are a gated class requiring fresh human authorization + the biometric gate. Until then the readiness probe exits 2 and the pod is _correctly_ NotReady.                                                                                                                                                                                                                                  | **Nothing that CI may do.** A lane that could make Vault Healthy would be a lane that performs the ceremony.                                                                                                                                                                | **WRONG-TO-TEST**                         |
| 11  | **ollama**         | _(none recorded)_ — three blockers, and the interesting one is not the GPU. `resources.requests` includes `nvidia.com/gpu: 1` **and** `nodeSelector: {zeta.io/gpu: nvidia}` — an unschedulable pod on a kind node regardless of whether inference would work on CPU. `persistentVolume.storageClass: longhorn`. And `replicaCount: 0` + `zeta.io/sync-policy: manual`.                                                                                                                                                                                                                                                                     | See §3 — the honest answer is "it could boot, but not as configured".                                                                                                                                                                                                       | **COSTLY / partly WRONG-TO-TEST**         |
| 12  | **vllm**           | _(none recorded)_ — `vllm/vllm-openai:latest` is a CUDA image; the Deployment requests `nvidia.com/gpu: 1` with the same `zeta.io/gpu` nodeSelector, and `vllm-cache` is a **200Gi `longhorn` PVC**. Also `replicas: 0` + manual sync.                                                                                                                                                                                                                                                                                                                                                                                                     | Real GPU hardware. The PVC alone would hang the app on a kind cluster even at zero replicas.                                                                                                                                                                                | **COSTLY** (needs a GPU)                  |

---

## 2. Why the three that landed are honest passes, not softer assertions

The failure class this repo cares most about is _a check that did not run
looking like a check that passed_ — concretely, `cdi` and `kubevirt` counted
`ok: true` while nothing was deployed, because they are declared manual-sync.

The three landed apps are the opposite of that in every respect:

- All three carry `automated: { prune: true, selfHeal: true }`, so they are
  asserted under the **full** Synced+Healthy contract — `manualSync=false`,
  verified by a new test that fails if any of them ever flips.
- Every resource they declare is a resource that actually reconciles on a bare
  kind cluster: Namespaces, ConfigMaps, ServiceAccounts, a Role, a RoleBinding,
  three Services, and one StatefulSet.
- Nothing was weakened to accommodate them. `DEV_INCLUDED_PROOF_DEFERRED_DIRS`
  and the `excludeGlob` shrank; no assertion was relaxed.

**The one claim that needed checking is the StatefulSet.** `orleans` declares
`replicas: 0`, and "healthy because it is empty" is precisely the shape that
deserves suspicion. It survives the check on the source rather than on
intuition — `gitops-engine/pkg/health/health_statefulset.go`,
`getAppsv1StatefulSetHealth`:

- `ObservedGeneration == 0 || Generation > ObservedGeneration` → Progressing.
  The StatefulSet controller sets `ObservedGeneration` promptly at any replica
  count, so this is transient only.
- `ReadyReplicas (0) < *Replicas (0)` → **false**.
- `UpdateStrategy.Type` defaults to `RollingUpdate` and the API server defaults
  `RollingUpdate.Partition` to `0`, so `UpdatedReplicas (0) < (0 - 0)` → **false**,
  and the function returns **Healthy**.

So the verdict is deterministic, not lucky. And the repo already has the
precedent in the asserted set: `hat-system/deployment.yaml` ships `replicas: 0`
and has been part of the green included proof throughout.

**What is NOT claimed:** that an Orleans silo runs, that a model is served, or
that any inference happens. What is claimed is that these three Applications'
manifests parse, apply, reconcile and stay Synced — which is exactly what the
other 19 rows claim about themselves.

---

## 3. The GPU four, judged individually

The brief asked for a specific judgement rather than a blanket one, and the four
split three ways.

**`deepseek-coder` / `qwen-coder` — not GPU apps at all.** This is the finding
that pays for the exercise. Both `Application.yaml` headers say so in plain
words: _"This Application is structural — the model itself is pulled by whichever
serving stack you chose."_ Between them they render one `Namespace` and two
`ConfigMap`s of endpoint URLs and a VRAM estimate. The GPU is a property of
`ollama` and `vllm`, which **serve** those models. The two structural
Applications were excluded by association with the word in their directory name.

**`ollama` — the "CPU inference works" intuition is right and does not help.**
Ollama genuinely runs CPU inference, and with `models.pull: []` and
`models.run: []` there is no model to fetch, so _"boots without a GPU, just
cannot serve a large model fast"_ is a correct statement about the software. It
is not a correct statement about **this manifest**, and for a Synced+Healthy
proof only the manifest matters:

- `resources.requests` includes `nvidia.com/gpu: 1`. The scheduler treats an
  extended resource as unsatisfiable when no node advertises it — the pod stays
  `Pending`, it does not fall back to CPU.
- `nodeSelector: {zeta.io/gpu: nvidia}` independently makes it unschedulable on
  a kind node.
- `persistentVolume.storageClass: longhorn` — the PVC cannot bind.
- `replicaCount: 0` + `zeta.io/sync-policy: manual`.

Note the last line carefully: at `replicaCount: 0` **no pod is created**, so the
first two blockers are inert and the deciding one is the PVC (Helm renders the
PVC independently of replica count, and the longhorn class does not exist). So
`ollama`'s route to green is not "get a GPU" — it is (a) the dev StorageClass
work, and then (b) the same manual-sync question `forgejo` raises. A
CPU-inference variant with `gpu.enabled: false` and no GPU request would be a
genuinely testable configuration, but it is **a configuration we do not run** —
building one purely to assert it is the WRONG-TO-TEST shape.

**`vllm` — a real GPU requirement.** `vllm/vllm-openai:latest` is a CUDA image
and vLLM's engine initialises CUDA at startup; there is no CPU path worth
claiming here. Plus the same `nvidia.com/gpu` request, the same nodeSelector,
and a 200Gi `longhorn` PVC that hangs the Application even at `replicas: 0`.
Hardware, not config.

**Distinguishing "the pod starts and reports healthy" from "the workload is
useful":** for the Synced+Healthy proof only the former matters, and that is
exactly why `deepseek-coder`/`qwen-coder` land while `ollama`/`vllm` do not.
Uselessness never blocked an app here — unschedulability and an unbindable PVC
did.

---

## 4. A gap found in passing, not fixed here

`auditAppliedButUnasserted` audits **one** direction: applied-but-unasserted. The
inverse — **asserted-but-never-applied** — has no audit. Measured: putting
`deepseek-coder` back into the `excludeGlob` while leaving it out of
`DEV_EXCLUDED_DIRS` leaves `bun src/Core.TypeScript/cluster/app-of-apps-discovery.ts`
at **exit 0**, even though the harness would then assert an Application ArgoCD
never applies. The live lane would go red (the app would be `Missing`) after
~10 minutes on a runner; the offline audit that exists to catch exactly this
class stays green.

Today the only thing standing between that and `main` is the unit test that
pins the `excludeGlob` set literally — which does bite (verified: exit 1). That
is a real guard, but it is a _spelling_ check, not a _coherence_ check. The
symmetric audit is worth filing separately.

---

## 5. Evidence

Every exit code below was read as an exit code, never grepped out of colorized
output. Each mutation was confirmed applied by byte `cmp` against a pristine
copy of the file (not `git HEAD`) **before** its result was read.

| check                   | command                                                                                                                           | result                                                                                    |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| baseline                | probe over `discoverExpectedApplications()`                                                                                       | 45 apps, **19** asserted                                                                  |
| after                   | same probe                                                                                                                        | 45 apps, **22** asserted; all three new ones `manualSync=false`                           |
| harness unit tests      | `bun test argocd-health-test.test.ts included-proof-summary.test.ts`                                                              | exit **0**, 48 pass                                                                       |
| sibling cluster tests   | `bun test app-of-apps-discovery / single-node-readiness / storage-profiles / restricted-namespace-workloads / manual-sync-policy` | exit **0**, 156 pass                                                                      |
| app-of-apps reach audit | `bun src/Core.TypeScript/cluster/app-of-apps-discovery.ts`                                                                        | exit **0** — 46 manifests, 1 registered gap, **0 drift**                                  |
| single-node budget      | `bun src/Core.TypeScript/cluster/single-node-readiness.ts`                                                                        | exit **0**, "no blockers" (the three added apps declare no PVC, so the ladder is unmoved) |
| typecheck               | `bun run typecheck`                                                                                                               | exit **0**                                                                                |
| lint                    | `bun run lint:typescript`                                                                                                         | exit **0**                                                                                |
| dry-run plan            | `argocd-health-test.ts --dry-run --scope included`                                                                                | exit **0**, all three present                                                             |
| **mutation 1**          | re-add `"orleans"` to `DEV_INCLUDED_PROOF_DEFERRED_DIRS` (`cmp` confirmed the byte change)                                        | tests exit **1** — _"orleans must not be excluded from the included proof"_               |
| **mutation 2**          | re-add `deepseek-coder/**` to the `excludeGlob` (`cmp` confirmed)                                                                 | tests exit **1**                                                                          |
| revert                  | `cmp` against pre-mutation copy                                                                                                   | byte-identical; full suite back to exit **0**                                             |

The live `live kind included Synced+Healthy proof` job is the remaining
falsifier, and it runs on this PR against the PR head SHA. It is no longer
`continue-on-error`, so if any of the three does not reach Synced+Healthy on a
real kind cluster the run goes red and the change is wrong — which is the point.

---

## 6. Pointers

- `src/Core.TypeScript/cluster/argocd-health-test.ts` — `DEV_EXCLUDED_DIRS`,
  `DEV_INCLUDED_PROOF_DEFERRED_DIRS`, `isExcludedFromIncludedProof`,
  `APPLIED_BUT_UNASSERTED_REASONS`
- `src/Core.TypeScript/cluster/ports.ts` — `DEFAULT_ROOT_DEV_CATALOG.excludeGlob`,
  the rule that decides what is applied at all
- `full-ai-cluster/k8s/applications/vault/TOPOLOGY.md` — the unseal ceremony row 10 refuses to run
- `.github/workflows/k8s-argocd-health-test.yml` — the lane, and the 195-run
  measurement behind removing `continue-on-error`
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — three states, and why
  "unmetered" is the honest default; a deferred app with no recorded reason was
  unmetered wearing a decision's clothes
