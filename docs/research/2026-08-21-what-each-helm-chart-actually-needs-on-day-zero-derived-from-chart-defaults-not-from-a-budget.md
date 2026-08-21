# What each Helm chart actually needs on day zero — derived from chart defaults, not from a budget

**Shadow — research only. No manifest changed, no size in `storage-profiles.json` touched, no cluster contacted.**
**Date:** 2026-08-21 · Base: `origin/main` @ `a7164b1c`

## 0. The question, and why it is a different question

Aaron 2026-08-20/21:

> "1599 GiB why do we need that much? ... when i asked for minimial i was talking about what
> do we need for our help charts what do they need out the gate. I imagine the largest would
> be for our coackroach database."

`full-ai-cluster/k8s/storage-profiles.json` already answers a different question. Its `minimal`
rung was built **top-down**: pick a 200 GiB budget, cut each claim until the sum fits, and write
down what each cut costs. That is an honest construction and the consequences are recorded per
row. But it never asks what any chart *needs*.

This document asks the **bottom-up** question, per storage-consuming claim:

1. what the chart's own author picked as the default, at our pinned `targetRevision`;
2. whether a documented minimum or a mechanical floor exists;
3. what consumes the space over time and which knob governs it;
4. a day-zero figure, its reasoning, and what breaks first when it runs out.

**Headline, stated up front because it inverts the premise of the question:**

- **CockroachDB is not the largest.** At the active `large` profile, **Mimir is 350 GiB** across
  seven PVCs; CockroachDB is **300 GiB** (324 GiB counting the duplicate `infra/` tree).
- The two genuinely biggest *declared* claims are **ollama (200 GiB)** and **vllm (200 GiB)**, and
  **neither is applied on a fresh sync**. 400 of the 1599 GiB is planning capacity, not day zero.
- The **day-zero floor derived from chart mechanics is ~133 GiB** on one node, **~209 GiB** with
  honest 3-node HA replica counts — against 1599 GiB declared and 200 GiB in the `minimal` rung.
- Mimir's 50Gi/50Gi/50Gi triple is **byte-for-byte Grafana's own `large.yaml` preset**, which the
  file's own header says targets **~10M active series at 660,000 samples/sec**. We adopted that
  preset's disk sizing and none of its compute (it also sets `ingester.replicas: 27`).

## 1. Method and register

Every number below is tagged.

| register | meaning |
|---|---|
| **MEASURED** | I pulled the chart at the pinned version with `helm pull` and read the file, or read a manifest in this repo, or queried a registry API. File + line cited. |
| **RESEARCHED** | An upstream doc says it. URL cited. |
| **CALCULATED** | Arithmetic over MEASURED/RESEARCHED inputs. The inputs are shown. |
| **ASSUMED** | A stand-in for something nobody in this repo has measured. Named as such, with the command that would replace it. |

Charts were pulled to `/tmp/charts` with e.g.

```
helm pull cockroachdb --repo https://charts.cockroachdb.com/ --version 14.0.5 --untar
helm pull mimir-distributed --repo https://grafana.github.io/helm-charts --version 5.5.1 --untar
helm pull oci://ghcr.io/actions/actions-runner-controller-charts/gha-runner-scale-set --version 0.12.1 --untar
```

Eleven of twelve pinned charts resolved. **One did not, and that is a finding** — see §7.1.

### 1.1 REQUESTED vs CONSUMED — the distinction that decides the whole answer

This is the axis on which this kind of analysis usually goes wrong, so it is settled before any
number appears.

- **REQUESTED** is `spec.resources.requests.storage` on a PVC. It is a *scheduling reservation*.
- **CONSUMED** is bytes actually written into the volume.
- **1599 GiB is a REQUESTED total.** Nothing in it is a measurement of disk in use.

Longhorn makes the gap large and load-bearing in both directions:

- Longhorn volumes are **thin-provisioned, built on Linux sparse files** — "if you allocated a 20 GB
  volume but only use 1GB of it, the actual data size on your disk would be 1 GB"
  ([Longhorn KB, space-consumption-guideline](https://longhorn.io/kb/space-consumption-guideline/)) —
  so a freshly-provisioned 100Gi PVC consumes kilobytes. **CONSUMED on day zero is ≈ 0 for every
  claim in the table.**
- But the **scheduler counts REQUESTED**, not consumed:
  `Storage Scheduled ≤ (Storage Maximum − Storage Reserved) × Over-Provisioning Percentage / 100`
  ([Longhorn 1.7.2 settings reference](https://longhorn.io/docs/1.7.2/references/settings/), RESEARCHED),
  with `storageOverProvisioningPercentage` default `100` and `storageMinimalAvailablePercentage`
  default `25`. Both are left at chart defaults by `applications/longhorn/Application.yaml`.
- And **actual size can exceed nominal size**, because snapshots (including hidden system snapshots
  taken during rebuild/backup/expansion) count toward a replica's actual size (same Longhorn KB).

So the honest framing of the 1599 GiB is: **it is the number Longhorn's scheduler refuses against,
not the number a disk-usage graph would show.** A PVC that will never hold a byte still blocks the
next PVC from being placed. That is exactly why a *floor* question is the right question — the cost
of over-requesting is paid at scheduling time, before any data exists.

One amplification factor that is **not** in play: `longhorn/Application.yaml` sets
`defaultSettings.defaultReplicaCount: 1` and `persistence.defaultClassReplicaCount: 1` (MEASURED),
so 1 GiB requested is 1 GiB of `storageScheduled`. It also sets `reclaimPolicy: Retain`, so a
deleted PVC does **not** give its bytes back without an operator action.

### 1.2 Replica count is half of every number

Nine of the twenty-two claims are multiplied by a pod count, and the pod count comes from three
different places. Restating the ledger's own taxonomy, with the provenance verified against the
pulled charts:

| claim | pods at `large` | where the count comes from | verified |
|---|---|---|---|
| cockroachdb (both trees) | 3 | `statefulset.replicas: 3` — **chart default**, echoed in our manifest | values.yaml:172 (14.0.5); values.yaml:172 (13.0.1) |
| mimir ingester | 3 | chart default `replicas: 3` + `zoneAwareReplication.enabled: true` over 3 zones ⇒ `ceil(3/3)=1` per zone × 3 zone StatefulSets | values.yaml:896ff; `_helpers.tpl:568` |
| mimir store-gateway | 3 | chart default `replicas: 1`, same zone-awareness ⇒ `ceil(1/3)=1` per zone × 3 zones | values.yaml:1943ff; `_helpers.tpl:568` |
| nats | 3 | **our choice** — chart ships `config.cluster.enabled: false` (1 pod) | values.yaml:51-55 |
| redis replica | 2 | **our choice** — chart default is `replica.replicaCount: 3` | values.yaml:652 |

`_helpers.tpl:568` reads, verbatim:

```
{{- $replicaPerZone := div (add $requestedReplicas $numberOfZones -1) $numberOfZones -}}
```

which is `ceil(replicas / zones)`, confirming the ledger's mimir pod-count derivation. **MEASURED.**

**What one replica costs.** For CockroachDB, `statefulset.replicas: 3` is the chart default because
CockroachDB's default replication zone sets `num_replicas: 3`
([configure-replication-zones](https://docs.cockroachlabs.com/docs/stable/configure-replication-zones), RESEARCHED)
— it is a *quorum* requirement, not a chart affectation. But it is a quorum across **failure
domains**, and on a single node there is one failure domain. `full-ai-cluster/cockroachdb` is
already carried in `acknowledgedFalseRedundancy` for exactly this reason. So at `nodeCount: 1`,
3 pods buy nominal redundancy at 3× the disk; **1 pod costs one third and loses nothing that
existed.** The same logic applies to NATS (a 1-node JetStream cannot host R3 streams — but neither
can three pods on one box survive that box).

## 2. Per-chart findings

Sizes below are per-PVC unless a `× N` is shown. "Declared" is what the tree carries today
(`activeStorageProfile: large`, and `large` is byte-for-byte what the manifests said before the
ladder existed).

### 2.1 CockroachDB — `cockroachdb` 14.0.5 (and 13.0.1 in `infra/`)

**Chart default: `storage.persistentVolume.size: 100Gi` (values.yaml:419), `statefulset.replicas: 3`
(values.yaml:172).** MEASURED. Identical in 13.0.1 (values.yaml:371 / :172).

**Our declared size is exactly the chart default** — `full-ai-cluster/.../cockroachdb/Application.yaml`
sets `size: 100Gi` and `replicas: 3`, which is what the chart would have produced with no override at
all. Direction: **equal**. `infra/k8s/applications/cockroachdb` declares `8Gi` — **1/12th of the
default**, in the *under* direction, at every rung of the ladder.

**Documented minimum: none. Mechanical floor: yes, and it is ~11 GiB.**

CockroachDB creates an emergency ballast file at startup, and its creation is conditional
([cluster-setup-troubleshooting](https://docs.cockroachlabs.com/docs/stable/cluster-setup-troubleshooting), RESEARCHED, quoted):

> "The ballast file defaults to 1% of total disk capacity or 1 GiB, whichever is smaller."
> Creation requires that "Available disk space is at least four times the configured ballast file
> size" **and** "Available disk space on the store after creating the ballast file is at least 10 GiB."
> "During node startup, if available disk space on at least one store is less than or equal to half
> the ballast file size, the process will exit immediately with the exit code 10, signifying 'Disk Full'."

That is a real, checkable floor: **a store smaller than roughly 11 GiB never gets an emergency
ballast**, which means the documented recovery path from a full disk — delete the ballast, restart,
free space — does not exist on that node.

> **`infra/cockroachdb` at 8Gi is below that floor in all three profiles**, including `large`. This
> is not a `minimal`-rung consequence; it is a standing property of that row. CALCULATED from the
> quoted conditions + MEASURED manifest value.

The vendor's *recommendation* runs the other way and is worth stating so the 100Gi default is seen in
context: "We recommend provisioning volumes with **320 GiB per vCPU**", max 10 TiB per node, and
"Under-provisioning storage leads to node crashes when the disks fill up. Once this has happened, it
is difficult to recover from."
([recommended-production-settings](https://docs.cockroachlabs.com/docs/stable/recommended-production-settings), RESEARCHED).
The chart's own 100Gi default is already below Cockroach Labs' recommendation for a single-vCPU node.

**What consumes it, and what governs it.** User data × the range replication factor, plus SSTable
write amplification and the ballast. The governing knob is the **replication zone config**
(`num_replicas`, default 3) and, obviously, how much data is written.

> **Today, nothing writes to it.** Grepped the tree: the only two references to a CockroachDB
> connection string are **both commented out** — `applications/temporal/Application.yaml:39` and
> `applications/hindsight/Application.yaml:52`. Hindsight runs its own bundled `postgresql`
> subchart (`postgresql.enabled: true`). **MEASURED.** CockroachDB's 300 GiB is currently
> provisioned to hold its own system ranges and nothing else.

**Day-zero recommendation: `16Gi` × 1 pod = 16 GiB** (× 3 = 48 GiB once there are three real nodes).
Reasoning: 10 GiB free-after-ballast + a 1 GiB ballast + system ranges + "a few GiBs to be safe"
for maintenance, which the troubleshooting doc names explicitly. 16Gi clears that with margin and
leaves room for Temporal/Hindsight to be wired without a resize. It is **11 GiB above the mechanical
floor and 84 GiB below the chart default** — and the chart default is the right number for a cluster
that has tenants, which this one does not yet.

**What breaks first, and how visibly: extremely visibly.** Writes stop ("if you run out of disk space
the system will no longer be able to accept writes") and on restart the process exits with code 10.
There is no silent degradation mode.

### 2.2 Mimir — `mimir-distributed` 5.5.1 — **the actual largest, at 350 GiB**

**Chart defaults: ingester `2Gi`, store-gateway `2Gi`, compactor `2Gi`** (values.yaml:975, :2023,
:2223). MEASURED. Our declared sizes are **50Gi each — 25× the chart default in every case.**

Where 50Gi came from is not a mystery, and the chart ships the evidence:

| preset file in the chart | ingester | store-gw | compactor | the file's own stated target |
|---|---|---|---|---|
| `values.yaml` (bare default) | 2Gi | 2Gi | 2Gi | — |
| `small.yaml` | 50Gi | 10Gi | 20Gi | "~1M series and scrape interval of 15s ... around 66000 samples per second" |
| `large.yaml` / `capped-large.yaml` | 50Gi | 50Gi | 50Gi | "~10M series ... around 660000 samples per second" |

**MEASURED** (`small.yaml:41,60,151`; `large.yaml:41,60,152`; header comments quoted verbatim).

Our triple (50, 50, 50) matches `large.yaml` exactly and matches `small.yaml` on the ingester only.
`large.yaml` also sets `ingester.replicas: 27`, `store_gateway.replicas: 6`, `distributor.replicas: 12`.
**We took the disk half of a ten-million-series deployment and none of its compute.**

**Documented minimum: none for ingester or store-gateway. The compactor has a formula.**

- Ingester: "The required disk space depends on the number of time series stored in the ingester and
  the configured `-blocks-storage.tsdb.retention-period`"
  ([production tips](https://grafana.com/docs/mimir/latest/manage/run-production-environment/production-tips/), RESEARCHED).
  That retention **defaults to `13h`** (RESEARCHED — [grafana/mimir docs and discussions](https://github.com/grafana/mimir/discussions/8917); the default was changed from 24h to 13h) and our
  Application does not override it. So the ingester PVC is a **13-hour rolling window plus WAL**,
  not a history store — long-term blocks live in MinIO (`blocks_storage.backend: s3`, MEASURED at
  `applications/mimir/Application.yaml:29-36`).
- Store-gateway: index-headers synced from object storage into `/data/tsdb-sync` (MEASURED,
  `values.yaml:217`). It is a **cache**; the upstream docs give no sizing formula.
- Compactor: the docs give both a formula and a rule of thumb
  ([compactor reference](https://grafana.com/docs/mimir/latest/references/architecture/components/compactor/), RESEARCHED):
  `compactor.compaction-concurrency * max_compaction_range_blocks_size * 2`, and
  **"150GB of disk space for every 10M active series owned by the largest tenant."**

**What consumes it, and what governs it.** Ingest rate × 13h for the ingester; block count for the
store-gateway cache; the largest tenant's active-series count for the compactor. Today the only
producer is Alloy, whose `prometheus.scrape` blocks cover **annotated pods on the node plus Alloy's
own self-exporter** — nothing else (MEASURED, `applications/alloy/Application.yaml:130-146`).

> **OPEN QUESTION, and it is the one number that would make all three mimir rows exact:** nobody has
> measured this cluster's active series. The closing measurement is
> `sum(cortex_ingester_memory_series)` in Mimir, or `prometheus_tsdb_head_series` in Prometheus.
> The recommendations below are stated **conditional on ≤ 100k active series**, which is two orders
> of magnitude below `small.yaml`'s target and still generous for a single-node k3s cluster.

**Day-zero recommendations (per PVC, conditional on ≤ 100k series):**

| component | day-zero | reasoning | pods |
|---|---|---|---|
| ingester | **`4Gi`** | 100k series × (13h ÷ 15s) × 2 B ≈ 0.6 GB of head blocks, plus WAL. 4Gi is ~6× that. CALCULATED from the 13h default and Prometheus's documented 1–2 bytes/sample. | 3 |
| store-gateway | **`2Gi`** = chart default | index-header cache only; overflow costs latency, never data — a long-range query re-fetches from MinIO. | 3 |
| compactor | **`4Gi`** | 150 GB per 10M series ⇒ 1.5 GB at 100k. 4Gi is ~2.7×. | 1 |

Total day-zero mimir: **12 + 6 + 4 = 22 GiB**, against 350 GiB declared.

**What breaks first, and how visibly.**
- **Ingester full** is the loud one and the only data-affecting one: TSDB writes fail, pushes are
  rejected, and Alloy's `remote_write` backs up. Visible immediately as write errors.
- **Store-gateway full**: degraded query latency. Quiet, and correctly so — it is a cache.
- **Compactor full**: compaction stalls; blocks accumulate un-compacted in MinIO and query
  performance decays over days. **This is the quietest failure in the whole table** — nothing is
  lost, nothing errors, queries just get slower. Worth an alert rather than headroom.

### 2.3 Prometheus (`kube-prometheus-stack` 65.5.0) — the size and the governor are separated, and that is the defect

**Chart default: there is no PVC at all.** `prometheus.prometheusSpec.storageSpec: {}`
(values.yaml:3833) — the chart's out-of-the-box Prometheus writes to an `emptyDir`. The commented
example beside it shows `50Gi`. MEASURED. Our declared `100Gi` is therefore **2× the chart's own
worked example and infinitely more than its default.**

Chart default retention is `retention: 10d` (values.yaml:3728); we set `15d`.
`retentionSize: ""` (values.yaml:3732) — **and we do not set it.** That is the finding.

**Documented minimum: none. But there is a documented formula and a documented headroom rule**
([Prometheus storage docs](https://prometheus.io/docs/prometheus/latest/storage/), RESEARCHED, quoted):

> `needed_disk_space = retention_time_seconds * ingested_samples_per_second * bytes_per_sample`
> "Prometheus stores an average of only 1-2 bytes per sample."
> "we recommend setting the retention size to, at most, 80-85% of your allocated Prometheus disk
> space. The remaining 15-20% buffer covers the temporary extra space required by in-progress
> compactions."
> The WAL is kept in "128MB segments", minimum three files, more "in order to keep at least two
> hours of raw data."

**What consumes it, and what governs it.** Samples/sec × retention. The `storage-profiles.json`
row already makes the right point — that `100Gi` means nothing without `retention: 15d` — but the
sharper statement is that **`retention` is the wrong governor for a bounded disk.** Time retention
does not bound bytes; `retentionSize` does. Prometheus removes the oldest blocks when the size
threshold is crossed, and it is the only mechanism here that *cannot* overrun the volume.

**CALCULATED worked example.** kube-prometheus-stack's default scrape interval is 30s. At an
**ASSUMED** 40,000 active series — the closing measurement is `prometheus_tsdb_head_series`, and
this stand-in is deliberately at the high end for one k3s node with node-exporter,
kube-state-metrics, kubelet and apiserver:

```
samples/sec = 40,000 / 30            ≈ 1,333
15 days     = 1,296,000 s
bytes       = 1,296,000 × 1,333 × 2  ≈ 3.5 GB
```

**15 days of this cluster's metrics is about 3.5 GB.** The declared 100Gi is roughly 28× that; even
`minimal`'s 16Gi is ~4.5×.

**Day-zero recommendation: `16Gi`, and set `retentionSize: 12GiB` alongside it.** 16Gi is ~4.5× the
calculated need, which is the right amount of slack for a cardinality surprise; `12GiB` is 75% of
16Gi, inside the documented 80-85% ceiling. The pair is the point: **a size without a size-governor
is how you get the eviction loop**, and today the tree has exactly that.

Note this also **corrects the `minimal` row's advice**. That row says a `minimal` selector "must also
cut `prometheus.prometheusSpec.retention` to ~3d". Cutting retention is a *guess* that 3d fits;
setting `retentionSize` is a *guarantee*. Recommend both, but `retentionSize` is the one that cannot
be wrong.

**What breaks first, and how visibly.** The TSDB fails writes with `no space left on device`,
compaction fails, and the WAL cannot checkpoint — the "wedge" the ledger names. Loud in logs,
invisible on a dashboard until you notice metrics stopped. With `retentionSize` set, this failure
class does not occur.

**Grafana** (subchart): `persistence.enabled: false`, `size: 10Gi` when enabled
(charts/grafana/values.yaml:374,378), `replicas: 1` (:49). MEASURED. We declare 10Gi = the chart's
enabled default. It stores a SQLite DB and provisioned dashboards. **Day-zero: `2Gi`.**

**Alertmanager**: `alertmanagerSpec.storage: {}` — no PVC by default; commented example 50Gi
(values.yaml:762-769); `retention: 120h` (:757); `replicas: 1` (:752). MEASURED. The volume holds
silences and the notification log. **Day-zero: `2Gi`**, which is already what `minimal` says, and
`large`'s 10Gi is harmless but pointless.

### 2.4 Weaviate 17.6.0

**Chart default: `storage.size: 32Gi` (values.yaml:125), `replicas: 1` (:72).** MEASURED.
We declare `100Gi` — **3.1× the default, over**. `minimal`'s 12Gi is 0.4× the default, under.

**Documented minimum: none. Mechanical ceiling: 90%, and this refines the ledger's note.**

`storage-profiles.json` says "Weaviate does not evict: once the volume is full, ingest fails." True
in direction, imprecise in mechanism. Weaviate has two documented disk thresholds:
`DISK_USE_WARNING_PERCENTAGE` (default **80**) and `DISK_USE_READONLY_PERCENTAGE` (default **90**);
at the readonly threshold "a shard is marked READONLY due to disk pressure", recoverable via the
Shards API once space is freed
([Weaviate best-practices / persistence docs](https://docs.weaviate.io/weaviate/best-practices), RESEARCHED).

So: **effective capacity is 90% of the PVC**, the failure is at 90% not 100%, it is *loud* (shards
flip READONLY, ingest 4xx), and it is *reversible* without data loss. Neither the chart nor our
Application sets those env vars (MEASURED — no `DISK_USE_*` anywhere in the chart or manifest), so
the defaults apply.

**What consumes it, and what governs it.** Object store + inverted index + HNSW graph, per imported
object. Nothing governs it — there is no retention concept. It grows monotonically with the corpus.

> **On day zero it cannot grow at all.** Both vectorizer modules point at Ollama
> (`text2vec-ollama` → `nomic-embed-text`, `generative-ollama` → `qwen2.5-coder:32b`, MEASURED at
> `applications/weaviate/Application.yaml`), and the Ollama Application is manual-sync with
> `replicaCount: 0`. **There is no embedder, so there is no ingest.**

**Day-zero recommendation: `8Gi`** (≈ 7.2 GiB effective after the 90% threshold). This is the row
where the day-zero answer and the eventual answer diverge most: the moment a real corpus and a live
embedder exist, the chart's `32Gi` is the number to reach for, and it cannot be reached for by
resizing down later. **Flagged as the one row where deliberately over-requesting has a defensible
argument** — Kubernetes cannot shrink a PVC, so an under-sized vector store is a
destroy-and-restore, while an over-sized one is only scheduler pressure.

**What breaks first:** shards flip READONLY at 90%; ingest fails, queries keep working.

### 2.5 NATS 1.2.7 — the one claim that bounds itself

**Chart defaults: `config.jetstream.enabled: false`; `config.jetstream.fileStore.pvc.size: 10Gi`
(values.yaml:96); `config.cluster.enabled: false` with `replicas: 3` when enabled (values.yaml:51-55).**
MEASURED. We declare `20Gi` × 3 — **2× the default size, and the 3 pods are our choice**, since the
chart ships a single-pod, JetStream-off NATS.

**Mechanical floor: none. Mechanical *ceiling*: exact, and enforced by the server.** The chart
templates `max_file_store` from the PVC size:

```
files/config/jetstream.yaml:15   max_file_store: << {{ .maxSize }} >>
files/config/jetstream.yaml:17   max_file_store: << {{ .pvc.size }} >>
```

MEASURED. `maxSize` is unset (values.yaml:107, commented "defaults to the PVC size"), so line 17
applies and **the NATS server itself refuses to exceed the volume.** This is the only claim in the
table where REQUESTED is a hard, self-enforced bound on CONSUMED. It is the design the other
storage rows should be judged against.

**What consumes it, and what governs it.** JetStream stream file stores, governed by each stream's
own retention/limits policy.

> **No JetStream stream is declared anywhere in the tree.** Grepped `full-ai-cluster/k8s/` — the only
> hit for `jetstream` is the chart's own enable flag. **MEASURED.** 60 GiB is provisioned for zero
> streams.

**Day-zero recommendation: `4Gi` × 1 pod = 4 GiB** at `nodeCount: 1` (`4Gi` × 3 = 12 GiB at
`nodeCount: 3`). The chart's own comment at values.yaml:54 — "must be 2 or higher when jetstream is
enabled" — is about cluster formation, not disk; R3 streams need 3 servers, and three servers on one
box is the `acknowledgedFalseRedundancy` case the ledger already carries.

**What breaks first:** publishes are rejected with a JetStream resource error the moment
`max_file_store` is hit. Loudest failure in the table, and it happens *at* the requested size rather
than at the physical disk — which is the correct place for it to happen.

### 2.6 Tempo 1.18.0 — the size is decoupled from the only thing that governs it

**Chart defaults: `persistence.enabled: false`, `persistence.size: 10Gi` (values.yaml:303,309),
`replicas: 1` (:12), and `tempo.retention: 24h` (:57).** MEASURED. We declare `50Gi` — **5× the
chart's enabled default.**

The retention value is templated straight into the compactor config:

```
templates (values.yaml:155):   block_retention: {{ .Values.tempo.retention }}
```

MEASURED. **We do not override `tempo.retention`, so the volume holds at most 24 hours of traces**,
with `tempo.storage.trace.backend: local` writing to the PVC (MEASURED, our Application).

**Documented minimum: none.**

**What consumes it, and what governs it.** Span volume × 24h. The only OTLP producer wired today is
Alloy's `otelcol.receiver.otlp` on 4317/4318, and the manifest comment says the .NET side "will
export to [it] once Zeta.Core.Circuit gets an OTel exporter" — i.e. **not yet** (MEASURED).

**Day-zero recommendation: `10Gi` = the chart default.** Reasoning: at 24h retention, 50Gi would
require a sustained trace volume this cluster has no producer for. 10Gi is the chart author's own
number and gives a very large multiple of a day's traces at any plausible near-term rate.

**What breaks first:** ingestion errors on a full volume. But the 24h block retention means this
row is self-limiting in a way `prometheus` is not — **the ledger's "trace retention window shrinks
roughly proportionally, 50Gi → 8Gi" is only true if the volume is the binding constraint, and at
this cluster's volume it is `retention: 24h` that binds.** Cutting the disk changes nothing until
trace volume rises far enough to make disk the binder.

### 2.7 Ollama 1.6.0, vLLM, ARC model-cache — declared ceiling, zero day-zero floor

These three are **400 GiB of the 1599** and **none of them creates a PVC on a fresh sync.** The
distinction Aaron asked for is sharpest here.

**Ollama.** Chart default `persistentVolume.enabled: false`, `size: 30Gi` (values.yaml:306,323),
`replicaCount: 1` (:6). MEASURED. We declare `200Gi` — **6.7× the chart default.** The Application
carries `zeta.io/sync-policy: manual` and `replicaCount: 0` with `models.pull: []`. **Day-zero
floor: 0 GiB — no Application applied, no PVC object.**

What the ceiling is actually made of, **MEASURED** from the Ollama registry manifests
(`registry.ollama.ai/v2/library/<model>/manifests/<tag>`, summing layer sizes):

| model | size |
|---|---|
| `deepseek-coder:33b` | **17.53 GiB** |
| `qwen2.5-coder:32b` | **18.49 GiB** |
| `nomic-embed-text:latest` | **0.26 GiB** |

The first two are the models commented out in `models.pull`; the second and third are what
`weaviate`'s two Ollama modules point at. **The working set the manifests actually name is
36.3 GiB.** So 200Gi is room for roughly ten such models — a library, deliberately.

> **A concrete defect in `minimal`:** its ollama row is `10Gi`, which **cannot hold a single one of
> the models this repo names.** Not `deepseek-coder:33b` (17.5), not `qwen2.5-coder:32b` (18.5) —
> which is also the model `weaviate.generative-ollama` requires. The row's consequence text says
> "room for one small quantised model", and that is true only for models smaller than any the tree
> mentions. CALCULATED from MEASURED registry sizes.
>
> **Chart-derived day-zero if the phase is ever re-enabled: `48Gi`** (36.3 GiB working set + pull
> headroom, since Ollama writes a blob then commits it). That is coincidentally the `standard` rung's
> value, which is the one honest rung for this row.

**vLLM.** No chart — `applications/vllm/deployment.yaml` carries a standalone `vllm-cache` PVC at
`200Gi` with `replicas: 0` and `zeta.io/sync-policy: manual` on its Application. **Day-zero floor:
0 GiB.** The declared model is `deepseek-ai/deepseek-coder-33b-instruct`. **MEASURED** via the
HuggingFace API (`?blobs=true`, summing `siblings[].size`): the repo totals **124.2 GiB**, of which
the `safetensors` shard set alone is **62.1 GiB** — and `safetensors` is what vLLM downloads. So one
model ≈ 62 GiB of HF cache; `200Gi` is room for three. `minimal`'s `10Gi` holds **none** of it.

**ARC model-cache.** The `gha-runner-scale-set` 0.12.1 chart **has no persistent model cache
concept at all** — its only storage references are commented `containerMode.type: kubernetes`
examples at `storage: 1Gi` (values.yaml:126, :389). MEASURED. So there is **no chart default to
compare against**; the `100Gi` RWX PVC is entirely ours. Its stated working set is the manifest's
own comment: "instead of ~16GB per tick over the network"
(`applications/arc-runner-set/Application.yaml:66-67`). **100Gi is ~6× a working set the manifest
itself sizes at 16 GB.**

And it is **orphaned** — no Application applies `model-cache-pvc.yaml`; tracked as
`workitems/081M0JM6SSG087G0R0029X3F6Z-arc-runner-mounts-arc-model-cache-a-pvc-nothing-applies-the.md`.
**Day-zero floor: 0 GiB**, and that zero is a bug's shadow rather than a design choice — the warm
runner (`minRunners: 1`) stays Pending on a claim that does not exist. **Chart-derived day-zero once
the bug is fixed: `24Gi`** (16 GB stated working set + headroom).

### 2.8 The small rows

| claim | chart default (MEASURED) | floor | day-zero | note |
|---|---|---|---|---|
| `redis/master` | `master.persistence.size: 8Gi` (values.yaml:508) | none | **`4Gi`** | RDB/AOF spill only; Redis's `stop-writes-on-bgsave-error yes` makes a full disk a loud write refusal. **No consumer in the tree** — grepped for `redis.redis.svc` / `redis-master`: zero hits. MEASURED. |
| `redis/replica` | `8Gi` (:990), `replicaCount: 3` (:652) | none | **`4Gi` × 1** | our `replicaCount: 2` is *below* the chart default of 3; replication is asynchronous, so there is no quorum at stake. |
| `hindsight/postgres` | `postgresql.persistence.size: 8Gi` (values.yaml:136) | none | **`8Gi`** = chart default | our `20Gi` is 2.5× the default. This is the semantic-memory store and the ledger correctly calls it the first cut to revisit — but the chart author's 8Gi is a defensible day-zero, and Postgres refuses writes rather than losing data. |
| `headscale/data` | **no chart default exists** — `persistence` in headscale 0.4.0 declares only `config` (values.yaml:47-52). `persistence.data` is a user-supplied entry consumed by the bjw-s `common` library, whose own default is `size: 1Gi` (charts/common/values.yaml:517) | none | **`2Gi`** | SQLite node DB; 2Gi holds far more nodes than this cluster will have. |
| `oz/data` | `persistence.size: 2Gi` (values.yaml:428), with the chart author's comment: **"2GiB is enough for tens of thousands of entities, but feel free to make it larger"** | none | **`2Gi`** | the clearest chart-author statement of intent in the whole set. Our `large` is 5Gi. **Read from 1.3.4 — see §7.1, the pinned 1.4.5 does not exist.** |
| `agent-memory/memory` | no chart (in-repo StatefulSet, `busybox:1.36`) | none | **`4Gi`** | manifesto §5 surface; filling it is memory loss, so this is a row to grow *first* when there is room. |
| `platform/portal` | no chart (in-repo StatefulSet) | none | **`5Gi`** | single writer of the Room log; the manifest says the volume is the source of truth. `large` and `standard` are already 5Gi; there is nothing to cut. |
| `game-hosting-gmod/data` | no chart (in-repo StatefulSet, steamcmd `+app_update 4020 validate`) | app 4020 is **3.64 GB** to download ([SteamDB / GMod dedicated server](https://steamdb.info/app/4020/), RESEARCHED) ⇒ ~3.4 GiB installed | **`8Gi`** | `minimal`'s `4Gi` = 4.0 GiB leaves ~0.6 GiB after the base install, and `validate` needs scratch. **Marginal, and the sample workload is not on the PoC path** — a candidate for deletion rather than sizing. |

## 3. The table Aaron asked for

Per **PVC**, at the pinned chart version. "Declared" = today's tree (`large`). Day-zero pod counts
are honest for `nodeCount: 1`.

| claim | chart default | our declared | direction | documented / mechanical floor | **day-zero** | pods | **GiB** |
|---|---|---|---|---|---|---|---|
| `full-ai-cluster/cockroachdb/data` | **100Gi** × 3 | 100Gi × 3 | **equal** | ~11 GiB (ballast: ≥10 GiB free after creation) | **16Gi** | 1 | **16** |
| `infra/cockroachdb/data` | **100Gi** × 3 | 8Gi × 3 | 12× under | same — **8Gi is below it at every rung** | **16Gi** | 1 | **16** |
| `mimir/ingester` | **2Gi** | 50Gi × 3 | 25× over | none; 13h local TSDB retention | **4Gi** | 3 | **12** |
| `mimir/store-gateway` | **2Gi** | 50Gi × 3 | 25× over | none (cache) | **2Gi** | 3 | **6** |
| `mimir/compactor` | **2Gi** | 50Gi | 25× over | 150 GB per 10M active series | **4Gi** | 1 | **4** |
| `kube-prometheus-stack/prometheus` | **none** (`storageSpec: {}`) | 100Gi | ∞ / 2× the commented example | none; formula + 80-85% `retentionSize` | **16Gi** + `retentionSize: 12GiB` | 1 | **16** |
| `kube-prometheus-stack/grafana` | 10Gi (disabled) | 10Gi | equal-when-enabled | none | **2Gi** | 1 | **2** |
| `kube-prometheus-stack/alertmanager` | **none** (`storage: {}`) | 10Gi | ∞ | none | **2Gi** | 1 | **2** |
| `weaviate/data` | **32Gi** | 100Gi | 3.1× over | none; 90% ⇒ shard READONLY | **8Gi** | 1 | **8** |
| `nats/jetstream` | **10Gi**, 1 pod | 20Gi × 3 | 2× over, 3× pods | none; `max_file_store` = PVC size | **4Gi** | 1 | **4** |
| `tempo/traces` | **10Gi** (disabled) | 50Gi | 5× over | none; `retention: 24h` binds first | **10Gi** | 1 | **10** |
| `redis/master` | **8Gi** | 10Gi | 1.25× over | none | **4Gi** | 1 | **4** |
| `redis/replica` | **8Gi** × 3 | 10Gi × 2 | 1.25× over, fewer pods | none | **4Gi** | 1 | **4** |
| `hindsight/postgres` | **8Gi** | 20Gi | 2.5× over | none | **8Gi** | 1 | **8** |
| `headscale/data` | — (lib default 1Gi) | 5Gi | 5× the lib default | none | **2Gi** | 1 | **2** |
| `oz/data` | **2Gi** | 5Gi | 2.5× over | none ("2GiB is enough for tens of thousands of entities") | **2Gi** | 1 | **2** |
| `agent-memory/memory` | — (in-repo) | 10Gi | — | none | **4Gi** | 1 | **4** |
| `platform/portal` | — (in-repo) | 5Gi | — | none | **5Gi** | 1 | **5** |
| `game-hosting-gmod/data` | — (in-repo) | 20Gi | — | 3.64 GB base install | **8Gi** | 1 | **8** |
| `ollama/models` | 30Gi (disabled) | 200Gi | 6.7× over | model-driven: 17.5–18.5 GiB each | **0** (not applied) | — | **0** |
| `vllm/hf-cache` | — (in-repo) | 200Gi | — | 62.1 GiB for the model it names | **0** (not applied) | — | **0** |
| `arc-runner-set/model-cache` | **none in chart** | 100Gi | — | ~16 GB stated working set | **0** (orphaned) | — | **0** |
| | | | | | | | **133 GiB** |

**Day-zero floor: 133 GiB** (REQUESTED) at `nodeCount: 1`.
**With honest 3-node HA replica counts: 209 GiB** (cockroach ×3 both trees, mimir unchanged at 3,
nats ×3, redis replica ×2).
**CONSUMED on day zero, in both cases: effectively 0** — Longhorn is thin-provisioned and no
component has data yet.

Against the existing ladder: `minimal` 200 · `standard` 595 · `large` 1599 (all REQUESTED).

## 4. Answering "is cockroachdb the largest?" — no, and it is worth knowing why

Largest-first, at the **declared `large`** profile, by application:

| application | GiB | of which scheduled at bring-up |
|---|---|---|
| **mimir** | **350** | 350 |
| **cockroachdb** (both trees) | **324** | 324 |
| ollama + vllm | 400 combined | **0** |
| weaviate | 100 | 100 |
| prometheus stack | 120 | 120 |
| arc model-cache | 100 | **0** |
| nats | 60 | 60 |
| tempo | 50 | 50 |
| everything else | 95 | 95 |

So the intuition is *nearly* right and lands one row off. **CockroachDB is the largest single
database; Mimir is the largest single application**, because three of its components each render
into multiple zone-aware pods and each was sized from a ten-million-series preset.

At the **day-zero floor**, the ordering changes again: mimir **22**, cockroachdb **32** across both
trees (**16** if only one tree is live), prometheus stack **20**. Nothing dominates — which is the
real answer to "why do we need that much": **we do not, and no single row is where the 1599 came
from.** It came from three sources at once, each independently defensible and jointly not:

1. **Chart defaults adopted verbatim where the default is a production default** — cockroachdb 100Gi
   × 3 is *exactly* what the chart ships, and the chart ships it for a cluster with tenants.
2. **A sizing preset lifted from the wrong tier** — mimir's 50/50/50 is Grafana's ten-million-series
   file.
3. **Deferred capacity counted at full price** — 400 GiB of ollama+vllm that no fresh sync creates.

## 5. Where this disagrees with the existing `minimal` profile

Per the brief, **nothing here was edited**. These are the disagreements, for Aaron's call:

1. **`infra/cockroachdb/data` at `8Gi` is below CockroachDB's ballast floor in all three profiles.**
   Not a `minimal` consequence — a standing property. A store that small never gets an emergency
   ballast (the doc requires ≥10 GiB free *after* creating it), so the documented recovery from a
   full disk is unavailable on that node. **Suggested: 16Gi at every rung.**
2. **`ollama` at `minimal: 10Gi` cannot hold any model this repo names** — the smallest is
   `qwen2.5-coder:32b` at 18.49 GiB, which `weaviate.generative-ollama` requires. The row's stated
   consequence ("room for one small quantised model") is true only for models that appear nowhere in
   the tree.
3. **`vllm` at `minimal: 10Gi` cannot hold its named model** — `deepseek-coder-33b-instruct` is
   62.1 GiB of safetensors.
4. **Prometheus should get `retentionSize`, not a retention cut.** The `minimal` row's instruction to
   cut `retention` to ~3d is a guess that 3d fits 16Gi; `retentionSize: 12GiB` is a guarantee, and
   it is inside Prometheus's own documented 80-85% headroom rule. This one is worth applying at
   *every* rung, `large` included, because 100Gi with time-only retention is still unbounded in
   principle.
5. **Tempo's consequence text is directionally wrong at this cluster's scale.** "Trace retention
   window shrinks roughly proportionally, 50Gi → 8Gi" assumes disk is the binding constraint. With
   `tempo.retention: 24h` at chart default and no OTLP producer yet, **retention binds, not disk** —
   cutting 50Gi → 8Gi costs nothing today.
6. **Weaviate's effective capacity is 90% of the PVC, not 100%**, and the failure is a recoverable
   READONLY shard rather than a hard ingest failure. Worth correcting in the row so the number is
   read correctly.
7. **`game-hosting-gmod` at `minimal: 4Gi` is marginal** against a 3.64 GB base install with a
   `validate` pass. The row is a sample workload — deleting the app is a cleaner answer than sizing it.
8. **`minimal` is not actually minimal.** A floor derived from chart mechanics is **133 GiB**, about
   two thirds of `minimal`'s 200, and it spends the bytes differently: *more* on cockroachdb (16 vs
   8 in `infra`) and prometheus's governor, *far less* on mimir (22 vs 32) and the deferred model
   caches (0 vs 28).

## 6. What none of this measures — the open questions, named rather than filled

1. **Active series count.** Every mimir and prometheus number above is conditional on it. Closing
   measurements: `prometheus_tsdb_head_series`, `sum(cortex_ingester_memory_series)`. Until then the
   40k / ≤100k figures are **ASSUMED**, and they are the only assumed inputs in this document.
2. **Trace and log volume.** No OTLP producer is wired, so tempo's number is a chart-default
   fallback rather than a derivation.
3. **Actual consumed bytes.** Nothing here is a disk-usage measurement; `kubectl exec` + `df`, or
   Longhorn's `actualSize` per volume, is the check. Given no workload has data, it would read ~0
   for every row — which is itself worth confirming rather than assuming.
4. **Whether both cockroachdb trees are live.** `argocd/zeta-root` is declared twice
   (`acknowledgedRootAppDuplicates`); at most one can own that identity. The 133 GiB total counts
   both, which is the unfavourable reading a floor should take.

## 7. Two things found along the way that are not about sizing

### 7.1 `oz` pins a chart version that upstream never published

`full-ai-cluster/k8s/applications/oz/Application.yaml` pins `chart: ziti-controller`,
`targetRevision: 1.4.5`. **MEASURED:** `helm search repo openziti/ziti-controller --versions` returns
80 versions; the 1.x line is `1.1.x → 1.2.x → 1.3.0 … 1.3.4`, and the next release is `2.0.0`.
**There is no chart 1.4.5.** (`1.4.2` exists as an *appVersion*, on chart `1.2.2` — a plausible
origin for the mistake.) A sync of this Application will fail to resolve its chart. Sizing above was
read from `1.3.4`, the nearest published version, and is labelled accordingly.

### 7.2 `mise trust` is required before any tooling in a fresh clone

Every command in a fresh clone of this repo emits `mise ERROR ... are not trusted` on stderr before
its real output. It does not change exit codes, but it does mean a naive `2>&1 | head` reads as a
failure. Already recorded in the 2026-08-20 cluster analysis; repeating it because it cost time again.

## 8. Anchors

- CockroachDB production guidance, ballast semantics — Cockroach Labs docs
  ([production settings](https://docs.cockroachlabs.com/docs/stable/recommended-production-settings),
  [cluster setup troubleshooting](https://docs.cockroachlabs.com/docs/stable/cluster-setup-troubleshooting),
  [replication zones](https://docs.cockroachlabs.com/docs/stable/configure-replication-zones)).
  Raft quorum: Ongaro & Ousterhout, *In Search of an Understandable Consensus Algorithm* (USENIX ATC 2014).
- Prometheus TSDB sizing formula and the 80-85% `retention.size` rule —
  [prometheus.io/docs/prometheus/latest/storage](https://prometheus.io/docs/prometheus/latest/storage/).
  The two-hour block / WAL-checkpoint design is Björn Rabenstein & Fabian Reinartz's TSDB v3.
- Mimir compactor disk formula and ingester retention — Grafana Labs
  ([compactor](https://grafana.com/docs/mimir/latest/references/architecture/components/compactor/),
  [production tips](https://grafana.com/docs/mimir/latest/manage/run-production-environment/production-tips/)).
  Mimir descends from Cortex; the ingester/store-gateway/compactor split is Tom Wilkie & Julius Volz's
  Cortex architecture.
- Longhorn thin provisioning and the scheduling formula —
  [Longhorn 1.7.2 settings](https://longhorn.io/docs/1.7.2/references/settings/),
  [space consumption guideline](https://longhorn.io/kb/space-consumption-guideline/).
- Weaviate disk thresholds — [Weaviate best practices](https://docs.weaviate.io/weaviate/best-practices).
- Kubernetes PVCs cannot shrink — this is why the ladder is a one-way door, and it is a property of
  `PersistentVolumeClaim` resize semantics (expansion only, gated on `allowVolumeExpansion`), not a
  Longhorn limitation.

## 9. Pointers

- `full-ai-cluster/k8s/storage-profiles.json` — the catalogue this document argues with. Unchanged.
- `full-ai-cluster/k8s/single-node-budget.json` — `activeStorageProfile: large`, measured node
  capacity 1047 GiB.
- `src/Core.TypeScript/cluster/storage-profiles.ts` — the applier and the monotonicity check.
- `workitems/081M0JM6SSG087G0R0029X3F6Z-*` — the orphaned ARC model-cache PVC.
- `docs/research/2026-08-20-the-tests-are-green-the-cluster-is-not-and-the-observability-chain-is-broken-at-every-link.md`
  — why "no measured active-series count" is the state of the world rather than an oversight.
- `.claude/rules/toy-is-free-metered-must-be-earned.md` — the register discipline this document's
  MEASURED / RESEARCHED / CALCULATED / ASSUMED tags implement.
