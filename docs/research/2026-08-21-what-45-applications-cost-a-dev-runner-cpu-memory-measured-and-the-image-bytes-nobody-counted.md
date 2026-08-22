# What 45 Applications cost a dev runner — CPU/memory measured, and the image bytes nobody counted

**Shadow.** Base: `origin/main` @ `681a6e1e`. Every number below was produced by pulling each chart
at its pinned `targetRevision` and rendering it; none is estimated.

## 0. The ask

Aaron 2026-08-20:

> "sounds like we can set some resource limits for our dev runners and different defaults for
> physical hardware, we should try to make things small enough to fit for disk and ram on the runners."

Three questions, and they have three different answers:

1. **What do the Applications actually request?** Answered by measurement, §2.
2. **Can they be made to fit 4 vCPU / 16 GB?** Yes for the set the dev lane runs — §4 is the rung
   that does it. No for all 45, and §2.3 says why that is not a rung's fault.
3. **What about disk?** §5. **Container images, not PVCs, and the gap is 5.5x.** Nothing in this
   repo measured this before today.

Companion, and deliberately not duplicated here:
[`2026-08-21-what-each-helm-chart-actually-needs-on-day-zero`](./2026-08-21-what-each-helm-chart-actually-needs-on-day-zero-derived-from-chart-defaults-not-from-a-budget.md)
answers the same shape of question for **PVC capacity on metal**. This one is CPU, memory, and image
bytes on a **runner**.

## 1. Method

For each of the 45 directories under `full-ai-cluster/k8s/applications/` carrying a top-level
`Application.yaml`:

```
helm pull <chart> --repo <repoURL> --version <targetRevision> --untar     # the pinned chart
helm template <name> <chart> -f <that Application's spec.source.helm.valuesObject>
```

then sum `resources.requests` over every rendered container, times its workload's replica count.
Applications sourcing this git repo were summed from their in-repo manifests instead.

This is deliberately _not_ "read `resources:` out of `values.yaml`". Two of the numbers below are
only visible after rendering: mimir's zone-aware replication turns one `ingester.resources` key into
three StatefulSets, and minio's post-install Job draws from `makeBucketJob`/`makeUserJob` rather than
from the `resources` block our own `valuesObject` sets. Reading values files would have missed both.

DaemonSets are counted at one pod, because the dev lane's kind cluster is one node. On a multi-node
cluster those rows multiply and the arithmetic below no longer holds; that is stated in the
catalogue rows themselves.

**Depth-1, and the 46th.** "45" is the count of `applications/<dir>/Application.yaml`. ArgoCD's
include glob is not path-segment bounded, so the root also applies
`applications/game-hosting/gmod/Application.yaml`. It contributes **0m / 0Mi** — in-repo manifests
with no requests, and it fails its sync on every reconcile against gatekeeper's webhook — so no total
here is wrong. What the coverage check does not guard is a _future_ nested Application that does
request something; `app-of-apps-discovery.ts` enumerates depth-2 and exits 1 on a second nested
Application, so that case forces a human to look before it can hide in this catalogue.

## 2. What they request

| cohort                                          | apps | CPU requests | memory requests |
| ----------------------------------------------- | ---- | ------------ | --------------- |
| asserted `Synced+Healthy` by `--scope included` | 19   | **1221m**    | **3.91 GiB**    |
| applied by the dev/CI app-of-apps root          | 33   | **4131m**    | **11.03 GiB**   |
| every Application in the tree                   | 45   | **9756m**    | **22.85 GiB**   |

Against a GitHub-hosted `ubuntu-24.04` standard runner: **4 vCPU / 16 GB / ~14 GB free SSD**.
All 101 `runs-on` entries in `.github/workflows/` are that class; there is no larger tier anywhere.

### 2.1 The answer to "can 45 fit in 16 GB" is no, and CPU runs out first

9756m of requests against 4000m of runner. Memory is 22.85 GiB against ~15 GiB usable. Neither is
close, and the CPU gap is the wider of the two — which is worth saying because the question was
asked about RAM.

