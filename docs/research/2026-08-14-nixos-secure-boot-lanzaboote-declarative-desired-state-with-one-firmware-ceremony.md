# NixOS Secure Boot — lanzaboote keeps desired-state; one firmware ceremony per node cannot be eliminated

**Work-item:** 081M00KTH58087G0R00120WT6F
**Agent:** Dejan (devops-engineer)
**Status:** RESEARCH — awaiting human sign-off on §9 open questions. No boot configuration changed by this PR.
**Scope:** whether UEFI Secure Boot can be added to the Zeta NixOS cluster without sacrificing declarative
desired-state; what stays in the Nix expression; what becomes a one-time ceremony; the out-of-tree-GPU-module
answer; the headless recovery story; the honest cost of the OS-switch / unikernel alternatives.

---

## 0. The ask and the constraint that decides it

Aaron, 2026-08-14:

> "since we are using nixos can we get secure boot working, even if we have to inject custom keys into the
> bios? … we need it with the ace package manager dependency manager of dependency managers so it can be
> declarative and desired state like nixos, **we don't want to sacrifice that for secure boot**."

Declarative/desired-state is the fixed point. Secure Boot has to fit into it. This document answers whether
it does, with primary-source evidence rather than folklore.

---

## 1. Recommendation, with the effort named

**Adopt `lanzaboote` on the existing NixOS cluster. Do not switch OS. Do not build a unikernel.**

| Path | What it buys | Effort | Verdict |
|---|---|---|---|
| lanzaboote on NixOS | UEFI SB with our own PK/KEK/db, per-node keys, full desired-state, rollback intact | ~1 engineer-day of config + 1 QEMU/OVMF CI scenario + ~15 min ceremony per node | **Recommended** |
| Switch to a "secure boot OS" (Fedora/RHEL/Ubuntu) | SB out of the box via Microsoft-signed shim | Multi-week migration; loses the flake; loses `nixos-rebuild` rollback | **Rejected** — strictly worse on *both* of Aaron's axes: less declarative AND more centralized (Microsoft's signature becomes the root of trust) |
| Own micro/unikernel | A single signed EFI image is trivially signable | Multi-quarter, and see §8 | **Rejected for cluster nodes**; possible narrow research lane for single-purpose appliances |

Blunt version of the headline: **lanzaboote gets ~90% of the value for ~2% of the work.** It is a NixOS
module. The entire signing pipeline becomes options in the flake. There is exactly one irreducible imperative
step and it is a BIOS menu action Aaron performs once per machine.

---

## 2. What is actually in the repo today (verified, not assumed)

- **Two NixOS trees exist.** `infra/nixos/` (nixpkgs 24.11, referenced by the root `flake.nix`
  `nixosConfigurations`) and `full-ai-cluster/nixos/` (nixpkgs 25.11, referenced by
  `full-ai-cluster/flake.nix`). `full-ai-cluster/usb-nixos-installer/zeta-install.sh:1451-1457` runs
  `nixos-install --flake /mnt/etc/zeta/full-ai-cluster#$HOST` — so **`full-ai-cluster/` is the live boot
  path** and `infra/nixos/` is a parallel, older tree. Secure Boot work belongs in `full-ai-cluster/nixos/`.
  The duplication is pre-existing drift and is called out below as a separate DEBT row, not fixed here.
- **Bootloader today:** `full-ai-cluster/nixos/modules/common.nix:349-352` —
  `boot.loader.systemd-boot.enable = lib.mkDefault true; boot.loader.efi.canTouchEfiVariables = lib.mkDefault true;`
  Plain systemd-boot, UEFI, no Secure Boot anywhere.
- **ESP is 1 GiB**, FAT32 (`full-ai-cluster/nixos/modules/disko-shapes/boot-disk-partitions.nix:5-7`,
  `zeta-install.sh:227`).
- **Root filesystem is plain ext4. There is no LUKS anywhere in the disko shapes.** This matters — see §6.
- **GPU nodes run the proprietary NVIDIA driver** with `hardware.nvidia.open = lib.mkDefault false`
  (`full-ai-cluster/nixos/modules/gpu.nix:33`) — an out-of-tree kernel module.
- **Zero prior Secure Boot substrate.** A repo-wide grep for `secure.boot|lanzaboote|sbctl|shim|tpm2|MOK`
  across `infra/`, `full-ai-cluster/`, `src/Core.TypeScript/ace/`, `workitems/`, `docs/backlog/` returns
  nothing relevant. This is greenfield.

---

## 3. Does lanzaboote actually stay declarative? Yes — and here is the exact boundary

Evidence read directly from `github:nix-community/lanzaboote` at rev `4a773989235545c56f408d168cb63bc41d468832`
(v1.1.0 line, last modified 2026-08-11), file `nix/modules/lanzaboote.nix`.

