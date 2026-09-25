---
id: 081M3CAJD7J087G0R0021H6WRS
type: bug
state: backlog
priority: P2
slug: the-reformat-with-retention-and-path-fork-lanes-refuse-pre-w
title: "The reformat-with-retention and path-fork lanes refuse pre-wipe on a 20 GiB disk and then dead-wait the full 30-minute marker timeout"
created: 2026-09-25T13:02:42.930Z
depends_on: []
composes_with: []
---

# The reformat-with-retention and path-fork lanes refuse pre-wipe on a 20 GiB disk and then dead-wait the full 30-minute marker timeout

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3CAJD7J087G0R0021H6WRS-*.md` glob. -->

## The measurement

Serial-log artifacts from `build-ai-cluster-iso` run **36097366591** (`workflow_dispatch`,
branch `wp29/final-esp-verification`), artifacts `b0891-retention-serial-logs` and
`b0891-path-fork-serial-logs`. Both are ~2.7 KB — a full install produces ~76 KB.

```
Internal storage devices (fixed; USB and hot-plug bays excluded):
  /dev/vda              HDD        20G    serial=

ERROR: BOOT disk /dev/vda is 20 GiB, which cannot hold ESP 1 GiB + root floor 120 GiB
+ a 1 GiB minimum longhorn1 tail (need >= 122 GiB). ... Nothing has been wiped. ...
(3) install anyway on a MINIMUM 1 GiB tail with ZETA_ALLOW_LONGHORN_UNDERSIZED=1 ...

[zeta-first-boot] Install failed (rc=1). See output above.
[zeta-first-boot] Dropping to interactive shell.
```

Scenario 4's `scenario4.bootstrap.serial.log` carries the byte-identical refusal.

## What it is NOT

**Not the 1400 GiB disk of #17631, and not a slow reformat.** The retention and path-fork
harness has its own disk constant — `DEFAULT_DISK_SIZE_GB = 20` in
`src/Core.TypeScript/zflash/test-harness/qemu-state.ts`, unchanged since the harness was
first committed (`6c8dd6a876`, #6220) — and nothing in the tree passes `diskSizeGB`.
`QEMU_DISK_SIZE_GB = 1400` lives in `src/Core.TypeScript/ci/qemu-full-install-test.ts` and
is reached only by the plain-install lanes, which is exactly why those pass and these two
do not. There is nothing to time: `mkfs` is never reached, because nothing is ever wiped.

## Root cause

#17616 added a pre-wipe root-floor refusal. The plain-install lanes were unblocked twice —
first by staging `ZETA_ALLOW_LONGHORN_UNDERSIZED=1` on the flashed image's ESP (#17618),
then by #17631 giving them a disk the roster genuinely fits on. These two lanes were
unblocked **neither** time. `allowLonghornUndersized` has been threaded
`lib.ts` → `file-backed.ts` → `prepare-boot-image.ts` since #17618 and nothing ever set it.

## Second, separable defect: the 30 minutes is dead wait, not work

The refusal lands ~2.5 minutes in (30 s DHCP + 90 s ethernet + 30 s discovery probe). The
harness then waits out the remaining ~27 minutes of its 1,800,000 ms marker timeout — about
55 runner-minutes per dispatch across the two scenarios. `nixos@zeta-installer:~` is already
a terminal marker and **is** present, but the wait loop suppresses that one marker while
`serialFirstBootInProgress` holds, and it holds forever once `[3/3] Running zeta-install`
has printed. The suppression is correct; its cost is that a first boot which reached the
shell *because it failed* looked identical to one still working. Same failure class as
081M24BB3TD087G0R001PJTW9A, arriving through a different door.

## Fix

1. Derive the override from the harness disk instead of hardcoding it:
   `harnessDiskNeedsLonghornOverride()` compares `DEFAULT_DISK_SIZE_GB` against the
   installer's own `ZETA_ESP_GIB + ZETA_ROOT_FLOOR_GIB + ZETA_LONGHORN_MIN_TAIL_GIB`.
   Raise the disk past the floor and the override disarms itself.
2. Add `[zeta-first-boot] Install failed (rc=` to `RETENTION_ABSENT_TERMINAL_MARKERS`, so
   any future guest-side refusal costs ~3 minutes instead of ~30.

Falsifiers in `src/Core.TypeScript/zflash/test-harness/longhorn-floor.test.ts`, including a
replay of the measured serial output. Four of the ten fail when either fix is reverted.

**Not** raising the timeout and **not** resizing the disk: the disk is right for what these
lanes test (partitioning, retention, migrate-vs-fresh — mechanics, not capacity), and the
timeout was never the constraint.

## Out of scope, found in the same log

`zeta-cluster-discover: discovery could not run (browser-error: avahi-browse exited 1:
avahi-browse: unrecognized option '--no-db-lookup')`. Bootstrap-or-join discovery has never
run in these lanes; it falls back to the ISO default role every time. The harness says so
honestly ("This is a check that did not run, NOT a check that passed"), but the flag is
wrong against the shipped avahi and the discovery path is unmeasured.
