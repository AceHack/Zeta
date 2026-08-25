# One pipeline, end to end — where it actually stops

**Trace, 2026-08-21.** Aaron: *"we need to move forward the k8s stuff — that's the purpose of our usb
hardware setup."* So this treats **CI → ISO → USB → boot → k3s → ArgoCD → cluster** as one chain and
finds where it breaks. **Nothing applied to a cluster; no device touched.**

## RE-MEASURED 2026-08-25, before the first real burn (081M0WS33AK087G0R000BG9R8X)

**Three of this report's findings were closed between 08-21 and 08-25 and one was not.** A report
that keeps asserting a fixed defect is a false claim of the same class it exists to catch, so the
status is recorded here rather than left to the reader to re-derive. Nothing below edits the
findings themselves; they were all correct on the day.

| finding | status 2026-08-25 | evidence |
|---|---|---|
| **R2** the Ctrl-C window is zero-width | **FIXED, then extended** | `zeta-install.sh` Step 2.9 is a real wall-clock countdown (60 s; 10 s only when every in-scope disk probes blank), any keypress aborts, and a cancel now exits **10** instead of 0 so `zeta-first-boot.sh` stops reporting an abort as a finished install. **What was still open on 08-25:** the countdown's *default* was PROCEED even over a disk full of somebody's data, so the unattended path destroyed a second disk 60 seconds later rather than not at all. `foreign-data` / `indeterminate` now flip the default to ABORT. |
| **R3** nothing has ever applied the roster | **FIXED** | `nixos/tests/k3s-first-boot-roster.nix` applies all 11 with no `mkForce` (manual/nightly, needs internet + KVM); `k3s-first-boot-apply-order-eval-test.nix` is the eval-only half wired into `nix flake check` on every PR. |
| **R5** `no blockers` against an unsigned 2048 GiB aspiration | **FIXED** | `single-node-readiness.ts` now runs a `capacity-provenance` check against MEASURED hardware in `maintainers/*/cluster-nodes/*/node.yaml` and **refuses** when no registration carries a measurable `spec.hardware.storage`; `nodeDiskGib` is labelled ASPIRATIONAL in the output. Measured on 08-25: `node-ad1efd 1047 GiB`, declared 967 GiB, **fits**. |
| **fw_cfg does not exist on metal** | **STILL OPEN as a claim; now stated** | `zeta-creds-restore.nix` still stages the passphrase from QEMU `fw_cfg` and still falls back to `systemd-ask-password` on tty1 on hardware. That mechanism is unchanged and this is not a metal proof. What changed is that the run now **names its transport on the success line** (`transport=qemu-fw_cfg metal-capable=no`) and the harness **refuses a restore that does not**, so a green CI restore can no longer be quoted as metal evidence. |

**One fail-open found on 08-25 and deliberately not closed:** Step 1's internal-disk filter is
`$5 != "usb"`, i.e. *not known to be USB* rather than *known to be internal*. A device with an empty
TRAN column yields a 4-field row and is admitted. `/dev/vda` is exactly that case, so tightening it
would red the entire QEMU lane; it is documented in the bringup runbook (item 6) with the physical
mitigation, which is to unplug external drives before first boot.

## Stage verdicts