### 3.1 What lives in the Nix expression (desired-state, git-tracked, reviewable, rollback-able)

Everything except one BIOS action:

```nix
boot.lanzaboote = {
  enable        = true;
  pkiBundle     = "/var/lib/sbctl";
  autoGenerateKeys.enable = true;
  autoEnrollKeys = {
    enable               = true;
    includeMicrosoftKeys = true;   # see 6.3 — mandatory on the GPU nodes
    autoReboot           = true;
  };
  configurationLimit = 8;
  bootCounting.initialTries = 3;   # see 7.2 — the headless safety net
  settings."secure-boot-enroll-timeout-sec" = 0;  # systemd >= 258; see 5.2
};
boot.loader.systemd-boot.enable = lib.mkForce false;
```

Mechanically, the module sets `boot.loader.external.enable = true` with
`installHook = "${installHook}/bin/lzbt"`, so `nixos-rebuild switch` / `nixos-install` invoke lanzaboote's
tool instead of `bootctl install`. Signing every generation's Unified Kernel Image is therefore part of the
ordinary NixOS activation — not a side ritual. `boot.loader.supportsInitrdSecrets = true` is set, so the
initrd-secrets path survives.

Three systemd units carry the provisioning, all generated from the options above:

| Unit | Guard | What it does |
|---|---|---|
| `generate-sb-keys.service` | `ConditionPathExists = "!${pkiBundle}/keys"` | `sbctl create-keys` (RSA-4096, `sbctl/backend/file.go:22`) |
| `prepare-sb-auto-enroll.service` | `ConditionPathExists = ["!ESP/loader/keys/auto/PK.auth" …]` | `sbctl enroll-keys --export auth`, installs `{PK,KEK,db}.auth` to `ESP/loader/keys/auto/`, re-signs the ESP, then `SuccessAction = "reboot"` |
| `auto-cryptenroll.service` | measured-boot only | TPM2 LUKS re-enrollment |

Both provisioning units are **idempotent by construction** — they are `ConditionPathExists`-guarded, and the
upstream test `nix/tests/lanzaboote/auto-generate-enroll.nix` asserts they refuse to re-run
("Condition: start condition unmet"). That satisfies discipline #6.

### 3.2 The one thing that stays imperative — and why it cannot be eliminated

`prepare-sb-auto-enroll` does not touch firmware NVRAM. It writes authenticated-variable files to the ESP and
sets `secure-boot-enroll force` in `loader.conf`. **systemd-boot** does the actual NVRAM write on the next
boot. From systemd's own manual (`man/loader.conf.xml:293`, verbatim):

> "Controls enrollment of secure boot keys found on the ESP **if the system is in setup mode**"

Setup Mode means the Platform Key is absent. Deleting a PK requires an authenticated variable update signed by
the current PK's private key — which is the OEM's, and which Aaron does not have. **No software running on the
node can put its own firmware into Setup Mode.** That is a UEFI spec property, not a lanzaboote limitation, and
it is the same for every OS on the list.

So the irreducible ceremony, once per machine, at the console or over BMC/IPMI KVM:

1. Enter firmware setup.
2. Enable Secure Boot, then **"Reset to Setup Mode"** (Lenovo wording) / **delete the Platform Key**
   (ASUS/Framework wording).
3. **Do not** choose "Clear All Secure Boot Keys" / "Erase all Secure Boot Settings" — those drop the
   Forbidden Signature Database (dbx) and hand back a *weaker* machine.
4. Save and exit.

Everything after that is automatic. Note the ordering is forgiving: the `.auth` files can sit on the ESP
indefinitely; whenever the firmware next finds itself in Setup Mode, systemd-boot enrolls. Prepare-then-wait,
which means the ceremony does not have to be interleaved with the install.

**Can the ceremony be expressed as desired-state?** Not as a Nix option — Nix has no channel into firmware
NVRAM. It can be expressed as *observable* desired-state: a post-boot assertion that reads
`/sys/firmware/efi/efivars/SecureBoot-*` and `SetupMode-*` and reports drift. Recommended as the check in §7.4.
That is the honest form: **the ceremony is a ceremony; the desired-state system's job is to notice when it has
not happened.**

---

## 4. Is ace the same shape as Secure Boot's trust root? No — and it should not pretend to be

`src/Core.TypeScript/ace/signing.ts` is **Ed25519 over recursive key-sorted canonical JSON**, with
`key_id = "ed25519:" + sha256(SPKI-DER)[0:16]`, a trust store keyed by `key_id`, and a revocation map
(`registry-revoke.ts`).

UEFI Secure Boot's db accepts `EFI_CERT_X509_GUID` / `EFI_CERT_RSA2048_GUID` / `EFI_CERT_SHA256_GUID`.
Signatures over boot artifacts are PE/COFF Authenticode. `sbctl` generates **RSA-4096** X.509
(`sbctl/backend/file.go:22 var RSAKeySize = 4096`); lanzaboote signs via `sbsign`
(`rust/tool/shared/src/signature/local.rs`).

