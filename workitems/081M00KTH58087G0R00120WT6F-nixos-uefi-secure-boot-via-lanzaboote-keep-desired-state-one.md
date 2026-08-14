---
id: 081M00KTH58087G0R00120WT6F
type: task
state: backlog
priority: P2
slug: nixos-uefi-secure-boot-via-lanzaboote-keep-desired-state-one
title: "NixOS UEFI Secure Boot via lanzaboote: keep desired-state, one BIOS setup-mode ceremony per node"
created: 2026-08-14T17:06:27.624Z
depends_on: []
composes_with: []
---

# NixOS UEFI Secure Boot via lanzaboote: keep desired-state, one BIOS setup-mode ceremony per node

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M00KTH58087G0R00120WT6F-*.md` glob. -->

## Status: RESEARCH landed, BLOCKED on human sign-off

Design doc:
`docs/research/2026-08-14-nixos-secure-boot-lanzaboote-declarative-desired-state-with-one-firmware-ceremony.md`

No boot configuration changed. Nothing lands until Aaron answers the seven numbered
open questions in §9 of the doc (round-29 discipline: no CI/boot decision lands
without human sign-off).

### Answer in one line

Lanzaboote keeps NixOS fully declarative. Every signing decision is a `boot.lanzaboote.*`
option in the flake. Exactly one step is irreducibly imperative: putting each machine's
firmware into UEFI Setup Mode from the BIOS menu. That cannot be automated because
deleting the Platform Key requires an authenticated variable update signed by the OEM's
PK private key, which we do not have — a UEFI spec property, identical under every OS.
Effort: ~1 engineer-day of config plus one QEMU/OVMF CI scenario, plus ~15 minutes of
firmware ceremony per node.

### Findings that decide the design

- **GPU / out-of-tree modules: nothing breaks.** nixpkgs ships `MODULE_SIG = no` and
  `SECURITY_LOCKDOWN_LSM = no` (`pkgs/os-specific/linux/kernel/common-config.nix:820-823`),
  so Secure Boot never forces module signing. The proprietary NVIDIA driver loads
  unchanged; `gpu.nix` needs zero edits. Honest counterpart: the chain of trust ends at
  the UKI, it does not seal the running kernel.
- **Decentralization holds.** `autoGenerateKeys` makes each node generate its own
  PK/KEK/db. No fleet CA, no escrow, no central signing authority. Falls out of the
  default config.
- **ace is not the same crypto shape.** ace is Ed25519 over canonical JSON; UEFI db is
  X.509 + PE/COFF Authenticode (sbctl generates RSA-4096). Ed25519 is not a UEFI
  signature type. They share a *policy* shape (trust roots + revocation: db/dbx), not a
  mechanism. Do not build a bridge.
- **Headless recovery is the gate, not the config.** Every upstream recovery path starts
  with "disable Secure Boot in firmware." `bootCounting.initialTries` self-reverts a bad
  generation without a site visit, but firmware-level rejection has no software remedy.
  Blocked on whether the nodes have BMC/IPMI (open question 2).
- **Reported conflict, not resolved:** working NVIDIA option ROMs effectively require the
  Microsoft UEFI CA in `db`, which imports an external centralized authority and weakens
  what Secure Boot buys. Possible per-host split (control-plane without MS keys) depends
  on open question 3.
- **Unikernel path costed and rejected for cluster nodes:** signing a unikernel is trivial;
  running k3s, containerd, Longhorn/iSCSI and the NVIDIA driver on one is a multi-quarter
  re-implementation, and the NVIDIA driver is a Linux kernel module that will never load.
  Legitimate narrow lane for single-purpose appliances only.

### Pre-existing debt this surfaced (separate items, not fixed here)

- Duplicate NixOS trees: `infra/nixos/` (24.11) vs `full-ai-cluster/nixos/` (25.11).
  `zeta-install.sh` installs the latter; the former is stale.
- `configurationLimit` unset on a 1 GiB ESP means unlimited generations on the ESP —
  a latent disk-full failure today, independent of Secure Boot.
