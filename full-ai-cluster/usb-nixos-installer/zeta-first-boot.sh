#!/usr/bin/env bash
# zeta-first-boot — auto-invoked on first boot of the installer ISO.
#
# Lives on the USB at /run/current-system/sw/bin/zeta-first-boot (installed
# by the installer's configuration.nix). The systemd unit
# `zeta-first-boot.service` runs this on tty1 right after boot when the
# marker file `/etc/zeta-firstboot-enabled` is present (which it always
# is on a fresh installer ISO).
#
# Flow:
#   1. Wait up to 30s for ethernet DHCP + internet
#   2. If no internet, auto-launch `nmtui` for wifi setup (one TUI form)
#   3. Once internet is up, exec `zeta-install $HOST` non-interactively
#      (HOST read from /etc/zeta-firstboot.conf; defaults to control-plane)
#
# Why this exists: per 081KSGS9H0008QG0R002T3BJ2R, node-side typing was the second half of
# the cluster-install bandwidth wall (zflash one-touch on Mac, then ~8
# commands of bandwidth-bad console typing on the node). This script
# reduces node-side typing to:
#   - 0 commands if ethernet has DHCP + internet
#   - 1 TUI session (nmtui) if wifi only
#
# Exit policy: never `exit 1` from this script — on any failure, drop the
# operator to a shell so they can recover with the existing manual flow.

set -uo pipefail

# 081KSNY2Z0008QG0R0008PN7RQ: mirror first-boot + zeta-install progress to the serial UART.
# zeta-first-boot.service binds stdout to tty1 for the operator; QEMU/CI
# harnesses poll ttyS0 (x86) or ttyAMA0 (aarch64). Kernel cmdline lists
# console=tty1 last, so /dev/console is tty1 — tee there is a no-op for
# serial. Mirror to the hardware UART instead.
_b0891_serial_dev=""
for _dev in /dev/ttyS0 /dev/ttyAMA0; do
  if [[ -w "$_dev" ]]; then
    _b0891_serial_dev="$_dev"
    break
  fi
done
if [[ -n "$_b0891_serial_dev" ]]; then
  exec 3>&1
  exec > >(/run/current-system/sw/bin/tee -a "$_b0891_serial_dev" >&3) 2>&1
fi

CONF=/etc/zeta-firstboot.conf
[[ -f "$CONF" ]] && . "$CONF"

# ── WP21 (081M35C7NJR087G0R002S4R654): ISO-baked repo-pin provenance ──────
#
# Sourced the same way as the ISO's zeta-firstboot.conf just above:
# /etc/zeta-iso-provenance is written by full-ai-cluster/flake.nix at ISO
# build time (self.rev) and carries ZETA_ISO_COMMIT. Absent on any ISO built
# before this landed, or when self.rev was unavailable (dirty tree, i.e. a
# hand-built ISO) -- sourcing a missing file is a no-op, same fail-safe shape
# as the role conf, and zeta-install.sh treats an empty/unset ZETA_ISO_COMMIT
# as "no pin" (today's unpinned behaviour). An ESP override further below
# takes precedence over whatever this line sets.
[[ -f /etc/zeta-iso-provenance ]] && . /etc/zeta-iso-provenance

# ── 081KSNY2Z0008QG0R0008PN7RQ scenario 5: ESP-provided role overrides the ISO's ──
#
# The line above sources a file baked into the ISO's read-only Nix store, which
# ships HOST=control-plane. That made the role an ISO-BUILD-time decision, so
# every medium cut from one ISO installed a control plane and a second node
# could never be provisioned as a joiner (the installer's own comment deferred a
# per-flash --role to "v2").
#
# zflash now writes /zeta-firstboot.conf to the boot ESP
# (src/Core.TypeScript/zflash/firstboot-role.ts). Source it AFTER the ISO's copy
# so the flash wins, which is the whole point: the role travels with the flash.
#
# Strictly additive and fail-safe — if no ESP conf is found, everything below is
# byte-identical to the previous behaviour. The ESP is mounted read-only; every
# value in that file passed a conservative allowlist at flash time (no $, no
# backtick, no ;, no quotes, no newline) and is emitted single-quoted, because
# this line SOURCES it as bash.
ZETA_ROLE_SOURCE="iso:/etc/zeta-firstboot.conf"
ESP_CONF_MOUNT=/run/zeta-boot-esp

# ── WP27 (081M392JR97087G0R003QAFH0Y): the scan has to SAY what it saw ───
#
# This scan used to be entirely silent. A run that found no conf, a run whose
# mount failed on every candidate, and a run where the loop matched no block
# device at all produced BYTE-IDENTICAL output: nothing. The only downstream
# evidence was `source=iso:` on the role line, which is ALSO what a correct
# run prints when no ESP conf was staged -- so "the conf was not there" and
# "the conf was there and I could not read it" were indistinguishable.
#
# That cost a full CI run to not-diagnose. Run 35985197702 staged
# `/zeta-firstboot.conf` on the ESP -- the plan contains it, the execution
# plan emits the `mcopy`, and file-backed.ts's post-bake `mdir` verification
# (081KZHJPJCF, which FAILS the bake on a silent drop) passed -- and the guest
# still reported `source=iso:`. Nothing in the serial could say why, because
# this function never spoke.
#
# `ZETA_ESP_CONF` records the outcome and is printed unconditionally below.
ZETA_ESP_CONF="none"
ZETA_ESP_CONF_TRIED=""
#
# ── WP29 (081M39CJP96087G0R001T4J2R3): `(no-vfat)` HAS TO SAY WHY ────────
#
# WP27 above made the scan speak; this makes its one interesting verdict
# say something. `(no-vfat)` was the mount's exit status with the mount's
# OWN EXPLANATION thrown away by `2>/dev/null`, and that is the whole gap
# between the two runs this work item compares:
#
#   36014672753 (WP11 green):   EFIBOOT(no-conf) ... /dev/sda2(no-conf)
#   36044770870 (WP11 lost it): EFIBOOT(no-vfat) ... /dev/sda2(no-vfat)
#
# Identical dispatch, identical preceding steps, identical QEMU command
# line, ISOs three non-ESP commits apart. udev had already read the FAT
# label off that partition -- `/dev/disk/by-label/EFIBOOT` EXISTS in the
# failing list -- so blkid could parse the boot sector while the kernel
# refused the mount, and it stayed refused for the whole install rather
# than settling. That is a narrow class of failure ("Unable to load NLS
# charset", an -EINVAL from the BPB, EBUSY on the mountpoint) and the
# kernel names which one it is, on stderr, every time. We were discarding
# it, so every occurrence cost a fresh ~40-minute run and still produced
# no cause.
#
# Keep the field SPACE-FREE: `espConfScanOutcome` in
# src/Core.TypeScript/ci/qemu-full-install-test.ts parses `tried=(\S*)`,
# so the reason is squeezed to [A-Za-z0-9._/:-] and truncated. Nothing
# here changes control flow -- a failed mount still just continues.
# Squeeze a mount's stderr into one space-free token. `espConfScanOutcome` in
# src/Core.TypeScript/ci/qemu-full-install-test.ts parses `tried=(\S*)`, so a
# space here would truncate the field and lose the rest of the device list.
# `|| :` because pipefail is on and `head -1` can SIGPIPE the producer; the
# assignment has already happened by then, so a harmless broken pipe must not
# read as a failure.
zeta_squeeze_mount_error() {
  local squeezed
  # WP29, second pass: strip util-linux's `mount: <mountpoint>: ` prefix FIRST.
  # Measured on run 36073981145 (picker lane): the 64-char cap spent 36 of its
  # characters on `mount:_/run/zeta-boot-esp:_` and cut the kernel's actual
  # answer at `Can_t_o` -- the truncation ate exactly the half that was worth
  # capturing. The mountpoint is ours and constant; the tail is the evidence.
  squeezed="$(printf '%s' "${1:-}" | head -1 | sed 's|^mount: [^:]*: ||' | tr -c 'A-Za-z0-9._/=:-' '_' | cut -c1-72)" || :
  printf '%s' "${squeezed:-no-stderr}"
}

