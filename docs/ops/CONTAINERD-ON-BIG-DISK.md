# The container store belongs on a big data disk -- installer fix, and the runbook for the live node

> **Carved sentence.** k3s's container store (`/var/lib/rancher/k3s/agent/containerd`: images, snapshots,
> metadata) is the thing on a node's root filesystem that grows without anyone asking it to, and the
> kubelet evicts every pod -- production included -- when the filesystem it lives on runs low. So it does
> **not** live on the 119 GiB root. A fresh install binds it onto the largest data disk before k3s ever
> starts, and **k3s refuses to start** if that mount is ever missing, because the only alternative is for it
> to silently re-pull 132 images onto the disk this exists to protect. The live node needs a copy-first
> cut-over, prepared and tested below and **not yet executed**.

Work item `081M44HD9T2087G0R000G9NR1N`. Continues [`NODE-DISK-HEADROOM.md`](NODE-DISK-HEADROOM.md) (option A, which
this implements) and [`STORAGE-RELOCATION.md`](STORAGE-RELOCATION.md) (which moved the local-path volumes the same way
and left the images, "the structural fix", as the owner's decision). Read
[what is proven and what is not](#what-is-proven-and-what-is-not) before trusting any line below.

## What was measured (node `node-5b2dfa`, NixOS 26.05, 2026-10-05, read from the node)

| Signal | Value |
| --- | --- |
| Root `/dev/nvme0n1p2` | 119 GiB ext4; **91 GiB used, 22 GiB free** at the first reading. Free space then swung 16.5 -> 21.6 -> 36 GiB inside 30 seconds as CI jobs came and went; the kubelet's imagefs line is ~17.7 GiB |
| `/var/lib/rancher/k3s/agent/containerd` | **48 GiB**: snapshotter 35 GiB, content blobs 14 GiB, metadata (bolt) 30 MiB, log 46 MiB. **534,573 entries** (423,115 files, 74,403 dirs, 36,686 links, 249 device nodes = overlayfs whiteouts, 120 specials). 132 images (`crictl images -q`; 133 tagged references -- the owner counted 153 a few days earlier, images churn). Mode `0700 root` |
| Other root consumers | `/home/zeta` 14 GiB, `/nix` 12 GiB, local-path volumes 4.7 GiB, `/var/lib/kubelet` **2.6 GiB**, `/var/log` 0.8 GiB, the rest of `/var/lib/rancher` 2.5 GiB |
| Data disks | `nvme0n1p3` = `longhorn-disk1` 797 GiB (50 GiB used, 707 GiB free), **`nvme1n1p1` = `longhorn-disk2` 916 GiB (104 GiB used, 766 GiB free)**. Both Crucial CT1000P3 NVMe, `ext4 rw,relatime`, mounted from `hardware-configuration.nix` with no `nofail` |
| I/O scheduler | `none` on both NVMe devices -- **`ionice` and `nice` have no effect on them; a bandwidth limit is the only throttle** |
| Speed (bounded `dd`, direct I/O, 2 GiB, written then deleted on disk2) | write **2.3 GB/s**, read **5.7 GB/s**; a cold 1 GiB blob read from the store: 2.9 GB/s. These are SLC-cache bursts of a QLC drive: a sustained 48 GiB write may be several times slower |
| `rsync -aHAXn` scan of the whole store | **8.5 s** (534k entries, source side only) |
| What is mounted around it | **0** mounts under the directory itself; **355 overlay** mounts under `/run/k3s/containerd/...` whose `lowerdir` is *inside* it; 116 ext4 + 280 tmpfs + 2 overlay under `/var/lib/kubelet`; 39 Longhorn volumes attached over iSCSI, 38 of them mounted under `/var/lib/kubelet/pods/*/volumes/kubernetes.io~csi` |
| k3s unit | `k3s.service`, `KillMode=process`, `Restart=always`, `TimeoutStartSec=0`; `k3s-killall.sh` exists next to the binary. **Stopping the unit leaves containerd and every container running** |
| Processes | k3s runs from `/var/lib/rancher/k3s/data/<hash>/bin/k3s` (it unpacks itself; `comm` `k3s-server`); its containerd daemon is **that same binary** re-exec'd as `containerd` (ppid = k3s); the shims are `/nix/store/..-k3s-containerd-2.2.5-k3s2/bin/containerd-shim-runc-v2`, ppid 1 |
| Docker | `docker.service` is **active** and runs **two other `containerd`s** (`/nix/store/..-docker-containerd-29.7.2/bin/containerd`, one rootless for uid 1000). A pattern on the name `containerd` would kill them |
| Tools (as root, host) | `rsync`, `ionice`, `systemd-run`, `nixos-rebuild`, `nix`, `findmnt`, `mountpoint`, `iscsiadm`, `pgrep`, `curl`, `sha256sum` present. **No `fuser`, no `lsof`** |
| Longhorn | per disk `storageMaximum` 855 / 983 GB, **`storageReserved` 256 / 295 GB (30%)**, scheduled 422 / 453 GB, `storageAvailable` 802 / 872 GB; settings `storage-minimal-available-percentage` 25, `storage-reserved-percentage-for-default-disk` 30, over-provisioning 100, `default-replica-count` 1 |
| Kubelet thresholds | `eviction-hard=memory.available<500Mi,nodefs.available<10%,imagefs.available<15%,nodefs.inodesFree<5%` |
| Disruption budgets | `postgres-shared-primary` (allowed **0**), the Longhorn `instance-manager` (allowed **0**), gatekeeper (allowed **0**), `flowdent-api` (min 1 of 2), many others at 1 |
| Workloads that need care | **2 running Windows 11 VMs** (`windows-vms/win11-ci`, `win11-desktop`; their `virt-launcher` pods have a **330 s** grace period); **1 bare pod** (a GitLab CI job pod, `gitlab/runner-...-project-4-concurrent-0`; a pod with no controller is never re-created); 140 pods outside `kube-system`/`longhorn-system` (78 ReplicaSet, 40 StatefulSet, 13 Job, 5 CNPG `Cluster`, 2 VMI); 39 Longhorn volumes attached; CNPG postgres pods have a 1800 s grace |
| Backups | CNPG `ScheduledBackup`s `postgres-shared-daily` and `temporal-postgres-daily`, last completed 20 h earlier. **On the same node** |

## What changes for Longhorn (the question NODE-DISK-HEADROOM option A raised)

That page warned that a containerd store on a Longhorn filesystem shrinks what Longhorn believes it can place.
Measured, on the owner's numbers, it does not bite -- and the reason is worth keeping:

* Longhorn schedules against `storageMaximum - storageReserved` (scheduled so far 453 GB of 688 GB on disk2) and refuses a
  new replica only when `storageAvailable` would fall under 25% of `storageMaximum` (246 GB on disk2). The container store
  consumes **`storageAvailable`**, not the schedulable budget.
* Moving 48 GiB (51.5 GB) onto disk2 takes `storageAvailable` from 872 GB to **821 GB, 575 GB above the 246 GB floor**.
  Growth to 100 GiB still leaves 520 GB. The installer's own capacity check already discounts 25% of raw
  (`ZETA_LONGHORN_USABLE_PERCENT=75`), so on a fresh install the store sits inside space Longhorn was never going to
  schedule. **No Longhorn setting changes.**
* The one place it bites is a data disk near the 200 GiB floor, where the 25% slack is 50 GiB and a 73 GiB roster of images
  does not fit inside it. That is why the installer's threshold is 200 and not lower, and why a disk under it keeps the
  store on root.
* Observation, not investigated: `longhorn-disks.nix` writes `storageReserved: 0` into the node annotation, but the live
  node's disks carry the 30% default. Whatever registered them was not that annotation. It does not change the arithmetic
  above (the reserve only makes the schedulable budget smaller).

**What it changes for the kubelet.** `imagefs` becomes `longhorn-disk2`, so `imagefs.available<15%` now means 137 GiB free of
916 -- it fires when the disk is 85% used, i.e. after Longhorn's 75% line has already stopped scheduling. Image GC (75/65, set
by `k3s-process-protection.nix`) then starts at 75% used of the same disk. `nodefs` stays root, so the line that evicts pods
for root pressure drops from ~17.7 GiB to **10% = 11.9 GiB free**. Pod `emptyDir`s (kubelet, 2.6 GiB) are still on root.

**Not moved: `/var/lib/kubelet`.** It is 398 mount points, the CSI plugin sockets and every pod's volume tree; binding it adds a
second must-be-mounted-first dependency for 2.6 GiB, and moving the kubelet root changes what its own eviction signal reads.
The images were the 48 GiB. If `emptyDir` pressure ever returns, the cheap fix is a `sizeLimit` on the offending pod, not a
second mount.

## A fresh install (done, in this change)

* `usb-nixos-installer/zeta-install.sh`, **Step 6.64d**: after Step 5 has mounted the data disks, `zeta_containerd_disk_pick`
  chooses the **largest mounted `/var/lib/longhorn-disk*`** (ties to the lowest number -- the rule
  `local-storage-placement.sh` already uses), **only if it is at least 200 GiB** (`ZETA_CONTAINERD_MIN_GIB`), and writes its
  mount point to `/mnt/etc/zeta/containerd-data-disk` (symlinked to `/etc/zeta/` for `--impure` evaluation). Every role gets it
  -- a joiner's k3s agent has a containerd too. A 1 TiB single-disk install gets `longhorn-disk1` (its ~880 GiB tail); a QEMU
  lane's 1 GiB tail is under the floor, **nothing is written, and the store stays on root**, which is the only place it fits.
* `nixos/modules/containerd-on-data-disk.nix` (imported by `common.nix`) reads that file as the default of
  `zeta.containerdStore.dataDisk`. Absent file and unset option: **the module contributes nothing**. A value that is not a
  filesystem the host declares, a relative path, `/` or a trailing slash is **refused at evaluation**.
* With a disk set, three units: `zeta-containerd-store-prepare.service` (the disk is mounted; creates `<disk>/containerd`;
  refuses to hide a populated root copy behind an empty store), `var-lib-rancher-k3s-agent-containerd.mount` (the bind), and
  `k3s.service` gains `Requires=` the mount, `RequiresMountsFor=` the path, and **a first `ExecStartPre` that asserts the
  target is a mount of `<disk>[/containerd]`** (`containerd-store.sh assert`).

### The failure mode, chosen on purpose

**Fail closed.** If the data disk is missing, the directory on it is gone, or the bind is the wrong one, `k3s.service` does not
start and the message names the remedy. The node still boots, `sshd` is up, nothing is deleted. The alternative -- start anyway
-- is silent: k3s would recreate an empty store on root and re-pull 132 images onto the disk this exists to protect, with no
error anywhere until DiskPressure returned. It is deliberately the opposite of `local-storage-placement.sh`, which fails
**open** for a node that was never placed, because *its* fallback is the old working behaviour.

Why a `systemd.mounts` unit and not `fileSystems.<path>` with `bind`: an fstab bind is wanted by `local-fs.target`, so a missing
disk would drop a headless machine into emergency mode, and the source directory it needs cannot be created by `tmpfiles`,
which runs *after* `local-fs.target`. Here the failure is scoped to k3s.

**A trap the eval test exists for:** `k3s-wait-for-address.nix` sets `systemd.services.k3s.after = lib.mkForce [...]`, which
silently discards an `after` any other module adds to k3s. So this module never touches k3s's `after`; the ordering is on its
own units (`before = [ "k3s.service" ]`) and in `RequiresMountsFor`. Only an evaluation of the resolved host shows that.

### Tests

| Test | What it runs | Falsifier |
| --- | --- | --- |
| `src/Core.TypeScript/hygiene/lint-containerd-store.test.ts` | **executes** `containerd-store.sh` (both modes) over fixture trees with stubbed `mountpoint`/`findmnt`; executes the installer's real `zeta_containerd_disk_pick`; pins the Nix wiring | disk unmounted -> exit 1 and **nothing is created on root**; root populated + disk empty -> exit 1, nothing moved; a bind of the wrong source/device -> exit 1; mutation checks (removing the mounted-disk check, the source comparison, the mountpoint check) each fail a named test |
| `full-ai-cluster/nixos/tests/containerd-on-data-disk-eval-test.nix` (flake check `containerd-on-data-disk-eval`, in the CI eval-only list) | resolves the **shipping `control-plane` host** with and without a disk | off by default; k3s `Requires=` the mount and has `RequiresMountsFor=`; the assert is the first `ExecStartPre`; the mount is not wanted by `local-fs.target`; a disk the host does not declare is refused. Mutation-checked: deleting any one edge fails its property |

**Run for real, on the live node's nixpkgs (not in CI):** the eval test's 26 properties held against the real `control-plane`
module graph; and the node's **real** `control-plane` configuration (its real `hardware-configuration.nix` with both disks) plus
this change plus an injected file naming `longhorn-disk2` evaluated cleanly and built (`nixos-rebuild build`, 8.4 s, offline).
The built generation differs from the running one in exactly: `k3s.service` (+`Requires=`, +`RequiresMountsFor=`, +the
`ExecStartPre`), the new mount unit, the new prepare unit, and one `.requires/` symlink. The closure delta is four new store
paths. `systemd-analyze verify` on the three units reported no ordering cycle. Nothing was activated.

**The cut-over script's read-only phases, run as root on the node** (through the privileged-pod route, state in `/tmp`, removed
afterwards): `preflight` **passed** (k3s discovered from `systemctl cat k3s.service`, `k3s-killall.sh` found next to the binary,
`DiskPressure=False`, 765 GiB free on `longhorn-disk2` against a 41 GiB store -- `du -sxb` reports 41 GiB apparent where `du -sh`
says 48 GiB of blocks -- and 79% free after the copy). `cutover --dry-run` printed the whole window and ran a real `rsync
--dry-run`: **44,567,285,363 bytes (41.5 GiB) to copy**, 21 s per pass for the scan. It also listed what the window will touch:
140 application pods in 60 namespaces, 39 attached Longhorn volumes, 2 running VirtualMachineInstances, 1 bare CI-job pod. The
`k3s_pids` rule selected **164** k3s processes (the daemon, the shims, k3s) and excluded Docker's two `containerd`s (pids 1534, 2300).
Nothing was stopped, mounted or written outside `/tmp`.

