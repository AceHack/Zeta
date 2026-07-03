---
id: B-0738
priority: P3
status: open
created: 2026-05-25
last_updated: 2026-05-25
title: zflash Linux variant — lsblk-based device enumeration + pam_fprintd biometric gate (when hardware present) + pkexec/polkit password fallback + tools/setup/linux.sh integration touchpoint
domain: ops-tooling
ferried_by: aaron
owners: [aaron]
composes_with:
  - B-0737
  - B-0728
  - B-0732
related_substrate:
  - full-ai-cluster/tools/flash-usb.ts
  - full-ai-cluster/tools/zflash.ts
  - full-ai-cluster/tools/zflash-setup.ts
  - tools/setup/linux.sh
tags: [zflash-linux, lsblk, pam-fprintd, libfprint, polkit, pkexec, biometric-fallback, ops-tooling, cross-platform]
---

# B-0738 — zflash Linux variant

## Carved blade

> `flash-usb.ts` + `zflash.ts` + `zflash-setup.ts` are macOS-only by hard refusal (`bail if (platform() !== "darwin")`). Linux extension is straightforward at the device-enumeration layer (`lsblk` + `/dev/sdX` instead of `diskutil` + `/dev/rdiskN`) but the biometric gate is **hardware-dependent**: `pam_fprintd.so` works only on machines with a supported fingerprint reader enrolled via `fprintd-enroll` (ThinkPads, Framework laptops, recent Dell XPS, some HPs). Machines without biometric hardware fall back to standard PAM password OR `pkexec` (polkit) for GUI password prompt. The substrate stays substrate-honest about which gate fires.

## Origin

Aaron 2026-05-25, after B-0737 (Mac variant) shipped:

> *"is this mac only? does our install / pre install scripts take care of everyting needed for mac?  what do we need to do to extend this to windows and linux?  we should document liminations and scope and backlog the rest"*

Yes — Mac only. This row covers the Linux extension; B-0739 covers Windows.

## Limitations B-0738 addresses

| Limitation | Current state | What B-0738 fixes |
|---|---|---|
| `flash-usb.ts` bails on non-Darwin | `bail(2, "this script only supports macOS...")` | Add Linux platform branch + `lsblk` enumeration + `/dev/sdX` writes |
| No Linux `zflash` wrapper | Doesn't exist | Ship Linux equivalent — same `--short` challenge format; auto-discovers ISO under `~/Downloads/` (XDG-compliant variant: also check `$XDG_DOWNLOAD_DIR`) |
| No Linux `zflash-setup` | Doesn't exist | Ship Linux equivalent — installs `pam_fprintd.so` if hardware present; fallback documented |
| `pam_tid.so` is Apple-only | N/A on Linux | Replace with `pam_fprintd.so` (libfprint-based) when hardware supports |
| No `tools/setup/linux.sh` integration | install.sh handles dev toolchain only | Optional touchpoint: invoke `zflash-setup-linux.ts` from `linux.sh` when `--with-zflash` flag passed (off by default; opt-in like the Mac path) |

## Linux substrate-engineering scope

### Scope item 1 — `flash-usb.ts` Linux platform branch

- Detect platform via `platform() === "linux"`
- Replace `diskutil list -plist` enumeration with `lsblk -J -O -d` (JSON output of disk-level devices, all attributes)
- Filter for USB devices via `lsblk` `tran` field (`usb`) + `rm` field (`1` = removable)
- Replace `bootDiskIdentifier()` (mount-based on macOS) with `/proc/mounts` parse + `findmnt /` resolution
- Replace `/dev/rdiskN` raw-device convention with `/dev/sdX` directly (Linux has no raw-prefix equivalent; the block device IS the device)
- Keep all hardware sanity rails (USB-only, single-USB, non-internal, non-boot, size-bounds, ISO checks)
- Keep nonce + consent token gate (same per-run random + explicit-consent floor)
- `sudo dd` invocation unchanged (works identically on Linux)

Acceptance:

- [ ] flash-usb.ts works on Debian/Ubuntu (the same matrix `tools/setup/linux.sh` already supports)
- [ ] Hardware sanity rails enforce identically (USB-only, non-internal, non-boot)
- [ ] At least one worked example: Aaron or Max flashes the Zeta installer ISO to a USB stick from a Linux dev machine

### Scope item 2 — `zflash.ts` Linux variant (or unified script with platform-switch)

Two design options; substrate-honest choice deferred to design pass:

- **Option A** — separate `zflash-linux.ts` + `zflash-darwin.ts` + a top-level `zflash.ts` that dispatches based on `platform()`. Cleaner per-platform code; some duplication.
- **Option B** — unified `zflash.ts` with platform branches inline. Tighter code; more conditionals.

