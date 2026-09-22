---
id: 081M33XMWME087G0R000825CCB
type: task
state: backlog
priority: P1
slug: wp11-verify-k3s-first-boot-roster-on-the-installed-disk-s-ow
title: "WP11: verify k3s + first-boot roster on the installed disk's own first boot (QEMU)"
created: 2026-09-22T06:42:57.294Z
depends_on: []
composes_with: []
---

# WP11: verify k3s + first-boot roster on the installed disk's own first boot (QEMU)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M33XMWME087G0R000825CCB-*.md` glob. -->

## Gap

`.github/workflows/build-ai-cluster-iso.yml`'s QEMU scenarios stop at serial
markers on the INSTALLER side (`ZETA CLUSTER NODE INSTALL COMPLETE`) or, for
scenario 2, at a login prompt on the installed disk with no network
(`qemu-full-install-test.ts` phase 2). `scenarios.ts` says Kubernetes/ArgoCD
health is out of scope for that lane. `nixos/tests/k3s-first-boot-roster.nix`
proves the k3s modules converge, but boots them directly in a nixosTest
sandbox — never through disko partitioning, `zeta-install.sh`'s host
selection, or the installed `configuration.nix`'s real import graph.

## What this ships

- `full-ai-cluster/nixos/modules/zeta-first-boot-k3s-verify.nix` — a oneshot
  systemd unit, gated OFF by default via `ConditionPathExists`, that runs on
  the installed disk's own first multi-user boot and prints a JSON verdict
  (six named checks: bootedMultiUser, k3sServiceActive, nodeReady, helmJobs
  per rostered chart, rootLanded/ROOT_LANDED, noBadPods) to serial.
- `qemu-full-install-test.ts` phase 3 (`QEMU_K3S_FIRST_BOOT_PHASE=1`) —
  reboots the installed disk with a user-mode NIC, waits for the verdict,
  and fails the run if any of the six checks fails; writes a summary to
  `$GITHUB_STEP_SUMMARY`.
- A new ESP marker `/zeta-qemu-k3s-first-boot-verify` threaded through
  `zflash`'s lib.ts/file-backed.ts/injection-rail.ts/prepare-boot-image.ts,
  and a `zeta-install.sh` probe that stages it onto the install target.
- A new workflow step, dispatch+schedule only (not on the PR path — the
  bring-up this checks is budgeted 45-70 min by the nixosTest lane that
  already asks the same question).

## Status

Landed in the PR that carries this file's first commit. Verdicts + CI run
IDs are recorded in that PR's description.
