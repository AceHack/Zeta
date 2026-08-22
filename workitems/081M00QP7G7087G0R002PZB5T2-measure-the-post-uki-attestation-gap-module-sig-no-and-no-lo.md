---
id: 081M00QP7G7087G0R002PZB5T2
type: task
state: backlog
priority: P3
slug: measure-the-post-uki-attestation-gap-module-sig-no-and-no-lo
title: "Measure the post-UKI attestation gap — MODULE_SIG=no and no lockdown mean the measured chain ends at the kernel"
created: 2026-08-14T18:14:00.967Z
depends_on: []
composes_with: []
---

# Measure the post-UKI attestation gap — MODULE_SIG=no and no lockdown mean the measured chain ends at the kernel

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M00QP7G7087G0R002PZB5T2-*.md` glob. -->
## Why

nixpkgs `nixos-25.11` `pkgs/os-specific/linux/kernel/common-config.nix:820-823` sets
`MODULE_SIG = no` and `SECURITY_LOCKDOWN_LSM = no`. There is no IMA policy in the repo. So any
measured/attested boot on these nodes covers **boot, not runtime**: the chain ends at the UKI and
root can `insmod` anything afterwards.

This is not NVIDIA-specific — it applies to every module and every userspace binary. The
secure-boot doc already states it correctly (§6.1); this item is about deciding whether to close
the gap, and pricing it.

## The open questions

1. **Does the nixpkgs kernel enable `INTEGRITY_PLATFORM_KEYRING` / `LOAD_UEFI_KEYS`?** They are not
   set in `common-config.nix`; whether the upstream defconfig provides them decides the cost. Not
   read during the survey.
2. **NixOS has no shim, so the MOK route other distros use is unavailable.** A module-signing key
   would need embedding at kernel build time via `SYSTEM_TRUSTED_KEYS`, i.e. a custom kernel
   derivation maintained forever against nixpkgs. Price that honestly before committing.
3. **`RANDOM_TRUST_CPU` effective value.** nixpkgs sets it only `whenOlder "6.2"`
   (`common-config.nix:815-817`), so on 25.11 it falls to the defconfig. Probe:
   `zcat /proc/config.gz | grep RANDOM_TRUST` on a node. Bears on §13 noninterference — RDRAND is
   an entropy channel we cannot declare or meter.

## Likely outcome

**Probably "accept the lower rung and say so."** Extending the measured chain past the UKI buys
protection against a local-root adversary who already has the node; the cost is a perpetual custom
kernel. Boot-only attestation with the ceiling stated is probably the right trade. This item exists
so that is a *decision* with a price attached rather than a default nobody looked at.

Prerequisite either way: the nodes need TPM 2.0, which is still open question 4 of
`081M00KTH58087G0R00120WT6F`.

## Anchor

`docs/research/2026-08-14-what-a-full-rewrite-cannot-remove-binding-dependencies-and-the-claims-they-cap.md` §3.2, §4.4, §5.2, §5.3

---

# Measurement (2026-08-17, Otto)

**Read this line before any other.** No boot was measured. No PCR was read. No Linux node was
touched. What was measured is the **kernel `.config` the cluster's own flake resolves to**, read
out of the Nix store as an artifact, plus the evaluated NixOS host configurations that select it.
Every claim below is labelled with which of those it came from, and §8 lists what could not be
reached at all.

## 0. The premise needs correcting before it can be answered

The item asks about the gap **after the UKI**. There is no UKI. Evaluating the live host
configurations from `full-ai-cluster/flake.nix` (the tree `zeta-install.sh` installs from):

```
=== control-plane ===
kernel.version      = 6.12.90
kernel.configfile   = /nix/store/4dq737q0ip6v1py1cqz6g9fw6kfnmkd4-linux-config-6.12.90
kernelParams        = console=ttyS0,115200n8 console=ttyAMA0,115200n8 console=tty1 nomodeset earlycon=uart8250,io,0x3f8,115200n8 loglevel=4 lsm=landlock,yama,bpf
systemd-boot        = enabled
lanzaboote option   = ABSENT (module not imported)
initrd.systemd      = disabled

