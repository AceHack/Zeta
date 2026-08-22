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

## Status: RESEARCH landed + the desired-state MODEL landed; still BLOCKED on human sign-off

Design doc:
`docs/research/2026-08-14-nixos-secure-boot-lanzaboote-declarative-desired-state-with-one-firmware-ceremony.md`

No boot configuration changed. Nothing that touches a boot path lands until Aaron
answers the seven numbered open questions in §9 of the doc (round-29 discipline: no
CI/boot decision lands without human sign-off).

### Increment 1 (2026-08-17) — the one-desired-state half, with the boot half still gated

Landed, and none of it signs, enrols, or verifies anything:

- `full-ai-cluster/nixos/modules/secure-boot-phase-model.nix` — the single source of
  truth: a phase enum (`off` / `provision` / `enforce`), a pure `derivePlan` that
  derives every other setting from it, and `assess`, which compares a declared phase
  against an OBSERVED firmware state. Firmware is a measurement, never a declaration
  (§3.2), so "unmeasured" is its own outcome and cannot read as "agree".
- `full-ai-cluster/nixos/modules/secure-boot.nix` — the option surface
  (`zeta.secureBoot.phase`, default `off`; `zeta.secureBoot.plan`, read-only/derived).
  Imported by `common.nix`, sets **no** `boot.*` option at any phase, and **fails
  closed** on any phase other than `off`, naming §9 Q2/Q3/Q4/Q5/Q6 as the blocker.
- `full-ai-cluster/nixos/tests/secure-boot-desired-state-eval-test.nix` — 18 properties,
  forced during evaluation by `checks.<system>.secure-boot-desired-state-model`, so
  `nix flake check --no-build` (already in `build-ai-cluster-iso.yml`) runs them.

UNVERIFIED and untouched: lanzaboote itself (no flake input), signing, key generation,
enrolment, the firmware ceremony, and every claim about how a real node boots. No
hardware was booted; no `nixos-rebuild` evaluated any of this.

Still blocked, and deliberately not chosen by an agent: **key custody** — where the
PK/KEK/db private keys live at rest, whether Microsoft's UEFI CA enters `db`, and
whether enrolment/signing is operator-approved. §9 Q3/Q4/Q5 are the questions; §6.4 is
the reason Q4 is the sharp one (a db key on unencrypted ext4 defeats Secure Boot
against a physical adversary regardless of what the config says).

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