## The live node: what the original plan got wrong

Read these before the procedure; each one changed the design.

1. **`/etc/nixos/configuration.nix` is not what the node runs.** It is the vanilla file `nixos-generate-config` wrote; the
   running system has no `configuration.nix` and was installed with `nixos-install --flake /etc/zeta/full-ai-cluster#<host>`.
   Adding a mount there and running `nixos-rebuild switch` would have switched the node to a stock NixOS **with no k3s**. The
   persistent change goes through the flake: `nixos-rebuild ... --impure --flake /etc/zeta/full-ai-cluster#control-plane`.
   Measured: that evaluates offline from the `zeta` user in ~23 s and **produced nothing to build** -- the running system *is*
   that attribute (so the host is `control-plane`).
2. **`/etc/zeta` is a dirty clone at `94ccb1ae95`** (the node's real `hardware-configuration.nix` and `operator-ssh-keys.txt` are
   modified). `main` is 63 files ahead in `full-ai-cluster`, 11 of them under `nixos/` and including **kubelet flag changes**
   (`k3s-process-protection.nix`), a firewall rule and sudo. Pulling `main` onto the node drags all of that into the same
   generation, in the same window. **Apply only this change** (see step 0).
3. **Stopping k3s does not stop the containers** (`KillMode=process`), and k3s's containerd daemon is the **k3s binary
   re-exec'd as `containerd`**. `k3s-killall.sh` kills the shim trees but not that daemon. The script therefore signals k3s's
   processes itself -- told apart from Docker's containerd by the **executable** (`/proc/<pid>/exe` ends in `/bin/k3s`, or is a
   path containing `k3s-containerd`; read live: k3s's daemon is `.../k3s/data/<hash>/bin/k3s`, Docker's is `.../docker-containerd-29.7.2/bin/containerd`), SIGTERM first so containerd flushes its metadata, SIGKILL after a wait.