=== worker-gpu ===
kernel.version      = 6.12.90
kernel.configfile   = /nix/store/4dq737q0ip6v1py1cqz6g9fw6kfnmkd4-linux-config-6.12.90
kernelParams        = console=ttyS0,115200n8 console=ttyAMA0,115200n8 console=tty1 nomodeset earlycon=uart8250,io,0x3f8,115200n8 loglevel=4 lsm=landlock,yama,bpf nvidia-drm.modeset=1 nvidia-drm.fbdev=1
systemd-boot        = enabled
lanzaboote option   = ABSENT (module not imported)
initrd.systemd      = disabled

=== installer ===
kernel.version      = 6.12.90
kernel.configfile   = /nix/store/4dq737q0ip6v1py1cqz6g9fw6kfnmkd4-linux-config-6.12.90
kernelParams        = boot.shell_on_fail root=LABEL=ZETA_INSTALL console=ttyS0,115200n8 console=ttyAMA0,115200n8 console=tty1 nohibernate loglevel=4 lsm=landlock,yama,bpf
systemd-boot        = disabled
lanzaboote option   = ABSENT (module not imported)
initrd.systemd      = disabled
```

So today the chain does not **end** at the UKI — it never **starts**. Nothing is signed, nothing is
measured, and there is no UKI to be after. The gap this item names is a property of a
**proposed** configuration (`081M00KTH58087G0R00120WT6F`), and stating it as a present-tense
property of the cluster would be the overclaim this track exists to prevent.

Two further facts fall out of that same evaluation and both cost money later:

- **`lockdown` is absent from the LSM list.** The effective `lsm=landlock,yama,bpf` is the evaluated
  default (it is set nowhere in the repo's Nix files). It could not contain `lockdown` — the LSM is
  not compiled, per §2.
- **`initrd.systemd = disabled`** on all three. The systemd-stub / `systemd-pcrphase` route to
  measured boot requires the systemd initrd, so closing this gap by that path is a second config
  change, not a flag on the first.

## 1. Method — what "measured" means in this section

- Read the nixpkgs revision the cluster actually builds from, out of `full-ai-cluster/flake.lock`:
  **`b77b3de8775677f84492abe84635f87b0e153f0f`** (`lastModified` = `2026-05-22T16:26:26Z`).
  Note the root `flake.nix` pins `nixos-24.11` and has **no lock file**; `full-ai-cluster/` is the
  live boot path (secure-boot doc §2) and is the tree measured here.
- Evaluated `nixosConfigurations.{control-plane,worker-gpu,installer}` from that flake (output above).
  All three resolve to the **same** kernel-config derivation.
- Fetched that derivation's output from `cache.nixos.org` and read it directly:
  `/nix/store/4dq737q0ip6v1py1cqz6g9fw6kfnmkd4-linux-config-6.12.90`, 12738 lines,
  `sha256 07e7ab540e653ae525bb9992af3f9c552c2d253b185fb535fe271a064d307aa1` (of the symlink target
  as read here). This is the generated `.config` — not a defconfig, not `common-config.nix`, not a
  recollection of either.
- Kconfig semantics (why a symbol is *absent* rather than `n`) read from `torvalds/linux` at tag
  `v6.12`; nixpkgs' structured config read at the pinned rev above.

**This is a configuration measurement, not a boot measurement.** It answers "what will the kernel
be built with", never "what did a node do".

**Reproduce it** (works from macOS; no Linux builder needed, the config is substituted):

```bash
# 1. the derivation this repo's own hosts select — must print the store path in §1
cat > /tmp/zeta-kcfg.nix <<'EOF'
(builtins.getFlake "path:<ABSOLUTE-PATH-TO-REPO>/full-ai-cluster")
  .nixosConfigurations.control-plane.config.boot.kernelPackages.kernel.configfile
EOF
nix eval --impure --raw --file /tmp/zeta-kcfg.nix