### 2.2 The lane is green for a reason that is not "it fits"

The 19 the lane _asserts_ fit with room. The 33 it _applies_ do not — 4131m against 4000m of runner,
before kind's own control plane. The only reason that has never bitten is that **14 of those 33 hang
`Missing` forever** on a `longhorn` StorageClass the dev catalog glob-excludes, so they never
schedule a pod. That is already recorded, app by app, in `APPLIED_BUT_UNASSERTED_REASONS`.

It is a reprieve, not a fit. It ends the moment that StorageClass exists.

### 2.3 The sum is a floor, not the requirement

**28 of the 45 Applications render pods that request nothing at all** — `resources: {}` chart
defaults, across argocd, cert-manager, cockroachdb, loki, nats, vault, tempo, weaviate, spire,
longhorn, kube-prometheus-stack and eighteen others. Those pods are BestEffort. The scheduler will
admit any number of them and no arithmetic on requests will ever see one.

So the numbers in §2 bound what the _scheduler_ reserves and say nothing about what the _processes_
use. A ladder built on requests can make a set schedulable; it cannot make it fit. The rung in §4
therefore reserves 4.3 GiB of unreserved headroom for exactly this, and says so.

### 2.4 Where the weight is

| app                    | CPU   | memory | cohort                                               |
| ---------------------- | ----- | ------ | ---------------------------------------------------- |
| temporal               | 3000m | 6144Mi | glob-excluded (bundled elasticsearch, 3 x 1000m/2Gi) |
| gitlab                 | 2475m | 5733Mi | glob-excluded (15 workloads)                         |
| mimir                  | 1610m | 5124Mi | applied, unasserted                                  |
| hindsight              | 1000m | 1792Mi | applied, unasserted                                  |
| open-policy-agent      | 200m  | 1024Mi | asserted                                             |
| seaweedfs              | 500m  | 1024Mi | asserted                                             |
| kubevirt               | 20m   | 900Mi  | asserted (vendored upstream)                         |
| minio                  | 100m  | 512Mi  | asserted                                             |
| redis                  | 300m  | 384Mi  | applied, unasserted                                  |
| node-feature-discovery | 200m  | 256Mi  | asserted                                             |
| cdi                    | 100m  | 150Mi  | asserted (vendored upstream)                         |
| arc-controller         | 100m  | 128Mi  | asserted                                             |
| alloy                  | 1m    | 5Mi    | asserted                                             |

Everything not listed requests zero.

## 3. Two charts could not be measured, and that is a finding

- **`forgejo@9.0.6`** — `https://code.forgejo.org/forgejo-helm/index.yaml` returns **404**. The chart
  is not in `forgejo-helm` or `forgejo-contrib` on the package registry, and the OCI path 404s too.
- **`oz` / `ziti-controller@1.4.5`** — already recorded in §7.1 of the companion doc: upstream never
  published a chart 1.4.5. The index carries 1.1.x–1.3.4 then 2.0.0; the live index today carries
  only 3.2.x.

Both are **applied** by the dev root. Neither can be rendered by this measurement, and — the part
that matters — neither can be rendered by ArgoCD either, from those pins.

They are carried as `acknowledgedUnmeasuredRequests`, keyed `forgejo@9.0.6` / `oz@1.4.5`. The pin is
in the key so that bumping the chart invalidates the acknowledgement instead of inheriting it, the
same construction `acknowledgedCapacityShortfall` already uses. An app nobody could measure is not
an app that costs nothing.

A related smaller one: `sealed-secrets@2.16.2`'s pinned `repoURL`
(`https://bitnami-labs.github.io/sealed-secrets`) also 404s for `index.yaml` now. The chart still
resolves from its GitHub release tarball, so it is measured, but the pin is stale.

## 4. The `dev` rung

Added to `full-ai-cluster/k8s/storage-profiles.json` — the same file and the same tool as the storage
ladder, because it is the same problem with two more axes on it.

```
bun src/Core.TypeScript/cluster/storage-profiles.ts --resource-list
bun src/Core.TypeScript/cluster/storage-profiles.ts --resource-profile dev --budget
bun src/Core.TypeScript/cluster/storage-profiles.ts --resource-profile dev --apply
```

