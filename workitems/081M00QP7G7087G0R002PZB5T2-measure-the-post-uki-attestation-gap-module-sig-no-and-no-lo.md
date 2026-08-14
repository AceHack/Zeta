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
