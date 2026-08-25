---
id: 081M0WS33AK087G0R000BG9R8X
type: bug
state: backlog
priority: P0
slug: unattended-first-boot-defaults-to-proceed-over-a-data-bearin
title: "unattended first boot defaults to PROCEED over a data-bearing second disk"
created: 2026-08-25T15:37:15.347Z
depends_on: []
composes_with: []
---

# unattended first boot defaults to PROCEED over a data-bearing second disk

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0WS33AK087G0R000BG9R8X-*.md` glob. -->

## The defect

`zeta-first-boot.sh` runs `zeta-install` with `ZETA_AUTO_CONFIRM=WIPE` and `BOOT_DISK=auto`, and
every fixed non-USB disk that is not the boot disk becomes a DATA disk and is wiped
(`wipefs -af` + `sgdisk --zap-all`).

The 2026-08-21 fix gave that a real cancel window: `zeta-install.sh` Step 2.9 counts down
(60 s; 10 s when every in-scope disk probes blank) and any keypress aborts. Verified 2026-08-25 --
the window is real, wall-clock, and its falsifiers are in `disk-preflight.test.ts` and
`disk-preflight-shell-parity.test.ts`. The research doc's "zero-width window" finding is CLOSED.

**What the window did not fix: its default.** `decideWipeScope` returned `cancelDefault = "proceed"`
for every disposition except when the circuit breaker was open. The path this runs on is defined by
nobody being at the keyboard. So on a node with a second disk holding data, the outcome was
unchanged -- destruction, 60 seconds later.

## The fix

The classifier already computes the distinction; the decision now uses it.

| disposition | default | why |
|---|---|---|
| `blank` | PROCEED | nothing to consent to losing |
| `prior-zeta-install` | PROCEED | ours; re-paving is the declared intent of a re-flash |
| `foreign-data` | **ABORT** | data nobody put there for us |
| `indeterminate` | **ABORT** | a disk we could not read; an uncertain enumeration refuses |

One-way: it can turn PROCEED into ABORT, never the reverse. The disk stays IN SCOPE -- the operator
may still destroy it with a keypress. What changed is that the choice has to be made, not defaulted.

The zero-typing property is preserved exactly where it was designed for: a blank box, and a re-pave.

## Cost, stated

A headless install onto a box with a pre-existing foreign partition now stops and waits for a human.
That is the intent. It is the only case where proceeding is both unrecoverable and unwitnessed.

## Falsifiers

- `src/Core.TypeScript/installer/disk-preflight.test.ts` -- four new cases, including that the flip
  is one-way and that blank/prior still proceed.
- `src/Core.TypeScript/installer/disk-preflight-shell-parity.test.ts` -- extracts the bash block from
  `zeta-install.sh` and runs it against the same fixtures. Mutation-checked 2026-08-25: replacing the
  bash guard with `if false` fails "one foreign disk" and "indeterminate disk". Not vacuous.

## Also in this change

- The gate reprints the roster (path / size / transport / model / disposition) at the countdown
  itself. A device the kernel reports no size for forces ABORT.
- `zeta-creds-restore.nix` names its passphrase transport on the success line
  (`transport=qemu-fw_cfg metal-capable=no`), and the QEMU harness refuses a restore that does not.

## Known, NOT fixed here

Step 1's filter is `$5 != "usb"` -- *not known to be USB*, not *known to be internal*. An empty TRAN
column yields a 4-field awk row and the device is admitted. `/dev/vda` is that case, so tightening it
would red the whole QEMU lane. Documented in the bringup runbook, item 6, with the physical
mitigation (unplug external drives before first boot).
