---
id: 081M23BTKZ8087G0R002W6BFCF
type: bug
state: in-progress
priority: P1
slug: t3-wipe-cred-blob-skip-writes-a-durable-marker
title: "T3 WIPE cred-blob skip writes a durable marker"
created: 2026-09-09T15:10:00.000Z
depends_on: []
composes_with: ["081KSKBP80008QG0R003AX2A69"]
---

# T3 WIPE cred-blob skip writes a durable marker

FIRST-METAL T3. `ZETA_AUTO_CONFIRM=WIPE` (exported by
`full-ai-cluster/usb-nixos-installer/zeta-first-boot.sh`) skips the
cred-blob passphrase prompt in `full-ai-cluster/usb-nixos-installer/zeta-install.sh`.
The picker then opts out because `ZETA_CREDS_PASSPHRASE_VAL` is empty.
The skip is one scrolling echo. `full-ai-cluster/PROVISIONING.md` still
presents the seven prompts as the normal first-boot flow. Otto 2026-09-09:
do not prompt on WIPE (nobody to type); remove the silent failure.

## Pre-start checklist

- Substrate-drift: 6.56 already echoes the non-interactive skip.
  QEMU may fill the passphrase from `zeta-qemu-creds-passphrase` AFTER
  6.56. A 6.56 marker would be a false positive when that file later
  fills `ZETA_CREDS_PASSPHRASE_VAL`. Marker belongs at picker skip.
- Prior-art: same named-skip-vs-retry class as T5; restore already
  uses `ConditionPathExists` so a missing blob is a clean no-op, not
  a green that claimed persistence.
- Independent of OpenBao unseal (B7).

## Acceptance

- When picker skips because passphrase is empty AND
  `zeta_install_prompts_enabled` is false AND the skip is not the
  preseeded-blob path: write `/mnt/etc/zeta/CREDS-PERSISTENCE-SKIPPED`
  and echo a distinctive line.
- Do not write the marker if `/mnt/boot/zeta-creds.enc` is already
  preseeded.
- Do not write the marker at Step 6.56 (QEMU fill is later).
- Do not prompt on WIPE/QEMU.
- `full-ai-cluster/PROVISIONING.md` states first-boot WIPE does not
  persist unless qemu passphrase / preseeded blob.
- Guard in `src/Core.TypeScript/ci/test-iter-54-install-flow.test.ts`.
