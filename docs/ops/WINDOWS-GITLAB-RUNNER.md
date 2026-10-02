# Windows GitLab runner on KubeVirt

Run Windows CI jobs on the cluster: a Windows VM hosted by KubeVirt that registers itself with the
in-cluster GitLab as a runner tagged `windows`. **Opt-in** — nothing here is applied by a fresh install,
nothing here ships, fetches or redistributes Windows, and the cluster keeps tracking `main` (GitOps, no
reflash).

Read this first: [what is proven and what is not](#what-is-proven-and-what-is-unproven). No Windows image
exists in CI, so the guest's install, boot and the runner's registration have **never been run**. The
runbook is written so you find out quickly and unambiguously which step failed.

## Free by default: a Microsoft evaluation ISO

The recommended image costs nothing: **Windows Server 2022 Evaluation** (or Server 2025 Evaluation),
about **180 days**, **no product key**. The alternative is **Windows 11 Enterprise Evaluation**, about
**90 days**. A VM guest installed from either is licensed *for evaluation only* — see
[Limits](#limits-of-evaluation-media-read-before-you-rely-on-it) before you build anything lasting on it.

What stays a **human step** (not automatable, not ours to do):

1. Open the Microsoft Evaluation Center: <https://www.microsoft.com/en-us/evalcenter>.
2. Choose the product (Windows Server 2022 or 2025 Evaluation, ISO, 64-bit), **read and accept Microsoft's
   evaluation terms**, register as it asks, and download the ISO yourself.
3. Give the ISO to the cluster as a `DataVolume` source — by an HTTP URL you host, or by `virtctl
   image-upload`; exact commands in [Steps](#steps). The repo never contains a Microsoft download URL.

Everything after that is unattended: the installer reads `Autounattend.xml` (no product key; the EULA
acceptance is *yours*, made on that page and again by the `AcceptEula` value in the file), loads the virtio
disk driver, partitions the blank disk, installs, and a startup task installs and registers the runner.

If you hold a licensed Windows image instead (a purchased Windows Server licence, a licence your
organisation already holds), use [a prepared image](#prepared-image-the-second-mode) and none of the
evaluation limits apply.

## What you get

| Piece | File | Applied by |
|---|---|---|
| Runner record + `glrt-` token Secret `gitlab-windows-runner-token` | `full-ai-cluster/k8s/examples/gitlab-windows-runner-token.yaml` | you, once |
| The Windows guest (ISO, disk, drivers, bootstrap, RDP Service) | `full-ai-cluster/k8s/examples/kubevirt-windows-gitlab-runner.yaml` | you, after editing one line |
| The unattended-install answer files | `full-ai-cluster/k8s/examples/windows-runner-unattend/` (`Autounattend.xml`, `Unattend.xml`) | rendered into Secret `windows-runner-unattend` by `src/Core.TypeScript/cluster/windows-runner-unattend-secret.ts` |
| KubeVirt + CDI (the hypervisor layer) | `k8s/applications/kubevirt`, `k8s/applications/cdi` | the first-boot roster (`zeta-virt-first-sync`) |
| GitLab and its Linux runner | `k8s/applications/gitlab` | ArgoCD |

Both example manifests live beside, not under, `k8s/applications/`, for the reason recorded in
`kubevirt-windows-vm.yaml`: ArgoCD's root reads only `applications/*/Application.yaml` (so nothing syncs
them), and the audits that price the cluster walk that tree for volume claims, so a 64Gi claim inside it
would be counted as always-on demand that no sync provisions.

### The tag contract (why this is safe next to the Linux runner)

| | Linux runner (`zeta-cluster`) | Windows runner (`zeta-windows`) |
|---|---|---|
| tags | `kubernetes`, `zeta-cluster` | `windows`, `zeta-windows` |
| takes untagged jobs | **yes** | **no** |
| minted by | Job `gitlab-runner-token` (in the GitLab Application) | Job `gitlab-windows-runner-token` (this runbook) |
| token Secret | `gitlab-gitlab-runner-secret` | `gitlab-windows-runner-token` |

A tag-less `.gitlab-ci.yml` can never land on Windows, and `tags: [windows]` can never land on Linux.
`src/Core.TypeScript/cluster/gitlab-windows-runner.test.ts` reads both sides from their sources and fails if
the tag sets overlap or the Windows runner ever takes untagged jobs.

## Prerequisites

1. GitLab is Synced/Healthy and you can log in as `root` (see the GitLab runbook for the initial password).
2. KubeVirt and CDI are Available: `kubectl get kubevirt -n kubevirt` and `kubectl get cdi`. On a host with
   no `/dev/kvm` they run under software emulation, where **Windows is not usable** — you need hardware
   virtualisation on the node (`kubectl describe node <n> | grep devices.kubevirt.io/kvm`).
3. The evaluation ISO from the [human step above](#free-by-default-a-microsoft-evaluation-iso), or a
   licensed prepared image.
4. Capacity (not counted in the cluster's ledgers, on purpose — see
   [Storage and capacity](#storage-and-capacity)): 64Gi of disk plus a 10Gi one-off for the ISO, 4 vCPU and
   ~8.5Gi of memory requested on the node GitLab runs on.
5. `virtctl` for the console and the upload:
   <https://kubevirt.io/user-guide/user_workloads/virtctl_client_tool/>, and `bun` (the repo's toolchain).

## Steps

### 1. Mint the runner token

```bash
kubectl apply -f full-ai-cluster/k8s/examples/gitlab-windows-runner-token.yaml
kubectl -n gitlab wait --for=condition=complete job/gitlab-windows-runner-token --timeout=15m
kubectl -n gitlab logs job/gitlab-windows-runner-token
# -> minted a glrt- runner token into gitlab-windows-runner-token
```

This is the same in-cluster approach as the Linux runner: `gitlab-rails runner` in the toolbox pod calls
GitLab's own `Ci::Runners::CreateRunnerService`. **No admin personal access token is minted**, and the
token is never printed. The runner record is created with tags `windows,zeta-windows` and *run untagged:
off*. It is idempotent — re-applying, or re-running after `kubectl -n gitlab delete job
gitlab-windows-runner-token`, reuses the existing record and never overwrites a token already present.

Check without printing the token:

```bash
kubectl -n gitlab get secret gitlab-windows-runner-token -o jsonpath='{.data.runner-token}' | wc -c   # > 0
```

If the Job fails it exits 1 and prints the manual step. The `kubectl exec` recipe that does by hand exactly
what the Job does:

```bash
kubectl -n gitlab exec deploy/gitlab-toolbox -c toolbox -- gitlab-rails runner "
root = User.find_by_username('root')
r = Ci::Runners::CreateRunnerService.new(user: root, params: { runner_type: 'instance_type', description: 'zeta-windows', tag_list: %w[windows zeta-windows], run_untagged: false }).execute
raise(r.message.to_s) unless r.success?
print r.payload[:runner].token
" | tail -n1 > /tmp/win-token      # a glrt- string; delete the file afterwards
kubectl -n gitlab patch secret gitlab-windows-runner-token --type merge \
  -p "{\"stringData\":{\"runner-token\":\"$(cat /tmp/win-token)\"}}" && shred -u /tmp/win-token
```

(Or Admin > CI/CD > Runners > New instance runner, tags `windows,zeta-windows`, *Run untagged jobs* unticked;
paste the `glrt-` token into the same Secret key.)

**Mint the token BEFORE starting the VM.** KubeVirt builds Secret and ConfigMap disks when the VM starts;
a token minted later needs a VM restart.

### 2. Render the unattended-install Secret

Before this, **read `full-ai-cluster/k8s/examples/windows-runner-unattend/Autounattend.xml`** and edit what
is specific to your ISO (its header says which):

- `<Value>2</Value>` under `/IMAGE/INDEX` — the edition inside the ISO. On the Server evaluation ISOs index 2
  is commonly *Standard Evaluation (Desktop Experience)* and 1 the Server Core variant. **Verify** on your
  ISO (`dism /Get-WimInfo /WimFile:<drive>:\sources\install.wim` from any Windows).
- the virtio driver folder: `2k22` is Server 2022; Server 2025 is `2k25`, Windows 11 `w11`.
- `<AcceptEula>true</AcceptEula>` is **your** acceptance of the Windows licence terms. Do not apply the
  Secret until you have read and accepted them.

The Administrator password is not in git: the file carries `@ADMIN_PASSWORD@` and a small script fills it
into a Secret. Choose a strong password (12+ characters, three of lower / upper / digit / symbol), keep it in
your password manager, and keep it out of your shell history:

```bash
read -rs WINDOWS_ADMIN_PASSWORD && export WINDOWS_ADMIN_PASSWORD
bun src/Core.TypeScript/cluster/windows-runner-unattend-secret.ts | kubectl apply -f -
unset WINDOWS_ADMIN_PASSWORD
```

The script refuses a weak password, a password on argv, and a template without the placeholder exactly
once. The runner does not need this password (its startup task runs as SYSTEM); it exists for the unattended
install and for your RDP/console login.

### 3. Give the cluster the ISO

Edit the `windows-runner-iso` DataVolume's `source` in `kubevirt-windows-gitlab-runner.yaml`. Two ways:

**A. An HTTP URL you host** (a LAN box, an object store — anything the cluster can reach):

```bash
# on a machine that holds the ISO you downloaded:
cd ~/iso && python3 -m http.server 8080
```

```yaml
  source:
    http: { url: "http://<that-machine>:8080/<the-iso-file>" }
```

**B. `virtctl image-upload` through the CDI upload proxy** (no web server; the file goes straight into the
PVC). Set the source to an upload, apply the file (step 4), then:

```yaml
  source:
    upload: {}
```

```bash
kubectl -n cdi port-forward svc/cdi-uploadproxy 18443:443 &       # keep this running during the upload
virtctl image-upload dv windows-runner-iso -n gitlab --no-create \
  --image-path ./<the-iso-file> \
  --uploadproxy-url https://127.0.0.1:18443 --insecure --wait-secs 1800
```

`--no-create` uploads into the DataVolume the manifest already declares (the right size, class and the
`bind.immediate` annotation) instead of letting `virtctl` create a second one. `--insecure` is the
upload proxy's self-signed certificate on a port-forward to localhost; do not use it across a network.

### 4. Apply the guest (it stays Halted)

```bash
kubectl apply -f full-ai-cluster/k8s/examples/kubevirt-windows-gitlab-runner.yaml
kubectl -n gitlab get datavolume windows-runner-iso -w     # until phase Succeeded (or UploadReady for B)
```

Applying the file **untouched** starts nothing: the VM is `runStrategy: Halted` and the ISO URL is an
RFC 2606 `.invalid` name, so the import fails loudly rather than booting something unintended. The ISO
DataVolume carries `storage.bind.immediate.requested`, so the import proceeds while the VM is still halted.

### 5. Start it

```bash
virtctl start windows-runner -n gitlab
virtctl vnc windows-runner -n gitlab          # watch it; RDP later via the windows-runner-rdp Service
```

The install is unattended and takes a while. **Do not press a key in the console** when the installer
reboots into the installed disk: the ISO's "press any key to boot from CD" prompt must time out, or the
install restarts. When the desktop/login appears, the startup task runs `bootstrap.ps1`. When the runner is
online, set `runStrategy: Always` so a node reboot brings the guest back (see the expiry caveat in
[Limits](#limits-of-evaluation-media-read-before-you-rely-on-it)); optionally swap the two `bootOrder`s or
remove the `iso` disk.

### 6. Verify

1. **Admin > CI/CD > Runners** (GitLab UI, as `root`): `zeta-windows` is listed, **Online**, with tags
   `windows`, `zeta-windows`, and *Run untagged jobs* off.
2. Run a pipeline whose job asks for it:

   ```yaml
   windows-smoke:
     tags: [windows]
     script:
       - $PSVersionTable.PSVersion
       - Get-ComputerInfo | Select-Object OsName, OsVersion
       - git --version   # job checkout needs Git for Windows in the image
   ```

   and, to confirm the contract, a job with **no** `tags:` — it must run on the Linux runner and never on
   Windows.

Both are the verification. Until they pass, treat the path as unproven on your hardware.

## What the guest does

```
CD-ROM  ISO         <- DataVolume windows-runner-iso (YOUR evaluation ISO)                 first boot device
disk    root        <- DataVolume windows-runner-root (blank; the installer partitions it)
CD-ROM  sysprep     <- Secret windows-runner-unattend (Autounattend.xml, Unattend.xml)      holds the password
CD-ROM  ZETABOOT    <- ConfigMap windows-runner-bootstrap (settings.json, bootstrap.ps1, eval-watch.ps1)   NOT a secret
CD-ROM  ZETATOKEN   <- Secret    gitlab-windows-runner-token (file: runner-token)           the credential
CD-ROM  virtio-win  <- quay.io/kubevirt/virtio-container-disk:<operator release>           drivers
CD-ROM  (config drive) <- cloudInitConfigDrive.userData     (cloudbase-init script)         prepared-image mode only
```

1. **Install** (evaluation path): Setup reads `Autounattend.xml`, loads `viostor`/`NetKVM` from the
   virtio-win CD in WinPE, partitions GPT/UEFI, applies the chosen edition without a product key, and in the
   `specialize` pass copies `bootstrap.ps1` to `C:\ProgramData\zeta\` and schedules it at every startup
   (the network is not up that early, so nothing is downloaded there).
2. **`bootstrap.ps1`** (idempotent, safe on every boot; log `C:\ProgramData\zeta\runner-bootstrap.log`):
   finds the two labelled CD-ROMs (retrying ~5 min); registers the evaluation watchdog; stops if
   `C:\GitLab-Runner\config.toml` already holds a `glrt-` token; reads `runner-token` and refuses anything
   that is not a `glrt-` authentication token; installs the virtio guest tools if the guest has no network
   adapter; downloads `gitlab-runner.exe` from GitLab's release bucket (pinned version **and** sha256,
   retried, refused on a hash mismatch); `gitlab-runner register --non-interactive --token <glrt-> --executor
   shell --shell powershell --url <gitlabUrl> --clone-url <gitlabUrl>`; sets `concurrent`; installs the
   Windows service (automatic start) and starts it; removes its own startup task.
3. **`eval-watch.ps1`** (daily, 03:00, SYSTEM): appends the evaluation clock to
   `C:\ProgramData\zeta\eval-watch.log` and writes a **Warning** to the Application event log (source
   `zeta-eval-watch`, id 4101) inside 14 days of expiry. It **reports and never acts**: no rearm, no
   licensing call, no shutdown.

The token never appears in the VM spec, a ConfigMap, the script, or a log. Tags and *run untagged* live on
the runner record (set when the token was minted), not on that command line — GitLab refuses them next to a
`glrt-` token.

## Limits of evaluation media (read before you rely on it)

This is a trial, and it behaves like one. State of knowledge: these are Microsoft's published behaviours as
I know them, **not re-verified against the current Evaluation Center text** — read that text, it governs.

- **It expires.** Windows Server 2022/2025 Evaluation runs about 180 days from first boot; Windows 11
  Enterprise Evaluation about 90. `eval-watch.log` and `slmgr /xpr` (in the guest) tell you the date.
- **After expiry the guest shuts itself down.** Microsoft describes a lapsed Server evaluation as shutting
  down automatically about every hour; a lapsed client evaluation as warning and restarting periodically.
  For CI that is a runner that vanishes mid-job: GitLab marks the job failed and the runner offline. With
  `runStrategy: Always`, KubeVirt restarts the VM after each shutdown, so it flaps hourly. Plan the
  replacement *before* the date, and set `Halted` rather than let it flap.
- **`slmgr /rearm` resets the evaluation clock a finite number of times.** The count is per edition and
  release and the guest tells you: `slmgr /dlv` shows "Remaining Windows rearm count". I have not verified
  the number for current releases. Whether repeatedly rearming an evaluation is within Microsoft's evaluation
  terms is for you to read and decide; **the watchdog deliberately never rearms**, so that decision is
  never made by a script.
- **Evaluation-only terms.** Microsoft's evaluation licence is for evaluating the product, not for
  production use past the trial. CI for a product you ship, for money, or for work that outlives the trial
  needs **a licence you hold**: a purchased Windows Server licence, or a licence or subscription your
  organisation already has that includes the media. Microsoft documents converting a Server evaluation to a
  licensed edition in place with a valid key; check its current procedure rather than trusting this line.
- **The PC's OEM licence cannot be moved into a VM.** An OEM Windows licence is bound to the machine it
  shipped on; a VM on a cluster node is a different machine. (This is not legal advice; Microsoft's licence
  terms for your edition decide.)

### What happens to the runner across reboots, rearms and expiry shutdowns

**The runner keeps the same `glrt-` token and the same runner record.** Its identity lives in
`C:\GitLab-Runner\config.toml` on the guest disk and the Windows service starts automatically, so a reboot,
a `slmgr /rearm` (which does not touch either) or the forced restart of a lapsed evaluation brings the same
runner back online with no registration. `bootstrap.ps1` skips registration whenever `config.toml` already
holds a `glrt-` token; that is what stops a reboot from registering again. If you **rebuild the disk**
(a fresh evaluation install), the same Secret token registers a new *manager* under the **same** runner
record (GitLab 16+), so no second record appears and the tags / run-untagged contract is unchanged. Do not
re-mint the token to "fix" a runner: that creates a new record. (Delete the old record in Admin > CI/CD >
Runners when you replace the guest for good.)

### When it is about to expire

1. Watch `eval-watch.log` / the event log, or `slmgr /xpr` in the guest.
2. Decide, under Microsoft's terms: convert to a licensed edition; rebuild from a fresh evaluation ISO (the
   same token reconnects, see above); or retire the Windows runner.
3. Do not leave `runStrategy: Always` on an expired evaluation.

## Prepared image (the second mode)

If you have a licensed image (or want to build one by hand from any ISO), skip the unattended install: set
the **root** DataVolume's `source` to `http:` / `pvc:` / `registry:` instead of `blank: {}`, and delete the
`iso` disk, the `iso` volume and the `windows-runner-iso` DataVolume. The image must already contain:

1. **virtio drivers.** The root disk is `virtio` and the NIC `virtio` from the first boot. An image without
   `viostor` (disk) and `NetKVM` (network) will not see its disk or have a network. Install them from the
   **virtio-win** CD-ROM that rides along on every boot (pinned to the same release as the vendored KubeVirt
   operator): in Windows Setup choose *Load driver* → the virtio CD → `viostor`, `NetKVM`; on an installed
   system run `virtio-win-gt-x64.msi` from it. If you must install first, flip `bus: virtio` → `bus: sata`
   and `model: virtio` → `e1000e` for the install, install the drivers, flip back (Windows will not boot a
   disk whose bus changed under it without the driver).
2. **One of two first-boot mechanisms** (both are wired; the one the image lacks is ignored):
   - **A. cloudbase-init** (<https://cloudbase.it/cloudbase-init/>) with its default config-drive metadata
     service. It runs the inline `userData` (`#ps1_sysnative` header) which finds `ZETABOOT` and runs
     `bootstrap.ps1`. Bake it in: install cloudbase-init, leave the Config Drive service enabled, run its
     *Sysprep* option at the end of the installer, shut down, and that disk is the image.
   - **B. A generalized image** (`sysprep /generalize /oobe /shutdown`). Windows Setup then reads the
     `Unattend.xml` key of Secret `windows-runner-unattend` from the `sysprep` CD-ROM. It runs in the
     `specialize` pass as SYSTEM with no password; because the network is not up that early it only copies
     `bootstrap.ps1` to `C:\ProgramData\zeta\` and schedules it at every startup (task
     `zeta-runner-bootstrap`).
3. **Outbound HTTPS** from the guest to the runner download bucket. For an air-gapped install point
   `runnerExeUrl` in `settings.json` at an internal mirror of the same file; the sha256 does not change.
4. **Whatever your jobs need** (Git for Windows, compilers, ...). The runner executes jobs with PowerShell on
   the guest itself; there is no per-job container.

The Secret still has to exist for the mount (path B needs its `Unattend.xml`; for path A the content is
unused): render it as in step 2, with any strong password.

## Networking

Pod network, `masquerade`. The guest reaches GitLab over the **same in-cluster Service the Linux runner
uses** (`gitlab-webservice-default`, Workhorse `:8181`), by its fully qualified name
`http://gitlab-webservice-default.gitlab.svc.cluster.local:8181`, because a Windows resolver does not walk a
DHCP search list the way a pod does. DNS reaches the guest through KubeVirt's DHCP, from the launcher pod's
resolver. Alternatives, each only a `gitlabUrl` edit in `settings.json` (edit the ConfigMap **before** the
first boot):

| Use when | `gitlabUrl` |
|---|---|
| default | `http://gitlab-webservice-default.gitlab.svc.cluster.local:8181` |
| guest DNS cannot resolve cluster names | the Service's ClusterIP: `kubectl -n gitlab get svc gitlab-webservice-default -o jsonpath='{.spec.clusterIP}'` → `http://<ip>:8181` |
| the VM is moved off the pod network / LAN | the pinned LAN gateway address `http://<last LB-pool address>/` (`global.zeta.lanAddress`; the `gitlab-lan` Gateway routes `/` to the same webservice) |

`--clone-url` is set to the same value so job checkouts stay in-cluster, as for the Linux runner.
No inbound port is needed for the runner (it polls GitLab). RDP is a `ClusterIP` Service for debugging only;
put a firewall in front before making it a `LoadBalancer` — 3389 is the most-scanned port there is.

## Storage and capacity

| | |
|---|---|
| Windows disk | 64Gi DataVolume `windows-runner-root`, `ReadWriteOnce` |
| Installer ISO | 10Gi DataVolume `windows-runner-iso`, same class; read once, importer cleaned up after |
| Default class | `zeta-block-local` — one copy, pinned to the node holding it. A runner disk is rebuildable from the media, so triplicating it buys durability nobody needs here |
| Replicated alternative | `zeta-block-replicated` (Longhorn, 3-way): **64Gi × 3 = 192Gi of the pool**, survives losing that node's disk, may live-migrate. Change the one `storageClassName`. Check the pool first: `kubectl -n longhorn-system get nodes.longhorn.io -o wide` (allocatable vs scheduled) |
| Memory / CPU | request 8Gi memory (== limit) + KubeVirt's per-VM overhead; 4 vCPU request, no CPU limit. On a single-node install this is the heaviest optional thing you can add next to GitLab (~6Gi of requests) |

**Not counted in the cluster's storage ledgers or the single-node budget, deliberately** (the same placement
and reason as `kubevirt-windows-vm.yaml`): the ledgers price what a sync provisions on every install, and the
capacity preflight checks it against real disks. An opt-in guest must not be priced as if every install ran
it. The arithmetic above is the operator's, and the test pins that the claims name a storage *capability*
(never a provider class), are `ReadWriteOnce`, and are sized.

## Gating: why a fresh install never crash-loops over this

- Neither manifest is under `k8s/applications/`; nothing syncs them.
- The VM is `runStrategy: Halted`. The ISO URL is a sentinel that cannot resolve.
- The Administrator password is rendered by you into a Secret; nothing is committed.
- The bootstrap exits non-zero with a plain message when the token or a volume is missing, rather than
  registering something half-configured; a Windows service is only installed after `register` succeeded.
- The token Job fails loudly (exit 1) when run by hand and never wedges an ArgoCD sync — it is not in one.

## Add ANY extra runner (no reflash)

The pattern is the same for every runner: **a runner record in GitLab + its `glrt-` token in a Secret + a
runner process that reads that Secret**. The record carries the tags and *run untagged*; the process is
config in git.

### A second Linux runner (bigger, privileged, GPU, group-scoped)

1. **The record and token** — either reuse the Job in this runbook (copy
   `gitlab-windows-runner-token.yaml`; it is generic) or use the UI/API.
   Edit only the env block and the Secret name:

   ```yaml
   - { name: TARGET_SECRET,       value: gitlab-big-linux-runner-token }
   - { name: RUNNER_DESCRIPTION,  value: zeta-big-linux }
   - { name: RUNNER_TAGS,         value: "linux-big,privileged" }   # never overlap an existing runner's tags
   - { name: RUN_UNTAGGED,        value: "false" }                  # keep exactly ONE runner taking untagged jobs
   ```

   Rename the ServiceAccount / Role / Job / Secret too (the Role names the Secret). UI route: Admin > CI/CD >
   Runners > New instance runner. **Group-scoped:** Group > Build > Runners > New group runner. **API:**
   `POST /api/v4/user/runners` with `runner_type=group_type`, `group_id=<id>`, `tag_list=...`,
   `run_untagged=false`, header `PRIVATE-TOKEN: <PAT with create_runner scope>`; the response's `token` is
   the `glrt-` value. If you create a PAT for that, make it short-lived and revoke it afterwards. (The Job
   in this repo exists precisely so no PAT is needed; it only creates *instance* runners — group scope is UI
   or API.)
2. **The process, in git.** Add a second release of the upstream `gitlab-runner` chart
   (`https://charts.gitlab.io`, chart `gitlab-runner`; pin the version the GitLab chart bundles —
   `helm show chart gitlab/gitlab --version <pin>` lists it) as its own `Application` under
   `full-ai-cluster/k8s/applications/<name>/`, with:

   ```yaml
   gitlabUrl: http://gitlab-webservice-default.gitlab.svc:8181
   runners:
     secret: gitlab-big-linux-runner-token   # chart reads key `runner-token`
     privileged: true                        # only if the jobs need it (docker-in-docker): it is root on the node
   unregisterRunners: false
   concurrent: 2
   resources: { requests: { cpu: 50m, memory: 64Mi } }
   ```

   Because it enters `k8s/applications/`, it also enters the cluster's budget ledgers (single-node budget,
   storage claims, image resolvability, registry-mirror coverage): CI tells you which rows it needs — that is
   the same discipline as every other Application, and it is why the Windows guest (whose 64Gi would be
   priced as always-on demand) is **not** done this way. The GitLab umbrella chart installs exactly one
   runner, which is why a second one is its own Application rather than more values on `gitlab`.
3. ArgoCD applies it; the cluster tracks `main`; nothing is reflashed.

### A second Windows runner

Apply the token file with a different `TARGET_SECRET` / `RUNNER_DESCRIPTION`, copy the VM file with a new
name prefix, and point its `runner-token` volume at the new Secret. Do not share one token between two
guests: GitLab treats them as one runner.

## Troubleshooting

| Symptom | Look at |
|---|---|
| Job exits 1 | `kubectl -n gitlab logs job/gitlab-windows-runner-token` — it prints the manual step |
| ISO DataVolume stuck / failed | the importer pod: `kubectl -n gitlab get pods`, `logs` of the `importer-*` pod; the URL is still the `.invalid` sentinel, or the cluster cannot reach your HTTP host |
| upload fails | the port-forward to `cdi-uploadproxy` is not running, or the DataVolume is not `UploadReady` yet |
| VM `Pending` | `devices.kubevirt.io/kvm` not allocatable: no hardware virtualisation on any node |
| Installer shows a disk-selection screen with no disks | `viostor` not loaded: the driver folder in `Autounattend.xml` (`2k22`/`2k25`/`w11`) does not match the virtio-win CD; load the driver by hand once and fix the file |
| Installer stops at an edition list or the EULA | `/IMAGE/INDEX` or `AcceptEula` in `Autounattend.xml` |
| Installer restarts | a key was pressed at "press any key to boot from CD" |
| Installed, no runner appears | in the guest (VNC/RDP): `C:\ProgramData\zeta\runner-bootstrap.log` |
| `no volume labelled ZETABOOT` | the specialize-pass command could not enumerate the volume, or CD-ROM drivers are missing; run `bootstrap.ps1` by hand from the `ZETABOOT` drive |
| `no runner-token on the ZETATOKEN volume` | the Secret was empty at VM start: mint it (step 1) and `virtctl restart windows-runner -n gitlab` |
| no network in the guest | `NetKVM` missing; the bootstrap tries the virtio guest tools MSI; otherwise install it from the virtio-win CD by hand |
| download fails / sha256 mismatch | guest egress; or `runnerExeUrl`/`runnerExeSha256` in `settings.json` disagree (the sha256 is read from the vendor's `release.sha256` for that exact version) |
| runner registers, jobs never start | the job lacks `tags: [windows]`; or the guest cannot resolve/reach `gitlabUrl` (try the ClusterIP form) |
| runner offline after a node reboot | `runStrategy` is still `Halted`; set `Always` |
| runner offline roughly every hour, months in | the evaluation has lapsed; see [Limits](#limits-of-evaluation-media-read-before-you-rely-on-it) |

## What is proven, and what is unproven

### Proven (offline, in this repository's tests)

`src/Core.TypeScript/cluster/gitlab-windows-runner.test.ts`, run in the cluster plan job on every change to
these files:

- The Windows and Linux runner records have **disjoint tags**, exactly one takes untagged jobs and it is the
  Linux one — read from both sources, not restated.
- The token Job's **script is executed** against a stub `kubectl`: what it sends to Rails (tags, run-untagged,
  description), that it writes exactly one Secret key and never prints the token, that it is idempotent,
  retries, **fails loud**, and refuses Ruby-injection through its env knobs.
- The Job's authority: it can patch one named Secret and cannot create Secrets; the pre-created Secret has no
  data key, so re-applying cannot blank a live token.
- The guest spec's internal consistency: every disk has a volume and vice versa, every referenced object
  exists, the volume labels the guest looks for are the ones the volumes carry in every place that names them,
  the virtio CD is pinned to the vendored KubeVirt release, storage names a capability, the VM is Halted and
  the image is a sentinel, nothing is under `k8s/applications/`, and the bootstrap's registration is the
  authentication-token flow with the runner binary verified by sha256 before it can run.
- The evaluation path's **structure**: both answer files are well-formed XML; the install carries no product
  key, an edition index and the EULA value, GPT/UEFI partitions and virtio disk + network driver paths; the
  password placeholder appears exactly once and no password is committed; the Secret renderer fills it once,
  escapes it, refuses weak passwords / argv passwords / a template without the placeholder, and its CLI
  refuses without printing a Secret; the watchdog reports and contains no rearm, licensing call or shutdown;
  and registration is skipped when the guest already holds a `glrt-` token (the same-runner-across-reboots
  guarantee).
- The doc links Microsoft only at the Evaluation Center landing page: no ISO or download URL.

### Proven (live, in CI — the `live-kind-virt` job of `k8s-argocd-health-test.yml`)

`kubevirt-vm-live-test.ts` runs a **server-side dry-run** of both new manifests (and the existing template)
against a kind cluster with KubeVirt and CDI installed, so KubeVirt's and CDI's own admission webhooks judge
the VM, DataVolumes, and the Secret/ConfigMap/sysprep volumes and their `volumeLabel`s. That proves the spec
is **valid**. It does not prove a guest boots. (The same lane boots a cirros VM under emulation, so the
KubeVirt/CDI machinery itself is proven to run.) The Linux runner's token flow is proven live by
`gitlab-live-proof.yml`; the Windows token Job reuses that exact call with different tags and
run-untagged.

### UNPROVEN — stated plainly

- **No Windows image exists in CI**, so a Windows guest booting from this spec, `viostor`/`NetKVM` working,
  the unattended install running against a real evaluation ISO (edition index, partition layout, driver paths
  in WinPE, EULA and OOBE screens all skipping), the specialize-pass command finding the labelled CD-ROMs,
  `Get-Volume` seeing them in time, and `bootstrap.ps1` running to the end have **never been run**.
- The virtio-win driver CD's folder layout (`viostor\2k22\amd64`, `NetKVM\2k22\amd64`) and that the
  virtio-win MSI installs the network driver silently: written from the documented layout, not executed.
- Whether Windows reads an ISO 9660 CD-ROM carrying KubeVirt's `volumeLabel` the way this expects. The
  schema is validated; the guest-side behaviour is not.
- That the `GracePeriodRemaining` / `LicenseStatus` fields the watchdog reads behave as expected on
  evaluation editions, and the exact expiry-shutdown and rearm behaviour of current Microsoft releases (see
  [Limits](#limits-of-evaluation-media-read-before-you-rely-on-it)).
- That a Windows guest resolves `*.svc.cluster.local` through the DHCP-provided resolver. The ClusterIP form
  of `gitlabUrl` avoids the question.
- That the Rails call accepts these params on GitLab 17.7: the Linux Job proves the `instance_type` path
  live; here only the tags and run-untagged differ.
- Performance, licensing, and Windows-specific job behaviour. A runner with `executor = shell` runs jobs
  directly on the guest with whatever is installed there.

### How you verify, in order

1. `kubectl -n gitlab logs job/gitlab-windows-runner-token` ends with *minted a glrt- runner token*.
2. `kubectl -n gitlab get datavolume windows-runner-iso` is `Succeeded` (`windows-runner-root` exists).
3. `virtctl vnc windows-runner -n gitlab` shows the unattended install finishing and the guest booting;
   `C:\ProgramData\zeta\runner-bootstrap.log` ends with *gitlab-runner registered and started*.
4. **GitLab Admin > CI/CD > Runners shows `zeta-windows` online**, tags `windows`, `zeta-windows`.
5. A pipeline job with `tags: [windows]` runs and passes, and a job without `tags:` still runs on Linux.
6. `C:\ProgramData\zeta\eval-watch.log` has a line (on the next 03:00, or run the script once by hand).

## Uninstall

```bash
kubectl delete -f full-ai-cluster/k8s/examples/kubevirt-windows-gitlab-runner.yaml   # VM, disks, ConfigMap, Service
kubectl -n gitlab delete secret windows-runner-unattend                              # holds the Administrator password
kubectl delete -f full-ai-cluster/k8s/examples/gitlab-windows-runner-token.yaml     # Job, RBAC, token Secret
```

then delete the `zeta-windows` runner in Admin > CI/CD > Runners (the record outlives the token Secret).