| # | Stage | Verdict |
|---|---|---|
| 1 | CI builds ISO | **PROVEN** — both jobs green, ISO built + cosign-signed |
| 1b | ISO → USB | **BROKEN** — gate refuses; CI published no digest *(fixed in #13053 for x86; aarch64 still emits nothing)* |
| 2 | USB → booted node → installed OS | **PROVEN in emulation, UNPROVEN on metal** |
| 3 | k3s → first-boot roster | **UNPROVEN — nothing has ever applied it** |
| 4 | ArgoCD → app-of-apps | **BROKEN on available measurements** — 12 of 35 not Healthy |
| 5 | Storage | **BROKEN by arithmetic** — 1499 GiB declared against a 931.5 GiB disk |

## R3 — nothing has ever applied the first-boot roster. Not once.

Eleven manifests are declared. **Every VM test overrides that attribute** — verified directly:

```
k3s-cluster-init.nix:63              services.k3s.manifests = lib.mkForce { };   <- EMPTY
k3s-agent-join.nix:60                services.k3s.manifests = lib.mkForce { };   <- EMPTY
k3s-control-plane-platform-fixes:49  services.k3s.manifests = lib.mkForce { };   <- EMPTY
k3s-cluster-online.nix:49            reduced (cilium only)
longhorn-volume-binds.nix:71         reduced (cilium + longhorn)
```

**So the declared boot sequence has no test, and the ISO lane's five green nixosTests do not cover it.**

### And the ordering claim in the file is wrong on its own mechanism

The comment says alphabetical order suffices and *"ArgoCD comes LAST."* NixOS writes each entry as
`<name>.yaml`, so the real order begins:

```
aa-gateway-api-crds · argocd-install · argocd-namespace · cert-manager-install · …
```

**ArgoCD is second, not last.** Each `*-install` precedes its own `*-namespace`. And
`root-application.yaml` — an `argoproj.io/v1alpha1 Application` — is applied **before the ArgoCD Helm
chart has created the `Application` CRD.**

> **Whether that self-heals is the single highest-value unknown in the whole chain.** helm-controller
> retries (which is what makes the install-before-namespace inversion survivable), but the k3s **deploy**
> controller's retry on an unknown-kind apply is unverified. If it does not retry, **the app-of-apps
> root never lands and the cluster stops dead at seven bootstrap charts with no catalog.**

**Post-Vault coherence is clean** — the bootstrap manifest is gone and only prose references remain
(one stale tree diagram in `full-ai-cluster/README.md:37`).

**One design fact worth stating:** `root-application.yaml` pins `targetRevision: main`. **The cluster's
catalog is whatever `main` says at reconcile time — not what was on the USB.** Flashing an ISO built at
a tag still gets you `main`'s applications.

## R2 — first boot wipes every internal disk, and the Ctrl-C window is zero-width

The path is fully unattended: `ZETA_AUTO_CONFIRM=WIPE`, `BOOT_DISK=auto`, then `wipefs -af` +
`sgdisk --zap-all` over **every fixed non-USB disk**. The only pre-wipe check is capacity.

The consent story in the script's own comment says the operator's window is *"the device-list display
zeta-install prints before wiping (Ctrl-C window)"* — **but there is no `sleep` between the print and
the wipe. The window is zero-width.**

Survivable on a single-NVMe mini-PC. **On any node with a second disk holding data, first boot destroys
it with no prompt.** This is the 2026-06-09 ask, still unbuilt.

## R5 — storage is decided by arithmetic before any pod runs

```
$ bun src/Core.TypeScript/cluster/single-node-readiness.ts
  longhorn             1499 GiB  (budget 2048 GiB)
  zeta-local-path        73 GiB  (unbudgeted)
no blockers.
```

**Aaron's box is `nvme0n1 931.5G`.** The catalogue asks for **~1.7× the disk that exists.**

> **The auditor prints "no blockers" because it compares against `nodeDiskGib: 2048` — an aspiration
> whose own `$comment` says "STATUS: awaiting maintainer sign-off". A gate comparing against an
> unsigned number is green against a figure nobody agreed to.**

The measured consequence is already on file from a kind run: `ReplicaSchedulingFailure 'insufficient
storage'`, volumes `faulted`, `cockroachdb-0/1/2` stuck in `Init:0/1`.

**Two honest options, and it is Aaron's call:** buy the 2 TB NVMe, or trim the declared PVCs to fit
931 GiB.

Phase-by-phase, storage classes available: **k3s first boot → `zeta-local-path` only**; after ArgoCD
wave -15 → `+ longhorn`; **never on the control-plane → the multi-disk catalog**, because
`longhorn-disks.nix` is imported only by the worker template. **The installer creates and formats a
`longhorn1` tail partition that longhorn will never be told about.**

Credit where due: longhorn 1.7.2 **is** proven to bind a PVC on one NixOS node —
`longhorn-volume-binds.nix`, green. That is the strongest storage evidence in the tree.

## R6 — what the app-of-apps actually does, measured from the live kind lane

**12 of 35 child Applications not Healthy**, including `spire` Missing, `vault` Degraded,
`kube-prometheus-stack` Degraded.

Two inherited assumptions this settles:

1. **Sync waves order CREATION, not READINESS.** `vault` is Degraded at wave -60 while apps at -15, -5,
   0 and 10 all exist and the root reports **Healthy**. So *"ArgoCD retries, so this converges rather
   than deadlocks"* is correct — but the ordering intent recorded in `k3s-server.nix` is **weaker than
   stated: nothing waits for cert-manager before SPIRE is created.**
2. **Vault's hard anti-affinity is now measured, not inferred** — and the proof is clean because it
   carries **no PVC**, so storage cannot confound it:

```
Warning FailedScheduling pod/vault-agent-injector-…
  0/1 nodes are available: 1 node(s) didn't match pod anti-affinity rules.
```

> **This contradicts `single-node-budget.json`**, which files vault under `acknowledgedFalseRedundancy`
> — a list defined as *"replicas > nodeCount WITHOUT hard anti-affinity … They come up green."* **Vault
> does not come up green; two pods stay Pending forever.** The classifier reads only the
> `Application.yaml`, where the chart-default affinity is invisible. **That row is mis-filed, and it is
> what tells a reader Vault is merely nominal-HA rather than non-schedulable.**

**And the CI lane is not evidence for hardware.** The dev catalog *deletes* longhorn, and 14
Applications are applied-and-asserted-by-nothing for that reason. **Every `storageclass "longhorn" not
found` in that log is an artifact of the harness, not a prediction about hardware.** On hardware
longhorn *is* installed — **R5's arithmetic decides them instead.**

## R1 — the flash gate, and three second-order findings

The gate is fixed for x86 in #13053. Still open:

- **The runbook will produce the refusal.** Its documented correction has the operator **rename** the
  artifact — and the check matches on **exact basename**, so a rename converts `manifest-missing` into
  `iso-not-in-manifest`. **The rename and the manifest must be reconciled, not just the manifest added.**
- **The gate is macOS-only.** `cli.ts` platform-selects the Linux arm, which carries no integrity gate.
  **A Linux operator today writes an unverified ISO with no refusal.**
- **The obvious workaround is vacuous:** `shasum -a 256 f.iso > f.iso.sha256` satisfies the gate by
  comparing the file **to a digest computed from that file** — the *"file compared to itself"* class this
  repo already names. **The honest path exists and the tool ignores it: CI publishes a cosign bundle
  nobody checks, and the tool demands a digest nobody publishes.** Note the irony one directory over —
  `multiboot/images.manifest` pins and verifies SHA-256 for every **third-party** image. **Our own ISO
  is the one image with no published digest.**

## R4 — six charts still dual-owned, and two disagree

Versions match on all six, so this is milder than Vault's storage-backend flip. **But values diverge on
the two most load-bearing:**

- **cilium** — the ArgoCD twin adds `l2announcements`, rate limits and hubble settings the bootstrap
  manifest lacks. **Two owners, `selfHeal: true`, same DaemonSet — on the CNI.**
- **argocd, self-managing at wave -90** — the twin's own comment claims it *"mirror[s] the bootstrap
  values so adopting this Application is a no-op"*, **and it does not.** Chart default for
  `dex.enabled` is `true`, so **the first thing ArgoCD does at the earliest wave is reconcile a
  dex-server into existence and rewrite its own deployments. That is the reconciler modifying itself
  mid-bootstrap.**

## The single cheapest experiment: boot one node once, and watch stage 3

Everything collapses to one question no amount of reading answers: **does the eleven-manifest roster
apply, in the order it lands, on a real node?** Stages 1, 2, 4 and 5 have partial evidence. **Stage 3
has none, and it sits between the proven half and the measured half.**

**Hardware Aaron already has:** one mini-PC (single 931.5 GB NVMe), the Comet KVM already attached, a
USB stick, the Mac. **Single NVMe means R2's unconditional wipe cannot destroy a second disk — which is
exactly why this node is the right one to burn.**

The one command that *is* the experiment, after the node is up:

```
kubectl -n kube-system get addon        # did root-application apply, or stick?
kubectl get storageclass                # longhorn never landed, vs landed-and-too-small
```

**The first distinguishes stage 3 proven from the highest-severity finding in this report.** The second
**distinguishes R5 from R3, which have completely different fixes.**

**Cost: one USB stick, one machine for an hour, zero CI minutes.** It converts stage 3 from unproven to
measured and turns R4/R5 from CI-lane inference into hardware fact — **the difference between a report
and a cluster.**

### Verification note (Otto, landing this)

Three load-bearing claims re-checked independently. **R3 confirmed:** all five nixosTests `mkForce` the
roster — three to `{}`, two reduced. **The ordering confirmed:** `aa-gateway-api-crds`,
`argocd-install`, `argocd-namespace`, `cert-manager-install` — **ArgoCD is second and precedes its own
namespace.** **R5 confirmed:** the tool prints `longhorn 1499 GiB (budget 2048 GiB) … no blockers`
against an inventory recording `nvme0n1 931.5G`.
