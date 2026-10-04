# Windows VM golden image: capture the desktop's disk once, boot copies of it later

> A **golden image** here is a verified clone of `win11-desktop`'s root disk (and, when it has one, of its TPM and UEFI state) held in the **same**
> Longhorn pool as a claim named `win11-golden-<label>-<yyyymmdd>`. It lets you roll back or stand up another desktop with Open Dental and the
> Flowdent API already installed. **It is a copy on the same node and the same disks: protection against a bad install or a bad update, not a backup.**
> Every command below runs from your Mac as `ssh zeta@ssh.flowdent.net '...'` (from the LAN: `zeta@192.168.1.79`); nothing needs `kubectl`, `virtctl`,
> `bun` or a repository checkout on the Mac.

Context and the rest of the Windows setup: [`WINDOWS-11-VMS.md`](WINDOWS-11-VMS.md) (the "Capture and reuse the disk" section is the short form of this
page). Helper: `src/Core.TypeScript/cluster/windows-vm-golden-image.ts`, one file that needs only `kubectl` and Node (the node has Node v24, which runs
a `.ts` file as it is). Its pure parts (capacity guard, names, manifests, verification parsing) are tested in `windows-vm-golden-image.test.ts`; the
cluster side is proven by `selftest` (below), which creates a throwaway 2Gi stand-in, runs the exact same code path and deletes it.

## What you will do, in order

1. **Install the helper on the node** (once; re-run to update).
2. **Prepare Windows** (inside the guest): decide about BitLocker, say what the copy is for, stop installing.
3. **`guard`**: ask whether the copy would fit (read-only).
4. **`capture`**: stop the guest, snapshot, clone, verify, restart the guest.
5. **Later, `restore`** into a new VM, start it, connect over RDP as usual.

### 1. Install the helper on the node

```bash
ssh zeta@ssh.flowdent.net 'curl -fsSL https://raw.githubusercontent.com/Lucent-Financial-Group/Zeta/main/src/Core.TypeScript/cluster/windows-vm-golden-image.ts -o ~/windows-vm-golden-image.ts && node --version && node ~/windows-vm-golden-image.ts guard --vm win11-desktop --with-state'
```

That downloads one file (the repository is public) and runs the read-only guard. If you would rather copy it from a checkout:
`scp src/Core.TypeScript/cluster/windows-vm-golden-image.ts zeta@ssh.flowdent.net:` . (From the LAN PC, `ssh.flowdent.net` timed out on 2 of 5 attempts on
2026-10-04 and answered on the others: retry, or use `zeta@192.168.1.79` from the LAN.)

### 2. Prepare Windows (before you capture)

Do these in the guest (RDP in, an elevated PowerShell), then **shut Windows down yourself or let `capture` do it**:

| Check | Why | Measured on `win11-desktop`, 2026-10-04 |
|---|---|---|
| `manage-bde -status C:` | Windows 11 may encrypt `C:` by itself ("device encryption"). A clone only boots on a machine that can unlock it. | `FullyEncrypted`, `XtsAes128`, **`ProtectionStatus: Off`**: the key is stored in the clear, so another TPM can read it. If protection ever turns **On** (a Microsoft-account sign-in or a policy can do it), the volume key is sealed to this VM's TPM and a copy **without the TPM state** asks for the recovery key. Either keep the TPM state in the image (`--with-state`, the default of `capture`) and the **same `firmware.uuid`**, or print and save the key now: `manage-bde -protectors -get C:`. |
| Decrypt before generalising | `sysprep` refuses a BitLocker volume. | `manage-bde -off C:`, then `manage-bde -status C:` until it says `Fully Decrypted` (it runs in the background). |
| `slmgr /xpr` | A copy resumes the **same** evaluation clock. | `EnterpriseEval ... will expire 1/1/2027 1:59:50 PM` |
| Content of `C:` | Every copy contains everything on the disk: the Open Dental database, API keys, saved sessions. | Not measured (nothing is installed yet). Keep real patient data and live credentials off a disk you intend to copy; use test data. |

### 3. Ask the guard (read-only)

```bash
ssh zeta@ssh.flowdent.net 'node ~/windows-vm-golden-image.ts guard --vm win11-desktop --with-state'
```

It reads the claim, its real (thin) size from Longhorn, the namespace quota and every Longhorn disk, and prints which number would fail. Measured now (a
106 GiB claim that really occupies 19.4 GiB):

```
  . clone path: legacy (usePopulator=false: 1x); peak 106.0 GiB in 2 claim(s)
  . quota requests.storage: 201.4 GiB + 106.0 GiB = 307.4 GiB of 400.0 GiB
  . Longhorn can place 2 volume(s); schedulable per disk: ...=164.4 GiB, ...=219.6 GiB
capacity guard: OK
```

