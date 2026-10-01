# WP11 verdict 7: why 17 of 48 Applications did not converge (2026-10-01)

Work item 081M3VKMFPG087G0R0013MR0WS. Subject run: **36832486494** (main tip `07d5445638`),
WP11 installed-disk first-boot lane, verdict 7 FAILED: 26/48 Synced+Healthy, 17 unconverged,
1 undecidable (`dapr`), 4 excluded. Diagnostics run: **36856972760** (branch
`wp11-diag-dispatch` = main + PR #17812's capture), see Part B.

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

## Part B. Run 36856972760 (the instrumented dispatch)

*To be filled from the run's `qemu-k3s-first-boot-verify-serial-log` artifact.* The capture prints,
under `[wp11-cluster-diag]`, once at t>=900 s and once at the end: nodes, requests vs allocatable, the
Pending-reason census, describe + `logs --previous` for the worst non-Ready pods, `top`, Warning events, and ArgoCD's
conditions / failed tasks / non-Healthy resources for each unconverged app; plus a `k3s-exits` timeline
in the pressure sections. Per app, the table above is to be re-cut into CAP / DEFECT / ORDER / CP with log
lines.
