# WP11 verdict 7: why 17 of 48 Applications did not converge (2026-10-01)

Work item 081M3VKMFPG087G0R0013MR0WS. Subject run: **36832486494** (main tip `07d5445638`),
WP11 installed-disk first-boot lane, verdict 7 FAILED: 26/48 Synced+Healthy, 17 unconverged,
1 undecidable (`dapr`), 4 excluded. Instrumented run: **36875247887** (branch `wp11-diag-dispatch3` =
main + the cluster-diag capture + the dwell fix), verdict 7 FAILED again, 19/49, 26 unconverged: Part B.
A follow-up run with a better-ordered capture is **36887261429** (branch `wp11-diag-dispatch4`); its
per-Application sections will fill the rows still marked OPEN.

## TL;DR

**The roster cannot fit the guest, and the control plane then dies of it.** Measured on the live node
before anything collapsed (t=922 s): container requests are **9095 m CPU against 3250 m allocatable (279%)
and 21.6 GiB memory against 8.9 GiB (242%)**; 60 of 132 pods are not Ready and **every Pending pod is
Pending for capacity** (`Insufficient cpu` x48, `Insufficient memory` x17). `kubectl top` reads the node at
**109% CPU, 93% memory**. Starved of CPU and disk, etcd stalls 3-10 s, the embedded controller-manager /
cloud-controller-manager loses its leader-election lease, **k3s exits 1**, and it did so **19 times** in the
run (every exit is `leaderelection lost`). Each outage then breaks Longhorn volumes, ArgoCD syncs, cert-manager
containers and the seed Jobs. So the 17 are not 17 defects: most are **CAP** (cannot be scheduled on this
guest, ever) and the rest are **CP** (casualties of the restarts).

Register: every claim below is tagged **measured** (a line in a named log), **inferred** (follows
from measured lines but nothing printed it), or **open** (no evidence yet). Nothing is rounded up.

## Part A. What run 36832486494's own log already proves

The verdict named the 17 apps but not why. The answer for most of them is not 17 defects. It is
one: **the control plane kept dying.**

### A.1 The control plane restarted 14 times (measured)

| fact | evidence (`qemu-k3s-first-boot-verify-serial.log`) |
|---|---|
| `k3s.service` `NRestarts=14` at t=3248 s, and in its 15th start (`ActiveState=activating`) when the verdict was taken | `[wp11-pressure] k3s-restarts` block, end capture |
| the first death, 06:27:28 (t=1171 s): `controllermanager.go:265 "leaderelection lost"` for `kube-system/k3s-cloud-controller-manager`, then `k3s.service: Main process exited, code=exited, status=1/FAILURE` | `[wp11-pressure] k3s-journal` of the api-unreachable capture |
| immediately before it, etcd was stalling: `apply request took too long` took=5.489 s / 3.226 s (expected 100 ms), `request stats ... time spent` 5-10 s, `apiserver was unable to write a JSON response: http: Handler timeout`, lease `Get ...?timeout=5s: context deadline exceeded` | same capture, 06:27:20-06:27:27 |
| that first k3s process lived 19 min 27 s and consumed 19 min 02 s CPU, **17.6 GB written to disk, 4.8 GB read, 4.2 GB in over the network** | `Consumed 19min 2.076s CPU time over 19min 27.232s wall clock time, 7G memory peak, 4.8G read from disk, 17.6G written to disk, 4.2G incoming IP traffic` |
| pressure at that moment: CPU PSI some avg10 **84%** / avg60 90%, IO PSI some avg10 **93%**, memory PSI some avg10 57% (full 9%), **0 kernel OOM lines** | `psi-cpu` / `psi-io` / `psi-memory` / `kernel-oom` sections |
| pressure at the end: CPU some avg300 **74%**, IO some avg10 75% / avg300 58%, memory some avg300 44% (full 10.6%), 0 OOM lines, `free -m`: 11957 total / 6447 used / 5509 available, swap 0 | end capture |
| 10 of 65 roster probes could not reach the API at all (t=1244, 1334, 1413, 1494, 1574, 1655, 1835, 1924, 2045, 2215), and there is a **555 s hole** between sample 59 (t=2482) and sample 60 (t=3037) during which the unit's own `kubectl` calls were blocked | roster progress lines |