Two rungs:

- **`metal`** — byte-for-byte what the manifests render today. `verifyResourceProfileApplied` is
  clean against it on `main`, so **nothing in this change shrinks the hardware deployment**. That is
  the split Aaron asked for, and it is the same construction `large` uses one ladder up: naming the
  status quo is not endorsing it.
- **`dev`** — sized to fit the runner.

### 4.1 The envelope, and what is reserved from it

|                                     |                                    |
| ----------------------------------- | ---------------------------------- |
| capacity                            | 4000m / 15360Mi / 14 GiB free disk |
| reserved                            | 1500m / 6144Mi / 4 GiB             |
| **budget for application requests** | **2500m / 9216Mi**                 |

The reservation splits three ways:

1. **~950m / ~290Mi — kind's control plane and kube-system**, which the scheduler subtracts before
   any Application is placed: kubeadm static-pod defaults (apiserver 250m, controller-manager 200m,
   scheduler 100m, etcd 100m/100Mi), coredns 2 x 100m/70Mi, kindnet 100m/50Mi. argo-cd 7.7.10 adds
   nothing — rendered, every component's `resources` is unset.
2. **~550m / ~1536Mi ESTIMATED — what lives outside the kind node's cgroup**: host OS, the Actions
   runner agent, dockerd/containerd, and the bun harness driving the run. kind imposes no memory
   limit on its node container, so the kubelet reports the _host's_ capacity as the node's. This
   slice is real and invisible to the scheduler, and under-reserving it surfaces as the runner OOMing
   rather than as a Pending pod. Labelled ESTIMATED because it is.
3. **~4300Mi unreserved headroom** for the 28 BestEffort Applications of §2.3. That headroom is the
   only thing between them and the kernel OOM killer, which is why this budget is deliberately loose.

**The capacity half has its own falsifier.** 4 vCPU / 16 GB is GitHub's published spec, not something
we measured, so `--measure-runner` reads `/proc/cpuinfo` and `/proc/meminfo` on the runner and exits
1 when the real machine is smaller than the record. It **refuses** rather than passes where `/proc`
is absent, so it cannot go quietly green on a laptop. It runs in the `dry-run` job.

### 4.2 What `dev` costs

| rung    | dev lane (33)                | all (45)                     |
| ------- | ---------------------------- | ---------------------------- |
| `dev`   | **1806m / 5.94 GiB** — fits  | 7431m / 17.75 GiB — does not |
| `metal` | 4131m / 11.03 GiB — does not | 9756m / 22.85 GiB — does not |

`dev` was verified end to end, not asserted: applying it and re-rendering every governed chart gives
exactly the catalogue's numbers, component by component — mimir 635m/2272Mi, hindsight 400m/896Mi,
seaweedfs 200m/512Mi, open-policy-agent 100m/512Mi, minio 50m/384Mi, redis 150m/192Mi,
node-feature-discovery 100m/192Mi, arc-controller 50m/64Mi. The manifests were then restored
byte-identically; `main` stays on `metal`.

All 45 at `dev` is still over, and no rung here closes it: gitlab and temporal are 5625m / 11.6 GiB
between them and **neither is applied to a dev cluster**. The `dev` rung does not price apps the dev
lane never runs, and pretending otherwise would be a number with no machine behind it.

### 4.3 Every cut is priced, and the price is usually an OOMKill

A request cut below an app's real working set does not make the app smaller. Without a matching limit
it makes the pod more over-committed, and moves the failure from a **Pending pod** — loud, obvious,
attributed to the scheduler — to the **kernel OOM killer**: quiet, arbitrary, and attributed to
whichever process happened to be biggest.

So `loadResourceCatalogue` refuses a row that cuts a request without stating what the cut costs, and
a test requires every row reserving ≥256Mi on metal to name the failure mode by name. The sharpest
ones:

- **redis master/replica 128Mi → 64Mi.** Redis holds its whole dataset in memory. This is a hard
  ceiling on the dataset, not a throttle. Least margin in the ladder.