# ── WP29 RUNG 4: READ THE ESP WITHOUT OPENING THE PARTITION AT ALL ───────
#
# ROOT CAUSE, measured on run 36073981145 and reproduced locally end to end.
# An isohybrid ISO's partition 1 starts at LBA 0 and spans the whole image, so
# `/dev/sda` and `/dev/sda1` expose the SAME iso9660 filesystem with the SAME
# `ZETA_INSTALL` label. `/dev/disk/by-label/ZETA_INSTALL` therefore resolves to
# whichever udev processed last. When it resolves to the WHOLE DISK, the boot
# medium is mounted from `/dev/sda`, which holds that device O_EXCL -- and
# every partition of it becomes unopenable for the rest of the install:
#
#   picker lane:  sda1 AND sda2 = `fsconfig system call failed: Can't open blockdev`
#   four others:  sda1 = openable (iso9660, not FAT), sda2 = mounted
#
# Same ISO, same run, minutes apart. Local proof with a real isohybrid image:
# `mount -t vfat` on the partition succeeds with the whole disk unclaimed and
# is refused with `already mounted or mount point busy` once `mount <disk>` is
# held. Rungs 1-3 all lose, because all three open the partition.
#
# THE CLAIM NEVER CLEARS -- `/iso` stays mounted for the whole install -- so
# waiting was never an option; the rung has to route around it.
#
# WHY MTOOLS AND NOT `losetup -r`: both avoid the exclusive claim, and mtools
# is the smaller answer. `mcopy -i <wholedisk>@@<offset>` needs no mount, no
# loop device to allocate and release, and no kernel FAT driver at all -- it is
# the exact inverse of how the ESP was WRITTEN (`mcopy -i img@@offset` on the
# host), and `mtools` ships in this ISO's systemPackages beside `util-linux`.
# Verified working while the claim is held, on a real isohybrid image.
#
# THE OFFSET IS DERIVED, NEVER CONSTANT. This work item began with a fallback
# constant that was wrong and could not disagree with itself; a second constant
# would be the same mistake. `lsblk -bno START` reads sysfs, so it needs no
# open of the partition -- which is the whole point, since the partition is
# what cannot be opened. Unreadable or zero => REFUSE, never guess.
#
# READ-ONLY BY CONSTRUCTION: this materialises a COPY of the ESP onto a fresh
# tmpfs at the caller's mountpoint. Every consumer keeps working on a path and
# the caller's `umount` still unmounts. Writes to it would NOT reach the ESP;
# no read-only consumer writes, and the `rw` ledger mount is a different
# function that is deliberately untouched.
zeta_esp_copy_out_mtools() {
  local part="$1" mnt="$2" start disk offset err
  start="$(lsblk -bno START "$part" 2>/dev/null | head -1 | tr -cd '0-9')" || start=""
  case "$start" in
    "" | *[!0-9]*)
      ZETA_ESP_MOUNT_WHY="${ZETA_ESP_MOUNT_WHY}|mtools=no-partition-start-in-sysfs"
      return 1
      ;;
  esac
  offset=$(( start * 512 ))
  if [ "$offset" -le 0 ]; then
    # A partition at LBA 0 is the whole-disk alias, not an ESP.
    ZETA_ESP_MOUNT_WHY="${ZETA_ESP_MOUNT_WHY}|mtools=start-lba-0-not-a-partition"
    return 1
  fi
  disk="$(lsblk -bno PKNAME "$part" 2>/dev/null | head -1 | tr -cd 'A-Za-z0-9._-')" || disk=""
  if [ -z "$disk" ]; then
    ZETA_ESP_MOUNT_WHY="${ZETA_ESP_MOUNT_WHY}|mtools=no-parent-disk-in-sysfs"
    return 1
  fi
  if ! mount -t tmpfs -o size=16m,mode=0700 zeta-esp-copyout "$mnt" 2>/dev/null; then
    ZETA_ESP_MOUNT_WHY="${ZETA_ESP_MOUNT_WHY}|mtools=tmpfs-mount-failed"
    return 1
  fi
  # Exit status only. mtools warns `Could not get geometry of device` on a
  # whole-disk read and still exits 0; treating stderr as failure would refuse
  # a working read. A non-FAT offset makes mcopy exit non-zero (`init ::
  # non DOS media`), so success here implies a real FAT at that offset.
  if err="$(mcopy -s -n -o -i "/dev/${disk}@@${offset}" "::/" "$mnt/" 2>&1 >/dev/null)"; then
    ZETA_ESP_MOUNT_VIA="mtools-copy:/dev/${disk}@@${offset}"
    return 0
  fi
  umount "$mnt" 2>/dev/null || true
  ZETA_ESP_MOUNT_WHY="${ZETA_ESP_MOUNT_WHY}|mtools=$(zeta_squeeze_mount_error "$err")"
  return 1
}