**Ed25519 is not a UEFI signature type.** ace cannot be the signer for the boot chain, and any design that
claims otherwise is wrong at the cryptographic layer. What genuinely rhymes is the *policy* shape, and only
that:

| ace | UEFI Secure Boot |
|---|---|
| trust store of public keys, key-id addressed | `db` |
| `registry-revoke.ts` revocation map | `dbx` |
| `--frozen` / `--locked` lockfile | pinned flake inputs + the signed generation set on the ESP |
| `ace verify <hash>` | `sbctl verify` |

The useful conclusion: **ace already models "a declarative list of trust roots plus a revocation list."**
Secure Boot is that same model implemented in firmware with different primitives. Treat them as two instances
of one policy shape, not one system. Do not build a bridge that makes ace sign EFI binaries.

### 4.1 The upstream seam worth an eventual PR (GOVERNANCE §23)

`rust/tool/shared/src/signature/mod.rs` defines a `Signer` trait with an explicit invitation:
*"To implement a new signer, provide a minimal implementation of this trait."* Today there are exactly two
impls: `LocalKeyPair` (on-disk key, shells out to `sbsign`) and `EmptyKeyPair`. There is **no hardware-token or
remote-signer backend**.

That is the seam for Aaron's *"nothing operator-run, only operator-approved via biometric"* position: a
PKCS#11 / YubiKey-PIV `Signer` impl would make each UKI signature require a physical touch. `sbctl` already has
YubiKey (`backend/yubikey.go`, RSA-4096 PIV signature slot, touch-to-confirm) and TPM backends — lanzaboote
just does not consume them.

**But name the tension honestly rather than designing around it:** unattended `nixos-rebuild switch` and
touch-per-signature are mutually exclusive. You cannot have both. Given the db key is **per-node and
self-generated**, an on-disk key compromises one node's boot chain, not the fleet's — which is the
decentralization-preserving trade. Recommendation: accept the on-disk key now, file the PKCS#11 `Signer` as an
upstream contribution candidate, and do not fork lanzaboote in-tree.

### 4.2 Decentralization check (Aaron's Itron-patents boundary)

`autoGenerateKeys` makes **each node generate its own PK/KEK/db on first boot**. There is no fleet CA, no
central signing service, no key escrow. Compromising node A's db key gives you nothing on node B. This is the
decentralized shape and it falls out of the default configuration — no design work required.

The centralized alternative (one org db key, signed artifacts distributed) would be *operationally* easier
(one key to rotate, a shared signed rescue ISO) and is **disqualified** under Aaron's stated boundary. Do not
propose it. The cost of the decentralized choice is real and stated in §7.1: no single signed rescue medium.

**Where the decentralization stops (root: the OEM Platform Key, and the OEM firmware that enforces it).**
This is a **software-layer** decentralization claim, and it is a good one — but it does not extend to the
metal, and manifesto **§1 scale-free** should be read the same way here. Three limits, all structural:

1. **Getting to Setup Mode is an OEM-gated act.** Per §3, deleting the PK requires an authenticated
   variable update signed by the current PK's private key, which is the OEM's. The physical-presence
   firmware-menu ceremony is the *only* path, and it exists because the OEM's firmware offers it.
2. **The enforcer is OEM code.** After enrollment your PK/KEK/db are the roots for *image verification* —
   that part genuinely becomes yours. But the UEFI implementation deciding whether to honour them is
   vendor firmware you cannot read, rebuild, or replace, and OEM-signed capsule updates can change it.
3. **The one root that is never ours is `db`'s Microsoft CA on GPU nodes** — already reported at §6.3,
   which is the register this note follows.

None of this argues against the design; per-node self-generated keys with no fleet CA remain the right
shape and are strictly better than a fleet key. It bounds the claim: *within* what the firmware enforces,
there is no central point of control; the firmware itself is a per-vendor one. The mitigation available is
the same one that applies to attestation roots — **vendor diversity across the fleet**, so that one OEM's
firmware behaviour is not every node's. See the sovereign-keys ladder's "Vendor roots cap every attestation
claim" section, and `docs/research/2026-08-14-what-a-full-rewrite-cannot-remove-…md` §5.4.

---

## 5. Composition with the existing ISO / first-boot install path

`zeta-install.sh` partitions, mounts, and runs `nixos-install --flake /mnt/etc/zeta/full-ai-cluster#$HOST`.

### 5.1 It composes. No change to the install flow is required

`boot.lanzaboote.allowUnsigned` defaults to `autoGenerateKeys.enable`, and `rust/tool/systemd/src/cli.rs:122-129`
shows the selection:

```rust
if args.allow_unsigned
    && std::fs::exists(public_key).ok().is_none_or(|b| !b)
    && std::fs::exists(private_key).ok().is_none_or(|b| !b)
{
    log::warn!("No keys provided. Installing unsigned artifacts.");
    let signer = EmptyKeyPair;
```

So `nixos-install` on a fresh disk (no `/var/lib/sbctl` yet) lays down **unsigned** artifacts and succeeds.
First boot generates keys, prepares enrollment, re-signs, reboots. The ISO itself never needs to be signed and
`zeta-install.sh` needs no new step.

### 5.2 The 15-second countdown, and why headless is still fine

`systemd/src/boot/secure-boot.c:75-118`: on bare metal (`in_hypervisor()` false) with `force`, systemd-boot
prints *"Enrolling in Ns, press any key to abort"* and counts down from `ENROLL_TIMEOUT_DEFAULT = 15`. **A
keypress aborts; no keypress proceeds.** A headless node with no keyboard therefore enrolls unattended after
15 s. Setting `secure-boot-enroll-timeout-sec = 0` (`ENROLL_TIMEOUT_HIDDEN`) skips the prompt entirely;
systemd in nixpkgs 25.11 is **258.7**, so both this and `secure-boot-enroll-action` (v258) are available.

Trap worth knowing: an IPMI/KVM virtual keyboard that emits spurious input **silently aborts enrollment** and
drops to the boot menu. If enrollment mysteriously does not happen, that is the first thing to check.

### 5.3 The `allowUnsigned` footgun — a real brick risk, and the fix

`allowUnsigned` defaults to `true` whenever `autoGenerateKeys` is on, and it stays true forever. If
`/var/lib/sbctl` is ever lost (disk replacement, reinstall that preserves the ESP, an ephemeral-root
misconfiguration) while the firmware still enforces our db, `lzbt` will **silently install unsigned UKIs** and
the node becomes unbootable at the next reboot, with the failure surfacing hours later.

Fix: a two-phase per-host flag, still fully declarative:

```nix
zeta.secureBoot.phase = "provision";   # install + first boot: allowUnsigned = true
zeta.secureBoot.phase = "enforce";     # after enrollment confirmed: allowUnsigned = lib.mkForce false
```

In `enforce`, a missing key makes `nixos-rebuild` **fail loudly at build time** instead of producing an
unbootable generation. The flag is one line per host in git, reviewed, rollback-able. This is the shape that
keeps the ceremony's completion visible in desired-state.

---

## 6. What breaks — the honest list

### 6.1 Out-of-tree kernel modules / NVIDIA: nothing breaks. This is the decisive finding

nixpkgs `pkgs/os-specific/linux/kernel/common-config.nix:820-823`, verbatim:

```nix
MODULE_SIG = no; # r13y, generates a random key during build and bakes it in
# Depends on MODULE_SIG and only really helps when you sign your modules
# and enforce signatures which we don't do by default.
SECURITY_LOCKDOWN_LSM = no;
```

The NixOS kernel has **no module signature enforcement and no lockdown LSM**. Kernel lockdown is the mechanism
by which Secure Boot would otherwise force module signing; without `SECURITY_LOCKDOWN_LSM`, enabling UEFI
Secure Boot has **no effect on module loading**.

Therefore: **the proprietary NVIDIA driver loads unchanged under lanzaboote. `gpu.nix` needs zero changes. No
MOK, no shim, no module-signing key, no `hardware.nvidia.open = true` forced migration.** This is the question
that usually kills Secure Boot on GPU nodes, and on NixOS it is simply not a problem.

The honest counterpart: because lockdown is off, **the chain of trust ends at the UKI.** Secure Boot here
guarantees "the kernel and initrd that booted are the ones we signed." It does *not* seal the running kernel —
root can `insmod` anything. Do not oversell what this buys.

#### 6.1a Measured 2026-08-17 — confirmed, and "insmod" was the smaller half

Measured under `081M00QP7G7087G0R002PZB5T2` by reading the **generated kernel `.config`** that this
repo's own flake resolves to, rather than `common-config.nix`:
`/nix/store/4dq737q0ip6v1py1cqz6g9fw6kfnmkd4-linux-config-6.12.90`, shared by `control-plane`,
`worker-gpu` and the installer ISO. `# CONFIG_MODULE_SIG is not set` and
`# CONFIG_SECURITY_LOCKDOWN_LSM is not set` — this section is **confirmed as written**. Three
additions:

- **`kexec`, not just `insmod`.** `CONFIG_KEXEC=y`, `CONFIG_KEXEC_FILE=y`, `CONFIG_KEXEC_SIG`
  **not set** — root can replace the entire running kernel with an arbitrary unsigned image, no
  signature check, no reboot, no ESP write. Strictly stronger than loading a module into the signed
  kernel, and the sentence above should be read as naming the weaker case.