Probably Option B for the wrapper (it's small) + Option A for `flash-usb` if the per-platform divergence grows (currently small enough to inline).

Auto-discovery surface on Linux extends to:

- `~/Downloads/zeta-installer-*.iso` (default; matches macOS)
- `$XDG_DOWNLOAD_DIR/zeta-installer-*.iso` if set (XDG-compliant)
- `~/Downloads` is the de-facto default but XDG users (some Linux distros set it differently) need the extra check

### Scope item 3 — `zflash-setup.ts` Linux variant

PAM stack edit is similar in shape but different in content:

- Target: `/etc/pam.d/sudo` (Debian/Ubuntu); some distros use `/etc/pam.d/sudo-i` instead — feature-detect
- Insert line: `auth sufficient pam_fprintd.so` (NOT `pam_tid.so` — that's Apple)
- Hardware precheck: `lsusb | grep -iE "fingerprint|biometric"` OR `fprintd-list "$USER"` to detect enrolled finger
- If no fingerprint hardware OR no enrolled finger: skip PAM edit + report clearly that operator will fall back to password gate (still safer than NOPASSWD)
- Alternative biometric: polkit + `pkexec` for GUI password prompt — works on systems without fingerprint hardware

Acceptance:

- [ ] PAM edit idempotent (matches Mac variant pattern)
- [ ] Hardware precheck reports clearly when biometric NOT available
- [ ] Substrate-honest fallback path documented (operator chooses: install fprintd if hardware supports it; OR accept password gate; OR install pkexec for GUI prompt)
- [ ] Works on Debian/Ubuntu (the supported Linux matrix per `linux.sh`)
- [ ] Future-scope: RHEL/Fedora/Arch/Alpine variants once `linux.sh` supports them

### Scope item 4 — `tools/setup/linux.sh` integration touchpoint (optional)

- Add `--with-zflash` opt-in flag to `linux.sh` (off by default; matches Mac touchpoint discipline — operator consciously opts into the system-PAM edit)
- When passed: invokes `bun full-ai-cluster/tools/zflash-setup-linux.ts --install-alias` after main install
- Documents the choice in install.sh output so first-run operator sees what was/wasn't installed

## What's NOT in scope (deferred to future B-NNNN rows)

- **RHEL/Fedora/Arch/Alpine support** — `linux.sh` itself doesn't support these yet (deferred per its header). zflash Linux variant will inherit that deferment.
- **`libfprint` driver installation** — different distros have different package names + versions; this row assumes the operator has working fingerprint hardware before running zflash-setup.
- **Headless Linux servers** — biometric obviously N/A; setup script reports + falls back to PAM password.
- **Wayland-vs-X11 polkit pkexec UX differences** — both work; UX details deferred.
- **Touch-screen Linux laptops with face-unlock** — `pam_face_authentication` exists but is experimental; future scope.

## Composes with .claude/rules/

- `.claude/rules/non-coercion-invariant.md` HC-8 — biometric (when present) gates destructive op; password fallback also keeps PAM in the loop; agent cannot bypass either
- `.claude/rules/default-to-both.md` — biometric AND password fallback both first-class; substrate-honestly reported per machine
- `.claude/rules/classifier-bypass-research-do-not-deploy-without-zeta-safer-floor.md` — PAM edit INSTALLS safety (biometric or fprintd); does not remove
- `.claude/rules/honor-those-that-came-before.md` — B-0737 Mac substrate is foundation; B-0738 extends without replacing
- `.claude/rules/glass-halo-bidirectional.md` — pkexec/fprintd prompts are system-level UI; visible to operator regardless of which terminal initiated

## Composes with backlog substrate

- B-0737 (zflash Mac variant — foundation; same `--short` challenge format; same safety substrate; same B-0728 contract)
- B-0728 (destructive-tool authoring contract — inherited)
- B-0732 (leverage-class safety substrate — empirical instance of "destructive operation gated by physical-presence proof when available")
- B-0739 (zflash Windows variant — sibling row; same shape; different platform)

## Substrate-honest framing

This row PROPOSES the Linux substrate. It does NOT:

- Ship code (future build work; scope items 1-3 are independent shippable units)
- Auto-integrate into linux.sh (scope item 4 is opt-in; matches Mac touchpoint discipline)
- Claim biometric works on every Linux laptop (hardware-dependent; substrate-honest fallback path documented)
- Bypass any safety substrate from B-0737 (per-run nonce + explicit consent token + PAM auth all preserved)

Per `.claude/rules/no-directives.md`: operator-substrate-honest scoping; Aaron + future Linux operators (Max if he uses Linux) retain authority over when to build + when to ship per-scope-item.

P3 priority — Linux substrate enables future cross-platform operator base but doesn't gate any current critical path (Aaron's primary workstation is Mac; the cluster nodes themselves don't need zflash — they boot from the flashed USB then run zeta-install.sh natively).