# ── WP29 MITIGATION (081M39CJP96087G0R001T4J2R3) — NOT A FIX ──────────────
#
# THREE ATTEMPTS INSTEAD OF ONE, because the failure is kernel-side and the
# first attempt is the only one that can be defeated by it.
#
# blkid parses the FAT superblock in USERSPACE; `mount -t vfat` additionally
# needs the kernel driver AND its NLS charset modules. "Label readable, mount
# refused" — which is what 36044770870's guest reported for EVERY candidate,
# `/dev/disk/by-label/EFIBOOT` included — is the signature of a kernel-side
# capability problem rather than a data problem, and that reading survives the
# measurements: both ISOs put the ESP at LBA 268, the pre-WP29 detector
# resolves 137_216 through the MBR branch on both, and a bake replayed on the
# failing ISO produces a clean, mountable, byte-exact ESP. The bytes were fine.
#
# Two candidates fit, and they are distinguished ON SIGHT by what this records:
#   - NLS charset unavailable -> `FAT-fs (sda2): IO charset iso8859-1 not
#     found` / `codepage cp437 not found`, surfacing as -EINVAL. Attempt 3
#     names an explicit charset and may well succeed where attempt 1 did not.
#   - a device-level read error -> all three fail, with the kernel's words for
#     each. Three errors instead of one is strictly more information.
#
# So under one cause this turns a lost install into a completed one plus a
# diagnostic; under the other it costs two extra syscalls and buys evidence.
# It is a MITIGATION: it does not explain the refusal and it does not close
# 081M39CJP96087G0R001T4J2R3. `ZETA_ESP_MOUNT_VIA` names the attempt that
# worked, so a run that only succeeds on attempt 2 or 3 is visibly NOT a
# healthy run.
#
# Attempt 2 drops `-t vfat` and lets the kernel autodetect — which is also the
# one attempt that could mount something that is NOT a FAT filesystem (the
# loop walks iso9660 partitions too), so its success is accepted ONLY after
# the mounted type is confirmed to be FAT. Without a way to confirm, the
# attempt is treated as failed; an unconfirmable mount is not a pass.
ZETA_ESP_MOUNT_VIA=""
ZETA_ESP_MOUNT_WHY=""
zeta_try_mount_esp_ro() {
  local part="$1" mnt="$2" err fstype
  ZETA_ESP_MOUNT_VIA=""
  ZETA_ESP_MOUNT_WHY=""

  if err="$(mount -t vfat -o ro "$part" "$mnt" 2>&1 >/dev/null)"; then
    ZETA_ESP_MOUNT_VIA="vfat"
    return 0
  fi
  ZETA_ESP_MOUNT_WHY="vfat=$(zeta_squeeze_mount_error "$err")"

  if err="$(mount -o ro "$part" "$mnt" 2>&1 >/dev/null)"; then
    fstype="$(findmnt -n -o FSTYPE "$mnt" 2>/dev/null)" || fstype=""
    case "$fstype" in
      vfat|msdos)
        ZETA_ESP_MOUNT_VIA="auto-${fstype}"
        return 0
        ;;
      *)
        umount "$mnt" 2>/dev/null || true
        ZETA_ESP_MOUNT_WHY="${ZETA_ESP_MOUNT_WHY}|auto=mounted-as-${fstype:-unknown}-not-FAT"
        ;;
    esac
  else
    ZETA_ESP_MOUNT_WHY="${ZETA_ESP_MOUNT_WHY}|auto=$(zeta_squeeze_mount_error "$err")"
  fi

  if err="$(mount -t vfat -o ro,iocharset=ascii,codepage=437 "$part" "$mnt" 2>&1 >/dev/null)"; then
    ZETA_ESP_MOUNT_VIA="vfat-ascii"
    return 0
  fi
  ZETA_ESP_MOUNT_WHY="${ZETA_ESP_MOUNT_WHY}|ascii=$(zeta_squeeze_mount_error "$err")"

  # Rung 4 -- the only one that does not open the partition. See the header.
  zeta_esp_copy_out_mtools "$part" "$mnt" && return 0
  return 1
}