- **Nothing measures userspace either.** `CONFIG_IMA`, `CONFIG_EVM`, `CONFIG_INTEGRITY_SIGNATURE`
  all off; `CONFIG_DM_VERITY=m` exists and is unused; no `luks|verity|tpm2|cryptenroll` anywhere in
  `full-ai-cluster/nixos/`.
- **`lockdown` is also absent from the runtime LSM list.** The hosts evaluate to
  `lsm=landlock,yama,bpf` (an upstream default, set nowhere in this repo) — it could not contain
  `lockdown`, since the LSM is not compiled. And `boot.initrd.systemd` is `disabled` on all three,
  so the `systemd-pcrphase` route to measured boot is a second change, not a flag on the first.

Citation note for anyone re-checking the quote above: `820-823` matches the **branch tip** of
`nixos-25.11`; at the rev pinned in `full-ai-cluster/flake.lock`
(`b77b3de8775677f84492abe84635f87b0e153f0f`) the same four lines are `821-824`. Same text, moving
branch. Full method, the symbol table, and what could **not** be measured (no boot, no PCR, no TPM
on the measuring host): `workitems/081M00QP7G7087G0R002PZB5T2-*.md`.

### 6.2 Rollback: preserved, with two sharp edges

Lanzaboote signs **every** generation's UKI on the ESP, so `nixos-rebuild --rollback` and the boot-menu
generation list keep working. Two edges:

- **Generations built before lanzaboote was enabled are unsigned and will not boot** once enforcement is on.
  The rollback window silently resets at cutover. Say so in the runbook.
- **ESP capacity.** With lanzaboote the kernel + initrd + a per-generation UKI stub all live on the ESP.
  `common.nix` sets no `configurationLimit`, and the default derives from `boot.loader.systemd-boot.configurationLimit`,
  which is unset → `null` → `0` → **unlimited**. On a 1 GiB ESP that fills, and upstream's troubleshooting doc
  documents exactly this failure ("No space left on device (os error 28)") with a manual recovery. Set
  `configurationLimit` explicitly. If measured boot is later enabled the module *asserts* `0 < limit <= 8`.
  **Action: set `configurationLimit = 8` at cutover; measure real UKI size on the first node and record it.**

### 6.3 Microsoft keys in `db` — the genuine conflict, reported not resolved

Per Aaron's instruction not to weaken anything silently, this one is a real tension with no clean answer:

- Discrete NVIDIA GPUs carry an **option ROM (GOP driver)** that firmware executes during POST and validates
  against `db` when Secure Boot is on. Those ROMs are signed under the **Microsoft UEFI CA**, not by us.
- `includeMicrosoftKeys = false` risks the GPU's GOP failing to load — upstream calls this
  "potentially dangerous," gates it behind `allowBrickingMyMachine`, and the module carries an assertion
  forcing an explicit choice. On the GPU nodes this is the higher-risk option.
- But `includeMicrosoftKeys = true` puts **Microsoft's CA in our root of trust**, which means any
  Microsoft-signed EFI binary — including historically vulnerable third-party bootloaders — satisfies our db.
  That materially weakens what Secure Boot buys, and it imports an external centralized authority into an
  otherwise decentralized design.

**This is a conflict between "working GPU nodes" and "our keys only." I am not resolving it by dropping either
constraint.** The mitigations that do not require choosing:

- Keep **dbx current** (Microsoft's revocation list is what makes the MS CA tolerable). Verify
  `/sys/firmware/efi/efivars/dbx-*` is non-empty post-enrollment; a near-zero-size dbx means the firmware's
  revocation list was dropped.
- The `--tpm-eventlog` option-ROM-checksum path exists and would let us drop MS keys, but upstream labels it
  experimental and it breaks on firmware updates. Not recommended for a cluster.
- **Empirical resolution:** the control-plane node may have no discrete GPU. If so, run `includeMicrosoftKeys = false`
  there and `true` on GPU workers — an honest per-host split rather than a fleet-wide compromise. Open
  question 3 asks Aaron for the hardware fact needed to decide.

### 6.4 Key material at rest — the largest real gap

Upstream states it plainly: *"Lanzaboote cannot keep your keys secure. You need to do this yourself, e.g. by
using full disk encryption."* Their security-requirements page lists two prerequisites: a **BIOS password**
and **full disk encryption**.

**The cluster has neither.** Root is plain ext4 (§2). With `/var/lib/sbctl/keys/db/db.key` sitting unencrypted
on an unencrypted disk, anyone with ten minutes of physical access pulls the key and signs whatever they want —
Secure Boot is defeated without ever touching the firmware. And without a BIOS password, an attacker can simply
turn Secure Boot off.

So the ordering matters: **Secure Boot without root encryption and a BIOS password is largely theatre against a
physical adversary.** It still buys something real against a *remote* adversary with root — persisting across a
reboot now requires re-signing, which requires reading a root-only key on that specific node. That is a genuine
narrowing of the persistence surface and is the honest justification for doing it now.

Full-disk encryption on headless nodes requires TPM2 unlock (`systemd-cryptenroll` + `measuredBoot`) or a
network unlock, both of which need TPM2 hardware. That is a second, larger project — it should be a follow-on
work-item, sequenced after Secure Boot, not bundled into it. Open question 4.

### 6.5 initrd secrets

`boot.loader.supportsInitrdSecrets = true` is set by the module and there is an upstream test
(`initrd-secrets.nix`, `initrd-secrets-update.nix`). No known breakage; the repo does not appear to use
`boot.initrd.secrets` today, so this is a non-issue that becomes relevant only if FDE lands.

---

## 7. Headless recovery — the question that decides whether this is safe to do at all

This is where I would slow down, not at the config.

### 7.1 Every documented recovery path in upstream's troubleshooting doc begins with firmware access

Verbatim, upstream:

- ESP corruption, no generation boots: *"1. Disable Secure Boot in the firmware settings. The NixOS install
  medium is not signed and thus cannot be booted when Secure Boot is active."*
- Doesn't boot with Secure Boot enabled: *"To recover from this, disable Secure Boot in your firmware settings."*

Two consequences specific to our design:

- **Our unsigned NixOS installer ISO can no longer boot an enrolled node.** That is not a bug we introduced; it
  is what Secure Boot means. Because keys are per-node (§4.2), there is no single signed rescue ISO that works
  fleet-wide, and manufacturing one would require the centralized key Aaron ruled out.
- With Microsoft keys enrolled (§6.3), a **shim-signed rescue distro** (Fedora/Ubuntu live media) still boots
  and can `mount` + `chroot`. That is a usable rescue medium that costs nothing extra and is worth having on a
  shelf. Worth noting: this is the same MS-CA-in-db that weakens the security posture — it also buys back the
  rescue path. The trade is symmetric and should be recorded as such.

**Therefore the gating question is: do the cluster nodes have out-of-band management (BMC / IPMI / Redfish /
remote KVM)?**

- **Yes** → firmware access is remote, the whole class of failures is recoverable from a laptop, and the risk
  is ordinary. Proceed.
- **No** → every Secure Boot failure mode escalates to "drive to the machine with a monitor and keyboard."
  My recommendation in that case is: **still proceed, but only with §7.2 armed, and cut over one node first.**

I do not have the hardware inventory to answer this. Open question 2.

### 7.2 Boot counting is the mitigation that works headless, and it is one line

`bootCounting.initialTries = N` wires systemd's Automatic Boot Assessment: a new generation gets N tries; if
`boot-complete.target` is never reached, systemd-boot decrements, marks it bad, and **falls back to the last
known-good generation on its own**. Upstream's `nix/tests/lanzaboote/boot-counting.nix` asserts exactly this —
it boots a deliberately-failing specialisation, watches the counter go `+2` → `+0-2`, and asserts the machine
lands back on the original configuration. Filename-based counters do not change PE content, so signatures still
validate across the rename.

**This turns "bad generation" from a site visit into a self-healing 3-reboot delay.** It is the single highest
-value line in the config for a headless fleet, and it is *not* Secure Boot specific — it is worth landing even
if Secure Boot is deferred.

It does **not** cover firmware-level rejection (a signature failure means the UKI never runs, so nothing
counts). That residue is why §7.1 still gates.

### 7.3 Recommended rollout order

1. Land `bootCounting.initialTries = 3` and `configurationLimit = 8` **alone**, no Secure Boot. Independently
   valuable, zero SB risk. Confirm generations still boot.
2. Land the lanzaboote module in `phase = "provision"` on **one** node — ideally the least-critical GPU worker,
   not the control plane. Firmware ceremony. Confirm `bootctl status` shows `Secure Boot: enabled (user)` and
   `sbctl verify` is all-green.
3. Confirm the NVIDIA driver still loads and a GPU pod schedules (this is where §6.1's prediction gets tested
   against reality rather than against a config file).
4. Flip that node to `phase = "enforce"`.
5. Roll the remaining workers, then the control plane last.

### 7.4 The check, and proof it can go red

Per the brief's standing rule about checks that cannot fail: the check I propose is a **QEMU/OVMF NixOS VM
test**, in the shape upstream already uses, asserting the full provisioning sequence:

- `loader.conf` contains `secure-boot-enroll force`
- `generate-sb-keys.service` and `prepare-sb-auto-enroll.service` reach active
- `sbctl verify` reports all artifacts signed
- after reboot, `bootctl status` contains `Secure Boot: enabled (user)`

**Proof it can go red, cheaply and deliberately:** delete `/boot/loader/keys/auto/db.auth` before the reboot
step, or corrupt a UKI with `echo garbage >> /boot/EFI/nixos/kernel-*.efi` — upstream's
`hash-mismatch-kernel-sb.nix` does precisely this and asserts the console prints `hash does not match`. A
mutation test that flips `boot.lanzaboote.enable = false` must make the `bootctl status` assertion fail. If the
scenario passes with SB disabled, the check is vacuous and must not land. **I will demonstrate red before green,
not claim it.**

Cost estimate for CI: the existing `build-ai-cluster-iso.yml` QEMU scenarios are the precedent. This adds one
OVMF-with-secure-boot-vars VM boot, ~6-10 min per run, dispatch-triggered rather than per-PR. It earns its slot
only if it runs on changes to the boot path — path-filtered to `full-ai-cluster/nixos/**` and the flake, not on
every commit.

---

## 8. The unikernel / OS-switch path, costed honestly

Aaron raised micro/unikernels. The brief asks for effort named, not enthusiasm.

**The signing part is the easy part.** A unikernel *is* a single EFI binary; `sbsign` it and you are done. If
Secure Boot were the only goal, a unikernel would be simpler than Linux.

**Everything else is the program.** A cluster node in this design must: run k3s, run containerd, run OCI
containers, mount Longhorn volumes over iSCSI, and drive NVIDIA GPUs. Every one of those is a Linux-kernel
feature — namespaces, cgroups, the iSCSI initiator, and above all the NVIDIA driver, which **is a Linux kernel
module and will never load on a unikernel.** GPU AI workloads on a unikernel would require passing the GPU
through to a Linux guest, at which point Linux is back and the unikernel is a hypervisor.

Named effort, plainly: replacing the cluster node substrate with a unikernel is a **multi-quarter program that
also requires re-implementing or replacing the container runtime, the CSI storage path, and the GPU stack** —
and it buys *nothing* on the Secure Boot axis that lanzaboote does not buy in a day. The declarative
requirement makes it worse, not better: NixOS *is* the declarative dependency manager, and a unikernel build
system would have to reproduce it.

**Where a unikernel genuinely fits** (worth a separate research lane, not this work-item): a single-purpose,
non-GPU, non-container appliance where the attack surface reduction is the point — a Reticulum relay, a signing
appliance, a DNS/attestation responder. Small, one job, one signed image. That is the Unikraft/MirageOS sweet
spot and it is a real idea. It is just not the AI cluster nodes.

"Switch to a secure-boot OS" is worse on both axes and is covered in §1: Fedora/RHEL/Ubuntu get Secure Boot via
a **Microsoft-signed shim**, i.e. Microsoft is the root of trust by construction — more centralized than what
lanzaboote gives us, plus losing the flake means losing exactly the desired-state property Aaron called
non-negotiable.

---

## 9. Open questions — human sign-off required before any YAML or Nix lands

Round-29 discipline: no CI/boot decision lands without Aaron answering these. Expected answer shapes given so
the reply can be short.

1. **Which NixOS tree is canonical?** `full-ai-cluster/nixos/` is the one `zeta-install.sh` actually installs;
   `infra/nixos/` is a parallel 24.11 tree. Expected answer: *"full-ai-cluster is canonical, infra/nixos is
   stale — delete it"* / *"both are live, here's why"* / *"leave it, separate work-item."* Greenfield rule says
   the stale one gets deleted in the commit that supersedes it; I will not delete another tree on my own read.
2. **Do the cluster nodes have BMC / IPMI / remote KVM?** This is the single fact that decides whether Secure
   Boot is low-risk or medium-risk here (§7.1). Expected answer: *"yes, all three"* / *"no, consumer
   motherboards"* / *"control-plane yes, workers no."*
3. **Does the control-plane node have a discrete GPU with an option ROM?** If not, it can run
   `includeMicrosoftKeys = false` (our keys only) while GPU workers keep MS keys — a per-host split rather than
   a fleet-wide weakening (§6.3). Expected answer: *"control-plane is iGPU/headless"* / *"all three have
   NVIDIA cards."*
4. **Do the nodes have TPM 2.0?** Not needed for Secure Boot; required for measured boot and for headless FDE
   (§6.4), which is the thing that makes Secure Boot more than partial. Expected answer: *"yes, fTPM in
   firmware"* / *"no"* / *"unknown — probe it."* (Probe: `systemd-analyze has-tpm2` or
   `ls /sys/class/tpm/tpm0`. Aaron runs it; I will not touch the nodes.)
