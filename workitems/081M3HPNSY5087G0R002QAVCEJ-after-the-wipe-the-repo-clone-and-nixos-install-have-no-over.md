---
id: 081M3HPNSY5087G0R002QAVCEJ
type: bug
state: backlog
priority: P2
slug: after-the-wipe-the-repo-clone-and-nixos-install-have-no-over
title: "After the wipe, the repo clone and nixos-install have no overall time bound"
created: 2026-09-27T15:10:29.317Z
depends_on: []
composes_with: ["081M3BWJ96T087G0R0028WT3S3"]
---

# After the wipe, the repo clone and nixos-install have no overall time bound

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M3HPNSY5087G0R002QAVCEJ-*.md` glob. -->

## The condition

Found by the first-boot dependency inventory (081M3BWJ96T087G0R0028WT3S3,
`docs/ops/FIRST-BOOT-EXTERNAL-DEPENDENCIES.md` rows 5 and 6). Read from source, not
measured.

Both happen **after** the disks are wiped:

1. `sudo git clone "$REPO_URL" /mnt/etc/zeta`
   (`full-ai-cluster/usb-nixos-installer/zeta-install.sh:2360`) has no `timeout` and
   no `GIT_TERMINAL_PROMPT=0`. The `git ls-remote` preflight seconds earlier covers
   "no network", not a stall mid-clone. Left untouched by the inventory PR because it
   sits next to the repo-pin block another agent owns.
2. `nixos-install` (`:3968`) bounds each download (`connect-timeout 10`,
   `stalled-download-timeout 60`, `download-attempts 3`) but not the whole run, and a
   failure fetching `github:` flake inputs (not baked into the ISO) surfaces as Nix's
   own error plus `Install failed (rc=N)` from `zeta-first-boot.sh`. The binary cache
   half of this is now a named preflight refusal (B6); the flake-input half is not.

## Direction

- `timeout` + `GIT_TERMINAL_PROMPT=0` on the clone, same shape as the pin fetch at `:2387`.
- Bake the flake inputs into the ISO store (or pre-fetch them before the wipe) so
  `nixos-install` needs only the binary cache, which is now probed.
