---
id: 081KSGS9H0008QG0R0011BC7T2
priority: P1
status: open
title: CI cascade #6 — full-install-and-cluster-auto-join (post-boot install completes; node self-registers; eliminates routine human physical USB test) (Aaron 2026-05-26)
effort: L
ask: aaron 2026-05-26
created: 2026-05-26
last_updated: 2026-06-14
depends_on:
  - 081KSGS9H0008QG0R0037H3W4T
  - 081KSGS9H0008QG0R002K93MWX
composes_with:
  - 081KSGS9H0008QG0R000EPPQTR
  - 081KSGS9H0008QG0R003A37Z65
tags: [ci, qemu, cluster-bringup, auto-install, cluster-join, eliminates-human-physical-test, cascade-6]
---

## Progress (2026-07-08 cascade deepen)

- Phase-3 first-session gate now requires **mock identity-auth** markers
  (`identity-auth-mock-*`) or explicit skip coverage — dry-run-only happy
  path no longer counts unless `ZETA_FIRST_SESSION_ALLOW_DRY_RUN_AUTH=1`.
- Live `qemu-full-install-test` runs `assertGeneratedNodeHostnameContract`
  after phase 2 when install generated `node-<6hex>` (Bug 1 regression
  guard wired into the ISO path, not unit-only).
- Post-boot `zeta-self-register` CI dry-run (`ZETA_SELF_REGISTER_MODE=ci-dry-run`
  + `/etc/zeta/qemu-self-register-ci`): phase-3 also requires
  `zeta-self-register: begin|ci-dry-run|complete` + coherent tree-path
  (escape: `QEMU_SELF_REGISTER_ALLOW_MISSING=1` for older ISOs).

## Progress (2026-06-14)

- **Slice 1** landed #8126 — full-install-in-QEMU (081KSNY2Z0008QG0R0008PN7RQ scenario 2 step)
- **Slice 2** landed #8129 — cluster-auto-join payload verification
- **Slice 3** landed #8139 — ArgoCD reconciliation shape verification
- **Pubkey path fix** #8155 — unblocked scenario 2 green on build-iso run 27486800503
- **Scenario 2 hard gate** — `continue-on-error: true` removed (scenario 1 already blocking)

Row stays **open**: overall acceptance (physical USB no longer routine gate; periodic hardware-support sanity-checks) not fully met until 081KSGS9H0008QG0R00120EEHM installer bugs addressed and scenarios 3/4 promoted.

## Problem

Current CI has cascade #5 (QEMU boot smoke-test per
`tools/ci/qemu-boot-test.ts`): asserts the installer ISO boots to the
`zeta-installer login:` prompt. This validates kernel, initrd, getty,
console-output. But it does NOT validate:

- First-boot service fires (`zeta-first-boot.service`)
- `zeta-install` greedy N-disk install completes
- Installed system reboots cleanly
- Auto-generated hostname appears in login banner
- Node self-registers with the cluster (per 081KSGS9H0008QG0R0037H3W4T iter-5.4.1)
- ArgoCD sees the new node + reconciles (per 081KSGS9H0008QG0R002K93MWX iter-5.4.2)

The human maintainer currently physically tests by booting from USB on
real hardware. Operator framing 2026-05-26: *"zflash is the thing plus
cluster auto joining after boot from iso use we want that in ci not
needing human to test everytime."*

Eliminating routine human physical-USB-test as the gate for substrate
landings would unblock multiple downstream cascades and reduce
per-iteration latency dramatically.

## Proposed cascade #6 (full-install-and-join in QEMU)

Three phases, each a separately-shippable slice:

### Slice 1 — full-install-in-QEMU (no cluster join)

Extend `tools/ci/qemu-boot-test.ts` (or add `tools/ci/qemu-full-install-test.ts`):

- Boot QEMU with installer ISO as CD-ROM
- Attach virtual disk as install target (qcow2; e.g., 20 GB; emulates a
  single-NVMe greedy-install target per zeta-install logic)
- Wait for `zeta-first-boot` to fire
- Wait for `zeta-install` to complete (success marker in serial output
  OR /mnt/etc/zeta presence visible via SSH)
- Reboot QEMU; verify installed system comes up to login prompt
- Assert auto-generated hostname appears in login banner (iter-5.2.2
  module)
- Assert cluster substrate is present on the installed disk

### Slice 2 — cluster-auto-join verification (mock cluster control-plane)

After Slice 1 completes, the installed node should attempt cluster
self-registration per 081KSGS9H0008QG0R0037H3W4T iter-5.4.1. Slice 2 adds:

- Mock cluster control-plane in CI (or skip if real cluster API is
  reachable from runner)
- Capture the join attempt's payload shape
- Verify the registration request matches schema
- Verify the new node would be added to
  `maintainers/<operator>/cluster-nodes/<hostname>/...` tree shape per
  081KSGS9H0008QG0R0027HJZYH + 081KSGS9H0008QG0R0037H3W4T per-maintainer convention

This requires either:

- A standalone TS mock server in `tools/ci/mock-cluster-control-plane.ts`
- OR a real cluster endpoint reachable from runner (less safe;
  cluster-side state changes)

Prefer mock; less coupling; more reproducible.

### Slice 3 — ArgoCD reconciliation verification

Once the node registers (Slice 2), ArgoCD watches `maintainers/
cluster-nodes/` tree per 081KSGS9H0008QG0R002K93MWX iter-5.4.2 and reconciles. Slice 3
verifies:

- Mock ArgoCD (or real ArgoCD instance) sees the new node
- Reconciliation produces expected k8s manifest delta
- No failures in reconcile loop

