# Windows 11 VMs on KubeVirt: a CI runner and a desktop

> Two Windows 11 guests live in namespace `windows-vms`: **`win11-ci`**, a headless-ish GitLab runner tagged `windows`, `zeta-windows`
> that never takes untagged jobs, and **`win11-desktop`**, an interactive desktop reached over VNC and over RDP through an SSH tunnel.
> **Everything that can be proven without a Windows image has been proven on this node; the install itself has not been run.** A human
> downloads the Windows 11 Enterprise Evaluation ISO and accepts Microsoft's terms; nothing here fetches, ships or hosts Windows, and
> the Administrator password is typed by that human and lives only in a Secret. **No disk, scratch or state claim may land on the node's
> 120 GB root filesystem: every claim names Longhorn, and the namespace refuses the default class.**

Sibling runbook for a Windows *Server* runner in the `gitlab` namespace: [`WINDOWS-GITLAB-RUNNER.md`](WINDOWS-GITLAB-RUNNER.md) (its
token Job, tag contract and "prepared image" mode are reused here). Storage context: [`STORAGE-RELOCATION.md`](STORAGE-RELOCATION.md),
[`NODE-DISK-HEADROOM.md`](NODE-DISK-HEADROOM.md). SSH from outside the LAN: [`SSH-FROM-OUTSIDE.md`](SSH-FROM-OUTSIDE.md).

## What you get

| Piece | File | Applied by |
|---|---|---|
| Namespace `windows-vms`, quota, limit range (the storage fence) | `full-ai-cluster/k8s/examples/windows-11/00-namespace.yaml` | you, first |
| The shared installer ISO, DataVolume `win11-iso` | `.../windows-11/10-iso.yaml` | you, after the ISO is reachable |
| VM A `win11-ci` (+ its ConfigMap, 80Gi disk) | `.../windows-11/20-win11-ci.yaml` | you |
| VM B `win11-desktop` (+ ConfigMap, 100Gi disk, Service `win11-desktop-rdp`) | `.../windows-11/30-win11-desktop.yaml` | you |
| The answer files | `.../windows-11/windows-11-unattend/{Autounattend.xml,Unattend.xml}` | rendered into Secrets `win11-ci-unattend`, `win11-desktop-unattend` by `src/Core.TypeScript/cluster/windows-11-unattend-secrets.ts` |
| Runner record + `glrt-` token (Job, in namespace `gitlab`) | `full-ai-cluster/k8s/examples/gitlab-windows-runner-token.yaml` | you, once |
| The token, copied into `windows-vms` as Secret `win11-ci-runner-token` | `src/Core.TypeScript/cluster/copy-secret.ts` | you |
| Screenshot / one-key helper (no `virtctl`, no VNC client needed) | `src/Core.TypeScript/cluster/windows-11-vm.ts` | you |

The manifests live beside, not under, `k8s/applications/`: ArgoCD's root reads only `applications/*/Application.yaml` (so nothing syncs
them), and the audits that price the cluster walk that tree for volume claims, so ~190Gi of VM disk inside it would be counted as always-on
demand that no sync provisions. Both VMs are `runStrategy: Manual`: **nothing boots until you start it**.

### Sizing (a budget; measured against this node on 2026-10-03)

