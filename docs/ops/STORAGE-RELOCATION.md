# Storage relocation -- stateful data off the 120 GB root, onto the Longhorn data disks

> **Carved sentence.** `rancher.io/local-path` has no quota, so a "20Gi" local PVC is an unbounded
> directory on whatever filesystem the node's root is -- and on the one real node that was a 120 GB
> disk holding 39 GB of container images, from which the kubelet evicts pods. The data that mattered
> (the production PostgreSQL clusters, the blob store behind the registry and the database backups,
> GitLab's repositories) belongs on the 1.7 TB of Longhorn disks beside it, which were ~98% free.
> Moving it frees **only ~6-9 GB** of a root that is 79 GB full, because the images are the bulk; the
> structural fix for that is an OS change and is the owner's decision (see the end).

Work item `081M3ZJ2SD1087G0R001CYQFZ3`. Companion to [`NODE-DISK-HEADROOM.md`](NODE-DISK-HEADROOM.md), which
records the 07:53Z DiskPressure event and the GitOps bounds on CI. Read
[what is proven and what is not](#what-is-proven-and-what-is-unproven) before trusting any line below.

## What was measured (node `node-5b2dfa`, 2026-10-02/03, read from the node)

| Signal | Value |
| --- | --- |
| Disks | `nvme0n1`: p1 1G `/boot`, p2 **120.5G ext4 `nixos` = `/`**, p3 810G ext4 `longhorn1`; `nvme1n1`: p1 931.5G ext4 `longhorn2` |
| Root filesystem | 118 GiB; **75.6 GiB used (68%)**, 36.4 GiB free; imagefs eviction line is 15% = ~18.6 GiB free |
| Root, by consumer | containerd **37.5 GiB** (`/var/lib/rancher/k3s/agent/containerd`) · kubelet 2.1 GiB · **all 22 local-path PVCs 8.6 GiB** · the rest (Nix store ~12 GB, `/home/zeta` ~12 GB, logs) |
| Longhorn disks | disk1 (`longhorn1`) 8.2 GB used, disk2 (`longhorn2`) 17.7 GB used; schedulable 598 + 688 GB, **scheduled 169 + 307 GB** |
| Longhorn replicas | **every volume `numberOfReplicas: 1`** (class `zeta-block-replicated` and the setting `default-replica-count`); 10 volumes on disk1, 17 on disk2 |
| Longhorn placement settings | `replica-soft-anti-affinity` **false** (node level), `replica-disk-soft-anti-affinity` **true**, `default-data-locality` disabled, `storage-minimal-available-percentage` 25, over-provisioning 100% |
| Default StorageClass | `zeta-block-local` = `rancher.io/local-path`, reclaim **Delete**, WaitForFirstConsumer, path `/var/lib/zeta-local-storage` (not `/var/lib/rancher/k3s/storage`) |

Measured with a read-only `hostPath` helper pod (busybox, 768Mi limit, `du`/`find`) while the node was **not**
under DiskPressure -- under pressure the kubelet evicts new pods instantly.

### Every local-path PVC, used bytes and who mounts it

| PVC | Used | Files | Mounted by | Owner in git | Decision |
| --- | ---: | ---: | --- | --- | --- |
| object-store/`blob-store-seaweedfs-all-in-one-data` | **2.51 GiB** | 202 | seaweedfs Deployment (Recreate) | `applications/seaweedfs` | **MOVE** |
| postgres-shared/`postgres-shared-1` (primary) | 0.99 GiB | 2875 | CNPG | `applications/postgres-shared` | **MOVE** (last) |
| postgres-shared/`postgres-shared-2`,`-3` (replicas) | 0.99 GiB each | 2882 | CNPG | same | **MOVE** (first) |
| gitlab/`repo-data-gitlab-gitaly-0` | 0.24 GiB | 675 | gitaly StatefulSet | `applications/gitlab` | **MOVE, last, owner-gated** (GitLab upgrade agent) |
| forgejo/`gitea-shared-storage` | 5 MiB | 17 | forgejo Deployment (Recreate), sqlite3 | `applications/forgejo` | **MOVE** (rehearsal of the claim swap) |
| gitlab/`gitlab-rails-db-1` | 0.76 GiB | 13266 | CNPG (gitlab) | `applications/gitlab` | leave -- the GitLab Application is not to be touched |
| gitlab/`data-gitlab-valkey-0` | 60 MiB | 4 | valkey | `applications/gitlab` | leave (same) |
| temporal/`temporal-postgres-1` | 0.57 GiB | 1854 | CNPG, `instances: 1` | `applications/temporal/postgres` | leave -- see "single-instance CNPG" below |
| dapr-system/`...scheduler-server-0/1/2` | 122 MiB each | 4 | dapr scheduler StatefulSet | `applications/dapr` | leave -- bounded etcd, immutable `volumeClaimTemplates` |
| loki/`data-loki-write-0`, `-backend-0` | 20 MiB, 0.8 MiB | 7, 1 | loki StatefulSets | `applications/loki` | leave -- cache/WAL, chunks are in the blob store |
| spire/`spire-data-spire-server-0` | 4.8 MiB | 4 | spire-server | `applications/spire` | leave -- tiny, early-wave |
| opensearch/`...master-0` | 0.8 MiB | 133 | opensearch | `applications/opensearch` | leave -- derived index, rebuildable |
| openbao/`data-openbao-0`, `audit-openbao-0` | 52 KiB, 4 KiB | 2, 0 | openbao | `applications/openbao` | leave -- a secrets store is not rehearsed on |
| mimir/`kafka-data-mimir-kafka-0` | **0.67 GiB** | 781 | **nothing** | `applications/mimir` | orphan -- report, do not touch |
| mimir/`storage-mimir-alertmanager-0` | 4 KiB | 0 | **nothing** | `applications/mimir` | orphan |
| gitlab/`data-gitlab-postgresql-0` | 0.34 GiB | 10083 | **nothing** (the bundled PG 14 the datastore migration replaced) | `applications/gitlab` | orphan -- the GitLab agent's to delete |
| gitlab/`redis-data-gitlab-redis-master-0` | 72 MiB | 3 | **nothing** | `applications/gitlab` | orphan -- same |

Total: **8.6 GiB**, of which 6.0 GiB is on the MOVE list. Four PVCs (1.1 GiB) have no consumer at all.

**Why "leave" is a decision and not neglect.** The things left are small (<1 GiB each), rebuildable, owned by an
Application someone else is changing right now, or a StatefulSet whose `volumeClaimTemplates` are immutable (moving
them means deleting the StatefulSet, which is more disruptive than the 120 MiB it would free). What they share with
the moved ones is the *unbounded* property -- which the fresh-install change below removes for every one of them.

## What this change does, in the repo

1. **`zeta-block-replicated` for the three Argo-owned stores** -- `postgres-shared/cluster.yaml`,
   `seaweedfs/Application.yaml`, `forgejo/Application.yaml`. That class is Longhorn, 1 replica: it is chosen for
   *where it lands* (bounded volumes on the data disks), not for a second copy.
2. **The capacity ladder is told the truth.** Three new `claims` rows in `storage-profiles.json`; the
   installer's `ZETA_LONGHORN_DEMAND_GIB` / `COMMITTED_LONGHORN_DEMAND_GIB` 943 -> **1043**; the profile ladder
   `minimal 204 -> 279, standard 571 -> 671, measured 943 -> 1043, large 1561 -> 1701` (generated by
   `storage-profile-install.ts --write`, never typed). A readiness-extractor fix: a CNPG `Cluster` carries its pod count in
   `spec.instances`, so it was being priced at ONE pod (20 GiB, not 60).
3. **A fresh install no longer puts local-path on root** -- `local-storage-placement.sh` (unit
   `zeta-local-storage-placement`, before k3s): if a mounted `/var/lib/longhorn-disk*` of >= 200 GiB exists, the largest
   one's `zeta-local-storage/` is bind-mounted onto `/var/lib/zeta-local-storage`. The path every PV records is unchanged.
   Fail-open (every stay-on-root branch exits 0) except the one state where falling back would be dangerous: a node that was
   placed before and whose data disk is gone, which exits 1 and holds k3s down rather than hand `local-path` empty directories
   over data still on that disk. It never shadows a populated directory and never moves or deletes anything.

### The price, stated

A single-1-TB-disk install has **607 GiB** schedulable. `standard` now declares **671**, so the installer selects `minimal`
for it (it selected `standard` before). The two-disk shape and anything larger are unaffected. Remedies, already printed by the
installer's refusal: add a second internal disk, or raise `LONGHORN1_TAIL`. This is the honest cost of counting 100 GiB of
databases and blob store against the pool that now holds them; the alternative was leaving them as an unmetered directory on root.

## The live procedure (what was done, in what order, with the rollback for each step)

**Rules held throughout:** one workload at a time; `api.flowdent.net/health`, `api-staging`, GitLab `sign_in`, the registry
`/v2/` and `kubectl get cluster -n postgres-shared` checked before and after every step, stop at the first anomaly; the node's
DiskPressure and imagefs checked before any copy; copies write to the Longhorn disks, never root; **no PV is deleted**;
**`reclaimPolicy: Retain` is set on a local PV before its claim is deleted** (the local-path `teardown` is `rm -rf` of the
directory, so a Delete-policy release destroys the data).

ArgoCD `selfHeal` reverts live-only changes, including `kubectl scale`. A workload that must be stopped is quiesced by
annotating **its Application** `argocd.argoproj.io/skip-reconcile: "true"` (ArgoCD v3.5.2; `zeta-root` does not remove a
live-only annotation), doing the work, then removing the annotation -- by which time git already says the new class.

### 1. postgres-shared, replica by replica (CNPG, ArgoCD does not own the PVCs)

CNPG applies `spec.storage.storageClass` only to PVCs it creates afterwards, so the git change moves nothing on its own.

1. Merge the git change. Check `spec.storage.storageClass` is `zeta-block-replicated`.
2. On-demand `Backup` (`method: plugin`, `barman-cloud.cloudnative-pg.io`); wait `completed`. `ContinuousArchiving` True.
3. `reclaimPolicy: Retain` on all three PVs.
4. For each replica (`-3`, then `-2`): confirm 3/3 ready, `pg_stat_replication` streaming, lag 0; `kubectl delete pvc,pod` of that replica
   (CNPG clones a new instance from the primary onto the new class); wait ready and streaming, lag 0; health check.
5. `switchover` by patching `status.targetPrimary` to a moved replica (no `cnpg` plugin is installed). Apps reconnect through
   `postgres-shared-rw`; watch `/health` and the connection counts (`POSTGRES-CONNECTION-BUDGET.md`).
6. The old primary last, the same way.
7. Old PVs stay Released/Retained, **>= 48 h**, deleted only with the owner's word.

*Rollback:* a replica that will not clone -> the primary is untouched; revert the class in git and let CNPG clone again. After
the switchover -> switch back to the old primary while its volume still exists. The Retained directories are the last resort.

### 2. forgejo, then SeaweedFS, then gitaly -- the claim swap

The chart creates the PVC and a bound PVC's `storageClassName` is immutable, so `helm`-owned claims cannot be edited in place.
The swap, per workload (Deployment strategy Recreate, one writer):

1. `skip-reconcile` on the Application; merge the git change (the Application, un-reconciled, ignores it).
2. Scale the workload to 0; wait for the pod to be gone (the data is quiescent).
3. `Retain` on the old PV. Create the new Longhorn PVC under a **temporary** name; run a copy Job that mounts the old claim read-only
   and the new one read-write (`cp -a`, then `find | sha256sum` manifests of both trees and a file/byte count must be identical).
4. `Retain` on the new PV; delete the temporary claim; clear the new PV's `claimRef`; delete the old claim; create the final claim under the
   **original name** with `volumeName: <new PV>`, the chart's labels and the ArgoCD tracking annotation.
5. Scale the workload up by hand; verify; remove `skip-reconcile` (ArgoCD then finds live == git).

*Rollback at any point before step 4:* scale the workload back up on the untouched old claim. After step 4: the old PV is Retained with its
data intact; re-create a claim to it (`volumeName` + `claimRef`) and point the workload back.

SeaweedFS additionally: stop only when no Barman backup or WAL archive is mid-flight; after start verify S3 put/get on every bucket,
`weed` free volume slots, a registry pull and push, a GitLab upload, `ContinuousArchiving` True and a fresh `Backup` completed.

Gitaly: **last, and only on the owner's word that the GitLab upgrade agent is finished.** The default-branch SHA of every project
in group `flowdent` is recorded before and compared after, plus a clone and a pipeline.

### Single-instance CNPG (`temporal-postgres`, `gitlab-rails-db`) -- why they stay

Moving a one-instance CNPG cluster needs a second instance on the new class and a switchover (`instances: 2`, move, `instances: 1`), or a
recovery from the Barman backup. That is supported and not hard, but it changes the instance count of an Application someone else owns
(`gitlab`) or of a 0.57 GiB database (`temporal`). Left, recorded, owner's call.

## The structural follow-up: containerd is 37.5 GiB of a 118 GiB root

Relocating state cannot fix this. Of the root's 75.6 GiB, containerd is 37.5 GiB, the Nix store and `/home/zeta` ~24 GB, kubelet 2.1 GiB;
the state this document moves is **6 GB**. After the move the root is ~69.6 GiB used, ~43 GiB free: the margin above the 18.6 GiB
eviction line grows from ~18 to ~24 GiB. It is more margin and not a different regime.

**Recommended, and the owner's decision because it changes the host:** put `/var/lib/rancher/k3s/agent/containerd` on a **dedicated
partition** on a big disk, not on a Longhorn disk (Longhorn computes availability from the whole filesystem, so image churn would
shrink what it believes it can place -- `NODE-DISK-HEADROOM.md` option A). Needs k3s stopped and the tree copied (or images re-pulled).
For a fresh install the cheaper form of the same idea is a larger root (`LONGHORN1_TAIL`, option B), so the kubelet's percentage thresholds
scale with it. Neither can be done to the running node: there is no root on it.

## Longhorn replica count -- measured, not changed

`zeta-block-replicated` is `numberOfReplicas: 1`, and the node-level `replica-soft-anti-affinity` is **false**: a second replica of any
volume would be refused on a one-node cluster regardless of `replica-disk-soft-anti-affinity: true`. So today a volume on `longhorn2` is lost with
that drive. Two replicas on the two physical drives would survive losing either one (and `nvme0` carrying root is the likelier casualty), at the
cost of doubling those volumes' bytes (the pool has ~810 GB schedulable free). It needs the node-level setting flipped *and* a class with
`numberOfReplicas: "2"` -- a cluster-wide Longhorn policy change, deliberately not made here. See the result notes below for whether
per-volume override was exercised.

## What is proven and what is unproven

Everything below was measured on `node-5b2dfa` on 2026-10-03 (UTC) between 01:20 and 02:20; times are UTC.

### Live result, per claim

| Claim | Now | How | Old copy (kept, `Retain`, **Released**) | Proof |
| --- | --- | --- | --- | --- |
| `postgres-shared-1,2,3` | `zeta-block-replicated` (Longhorn, 1 replica) | CNPG replica by replica: PVC + pod deleted, CNPG re-cloned from the primary (about 60 s each); primary switched to `-3` by patching `status.targetPrimary`; old primary re-cloned last | `pvc-cf9f589a...` `-70b8f48c...` `-4679cdb1...` (1.0 GiB each) | 3/3 ready, `pg_stat_replication` streaming + lag 0 on both standbys, `flowdent_prod` / `flowdent_staging` byte sizes identical on primary and a moved standby, Barman `ContinuousArchiving=True`, fresh on-demand `Backup`s completed before (02:02) and after (02:07) |
| `object-store/blob-store-seaweedfs-all-in-one-data` | Longhorn (moved by the previous session) | claim swap | `pvc-53076ecd...` (2.8 GiB, **stale since the move**: writes since then are only on the new volume) | S3 put / get / delete round-trip on **all 11 buckets** (`git-lfs`, `gitlab-artifacts`, `gitlab-backups`, `gitlab-packages`, `gitlab-registry`, `gitlab-uploads`, `loki-chunks`, `loki-ruler`, `mimir-ruler`, `mimir-tsdb`, `zeta-backups`); `weed` topology 82/100 volume slots used, 18 free; registry pull of two images (manifest, config blob sha256, 43 MB layer HEAD) and a push of a minimal image into the probe project, pulled back byte-identical, then deleted |
| `forgejo/gitea-shared-storage` | Longhorn (moved by the previous session) | claim swap | `pvc-6c3d172c...` (5 MiB) | `https://git.flowdent.net/api/healthz` 200 |
| `opensearch/...-master-0` | Longhorn | claim swap (below) | `pvc-0c426751...` (0.8 MiB) | 139 files, sha256 manifests identical, ownership/modes identical, pod Ready, Application Synced/Healthy |
| `gitlab/repo-data-gitlab-gitaly-0` | Longhorn | claim swap (below); gitaly stopped **02:14:41 - 02:15:39** (58 s) | `pvc-5a784d60...` (0.24 GiB) | 689 files / 247520 KiB source = 689 files destination, sha256 manifest identical; the default-branch SHA of all 10 projects (9 in group `flowdent` plus `root/zz-upgrade-probe`) identical before and after; `git clone` + `git fsck --connectivity-only` clean; a pipeline ran to `success`; a commit written through the API landed, was read back and its branch deleted; `sign_in` 200 |

Root filesystem (the node's own `stats/summary`): **81.95 GB used / 38.3 GB available before, 82.06 GB used / 38.2 GB after.** It did not
move, and that is the honest figure: the seven old directories (~6.1 GB) are deliberately still there. When the owner lets them go the root
is expected at roughly 76 GB used / 44 GB available, 25 GB above the 18.9 GB eviction line. Pruning images was measured and **declined**: of
129 images only 5 (0.1 GB) are referenced by no container, so `crictl rmi --prune` would reclaim nothing. `DiskPressure` was `False` throughout.

Production during the move: `api.flowdent.net/health` and `api-staging` were polled once a second from 02:03 through the end of the PostgreSQL steps. **Exactly one interruption:
02:04:44 - 02:04:50 UTC, 6 s of 503, at the postgres switchover** (the pods reconnected on their own; one failed background tick per API pod was
logged in that window and nothing after it). Replica moves and every claim swap caused none.

The old primary `postgres-shared-1` restarted once at the switchover (CNPG demoted it), as expected.

### The claim swap, as actually performed (opensearch, gitaly)

`skip-reconcile` on the Application, `kubectl scale sts 0`, wait for the pod to be gone, a new Longhorn PVC under a temporary name, a copy Job
(`busybox cp -a`, old claim read-only) that prints source/destination file counts and sha256 manifests, a second read-only Job that diffs
`ls -lanR` of both trees (the only differences were `lost+found` and the root directory's mtime/link count), `Retain` on the new PV, delete the
temporary claim, clear its `claimRef`, delete the old claim, create the claim under the **original name** with `volumeName` of the new PV, scale
up, remove `skip-reconcile`. Because the StatefulSet's `volumeClaimTemplates` were left as they were, ArgoCD found live == git and had nothing to
do. **Rollback:** scale to 0, delete the new claim, remove `/spec/claimRef` from the old PV (`kubectl patch pv <old> --type=json`), create a
claim with `volumeName: <old pv>` under the same name, scale up. The old data is untouched.

### Two traps found on the way, both fixed live and worth knowing

1. **ArgoCD took ownership of `spec.volumeName` on the hand-made claims and then tried to blank it.** forgejo's and seaweedfs's claims had been
   created with `kubectl apply` (managed by `kubectl-client-side-apply`); ArgoCD's server-side apply migrates that manager to `argocd-controller`,
   which then owns `volumeName`, and the git render has none -- so the first sync after `skip-reconcile` was removed failed with `spec is immutable`.
   Fix: delete `f:volumeName` from the owning manager's `managedFields` entry (a metadata-only patch; done on both claims) **before** un-skipping.
   Do the same for any claim recreated by hand under a helm- or Argo-owned name.
2. **The `stage0-independence` ratchet** failed PR #17884 because `local-storage-placement.sh` is a new door; it is recorded as the ninth exception.

### Not done in git, and why (the owner's decision)

gitaly and opensearch are **on Longhorn live but the git manifests still say the cluster default** (`zeta-block-local`). This is deliberate and it
is harmless today (a StatefulSet's `volumeClaimTemplates` are not compared against a bound claim, and a fresh install now puts local-path on the big
disk through `local-storage-placement.sh`), but it is a divergence and it is stated here rather than left to be found. Declaring them in git means two
new `storage-profiles.json` rows (gitaly 50Gi, opensearch 20Gi, +70 GiB), and that **does not fit the invariant the catalogue test pins**: the
`measured` rung must fit the smallest measured node, whose pool is **1047 GiB** -- the roster already declares 1043, so the margin is **4 GiB** and
1113 fails `storage-profiles.test.ts` ("standard and measured fit the smallest measured node"). Landing it needs one of: smaller declared sizes
elsewhere, a decision that the invariant's bound is wrong, or a bigger reference node. Everything else that change touches (the two rows, the
generated kit, the installer ladder `304 / 741 / 1113 / 1841`, `ZETA_LONGHORN_DEMAND_GIB`, the QEMU lane disk) is mechanical and was prototyped; it
was reverted rather than shipped with a red test.

### What is unproven

- **Nothing in this document was exercised on bare metal beyond this one node.** `nix` is not installed on the machine that wrote the repo changes:
  the `zeta-local-storage-placement` unit is read by a test and never evaluated or booted, and the bind mount of a `longhorn-disk*` subdirectory under
  the real local-path helper pods has not run on hardware.
- Longhorn volumes are **one replica** (and `replica-soft-anti-affinity` is false): a volume on `longhorn2` is lost with that drive, exactly as the
  local-path directory was lost with the root. The CNPG standbys give the databases a second copy only because CNPG replicates at the PostgreSQL level;
  gitaly, SeaweedFS, forgejo and opensearch have no second copy beyond the Retained old directories (which go stale) and the Barman/GitLab backups.
- The three CNPG instances all sit on one node: this is a placement fix, not high availability.
- PostgreSQL moved with the cluster **running**; the claim "no committed transaction was lost" rests on streaming lag 0, identical database sizes, and the
  fact that the only primary change was a clean CNPG switchover, not on a row-level comparison.
- One transient was seen: right after gitaly came back, the very first API read of project 4's default branch returned an error body; the same call
  seconds later returned the recorded SHA, and all ten matched. Not investigated further.
- The 2 prod pods and 1 staging pod were not restarted, so a cold start against the new volumes is untested.

### Orphans and the leftovers (the owner's to delete, none touched)

Four `zeta-block-local` claims have no consumer: `gitlab/data-gitlab-postgresql-0`, `gitlab/redis-data-gitlab-redis-master-0`, `mimir/kafka-data-mimir-kafka-0`,
`mimir/storage-mimir-alertmanager-0` (1.1 GiB). Seven Released PVs hold the old copies listed above (~6.1 GiB on root); keep them **>= 48 h** (until
2026-10-04T23:00Z at the earliest) and delete only on the owner's word: `kubectl delete pv <name>`, then remove the directory under
`/var/lib/zeta-local-storage/` on the node (deleting a Retained PV object does not remove the data).