- **hindsight postgresql 256Mi → 128Mi.** An OOMKilled database is a crash, not a slowdown.
- **gatekeeper controller-manager 512Mi → 256Mi.** It is _in the admission path_: OOMKilled with
  `failurePolicy: Fail` it rejects every governed create; with `Ignore` it silently stops enforcing.
- **mimir ruler 128Mi → 96Mi.** A dead alerting path looks exactly like a quiet system.

Every one of those is `dev`-only. `metal` keeps the chart default in each case.

## 5. Disk — and it is not the PVCs

**MEASURED** by reading each rendered image's registry manifest and summing its layer sizes, then
measuring the compressed:uncompressed ratio directly — streaming four real images from this tree and
gunzipping them, because containerd stores layers **uncompressed**:

| image                                        | compressed   | uncompressed  | ratio     |
| -------------------------------------------- | ------------ | ------------- | --------- |
| `quay.io/argoproj/argocd:v2.13.2`            | 180.0 MB     | 483.4 MB      | x2.69     |
| `grafana/loki:3.3.2`                         | 33.2 MB      | 106.8 MB      | x3.21     |
| `registry.k8s.io/kube-state-metrics:v2.14.0` | 15.4 MB      | 52.3 MB       | x3.39     |
| `cockroachdb/cockroach:v24.2.4`              | 181.1 MB     | 451.1 MB      | x2.49     |
| **aggregate**                                | **409.7 MB** | **1093.5 MB** | **x2.67** |

Applied to the whole tree:

| cohort      | distinct images | compressed | on disk at x2.67 | vs ~14 GB free |
| ----------- | --------------- | ---------- | ---------------- | -------------- |
| asserted 19 | 39              | 1.61 GB    | ~4.3 GB          | fits           |
| applied 33  | 73              | 11.77 GB   | **~31 GB**       | **2.2x over**  |
| all 45      | 120             | 28.77 GB   | **~77 GB**       | **5.5x over**  |

Two images are most of it:

- `vllm/vllm-openai:latest` — **9.1 GB compressed**, ~24 GB on disk. Glob-excluded from the dev lane.
- `ghcr.io/vectorize-io/hindsight-api:0.1.1` — **8.8 GB compressed**, ~23 GB on disk. **Applied.** The
  only reason it does not land on a 14 GB disk today is the same `longhorn` reprieve as §2.2.

**No rung in this file changes that.** A CPU/memory ladder cannot shrink an image. If the goal is
"fit on the runner", the image footprint is the binding constraint and it needs a different
mechanism — a lane-scoped image roster, `kind load` of a pre-pulled subset, or simply not applying
hindsight to a runner. That is named here rather than solved, because solving it in this change would
mean editing `argocd-health-test.ts`'s exclusion logic, which three other agents are in today.

Honest limit: **11 of the 120 images could not be sized** — 4 private `ghcr.io/lucent-financial-group`
images (401), 5 bitnami tags withdrawn from Docker Hub (404: `redis:7.4.1-debian-12-r2`,
`redis:6.2.16-debian-12-r1`, `postgresql:14.8.0`, `redis-exporter`, `postgres-exporter`), 1 rate
limited (`cr.weaviate.io/.../weaviate:1.32.7`), 1 unresolved (`bitnami/kubectl:1.32.3`). All three
cohort totals are therefore **lower bounds**. The five bitnami 404s are their own finding: the redis
Application's chart-default images are no longer pullable from Docker Hub.

### 5.1 The PVC trap, stated

The storage ladder one section up in the same file totals 1599 GiB at the active `large` rung. **None
of that applies on a runner.** The dev lane's StorageClass is `local-path` — a hostPath directory
with **no quota**. A PVC _request_ against it reserves nothing and consumes nothing until something
writes. So a storage-heavy set looks like it fits and then fills the disk under load, with no
Pending pod anywhere to explain it.

The distinction, said once plainly:

| number                            | what it is                                                             |
| --------------------------------- | ---------------------------------------------------------------------- |
| CPU/memory requests (§2, §4)      | **scheduling reservations.** Bound admission. Not measurements of use. |
| Longhorn PVC GiB (storage ladder) | **scheduling reservations**, on metal. On kind: not bytes at all.      |
| image footprint (§5)              | **actual bytes on the disk**, the moment a pod is scheduled.           |

Only the third is bytes, and it is the one that was not being counted.

## 6. What landed, and what it refuses

`full-ai-cluster/k8s/storage-profiles.json` gains `resourceProfiles`, `runnerEnvelope`,
`resourceClaims` (26 governed rows across 8 apps), `ungovernedRequests` (37 rows carrying every other
Application's measured total), and `acknowledgedUnmeasuredRequests`.
`src/Core.TypeScript/cluster/storage-profiles.ts` gains the loader, the arithmetic, the verifier, the
applier and the CLI. The `dry-run` job of `k8s-argocd-health-test.yml` runs `--measure-runner` and
`--resource-profile dev --budget`.

The refusals, each with a paired red test:

- a rung that climbs down; a per-rung entry that is missing
- a `chart-default` number, or a multiplied pod count, with no evidence naming chart/version/path
- a row that **cuts** a request without pricing the cut
- an envelope that reserves everything it declares
- a directory counted twice, once governed and once ungoverned
- an Application the catalogue does not cover — **and** a catalogue row naming a directory that is
  gone (both directions, like `crossCheckClaims`)
- an UNMEASURED app that is not acknowledged at its pin; and an acknowledgement whose pin has moved
- a rung that does not exist reporting agreement instead of refusing
- an absent coordinate reading as "applied" for any rung below `metal`

**23 mutations, 23 killed, 0 survived.** Each was asserted applied by a byte-level `cmp` against a
pristine working-tree copy before its result was read. One of them earned its keep immediately: it
showed that the test guarding "never write `cpu: 0`" passed on the exact output it existed to
reject, because `formatCpu(0)` is the string `"0"` and the YAML writer emits it quoted as `cpu: "0"`.
The test now checks the key is absent rather than pattern-matching the line.

## 7. What this does not do

- **It does not shrink metal.** `metal` is the status quo and the ledger is untouched.
- **It does not apply `dev` anywhere.** `main` carries `metal`. The kind lane syncs ArgoCD against a
  git ref, so it renders whatever is committed — applying `dev` in CI would take a commit or an
  ArgoCD-level parameter override, and that wiring does not exist. The budget check proves the
  _ladder_ fits the runner; it does not prove the _cluster_ does, and those are different claims.
- **It does not fix the image footprint**, which §5 shows is the harder constraint by a factor of two
  on the applied set.
- **It does not set limits, only requests.** A request without a limit bounds admission and nothing
  else. Limits are the mechanism that would make a memory number a real ceiling, and they carry their
  own failure mode (OOMKill at the limit rather than at the node's edge). Not attempted here.

## 8. Anchors

- Kubernetes resource model — requests as scheduling reservations, limits as enforcement, and the
  Guaranteed/Burstable/BestEffort QoS classes that follow from the pair
  ([Resource Management for Pods and Containers](https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/),
  [Pod QoS Classes](https://kubernetes.io/docs/concepts/workloads/pods/pod-qos/)).
- GitHub-hosted runner specification — 4 vCPU / 16 GB / 14 GB SSD for `ubuntu-24.04` standard
  ([Standard GitHub-hosted runners](https://docs.github.com/en/actions/using-github-hosted-runners/using-github-hosted-runners/about-github-hosted-runners)).
  Vendor-published, therefore checked by `--measure-runner` rather than trusted.
- OCI image layer distribution — layers are gzip-compressed on the wire and unpacked by the snapshotter
  ([OCI Image Layer Specification](https://github.com/opencontainers/image-spec/blob/main/layer.md)).
- Companion, PVC side:
  [`what each Helm chart actually needs on day zero`](./2026-08-21-what-each-helm-chart-actually-needs-on-day-zero-derived-from-chart-defaults-not-from-a-budget.md).