4. **`kubectl drain` can never finish on this node.** The PDBs above (`allowed 0` on the Postgres primary, the Longhorn
   instance-manager and gatekeeper) refuse every eviction because the replacement has nowhere else to go; a drain would sit
   out its whole timeout and then be a delete anyway -- taking the Longhorn instance-manager down at the same moment as the
   databases writing through it. The script instead **cordons, deletes every pod outside `kube-system`/`longhorn-system`
   gracefully** (each with **its own** grace period: the two Windows VMs need up to 330 s to shut the guest down, and a short override
   would power them off mid-flush), waits for them to be gone **and for every Longhorn volume to be detached**, and only then stops
   k3s. The dry run against the live node listed 140 such pods and 39 attached volumes.
5. **`ionice` does nothing here** (scheduler `none`); the pre-copy is throttled with `rsync --bwlimit` (default 300000 KiB/s).
6. **`rsync -aHAX` as root is required**, not decorative: overlayfs whiteouts are 249 character devices and opaque directories
   are `trusted.overlay.*` xattrs, which only root copies. `-x` keeps it from crossing into another filesystem.

## The live-node procedure

`full-ai-cluster/scripts/move-containerd-to-data-disk.sh` -- `bash move-containerd-to-data-disk.sh --help` prints its phases.
Every phase is idempotent; every mutating phase needs `--yes`; every phase has `--dry-run`, which prints each mutating command
as `DRY-RUN: ...` and runs only read-only probes and `rsync --dry-run`.

