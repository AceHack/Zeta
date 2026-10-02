# Node disk headroom -- the 2026-10-02 DiskPressure event, what GitOps changed, and what needs an OS change

One real node (`node-5b2dfa`) went into `DiskPressure=True` and evicted ~150 pods while its Longhorn disks
sat nearly empty. This page records what was measured, what landed in the tree (GitOps only, the cluster
tracks `main`), and the options that need an OS change or a reinstall and were deliberately **not** done.

Read [what is proven and what is not](#what-is-proven-and-what-is-unproven) before trusting any line below.

## What was measured

All figures below are MEASURED on the owner's node on 2026-10-02, read from the node and kubelet
(`/proxy/configz`, node summary), not inferred.

| Signal | Value |
| --- | --- |
| Event | 07:53Z `DiskPressure=True`; node tainted itself `node.kubernetes.io/disk-pressure:NoSchedule` |
| Pods evicted | ~150, mostly the crash-looping `hindsight` api / control-plane pods; **168** `Failed` pod objects accumulated; CI job pods went `Pending` |
| Root filesystem (`/dev/nvme0n1p2`) | 126.8 GB capacity, 85.6 GB used at peak (~119 GiB usable) |
| imagefs (containerd images) | 36.8 GB |
| Nix store | ~12 GB |
| `/home/zeta` (dev toolchain) | ~12 GB |
| Pod ephemeral storage, total | only ~4 GB at the time |
| Heaviest pod ephemeral consumers | a GitLab CI job pod (kaniko build) 1.8 GB; `argocd-repo-server` 1.6 GB |
| Longhorn disks | separate devices, nearly empty -- **not** where the pressure was |

Kubelet config on that node (read via `/proxy/configz`):

| Threshold | Value | What it means on this disk |
| --- | --- | --- |
| `evictionHard` `imagefs.available` | 15% | evict when **< ~19 GiB** free on the image filesystem |
| `evictionHard` `nodefs.available` | 10% | evict when < ~12 GiB free on the root filesystem |
| image GC high / low | 85% / 80% | start deleting unused images at 85% used, stop at 80% |

**Cause.** Several parallel kaniko / dotnet / node image-heavy GitLab CI pipelines briefly pushed imagefs free
space under 15% (the runner was `concurrent = 4`, no per-job storage bound). Pods were then evicted. The
`hindsight` Deployments sit in `CreateContainerConfigError` because the operator-supplied LLM key Secret
`hindsight-llm-api-key` does not exist yet, and **each eviction made its Deployment create another failed
pod** -- that feedback loop is what turned one pressure spike into 168 `Failed` objects. Eviction clutter
holds no disk itself; it is the amplifier and the noise, not the source.

The root filesystem is genuinely small for this roster: the installer sizes root at a computed 120 G floor
(the roster's unpacked container images, 73 G, plus OS/swap/logs 30 G, x1.15 --
`usb-nixos-installer/zeta-install.sh`, WP28). That floor is *the whole roster's images and nothing else*, so
it leaves almost no room for CI image builds -- which is exactly what ran.

## What landed (GitOps only -- no OS, NixOS or kubelet change)

1. **Per-job ephemeral-storage bound** -- `gitlab/Application.yaml`, runner `config.toml` template:
   `ephemeral_storage_request/limit` = 1Gi / 6Gi and `helper_ephemeral_storage_request/limit` = 64Mi / 2Gi
   (keys verified against gitlab-runner v17.6.0 `common/config.go`, the chart's appVersion at gitlab 8.7.0;
   the `*_overwrite_max_allowed` keys are unset so a job cannot raise them). 6Gi is ~3x the measured 1.8 GB
   kaniko build: a normal pipeline never touches it, a layer-cache runaway does -- and is then **evicted by
   the kubelet as one pod** instead of taking the node into DiskPressure.
2. **`LimitRange gitlab-ephemeral-storage`** (same Application, `extraObjects`, sync-wave -1) giving every
   container in the `gitlab` namespace that names none a default ephemeral-storage **limit of 6Gi** and
   **request of 256Mi**. The request is deliberately small -- it is a scheduler reservation charged to every
   GitLab container, and a large default would reserve more of a ~119 GiB root for idle pods than it saves.
   **No `ResourceQuota`**, on purpose: a quota that stops a CI burst would equally stop Gitaly from restarting,
   because a quota cannot tell job pods from GitLab's own.
3. **Runner `concurrent` 4 -> 2.** Worst case is then 2 jobs x (6Gi + 2Gi) = 16 GiB, inside the ~19 GiB the
   kubelet leaves free before it evicts; four was 32 GiB.
4. **`cluster-hygiene` Application** (`k8s/applications/cluster-hygiene/`, namespace `zeta-hygiene`,
   restricted PSA), two CronJobs and nothing else:
   - **`pod-janitor`** (every 10 min) reaps `Failed` / `Evicted` pod objects cluster-wide. "Older than N
     minutes" is implemented without a clock: a pod is **marked** (label) the first run it is seen `Failed`
     and **deleted** the next run if it still is, so every pod is Failed for at least one full interval
     (10 min) and stays readable for 10-20 min. Least privilege is enforced twice: RBAC is `get/list/patch/delete`
     on **pods only**, and a **ValidatingAdmissionPolicy** refuses that ServiceAccount's DELETE/UPDATE of any
     pod whose phase is not `Failed` -- RBAC cannot express "only terminated pods", so the janitor can never
     delete a running pod even if its script were wrong. Tiny requests/limits, `concurrencyPolicy: Forbid`,
     `backoffLimit: 0`, a 120 s deadline.
   - **`hindsight-secret-gate`** (every 2 min) holds hindsight's two Deployments at **0 replicas while
     `hindsight-llm-api-key` does not exist**, and restores them to their declared count the moment it does.
     The hindsight Application now pins `api.replicaCount` / `controlPlane.replicaCount` (1, the chart
     default) and ignores `/spec/replicas` on exactly those two Deployments (`ignoreDifferences` +
     `RespectIgnoreDifferences=true`), so ArgoCD neither fights the gate nor reports drift. Its render still
     declares 1 replica each, so every resource ledger prices hindsight at the size it has once the operator
     supplies the key, and `hindsight` stays a `converges-only-after-an-operator-action` app (automated sync,
     reads `Synced`; only its health may lag). The gate never reads the Secret's value, never invents one, and
     treats a **failed probe as UNKNOWN** -- it scales only on a definite answer.

Falsifiers: `src/Core.TypeScript/cluster/cluster-hygiene.test.ts` (runs both scripts against a stub
`kubectl`, pins the RBAC, the admission policy, and that the gate's desired replicas equal hindsight's
declared ones) and `gitlab-runner-bringup.test.ts` (b)(i) (concurrency <= 2, the ephemeral keys, the
LimitRange, and that the worst case fits under the eviction threshold).

### Behaviour worth knowing

- **First sync window.** hindsight's own sync creates its Deployments at 1 replica; for up to one gate interval
  (2 min) a fresh install has them up with no Secret, then the gate takes them to 0 and the pods are *deleted*
  (not `Failed`). That bounded window is the price of not rendering `replicas: 0`, which would make every
  ledger under-count the app and trip the zero-pod census.
- **The LimitRange also defaults GitLab's own pods** (6Gi limit). The node's whole pod-ephemeral total was ~4 GB
  during the event, so GitLab's pods are far below it -- but a very large repository could make Gitaly exceed
  6Gi of *container-local* scratch and be evicted. If that is ever observed, raise the LimitRange `default`
  (one line) rather than removing it.
- **The kubelet evicts on a pod's SUM of limits**, so the per-job ceiling is 6Gi + 2Gi = 8Gi, not 6Gi.

## What needs an OS change or a reinstall (NOT done here)

None of these was attempted: the task was GitOps-only and each one changes the host. They are listed with their
trade-offs so the owner can choose.

| Option | What it changes | Pros | Cons / risks |
| --- | --- | --- | --- |
| **A. Bind-mount containerd (and optionally kubelet) data onto the big disk** -- `/var/lib/rancher/k3s/agent/containerd` (images + snapshots) and `/var/lib/kubelet` (emptyDirs, pod ephemeral) onto a separate filesystem | NixOS `fileSystems` bind mounts / a dedicated partition; k3s `--data-dir` is the alternative | Moves the *actual* pressure source (imagefs 36.8 GB and growing with CI builds) off the 119 GiB root, to space that is nearly empty; the imagefs eviction threshold then measures the big disk | **Do not share a filesystem with Longhorn's replica data path**: Longhorn computes disk availability from the whole filesystem, so image churn would shrink what it believes it can place and `storageMinimalAvailablePercentage` (25) interacts with the kubelet's 15% imagefs line -- two controllers reacting to one number. Use a *dedicated* partition or disk for containerd. Migration needs k3s stopped and the existing tree copied (or images re-pulled); first boot after is slow. Touches the installer layout |
| **B. Enlarge root at install time** -- `LONGHORN1_TAIL=<size>` (`zeta-install.sh`) makes root take what is left after a larger longhorn tail | Reinstall with a different partition split; root floor is 120 G today | Simplest mental model, no bind mounts; every disk-pressure threshold scales with root | **Requires a reflash/reinstall** of the node (partitions are laid out once), so it costs the node's state unless restored from backup; takes capacity away from Longhorn, whose disks are separate on this box but *are* the replica budget on a single-disk install (the very inversion WP28 fixed) |
| **C. Lower the imagefs eviction threshold** via a k3s `--kubelet-arg=eviction-hard=...` | NixOS: `k3s-server.nix` / `k3s-kubelet-reservations.sh` | One line; fewer evictions during a CI burst | **Treats the symptom.** It trades "evict at ~19 GiB free" for "evict at less", i.e. closer to a full disk where containerd and the kubelet themselves fail. `--eviction-hard` REPLACES the whole map (all four signals must be restated -- the repo already learned this), and the reservations script owns those flags. Image GC (85/80%) must also move or it will not run before eviction |

### Recommendation

**Option A with a dedicated partition**, applied at the next planned reinstall together with B's larger root if the
hardware allows. Rationale: the evidence says the pressure is *imagefs* (the CI job pods and image pulls), the
Longhorn disks are idle, and A is the only option that attacks the source rather than the threshold. Until
then the GitOps changes above are the real protection: they bound the **rate** at which CI can consume the
scarce space (2 jobs x 8 GiB ceiling) and remove the amplifier (hindsight failed-pod storm, clutter). **Do not
do C alone** -- it only lowers the alarm.

If A is not possible, the cheapest safe step is B at the next reinstall; if neither is, keep `concurrent`
at 2 and watch `kubectl describe node` for `DiskPressure` during the first heavy pipeline day.

## What is proven and what is unproven

**Proven (offline, in tests that fail without the change):**

- the rendered GitLab release carries `concurrent <= 2`, the four ephemeral-storage keys, a `LimitRange`
  ahead of the pods it defaults, and a worst case under the eviction threshold (`gitlab-runner-bringup.test.ts`);
- both CronJob scripts behave as specified against a stub `kubectl` (reap-before-mark and failure paths;
  the gate's full decision table including *failed probe = unknown*), the RBAC is pods-only / name-scoped, and
  the gate's desired replicas equal hindsight's declared ones (`cluster-hygiene.test.ts`);
- the key names are real runner config keys (read from `gitlab-runner` v17.6.0 source).

**Proven live, on a THROWAWAY `rancher/k3s:v1.35.6-k3s1` container (not the owner's node)** -- the manifests were
applied and the CronJobs' own scripts run as their ServiceAccounts:

- the janitor's `kubectl label pods --all-namespaces --field-selector=status.phase=Failed ...` is accepted with
  no names; run 1 marked two Failed pods, run 2 deleted exactly those two and marked a new one, and left a
  `Pending` pod untouched;
- the ValidatingAdmissionPolicy compiles (empty `typeChecking`) and **denies** that ServiceAccount's DELETE and
  label-UPDATE of a non-`Failed` pod, while the admin user is unaffected;
- the gate, as its ServiceAccount, took `hindsight-api` / `hindsight-control-plane` 1 -> 0 with the Secret absent
  (the name-scoped RBAC answered NotFound, not Forbidden), 0 -> 1 once it existed, was a no-op on the third
  run, and the same ServiceAccount is Forbidden from listing secrets or reading any other one.

**Unproven (no live evidence yet):**

- that ArgoCD leaves a live `/spec/replicas` alone under `RespectIgnoreDifferences` on this chart (no ArgoCD in
  the throwaway cluster);
- the CronJob pods themselves (restricted PSA admission, the `registry.gitlab.com/.../cng/kubectl:v17.7.0` image
  pull on the node): the scripts were run from outside the cluster, as their ServiceAccounts, not as pods;
- that the runner, with `ephemeral_storage_limit`, gets a kaniko build evicted *cleanly* (not wedged) at 6Gi;
- anything about the real node: none of this has been applied to `node-5b2dfa`.
