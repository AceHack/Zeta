# The Zeta Bootstrap USB — full design document

**Draft for Aaron's review · 2026-08-21 · author: Kenji (architect) · register: measured except where marked**

**How to read this.** §2 is the section to annotate — the requirements ledger, one row per thing you
asked for, with the date, your words, where they are recorded, and an honest status. **§5 and §7 are
the ones that need your answer specifically.** Everything else is context for those three.

**What was and was not done.** Files read, `git log` read, `git show` on unmerged commits. **No device
was touched. No secret, key, PIN or credential was read, printed or handled. `op` was not run.** The
readiness auditor could not be re-run in that worktree (`bun` reported `Cannot find package 'yaml'`),
so every storage number is **cited from the source that measured it**, and says so — *an empty run is
not a zero.*

## 1. What the USB is for

The framing is yours, 2026-05-25, and every decision below descends from it:

> *"We're basically trying to make the most AI-native kind of cloud agnostic production stack that's
> modern for like a complete Kubernetes stack, including observability and everything, and being able
> to just slap it on any hardware. We're just sticking in a USB and hitting power."*

And the mechanism, same conversation:

> *"You can imagine it's a Nix flake … and then basically we have Argo CD after that, and that's pretty
> much it … when you stick the USB in, it already knows the GitHub address and everything … it knows
> when it's already a clus— if it's not a cluster, it creates a new one, and if it's on a network with
> a cluster, it joins it."*

So the USB is **the cluster's bootstrap medium** — the one physical object that converts commodity
hardware into a member of a GitOps-reconciled cluster, with no operator knowledge required. Three
invariants follow:

1. **Generic** — *"it's completely generic. It's greedy, so it looks for like all the hardware and just
   assumes it owns it and formats it."*
2. **Headless** — 2026-06-09: *"this USB should fully boot headless."*
3. **Dual-mode** — provision *and* repair: *"the USB basically says, hey, am I already running on this?
   I am? Let me make sure I recover any hardware IDs and stuff and just reinstall the image."*

Target persona, recorded: *"if i'm targeting first time commandline users that's the persona i'm going
for so this can spread easliy to home clusters easlier than proxmox or any of that but prodicution
ready once 3 nodes"*.

### One correction to the record, up front

Last night's audit said *"proven-on-metal is an empty set."* **That is true of today's image and false
as history.** Four metal boots are on file:

| node | maintainer | registered | hardware |
|---|---|---|---|
| `node-ad1efd` | Addisons820 | 2026-06-09T09:09:17Z | Core Ultra 9 285H, 66G, `nvme0n1 931.5G` + `sda 115.5G` |
| `node-b1e1b5` | Addisons820 | 2026-06-09T09:58:02Z | same family |
| `node-f82aa6` | maximdolphin | 2026-06-14T17:10:55Z | Core Ultra 9 185H, 66G |
| `node-5b2dfa` | maximdolphin | 2026-06-14T22:20:16Z | same MAC — one machine or a copied manifest, held open as `HWR-2` |

**Addison flashed from a zflash-made stick, booted two Linux machines on her own GitHub credentials,
and both nodes self-registered by PR.** That happened.

> **The honest statement is narrower and sharper: nothing built after 2026-06-21 has ever run on
> metal.** The pipeline worked in June, then eight weeks of fixes and gates landed on top of it with
> QEMU as the only witness. That is **regression risk on an unexercised path** — worse than "never
> worked", because the June evidence makes the current path *feel* proven.

## 2. Requirements ledger

Four-valued on purpose, because "done" hides the middle: **PROVEN** (something that can fail has failed
for the right reason) · **BUILT-UNPROVEN** (tested hermetically, no metal evidence) · **PARTIAL** ·
**NOT BUILT** · **SUPERSEDED**.

### 2.1 The core bootstrap loop