This phase is the most coupled to live cluster state; can be deferred
until Slices 1 + 2 are landed and Slice 3 has a clean isolated test
surface.

## Acceptance

Phased acceptance (each slice ships independently):

- **Slice 1 acceptance**: CI cascade #6 phase 1 step passes on PR
  touching `full-ai-cluster/**`. Step runs in under 10 min total
  (boot, install, reboot, login-verify). Captures full serial console
  as workflow-artifact for debug.
- **Slice 2 acceptance**: CI cascade #6 phase 2 captures + verifies
  cluster-join attempt payload. Mock-cluster substrate is reusable for
  other CI tests (composes with cluster-bringup substrate).
- **Slice 3 acceptance**: CI cascade #6 phase 3 verifies ArgoCD
  reconciliation shape. May be deferred OR run only on push-to-main
  (skipped on PR builds for latency reasons).
- **Overall acceptance**: human physical-USB-test is no longer the
  routine gate for substrate landings; physical test is reserved for
  hardware-specific issues (real-hardware quirks that QEMU doesn't
  emulate) AND for periodic sanity-checks the maintainer chooses to do.

## Composes with

- `tools/ci/qemu-boot-test.ts` (cascade #5; extend OR sibling-script)
- `.github/workflows/build-ai-cluster-iso.yml` (cascade orchestration)
- `full-ai-cluster/usb-nixos-installer/zeta-install.sh` (the install
  flow the test exercises end-to-end)
- `full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh` (the
  auto-fire service)
- `full-ai-cluster/usb-nixos-installer/nixos/installer/configuration.nix`
  (login banner + auto-hostname per iter-5.2.2)
- 081KSGS9H0008QG0R0037H3W4T iter-5.4.1 (node self-registration commit+push to maintainers/
  cluster-nodes; the substrate this CI cascade verifies end-to-end)
- 081KSGS9H0008QG0R002K93MWX iter-5.4.2 (ArgoCD app watches `maintainers/*/cluster-nodes/**` tree per per-maintainer glob)
- 081KSGS9H0008QG0R000EPPQTR (tools/cluster-deregister-node.ts sibling)
- 081KSGS9H0008QG0R003A37Z65 (architectural principle: maximize ArgoCD scope + minimize
  NixOS-native lock-in)
- 081KSGS9H0008QG0R002T3BJ2R (zero-typing first-boot auto-install scope; the substrate
  exercised in CI cascade #6 phase 1)
- 081KSGS9H0008QG0R00033DT02 (isoName mkForce nixpkgs 25.11 regression; orthogonal but
  composes at ISO-naming scope)
- `.claude/skills/flash-cluster-iso/SKILL.md` (Path B 0-human-typing
  flow IS the operator-side analog; this CI cascade IS the CI-side
  analog — eliminates need to flash physical USB just to test)
- The 2026-05-26 USB test gate empirical anchor (PR #5324 +
  179a8d2 ISO build; 2 validated cycles in record; this cascade
  reduces the per-iteration latency)

## Substrate-honest framing

This is a P1 substrate-engineering target with substantial scope. The
3-slice decomposition allows incremental progress; Slice 1 alone delivers
material value (per-PR full-install validation in QEMU; eliminates 80%
of cases where human physical test was needed).

Slice 3 (ArgoCD reconciliation in CI) is the most coupled to live cluster
state and may require additional substrate (mock-ArgoCD OR isolated test
cluster) that itself is substrate-engineering scope.

The substrate-engineering work composes with the broader
"eliminate-human-physical-USB-test-as-routine-gate" direction the
operator named 2026-05-26.

### Physical test BECOMES the hardware-support test (operator 2026-05-26 reframing)

Operator's sharpening: *"yes physcal test become actually hardware
support test"*. Physical USB-test is REFRAMED — not eliminated, not
demoted, but assigned a different scope:

| Test scope | Surface | Validates |
|---|---|---|
| Routine substrate validation | CI cascade #6 (this row) | Install flow + cluster-join shape (QEMU-emulatable) |
| **Hardware-support test** | Physical USB on real hardware | BIOS/UEFI variant compatibility, motherboard NIC drivers, SAS controller support, GPU detection on actual silicon, real-hardware quirks QEMU cannot emulate |

The physical test is no longer the gate-of-last-resort for every
substrate landing; it becomes the **first-class hardware-compatibility-
matrix gate** — fired when (a) onboarding new hardware, (b) iterating on
hardware-specific code paths, (c) periodic compatibility sanity-checks
across the fleet's hardware diversity.

This composes with the broader cluster-bringup substrate-engineering
work: hardware-support-test results inform the hardware-compatibility-
matrix that drives provisioning decisions (which boards/NICs/GPUs
are supported; which need driver substrate; which need to be excluded).

The reframing turns physical-test from "annoying routine gate that
blocks substrate landings" INTO "valuable hardware-compatibility-matrix
substrate that informs cluster-provisioning decisions."

## Operational implication for CI rate-limit + run-time

Slice 1 adds ~5-10 minutes to the build-ai-cluster-iso.yml workflow
(boot + install + reboot + verify). Per the rate-limit operational tiers
discipline, this is a meaningful but bounded addition; PR-build latency
goes from ~current to ~current+10min. Acceptable trade-off for the
elimination of human physical-test as routine gate.

Slice 3 may be deferred to push-to-main (not PR-build) for latency
reasons. Slice 2 should be PR-build-eligible since cluster-join shape
verification is fast (under 1 min after Slice 1 completes).