zeta_source_esp_firstboot_conf() {
  local part conf
  mkdir -p "$ESP_CONF_MOUNT" 2>/dev/null || { ZETA_ESP_CONF="mkdir-failed:$ESP_CONF_MOUNT"; return 1; }
  for part in /dev/disk/by-label/* /dev/sd?[0-9] /dev/nvme?n?p[0-9] /dev/vd?[0-9] /dev/mmcblk?p[0-9]; do
    [[ -b "$part" ]] || continue
    # Every block device the loop actually considered, so an empty list is
    # visibly an empty list rather than an unexplained miss.
    # Resolve by-label symlinks INLINE. `/dev/disk/by-label/ZETA_INSTALL`
    # resolving to the whole disk rather than to partition 1 is the coin flip
    # this whole work item turns on, and printing the symlink's NAME said
    # nothing about which way it landed. Space-free: `espConfScanOutcome`
    # parses `tried=(\S*)`.
    if [[ -L "$part" ]]; then
      ZETA_ESP_CONF_TRIED="${ZETA_ESP_CONF_TRIED}${ZETA_ESP_CONF_TRIED:+,}${part}->$(readlink -f "$part" 2>/dev/null || echo unresolvable)"
    else
      ZETA_ESP_CONF_TRIED="${ZETA_ESP_CONF_TRIED}${ZETA_ESP_CONF_TRIED:+,}${part}"
    fi
    zeta_try_mount_esp_ro "$part" "$ESP_CONF_MOUNT" || {
      ZETA_ESP_CONF_TRIED="${ZETA_ESP_CONF_TRIED}(no-vfat:${ZETA_ESP_MOUNT_WHY})"
      continue
    }
    # Name the attempt that worked. `via=vfat` is the healthy shape; anything
    # else means attempt 1 was refused and the mitigation carried the install.
    [[ "$ZETA_ESP_MOUNT_VIA" == "vfat" ]] ||
      ZETA_ESP_CONF_TRIED="${ZETA_ESP_CONF_TRIED}(mounted-via:${ZETA_ESP_MOUNT_VIA};after:${ZETA_ESP_MOUNT_WHY})"
    conf="$ESP_CONF_MOUNT/zeta-firstboot.conf"
    if [[ -f "$conf" ]]; then
      # shellcheck disable=SC1090
      . "$conf"
      ZETA_ESP_CONF="esp:$part"
      # ── PROVENANCE IS ABOUT THE ROLE, NOT ABOUT THE FILE ──────────────
      #
      # `ZETA_ROLE_SOURCE=esp:` is read a few lines down as "a human chose
      # this role" (ZETA_ROLE_DECLARED=yes), and a declared role SKIPS
      # bootstrap-or-join discovery outright. That was sound while the ESP
      # conf could only exist because someone passed `--role`.
      #
      # It no longer can be. An ESP conf may now carry first-boot values that
      # say nothing about the role at all (the QEMU lanes stage
      # ZETA_ALLOW_LONGHORN_UNDERSIZED this way). Claiming `esp:` for one of
      # those would silently promote every such node from DEFAULTED to
      # DECLARED and turn discovery off -- a behaviour change smuggled in by
      # an unrelated value, which is exactly the conflation the role-source
      # comment below exists to prevent.
      #
      # So the role's provenance moves only when the conf ACTUALLY DECLARES a
      # role. Checked against the file, not against the resulting variable:
      # ZETA_ROLE is already set from the ISO conf by this point, so "is it
      # set?" cannot distinguish the two.
      if grep -qE '^[[:space:]]*ZETA_ROLE=' "$conf" 2>/dev/null; then
        ZETA_ROLE_SOURCE="esp:$part"
      fi
      umount "$ESP_CONF_MOUNT" 2>/dev/null || true
      return 0
    fi
    ZETA_ESP_CONF_TRIED="${ZETA_ESP_CONF_TRIED}(no-conf)"
    umount "$ESP_CONF_MOUNT" 2>/dev/null || true
  done
  [[ -n "$ZETA_ESP_CONF_TRIED" ]] || ZETA_ESP_CONF="no-block-devices-matched"
  return 1
}
zeta_source_esp_firstboot_conf || true

# ── WP21 (081M35C7NJR087G0R002S4R654): ESP-side repo-pin override ────────
#
# /zeta-repo-pin on the ESP, sourced in PREFERENCE to the ISO-baked
# /etc/zeta-iso-provenance above -- same "ESP wins" shape as the role conf
# just above, kept as its own tiny mount/source/unmount rather than folded
# into zeta_source_esp_firstboot_conf so neither one's failure mode can
# touch the other. Lets a QEMU test lane (or an operator) pin a different
# commit than the one baked into this ISO without rebuilding it. Writer:
# src/Core.TypeScript/zflash/lib.ts (planFileBackedZflashImage repoPinCommit).
# Content is a single bash assignment, single-quoted and hex-only by
# construction at the writer (see repo-pin.ts / lib.ts validation), same
# injection posture as the role conf.
zeta_source_esp_repo_pin() {
  local part conf
  mkdir -p "$ESP_CONF_MOUNT" 2>/dev/null || return 1
  for part in /dev/disk/by-label/* /dev/sd?[0-9] /dev/nvme?n?p[0-9] /dev/vd?[0-9] /dev/mmcblk?p[0-9]; do
    [[ -b "$part" ]] || continue
    mount -t vfat -o ro "$part" "$ESP_CONF_MOUNT" 2>/dev/null || continue
    conf="$ESP_CONF_MOUNT/zeta-repo-pin"
    if [[ -f "$conf" ]]; then
      # shellcheck disable=SC1090
      . "$conf"
      umount "$ESP_CONF_MOUNT" 2>/dev/null || true
      return 0
    fi
    umount "$ESP_CONF_MOUNT" 2>/dev/null || true
  done
  return 1
}
zeta_source_esp_repo_pin || true

HOST="${HOST:-control-plane}"
ZETA_ROLE="${ZETA_ROLE:-first-control-plane}"
# WP27 -- printed on EVERY boot, including (especially) the boots where the
# scan found nothing. `esp-conf=` is the outcome, `tried=` is the candidate
# list with a per-candidate reason, and `role-source=` stays separate because
# a conf that declares no role does not move the role's provenance.
# WP29: what the boot medium is mounted FROM, on every run and not only on a
# failure. A whole-disk source (`/dev/sda`) holds that device O_EXCL and makes
# every partition of it unopenable for the rest of the install; a partition
# source (`/dev/sda1`) does not. Until this line existed, the failing side had
# `lsblk` from the iter-4.2 diagnostics block -- which prints ONLY on failure
# -- and the healthy side had nothing, so the difference between them was
# INFERRED rather than measured. Now both sides say it.
ZETA_ESP_BOOT_MEDIUM="$(findmnt -n -o SOURCE /iso 2>/dev/null | head -1 | tr -d '[:space:]')" || ZETA_ESP_BOOT_MEDIUM=""
echo "[081M392JR97087G0R003QAFH0Y-esp-conf] esp-conf=${ZETA_ESP_CONF} tried=${ZETA_ESP_CONF_TRIED:-<none>} boot-medium=${ZETA_ESP_BOOT_MEDIUM:-<not-mounted-at-/iso>}"
echo "[081KSNY2Z0008QG0R0008PN7RQ-role] role=${ZETA_ROLE} host=${HOST} source=${ZETA_ROLE_SOURCE}"
if [[ "${ZETA_ROLE}" == "joiner" ]]; then
  echo "[081KSNY2Z0008QG0R0008PN7RQ-role]   join server: ${ZETA_JOIN_SERVER_URL:-<unset>}"
  echo "[081KSNY2Z0008QG0R0008PN7RQ-role]   token on ESP: ${ZETA_JOIN_TOKEN_ESP_PATH:-<unset>}"
  export ZETA_JOIN_SERVER_URL="${ZETA_JOIN_SERVER_URL:-}"
  export ZETA_JOIN_TOKEN_ESP_PATH="${ZETA_JOIN_TOKEN_ESP_PATH:-}"
fi
export ZETA_ROLE
# ── 081M1VZRST2087G0R001QEJDWG: named bao export ──────────────────
#
# zflash may have written ZETA_BAO_LOAD_SITE / ZETA_BAO_PATH into the
# ESP conf this script already sourced. Sourced vars are not exported;
# the child zeta-install would not see them. Both names or neither —
# same all-or-none rule as cluster-segment addressing. bun/mise are
# not on PATH until zeta-install Step 6.95a, so this script does not
# invoke firstboot-bao-env.ts. Do not fill /run/current-system/sw/bin/bao.
# /dev/tpmrm0 is shell-safe and may be exported; bun consume still
# returns ask:null.
if [[ -n "${ZETA_BAO_LOAD_SITE:-}" && -n "${ZETA_BAO_PATH:-}" ]]; then
  export ZETA_BAO_LOAD_SITE ZETA_BAO_PATH
  echo "[081M1VZRST2087G0R001QEJDWG-bao] exported site=${ZETA_BAO_LOAD_SITE} path=${ZETA_BAO_PATH}"
elif [[ -n "${ZETA_BAO_LOAD_SITE:-}" || -n "${ZETA_BAO_PATH:-}" ]]; then
  echo "[081M1VZRST2087G0R001QEJDWG-bao] WARN: one bao name without the other; unsetting both (does not fill host bao)" >&2
  unset ZETA_BAO_LOAD_SITE ZETA_BAO_PATH
fi
# ── 081M1VZRST2087G0R001QEJDWG: end named bao export ──────────────
REPO_URL="${REPO_URL:-https://github.com/Lucent-Financial-Group/Zeta}"
ETHERNET_WAIT_SECS="${ETHERNET_WAIT_SECS:-30}"
ROLE_PROMPT_SECS="${ROLE_PROMPT_SECS:-10}"
# 081KSGS9H0008QG0R001Q2DH2H nmtui retry-prompt timeout — operator window to press 's' for
# shell-drop OR any other key (or wait) for nmtui re-launch. Mirrors
# the ROLE_PROMPT_SECS env-override pattern so the timeout is tunable
# without source edits.
NMTUI_RETRY_PROMPT_SECS="${NMTUI_RETRY_PROMPT_SECS:-10}"
# 081KSNY2Z0008QG0R0008PN7RQ: QEMU/ethernet-only hosts have no wl* iface — nmtui cannot help on serial.
NO_WIFI_EXTRA_WAIT_SECS="${NO_WIFI_EXTRA_WAIT_SECS:-90}"

# ── Role pick: 10-sec single-keystroke prompt ─────────────────────────
# Defaults to whatever the ISO's /etc/zeta-firstboot.conf shipped with
# (typically control-plane). Press 'c' or 'w' within ${ROLE_PROMPT_SECS}s
# to choose; any other key (or timeout) keeps the default.
# ANSI 'reset terminal' escape — no external `clear` dependency,
# works on bare tty without requiring `ncurses` + a TERM that
# tput recognises. Fixes 081KSGS9H0008QG0R002T3BJ2R iteration-1 'clear: command not
# found' from the systemd unit's minimal PATH.
printf '\033c' || true
cat <<EOF

  Zeta cluster installer — first boot

  Default role: ${HOST}

  Press 'c' for control-plane
  Press 'w' for worker-gpu
  Or wait ${ROLE_PROMPT_SECS}s to accept default (${HOST}) ...

EOF
ROLE_KEY=""
read -n 1 -s -t "${ROLE_PROMPT_SECS}" ROLE_KEY || true
case "${ROLE_KEY,,}" in
  # 081KSNY2Z0008QG0R0008PN7RQ: an operator keypress moves ZETA_ROLE too. Without
  # this the two could disagree — HOST=control-plane with ZETA_ROLE=joiner —
  # and the install would found a cluster while every later step believed it
  # was joining one.
  c) HOST=control-plane; ZETA_ROLE=first-control-plane; ZETA_ROLE_SOURCE="keystroke:c" ;;
  w) HOST=worker-gpu; ZETA_ROLE=joiner; ZETA_ROLE_SOURCE="keystroke:w" ;;
  *) ;;  # keep default
esac
export ZETA_ROLE
echo "Role selected: ${HOST} (role=${ZETA_ROLE})"
echo

# ── DECLARED vs DEFAULTED (081KSE6WT0008QG0R000CV98PV) ────────────────
#
# The distinction the discovery block further down turns on, and the reason
# the split-brain bug exists at all.
#
# `HOST` and `ZETA_ROLE` are ALWAYS set by the time we get here, because the
# ISO's own /etc/zeta-firstboot.conf ships `HOST=control-plane`. So "is a role
# set?" is useless as a question -- the answer is always yes, and reading that
# yes as an operator decision is exactly how every stick cut from one ISO
# founds its own cluster.
#
# What separates the two is PROVENANCE, and ZETA_ROLE_SOURCE already carries
# it:
#   esp:<part>        a zflash --role flash wrote it. A human chose it.  DECLARED
#   keystroke:c|w     a human pressed a key at the prompt above.         DECLARED
#   iso:/etc/...      nobody chose anything; it is the build-time
#                     fallback baked into every copy of the image.       DEFAULTED
#
# Discovery is consulted ONLY in the DEFAULTED case. A declaration always
# wins -- a node the operator called a control plane must not become an agent
# because something answered on the segment.
case "${ZETA_ROLE_SOURCE}" in
  esp:*|keystroke:*) ZETA_ROLE_DECLARED=yes ;;
  *)                 ZETA_ROLE_DECLARED=no  ;;
esac
echo "[081KSE6WT0008QG0R000CV98PV-role] declared=${ZETA_ROLE_DECLARED} source=${ZETA_ROLE_SOURCE}"
echo

drop_to_shell() {
  echo
  echo "[zeta-first-boot] Dropping to interactive shell."
  echo "  - Manual install: \`zeta-install $HOST\`"
  echo "  - Reboot: \`reboot\`"
  echo
  exec /run/current-system/sw/bin/bash
}

has_internet() {
  # IP first (QEMU NAT often has DNS lag); github.com proves DNS for nixos-install.
  ping -c 1 -W 2 -q 1.1.1.1 >/dev/null 2>&1 && return 0
  ping -c 1 -W 2 -q github.com >/dev/null 2>&1
}

has_wifi_hardware() {
  local _iface _name
  for _iface in /sys/class/net/*; do
    _name=$(basename "$_iface")
    [[ "$_name" == lo ]] && continue
    if [[ -d "$_iface/wireless" ]] || [[ "$_name" == wl* ]]; then
      return 0
    fi
  done
  return 1
}

# ANSI 'reset terminal' escape — no external `clear` dependency,
# works on bare tty without requiring `ncurses` + a TERM that
# tput recognises. Fixes 081KSGS9H0008QG0R002T3BJ2R iteration-1 'clear: command not
# found' from the systemd unit's minimal PATH.
printf '\033c' || true
cat <<EOF

  ╭──────────────────────────────────────────────────────╮
  │  Zeta cluster installer — first-boot auto-install    │
  │  Target role: ${HOST}
  │  Repo:        ${REPO_URL}
  ╰──────────────────────────────────────────────────────╯

EOF

echo "[1/3] Waiting up to ${ETHERNET_WAIT_SECS}s for ethernet DHCP + internet ..."
WAITED=0
while ! has_internet; do
  if [[ "$WAITED" -ge "$ETHERNET_WAIT_SECS" ]]; then
    break
  fi
  sleep 5
  WAITED=$((WAITED + 5))
  echo "  ... ${WAITED}s"
done

if has_internet; then
  echo "  ethernet ok (DHCP)"
else
  if ! has_wifi_hardware; then
    echo
    echo "[2/3] No wifi hardware — waiting up to ${NO_WIFI_EXTRA_WAIT_SECS}s for ethernet (081KSNY2Z0008QG0R0008PN7RQ headless/QEMU)."
    WAITED=0
    while ! has_internet; do
      if [[ "$WAITED" -ge "$NO_WIFI_EXTRA_WAIT_SECS" ]]; then
        break
      fi
      sleep 5
      WAITED=$((WAITED + 5))
      echo "  ... ${WAITED}s"
    done
    if has_internet; then
      echo "  ethernet ok (after extra wait)"
    else
      echo "[zeta-first-boot] Still offline; proceeding to zeta-install (will fail loudly if unreachable)."
    fi
  else
  echo
  echo "[2/3] No ethernet internet detected. Launching wifi setup (nmtui)."
  echo "      After connecting, quit nmtui to continue install."
  echo "      Esc out without connecting → nmtui re-launches to refresh scan."
  echo
  read -n 1 -s -t 5 -p "  Press any key to launch nmtui (or wait 5s) ..." || true
  echo
  echo
  # 081KSGS9H0008QG0R001Q2DH2H nmtui auto-relaunch-on-no-internet loop (operator 2026-05-26):
  #
  # Old behavior: launch nmtui once; if no internet on exit → drop_to_shell.
  # That broke the install flow when operator hit Esc to refresh the wifi
  # scan (empirical 2026-05-26 1st USB physical-test session — see 081KSGS9H0008QG0R001Q2DH2H).
  #
  # New behavior: loop nmtui until either (a) has_internet succeeds OR
  # (b) operator explicitly requests shell-drop via 's' keystroke. Esc
  # out of nmtui without connecting just re-launches nmtui (refresh-
  # friendly UX — operator can Esc + re-scan as needed).
  #
  # Per operator 2026-05-26: "i want to be able to refresh the network
  # withing breaking the script". This loop is the substrate-honest fix.
  #
  # nmtui returns 0 on quit regardless of whether connection succeeded.
  # Absolute path: defense-in-depth alongside the systemd unit's
  # environment.PATH override (set in configuration.nix on
  # systemd.services.zeta-first-boot.environment.PATH via lib.mkForce).
  # Both defenses together fix 081KSGS9H0008QG0R002T3BJ2R iteration-1 'nmtui: command not
  # found' (nmtui IS installed in the ISO via networkmanager in
  # systemPackages; the issue was PATH inheritance into the unit).
  NMTUI_ATTEMPTS=0
  while true; do
    NMTUI_ATTEMPTS=$((NMTUI_ATTEMPTS + 1))
    if ! /run/current-system/sw/bin/nmtui; then
      echo "[zeta-first-boot] nmtui failed to launch (attempt ${NMTUI_ATTEMPTS})."
      drop_to_shell
    fi
    # Give NetworkManager a moment to actually establish + DHCP
    sleep 3
    if has_internet; then
      echo "  wifi ok (after ${NMTUI_ATTEMPTS} nmtui session(s))"
      break
    fi
    # No internet yet — give operator the choice to retry or escape
    echo
    echo "[zeta-first-boot] No internet after nmtui session ${NMTUI_ATTEMPTS}."
    echo "                  Press 's' within ${NMTUI_RETRY_PROMPT_SECS}s to drop to shell, OR"
    echo "                  press any other key (or wait) to re-launch nmtui"
    echo "                  to refresh the wifi scan."
    echo
    CHOICE=""
    read -r -n 1 -s -t "${NMTUI_RETRY_PROMPT_SECS}" -p "  > " CHOICE || true
    echo
    case "$CHOICE" in
      s|S)
        echo "[zeta-first-boot] Dropping to shell at operator request."
        drop_to_shell
        ;;
      *)
        echo "[zeta-first-boot] Re-launching nmtui for refresh ..."
        echo
        ;;
    esac
  done
  fi
fi

# ── Cluster discovery: bootstrap or join (081KSE6WT0008QG0R000CV98PV) ────
#
# Runs `zeta-cluster-discover`, which browses the segment for the Zeta cluster
# service type over the dwell and prints ONE JSON line. Contract:
#   exit 0  .action is "bootstrap" or "join"
#   exit 3  .action is "refuse", with .reason / .detail / .operatorAction
#   exit 2  bad arguments
#
# WHY HERE AND NOT AT THE ROLE PROMPT. The role prompt fires before the
# network wait above, so at that point the NIC routinely has no carrier and
# every probe would fail for a reason that has nothing whatever to do with
# whether a cluster exists. Discovery needs a link, so it runs after the
# network is up and before zeta-install is exec'd. Nothing before this point
# has touched a disk, so refusing here still costs nothing.
#
# DISCOVERY FINDS AN ADDRESS. IT NEVER CARRIES A CREDENTIAL. `--token-present`
# below is a BOOLEAN computed from `test -s` on the ESP token path -- this
# script never reads the file, and the k3s token still comes from the ESP or
# from an operator, exactly as it does today. Publishing a token over mDNS is
# refused by design and by a test in nix-contract.test.ts.
#
# A CHECK THAT DID NOT RUN MUST NEVER LOOK LIKE A CHECK THAT PASSED.
# The decider deliberately distinguishes "nothing answered" from "I could not
# look", and this call site keeps them apart rather than collapsing them:
#
#   bootstrap                 the silence passed the admissibility check
#                             (dwell, elapsed, query-burst count). Keep the
#                             default. This is today's behaviour, now earned.
#   join                      one cluster answered AND a token for it exists.
#   refuse, cluster HEARD     join-token-unavailable, multiple-clusters-answered,
#                             malformed-advertisement, trust-domain-*,
#                             cluster-id-does-not-match-token.
#                             -> HALT. Something is out there; continuing would
#                             found the second cluster, which is the expensive
#                             error this whole module exists to prevent.
#   refuse, probe DID NOT RUN probe-failed, dwell-too-short.
#                             -> say so LOUDLY, name the reason on screen, and
#                             fall back to the declared ISO default. That is
#                             byte-for-byte today's behaviour; what changes is
#                             that the non-result is NAMED instead of silently
#                             reading as "no cluster". ZETA_DISCOVERY_REQUIRED=1
#                             turns the fallback into a halt for operators who
#                             would rather stop than proceed unchecked.
#
# Knobs, all env-overridable in the systemd unit or from a shell:
#   ZETA_DISCOVERY=off             skip the probe entirely (reported as a
#                                  check that did not run, not one that passed)
#   ZETA_DISCOVERY_DWELL_MS        default 30000, the decider's honest floor
#   ZETA_DISCOVERY_ACK_SHORT_DWELL=1  acknowledge a dwell below that floor;
#                                  WITHOUT it a short dwell refuses rather than
#                                  letting a two-second silence read as absence
#   ZETA_DISCOVERY_REQUIRED=1      a probe that could not run halts the install
ZETA_DISCOVERY="${ZETA_DISCOVERY:-auto}"
ZETA_DISCOVERY_DWELL_MS="${ZETA_DISCOVERY_DWELL_MS:-30000}"
ZETA_DISCOVERY_ACK_SHORT_DWELL="${ZETA_DISCOVERY_ACK_SHORT_DWELL:-0}"
ZETA_DISCOVERY_REQUIRED="${ZETA_DISCOVERY_REQUIRED:-0}"

# Halt path: a cluster was heard and this node may not join it. Refusing to
# act is the whole point, so this does NOT time out into a default.
zeta_discovery_halt() {
  echo
  echo "  ╭─ CLUSTER DISCOVERY REFUSED ─────────────────────────────╮"
  echo "  │ reason:   ${1}"
  echo "  │ detail:   ${2}"
  echo "  │ operator: ${3}"
  echo "  ╰─────────────────────────────────────────────────────────╯"
  echo
  echo "[zeta-discovery] NOT installing, and NOT founding a cluster."
  echo "[zeta-discovery] Something already answers on this segment. This stick"
  echo "[zeta-discovery] carries only the ISO build-time default (control-plane),"
  echo "[zeta-discovery] which nobody chose for THIS node, so proceeding would"
  echo "[zeta-discovery] create a second cluster that is undone by hand."
  echo "[zeta-discovery]"
  # B5: this used to print `zflash --role ...` as the remedy. NO DEVICE-FLASHING
  # ENTRYPOINT ACCEPTS `--role`. `cli.ts` and `flash-usb.ts` both run a strict
  # allowlist and exit 2 on an unknown flag; only `file-backed.ts` takes `--role`,
  # and it writes an IMAGE FILE (`--iso ... --output raw.img --esp-offset-bytes`),
  # not a stick. So the one instruction given to an operator at the moment they
  # are blocked named a command that cannot be run on the medium in their hand.
  #
  # The keystroke prompt above IS a real declaration path -- it sets
  # ZETA_ROLE_SOURCE=keystroke:c|w, which `ZETA_ROLE_DECLARED` accepts exactly as
  # it accepts esp:*. That is what the remedy names now.
  echo "[zeta-discovery] Declare the role explicitly, then re-run the install:"
  echo "[zeta-discovery]   reboot this medium and press 'c' (control-plane) or"
  echo "[zeta-discovery]   'w' (worker-gpu/joiner) at the ${ROLE_PROMPT_SECS}s role prompt."
  echo "[zeta-discovery]   A keypress counts as DECLARED; the ISO default does not."
  echo "[zeta-discovery]"
  echo "[zeta-discovery] NOTE: the device-flashing tools do NOT accept a role flag."
  echo "[zeta-discovery] --role / --join-server-url / --join-token are taken only by"
  echo "[zeta-discovery] src/Core.TypeScript/zflash/file-backed.ts, which builds an"
  echo "[zeta-discovery] IMAGE (--output raw.img), not a flashed stick. Joining a node"
  echo "[zeta-discovery] to an existing cluster from a device flash is NOT WIRED (B5)."
  echo "[zeta-discovery] Or press on manually from the shell below."
  drop_to_shell
}

# Loud fallback: the probe could not run. Names the non-result rather than
# letting it read as silence.
zeta_discovery_could_not_run() {
  echo "[zeta-discovery] DISCOVERY DID NOT RUN: ${1}"
  echo "[zeta-discovery] This is a check that did not run, NOT a check that passed."
  echo "[zeta-discovery] The segment was never observed, so nothing here says the"
  echo "[zeta-discovery] network is empty."
  if [[ "${ZETA_DISCOVERY_REQUIRED}" == "1" ]]; then
    echo "[zeta-discovery] ZETA_DISCOVERY_REQUIRED=1 -> halting rather than guessing."
    drop_to_shell
  fi
  echo "[zeta-discovery] Falling back to the ISO default role: ${HOST} (role=${ZETA_ROLE})."
}

echo
echo "[zeta-discovery] bootstrap-or-join check"
if [[ "${ZETA_ROLE_DECLARED}" == "yes" ]]; then
  echo "[zeta-discovery] SKIPPED — the role was DECLARED (${ZETA_ROLE_SOURCE})."
  echo "[zeta-discovery] An explicit declaration always wins over discovery."
elif [[ "${ZETA_DISCOVERY}" == "off" ]]; then
  zeta_discovery_could_not_run "disabled by ZETA_DISCOVERY=off"
elif ! command -v zeta-cluster-discover >/dev/null 2>&1; then
  # An older ISO without the discover package. Absence of the tool is a
  # non-result, never an empty network.
  zeta_discovery_could_not_run "zeta-cluster-discover is not on PATH"
else
  # Whether a join token EXISTS. `-s` is a size test; the file is never read,
  # so no secret can reach a flag, a log line or a crash trace.
  ZETA_DISCOVERY_TOKEN_PRESENT=false
  if [[ -n "${ZETA_JOIN_TOKEN_ESP_PATH:-}" ]] && [[ -s "${ZETA_JOIN_TOKEN_ESP_PATH}" ]]; then
    ZETA_DISCOVERY_TOKEN_PRESENT=true
  fi

  DISCOVER_ARGS=(
    "--dwell-ms=${ZETA_DISCOVERY_DWELL_MS}"
    "--token-present=${ZETA_DISCOVERY_TOKEN_PRESENT}"
  )
  if [[ "${ZETA_DISCOVERY_ACK_SHORT_DWELL}" == "1" ]]; then
    DISCOVER_ARGS+=("--acknowledge-short-dwell=true")
  fi

  echo "[zeta-discovery] probing for ${ZETA_DISCOVERY_DWELL_MS}ms (token-present=${ZETA_DISCOVERY_TOKEN_PRESENT}) ..."
  # stdout is the JSON decision; stderr is the decider's notes, which pass
  # straight through to tty1 and the serial mirror on purpose.
  DISCOVER_JSON=""
  DISCOVER_RC=0
  DISCOVER_JSON=$(zeta-cluster-discover "${DISCOVER_ARGS[@]}") || DISCOVER_RC=$?

  DISCOVER_ACTION=$(printf '%s' "${DISCOVER_JSON}" | jq -r '.action // "unparseable"' 2>/dev/null || printf 'unparseable')
  DISCOVER_REASON=$(printf '%s' "${DISCOVER_JSON}" | jq -r '.reason // "unknown"' 2>/dev/null || printf 'unknown')

  case "${DISCOVER_RC}:${DISCOVER_ACTION}" in
    0:bootstrap)
      echo "[zeta-discovery] BOOTSTRAP — nothing answered, and the silence passed"
      echo "[zeta-discovery] the admissibility check. Keeping role ${HOST} (${ZETA_ROLE})."
      ;;
    0:join)
      # Reachable only when a token exists. Today an ESP conf is what carries a
      # token path, and an ESP conf also sets ZETA_ROLE_SOURCE=esp:* which makes
      # the role DECLARED and skips this whole block -- so this branch does not
      # fire on any medium zflash currently writes. It is implemented rather
      # than stubbed because the decider can return it and a call site that
      # cannot handle a documented outcome is a latent silent failure.
      DISCOVER_URL=$(printf '%s' "${DISCOVER_JSON}" | jq -r '.serverUrl // ""' 2>/dev/null || printf '')
      if [[ -z "${DISCOVER_URL}" ]]; then
        zeta_discovery_halt "join-without-endpoint" \
          "the decider returned action=join with no serverUrl" \
          "treat the decider output as broken; do not read this as an empty network"
      fi
      HOST=worker-gpu
      ZETA_ROLE=joiner
      export ZETA_ROLE
      export ZETA_JOIN_SERVER_URL="${DISCOVER_URL}"
      echo "[zeta-discovery] JOIN — one cluster answered and a token for it exists."
      echo "[zeta-discovery] role=${ZETA_ROLE} host=${HOST} server=${ZETA_JOIN_SERVER_URL}"
      ;;
    3:refuse)
      DISCOVER_DETAIL=$(printf '%s' "${DISCOVER_JSON}" | jq -r '.detail // ""' 2>/dev/null || printf '')
      DISCOVER_ACTION_HINT=$(printf '%s' "${DISCOVER_JSON}" | jq -r '.operatorAction // ""' 2>/dev/null || printf '')
      case "${DISCOVER_REASON}" in
        # The probe could not produce an observation. NOT an empty network.
        probe-failed|dwell-too-short)
          zeta_discovery_could_not_run "${DISCOVER_REASON}: ${DISCOVER_DETAIL}"
          ;;
        # Something ANSWERED and this node may not join it. Opposite of above.
        *)
          zeta_discovery_halt "${DISCOVER_REASON}" "${DISCOVER_DETAIL}" "${DISCOVER_ACTION_HINT}"
          ;;
      esac
      ;;
    *)
      # Exit 2 (bad arguments), an unparseable line, or an exit code the
      # contract does not define. Never folded into silence.
      zeta_discovery_could_not_run "unexpected exit ${DISCOVER_RC} action=${DISCOVER_ACTION}"
      ;;
  esac
fi
echo

echo
echo "[3/3] Running zeta-install $HOST (non-interactive) ..."
echo
# Non-interactive env-var trio: bypass every interactive prompt
# zeta-install would otherwise hit.
#   BOOT_DISK=auto      -> resolves to fastest internal disk (NVMe>SSD>HDD)
#   ZETA_AUTO_CONFIRM=WIPE -> skip the typed-WIPE confirmation
#   HOST passed as positional arg -> skip the host prompt
#
# CORRECTED 2026-08-21. This comment used to read: "Operator destructive-
# install consent is the 10-second role keystroke window above + the device-
# list display zeta-install prints before wiping (Ctrl-C window)."
#
# That described a window that did not exist. There was no sleep between the
# device list and wipefs, so the Ctrl-C window was zero-width, and the role
# keystroke window is a ROLE prompt, not a wipe prompt. A comment asserting a
# guarantee the code does not provide is the failure class this repo is built
# around, so it is named here rather than quietly replaced.
#
# What the consent actually is NOW: zeta-install Step 2.5 probes each in-scope
# disk read-only and prints what is on it, then Step 2.9 runs a real countdown
# (default 60s, 10s when every in-scope disk probes blank) whose default is
# PROCEED and where any keypress aborts to a shell. That countdown runs on
# THIS path too, which is why the zero-typing install still costs the window.
# ZETA_AUTO_CONFIRM=WIPE skips the TYPED prompt; it does not skip the window.
#
# Flash-time consent is still NOT delegated to boot time. The gate is at boot,
# on screen, with the device findings visible.
export ZETA_AUTO_CONFIRM=WIPE
export BOOT_DISK=auto
export HOST
export REPO_URL
# WP21 (081M35C7NJR087G0R002S4R654): sourced (not exported) by either
# conf above, so the child zeta-install process would not see it without
# this -- same "sourced vars need an explicit export" note as the bao pair
# above. Empty is a valid value (no pin); zeta-install.sh's repo-pin block
# treats that as today's unpinned behaviour. ZETA_ALLOW_REPO_DRIFT is an
# operator override, set in THIS process's own environment (not written by
# either conf), so it passes through unchanged.
export ZETA_ISO_COMMIT="${ZETA_ISO_COMMIT:-}"
export ZETA_ALLOW_REPO_DRIFT="${ZETA_ALLOW_REPO_DRIFT:-}"
# WP28 (081M393B9TB087G0R000Y529Z8): the same pass-through, for the Longhorn
# capacity override. zeta-install.sh REFUSES before the wipe when the disk
# cannot hold the committed roster's driver.longhorn.io PVCs, and refuses again
# when it cannot hold the root floor; both are cleared by this one variable,
# which names the debt rather than hiding it (the arithmetic still prints).
#
# It is a PASS-THROUGH and nothing else. This line sets no policy: an unset
# value stays unset and the installer refuses exactly as it would on a real
# machine. It exists so that a deliberately-small disk -- the QEMU install
# lanes' 40/64 GiB virtual disk, sized for install MECHANICS rather than for
# the roster -- can name the override on the ESP conf or in this process's
# environment and have it actually REACH the installer. Sourced vars need an
# explicit export, same note as the pair above.
#
# Deliberately NOT baked into the ISO's own /etc/zeta-firstboot.conf: that file
# ships on every USB, so a value there would clear the guard for every operator
# install as well, which is the guard deleting itself.
export ZETA_ALLOW_LONGHORN_UNDERSIZED="${ZETA_ALLOW_LONGHORN_UNDERSIZED:-}"
# zeta-install handles the rest: disk enum → wipe → partition →
# format → mount → clone → nixos-install. Exits with the OS still
# booted in the USB live environment; this script then reboots so
# the freshly installed node comes up on its own disk.
# Three outcomes, not two. zeta-install exits 10 when the OPERATOR cancelled at
# the R7 window -- distinct from both success and failure. It used to exit 0
# there, which this `if` reported as "Install complete. Rebooting in 10s": a
# deliberate abort announced as a finished install, then a reboot. Collapsing a
# cancel into "failed" would be the milder version of the same lie, so it gets
# its own branch and does NOT reboot.
set +e
/run/current-system/sw/bin/zeta-install "$HOST"
ZETA_INSTALL_RC=$?
set -e
if [ "$ZETA_INSTALL_RC" = "0" ]; then
  echo
  echo "[zeta-first-boot] Install complete. Rebooting in 10s (Ctrl-C to cancel) ..."
  sleep 10
  systemctl reboot
elif [ "$ZETA_INSTALL_RC" = "10" ]; then
  echo
  echo "[zeta-first-boot] CANCELLED at the pre-wipe window. Nothing was wiped."
  echo "                  This node is unchanged. Re-run when ready: zeta-install $HOST"
  drop_to_shell
else
  echo
  echo "[zeta-first-boot] Install failed (rc=$ZETA_INSTALL_RC). See output above."
  drop_to_shell
fi
