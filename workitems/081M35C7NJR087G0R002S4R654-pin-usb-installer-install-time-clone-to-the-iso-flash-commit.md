---
id: 081M35C7NJR087G0R002S4R654
type: task
state: in-progress
priority: P1
slug: pin-usb-installer-install-time-clone-to-the-iso-flash-commit
title: "Pin USB installer install-time clone to the ISO/flash commit, not remote default-branch HEAD"
created: 2026-09-22T20:17:07.160Z
depends_on: []
composes_with: []
---

# Pin USB installer install-time clone to the ISO/flash commit, not remote default-branch HEAD

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M35C7NJR087G0R002S4R654-*.md` glob. -->

`zeta-install.sh` ran `sudo git clone "$REPO_URL" /mnt/etc/zeta` with no ref, so the
installed system was always built from the remote's default-branch HEAD at install
time — never the commit the ISO (or a zflash-prepared medium) was actually built
from and tested against. Two consequences: a PR's NixOS-module changes were
unprovable on the real install path before merge, and a USB flashed on day X
installs whatever `main` is on day Y in the field.

Fix (PR #17541, branch `claude/pin-install-to-iso-commit`):
- `full-ai-cluster/flake.nix` + the installer `configuration.nix` embed the exact
  commit `nix build .#installer-iso` evaluated from (`self.rev`) into
  `/etc/zeta-iso-provenance` as `ZETA_ISO_COMMIT`.
- An ESP-written `/zeta-repo-pin` (new `repoPinCommit` field on
  `planFileBackedZflashImage`) overrides it, same "ESP wins over ISO" shape the
  role conf already uses.
- `zeta-install.sh`'s new `ZETA-REPO-PIN` block validates the pin (40-hex or
  refuse) and, after the clone, fetches + checks out that exact commit. Fails
  closed on a present-but-unhonourable pin unless `ZETA_ALLOW_REPO_DRIFT=1`.
- `qemu-full-install-test.ts` sets the ESP pin to the workflow's own commit
  (`GITHUB_SHA`) whenever the WP11 k3s-first-boot-verify lane runs, and asserts
  the installed disk's own `[repo-pin] honoured: HEAD is now <sha>` serial line
  matches it — proving a branch-only change reaches the real install path.

Pure decision logic lives in `src/Core.TypeScript/installer/repo-pin.ts`, checked
for shell/TS parity by `repo-pin-shell-parity.test.ts`.