| | `win11-ci` | `win11-desktop` | ISO |
|---|---|---|---|
| vCPU | 4 (`host-passthrough`) | 4 | |
| CPU reserved on the node | 2 | 2 | |
| RAM | 8Gi (+ KubeVirt's overhead) | 8Gi | |
| System disk (usable) | 80Gi | 100Gi | 8Gi, imported once, shared read-only |
| Claim actually asked of Longhorn | ~85Gi | ~106Gi | ~8.5Gi (CDI adds 6% filesystem overhead itself) |

**Why a 2-CPU reservation for a 4-vCPU guest.** The node has 21.25 allocatable CPUs and the platform's own *requests* took 19.1 of them
(the real use was ~11%). A 4-CPU request per guest left the second one `Insufficient cpu`. There is no CPU limit, so a guest still bursts
to four when the node is idle. Check before you start both: `kubectl describe node node-5b2dfa | grep -A3 "Allocated resources"`.

## Human steps: what only you can do

1. Open the Microsoft Evaluation Center in your browser (search for "Windows 11 Enterprise Evaluation"; this repository deliberately
   carries no Microsoft link), read and accept Microsoft's evaluation terms, register as it asks, and download the **64-bit Windows 11
   Enterprise Evaluation ISO** yourself. Put it somewhere on the PC that will serve it, for example `D:\isos\`.
2. **Check the edition index in the ISO**, because `Autounattend.xml` installs `/IMAGE/INDEX` 1 (believed to be the only image).
   Double-click the ISO in Explorer (it mounts as a drive), then from any Windows prompt:
   `dism /Get-WimInfo /WimFile:E:\sources\install.wim` (use the mounted drive letter). If it lists several images, edit the `<Value>1</Value>`
   under `/IMAGE/INDEX` in `windows-11-unattend/Autounattend.xml`. Dismount afterwards.
3. Read the licence terms once more before step 5 below: `<AcceptEula>true</AcceptEula>` in the answer file is **your** acceptance, repeated.
4. Choose the administrator password yourself. It never goes through chat, git, or a command line: `read -rs` below keeps it out of shell
   history and out of `ps`. The guests' local account is `zetaadmin`; the built-in Administrator stays disabled, as on every Windows client.

## Steps, in order

All commands run from the repository root with `KUBECONFIG` pointing at the cluster. `virtctl` is optional (see the table at the end of
step 6); every command below has a `kubectl`-only form where it matters.

### 0. Preconditions (30 seconds)

```bash
kubectl get node node-5b2dfa -o jsonpath='{.status.conditions[?(@.type=="DiskPressure")].status}'   # False, or STOP
kubectl get --raw /api/v1/nodes/node-5b2dfa/proxy/stats/summary | python -c "import json,sys; d=json.load(sys.stdin)['node']; print('imageFs avail %.0f%%'%(100*d['runtime']['imageFs']['availableBytes']/d['runtime']['imageFs']['capacityBytes']), '| mem avail GiB %.0f'%(d['memory']['availableBytes']/2**30))"
```

Image storage (containerd) is on the same 120 GB root. The two images the guests pull (`virt-launcher`, `virtio-container-disk` at
~0.7 GB) are already on the node from the 2026-10-03 preparation; keep imageFs above 25% and free memory above ~10 GB when both guests run.

Two cluster settings these guests depend on, **both already applied live on this cluster** (re-apply if the cluster is ever rebuilt):

```bash
kubectl get kubevirt kubevirt -n kubevirt -o jsonpath='{.spec.configuration.vmStateStorageClass}'      # longhorn   (LIVE ONLY, see Known issues 2)
kubectl get cdi cdi -o jsonpath='{.spec.config.scratchSpaceStorageClass}'                              # zeta-block-replicated   (LIVE ONLY, see Known issues)
# re-apply:
kubectl patch kubevirt kubevirt -n kubevirt --type merge -p '{"spec":{"configuration":{"vmStateStorageClass":"longhorn"}}}'
kubectl patch cdi cdi --type merge -p '{"spec":{"config":{"scratchSpaceStorageClass":"zeta-block-replicated"}}}'
```

### 1. Namespace, quota, storage fence

```bash
kubectl apply -f full-ai-cluster/k8s/examples/windows-11/00-namespace.yaml
```

### 2. Mint the runner token and copy it into the namespace

```bash
kubectl apply -f full-ai-cluster/k8s/examples/gitlab-windows-runner-token.yaml
kubectl -n gitlab wait --for=condition=complete job/gitlab-windows-runner-token --timeout=15m
bun src/Core.TypeScript/cluster/copy-secret.ts --from gitlab/gitlab-windows-runner-token --to windows-vms/win11-ci-runner-token
```

The Job is the sibling runbook's (Rails call in the toolbox pod, no admin PAT, the token is never printed). It creates an **instance
runner** `zeta-windows` with tags `windows,zeta-windows` and *run untagged: off*. A Secret can only be mounted from the VM's own namespace,
so `copy-secret.ts` moves the `runner-token` key across without ever printing it (it reads from one `kubectl`'s stdout and writes to
the other's stdin; it refuses an empty key, which is what you would copy if the Job had not finished). Mint **before** starting `win11-ci`.

### 3. Give the cluster the ISO

Pick **one**. The ISO claim `win11-iso` is `volumeMode: Filesystem` on `zeta-block-replicated` (Longhorn), imported once and shared by both
guests.

**A. From this PC over HTTP** (the PC's LAN address is expected to be `192.168.1.72`; check `ipconfig`):

```powershell
# a folder that holds ONLY the ISO: http.server serves, and lists, everything under it
python -m http.server 8088 --bind 192.168.1.72 --directory D:\isos
```

The node must be able to reach that port. **Windows Defender Firewall** may block it; if the import cannot connect, allow it for the node only,
and remove the rule after the import:

```powershell
New-NetFirewallRule -DisplayName "iso-import" -Direction Inbound -Protocol TCP -LocalPort 8088 -RemoteAddress 192.168.1.79 -Action Allow
# afterwards:
Remove-NetFirewallRule -DisplayName "iso-import"
```

(On 2026-10-03 this PC's firewall profiles were all off and the node fetched from it directly.) Check from the node first:
`ssh zeta@192.168.1.79 'curl -sI http://192.168.1.72:8088/<the-file>.iso | head -3'`. Then apply the DataVolume with the sentinel URL replaced:

```bash
sed "s#http://iso-host.invalid:8088/windows-11-enterprise-evaluation.iso#http://192.168.1.72:8088/<the-file>.iso#" \
  full-ai-cluster/k8s/examples/windows-11/10-iso.yaml | kubectl apply -f -
kubectl -n windows-vms get dv win11-iso -w          # Succeeded; Ctrl-C the watch, then stop the python server
```

Measured with a 512 MiB stand-in file: ~50 s end to end including the importer pod's start; a ~6 GB ISO is expected to take on the order of
5 to 15 minutes. The import writes the ISO **twice** (a CDI scratch claim, then the target): all Longhorn, none on the root disk.
`python -m http.server` does not answer HTTP range requests; CDI imported fine from it, and creates a scratch claim for any HTTP source.

**B. `virtctl image-upload`** (no web server; the file goes through the CDI upload proxy into the claim). Edit `10-iso.yaml` to
`source: { upload: {} }`, apply it, then:

```bash
kubectl -n cdi port-forward svc/cdi-uploadproxy 18443:443 &      # keep running during the upload
virtctl image-upload dv win11-iso -n windows-vms --no-create --image-path D:/isos/<the-file>.iso \
  --uploadproxy-url https://127.0.0.1:18443 --insecure --wait-secs 3600
```

`--insecure` is the proxy's self-signed certificate on a port-forward to localhost; never use it across a network. (The upload path is
not exercised here; the HTTP path is.)

### 4. Render the answer-file Secrets (YOU type the password)

```bash
read -rs WINDOWS_ADMIN_PASSWORD && export WINDOWS_ADMIN_PASSWORD        # type it; nothing is echoed
bun src/Core.TypeScript/cluster/windows-11-unattend-secrets.ts | kubectl apply -f -
unset WINDOWS_ADMIN_PASSWORD
```

This creates `win11-ci-unattend` and `win11-desktop-unattend` (`ci` or `desktop` as an argument renders just one). The script refuses a
password on argv, a weak one (under 12 characters, fewer than 3 of lower / upper / digit / symbol), one containing `zetaadmin`, and a
template without each placeholder exactly once. The runner does not need this password (its tasks run as SYSTEM); it is for the install and
for your console and RDP login. Keep it in your password manager: there is no recovery.

### 5. Apply the guests (they stay stopped)

```bash
kubectl apply -f full-ai-cluster/k8s/examples/windows-11/20-win11-ci.yaml -f full-ai-cluster/k8s/examples/windows-11/30-win11-desktop.yaml
kubectl -n windows-vms get vm,dv,pvc          # both DataVolumes Succeeded; every claim on zeta-block-replicated
```

### 6. Start `win11-desktop` first (the one you watch), then `win11-ci`

```bash
virtctl start win11-desktop -n windows-vms
# virtctl-free equivalent (an empty-bodied PUT to the same subresource virtctl uses):
echo '{}' > empty.json && kubectl replace --raw /apis/subresources.kubevirt.io/v1/namespaces/windows-vms/virtualmachines/win11-desktop/start -f empty.json
kubectl -n windows-vms get vmi win11-desktop -w        # Running in about a minute
```

**The one key press.** With a blank disk first in the boot order, firmware falls through to the ISO, and the Windows ISO prints "Press
any key to boot from CD or DVD". Nothing presses it, so send it:

```bash
bun src/Core.TypeScript/cluster/windows-11-vm.ts key win11-desktop KEY_SPACE --repeat 45
bun src/Core.TypeScript/cluster/windows-11-vm.ts screenshot win11-desktop --out desktop.png     # open desktop.png
```

If you missed the window, firmware shows "No bootable option or device was found" (this exact screen was observed): send `KEY_SPACE` once
for the Boot Manager menu and choose the DVD-ROM entry from `virtctl vnc`, or `virtctl restart win11-desktop -n windows-vms` and press again.
After Windows is installed the disk boots first and the prompt never appears again; **do not** press keys while the installer reboots.

Expected timeline (**not measured**, no Windows image has been run): ISO boot and Setup copy 10 to 20 minutes; two reboots; the OOBE pass
and first sign-in 5 to 10 minutes; then the startup task `zeta-bootstrap` runs (the desktop: RDP, virtio tools and the guest agent, a few
minutes; the runner: Git for Windows and the runner download, ~5 to 10 minutes). Watch it with `windows-11-vm.ts screenshot`, `virtctl vnc`, or
`kubectl -n windows-vms get vmi,vm` (a guest-agent-reported IP appears once the desktop's bootstrap has installed the agent).

When the desktop is up, start the runner the same way (`win11-ci`, then `key win11-ci KEY_SPACE --repeat 45`). Memory check first: both guests
reserve ~17 GB; keep more than 10 GB free.

Stopping: `virtctl stop win11-desktop -n windows-vms` waits for Windows to shut itself down (up to the 300 s grace period). A guest with no OS
never answers the ACPI request, so for a stand-in or a hung guest use `echo '{"gracePeriod":0}' > stop0.json` and
`kubectl replace --raw .../virtualmachines/<vm>/stop -f stop0.json`. **Never force-delete the `virt-launcher` pod** (see Known issues).

| virtctl | kubectl only |
|---|---|
| `virtctl start <vm> -n windows-vms` | `kubectl replace --raw /apis/subresources.kubevirt.io/v1/namespaces/windows-vms/virtualmachines/<vm>/start -f empty.json` (`{}`) |
| `virtctl stop <vm> -n windows-vms` | the same with `/stop`; body `{"gracePeriod":0}` skips the wait |
| `virtctl vnc <vm> -n windows-vms` | no equivalent: use `windows-11-vm.ts screenshot` for a still picture |
| `virtctl image-upload` | no equivalent: use the HTTP import (A) |

### 7. Verify

1. `kubectl -n windows-vms get vmi` shows both `Running`; `kubectl -n windows-vms get vm` shows `Running`.
2. GitLab **Admin > CI/CD > Runners**: `zeta-windows` is **Online**, tags `windows`, `zeta-windows`, *Run untagged jobs* off (it is
   `never_contacted` until the guest registers). Or by API with an admin token: `GET /api/v4/runners/all`.
3. A pipeline whose job asks for it:

   ```yaml
   windows-smoke:
     tags: [windows]
     script:
       - $PSVersionTable.PSVersion
       - Get-ComputerInfo | Select-Object OsName, OsVersion
       - git --version
   ```

   and a job with **no** `tags:`: it must run on the Linux runner and never on Windows.
4. On the desktop: `C:\ProgramData\zeta\bootstrap.log` ends with *desktop bootstrap finished*; on the runner it ends with *gitlab-runner
   registered and started*. `C:\ProgramData\zeta\eval-watch.log` has a line after the first 03:00 (or run the script once by hand).
5. When the runner is online and you want it back after a node reboot, set `runStrategy: RerunOnFailure` or `Always` on `win11-ci` (the
   bootstrap is a no-op once registered). **Never leave `Always` on an expired evaluation** (see Evaluation limits).

## Reaching the desktop (GUI)

### VNC: KubeVirt's console

`virtctl vnc win11-desktop -n windows-vms` opens your local VNC viewer on the guest's console. It needs nothing from the guest, so it is how
you watch the install and how you debug a guest with no network. Get `virtctl` from the KubeVirt release page, matching the cluster's
KubeVirt version (v1.8.4). Without it, `windows-11-vm.ts screenshot win11-desktop --out shot.png` gives a still picture of the same console.

### RDP: through an SSH tunnel, never published

The Service `win11-desktop-rdp` is **ClusterIP**: nothing outside the cluster can reach 3389, and an internet- or LAN-facing 3389 is the
most-scanned port there is. Do not make it a `LoadBalancer` or a `NodePort`, do not add a port forward, and do not publish it on the
router. The node can reach ClusterIPs (measured: `ssh -L` to a ClusterIP and an HTTP request through it), so tunnel through the node's sshd:

```bash
kubectl -n windows-vms get svc win11-desktop-rdp -o jsonpath='{.spec.clusterIP}'      # e.g. 10.99.220.66
ssh -N -L 13389:<that-ClusterIP>:3389 zeta@ssh.flowdent.net                           # from the LAN: zeta@192.168.1.79
```

Local port **13389**, not 3389: a Windows PC with its own Remote Desktop server already listens on 3389. Keep that terminal open; it prints
nothing. Sign in as `.\zetaadmin` with the password you typed in step 4.

- **Windows:** `mstsc /v:localhost:13389`, user `.\zetaadmin`.
- **Mac:** install Microsoft's *Windows App* (formerly Microsoft Remote Desktop), add a PC with host `localhost:13389` and user account
  `zetaadmin`.
- If the tunnel opens but the RDP client says the connection is refused: Remote Desktop is not on yet. The desktop's `zeta-bootstrap` task
  enables it, so check `bootstrap.log` over VNC; the ClusterIP changes if the Service is recreated.

The tunnel path was measured end to end through the node's LAN address; `ssh.flowdent.net` was not exercised from the preparation machine
(its host key was not known there).

## Which step failed?

| Symptom | Look at |
|---|---|
| `kubectl apply` of a claim: `exceeded quota ... zeta-block-local` | a `storageClassName` is missing or wrong: the fence did its job |
| `win11-iso` stays `ImportScheduled`, importer in `ContainerCreating` | `kubectl -n windows-vms get events`; a scratch or prime claim refused by the quota (`ErrExceededQuota`, `ErrCreatingPVCPrime`) or the scratch class unset |
| importer `CrashLoopBackOff`, `blockdev: cannot open /dev/cdi-block-volume: Permission denied` | the claim is `volumeMode: Block`; it must be `Filesystem` |
| importer error connecting | the URL, the PC's firewall, or the HTTP server stopped; `kubectl -n windows-vms logs importer-prime-*` |
| `kubectl -n windows-vms get vmi`: stuck `Scheduling` | `kubectl -n windows-vms describe pod virt-launcher-*`: `Insufficient cpu` / memory, a Secret that does not exist yet (mint the token, render the Secrets), a claim not bound |
| VMI `Scheduled` for minutes, never `Running` | `virt-handler` (see Known issues: a force-deleted launcher wedges it) |
| `FailedBackendStorageCreate` on the VMI | the TPM-state claim: `vmStateStorageClass` unset (goes to the refused default class) |
| the screen says "No bootable option or device was found" | the key press was missed; see step 6 |
| Setup shows no disk | `viostor` not loaded: the driver folder in `Autounattend.xml` does not match the virtio-win CD in your cluster |
| Setup stops at an edition list / EULA | `/IMAGE/INDEX` or `AcceptEula` in `Autounattend.xml` (re-render the Secret after editing) |
| Setup says "This PC can't run Windows 11" | the VM is wrong, not the check: Secure Boot, TPM, RAM and disk are provided (verify with `kubectl -n windows-vms get vm win11-desktop -o yaml`) |
| an OOBE screen appears (network, Microsoft account) | Windows 11 changed it: press Shift+F10, run `start ms-cxh:localonly`, create `zetaadmin` by hand; then fix the answer file and record it here |
| installed, no runner appears | on the guest: `C:\ProgramData\zeta\bootstrap.log` |
| `no drive carries runner-token` | `win11-ci-runner-token` was empty or absent at VM start: mint and copy (step 2), then stop and start the VM (KubeVirt builds Secret disks at start) |
| no network in the guest | `NetKVM` was not injected; the bootstrap tries the virtio guest tools MSI; otherwise install it from the virtio-win CD by hand |
| `sha256 ... does not match the pinned` | the guest's egress, or the pin in `settings.json` disagrees with the vendor's `release.sha256` for that exact version |
| jobs never start | the job lacks `tags: [windows]`; or the guest cannot reach `gitlabUrl` |
| RDP refused through the tunnel | RDP not enabled yet (desktop bootstrap), or the ClusterIP changed |

## Evaluation limits (read before you rely on it)

State of knowledge: Microsoft's published behaviours as understood, **not re-verified against the current Evaluation Center text**; that
text governs. Windows 11 Enterprise Evaluation runs about **90 days** from first boot. After expiry a client evaluation warns and restarts
periodically (Server shuts down hourly); with `runStrategy: Always` the VM then flaps. Plan the replacement *before* the date and set
`Halted` rather than let it flap. `slmgr /dlv` and `slmgr /xpr` in the guest show the dates; `eval-watch.ps1` (daily 03:00, SYSTEM) appends the
clock to `eval-watch.log` and writes a Warning (event id 4101) inside 14 days of expiry. It **reports and never acts**: no rearm, no
licensing call, no shutdown. Whether rearming an evaluation is within Microsoft's terms is for you to read and decide.

Evaluation media is for evaluating. CI for a product you ship, or any work that outlives the trial, needs **a licence you hold**. An OEM
Windows licence is bound to the machine it shipped on and cannot be moved into a VM. (This is not legal advice.) The runner keeps the same
`glrt-` token and runner record across reboots and rearms; a rebuilt disk registers a new manager under the **same** record, so do not
re-mint the token to "fix" a runner (that creates a new record).

### A licensed prepared image later

Use the sibling runbook's "Prepared image" mode: set the root DataVolume's `source` to `http:` / `pvc:` / `registry:` instead of `blank: {}`,
and drop the `iso` disk, volume and `win11-iso`. The image needs the virtio drivers (`viostor`, `NetKVM`) and a first-boot mechanism: a
generalized image reads `Unattend.xml` from the same `sysprep` Secret, which schedules the VM's own `bootstrap.ps1` (found by file name).

## Snapshots and backups

Each guest disk is a Longhorn volume (`zeta-block-replicated`, **one replica**, on one of the two NVMe disks). A **Longhorn snapshot** is
crash-consistent and lives on the same disk as the volume: it protects against a bad Windows update or a corrupted guest, **not against losing
the disk**, and it is **not a backup**. No Longhorn backup target is configured (`backuptargets.longhorn.io/default` is not available), and
the cluster has no CSI `VolumeSnapshotClass`, so KubeVirt's `VirtualMachineSnapshot` is unavailable. Snapshot a guest's disk with Longhorn's own
object (`createSnapshot: true` is what makes it take one; without it the object only tracks a snapshot that already exists, finds none and is
removed). Measured: this works on a **stopped** guest's disk too, because Longhorn attaches the volume itself for the snapshot.

```bash
PV=$(kubectl -n windows-vms get pvc win11-desktop-root -o jsonpath='{.spec.volumeName}')
cat <<EOF | kubectl apply -f -
apiVersion: longhorn.io/v1beta2
kind: Snapshot
metadata: { name: win11-desktop-before-update, namespace: longhorn-system }
spec: { volume: $PV, createSnapshot: true }
EOF
kubectl -n longhorn-system get snapshots.longhorn.io win11-desktop-before-update      # READYTOUSE true
```

Stop the guest first for a clean snapshot (a running guest's snapshot is crash-consistent only). To roll back, use the Longhorn UI or revert the
volume to that snapshot while the guest is stopped. **Deleting a snapshot can hang on a volume that has never carried a workload**: measured, the
object stayed `markRemoved` with a stale "engine is upgrading" error for more than ten minutes even though the volume was attached and healthy,
and had to be released by removing its finalizer. The `win11-iso` claim can be deleted once both guests are installed (they only need it to
install); the TPM and UEFI state claims (`persistent-state-for-*`, 12Mi, class `longhorn`) hold the BitLocker-relevant TPM state, so treat them as
part of the VM: deleting the VM deletes its claim, and the `longhorn` class **retains** the volume, so remove an orphaned `Released` PV by hand.

## Storage placement: how to prove it

```bash
kubectl -n windows-vms get pvc -o custom-columns=N:.metadata.name,SC:.spec.storageClassName,SIZE:.status.capacity.storage
kubectl get pvc -A -o custom-columns=NS:.metadata.namespace,N:.metadata.name,SC:.spec.storageClassName | grep windows-vms     # no zeta-block-local
kubectl -n longhorn-system get replicas.longhorn.io -o custom-columns=V:.spec.volumeName,DISK:.spec.diskPath | grep <pv>      # /var/lib/longhorn-disk1 or -disk2
```

Measured 2026-10-03: `win11-ci-root` on `longhorn-disk2`, `win11-desktop-root` on `longhorn-disk1`, 1 replica each. Longhorn reserves ~30% of
each disk, and with these two disks plus the storage-relocation work (postgres, SeaweedFS, forgejo) scheduled, ~164 GiB (disk1) and ~230 GiB (disk2)
were still schedulable, ~394 GiB in all. Windows disks are thin, so real use starts small and grows; check
`kubectl -n longhorn-system get nodes.longhorn.io -o wide` before adding more.

## What is proven, and what is unproven

### Proven on this node, 2026-10-03

- **Server-side dry-run** of every manifest (KubeVirt's and CDI's admission webhooks judged them), and the namespace, quota and limit range
  were applied for real; the quota refuses a claim with no `storageClassName` (the default class), measured with a throwaway claim.
- **Both VM specs boot to firmware** under the real spec: OVMF with Secure Boot (`OVMF_CODE.secboot.fd`, `secure='yes'`), persistent NVRAM, SMM
  on, `host-passthrough`, the Hyper-V enlightenments, a persistent TPM 2.0 (CRB, `persistent_state='yes'`), a virtio root disk first and the ISO
  second, five or six SATA CD-ROMs (ISO, virtio-win, ConfigMap, Secret, sysprep). The firmware tried the blank disk, then the empty DVD, and
  reported "No bootable option": the expected stop for a stand-in. Both guests ran **at the same time**, sharing one ISO claim, with ~31 GB
  of host memory free. (The stand-ins were an empty 8Gi volume and the unrendered answer-file template; they were deleted afterwards.)
- **Secure Boot and the TPM work in a guest**: a Fedora guest booted with the same firmware/TPM/CPU spec read `SecureBoot` = enabled
  (`secureboot: Secure boot enabled`), saw `/dev/tpm0` and `/dev/tpmrm0` (TPM version 2), and a TPM NV index it defined **survived a restart
  of the VMI** (persistent state works on a Longhorn `ReadWriteOnce` claim).
- **The virtio-win CD layout** (`virtio-win-0.1.266` in `quay.io/kubevirt/virtio-container-disk:v1.8.4`, 724 MB, pulls from the node): `viostor`,
  `vioscsi`, `NetKVM`, `vioserial`, `Balloon`, `viorng`, `vioinput`, `pvpanic` each have `w11\amd64`; `virtio-win-gt-x64.msi`,
  `virtio-win-guest-tools.exe` and `guest-agent\qemu-ga-x86_64.msi` are at the root.
- **The ISO path with a stand-in file**: a 512 MiB random file served from this PC by `python -m http.server` imported into a Longhorn
  Filesystem-mode claim in ~50 s; the first 512 MiB of `disk.img` hash-matched the source; the same claim was mounted read-only by two pods at once.
- **The guest network** (a masquerade guest, the same interface config as the Windows VMs): it resolved
  `gitlab-webservice-default.gitlab.svc.cluster.local` through the DHCP-provided resolver, got `{"status":"ok"}` from GitLab's Workhorse
  `:8181/-/readiness`, and fetched over HTTPS from the runner download bucket. A Service over a launcher pod is reachable from the node.
- **The token Job on GitLab 19.4.1**: `kubectl apply` of `gitlab-windows-runner-token.yaml` minted the token (Secret has a value, not printed) and
  the runner record exists in GitLab: id 2, description `zeta-windows`, instance runner, tags `windows`, `zeta-windows`, run-untagged **false**,
  status `never_contacted`. `copy-secret.ts` copied the token into `windows-vms` without printing it.
- **`windows-11-vm.ts`**: `virsh screenshot` and `virsh send-key` work through `kubectl exec` in the launcher's `compute` container (a key press
  produced the firmware's Boot Manager menu on the stopped-OS guest).
- Static: `src/Core.TypeScript/cluster/windows-11-vms.test.ts`.

### UNPROVEN, stated plainly

- **No Windows image has ever run on this cluster.** Setup reading `Autounattend.xml` from the sysprep CD, the `/IMAGE/INDEX`, the partition
  layout, the drivers loading in WinPE and being injected offline, the OOBE screens skipping (Windows 11's OOBE changes between builds), and
  the first-boot task finding its files have **not been run**.
- That Windows 11's own checks accept this VM (Secure Boot and the TPM are present and measured with Linux; Setup's verdict is unmeasured).
- That the "Press any key to boot from CD or DVD" prompt is answered in time by `windows-11-vm.ts key` (the key injection is proven on the
  firmware menu; the Windows ISO prompt is not).
- `zeta-bootstrap`: the runner download, `gitlab-runner register` against GitLab 19.4.1 with the v19.4.1 binary, the Git for Windows install, RDP
  being reachable after the bootstrap, the guest tools and agent installing silently.
- RDP through `ssh.flowdent.net` (proven through the node's LAN address only), mstsc / Windows App behaviour, performance.
- The upload path (`virtctl image-upload`).

## Known issues (hit during the 2026-10-03 preparation)

1. **`volumeMode: Block` import fails: `blockdev: cannot open /dev/cdi-block-volume: Permission denied`.** The Longhorn classes' CDI
   StorageProfiles say Block, and the non-root importer cannot open the raw device (the container runtime does not give it ownership). Every
   claim here sets `volumeMode: Filesystem` explicitly.
2. **KubeVirt's TPM / UEFI state claim wants `ReadWriteMany` and the node cannot mount NFS.** With `vmStateStorageClass: zeta-block-replicated`
   KubeVirt created an RWX claim (the class's StorageProfile has no Filesystem entry, so it defaults to RWX); Longhorn serves RWX over NFS and
   the mount failed on this NixOS node (`nsenter: failed to execute mount`). The class `longhorn` (profile: RWO Filesystem) yields an RWO claim
   and works. `longhorn` is `Retain`, so deleting a VM leaves a ~12Mi `Released` volume to clean up by hand. **Live only, not in git**: the
   repo names storage by capability (never a provider class), and a `longhorn` literal in `kubevirt-cr.yaml` made the dev-lane catalog audit
   (`auditAppliedButUnasserted`) drop the `kubevirt` Application from the dev lane (measured). A tidy fix, not done here: give the
   `zeta-block-replicated` CDI StorageProfile a `ReadWriteOnce` Filesystem entry, so KubeVirt picks an RWO claim on the capability class and
   `vmStateStorageClass: zeta-block-replicated` can live in git. `kubectl patch kubevirt ...` (step 0) re-applies the live value after a rebuild.
3. **Unset `vmStateStorageClass` puts the TPM claim on the default class**: the namespace quota rejected it (`FailedBackendStorageCreate`).
   That was the fence working; it is also why the setting exists.
4. **CDI creates a scratch claim for an HTTP import, and a "prime" claim of the target's size.** With `zeta-block-local` as the scratch class
   (what git says) the quota refuses it and the import waits; the live CDI value is `zeta-block-replicated` (applied by hand, **not in git**: the
   kind CI lane pins the git value). `argocd app sync cdi` would revert it, and the fence would then refuse the scratch claim loudly rather than
   fill the root disk. A quota of 240Gi also refused the second disk's prime claim: it is 400Gi now. `python -m http.server` does not support range
   requests; a range-capable server was also given a scratch claim (measured), so a server change does not remove the need.
5. **`Insufficient cpu`.** The platform's CPU requests take ~90% of the node; the guests reserve 2 CPUs each (4 vCPU, no limit).
6. **A bare helper pod in `windows-vms` is refused** (`must specify limits.memory`): the quota limits memory, so the limit range gives pods
   defaults. KubeVirt and CDI pods declare their own.
7. **Press any key.** The Windows ISO's UEFI boot needs a key press (see step 6); with the disk first in the boot order it appears only on
   the first, install boot.
8. **Never force-delete a `virt-launcher` pod.** Doing it to a running guest left `virt-handler` looping on the dead domain ("Signaled graceful
   shutdown") and the next VMI of the same name sat in `Scheduled` until `virt-handler` was restarted (`kubectl -n kubevirt delete pod
   virt-handler-*`; running guests are not affected). Stop with the `stop` subresource (`gracePeriod: 0` for a guest with no OS).
9. **Stopping an OS-less or hung guest waits 300 s**, the guest's `terminationGracePeriodSeconds` (right for a real Windows shutdown).
10. **No `virtctl` on the preparation machine**: start, stop, screenshot and key press work through `kubectl` and `windows-11-vm.ts`; only
    `virtctl vnc` and `image-upload` need it.
11. **Image storage is on the same 120 GB root.** The preparation pulled ~1.4 GB more (virtio-win, a Fedora test image, importer images);
    `imageFs` was 27% available afterwards, against a 25% floor. Check step 0 before pulling anything else.
12. **ArgoCD shows `cdi` as `OutOfSync` (`Healthy`).** Measured cause: `cdi-operator` owns two fields ArgoCD also tries to apply. It rewrites
    `.spec.customizeComponents.patches` of the CDI CR in alphabetical order (git lists `cdi-deployment` first; the operator stores `cdi-apiserver`
    first), and it removes the `v1alpha1` version from the `cdis.cdi.kubevirt.io` CRD (git still lists it). A server-side apply diff reports a
    field-manager conflict on both. **It does not matter for these VMs**: CDI is `Deployed` and imports work; the Application is manual-sync
    anyway. Fixing it is an ArgoCD `ignoreDifferences` on those two paths plus alphabetizing the patches, outside this change.
13. **The token Job's image is `kubectl:v17.7.0`** while GitLab runs 19.4.1; the Job still worked on 19.4.1. The runner binary pinned for the
    guests is v19.4.1 (sha256 from the vendor's `release.sha256`), to match the server.

## Uninstall

```bash
kubectl delete -f full-ai-cluster/k8s/examples/windows-11/30-win11-desktop.yaml -f full-ai-cluster/k8s/examples/windows-11/20-win11-ci.yaml
kubectl -n windows-vms delete dv win11-iso secret win11-ci-unattend win11-desktop-unattend win11-ci-runner-token
kubectl delete -f full-ai-cluster/k8s/examples/windows-11/00-namespace.yaml                  # the namespace and everything left in it
kubectl delete pv $(kubectl get pv | awk '/windows-vms\/persistent-state/ {print $1}')       # retained TPM-state volumes (class longhorn)
kubectl delete -f full-ai-cluster/k8s/examples/gitlab-windows-runner-token.yaml              # Job, RBAC, the token Secret in gitlab
```

then delete the `zeta-windows` runner in GitLab Admin > CI/CD > Runners (the record outlives the token Secret) and the Longhorn volumes of the
retained claims (`kubectl -n longhorn-system delete volumes.longhorn.io <pv>`).
