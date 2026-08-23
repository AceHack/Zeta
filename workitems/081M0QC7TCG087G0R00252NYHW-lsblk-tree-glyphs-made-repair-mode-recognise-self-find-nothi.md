---
id: 081M0QC7TCG087G0R00252NYHW
type: bug
state: backlog
priority: P1
slug: lsblk-tree-glyphs-made-repair-mode-recognise-self-find-nothi
title: "lsblk tree glyphs made repair-mode recognise-self find nothing on every real disk"
created: 2026-08-23T13:16:26.384Z
depends_on: []
composes_with: []
---

# lsblk tree glyphs made repair-mode recognise-self find nothing on every real disk

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M0QC7TCG087G0R00252NYHW-*.md` glob. -->

## The defect

`lsblk -p -n -o NAME,TYPE <disk>` renders NAME as a **tree** and glues UTF-8
box-drawing glyphs onto the device path with **no separating whitespace**, so
`awk '$2=="part" {print $1}'` yields `├─/dev/vda1`, not `/dev/vda1`.

Measured 2026-08-23 against a real GPT disk:

```
$ lsblk -p -n -o NAME,TYPE /dev/vda | cat -A
/dev/vda    disk$
M-bM-^TM-^\M-bM-^TM-^@/dev/vda1 part$
```

Two call sites in `full-ai-cluster/usb-nixos-installer/zeta-install.sh` used
that form:

1. `zeta_pf_gather` (Step 2.5, the R6 pre-format probe)
2. `zeta_pf_recover_identity` (Step 2.7, R4 recognise-self)

## The consequence, in order

Every `blkid` against a glyph-prefixed name returned **empty**. So:

- the probe emitted `part=<glyph+path>|||` for every partition and never a
  `volumelabel=` or an `esp=` record;
- `zeta_pf_classify` saw partitions with no fstype and no label, counted them
  as neither Zeta-owned nor foreign, and returned **`indeterminate`** for a
  disk carrying a complete prior Zeta install;
- `zeta_pf_decide_scope` therefore never set `mode=repair`, so **Step 2.7 never
  ran on any real hardware**;
- and `zeta_pf_recover_identity`, had it run, would have `continue`d over every
  partition and reported nothing found.

Net: a re-paved node drew a **new random hostname while keeping its NIC** —
HWR-2, two roster registrations on one MAC, which is the exact failure the R4
block was written to prevent. The R8 creds carry-forward seam never fired
either, for the same reason (no `esp=` record).

## Why nothing caught it

This is the vacuity class in its structural form. `disk-preflight.ts` and
`disk-preflight-shell-parity.test.ts` hand **fact records** straight to
`zeta_pf_classify`, so they proved the classifier right about facts the
**prober could never gather**. Both halves were tested; the seam between them
was not, because nothing in CI had ever pointed the prober at a real disk.

## The fix

`-l` (LIST output, no tree) at both sites.

## Falsifier

`src/Core.TypeScript/installer/repair-mode-existing-install.test.ts` builds a
real GPT disk on a loop device with real ext4 filesystems and a real
`/etc/zeta` tree, then runs the extracted `zeta_pf_gather` /
`zeta_pf_recover_identity` against it. Reverting `-l` turns **6 of its 11
tests** red, including `the FULL chain runs: probe -> classify -> mode=repair`.
Lane: `.github/workflows/installer-repair-mode-existing-install.yml`.