5. **Is a BIOS password acceptable operationally?** Upstream lists it as a prerequisite; it also means firmware
   recovery needs that password, so it interacts with question 2. Expected answer: *"yes, stored in 1Password"*
   / *"no, too risky without BMC."*
6. **Which node is the pilot?** §7.3 recommends the least-critical GPU worker, not the control plane. Expected
   answer: a hostname.
7. **Is the two-phase `zeta.secureBoot.phase` flag (§5.3) acceptable**, or is a single always-on config
   preferred despite the silent-unsigned brick risk? Expected answer: *"two-phase is fine"* / *"find a
   one-phase design."*

---

## 10. The exact commands Aaron runs — nothing here is agent-executed

Per the hard constraint: **no agent handles, prints, or logs key material, and no agent enrolls keys.** Key
generation happens on the node, by a systemd unit, from the declarative config; the private key never leaves
`/var/lib/sbctl` and never appears in any log or CI artifact.

Aaron's steps, per node, after the config lands and the node has booted once:

```bash
# 1. Confirm the node prepared enrollment (read-only; prints no key material)
ssh <node> 'sudo systemctl status prepare-sb-auto-enroll.service; ls /boot/loader/keys/auto'
ssh <node> 'bootctl status | head -20'

# 2. FIRMWARE CEREMONY -- console or BMC KVM, Aaron only:
#    enter setup -> enable Secure Boot -> "Reset to Setup Mode" / delete Platform Key
#    DO NOT choose "Clear All Secure Boot Keys" (drops dbx)
#    save + exit

# 3. On the next boot systemd-boot enrolls (15s abortable countdown; do not press a key).
#    Verify afterwards:
ssh <node> 'bootctl status'            # expect: Secure Boot: enabled (user)
ssh <node> 'sudo sbctl verify'         # expect: all green except kernel-*.efi
ssh <node> 'ls -l /sys/firmware/efi/efivars/dbx-*'   # expect: NOT near-zero size

# 4. Flip the host to phase = "enforce" in git, PR, then:
ssh <node> 'sudo nixos-rebuild switch --flake /etc/zeta/full-ai-cluster#<host>'
```