**Reading (inferred, strongly supported):** this is not an out-of-memory node (no OOM kill, 5.5 GiB
available at the end). It is a node whose **CPU and disk throughput** are saturated by the pull+unpack+start
of ~140 pods on a CI-grade virtual disk. etcd's fsync/apply latency passes the ~10 s lease renew window
of the embedded cloud-controller-manager, **k3s treats `leaderelection lost` as fatal and exits 1**, systemd
restarts it, and every restart re-runs the apiserver/etcd warm-up on the same starved disk.
Nothing in `full-ai-cluster/nixos` tunes `leader-elect-*` or etcd heartbeat/election for this
(`grep leader-elect|etcd-arg` over the modules: no hits outside this verifier).

### A.2 The roster plateaued, then collapsed, then plateaued lower (measured)

`Synced+Healthy / appCount` by sample: 23/48 at t=1080 s, 25/48 at t=2409 s (its **peak**), 10/48 at
t=2258-2295 s with `zeta-root sync=Unknown` (apiserver/ArgoCD mid-restart), 25/48 at t=2409-3185 s, 26/48 at the
end. About 17-23 Applications were `progressing` for **more than 2000 seconds**. That is not slow
convergence; it is a stuck set.

### A.3 The `Degraded` block is one event, not seven defects (measured + inferred)

