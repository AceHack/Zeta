# Riven — USB/zflash QEMU restore next (2026-08-24)

**For:** the next Riven (Cursor) session on the
[`usb-zflash-installer`](../trajectories/usb-zflash-installer/RESUME.md)
workstream.
**Clone:** `/Users/acehack/.zeta/agents/cursor` only. Never edit
`~/Documents/src/repos/Zeta` (shared VIEW). GOVERNANCE.md §35.
**Register:** measurements below are dated. No metal claim.

Cold-boot: `CURSOR.md` → this file (linked from the trajectory RESUME).

---

## 0. Headline

Mise-trust is **on `main`** ([#14353](https://github.com/Lucent-Financial-Group/Zeta/pull/14353)).
Picker `--defer-all` is **on `main`**
([#14852](https://github.com/Lucent-Financial-Group/Zeta/pull/14852)) —
that was the hang on [run 32724820159](https://github.com/Lucent-Financial-Group/Zeta/actions/runs/32724820159).

Do **not** re-litigate `MISE_TRUSTED_CONFIG_PATHS`. Do **not** re-dispatch
ISO until `build-ai-cluster-iso.yml` is idle. Next software slice is P1:
sibling dispatch QEMU steps must keep running when restore is red.

---

## 1. What already landed (do not redo)

Squash: [PR #14353](https://github.com/Lucent-Financial-Group/Zeta/pull/14353)
→ `2690c456` on `main` (2026-08-23T18:17Z).

| Surface                                                                | What it does                                                                                                                                                                      |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `full-ai-cluster/usb-nixos-installer/zeta-install.sh` 6.95-picker sudo | `MISE_TRUSTED_CONFIG_PATHS="$ZETA_HOME/Zeta"` (wifi / iSerial / keyfile already had this; picker did not)                                                                         |
| `tools/setup/common/shellenv.sh`                                       | emits the same export **before** `mise activate`                                                                                                                                  |
| `full-ai-cluster/nixos/modules/common.nix` profile.d                   | `export MISE_TRUSTED_CONFIG_PATHS="$_zeta_repo"` before activate                                                                                                                  |
| `full-ai-cluster/nixos/modules/zeta-first-session.nix`                 | export before `mise install`                                                                                                                                                      |
| `.github/workflows/build-ai-cluster-iso.yml`                           | restore QEMU immediately after scenario 2; job timeout `fromJSON(... && '240' \|\| '180')`                                                                                        |
| `zeta-creds-picker.ts` + install.sh 6.95                               | `--defer-all` when stdin is not a TTY or `QEMU_PP_FILE` is set ([#14852](https://github.com/Lucent-Financial-Group/Zeta/pull/14852)). HC-8: empty bake is defer, never auto-bake. |
| hoist lint                                                             | matches the `process.env` **key**, not `TOKEN` in a dummy value                                                                                                                   |

Falsifiers: `src/Core.TypeScript/ci/test-iter-54-install-flow.test.ts`,
`full-ai-cluster/nixos/modules/mise-node-path-wiring.test.ts`,
`src/Core.TypeScript/ci/qemu-full-install-test.test.ts` (ISO order + fromJSON).

Trailer for this lane: `Task: usb-zflash-installer`.
`Co-authored-by: Grok <noreply@x.ai>`.
Enums: `Human-Review: explicit`, `Human-Review-Evidence: chat`,
`Action-Mode: human-directed`, `Agent: Riven`, `Agent-Runtime: Cursor`,
`Agent-Model: Grok 4.6`, `Credential-Identity: AceHack`,
`Credential-Mode: shared`.

THE FLIP: do **not** add picker/restore to `gate (required)`. Optional
installer/QEMU jobs may fail and still squash-merge. `lint (TS)` **is**
on the required floor. `test (TS hermetic)` is **not**.

---

## 2. Live QEMU after #14353 (measured)

Dispatch on idle `main`:
[run 32724820159](https://github.com/Lucent-Financial-Group/Zeta/actions/runs/32724820159)
(2026-08-24, `workflow_dispatch`, SHA `4161e5ea4`).

| Step                                                   | Result                                                                   |
| ------------------------------------------------------ | ------------------------------------------------------------------------ |
| aarch64 ISO + QEMU boot                                | success                                                                  |
| NixOS k3s / Longhorn tests                             | success                                                                  |
| Build installer ISO                                    | success                                                                  |
| Scenario 1                                             | success                                                                  |
| Scenario 2                                             | success                                                                  |
| **UEFI keyfile restore decrypt**                       | **failure**                                                              |
| Upload `qemu-uefi-keyfile-restore-serial-log`          | success (artifact exists)                                                |
| wifi ESP / keyfile write / picker bind / scenarios 3–4 | **skipped** (restore is a hard fail; those steps are not `if: always()`) |

Restore **did** run with budget (order fix worked). It is an independent
`qemu-full-install-test.ts` with `QEMU_UEFI_KEYFILE_RESTORE=1` (does
write + picker bind + phase-2 decrypt itself).

Phase 1 inside that step:

- iSerial probe: `serial=ZETA-QEMU-001`
- `[uefi-keyfile] wrote 32-byte keyfile`
- passphrase from Step 6.56; binding `--uefi-keyfile`
- picker **started** (no `mise ERROR Config files … are not trusted`)
- then blocked on `[b]ake-in / [d]efer to device-flow / [s]kip?`
- host killed QEMU at 1800s: `phase 1 timeout waiting for "ZETA CLUSTER NODE INSTALL COMPLETE"`

Pre-fix contrast: [run 32647553460](https://github.com/Lucent-Financial-Group/Zeta/actions/runs/32647553460)
died on untrusted `.mise.toml` after binding started; job also starved
restore by putting it last (~90 min wall).

---

## 3. QEMU next steps (software, ranked)

### P0 — landed: non-interactive 6.95-picker under QEMU

Squash: [PR #14852](https://github.com/Lucent-Financial-Group/Zeta/pull/14852)
→ `4a1df27bf` on `main` (2026-08-24T16:53Z). `--defer-all` + install.sh
passes it when stdin is not a TTY or `QEMU_PP_FILE` is set. Empty bake
still writes a decryptable `/mnt/boot/zeta-creds.enc` bound to the
keyfile (`wrote 0 creds` still matches the restore `wrotePrefix`).

Live QEMU ([run 32804383505](https://github.com/Lucent-Financial-Group/Zeta/actions/runs/32804383505)):
`--defer-all` worked (no readline hang). Persist then died
`EACCES` writing `/mnt/boot/zeta-creds.enc` as zeta uid. Next slice:
write `/tmp` then `sudo install` onto ESP (same as keyfile).

Success contract (`assertUefiKeyfileRestoreContract`):

- `zeta-creds-restore: passphrase staged from qemu fw_cfg`
- `zeta-creds-restore: binding-factor uefiKeyfile (ESP file; not copied to /etc)`
- wrote-prefix **or** already-present (`wrote 0 creds` is enough)
- serial must **not** contain `DEFAULT_QEMU_PASSPHRASE`

Artifact: `qemu-uefi-keyfile-restore-serial-log`.

Do **not** persist the QEMU passphrase onto the installed ESP as a
production path. fw_cfg is the QEMU-only inject.

### P1 — restore fail must not skip sibling dispatch QEMU

Wifi / write / picker / scenarios 3–4 **run** steps use
`if: always() && github.event_name == 'workflow_dispatch'`. Restore itself
stays a hard fail (no `always()`, no `continue-on-error`) so a restore red
still fails the job. Keep them off `gate (required)`.

Falsifier: `src/Core.TypeScript/ci/qemu-full-install-test.test.ts`
("dispatch QEMU siblings after restore keep running when restore is red").

Re-dispatch `build-ai-cluster-iso.yml` on `main` **only when the
concurrency group is idle** (`gh run list --workflow=build-ai-cluster-iso.yml
--status in_progress` empty). Push events do **not** run restore.

### P2 — after restore is green

Still metal-gated (do not claim): S6 first-login feel, real WiFi
association, Touch ID/FIDO, real TPM, Slice 5 CODEOWNERS. See
[S6-UX-PLACEHOLDER.md](../trajectories/usb-zflash-installer/S6-UX-PLACEHOLDER.md).

R9: QEMU USB is `readonly=on`; ESP write-probe stays BLIND on QEMU
([PR #14169](https://github.com/Lucent-Financial-Group/Zeta/pull/14169)).
Do not treat QEMU EROFS as metal proof.

---

## 4. How to dispatch (copy-paste)

```bash
gh run list --workflow=build-ai-cluster-iso.yml --status in_progress --limit 5
# only if empty:
gh workflow run build-ai-cluster-iso.yml --ref main
```

Concurrency group `build-ai-cluster-iso-${{ github.workflow }}-${{ github.ref }}`
cancels a **pending** `main` run when another `main` ISO queues.
`cancel-in-progress` is PR-only, but a second pending push still drops
the first pending job.

---

## 5. Local hygiene (this clone)

- Feature branch `riven/picker-defer-all` was merged as #14852.
- Other `riven/*` branches and extra worktrees are **older** USB slices;
  do not mass-delete them from this note.
- Do not put `.claude/hooks/harness.test.ts` back (`unexecuted-test-files`).
- Relocated hook tests live at `src/Core.TypeScript/claude-hooks/harness.test.ts`.

---

## 6. Pointers

- Trajectory: [`docs/trajectories/usb-zflash-installer/RESUME.md`](../trajectories/usb-zflash-installer/RESUME.md)
- Restore contract: `src/Core.TypeScript/ci/qemu-full-install-test.ts`
  (`UEFI_KEYFILE_RESTORE_SERIAL`, `assertUefiKeyfileRestoreContract`)
- Picker: `src/Core.TypeScript/installer/zeta-creds-picker.ts`
- Workflow: `.github/workflows/build-ai-cluster-iso.yml`
- Threat model: `docs/security/USB-IDENTITY-THREAT-MODEL.md`
