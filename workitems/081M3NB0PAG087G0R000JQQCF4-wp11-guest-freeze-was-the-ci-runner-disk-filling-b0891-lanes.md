---
id: 081M3NB0PAG087G0R000JQQCF4
type: bug
state: backlog
priority: P2
slug: wp11-guest-freeze-was-the-ci-runner-disk-filling-b0891-lanes
title: "WP11 guest 'freeze' was the CI runner disk filling: B0891 lanes leave ~38 GiB of images, QEMU pauses the guest on ENOSPC"
created: 2026-09-29T01:03:40.880Z
depends_on: []
composes_with: []
---

# WP11 guest 'freeze' was the CI runner disk filling: B0891 lanes leave ~38 GiB of images, QEMU pauses the guest on ENOSPC

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3NB0PAG087G0R000JQQCF4-*.md` glob. -->

## Evidence (run 36420588893, job build-iso)

- WP11 serial ends at `roster progress t=331s sample=5`; phase 3 began 14:11:12.
- Job log, 14:17:12: `You are running out of disk space ... Free space left: 0 MB`.
- `after phase 1 (install) ... runner free: 14.3 GiB` for WP11, vs 52-55 GiB for every
  earlier QEMU lane in the same job. Between them ran the dispatch-only B0891 scenario 3/4
  lanes, whose qcow2 / boot images stay in `b0891-*-run/`.
- QEMU's virtio default `werror=enospc` stops the VM on a host ENOSPC, so the guest
  printed nothing (no OOM, no hung-task, no pressure diagnostics) -- paused, not frozen.
- Run 36381850496 (no freeze) was an `only_wp11` dispatch: no B0891 lanes, 53.6 GiB free.

## Fix

- Workflow: reclaim B0891 images (logs kept) and preinstalled SDKs before WP11.
- Harness: runner free space on every phase-3 progress line; below 256 MiB the phase
  fails with a named RUNNER DISK EXHAUSTED reason instead of a 75-minute timeout.
- Real nodes (hardening, not the cause): zeta-dev-toolchain moves out of the
  k3s-protected system.slice into a cgroup-idle, memory-capped zeta-background.slice.
