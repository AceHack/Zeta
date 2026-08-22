---
id: 081M0JK4R26087G0R002SVJ5VW
type: bug
state: backlog
priority: P2
slug: zeta-install-sh-treats-a-failed-hardware-configuration-captu
title: "zeta-install.sh treats a failed hardware-configuration capture as a warning and installs the placeholder"
created: 2026-08-21T16:40:53.574Z
depends_on: []
composes_with: []
---

# zeta-install.sh treats a failed hardware-configuration capture as a warning and installs the placeholder

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0JK4R26087G0R002SVJ5VW-*.md` glob. -->

## Symptom

`full-ai-cluster/usb-nixos-installer/zeta-install.sh` partitions, formats and
mounts `longhorn{1..N}`, runs `nixos-generate-config --root /mnt`, then copies
the result over the host's committed `hardware-configuration.nix`. The copy was
guarded by `if [ -f "$HW_SRC" ] && [ -e "$HW_DST" ]`, and the `else` branch
printed one stderr WARN and let the install continue.

Continuing installs the committed placeholder, which declares only `/` and
`/boot`. The Longhorn partitions the installer just created get no `fileSystems`
entry and never mount again on the node.

## Why it compounds

PR #13252 added `full-ai-cluster/nixos/modules/longhorn-node-preflight.nix`, a boot-time refusal
whose must-be-mounted set is DERIVED from the host's own `fileSystems`. On a
placeholder node that set is EMPTY, so the mount check passes with nothing to
check. The silent install-time fallback turned a brand-new guard into a check
that cannot fail.

## The committed placeholders are NOT the bug

`full-ai-cluster/nixos/hosts/control-plane/hardware-configuration.nix` and
`full-ai-cluster/nixos/hosts/worker-gpu/hardware-configuration.nix` are `/`+`/boot` stubs on purpose,
so `nix flake check` can evaluate an unprovisioned host in CI. That state is
correct. The defect was the install-time capture failing quietly.

## Fix (this work item)

1. The capture fails CLOSED, and checks the CONTENT rather than `cp`'s exit
   code: the installed file must declare every Longhorn mountpoint this install
   actually mounted (`LONGHORN_MOUNTS`, derived at the mount step).
2. The one legitimate non-copy -- a disko-shaped host that imports no
   `hardware-configuration.nix` -- is established by READING the host tree, and
   reported as a loud stdout NOTICE naming the boot-time marker to check.
3. Preflight check 1b asks the DISKS: any device carrying a `longhorn*`
   filesystem label (written by this installer's `mkfs.ext4 -L longhornN`) that
   is not mounted under `/var/lib/longhorn` is refused. The empty-required-set
   case is no longer vacuous on a node that HAS Longhorn partitions.

## Falsifiers

- `src/Core.TypeScript/installer/hardware-config-capture.test.ts` -- extracts the
  `ZETA-HWCONFIG-CAPTURE` block from the real installer and runs it under bash.
- `full-ai-cluster/nixos/tests/longhorn-node-preflight-eval-test.nix` -- P2b.