| # | Date | The ask, verbatim | Status |
|---|---|---|---|
| R1 | 2026-05-25 | *"slap it on any hardware … sticking in a USB and hitting power"* | **BUILT-UNPROVEN** on the current image; **PROVEN** on the 2026-06 image |
| R2 | 2026-05-25 | *"completely generic … greedy … assumes it owns it and formats it"* | **PROVEN** — every fixed non-USB disk becomes BOOT or DATA |
| R3 | 2026-05-25 | *"if it's not a cluster, it creates a new one, and if it's on a network with a cluster, it joins it"* | **PARTIAL** — the join exists and is proven; the **auto-decide does not.** Role comes from a 10 s keystroke or an ISO file. mDNS bootstrap-or-join is **P3, open** |
| R4 | 2026-05-25 | *"am I already running on this? … recover any hardware IDs and just reinstall the image"* | **NOT BUILT.** No repair mode. Every "reformat" means re-flash from scratch. **The backlog id this was filed under is cited by eight rows and has no file anywhere in the tree** |
| R5 | 2026-05-25 | *"first time commandline users … prodicution ready once 3 nodes"* | **PARTIAL** — one non-author completed it supervised; 3-node HA never assembled |

### 2.2 The 2026-06-09 destructive-path asks — the highest-value rows here

| # | The ask, verbatim | Status today, measured |
|---|---|---|
| R6 | *"check if the partition exists every time before formatting; ask the questions BEFORE formatting … **do this now**"* | **NOT BUILT.** `wipefs -af` + `sgdisk --zap-all` over every in-scope disk; the only pre-wipe checks are set-membership and capacity. **Nothing probes for an existing ESP or creds blob. 74 days** |
| R7 | *"it should NOT ask before format — it should ask to CANCEL for a minute before format; this USB should fully boot headless."* | **NOT BUILT.** No countdown. `ZETA_AUTO_CONFIRM=WIPE` skips the typed prompt and the wipe follows immediately. **There is no `sleep` between the device list and the wipe — the Ctrl-C window is zero-width.** The script's own comment claims the consent *is* that window. **It describes a window that does not exist.** The one real countdown is `sleep 10` **after** install |
| R8 | *"remember creds by default after logging in, tied to the USB key AND a hardware key … AND the UEFI boot partition, every time"* | **PARTIAL, blocked on your decision.** Root cause found: the KDF binds to the **ephemeral FAT UUID**, so remembering breaks on any stick swap. The rebind is **modelled**, and both probes landed. **§5.2 is what unblocks it** |
| R9 | repair-loop **P0**: *"reformat-with-broken-remembered → infinite destructive loop, needs a circuit-breaker + validate-before-wipe"* | **NOT BUILT.** No bounded retry, no validation before wipe. **Filed P0, 74 days** |
| R10 | the `install-answers.json` producer — *"declared but has NO PRODUCER (the load-bearing self-heal gap)"* | **NOT BUILT.** Confirmed: the manifest declares it; nothing writes it. **A declared credential nothing produces — the same shape as an unread golden vector** |

### 2.3 Credential persistence and the boot sequence

| # | The ask, verbatim | Status |
|---|---|---|
| R11 | *"gh has throttled me for loggin in"* / *"this is the 3rd time i booted"* | the originating problem. **PARTIAL** — the throttle is only avoided if R8 holds, and R8 breaks on stick swap |
| R12 | *"key bound to uuid and operator passphrase seems best for an easy phase one"* | **BUILT-UNPROVEN** — scrypt → HKDF → AES-GCM |
| R13 | *"we should declare each credential we need and save and restore so it's not so imparative"* | **BUILT** — a declarative manifest, as asked. Caveat: see R10 |
| R14 | *"look at pc before formatting and try to recover credentials that already exist"* | **NOT BUILT** — R6's sibling, same fate |
| R15 | *"recover is the default … we just need an override escape hatch"* | **PARTIAL** — the picker exists; the recovery *source* does not |
| R16 | *"token at zflash time and human interactive at setup time"* | **PARTIAL** — flash-time ESP injection built; PAT-at-flash-time is not the default |
| R17 | *"allow command line override of any declared cred as token … easier for the ai to call"* | **NOT BUILT** as a general per-cred override |

### 2.4 The tooling shape