Add `--populator` to see why it is not the default: the same clone is refused (**201.4 + 212.0 = 413.4 GiB, above the 400.0 GiB ceiling**), and the guard prints the
`kubectl patch resourcequota` that would make it fit. **Raising the quota is your decision, not the script's**; put the old value back afterwards. A refusal
creates nothing.

### 4. Capture

```bash
ssh zeta@ssh.flowdent.net 'nohup node ~/windows-vm-golden-image.ts capture --vm win11-desktop --label dental-ready --yes > ~/golden-capture.log 2>&1 &'
ssh zeta@ssh.flowdent.net 'tail -n 20 ~/golden-capture.log'            # repeat until it ends with DONE or an error
```

`nohup ... &` so a dropped connection does not kill it half-way. `--yes` is your consent to **shut the guest down** (`runStrategy` is `Always`, so a plain
Windows shutdown would restart it; the helper sets `Halted` first and puts the original value back at the end, also on failure). In order, it:

1. runs the capacity guard and refuses (creating nothing) if it fails, or if `win11-golden-dental-ready-<today>` already exists;
2. sets `runStrategy: Halted` and waits for the VMI to disappear (Windows is asked to shut down; up to its 300 s grace period);
3. takes a **Longhorn snapshot** `win11-desktop-before-golden-<date>` (rollback point, same disk; skip with `--no-snapshot`);
4. clones `win11-desktop-root` into DataVolume `win11-golden-dental-ready-<date>` (CDI host-assisted clone, class `zeta-block-replicated`, Filesystem mode, **no
   size given** so CDI sizes it from the image, annotation `cdi.kubevirt.io/storage.usePopulator: "false"`), tagging it with the source VM, `firmware.uuid`
   and `firmware.serial`;
5. clones the TPM/UEFI state claim (`persistent-state-for-win11-desktop-*`, 12Mi) into `win11-golden-dental-ready-<date>-state` (skip with `--no-state`);
6. **verifies**: a read-only pod mounts the source and the copy and compares `disk.img`'s size and the sha256 of its first 512 MiB (`--verify-mib N`; `--full-hash`
   reads the whole file, slow but total). A mismatch exits 1 and says not to use the copy; the source is never modified;
7. restarts the guest (`--keep-halted` leaves it off).

Not measured on the real disk: how long step 4 takes for 19 GiB of data (the owner is still installing, so the real disk was not touched). The 2Gi
stand-in took 35 to 46 s end to end, most of it pod scheduling, so expect minutes to tens of minutes and watch the log.

### 5. Restore into a new VM

```bash
ssh zeta@ssh.flowdent.net 'node ~/windows-vm-golden-image.ts restore --golden win11-golden-dental-ready-20261004 --as win11-desktop-restored --with-state --apply'
```

Drop `--apply` to **render** the objects as JSON for review and pipe them to `kubectl apply --dry-run=server -f -` to have the cluster's webhooks check them
without creating anything. What `restore` makes, all in `windows-vms`:

| Object | What it is |
|---|---|
| DataVolume `<vm>-root` | a clone **of the golden claim**, no size given. The golden is only ever read: any number of VMs can be made from one golden, one at a time. |
| DataVolume `persistent-state-for-<vm>` (with `--with-state`) | a clone of the golden's state claim, labelled `persistent-state-for=<vm>`, which is what KubeVirt adopts as the VM's TPM/NVRAM store. |
| VirtualMachine `<vm>` | the **live** `win11-desktop` spec (so anything you changed on it is carried) with its own name and launcher label, its own root claim, **no installer ISO**, `runStrategy: Halted`, role `zeta.io/windows-role: desktop`. `win11-ci`, `win11-desktop` are refused as names: a restore never overwrites a guest. |
| Services `<vm>-rdp`, `<vm>-ssh` | ClusterIP only, like the originals. |

Start it and connect (the Mac recipe in `WINDOWS-11-VMS.md`, with `<vm>-rdp` in place of `win11-desktop-rdp`):

```bash
ssh zeta@ssh.flowdent.net 'kubectl -n windows-vms patch vm win11-desktop-restored --type merge -p "{\"spec\":{\"runStrategy\":\"Always\"}}"'
```

**Apply the network policy first, once**: `40-network-policy.yaml` now selects guests by the `zeta.io/windows-role` label (so a restored desktop is fenced the
day it is created; an endpoint a policy does not select accepts every connection). It is a git change that has **not** been applied to the live cluster; run
`kubectl apply -f full-ai-cluster/k8s/examples/windows-11/40-network-policy.yaml` from a checkout, or ask for it, before the first restore.

**What the guard will refuse, with today's numbers** (try `guard --vm win11-desktop --restore`):