### Pre-flight checklist (a human, before anything)

* [ ] **Backups.** The CNPG daily backups (20 h old) and GitLab's repositories are **on this node**, i.e. in the same failure domain
      as the move. If that matters, take an off-node `pg_dump` of the production databases first. The script never touches
      Postgres data, Longhorn replicas or local-path volumes, but a hard failure is the moment you want a copy elsewhere.
* [ ] The owner's `sudo` password to hand (`zeta` is in `wheel`, no passwordless `sudo`) **and console access** (keyboard + screen on
      the node, or the router's/BMC's equivalent). The cluster goes away during the window; so does every route in through it.
* [ ] **The two Windows VMs stopped gracefully first** (`virtctl stop win11-ci -n windows-vms`, or set `runStrategy: Halted`, and the
      same for `win11-desktop`; start them again afterwards). The window deletes their pods and relies on the pod's 330 s grace
      to shut the guest down; stopping them yourself takes that out of the window and out of the risk.
* [ ] **The GitLab runner paused** (or no job running): a CI job pod is a bare pod, it is killed and **not** re-created, and the
      cutover refuses while one exists (`ZETA_MOVE_ALLOW_BARE_PODS=1` accepts the loss).
* [ ] A window announced. Everything is down for the window: `flowdent.net`, `api.flowdent.net`, GitLab, the router's `:443`/`:22`
      relays (they are pods). Running CI jobs are killed. LAN `ssh zeta@192.168.1.79` keeps working (`sshd` is the host's).
* [ ] `kubectl get nodes` Ready, `DiskPressure=False`, no CI pipeline mid-run (it is the thing that swings root by 20 GiB).
* [ ] Step 0 below done and **the `build` phase reviewed**.

### Step 0 -- put exactly this change on the node's tree

On the node, as root, in the node's own tree (do **not** `git pull`):

```bash
# from a checkout of the branch (any machine): the three files that are in the node's closure
git diff origin/main...fix/containerd-on-data-disk -- \
  full-ai-cluster/nixos/modules/common.nix > /tmp/common.patch          # one 7-line import hunk
scp /tmp/common.patch full-ai-cluster/nixos/modules/containerd-on-data-disk.nix \
    full-ai-cluster/nixos/modules/containerd-store.sh zeta@192.168.1.79:/tmp/

# on the node
sudo install -m 0644 /tmp/containerd-on-data-disk.nix /tmp/containerd-store.sh /etc/zeta/full-ai-cluster/nixos/modules/
cd /etc/zeta && sudo patch -p1 --dry-run < /tmp/common.patch && sudo patch -p1 < /tmp/common.patch
```

Measured: the hunk applies to the node's `common.nix` (offset -8) and nothing else in `/etc/zeta` changes. The flake is then
built with `--flake path:/etc/zeta/full-ai-cluster` (below), which ignores git tracking, so the new untracked files are
seen.

### How to launch (two routes; the first is the one to prefer)

**A. over ssh, as `zeta`.**

```bash
scp full-ai-cluster/scripts/move-containerd-to-data-disk.sh zeta@192.168.1.79:/tmp/move.sh
ssh -t zeta@192.168.1.79
sudo install -d -m 0755 /var/lib/zeta-containerd-move
sudo install -m 0755 /tmp/move.sh /var/lib/zeta-containerd-move/move.sh
S=/var/lib/zeta-containerd-move/move.sh; DISK=/var/lib/longhorn-disk2
sudo $S preflight --disk $DISK
```

Detached phases are started with `sudo $S launch <phase> --yes --disk $DISK` (add `--flake path:/etc/zeta/full-ai-cluster`
to `build`; a transient unit
`zeta-containerd-move-<phase>.service`; the shell can be closed). Follow with `sudo journalctl -u zeta-containerd-move-cutover -f`
or `sudo tail -f /var/lib/zeta-containerd-move/move.log` -- the log is on root, so it survives the cluster and a reboot.

**B. through the cluster, from a machine with the kubeconfig (dies when k3s stops -- use it only for the phases that run before
the window, and follow the cutover over ssh).**

```bash
kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Pod
metadata: { name: zeta-move, namespace: zeta-node-hosts }
spec:
  hostPID: true
  restartPolicy: Never
  tolerations: [ { operator: Exists } ]
  containers:
    - name: p
      image: busybox:1.36
      imagePullPolicy: IfNotPresent
      command: ["sleep", "7200"]
      securityContext: { privileged: true }
EOF
# Git Bash on Windows rewrites /run/... -- disable it:
export MSYS_NO_PATHCONV=1
NS="nsenter -t 1 -m -u -n -i -p --"; SH=/run/current-system/sw/bin/sh
kubectl -n zeta-node-hosts exec -i zeta-move -- $NS $SH -c 'mkdir -p /var/lib/zeta-containerd-move && cat > /var/lib/zeta-containerd-move/move.sh && chmod 0755 /var/lib/zeta-containerd-move/move.sh' < full-ai-cluster/scripts/move-containerd-to-data-disk.sh
kubectl -n zeta-node-hosts exec zeta-move -- $NS $SH -c '/var/lib/zeta-containerd-move/move.sh launch precopy --yes --disk /var/lib/longhorn-disk2'
```

The script is copied **onto the host** first: a transient unit cannot run a file that exists only inside the pod's mount
namespace. Delete the pod when done (`kubectl -n zeta-node-hosts delete pod zeta-move`).

### The steps

| # | Phase | Cluster up? | What it does | Time (basis) |
| --- | --- | --- | --- | --- |
| 1 | `preflight --disk $DISK` | yes | read-only: disk mounted and not on root, >= 1.5x the store free (766 GiB vs 72 GiB needed), >= 35% free after the copy (78%), no DiskPressure, k3s unit/binary/killall discovered, tools present, no other run | seconds (`du` of the store ~8 s) |
| 2 | `cutover --dry-run --disk $DISK` | yes | prints every command the window would run, plus the real size of the delta | ~1 min |
| 3 | `launch precopy --yes` | **yes** | rsync to `<disk>/containerd`, passes repeated until one moves < 512 MiB (max 5); `--bwlimit=300000`; aborts (exit 3) if the node reports DiskPressure | 48 GiB / 293 MiB/s = **~3 min** + small-file overhead (534k entries); budget 5-10 min. **Unmeasured**: sustained QLC write speed |
| 4 | `build --yes` | yes | writes `/etc/zeta/containerd-data-disk`, **builds** the generation (no activation), **proves** the built system declares the mount unit and the assert, prints the unit and package delta | measured **8.4 s** for this change alone; a build from a moved tree could pull from the cache |
| 5 | `launch cutover --yes` | **window** | the downtime, below | below |
| 6 | (recommended) reboot | window | proves the boot path: the bind comes up before k3s, and the assert passes | node boot + k3s start, ~3-6 min |
| 7 | `verify` | yes | node Ready on the new store, workloads, public endpoints | ~1 min |
| 8 | `reclaim --yes --disk $DISK` | yes | frees the old copy | seconds-minutes (534k `unlink`s) |

**Read the `build` output.** It prints which unit files differ from the running system. For the patch in step 0 it is exactly
`k3s.service`, the new mount unit and the prepare unit. If it lists **anything else** (kubelet flags, a firewall unit), the tree
under the build is not the one the node runs plus this change: stop and find out why before opening a window.

### The window (`cutover`), in order

1. preflight again; refuse unless a built generation was recorded; a final **online top-up** pass
2. record the number of images containerd has (`crictl images -q`); record the running system for the rollback
3. `cordon` the node; delete all application pods **with their own grace period** (a Windows VM's `virt-launcher` has 330 s to shut
   the guest down; `ZETA_MOVE_APP_GRACE` caps it); wait until gone; wait until every Longhorn volume is `detached`
   (`DRAIN_TIMEOUT` 420 s, `DETACH_TIMEOUT` 180 s; on timeout: refuse and uncordon, unless `ZETA_MOVE_DRAIN_FAILURE=continue`).
   **Bare pods** (a running CI job) are never re-created: the cutover **refuses** while any exist unless `ZETA_MOVE_ALLOW_BARE_PODS=1`
4. `systemctl stop k3s`; `k3s-killall.sh`; SIGTERM then SIGKILL for k3s's own leftover processes; unmount anything still
   referencing the store; log out leftover Longhorn iSCSI sessions
5. **final `rsync --delete`** (containerd is stopped, so the store is consistent), then the copy is **verified**: `rsync
   --dry-run --itemize-changes` must find *nothing* to do, and SHA-256 of the metadata DB and the three largest blobs must match
6. `mount --bind <disk>/containerd <store>` and check `findmnt` says `<device>[/containerd]`
7. `switch-to-configuration switch` of the **prebuilt** generation (never built in the window), start k3s if the switch did not
8. wait for `/readyz`, node Ready, and **containerd listing >= 90% of the images it had before** (the guard against "this is not
   the store that was copied and k3s is quietly re-pulling onto the data disk")
9. `uncordon`; then workloads (`flowdent-prod` 2, `postgres-shared` 3, `gitlab` 1 ready pods; no pod outside Running/Completed)
   and public endpoints (`api.flowdent.net/health`, `gitlab.flowdent.net/users/sign_in`, `flowdent.net`)

**Expected timeline** (target < 15 min). What is measured is only the copy arithmetic, the scan and the build. The rest is a
read of what the node does, not a rehearsal:

| Phase | Estimate | Basis |
| --- | --- | --- |
| app pods stop | 1-2 min with the VMs already stopped; **up to ~6 min** otherwise (the 330 s VM grace) | each pod's own grace, concurrently; Longhorn detach +30 s. *Estimate* |
| stop + killall + unmount ~830 mounts | 1-2 min | 355 + 116 + 280 mounts, 150 netns. *Estimate* |
| final sync + verify | ~1 min | scan 8.5 s per side; 4 GiB of SHA-256; delta small after the pre-copy. *Part measured* |
| bind + switch + k3s start to `/readyz` | 1-3 min | build 8.4 s measured; k3s start unmeasured |
| node Ready -> every pod Running | 5-10 min | 160 pods from **local** images; GitLab last. *Estimate* |
| **node-down to API back** | **~5-8 min** | |
| **everything up** | **~12-20 min** | the < 15 min target is met for the data plane (Postgres, flowdent), **not reliably for GitLab** |

### Rollback

**Automatic** (inside `cutover`, until the core checks pass): any failure after the cordon runs `rollback`. What it undoes depends
on how far it got -- *before k3s was stopped* (e.g. the pods would not stop) it only **uncordons**; after that it stops k3s and its
processes, unmounts the bind, checks the original directory is non-empty, switches back to the recorded generation if it had
switched, restores `/etc/zeta/containerd-data-disk`, starts k3s on the **original** directory, waits for `/readyz`, uncordons.
The old copy is untouched until `reclaim`. A rollback that cannot unmount says so, says the original is untouched underneath, and
prints the by-hand commands.

**Not a rollback:** pods slow to come up, or a public endpoint not answering yet, after k3s is Ready on the new store. That ends
as `VERIFY-INCOMPLETE` (exit 5): the node stays on the new store, nothing is unmounted. Re-run `verify`.

**By hand, before `reclaim`:** `sudo $S rollback --yes --disk $DISK`. After `reclaim` there is nothing to roll back to: the
data is on the data disk and the old generation is still in the boot menu (systemd-boot keeps generations).

### If the node does not come back (console)

1. On the console: `journalctl -u k3s -b --no-pager | tail -50`. If it says `[zeta-containerd-store] REFUSED`, that is the guard
   working: read the line, it names the cause (disk not mounted / mounted from the wrong source / a populated root store).
2. `findmnt /var/lib/longhorn-disk2` -- not mounted? `mount /var/lib/longhorn-disk2` (it is in `hardware-configuration.nix`),
   then `systemctl restart zeta-containerd-store-prepare var-lib-rancher-k3s-agent-containerd.mount k3s`.
3. `systemctl status zeta-containerd-store-prepare var-lib-rancher-k3s-agent-containerd.mount`.
4. To abandon the move: `sudo $S rollback --yes --disk $DISK`; if that cannot run, `umount /var/lib/rancher/k3s/agent/containerd`
   (the original store is underneath, untouched), boot the previous generation from the systemd-boot menu (it has no mount unit),
   or `rm /etc/zeta/containerd-data-disk` and `nixos-rebuild switch --impure --flake /etc/zeta/full-ai-cluster#control-plane`.
5. Never `rm -rf` anything under `/var/lib/rancher/k3s/agent/containerd` by hand while it is mounted: you would delete the live
   store on the data disk.

## Risks, and the go / no-go

**GO only if all of:** the checklist above is done; `preflight` passes; `cutover --dry-run` prints a plausible plan and a delta
under a few GiB; the `build` unit-diff is exactly the three units; someone is **at the node's console**; no pipeline is running.

**NO-GO if any of:** the `build` diff lists anything beyond the containerd units; `DiskPressure=True` or root swings under ~14 GiB
free while a copy is running (the pre-copy adds I/O to a node that is already unstable); no console access; no off-node copy of the
production data when you need one.

| Risk | Why it is real | What bounds it |
| --- | --- | --- |
| Postgres / Longhorn / a Windows guest see an unclean stop | the pods will not stop in their grace, or a volume stays attached; a VM that needs more than its 330 s | the window refuses (and uncordons) unless the pods are gone and every volume is detached; `ZETA_MOVE_DRAIN_FAILURE=continue` is an explicit opt-in |
| k3s does not come back on the new store | an `rsync` mismatch, xattrs, the unit graph | the copy is verified before the bind; the core checks (API, node, image count) trigger the automatic rollback |
| `switch-to-configuration` restarts something else | `main` is ahead of the node | step 0 applies only this change; `build` lists the unit delta; the switch is of a prebuilt generation |
| The `systemd` ordering is wrong on a real boot | never booted | the reboot test (step 6) **before** `reclaim`; the guard refuses rather than falls back |
| A long window | 160 pods, GitLab last | the estimate above; nothing here can shorten pod start-up |
| The node's own free space | 22 GiB free swinging by 20 GiB | the copy writes to the data disk, not root; the pre-copy aborts on DiskPressure |

## What is proven and what is not

**Proven (offline):**

* `lint-containerd-store.test.ts` -- the guard's refusals and the installer's disk choice, by execution; mutation-checked.
* `lint-containerd-move.test.ts` -- the cut-over kit's preflight refusals, the pre-copy loop and its DiskPressure abort, the
  build-and-prove step, the order of the window, every rollback path (drain fails -> only uncordon; final rsync fails; the copy does
  not verify; a process survives SIGKILL; the bind fails; the node never gets Ready; the image count collapses; the unmount
  fails), the dry-run promise, **Docker's containerd is never signalled**, and the reclaim device guard -- against a stubbed world.
* The Nix module evaluated and built against the live node's real configuration (above); the eval test's properties held and fail
  when any one edge is removed.

**Not proven, and can only be learned by running it:**

* **The cut-over has never been executed.** Nothing here has been run on a node: not `k3s-killall.sh` on this NixOS, not the
  unmount of ~830 mounts, not `switch-to-configuration` with the new unit, not k3s starting on a bind-mounted store.
* That `systemd` orders the units as written on a real boot, and that the first boot's creation of `<disk>/containerd` works.
* The sustained write speed of the data disk (the 2.3 GB/s is a 2 GiB cache burst), hence the pre-copy time.
* Pod stop and start times, hence the downtime estimate.
* Longhorn's behaviour when 48-100 GiB of non-replica data shares the filesystem (the arithmetic says it is fine; no replica has
  been scheduled since).
* That `findmnt` prints `<device>[/containerd]` for the bind (it prints `/dev/nvme0n1p2[/nix/store]` for the existing bind of the
  Nix store, which is why the guard compares that form).
