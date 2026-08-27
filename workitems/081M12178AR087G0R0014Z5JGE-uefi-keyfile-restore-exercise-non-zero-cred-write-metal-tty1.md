---
id: 081M12178AR087G0R0014Z5JGE
type: task
state: backlog
priority: P2
slug: uefi-keyfile-restore-exercise-non-zero-cred-write-metal-tty1
title: "UEFI keyfile restore: exercise non-zero cred write + metal tty1 path"
created: 2026-08-27T16:35:32.312Z
depends_on: []
composes_with: []
---

# UEFI keyfile restore: exercise non-zero cred write + metal tty1 path

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M12178AR087G0R0014Z5JGE-*.md` glob. -->

## Context

The UEFI keyfile restore lane is green in CI (081M0WTB5MN), but the green has two
named boundaries recorded in `docs/uefi-keyfile-restore-metal-path.md`:

1. **Non-zero write is vacuous in-guest.** The QEMU picker bakes 0 creds, so
   restore reports `wrote 0 creds`. Decrypt + bind are proven; the write/chown
   path is not exercised. `restoreExercisedWritePath()` in
   `src/Core.TypeScript/ci/qemu-full-install-test.ts` returns `false` on the lane
   today, by design, to keep the vacuity legible.
2. **Metal `tty1` path is unverified.** `fw_cfg` does not exist on hardware; the
   `systemd-ask-password` path has never run in CI.

## Plan

- **Non-zero write (CI-verifiable):** bake ≥1 deterministic test credential in
  the `QEMU_UEFI_KEYFILE_RESTORE` picker scenario (installer + workflow), then
  tighten the contract to require `restoreExercisedWritePath() === true` for that
  scenario (assert `wrote >= 1`), while still allowing `wrote 0` / `already-present`
  on the idempotent re-run scenario. Verify via a `main` dispatch of
  `build-ai-cluster-iso.yml` (nixos modules build from main; ~45 min restore step).
- **Wrong-passphrase / wrong-device refusal in-guest:** add a negative sub-check
  asserting decrypt REFUSAL on serial (unit-tested already; lift to in-guest).
- **Metal `tty1`:** execute the hardware runbook in
  `docs/uefi-keyfile-restore-metal-path.md` §1 and land the captured evidence
  under `docs/hygiene-history/`.

## Acceptance

- QEMU restore scenario asserts `wrote >= 1` on the bake path (green on a `main`
  dispatch).
- Metal runbook executed once with captured serial + wrong-passphrase refusal;
  evidence linked from the metal-path doc.