# 2. fetch it and read it (--max-jobs 0 => refuse to build; substitute or fail)
nix build --impure --file /tmp/zeta-kcfg.nix --max-jobs 0 --out-link /tmp/zeta-kcfg
grep -E '^(# )?CONFIG_(MODULE_SIG|SECURITY_LOCKDOWN_LSM|KEXEC_SIG|IMA|INTEGRITY_SIGNATURE)\b' /tmp/zeta-kcfg
```

The falsifier is the store path: if a future `flake.lock` bump changes it, every row in §2 is stale
and must be re-read rather than trusted. That is the intended way for this measurement to expire.

## 2. The generated kernel config, probed

Every line below is `grep` output from the artifact named in §1, collected by two probe runs and
merged here with the word `ABSENT` shortened from the probe's longer phrasing; nothing else is
edited. `ABSENT` means the symbol occurs **nowhere** in the generated config — its Kconfig
dependencies were unsatisfied, so it was never offered. That is a stronger statement than
`is not set`.

```
MODULE_SIG                         # CONFIG_MODULE_SIG is not set
MODULE_SIG_ALL                     ABSENT
MODULE_SIG_FORCE                   ABSENT
MODULE_SIG_KEY                     ABSENT
SECURITY_LOCKDOWN_LSM              # CONFIG_SECURITY_LOCKDOWN_LSM is not set
SECURITY_LOCKDOWN_LSM_EARLY        ABSENT
INTEGRITY                          CONFIG_INTEGRITY=y
INTEGRITY_SIGNATURE                # CONFIG_INTEGRITY_SIGNATURE is not set
INTEGRITY_ASYMMETRIC_KEYS          ABSENT
INTEGRITY_PLATFORM_KEYRING         ABSENT
INTEGRITY_MACHINE_KEYRING          ABSENT
LOAD_UEFI_KEYS                     ABSENT
IMA                                # CONFIG_IMA is not set
IMA_APPRAISE                       ABSENT
EVM                                # CONFIG_EVM is not set
SYSTEM_TRUSTED_KEYS                CONFIG_SYSTEM_TRUSTED_KEYS=""
SYSTEM_TRUSTED_KEYRING             CONFIG_SYSTEM_TRUSTED_KEYRING=y
SECONDARY_TRUSTED_KEYRING          # CONFIG_SECONDARY_TRUSTED_KEYRING is not set
SYSTEM_BLACKLIST_KEYRING           # CONFIG_SYSTEM_BLACKLIST_KEYRING is not set
KEXEC                              CONFIG_KEXEC=y
KEXEC_FILE                         CONFIG_KEXEC_FILE=y
KEXEC_SIG                          # CONFIG_KEXEC_SIG is not set
KEXEC_SIG_FORCE                    ABSENT
RANDOM_TRUST_CPU                   ABSENT
RANDOM_TRUST_BOOTLOADER            ABSENT
TCG_TPM                            CONFIG_TCG_TPM=m
TCG_TIS                            CONFIG_TCG_TIS=m
TCG_CRB                            CONFIG_TCG_CRB=m
DM_VERITY                          CONFIG_DM_VERITY=m
DM_VERITY_VERIFY_ROOTHASH_SIG      # CONFIG_DM_VERITY_VERIFY_ROOTHASH_SIG is not set
MODULES                            CONFIG_MODULES=y
MODULE_UNLOAD                      CONFIG_MODULE_UNLOAD=y
MODULE_FORCE_UNLOAD                CONFIG_MODULE_FORCE_UNLOAD=y
DEVMEM                             CONFIG_DEVMEM=y
STRICT_DEVMEM                      CONFIG_STRICT_DEVMEM=y
```

## 3. The gap, stated exactly

**Confirmed as documented:** `MODULE_SIG` is off and `SECURITY_LOCKDOWN_LSM` is off, exactly as
`common-config.nix` says and exactly as secure-boot doc §6.1 quotes. The doc's line citation
(`820-823`) matches the **branch tip** of `nixos-25.11`; at the **pinned rev** the same four lines
are `821-824`. The substance is identical at both; the citation is against a moving branch rather
than the lock, which is worth knowing before anyone re-checks it and thinks it drifted.

**Not previously stated, and strictly stronger than the documented gap:**

> `CONFIG_KEXEC=y`, `CONFIG_KEXEC_FILE=y`, `CONFIG_KEXEC_SIG` **not set**.

§6.1 of the secure-boot doc says "root can `insmod` anything." Root can do more than that: root can
**replace the entire running kernel** with an arbitrary unsigned image via `kexec`, with no
signature check, no reboot, no write to the ESP, and no firmware interaction. `KEXEC_SIG` is the
symbol that would require a signature on `kexec_file_load`, and it is off; the legacy `kexec_load`
syscall is unrestricted regardless, because that restriction is a **lockdown** behaviour and
lockdown is not compiled. A signed-UKI story that says "the kernel that booted is the one we
signed" remains true and becomes irrelevant one `kexec` later.

**The unmeasured surface after the kernel takes control, in full:**

| surface | mechanism that would cover it | measured state |
|---|---|---|
| kernel modules | `MODULE_SIG` | off — `insmod` accepts anything |
| the running kernel itself | `KEXEC_SIG` (+ lockdown for the legacy syscall) | off — `kexec` accepts anything |
| userspace executables | `IMA` / `IMA_APPRAISE` / `EVM` | none compiled; no IMA policy in-repo |
| root filesystem | `DM_VERITY` | module exists, unused; no verity or LUKS anywhere in `full-ai-cluster/nixos/` (grep: no hits for `luks|verity|tpm2|cryptenroll`) |
| enforcement of any of the above under Secure Boot | `SECURITY_LOCKDOWN_LSM` | off, and absent from the runtime `lsm=` list |

So the honest sentence is not "the measured chain ends at the kernel". It is: **there is no measured
chain, and if one is built it will end at the kernel handoff, after which nothing — modules, the
kernel itself, or any userspace byte — is measured, signed, or appraised.**

## 4. Open question 1 — `INTEGRITY_PLATFORM_KEYRING` / `LOAD_UEFI_KEYS`: answered, **no**

Both are **ABSENT**, and the reason matters more than the answer. The dependency chain, read from
`security/integrity/Kconfig` at `v6.12`:

```
config INTEGRITY                     default y                       -> CONFIG_INTEGRITY=y
config INTEGRITY_SIGNATURE           default n                       -> not set
config INTEGRITY_ASYMMETRIC_KEYS     depends on INTEGRITY_SIGNATURE  -> never offered
config INTEGRITY_PLATFORM_KEYRING    depends on INTEGRITY_ASYMMETRIC_KEYS
                                     depends on SYSTEM_BLACKLIST_KEYRING   (also not set)