| # | The ask, verbatim | Status |
|---|---|---|
| R18 | *"this is terrible … we need to **combine these into one.** The whole point of Zeta is to **not have accidental OS complexity split in where there are common abstractions we can close over.**"* | **NOT BUILT.** Three arms still; the CLI does not even route Windows. **You upgraded this from tidiness to thesis violation, and it is 74 days old.** And it now has a cost it lacked then: **all four 2026-08 safety gates are macOS-only, so a Linux operator writes an unverified image with no refusal** |
| R19 | Windows Hello parity | **NOT BUILT.** macOS has Touch ID, Linux has an fprintd path, Windows has neither |
| R20 | *"testing the ISO does not test creating the USB"* | **PARTIAL** — 494 hermetic zflash tests; the QEMU harness still boots a **pre-built** ISO and never exercises `dd` + inject + boot-that-stick |
| R21 | *"move it into our common verbs/nouns"* | **PARTIAL** — the router exists; it and the CLI have **divergent argument surfaces**, already documented as a live footgun |
| R22 | *"give a choice of our boot and the chance to boot others too … use grub2 for the usb"* | **BUILT-UNPROVEN, and orphaned.** Planner, assembler, GRUB EFI embed and a verified manifest all landed — **but `zflash` does not write it.** Two USB models coexist on `main` and nothing chooses. §5.4 |

### 2.5 Trust, keys and provenance

| # | The ask | Status |
|---|---|---|
| R23 | *"can we put everything needed in the ISO, or does flash-usb still need to embed stuff based on the human who ran it?"* | **ANSWERED + BUILT.** Trust roots are public and bake in; flash-time carries only secrets + the per-USB binding |
| R24 | ISO signing | **BUILT-UNPROVEN.** x86_64 is cosign keyless-OIDC signed. **`cosign verify-blob` appears nowhere in executable code. We sign and never verify** |
| R25 | ISO integrity before write | **JUST BUILT, UNRUN.** #13053 added the `<iso>.sha256` sidecar. **aarch64 emits neither digest nor signature** |
| R26 | biometric consent as the irreducible gate | **PROVEN on macOS** — a live agent-driven flash on 2026-06-20 with Touch ID firing on the destructive `dd`. **The single best-evidenced safety property in the system** |

### 2.6 Recalled but not found

- **A named USB product name.** Mika asked twice; no answer recorded. It is still "the USB."
- **A 2 TB NVMe procurement row.** §5.1 turns on it, and the buy-list has **no storage section at all.**

### 2.7 Two bookkeeping defects found while building this ledger

1. **Two USB requirement rows are cited and do not exist.** One is referenced by at least eight files
   including a row reading *"Self-healing repair USB | Already in \<id\>"*. **Neither file is in the
   tree. "Already filed" was doing the work of "built" for a row that is not even filed.**
2. **At least one legacy citation resolves to the wrong row**, whose own frontmatter lists **itself**
   in `depends_on`. Migration artifacts from the `B-NNNN` → ZetaId cutover.

## 3. The pipeline, stage by stage

### Stage 0 — CI builds the ISO

**Proven:** builds on both arches; `makeUsbBootable`, `volumeID = "ZETA_INSTALL"`, isohybrid with a
FAT12 ESP; signing produces a bundle whose digest was independently checked to equal the ISO's.

**Assumed:** that the digest sidecar works — **unrun**. That aarch64 is equivalent — **it is not signed
and emits no manifest, so the Pi rung has no integrity story at all.**

**An honest weakness in the gate:** aarch64 `TIMEOUT` and `STALLED` are advisory; only `BOOT-FAILED`
blocks. The workflow states its own limit: *"This gate catches images that fail to boot, not images
that hang."* Right call given measured intermittency — **read it as a skip, not a pass.**

### Stage 1 — ISO to USB

**Proven on real hardware twice** — 2026-06-09 and 2026-06-20 (agent-driven, Touch ID fired, 1.54 GiB
written, pubkey injected, ejected, 1–2 min). The rails are genuinely good.

**Broken 2026-08-20, fixed for one arch 2026-08-21.** The integrity gate landed with no supply path,
and refused with `iso-not-in-manifest` because it found a `SHA256SUMS` **belonging to Bitcoin Knots.**
A bare well-known filename in a shared download directory is a namespace collision.