Seven Applications carry a `health.lastTransitionTime` to `Degraded` inside a **52-second window**:
`forgejo` and `headlamp` 10:46:13Z, `cdi` 10:46:27Z, `argo-workflows` 10:46:47Z, `arc-controller` 10:46:50Z,
`kube-prometheus-stack` 10:47:05Z (`mimir` is Degraded too; its timestamp was not captured because its
diagnostic call hit a dead API). 10:46Z = 06:46 EDT = t~2290-2340 s, **the exact minute the roster fell from 25 to 10
and recovered** (samples 53-55). Simultaneous transitions across unrelated charts point at one cause
(the control plane), not at seven independent chart defects. What they *stayed* Degraded for after the
API came back is **open**: the log has no pod-level evidence for it (this is the gap PR #17812 closes).

### A.4 The per-app dump ran after the witness left (measured)

`roster_app_diag` runs at the very end. By then k3s was starting for the 15th time, so for `kubevirt`,
`mimir`, `platform`, `postgres-shared` the entire diagnostic is
`The connection to the server 127.0.0.1:6443 was refused`, and the `dapr` scheduler-reason probe
failed the same way. The three apps that did return something (`cdi`, `kube-prometheus-stack`, plus empty
objects for `arc-controller`, `argo-workflows`, `forgejo`, `headlamp`) are below.

## Part A table: the 17 + `dapr`, on the evidence available before run 36856972760

Buckets: **CAP** pending for capacity (node cannot hold it), **DEFECT** a real defect in the app or its
config, **ORDER** waiting on something it depends on, **CP** casualty of the control-plane restarts, **OPEN** no
evidence yet. A bucket here is a hypothesis unless the evidence column says *measured*.

| app | final state | evidence (measured unless marked) | bucket (today) |
|---|---|---|---|
| agent-memory | Synced / Progressing | Progressing from its first sample to the end; no pod data | OPEN |
| arc-controller | Synced / Degraded since 10:46:50Z | sync op `successfully synced (all tasks run)`; in the 52 s window of A.3 | CP (inferred), cause of staying Degraded OPEN |
| argo-workflows | Synced / Degraded since 10:46:47Z | earlier `health=Unknown: failed to get resource health for CustomResourceDefinition workflowartifactgctasks.argoproj.io ... failed to get r[esource]` = ArgoCD could not read the API; in the A.3 window | CP (inferred), staying-Degraded OPEN |
| cdi | OutOfSync / Degraded (manual-sync app, first-synced once by `zeta-virt-first-sync`) | operation: `one or more synchronization tasks are not valid: failed to discover server resources for group version ... dial tcp 10.99.192.1:443: connect: connection refused`; every failed task is `SyncFailed` with the same `connection refused` | **CP, measured**: its one first-sync ran while the API was down and nothing retries a manual app |
| cilium | Synced / Progressing for the whole run (from its first listing, t~455 s) | node was Ready at t=52 s (the HelmChart's Cilium works); the ArgoCD `cilium` Application never reaches Healthy; operator `replicas: 1` in `applications/cilium/Application.yaml` so it is not a single-node anti-affinity Pending | OPEN (a never-Healthy `cilium` Application on a Ready node is a defect candidate: what is not Ready in it?) |
| forgejo | Synced / Degraded since 10:46:13Z | A.3 window; no pod data | CP (inferred), OPEN |
| headlamp | Synced / Degraded since 10:46:13Z | A.3 window; no pod data | CP (inferred), OPEN |
| headscale | Synced / Progressing (was OutOfSync/Healthy at t~690) | no pod data | OPEN |
| kube-prometheus-stack | Synced / Degraded since 10:47:05Z | sync op `one or more synchronization tasks completed unsuccessfully, reason: Patch ...alertmanagerconfigs...: http2: client connection lost`; failed tasks are `PrometheusRule` / `Deployment kube-state-metrics` / `Namespace monitoring` patches, each `connection refused` | **CP, measured** for the sync failures; why it is still Degraded after a later successful sync is OPEN |
| kubevirt | OutOfSync / Progressing (manual-sync app) | diagnostic call hit dead API | CP (same mechanism as `cdi`, inferred), OPEN |
| mimir | Synced / Degraded | diagnostic call hit dead API; was Synced/Progressing, then Degraded in the same period | OPEN |
| nats | Synced / Progressing | no pod data | OPEN |
| opensearch | Synced / Progressing | no pod data | OPEN |
| orleans | Synced / Progressing | no pod data | OPEN |
| platform | OutOfSync / Progressing | `roster_app_diag` ranks it first (failed-sync row on run 36221053730); this run's call hit the dead API, so no failed-task list | OPEN |
| postgres-shared | OutOfSync / Unknown | diagnostic call hit dead API; `health=Unknown` is ArgoCD unable to evaluate health (CNPG `Cluster` CRD health check, cf. `cloudnativepg` earlier showing `failed to get resource health for CustomResourceDefinition clusters.postgresql.cnpg.io`) | CP (inferred), OPEN |
| redis | Synced / Progressing | no pod data | OPEN |
| dapr (undecidable) | Synced / Progressing | `the scheduler REFUSED to place pod dapr-system/dapr-placement-server-0` and later `dapr-scheduler-server-0` (`PodScheduled=False`); the refusal message was never read (API dead at the end) | **OPEN, and the only row with a real scheduler refusal**: reason (PVC? affinity? taint? capacity?) unknown |

Four more apps the verdict did NOT count as failures but that show the same weather: `cilium-lb-ipam`
(`sync=Unknown: unable to resolve parseableType for GroupVersion`), `keda` (`sync=Unknown: serverSideDiff error`), `cloudnativepg`
(`health=Unknown ... failed to get resource health`) all flapped to `Unknown` at t~1450-1880 s and recovered
(**measured**). That is ArgoCD's discovery cache failing against an API that is intermittently gone, a
second, independent confirmation of A.1.

### What Part A already settles

1. **The dominant cause is the node, not the manifests**: CPU+IO saturation drives etcd past the
   cloud-controller-manager's leader-election window, k3s exits 1 fourteen times, and ArgoCD's sync,
   health and discovery all fail during each outage. `cdi` and `kube-prometheus-stack` show it in their own sync records.
2. **It is not memory.** 0 OOM kills, 5.5 GiB available at the end, so shrinking memory requests
   again is not the lever. The lever is what keeps etcd's fsync path alive under load.
3. **Candidate fixes, not applied here** (they change the production control plane and belong in their own
   reviewed PR): widen `--kube-cloud-controller-manager-arg` / `--kube-controller-manager-arg` /
   `--kube-scheduler-arg` `leader-elect-lease-duration` / `leader-elect-renew-deadline` so a multi-second etcd stall is a delay,
   not a process exit; tune etcd `heartbeat-interval` / `election-timeout`; stagger the roster (a sync-wave or
   delayed second tranche) so ~140 pods are not unpacked on the same disk the datastore fsyncs to.
   Each needs the measurement from Part B first, because a lease widened over a *different* cause hides it.
4. **What still cannot be said** is, per app, whether it would be Healthy on an un-flapping node.
   That is Part B's question.

## Part B. Run 36875247887, the first instrumented run

Two captures, `[wp11-cluster-diag]` in `qemu-k3s-first-boot-verify-serial-log`: **mid** at t=922 s (lines
2728-3473) and **end** at t=3125 s (3908-4983). Both carry the state `failed`, honestly: at mid the API died
under the capture (k3s's first exit, 11:04:18, landed inside it) so 24 per-app sections and 14 describes read
`connection refused`; at the end the 1000-line budget was spent before the per-app sections (`get pods -o wide` alone took 400). Both defects of the
capture itself are fixed in PR #17831 (order is now priority, a short API re-wait, budget 1600, mid at 600 s).
What the capture did get is below. Everything is **measured** unless tagged.

### B.1 Capacity (mid, before the first control-plane death)

| fact | value |
|---|---|
| node allocatable | cpu 3250 m, memory 9111268 Ki (8897 Mi), pods 220 (guest: 4 vCPU / 11957 MiB, so 750 m and ~3 GiB are held back by the node reservations) |
| sum of container requests, 124 live pods | **cpu 9095 m = 279%**, **memory 21600 Mi = 242%** of allocatable |
| sum of memory limits | 23210 Mi = 260% (overcommit: eviction becomes possible) |
| live pods with no cpu / no memory request | 29 / 30 (BestEffort, scheduled anywhere, evicted first) |
| `kubectl top nodes` | **cpu 3573 m = 109%, memory 8312 Mi = 93%** |
| Pending census (60 not-ready of 132) | **48 `Pending: Insufficient cpu`, 17 `Pending: Insufficient memory`**, 7 Running-not-Ready, 2 ContainerCreating, 2 PodInitializing, 1 `last-terminated: Error` (`mimir-distributor`) |
| biggest requesters | opensearch-cluster-master-0 2 Gi/1 cpu; mimir-kafka-0 1 Gi/1 cpu; hindsight-api 1 Gi/0.5; seaweedfs all-in-one 1 Gi/0.5; argocd application-controller 512 Mi + repo-server 512 Mi; gatekeeper audit + controller 512 Mi each; **mimir: 17 pods, most 512 Mi** (distributor, 3 x ingester zone, store-gateway, compactor, ...) |
| end of run (130 live pods) | 9485 m = **291%** CPU, 22592 Mi = **253%** memory |

Nothing else in the Pending census: **no unbound PVC, no taint, no affinity mismatch, no image pull** in the
Pending set at mid. A Pending pod on this guest is a pod the node cannot hold.

### B.2 The control plane (end capture, `k3s-exits`, the timeline the first run could not give)

`k3s.service` exited `status=1/FAILURE` repeatedly; **`NRestarts=19`** at the end capture (0 kernel OOM lines, both captures;
IO pressure some-avg10 **96%** and CPU **84%** at the first death). Every exit in the captured
window is a lost lease: `controllermanager.go:368 "leaderelection lost"` (kube-controller-manager),
`controllermanager.go:265 "leaderelection lost"` (cloud-controller-manager), `level=fatal msg="leaderelection
lost for k3s"` and `... for k3s-etcd`. First process: 16 min 31 s wall, 12 min 30 s CPU, **17.7 GB written**, 4.3 GB
in. Later processes live 58 s to 4 min 21 s. The node was `NotReady` when the end capture ran. This confirms Part A
with the cause printed on the exit line, and it refutes "memory": no `OOMKilled` control-plane exit appears.

### B.3 Per-Application table (the unconverged set at the end of this run)

**CAP** = pods of the app were Pending for `Insufficient cpu/memory` (measured census / pods-wide, mid) and would
be on any run of this guest. **CP** = healthy or schedulable pods knocked over by control-plane exits.
**ORDER** = waiting on a dependency that was itself CAP/CP. **OPEN** = no pod-level evidence yet.
Namespaces map to apps one-to-one except `zeta-platform` = `platform` and `monitoring` = `kube-prometheus-stack`.

| app | state at end | evidence | bucket |
|---|---|---|---|
| agent-memory | Progressing | mid: `agent-memory-0` Pending (cpu). end: PVC `memory-agent-memory-0` `ProvisioningFailed: zeta-block-replicated ... longhorn-backend:9500 ... 500` | CAP, then CP (Longhorn) |
| arc-controller | Degraded | `arc-systems/arc-controller-gha-rs-controller` Pending, `Insufficient cpu` then `memory`, both captures | **CAP** |
| argo-rollouts | Progressing | mid: 2 pods Pending (cpu); end: ContainerCreating | CAP, then CP |
| argo-workflows | Progressing | mid: server + workflow-controller Pending (cpu); end: 1 Pending + 1 ContainerCreating | **CAP** |
| cdi | Degraded (manual-sync, one first-sync) | `cdi-operator` Pending **`Insufficient memory`** (end census); run 36832486494: first sync failed `connection refused` | **CAP** (+ CP) |
| cert-manager | Progressing | mid: 4/4 Running. end: **`RunContainerError` x2 (cert-manager, cainjector), last-terminated `StartError`**, trust-manager `Unknown` | **CP** (shims after k3s restarts) |
| cilium | Progressing | mid: every cilium/envoy/operator/hubble pod 1/1 Running, yet the Application never reaches Healthy in either run. **Run 36887261429 refutes the load-balancer hypothesis**: its end capture lists ZERO non-Healthy resources for `cilium` (operation `Succeeded successfully synced`), so no pending LoadBalancer Service or any other resource is holding it Progressing | **CP / health-evaluation lag (inferred)**, no longer a defect candidate; see D.2 |
| dapr | Progressing | `dapr-placement-server-0`, `dapr-scheduler-server-2`, `dapr-sidecar-injector` Pending. **This answers the old `undecidable` row: the scheduler refusal is `Insufficient`** | **CAP** |
| forgejo | Degraded | mid: `forgejo-...-ngcrq` Pending (cpu); end: 1 Pending + `seed-forgejo-admin` PodInitializing | **CAP** |
| headlamp | Progressing | mid: Pending (cpu); end: ContainerCreating; events: `Readiness probe failed: connection refused` | CAP, then CP |
| headscale | Progressing | `headscale-0` Pending, both captures | **CAP** |
| keda | Progressing | `keda-operator` Pending (cpu) at mid, 3 Pending at end (webhooks Running at mid) | **CAP** |
| kube-prometheus-stack | Degraded | `monitoring`: grafana (0/3), kube-state-metrics, operator, node-exporter all Pending at mid; 4 Pending + 1 Init at end | **CAP** |
| kubevirt | Progressing (manual-sync) | `virt-operator` x2 Pending at mid; end `Unknown` x2; events: `Liveness probe failed ... connection refused` | **CAP**, then CP |
| loki | Degraded | mid: `loki-write-0` Pending, `loki-backend-0` Terminating, `loki-read` 0/1; end: 2 Pending; events: readiness `context deadline exceeded`, `503` | CAP + CP |
| mimir | Degraded | **mid: 17 Pending**, `mimir-distributor` CrashLoop (restarts 5 -> 34, exit 1 then 255; its log lines were empty); end: 16 Pending. `mimir-kafka-0` (1 cpu) Pending is the likely upstream of the distributor loop | **CAP** (the largest single block), distributor **ORDER** (inferred) |
| nats | Progressing | `FailedMount ... MountDevice ... rpc error ... failed to get volume pvc-...` x3 (Longhorn volume unavailable) | **CP** (Longhorn) |
| opensearch | Progressing | `opensearch-cluster-master-0` (2 Gi / 1 cpu) Pending at both captures | **CAP** (biggest single pod) |
| openziti-controller | Degraded | `ziti-controller` Pending at mid, Init at end | **CAP** |
| orleans | Progressing | `orleans-silo-0` Pending (cpu) at both captures | **CAP** |
| platform | Degraded | `zeta-platform`: `platform-controller`, `portal-0` Pending at both captures | **CAP** |
| postgres-shared | Progressing | `postgres-shared-3` PVC `ProvisioningFailed: failed to get target node ... 10.99.192.1:443 connection refused`; `postgres-shared-2` startup probe 500; `postgres-shared-2-join` Job Failed | **CP** |
| redis | Progressing | `redis-valkey-0` Pending (cpu) at mid; `seed-redis-auth` Job x3 Failed (`BackoffLimitExceeded`, event `kube-root-ca.crt not registered`) | CAP, then CP |
| seaweedfs | Progressing | all-in-one pod (1 Gi / 0.5) replaced and Pending at end; `seed-blob-store` x4 `Init:Error`/`Init:Unknown`, `BackoffLimitExceeded` | CAP + CP |
| spire | Progressing | 3/3 Running at both captures; liveness `context deadline exceeded` on a starved node | **CP** (probes timing out on a starved node) |
| tempo | Progressing | `tempo-0` Pending (cpu) at mid | **CAP** |

Excluded by the verdict itself and unchanged: `hindsight` (needs an LLM key, operator action), `openbao` (sealed),
`ollama`, `vllm` (manual-sync, replicas 0).

Totals: **CAP is the primary bucket for 21 of the 26**: 15 purely (arc-controller, argo-workflows, cdi, dapr, forgejo,
headscale, keda, kube-prometheus-stack, kubevirt, mimir, opensearch, openziti-controller, orleans, platform,
tempo) and 6 CAP-then-CP (agent-memory, argo-rollouts, headlamp, redis, seaweedfs, loki); **CP** for 4
(cert-manager, nats, postgres-shared, spire); **OPEN** for 1 (`cilium`, resolved to CP in Part D).
**No row is a manifest defect.** The one candidate for a real defect (`cilium` never Healthy) has a named
config cause that is a property of the guest, not of the chart.

### B.4 What to do with it

1. **Shrink the roster to what the guest holds, or the guest to what the roster needs.** Requests must fall from
   ~9.1 CPU / ~21.6 GiB to inside 3.25 CPU / 8.9 GiB (the CI envelope already excludes gitlab, temporal and gmod
   hosting; it needs a second tranche, and `mimir` (17 pods), `opensearch`, `hindsight`, `kubevirt`+`cdi` are the
   large blocks the capacity table names). A real install on a 64 GiB box is unaffected, so this belongs in
   `k8s/wp11-ci-envelope.json`, not in the charts.
2. **Stop the control plane dying of a slow disk** (separate, reviewed change, it touches production k3s):
   widen `leader-elect-lease-duration` / `renew-deadline` for the controller-manager, cloud-controller-manager and
   scheduler so an etcd stall is a delay rather than `status=1`, and give etcd headroom
   (`heartbeat-interval` / `election-timeout`). Nothing in `full-ai-cluster/nixos` set any of these when this was measured; PR #17833 sets the leader-election windows.
3. Items 1 and 2 are independent and **both are needed for a green verdict 7**: with 1 alone the node is still
   at the edge of the lease window during the pull burst (17.7 GB written by the first k3s process); with 2 alone
   48 Applications still cannot be scheduled.

## Part C. Other defects the same two runs exposed

* **Scenario 4 (path-fork) timeout, run 36832486494: a real defect, fixed in PR #17813 (merged).** The baseline
  install printed `discovery heard nothing in 29999 ms`, `dwell-too-short`, `[zeta-discovery] HALTED`, then waited
  for a keypress for the full 1800 s. Cause: `probe.ts` slept once and re-read `Date.now()`; a timer can wake 1 ms
  early, `elapsedMs` landed on `dwellMs - 1`, and the (correctly strict) admissibility check refused. The same
  race hit scenario 2 of run 36856972760 (HALTED at 76 s, caught by the fail-fast marker that #17813 added to the
  zflash lane) before the fix was in, so it was not rare. Falsifier fails with the top-up disabled.
* **Whole-disk boot medium (open, not fixed here).** Runs 36856972760 and 36865505620 both failed WP11 in phase 1
  with `boot medium mounted from the WHOLE disk (/dev/sda)` although the install completed (run 36832486494 had
  `boot-medium=/dev/sda1`). `install-label-single-device.nix`'s `zeta-install-medium` rule is meant to make that
  impossible and did not take effect twice running; the ESP was still read through the mtools rung. Run
  36875247887 carried a dispatch-branch-only advisory (never merged) to get past it. This one needs its own
  investigation: it is a hard stop for the WP11 lane and, per the installer's own header, for a real USB stick.

## Part D. Run 36887261429 (second instrumented run, reordered capture, PR #17831)

Both captures finished `captured` this time (mid 280 lines, end 890 of a 1600 budget), which is what #17831 was for.
This run's control plane restarted **6** times (run 36875247887: 19), so it also shows how much that varies;
the result was 18/49 Synced+Healthy, 27 unconverged. Everything below is **measured**.

### D.1 It reproduces Part B

At t=600 s (mid) the node held 31 pods and requests were 1600 m / 3988 Mi, 49% / 44% of allocatable: the roster had
not landed yet, so a mid capture at 600 s is too early to show capacity (a finding about the capture, not the
cluster; 900 s was better). At the end: **133 live pods, requests 9480 m = 291% CPU, 23168 Mi = 260% memory**; 76 of 150
pods not Ready, 46 `Pending: Insufficient memory` and 5 `Insufficient cpu`. Same shape as Part B.

### D.2 The OPEN row, `cilium`: the load-balancer hypothesis is refuted

The end capture's per-Application section for `cilium` is two lines, `sync=Synced health=Progressing` and `operation:
Succeeded successfully synced (all tasks run)`, with **no resource listed as non-Healthy or non-Synced**. A pending
`LoadBalancer` Service would have been listed, so it is not that, and the "LOADBALANCER RANGE: NOT SET" banner is not
what holds `cilium` Progressing. An Application whose every resource is healthy but whose own health reads
Progressing is ArgoCD's aggregate lagging its resources, the same lag that flips `external-secrets`,
`cockroachdb` and `kubevirt` to `health=Unknown: failed to get resource health ...` in this run (`ComparisonError`,
measured). That is a control-plane casualty, not a chart defect. Row bucket: **CP (inferred)**.

### D.3 New per-Application evidence (the sections the first run lost)

| app | measured | bucket |
|---|---|---|
| mimir | operation `Failed`: webhook `prepare-downscale-mimir.grafana.com` call failed (`mimir-rollout-operator` not up), and **six Deployments `exceeded its progress deadline`** (querier, rollout-operator, query-scheduler, overrides-exporter, query-frontend, distributor) | CAP: a Deployment that cannot schedule is what exceeds its progress deadline |
| platform | **`PrometheusRule` / `ServiceMonitor` `SyncFailed: failed to discover server resources for group version monitoring.coreos.com/v1: forbidden: User "system:serviceaccount:argocd:argocd-application-controller" cannot get path "/apis/monitoring.coreos.com/v1"`**, operation stuck `Retrying ... Attempt #3` | **ORDER**: the CRD provider (`kube-prometheus-stack`) is itself CAP-blocked, so the group does not exist. **One real defect candidate**: `platform/monitoring.yaml` carries `SkipDryRunOnMissingResource` for exactly these two resources (a test asserts it), and it did not stop the sync failing here, because the failure is group *discovery* returning `forbidden`, not a missing-resource dry-run. Worth its own look |
| kube-prometheus-stack | `*-admission` ServiceAccount/Role/Job all `SyncFailed: failed to discover server resources ... apiserver not ready` / `connection refused` | CP, on top of the CAP pods |
| kubevirt | `virt-operator` restarts 12-13, `Liveness probe failed ... 8443/metrics connection refused`; every ClusterRole/Role/Deployment patch `SyncFailed ... dial tcp 10.99.192.1:443: connection refused`; health `Unknown` | CP |
| cdi | `SyncFailed ... connection refused` on every resource (the same first-sync-into-a-dead-API as run 36832486494) | CP + CAP |
| cockroachdb | operation `Retrying Attempt #2`; failed tasks are `error when retrieving current configuration of ...` and `clusterroles ... is forbidden: User "system:serviceaccount:argocd:..."` (apiserver unable to answer, RBAC read through a restarting API) | CP |
| cilium-lb-ipam-pool | `health=Missing`, `ComparisonError: Failed to load live state ... Get ".../ciliumloadbalancerippools/zeta-lb-pool": dial ...` | CP |
| node-feature-discovery | `nfd-worker` restart count 6, last state `Terminated Unknown / 255` | CP |
| agent-memory, argo-rollouts, argo-workflows, forgejo, headlamp, headscale, keda, loki, longhorn, openziti-controller, opensearch, orleans, postgres-shared, redis | `operation: Succeeded`, no failed task, no non-Healthy resource: health is Progressing/Degraded because their **pods** are Pending/not Ready, which is Part B's capacity table, unchanged | CAP / CP as in B.3 |

### D.4 What changed in the picture

* The capacity conclusion (B.1, B.3) holds on a second, independent run, including when the control plane was far
  healthier (6 exits vs 19). **Capacity alone leaves the verdict unreachable; control-plane exits make it worse.**
* `cilium` is no longer an open row.
* The one genuine defect candidate in the whole census is `platform`'s `monitoring.coreos.com` handling (D.3),
  not a chart and not capacity: a sync that fails on `forbidden` group discovery while the guard that is meant
  to tolerate a missing CRD group is in place.

## Part E. The `platform` defect candidate, adjudicated

Question: do `PrometheusRule` / `ServiceMonitor` fail with `failed to discover server resources for group version
monitoring.coreos.com/v1: forbidden ... cannot get path` because (a) the application-controller lacks `get` on that
non-resource URL, (b) the CRD group is not registered yet, or (c) the API server failed transiently?

* **(a) is excluded.** The same ServiceAccount was denied in the same capture on a *resource* verb its ClusterRole
  grants through `*`: `cockroachdb` `SyncFailed: ... cannot get resource "clusterroles" in API group
  "rbac.authorization.k8s.io" at the cluster scope` (run 36887261429, roster-diag JSON). A permission gap on one
  nonResourceURL does not explain a denial of `get clusterroles`; and `/apis/*` is granted to every authenticated user
  by `system:discovery` anyway.
* **(b) is not what that error says.** An unregistered group answers 404 to a *permitted* caller; the
  `SkipDryRunOnMissingResource` guard exists for that path. A `forbidden` is an authorization answer. (b) is real as an
  ordering fact (`kube-prometheus-stack` was itself capacity-blocked) and is why `platform` stayed non-Healthy, but it
  is not the cause of this message.
* **(c) fits every measurement.** One ServiceAccount, cluster-admin-equivalent, denied at cluster scope for both a
  resource and a path, in a run where k3s had just exited on a lost lease: a freshly restarted apiserver whose RBAC
  authorizer had not yet synced. The same outage produced `connection refused` on `cdi`, `kubevirt` and
  `kube-prometheus-stack`.

**What a manifest can still decide is whether the Application survives it.** ArgoCD's automated sync defaults to 5
attempts (~2.5 min) and never re-attempts a revision whose sync already failed; 5 of 50 Applications (and not the
root) had the unbounded `retry` that `platform` got after run 36221053730. Every automated Application, and
`zeta-root`, now carries `retry: {limit: -1, backoff: {duration: 30s, factor: 2, maxDuration: 5m}}`, pinned by
`src/Core.TypeScript/cluster/application-retry-unbounded.test.ts` (86 cases fail without it).

Not claimed: that the outage is fixed (the leader-election change #17833 and the capacity work address that), or that
an unbounded retry would have rescued every stranded row in these runs. The wave inversion `platform` -> `kube-prometheus-stack`
stays registered; this is the robustness fix, not repair (2).