config LOAD_UEFI_KEYS                depends on INTEGRITY_PLATFORM_KEYRING
                                     depends on EFI
                                     def_bool y                      -> never offered
```

`LOAD_UEFI_KEYS` is `def_bool y` — it *would* switch itself on for free, and never gets the chance,
because two separate dependencies above it are off. The question as posed ("whether the upstream
defconfig provides them decides the cost") resolves to: **it does not.**
`arch/x86/configs/x86_64_defconfig` at `v6.12` contains no `INTEGRITY`, `IMA`, `MODULE_SIG`,
`LOCKDOWN` or `SYSTEM_TRUSTED` line at all — its only security rows are
`SECURITY_NETWORK`, `SECURITY_SELINUX`, `SECURITY_SELINUX_BOOTPARAM`, `SECURITY_SELINUX_DISABLE`.
And nixpkgs' `common-config.nix` sets no `INTEGRITY_*` or `IMA_*` symbol either (grep at the pinned
rev: no matches). Neither layer provides them.

Consequence for the cost estimate: the UEFI-platform-keyring route is **not one flag**. It is
`INTEGRITY_SIGNATURE` + `INTEGRITY_ASYMMETRIC_KEYS` + `SYSTEM_BLACKLIST_KEYRING` +
`INTEGRITY_PLATFORM_KEYRING`, before `LOAD_UEFI_KEYS` becomes reachable, and none of that signs a
module by itself — that still needs `MODULE_SIG`, and enforcement still needs lockdown.

## 5. Open question 2 — pricing the custom kernel, with one sharp edge that was not on the list

Measured inputs to the price:

- `CONFIG_SYSTEM_TRUSTED_KEYRING=y` but **`CONFIG_SYSTEM_TRUSTED_KEYS=""`** — the keyring the
  `SYSTEM_TRUSTED_KEYS` route would use exists and is empty. Nothing to revoke, nothing to inherit.
- nixpkgs states its own reason inline: `MODULE_SIG = no; # r13y, generates a random key during
  build and bakes it in`. Turning `MODULE_SIG` on **without** supplying a key reintroduces exactly
  that: a random per-build key, so two builds of the same input produce different kernels and every
  node's modules are signed by a key nobody holds.
- So the key must be supplied — and that is the edge worth writing down. A key referenced from a Nix
  derivation is a **build input**, and build inputs land in `/nix/store`, whose mode measured on this
  machine is `drwxrwxr-t root:nixbld`: **world-readable.** A module-signing private key taken through
  the ordinary derivation path is therefore readable by every local user on every node that has the
  path. (Labelled honestly: this follows from two measured facts — nixpkgs' comment and the store's
  mode — and is *not* an executed build. Anyone pricing this should try it before believing me.)

Minimum symbol set to actually close the gap, from §2 and §4:
`MODULE_SIG` (+`MODULE_SIG_ALL`/`MODULE_SIG_FORCE`, +`MODULE_SIG_KEY`) · `SECURITY_LOCKDOWN_LSM`
(+`_EARLY`) · `INTEGRITY_SIGNATURE` · `INTEGRITY_ASYMMETRIC_KEYS` · `SYSTEM_BLACKLIST_KEYRING` ·
`INTEGRITY_PLATFORM_KEYRING` (→`LOAD_UEFI_KEYS`) · `KEXEC_SIG` — carried on a kernel derivation
maintained against nixpkgs indefinitely, plus a key-custody answer that the store's permissions make
non-trivial, plus `boot.initrd.systemd.enable = true` for the measurement half, **and it attests to
nothing until a TPM exists** (`081M00KTH58087G0R00120WT6F` open question 4, still open).

Naming the root, per `081M00QP7FB087G0R00031BQ93`: measured boot on these nodes would chain to the
**TPM manufacturer's EK root CA** — a per-vendor self-signed root, not a Zeta-held one. That is the
ceiling on the whole exercise even if every symbol above were turned on: the strongest available
claim is *"the TPM's vendor says this is genuine silicon reporting these PCRs"*. `CONFIG_TCG_TPM=m`
(with `TCG_TIS` and `TCG_CRB`) means the driver is available; no TPM has been observed on any node,
and none exists on the measuring host (§8).

## 6. Open question 3 — `RANDOM_TRUST_CPU`: the proposed probe cannot answer it

**The symbol does not exist in this kernel.** Measured across upstream tags —
occurrences of `RANDOM_TRUST` in `drivers/char/Kconfig`:

| tag | occurrences |
|---|---|
| v6.0 | 2 |
| v6.1 | 2 |
| **v6.2** | **0** |
| v6.6 | 0 |
| v6.12 | 0 |

Removed in 6.2 — precisely the boundary nixpkgs' `whenOlder "6.2"` encodes, which is why that
expression looked like a live setting and is in fact a compatibility shim for kernels we do not run.

**The behaviour did not leave with the symbol.** `drivers/char/random.c` at `v6.12`:

```
821:static bool trust_cpu __initdata = true;
822:static bool trust_bootloader __initdata = true;
...
831:early_param("random.trust_cpu", parse_trust_cpu);
832:early_param("random.trust_bootloader", parse_trust_bootloader);
```

Trust is now **hardcoded on**, overridable only from the kernel command line. The evaluated
`kernelParams` for all three hosts (§0) contain no `random.trust_cpu=` and no
`random.trust_bootloader=`.

> **Therefore: RDRAND is credited for the initial RNG seed on these nodes, unconditionally.**
> The anchor doc §4.4 cell is closed — as **trusted**, not as *unknown*.

And the probe this item proposed — `zcat /proc/config.gz | grep RANDOM_TRUST` — would print
**nothing** and exit non-zero on a 6.12 node. An empty grep reads as "not enabled" while the true
state is "enabled, and not expressible in the config at all". That is the failure shape the repo
already names elsewhere: **a check that did not run looking exactly like one that passed.** It is
recorded here so nobody runs it and concludes the opposite of the truth.

For §13 noninterference this makes the ceiling concrete rather than suspected: the undeclared
entropy channel is not merely un-metered, it is **on by default and cannot be turned off in
desired-state Nix config** — only by a kernel command-line parameter. That parameter is a one-line
change and is deliberately **not** made here: refusing RDRAND at seed time changes early-boot
entropy availability on headless nodes, which is a behavioural change to the live boot path that
cannot be validated from this machine. It is a decision with a real cost on both sides, and it is
Aaron's.

## 7. Observed vs documented — the register table

| claim | register | how |
|---|---|---|
| Kernel is 6.12.90; all three hosts share one `.config` derivation | **OBSERVED (artifact)** | flake evaluation + store path, §0/§1 |
| `MODULE_SIG` off, lockdown off, no IMA/EVM, `KEXEC_SIG` off, `INTEGRITY_PLATFORM_KEYRING`/`LOAD_UEFI_KEYS` absent | **OBSERVED (artifact)** | grep of the generated `.config`, §2 |
| No lanzaboote / no UKI / no verity / no LUKS / no TPM tooling in-repo | **OBSERVED (repo)** | flake evaluation + grep, §0/§3 |
| `RANDOM_TRUST_CPU` removed in 6.2; `trust_cpu` defaults true | **OBSERVED (upstream source at named tags)** | §6 |
| Kconfig dependency chain that makes the integrity symbols absent | **DOCUMENTED** (read from `Kconfig`, not executed) | §4 |
| A signing key routed through a derivation lands world-readable | **DERIVED** from two measured facts; **not executed** | §5 |
| What a node's firmware would extend into PCRs 0–7 | **UNMEASURED** | §8 |
| That any of this is what a node *actually did at boot* | **NOT CLAIMED ANYWHERE** | §8 |

## 8. What could not be measured here, and why

This machine is **macOS 26.5.2, arm64**. There is no Linux node, no TPM, and no booted target.
The repo's own probe, run here:

```
$ bun tools/setup/persona-keys/frost-hardware-probe.ts
[Hardware Security Probe] Result:
  TPM 2.0:            Not found
  YubiKey / token:    Not detected
  Smart-card reader:  None attached
  PKCS#11 module:     Not found
  Secure Enclave:     Present (no seal tier can use it — see header)
  Device present:     NO - a hardware seal tier will THROW here
  Honourable tiers:   (none)