**Still open:** **R1 of the classifier cannot fire** — its digest fields are supplied only by the test
file, so a labelled stick with wrong bytes classifies as `provisioned`. **The first identity check is
vacuous by default** — it compares observed to itself and warns rather than refuses. **Only
`unrecognized` blocks**; `half-provisioned` prints and proceeds. **The obvious workaround is vacuous** —
`shasum > f.iso.sha256` compares a file to a digest from that file, **while CI publishes a cosign
bundle nobody checks.** And **`MIN_ISO_BYTES` is defined three times** despite a comment saying it is
centralised *"so they cannot drift apart."*

### Stage 2 — boot and install

**Proven in emulation** (scenarios 1–2 green across four consecutive runs) **and on metal in June.**

**The consent defect, precisely:** `ZETA_AUTO_CONFIRM=WIPE` → *"non-interactive mode; proceeding
without prompt"* → `wipefs -af` immediately. **No delay. On the zero-typing path the sole consent is a
10-second role keystroke minutes earlier that never mentions disks.**

**Check before you boot:** the registered nodes report `/dev/sda 115.5G` — **exactly 124.0 GB decimal,
the size of the PNY stick.** It is *probably* the boot USB, excluded correctly by the `TRAN` column.
**But if it is an internal SATA disk, first boot wipes it with no prompt.** One `lsblk -o NAME,TRAN,RM,SIZE`
answers it in two seconds.

### Stage 3 — k3s and the first-boot roster

**The stage with no evidence on either side, and the reason to boot a node.**

**Ten** manifests (not eleven — Vault was removed 2026-08-20). k3s applies them **alphabetically**:

```
aa-gateway-api-crds · argocd-install · argocd-namespace · cert-manager-install
cilium-install · cilium-namespace · external-secrets-install · root-application
spire-install · trust-manager-install
```

The comment says *"ArgoCD comes LAST."* **Every clause of that is wrong on its own mechanism:** ArgoCD
is **second and third**; each `*-install` **precedes its own `*-namespace`**; **the CNI is fifth**
(with `--flannel-backend=none`, nothing schedules until it runs); and **`root-application.yaml` is
eighth** — applied before the ArgoCD chart has created the `Application` CRD.

**Nothing has ever applied this roster** — all five nixosTests override it. What *is* proven is narrow:
**cilium-via-HelmChart-CR comes up on a bare k3s node with no CNI, and longhorn binds a PVC there.**
The other eight manifests have no test.

> **The highest-value unknown in the chain:** does k3s's deploy controller retry an apply of an unknown
> kind? helm-controller demonstrably does — that is what makes install-before-namespace survivable. If
> the deploy controller does not, **the app-of-apps root never lands and the cluster stops at seven
> charts with no catalog — a state that looks healthy from `systemctl is-active k3s`.**

### Stage 4 — ArgoCD and the app-of-apps

47 application directories; **10 track `targetRevision: main`**, and so does the root. Measured: **12 of
35 not Healthy.**

**Two things this settles:** sync waves order **creation, not readiness** — nothing waits for
cert-manager before SPIRE is created. And **Vault's hard anti-affinity is measured, not inferred**, and
cleanly, because the injector carries no PVC so storage cannot confound it. **This contradicts
`single-node-budget.json`**, which files Vault under *"come up green."* **It does not.**

**The CI lane is not evidence for hardware** — the dev catalog *deletes* longhorn, so every
`storageclass "longhorn" not found` there is a harness artifact.

**Six charts remain dual-owned.** Values diverge on the two most load-bearing: **cilium** (two
`selfHeal` owners on the CNI DaemonSet) and **argocd**, whose twin claims to *"mirror the bootstrap
values so adopting this Application is a no-op"* — **it does not**, so the first thing ArgoCD does at
wave −90 is reconcile a dex-server into existence and rewrite its own deployments.

### Stage 5 — storage

```
longhorn          1499 GiB   (budget 2048 GiB)
zeta-local-path     73 GiB   (unbudgeted)
no blockers.
```

**Your box is `nvme0n1 931.5G`** — the catalogue asks for **~1.7×** the disk that exists, and the gate
passes because it compares against a figure whose own comment says *"NOT a measurement of the box Aaron
has today"* and *"awaiting maintainer sign-off."*

> **A gate that is green against an unsigned number is not a gate.** The file is honest enough to say so
> itself.