Rollback at any point: disable Secure Boot in firmware, set `boot.lanzaboote.enable = false`, rebuild. Because
lanzaboote is a NixOS module, backing it out is a config revert plus one firmware toggle — the desired-state
property cuts both ways and that is exactly the argument for this path.

---

## 11. Debt and follow-on items this surfaced (not fixed here)

- **DEBT — duplicate NixOS trees.** `infra/nixos/` (24.11) and `full-ai-cluster/nixos/` (25.11) both define
  `common.nix`, `gpu.nix`, `k3s-server.nix`, `k3s-agent.nix` with divergent content. Any boot-path change has
  to be made twice or made in the wrong place. Blocked on open question 1.
- **DEBT — `configurationLimit` unset on a 1 GiB ESP.** Unlimited generations on the ESP is a latent
  disk-full failure *today*, independent of Secure Boot.
- **Follow-on — headless full-disk encryption.** Without it, Secure Boot's protection against a physical
  adversary is largely theatre (§6.4). Needs TPM2 (open question 4). Larger than this work-item; should be its
  own.
- **Upstream candidate (GOVERNANCE §23)** — a PKCS#11 / YubiKey `Signer` impl for lanzaboote (§4.1). Clone to
  `../`, PR upstream, never a fork in-tree.
- **Not adopted:** measured boot / `systemd-pcrlock`. It is available in the same module and composes, but it
  needs TPM2, caps generations at 8, and adds a PCR-policy failure mode with its own recovery dance. Sequence
  it after Secure Boot is stable, if at all.

---

## 12. Sources (all read directly, not recalled)

- `github:nix-community/lanzaboote` rev `4a773989235545c56f408d168cb63bc41d468832` — `nix/modules/lanzaboote.nix`,
  `rust/tool/shared/src/signature/{mod,local}.rs`, `rust/tool/systemd/src/cli.rs`, `docs/**`,
  `nix/tests/lanzaboote/{auto-generate-enroll,boot-counting,hash-mismatch-kernel-sb}.nix`
- `github:systemd/systemd` — `man/loader.conf.xml` (setup-mode requirement, `force`, enroll timeout/action),
  `src/boot/secure-boot.c` + `src/boot/secure-boot.h` (`ENROLL_TIMEOUT_DEFAULT = 15`, abort-on-keypress)
- `github:NixOS/nixpkgs/nixos-25.11` (`b6018f87da91d19d0ab4cf979885689b469cdd41`) —
  `pkgs/os-specific/linux/kernel/common-config.nix:820-823`; `sbctl` 0.18; `systemd` 258.7
- `github:Foxboron/sbctl` — `backend/file.go` (RSA-4096), `backend/yubikey.go`, `backend/tpm.go`
- In-repo: `full-ai-cluster/{flake.nix,nixos/modules/*.nix,usb-nixos-installer/zeta-install.sh,nixos/modules/disko-shapes/*}`,
  `infra/nixos/modules/*.nix`, `src/Core.TypeScript/ace/signing.ts`,
  `workitems/081KZETP6AT08QG0R003MG1VYN-*.md`, `GOVERNANCE.md` §23 §24 §35