```

(`ls /dev/tpm*` → no matches, as expected on Darwin.) Specifically not measured:

1. **Any real boot.** No PCR was read, no event log parsed, and no running node's procfs kernel
   configuration was opened. Every §2
   row is what the kernel *will be built with*, never what a node *did*.
2. **The kernel binary.** The `.config` was **substituted** from `cache.nixos.org`, not built
   locally — there is no `x86_64-linux` builder here. It is the output of the same derivation a node
   would ask for; it is not a local rebuild of it.
3. **Kconfig at 6.12.90 exactly.** Kconfig text was read at tag `v6.12`; the pinned kernel is a
   stable point release on that line. A `v6.12 → v6.12.90` Kconfig diff was not taken.
4. **Firmware behaviour on the actual boards** — whether a TPM is even present, what it would
   measure into PCRs 0–7, and whether Secure Boot can be enabled. Open question 4 of
   `081M00KTH58087G0R00120WT6F`, untouched by this measurement.
5. **The custom-kernel build.** Not attempted. The price in §5 is an estimate built on measured
   inputs, and is labelled as one.

## 9. Where this leaves the item

The predicted outcome — *"probably accept the lower rung and say so"* — survives the measurement and
is now priced rather than assumed, with three corrections to the questions as asked: the gap is
wider than modules (§3, `kexec`), the platform-keyring route is four symbols rather than one (§4),
and the entropy question's probe was unrunnable (§6).

**No decision is recorded and no code or Nix config is changed by this measurement.** Accepting a
ceiling permanently is a WONT-DO-shaped call and belongs to Aaron; the `random.trust_cpu=0` knob is
a live-boot behavioural change that cannot be validated from here. The state stays `backlog` because
the *decision* the item asks for is still open — the *measurement* it asked for is above.

Docs updated to carry the corrections: the anchor doc §4.4 (cell closed) and §5.2 (`kexec` added),
and the secure-boot doc §6.1 (`kexec` added). Both point here rather than restating.