**A second, independent defect:** `longhorn-disks.nix` is imported **only by the worker template**, so
the installer formats a `longhorn1` tail partition on the control-plane boot disk that **longhorn will
never be told about.** Dead space.

## 4. The design as it should be

### 4.1 One pipeline, one integrity chain, no arch asymmetry

```
CI builds ISO ─► cosign sign-blob ─► <iso>.sha256 sidecar ─► both uploaded
                        │
        zflash: fetch ISO + sidecar + bundle
                        │
              cosign verify-blob   (provenance)
                        │
              sidecar digest check (integrity)
                        │
     classify device ─► policy ─► re-read identity
                        │
              Touch ID / Hello / fprintd
                        │
                 dd ─► read-back verify
                        │
              ESP inject ─► eject
```

**Provenance must be checked, not merely produced.** Today we sign and do not verify, and the digest
workaround compares a file to itself. Both arches must emit both artifacts.

> **The irony worth naming:** `multiboot/images.manifest` pins and verifies SHA-256 for every
> **third-party** image. **Our own ISO is the one image with no published, verified digest.**

### 4.2 One flasher, three drivers

```
flash(iso, device) over a per-OS driver:
  detectPlatform() → { enumerate, rawWrite, injectESP, presenceGate }
    macOS   : diskutil | dd                 | mount + tee    | Touch ID
    Windows : Get-Disk | \\.\PhysicalDriveN | raw-FAT inject | Windows Hello
    Linux   : lsblk    | dd                 | mount + write  | fprintd / polkit
```

Anchor: Brooks, *No Silver Bullet* (1986) — the essential job is one; the OS differences are accidental.
**The enforcement must be a gate, not a person** — a structural test that fails CI when a new per-OS
*tool* appears where a new *driver* belongs.

### 4.3 The destructive path, as it should read

R6 and R7 are **not in tension** — the greedy default is what makes it headless, the cancel-window is
what makes it consensual:

```
enumerate fixed non-USB disks
   │
probe each: partition table · ZETA ESP · creds blob · foreign filesystems
   │
PRINT findings — "nvme0n1: Zeta ESP + creds, install dated 2026-06-09"
                 "sda:     ext4, label 'backup', 340 GiB used  ← NOT OURS"
   │
IF a prior Zeta install is found ──► REPAIR MODE (§4.4)
   │
COUNTDOWN 60s: "Formatting in 60s. Press any key to CANCEL."
   │  no keypress ──► proceed          (headless preserved)
   │  any key     ──► abort to a shell (real abort gate)
   │
wipe ─► partition ─► format ─► preserve creds ─► install ─► repersist
```

Three properties the current path lacks: the operator **sees what is on the disks** before they are
gone; the default is **proceed**; and the abort is **real**.

### 4.4 Repair mode — the largest missing capability

Your 2026-05-25 description is already a specification. Every input it needs is something the code
**already reads and throws away**:

1. **Recognise self** — the `ZETA_INSTALL` volume label is stamped by the installer and **nothing reads
   it.**
2. **Recover identity** — so a re-paved node rejoins as *itself* rather than registering a duplicate.
   *(Exactly the failure `HWR-2` is holding open: two registrations, one MAC.)*
3. **Validate before wipe (R9)** — a repair that re-wipes and re-fails is an infinite destructive loop.
4. **Preserve → format → repersist** — only correct **after** R8's stable rebind, or it carries a dead
   undecryptable blob forward. **That ordering is why R6 was correctly not shipped as a blind edit.**

> **Language discipline:** in this repo *"reformat"* has meant **re-flash the stick**. Repair mode is
> about the **target disk**. **The classifier that landed is on the USB-stick side of the wire; the
> 2026-06-09 ask was about the other side.**

### 4.5 Bootstrap ordering, made explicit

Either **encode the order in the names** (`00-`, `10-`, `20-`) so file order *is* dependency order — or
**state plainly that ordering is not enforced** and convergence relies on controller retry, then prove
the retry. The second is closer to how Kubernetes works and is probably right. **But it must be written
down, because right now the file says one thing, does another, and the difference is invisible until a
node boots.**

### 4.6 The pin question

