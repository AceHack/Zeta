---
id: 081M0WTB5MN087G0R001WA07PC
type: bug
state: backlog
priority: P2
slug: uefi-keyfile-restore-blob-not-on-phase-2-esp-and-the-conditi
title: "UEFI keyfile restore: blob not on phase-2 ESP and the ConditionPathExists skip hides which path is missing"
created: 2026-08-25T15:59:08.437Z
depends_on: []
composes_with: []
---

# UEFI keyfile restore: blob not on phase-2 ESP and the ConditionPathExists skip hides which path is missing

## Symptom

The post-#15222 restore dispatch
([run 32816110015](https://github.com/Lucent-Financial-Group/Zeta/actions/runs/32816110015),
SHA `6850d651`) still fails: `UEFI keyfile restore decrypt` red and
`UEFI keyfile picker bind` red. The restore serial shows phase-2 booting all
the way to the login banner with **no `zeta-creds-restore:` line at all** — the
service did not run, it was skipped.

## Root cause — two layers

### Layer 1 — the skip is invisible (diagnosability)

`full-ai-cluster/nixos/modules/zeta-creds-restore.nix` gates the unit with:

```nix
unitConfig.ConditionPathExists = [ cfg.blobPath cfg.usbUuidPath cfg.scriptPath bunShimPath ];
```

- `blobPath` = `/boot/zeta-creds.enc`
- `usbUuidPath` = `/etc/zeta/usb-uuid`
- `scriptPath` = `/home/zeta/Zeta/src/Core.TypeScript/installer/zeta-creds-restore.ts`
- `bunShimPath` = `/home/zeta/.local/share/mise/shims/bun`

If **any** is absent, systemd skips the unit with **zero serial output**.
#15346 made the CI contract report "check these four paths", but the test only
sees the serial, so it cannot say **which** path is missing. That is the wall:
the fix cannot be targeted until the guest names the absent path.

### Layer 2 — delivery (hypothesis, pending Layer 1)

#15222 fixed the EACCES: persist now writes `/tmp` (serial:
`zeta-creds-persist: wrote 132 bytes to /tmp/zeta-creds.enc` +
`binding-factor uefiKeyfile -> /tmp/zeta-creds.factor`), then
`zeta-install.sh` runs `sudo install -m 0600 "$PICKER_TMP" /mnt/boot/zeta-creds.enc`.
The blob is nonetheless absent (or a sibling path is) at restore time. Candidates:

- the `sudo install` onto `/mnt/boot` does not land, or `nixos-install`/disko
  does not carry `/mnt/boot/zeta-creds.enc` through to `/boot`;
- `scriptPath` (repo at `/home/zeta/Zeta`) or `bunShimPath` (mise bun) is not yet
  present when the service is evaluated on first boot (ordering vs the clone/mise
  step), so even a delivered blob would still skip.

## Fix plan (ranked)

1. **Diagnosability (do first — unblocks everything).** Move the four existence
   checks out of `unitConfig.ConditionPathExists` and into the `ExecStart`
   script, logging each absent path to serial
   (e.g. `zeta-creds-restore: MISSING <path>; skipping`) before exiting 0. Same
   skip semantics, now legible. Add the marker to
   `src/Core.TypeScript/ci/qemu-full-install-test.ts` and surface the named path
   in `assertUefiKeyfileRestoreContract`. One dispatch then pinpoints the path.
2. **Delivery fix (depends on 1).** Fix whichever path 1 names — most likely the
   `/mnt/boot`→`/boot` blob carry or the repo/bun ordering on first boot.
3. **Picker bind (#2 contract).** Its phase-2 serial ends at boot with no persist
   markers; re-read once diagnosability lands.

## Verification

Dispatch `build-ai-cluster-iso.yml --ref main` (workflow_dispatch; restore steps
are dispatch-only), read `qemu-uefi-keyfile-restore-serial.log`, and require
`assertUefiKeyfileRestoreContract` green. Cloud agents dispatch via
`GH_TOKEN="$ZETA_WORKFLOW_DISPATCH_TOKEN" gh workflow run …` when the group is idle
(see `docs/cloud-agent-workflow-dispatch-token.md`).

## Coordination

`zeta-creds-restore.nix` and `zeta-install.sh` are under active edit in open
[#15370](https://github.com/Lucent-Financial-Group/Zeta/pull/15370)
(passphrase-transport honesty + data-bearing-disk cancel window — a different
bug, and it does not touch the blob path). Land the Layer-1 change coordinated
with or after #15370 to avoid churn (GOVERNANCE §35). Already landed:
#15346 (skip-diagnosis test-side + ENOSPC), #15222 (EACCES persist → /tmp).

## Update 2026-08-26 — Layer-1 landed, root cause corrected, Layer-2 fix

Layer-1 landed (#15374). A `workflow_dispatch` verification run
([32873212247](https://github.com/Lucent-Financial-Group/Zeta/actions/runs/32873212247),
built from the fix commit) then **corrected the diagnosis**: phase-2 carried
**zero** `zeta-creds-restore` runtime lines — not even the new
`MISSING precondition` logging — so the unit was not skipping on a precondition,
it was **failing before `ExecStart` ran at all**. The service is enabled by
default (`common.nix`: `zeta.credsRestore.enable = lib.mkDefault true`), so the
only remaining pre-`ExecStart` filesystem dependency is
`serviceConfig.WorkingDirectory = cfg.repoRoot` (the cloned repo). When that
directory is absent as the unit fires (`After = local-fs.target`, early), systemd
fails the unit at chdir before `ExecStart`, and every log line — including the
precondition gate — is unreachable. This is NOT the blob-delivery bug the title
hypothesised; that hypothesis was one layer too shallow.

Fix (Layer-2): `WorkingDirectory = "/"` (the `ExecStart` uses absolute paths, so
cwd is irrelevant and `/` never fails the chdir), plus an unconditional
first-line marker `zeta-creds-restore: ExecStart entered` so a pre-`ExecStart`
failure is distinguishable from a precondition exit on the serial. Repo/script
presence is still named by the precondition gate once `ExecStart` runs.
Falsifiers added in `qemu-full-install-test.test.ts`
(`execStartEntered` marker + `WorkingDirectory = "/"` drift guards).

Next verification: dispatch and confirm the phase-2 serial now shows
`ExecStart entered` — then either restore completes, or the precondition gate
NAMES the next missing path (e.g. `/boot/zeta-creds.enc` if blob delivery is the
next layer). #15370 has since MERGED, so there is no longer a coordination hold.