* **Memory.** `win11-ci` and `win11-desktop` hold 16.8 GiB of the 24 GiB `requests.memory` quota; a third running 8 GiB guest (+ ~10% launcher overhead) needs 8.8 GiB
  more. **Stop one of them first** (`win11-ci` is the usual one) or the owner raises the quota.
* **Storage.** The golden (106 GiB) plus the original plus one restored copy plus `win11-ci` and the ISO is 413 GiB against a 400 GiB ceiling. Delete the ISO claim
  (`win11-iso`, 10.6 GiB, only needed to install) and a checkpoint you no longer want, or raise the ceiling.
* **Longhorn** has 385 GiB schedulable across its two disks (164 + 220), which is the real limit; the quota is a fence in front of it.

### Carrying the TPM and UEFI state, and what that does and does not give you

Measured with a stand-in VM that has the same firmware, TPM and persistent-state spec:

* KubeVirt **adopts** a claim labelled `persistent-state-for=<vm>` that exists before the VM first starts, on any class (here `zeta-block-replicated`, not the
  `longhorn` class KubeVirt picks itself, which is `Retain` and leaves a `Released` volume behind when the VM is deleted).
* UEFI NVRAM is the file `nvram/<vm>_VARS.fd` and the TPM is the directory `swtpm/<firmware.uuid>`. So the state carries to a VM with the **same name** and the **same
  `spec.template.spec.domain.firmware.uuid`** (restore copies the golden's uuid when you pass `--with-state`). With a different name the NVRAM starts fresh
  (the guest's EFI partition carries the fallback `\EFI\BOOT\BOOTX64.EFI`, so Windows still has a boot path) and the TPM is expected to carry because the uuid
  does (**unproven for a renamed VM**).
* A **fresh** TPM and NVRAM with the disk alone: the disk would boot **if** BitLocker protection is off (see step 2) and the firmware finds the fallback loader
  (it exists on `win11-desktop`'s EFI partition, measured through SSH). **Not proven by an actual boot**: that needs a clone of the real, in-use disk, which
  this work deliberately did not make. The first real restore is the proof; if it lands in the firmware menu, the Windows ISO's Shift+F10 prompt can run
  `bcdboot C:\Windows`.

### Generalising for several VMs at once (and why you may not need to)

A restored copy of a **non-generalised** disk is the same machine: same computer name (`WIN11-DESK`), same SID, same evaluation clock. That is right for
rollback and replacement, and acceptable for isolated test copies; it is wrong for two desktops that must see each other by name on a network (Open Dental
workstations identify themselves by computer name). To make many distinct machines from one golden:

1. In the guest: `manage-bde -off C:` and wait until it reports `Fully Decrypted`.
2. `C:\Windows\System32\Sysprep\sysprep.exe /generalize /oobe /shutdown`. The usual failures are in `C:\Windows\System32\Sysprep\Panther\setuperr.log` (a Store app
   updated for one user but not provisioned for all is the classic one).
3. Capture **that** shut-down disk (`capture --vm win11-desktop --no-snapshot --label generalised`, with the VM already off by sysprep).
4. Each restored VM then runs a specialize pass reading `Unattend.xml` from the same `sysprep` Secret CD (`windows-11-unattend/Unattend.xml`: it only copies
   `bootstrap.ps1` and schedules it at every start).

**Unproven and incomplete, stated plainly:** that `Unattend.xml` has been **never executed against a real image** (its own header says so) and carries no
`oobeSystem` pass, so a generalised copy will stop at the first-run screens and ask for a local account at the **VNC console** (the bootstrap waits for
`zetaadmin` to exist). The evaluation clock and the rearm count are Microsoft's to define: a `/generalize` consumes a rearm
(`slmgr /dlv` shows the count; the existing "Evaluation limits" section of `WINDOWS-11-VMS.md` governs). For an exact replacement of the machine, do not generalise.

### Rolling back with the snapshot instead

The Longhorn snapshot taken in step 4.3 is the cheaper undo for "I broke the install after capturing": it is a point on the **same** volume. Reverting is a
Longhorn operation done with the guest **stopped**, in the Longhorn UI (Volume, attach in maintenance mode, revert to the snapshot). That UI path was **not**
exercised here. Delete snapshots you no longer need: a snapshot of a busy disk grows as the disk changes.

## Off-node copy: there is none yet, and what each option costs

Everything above stays on `node-5b2dfa`'s two NVMe disks. Losing the node, or both disks, loses the golden image **and** the original.

| Option | Protects against | Needs | Cost / limit |
|---|---|---|---|
| **Longhorn backup target on the in-cluster SeaweedFS** (S3-compatible) | a corrupted or lost Longhorn volume or replica | a backup target setting and a bucket (SeaweedFS already serves a `zeta-backups` bucket) | **same node**: no protection against losing the node. A Longhorn backup copies the blocks in use, so roughly the 19 GiB the disk really holds (not measured here). Cheap to try. No Longhorn backup target is configured today (`WINDOWS-11-VMS.md`, "Snapshots and backups"). |
| **Azure Blob** (`flowdent863701`) | node loss, site loss | **your** storage credential or a scoped SAS token | Egress and storage billed by Azure at its current rates (not looked up here). The only real off-node target already in your hands. I did **not** use or write to it. |
| **Export to your PC** (`virtctl vmexport`, or `ssh ... 'tar'` streamed over SSH) | node loss | enough free disk: `D:` is full and `C:` had ~35 GB free on 2026-10-04 | A thin 106 GiB disk holding 19 GiB would have to be exported sparse or compressed (the ratio was not measured); a 106 GiB raw export does not fit `C:`. `virtctl` and a kubeconfig would have to exist on the PC. |

**Recommendation:** Azure Blob, with a SAS token scoped to one container and an expiry, written by a Longhorn backup (so it is incremental after the first copy). It is the
only option that survives losing the node, and the token is the one step this work will not do for you. Until then treat the golden image as a rollback aid.

## Measured behaviour the helper's constants come from (2026-10-04; CDI v1.65.0, KubeVirt v1.8.4, Longhorn engine v1.12.1)

| Fact | Evidence | Consequence |
|---|---|---|
| The default clone path holds a **prime claim and the target at once** | while a default-path clone of a 2172Mi source ran, the namespace quota counted three claims (the source, a `tmp-pvc-*` prime, the target); on the legacy path, two; so **2x** vs 1x | `usePopulator: "false"` (legacy path) is the default: measured **1x**, one claim per clone, and it fits the 400Gi quota where 2x does not |
| A clone of a sparse `disk.img` stays sparse and byte-identical | full sha256 equal; allocated blocks 6144 = 6144 (3 MiB of a 1.9 GiB image) | a 106 GiB thin disk copies as ~19 GiB, and `--full-hash` is a total check |
| Omit `storage` size on a disk clone: CDI sizes the target from `disk.img` (+6%) | 2304Mi golden cloned to a 2052Mi claim; an explicit size gets +6% on top, per generation | `capture` and `restore` give **no size** on the disk clone |
| A state claim has no `disk.img`; its size-detection pod fails and the clone waits forever | `size-detection-*` pod in `Error`, DataVolume stuck `CloneScheduled` | the state clone carries an **explicit** size (capacity +10%, 12Mi -> 14Mi) |
| DataVolume labels reach the claim | `persistent-state-for` appeared on the clone's claim | that is how the restored state claim is made adoptable |
| TPM/NVRAM carry over only with the same VM name and `firmware.uuid` | a different name wrote a new `nvram/<vm>_VARS.fd` and a second `swtpm/<uuid>` directory; same name with a recreated VM still got a **new** TPM directory until `firmware.uuid` was copied, after which there was exactly one | `firmware.uuid` / `serial` are recorded on the golden and reapplied |
| Deleting a VM deletes KubeVirt's own state claim but leaves a `Retain` volume | `Released` PV, 12Mi, class `longhorn` | `selftest` removes only its own by name; see `WINDOWS-11-VMS.md` for the original VMs |
| `Snapshot` creation works on a detached volume (3 to 10 s) but **deletion hangs** | the object stayed with `markRemoved: true` and the stale message "engine ... is upgrading from image '' to ...:v1.12.1" for more than two minutes with the volume attached and healthy; removing the `longhorn.io` finalizer deleted the object, while the engine kept the snapshot marked `removed` | a snapshot is cheap to take and **not** cheap to delete: do not take them casually; `selftest` removes the finalizer and the stand-in volume with it |

## Prove the mechanism again (any time, harmless)

```bash
ssh zeta@ssh.flowdent.net 'node ~/windows-vm-golden-image.ts selftest --with-vm'
```

Creates `gi-selftest-*` objects (a 2Gi stand-in with a sparse `disk.img` holding recognisable patterns, a snapshot, two clones, and with `--with-vm` a 512Mi VM with a
persistent TPM and NVRAM), runs capture, verify, restore, read-back and the state carry-over, **and `capture` against a second, RUNNING stand-in VM with `runStrategy: Always`** (so the stop, snapshot, clone, state clone, verify and restart path is exercised for real, and the `Always` strategy is checked to be back afterwards), then deletes everything it made (including its `Retain` volume, by name) and
reports any leftover. It never touches `win11-ci`, `win11-desktop` or their claims.

## Deleting a golden image

```bash
ssh zeta@ssh.flowdent.net 'kubectl -n windows-vms delete dv win11-golden-dental-ready-20261004 win11-golden-dental-ready-20261004-state'
```

Both classes involved (`zeta-block-replicated`) are `Delete`, so the volumes go with the claims. Restored VMs have their own clones and are unaffected.