`root-application.yaml` pins `targetRevision: main`, as do ten children. **Flashing an ISO built at a
tag still gets you `main`'s applications.** The USB pins the OS and does not pin the cluster. **That may
be what you want; it is not currently a decision anyone made.**

## 5. Open decisions that are yours

### 5.1 Storage — buy 2 TB, or trim the catalogue

| Option | Consequence |
|---|---|
| **Buy 2 TB NVMe per node** | Catalogue unchanged. Cost × node count — **scales with the fleet, not once.** No procurement row exists |
| **Trim declared PVCs to ~900 GiB** | No purchase. Someone decides which of 47 applications shrink — **a product call, not an engineering one** |
| **Split by node role** | Control-plane small; storage-heavy apps wait for a big-disk worker. **Matches the 3-node threshold you already named** |
| **Sign 2048 as aspirational and gate on the real disk** | **Cheapest correct move regardless** — make the auditor compare against **measured** capacity, so it fails honestly today |

**Sub-question:** should the control-plane import `longhorn-disks.nix`, or should the installer stop
creating that partition on control-plane nodes?

### 5.2 The credential binding — what is the stable key

**The decision that has blocked R8 for 74 days.**

| Option | Survives reformat? | Stick swap? | Machine swap? |
|---|---|---|---|
| **TPM seal** | yes | yes | **no** — node-bound |
| **USB iSerial** | yes | no | yes — stick-bound |
| **UEFI keyfile** | only if ESP survives | travels with stick | — |
| **iSerial ⊕ UEFI keyfile** | yes | no | yes — *what your 2026-06-09 phrasing literally pointed at* |

> **The question underneath: should a re-paved node remember its own credentials (TPM), or should the
> stick carry them from machine to machine (iSerial)? They are different products.**

### 5.3 Should the USB pin a tag, or track `main`

Tracking `main` means **flashing the same ISO twice, weeks apart, produces different clusters** — DST
and replay do not hold across that seam. Pinning makes the USB a reproducible artifact and makes
upgrades an explicit act. **This interacts with `clone-at-tag-stays-sufficient`: today the cluster half
of that does not hold.**

### 5.4 Single-ISO `dd`, or the GRUB2 multiboot composite

**Both exist on `main`. Nothing chooses.** The 2026-06-10 ask argues for multiboot, and the ask **has
been built** — it is simply not wired to the flasher.

### 5.5 The wipe-consent model

Does the countdown run on the zero-typing path too? **If yes, "fully headless" costs 60 s per node; if
no, the consent gate is absent exactly where it matters most.** Should a disk carrying a non-Zeta
filesystem be treated differently? Is flash-time consent transferable to boot-time — the script says
explicitly it is **not**.

### 5.6 FIPS — resolve a contradiction already on file

Your position is recorded. The buy-list still says *"For real custody use the FIPS SKU."* And the
measured fact: **FIPS-approved mode disables `eck256`**, so you may have the validation or the curve,
never both. **The buy-list is what someone reads before spending money.**

### 5.7 Which node do we burn first

If `/dev/sda` is the USB, the unconditional wipe cannot destroy anything you care about. **If it is an
internal disk, pick a different node or accept the loss deliberately. One `lsblk` decides it.**

## 6. What to build, ranked

