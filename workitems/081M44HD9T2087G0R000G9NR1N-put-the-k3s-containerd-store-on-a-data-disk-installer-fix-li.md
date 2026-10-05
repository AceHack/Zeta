---
id: 081M44HD9T2087G0R000G9NR1N
type: task
state: backlog
priority: P2
slug: put-the-k3s-containerd-store-on-a-data-disk-installer-fix-li
title: "Put the k3s containerd store on a data disk (installer fix + live-node cut-over kit)"
created: 2026-10-04T22:44:01.986Z
depends_on: []
composes_with: []
---

# Put the k3s containerd store on a data disk (installer fix + live-node cut-over kit)

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M44HD9T2087G0R000G9NR1N-*.md` glob. -->

Measured 2026-10-05 on `node-5b2dfa`: root is the installer's 120 GiB floor and held the k3s container store at 48 GiB
(132 images, 534k entries) at 22 GiB free, swinging 16-36 GiB while CI ran; the kubelet evicts every pod near 17.7 GiB free.
The two Longhorn data disks beside it were 88% free.

## Scope

1. **Installer** -- a fresh install binds `<largest data disk>/containerd` onto `/var/lib/rancher/k3s/agent/containerd`
   before k3s starts, and k3s refuses to start if that bind is missing (`nixos/modules/containerd-on-data-disk.nix`,
   `containerd-store.sh`, `zeta-install.sh` Step 6.64d). Below a 200 GiB data disk it is inert.
2. **Live node** -- `full-ai-cluster/scripts/move-containerd-to-data-disk.sh` and `docs/ops/CONTAINERD-ON-BIG-DISK.md`: a
   copy-first cut-over with dry-run, rollback and a guarded reclaim. Tested against stubs; **never executed on a node**.

## Done when

- [x] module + guard + installer step + tests (`lint-containerd-store.test.ts`, eval test `containerd-on-data-disk-eval`)
- [x] cut-over kit + stub-world tests (`lint-containerd-move.test.ts`) + runbook
- [ ] the cut-over executed on `node-5b2dfa` (owner/lead), then `reclaim`
- [ ] a reboot of that node with the new generation (proves the unit ordering on a real boot)