| # | Work | Effort | Unblocks |
|---|---|---|---|
| **1** | **Boot one node.** Flash a post-2026-08-09 ISO, boot, then `kubectl -n kube-system get addon` and `kubectl get storageclass` | 1 hour, 1 machine, **zero CI minutes** | **Everything.** Closes two P2 bugs whose sole condition is *"one clean boot on Aaron's hardware."* Separates stage-3-proven from the highest-severity finding, and **separates the storage failure from the ordering failure — which have completely different fixes** |
| **2** | **Make the flash gate honest end to end** — sidecar preference + basename match · pass head digests so R1 can fire · pass `--expect-*` · **fetch the bundle and actually run `verify-blob`** · aarch64 digest + signature | ~2 days | Turns four gates from present-but-vacuous into load-bearing. **Without this, "verified" means "compared to itself"** |
| **3** | **The destructive path (R6+R7+R9)** — probe, printed findings, 60 s window, circuit-breaker | ~3 days | Closes the oldest and most dangerous asks. **Makes the headless path consensual rather than merely unattended** |
| **4** | **Decide and land the credential binding (§5.2)** | S once decided | Unblocks remember-across-reformat → preserve/repersist → repair mode |
| **5** | **Storage decision + gate on measured capacity** | S for the gate | **Removes a green check that cannot fail** |
| **6** | **Test the real roster** — one nixosTest that does *not* `mkForce` the ten manifests | M | Gives stage 3 its first evidence. **Answers the retry question without hardware** |
| **7** | **Repair mode (R4)** | ~1 week | The largest missing *capability* as opposed to *guard* |
| **8** | **Unify the flashers (R18) + Hello (R19) + structural gate** | L | Removes the thesis violation; **extends four macOS-only gates to everyone else** |
| **9** | **Fix the roster ordering** — prefixes or an honest comment | XS | **Stops the file lying to the next reader** |
| **10** | **Resolve the six dual-owned charts** | M | Removes reconciler-fights-reconciler from a cluster nobody has watched boot |
| **11** | **Refresh every operator document** — **the preflight's failure list does not include the refusal you will actually hit** | S | Item 1 goes better |
| **12** | **File the two missing backlog rows** | S | **Stops "already filed" meaning "filed nowhere"** |

> **Why item 1 is first even though 2 and 3 are safety work: items 2–12 are all preparation for it, and
> several will change shape once a node has booted. Doing them first risks building the wrong guard for
> the wrong failure.**

## 7. Known unknowns

1. **Does the k3s deploy controller retry an apply of an unknown kind?** If not, the cluster stops at
   seven charts **while `systemctl is-active k3s` reports `active`.** `get addon` answers it.
2. **Do all ten manifests apply in the order they land?** No test covers it.
3. **Is `/dev/sda 115.5G` the USB or an internal disk?** Decides whether first boot is safe.
4. **Does longhorn fail or partially bind at 1.7× oversubscription on real NVMe?** The kind measurement
   was 15× on a 100 GB disk.
5. **Does the ESP SSH-pubkey inject survive real firmware?** *"Flash complete."* without *"pubkey
   written"* means the node comes up with no key.
6. **Does the WiFi radio associate?** Never simulated, by design — a physical gate.
7. **Does self-registration work for your identity?** **`maintainers/aaron/` has no `cluster-nodes/`
   directory.** Expect this to be the least-travelled step.
8. **Does the aarch64 image boot on a Pi?** Metal untried, and it carries neither signature nor digest.
9. **Does `nixos-install` complete over your actual network?**
10. **Is Secure Boot on?** `secure-boot.nix` fails closed at any phase but `off`. **If firmware Secure
    Boot is enabled the stick will not boot, and the symptom is "no bootable device."**

## 8. Suggested, not asked for

*Kept separate so enhancements never enter the ledger as requirements.*

- **A `--dry-run` install mode** — enumerate, classify, print the full plan, exit. **Converts the
  scariest step into something you can inspect before committing**, and answers unknown 3 without a
  second tool.
- **A post-install acceptance script on the node** — makes *"metal reproduced CI"* a checkable claim.
- **Ship the serial log to the ESP.** One line. **Everything learned on the first boot otherwise lives
  in a scrollback buffer a reboot destroys — the difference between one boot and a repeatable proof.**
- **Name the stick.** Mika asked twice; it is still "the USB."
- **A per-node declaration of what the node broadcasts** — self-registration publishes CPU, GPU, memory,
  storage and MAC to a public repo, **and that is a consent surface nobody has explicitly decided on.**

## 9. In one paragraph

The USB works — it worked in June, on metal, in the hands of a non-author, four times. Since then eight
weeks of correct, careful safety work landed on top of it with QEMU as the only witness, and one of
those gates shipped with no supply path and blocked the flash entirely. The oldest asks are the
destructive-path ones from 2026-06-09, still open at 74 days: no pre-format check, no cancel window, no
repair mode, no circuit-breaker. Underneath them sits one decision only you can make — what the
credentials bind to — and it has been the blocker the whole time. **Everything else here is either
preparation for booting one node, or a consequence of not having booted one. Boot the node. Then most
of §6 will re-sort itself.**
