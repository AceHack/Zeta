#!/usr/bin/env bash
# zeta-install — greedy N-disk installer for the AI cluster.
#
# Lives on the USB at /run/current-system/sw/bin/zeta-install (installed
# by the installer's configuration.nix). Walks through:
#
#   1. Enumerate ALL internal disks (NVMe, SATA SSD, HDD, SAS, etc.;
#      USB + removable + read-only excluded automatically)
#   2. Sort by speed class (NVMe first, then SSDs, then HDDs)
#   3. Pick the fastest disk as the BOOT disk (override via $BOOT_DISK
#      or interactive prompt; "auto" is the explicit default form)
#   4. Confirm full wipe (typed confirmation required; bypass via
#      ZETA_AUTO_CONFIRM=WIPE for non-interactive first-boot / QEMU CI —
#      also skips iter-5.3 password, 081KSKBP80008QG0R003AX2A69.3b passphrase, gh-auth, vendor logins)
#   5. Wipe + partition:
#        BOOT disk: ESP 1G + root (max — fills disk) + longhorn1 (1G tail);
#        no fixed root cap; layout is chosen at install-time partition (Step 4)
#        DATA disks: each becomes a single longhorn{2..N} whole-disk
#   6. Format (FAT32 ESP + ext4 root + ext4 longhorn{1..N})
#   7. Mount per the standard /mnt/var/lib/longhorn-disk{1..N} layout
#   8. Clone Zeta + nixos-install for the chosen host
#
# Storage backend is currently Longhorn (ext4 + mount at standard
# paths). Ceph/Rook is the planned alternative (B-future): takes the
# same data-disk slots but manages them as raw block devices. When
# that lands, set STORAGE_BACKEND=ceph to switch the formatting
# strategy. For now only `longhorn` (default) is implemented.

set -euo pipefail

# ── 081KSGS9H0008QG0R001RR3ZXQ install log preservation ─────────────────────────────────
# Tee all output to a log file so operator can review post-failure
# (failures + warnings scroll past faster than human read speed under
# load — empirical from 2026-05-26 physical hardware-support test).
# Two destinations:
#   1. /tmp/zeta-install-<timestamp>.log on the live ISO — available
#      for `cat | less` AFTER the script exits (success OR failure),
#      until reboot
#   2. /mnt/var/log/zeta-install.log on the install target — copied
#      from #1 at end of script IF /mnt is mounted; preserved on the
#      installed system for post-boot inspection via journalctl OR
#      `cat /var/log/zeta-install.log`
# Operators can also `tail -f /tmp/zeta-install-*.log | less` from
# another tty (Ctrl-Alt-F2) to scrollback in real-time.
ZETA_INSTALL_LOG="${ZETA_INSTALL_LOG:-/tmp/zeta-install-$(date -u +%Y%m%dT%H%M%SZ).log}"
exec > >(tee -a "$ZETA_INSTALL_LOG") 2>&1
echo "[081KSGS9H0008QG0R001RR3ZXQ] install log → $ZETA_INSTALL_LOG"
echo "[081KSGS9H0008QG0R001RR3ZXQ] tail -f $ZETA_INSTALL_LOG | less   # from another tty for scrollback"
echo "[081KSGS9H0008QG0R001RR3ZXQ] cat $ZETA_INSTALL_LOG | less       # after script exits"
echo

REPO_URL="${REPO_URL:-https://github.com/Lucent-Financial-Group/Zeta}"
HOST="${1:-}"
STORAGE_BACKEND="${STORAGE_BACKEND:-longhorn}"
# Minimum longhorn1 slice at the disk tail (root takes everything between ESP and this).
LONGHORN1_TAIL="${LONGHORN1_TAIL:-1G}"

bail() { echo "ERROR: $*" >&2; exit 1; }

# Operator-facing prompts run only on an interactive console session.
# ZETA_AUTO_CONFIRM=WIPE (first-boot / QEMU CI via zeta-first-boot.sh) and
# non-TTY stdin both suppress them — iter-5.3 password, 081KSKBP80008QG0R003AX2A69.3b passphrase,
# iter-5.4.0 gh-auth, iter-5.5.0 vendor logins.
zeta_install_prompts_enabled() {
  [[ "${ZETA_AUTO_CONFIRM:-}" != "WIPE" ]] && [[ -t 0 ]]
}

# sgdisk size specs (1G, 512M, …) → bytes for pre-wipe capacity checks.
size_spec_to_bytes() {
  local spec="$1"
  local num="${spec%[KkMmGgTt]}"
  local unit="${spec:${#num}}"
  [[ "$num" =~ ^[0-9]+$ ]] || bail "invalid LONGHORN1_TAIL size spec: $spec"
  case "${unit^^}" in
    K) echo $((num * 1024)) ;;
    M) echo $((num * 1024 * 1024)) ;;
    G) echo $((num * 1024 * 1024 * 1024)) ;;
    T) echo $((num * 1024 * 1024 * 1024 * 1024)) ;;
    *) bail "invalid LONGHORN1_TAIL unit in spec: $spec (use K/M/G/T suffix)" ;;
  esac
}

LONGHORN1_TAIL_BYTES="$(size_spec_to_bytes "$LONGHORN1_TAIL")"
if (( LONGHORN1_TAIL_BYTES < 1024 * 1024 * 1024 )); then
  bail "LONGHORN1_TAIL=$LONGHORN1_TAIL too small (need >= 1G for longhorn1 tail)"
fi
if (( LONGHORN1_TAIL_BYTES > 1024 * 1024 * 1024 * 1024 )); then
  bail "LONGHORN1_TAIL=$LONGHORN1_TAIL too large (max 1T tail slice)"
fi

# /dev/nvme0n1 → /dev/nvme0n1p1; /dev/sda → /dev/sda1.
# NVMe + mmcblk + loop + md devices use the 'p' partition suffix;
# SATA/SAS/USB devices don't. The heuristic matches kernel naming.
part_name() {
  local disk="$1" n="$2"
  if [[ "$disk" =~ (nvme[0-9]+n[0-9]+|mmcblk[0-9]+|loop[0-9]+|md[0-9]+)$ ]]; then
    echo "${disk}p${n}"
  else
    echo "${disk}${n}"
  fi
}

# Class string for display + sort key. NVMe < SSD < HDD by speed.
disk_class() {
  local disk="$1"
  local tran rota
  tran=$(lsblk -d -n -o TRAN "$disk" 2>/dev/null | tr -d ' ')
  rota=$(lsblk -d -n -o ROTA "$disk" 2>/dev/null | tr -d ' ')
  if [[ "$tran" == "nvme" ]]; then echo "NVMe"
  elif [[ "$rota" == "0" ]]; then echo "SSD"
  else echo "HDD"
  fi
}

# Pre-wipe sanity check: ESP 1G + root (>=4G) + configured longhorn1 tail.
assert_boot_disk_large_enough() {
  local disk="$1"
  local disk_bytes esp_bytes min_root_bytes min_total_bytes
  disk_bytes=$(blockdev --getsize64 "$disk")
  esp_bytes=$((1024 * 1024 * 1024))
  min_root_bytes=$((4 * 1024 * 1024 * 1024))
  min_total_bytes=$((esp_bytes + min_root_bytes + LONGHORN1_TAIL_BYTES))
  if (( disk_bytes < min_total_bytes )); then
    bail "BOOT disk $disk too small for ESP 1G + root + longhorn1 ${LONGHORN1_TAIL} (need >= $(( (min_total_bytes + 1024*1024*1024 - 1) / (1024*1024*1024) ))G, have $(lsblk -d -n -o SIZE "$disk"))"
  fi
}

# ── Step 1: enumerate internal disks ──────────────────────────────
# Fixed (RM=0), writable (RO=0), type=disk, NOT USB. Includes NVMe,
# SATA, SAS, RAID volumes, etc. Excludes loop, removable, read-only.
echo "Internal storage devices (fixed; USB excluded):"
mapfile -t ALL_DISKS < <(
  lsblk -d -p -n -o NAME,TYPE,RM,RO,TRAN |
    awk '$2=="disk" && $3==0 && $4==0 && $5!="usb" {print $1}'
)
if [[ ${#ALL_DISKS[@]} -eq 0 ]]; then
  bail "no internal disks found; cannot install"
fi

# Sort by speed class (NVMe, SSD, HDD), preserving discovery order
# within each class.
declare -a SORTED=()
for class in NVMe SSD HDD; do
  for d in "${ALL_DISKS[@]}"; do
    if [[ "$(disk_class "$d")" == "$class" ]]; then
      SORTED+=("$d")
    fi
  done
done

for d in "${SORTED[@]}"; do
  size=$(lsblk -d -n -o SIZE "$d")
  model=$(lsblk -d -n -o MODEL "$d" | tr -s ' ')
  serial=$(lsblk -d -n -o SERIAL "$d")
  class=$(disk_class "$d")
  printf "  %-20s  %-4s  %8s  %s  serial=%s\n" "$d" "$class" "$size" "$model" "$serial"
done
echo

# ── Step 2: pick BOOT disk; everything else becomes DATA ──────────
# Default: fastest disk (SORTED[0]) is BOOT. Override via $BOOT_DISK
# env; value "auto" is the explicit form of the default.
DEFAULT_BOOT="${SORTED[0]}"
if [[ -z "${BOOT_DISK:-}" ]]; then
  read -rp "Which disk is the BOOT disk (gets OS + first Longhorn path)? [$DEFAULT_BOOT]: " BOOT_DISK
  BOOT_DISK="${BOOT_DISK:-$DEFAULT_BOOT}"
elif [[ "$BOOT_DISK" == "auto" ]]; then
  BOOT_DISK="$DEFAULT_BOOT"
fi

# Validate the chosen BOOT_DISK is in our enumerated set.
BOOT_OK=0
for d in "${SORTED[@]}"; do [[ "$d" == "$BOOT_DISK" ]] && BOOT_OK=1; done
[[ "$BOOT_OK" -eq 1 ]] || bail "BOOT_DISK $BOOT_DISK not in internal-disk set: ${SORTED[*]}"

# DATA_DISKS = everything except BOOT_DISK, preserving sort order.
DATA_DISKS=()
for d in "${SORTED[@]}"; do
  [[ "$d" != "$BOOT_DISK" ]] && DATA_DISKS+=("$d")
done

echo
echo "About to FULL-WIPE the following disks:"
echo "  BOOT: $BOOT_DISK   (ESP 1G + root max + longhorn1 ${LONGHORN1_TAIL} tail)"
if [[ ${#DATA_DISKS[@]} -eq 0 ]]; then
  echo "  DATA: (none — single-disk install; only longhorn1 on boot disk)"
else
  data_i=2
  for d in "${DATA_DISKS[@]}"; do
    echo "  DATA: $d   (whole disk → longhorn${data_i})"
    data_i=$((data_i + 1))
  done
fi
echo
echo "Storage backend: $STORAGE_BACKEND"
if [[ "$STORAGE_BACKEND" != "longhorn" ]]; then
  bail "STORAGE_BACKEND=$STORAGE_BACKEND not yet implemented (only 'longhorn' supported today; ceph/rook is B-future)"
fi
echo

# Non-interactive mode: ZETA_AUTO_CONFIRM=WIPE bypasses the typed-
# confirmation prompt. Used by the first-boot systemd service when
# the operator already accepted destructive intent at flash time
# (per 081KSGS9H0008QG0R002T3BJ2R zero-typing-USB-install design). Direct interactive
# use still requires the typed WIPE.
if [[ "${ZETA_AUTO_CONFIRM:-}" == "WIPE" ]]; then
  echo "[ZETA_AUTO_CONFIRM=WIPE] non-interactive mode; proceeding without prompt"
else
  read -rp "Type WIPE to confirm: " confirm
  [[ "$confirm" == "WIPE" ]] || bail "aborted"
fi

# Validate BOOT disk fits the layout before any destructive work.
assert_boot_disk_large_enough "$BOOT_DISK"

# ── Step 3: wipe every disk in scope ──────────────────────────────
for d in "$BOOT_DISK" "${DATA_DISKS[@]}"; do
  echo "Wiping $d ..."
  sudo wipefs -af "$d"
  sudo sgdisk --zap-all "$d"
done

# ── Step 4: partition ─────────────────────────────────────────────
# Install-time only: root fills the BOOT disk (no fixed size cap). sgdisk end
# code -${LONGHORN1_TAIL} reserves the longhorn1 tail; partition 3 takes it.
echo "Partitioning $BOOT_DISK (ESP 1G + root max + longhorn1 ${LONGHORN1_TAIL} tail) ..."
sudo sgdisk -n "1:0:+1G"                    -t 1:ef00 -c 1:ESP        "$BOOT_DISK"
sudo sgdisk -n "2:0:-${LONGHORN1_TAIL}"     -t 2:8300 -c 2:root       "$BOOT_DISK"
sudo sgdisk -n "3:0:0"                      -t 3:8300 -c 3:longhorn1  "$BOOT_DISK"

i=2
for d in "${DATA_DISKS[@]}"; do
  echo "Partitioning $d (whole disk → longhorn${i}) ..."
  sudo sgdisk -n "1:0:0" -t 1:8300 -c "1:longhorn${i}" "$d"
  i=$((i + 1))
done

# Per-device partprobe: bare `partprobe` (no args) probes EVERY
# block device the kernel knows about, including the USB stick we
# booted from (kernel typically exposes USB mass-storage as
# /dev/sdX — commonly /dev/sda on boards with no SATA disks; the
# specific letter isn't guaranteed across hardware/boot order, but
# the failure mode is the same regardless of letter). The booted
# ISO has mounted partitions on that sdX device; partprobe rightfully
# refuses to refresh those + returns non-zero; `set -euo pipefail`
# then bails the whole install. Fix per 081KSGS9H0008QG0R002T3BJ2R iter-3 empirical
# anchor: pass only the disks WE just partitioned, with an explicit
# per-disk failure handler so the abort message names the offending
# disk + suggests next steps (vs silent set -euo pipefail bail).
echo "Refreshing kernel partition table for installed disks ..."
sudo partprobe "$BOOT_DISK" || bail "partprobe failed for BOOT disk $BOOT_DISK — check 'dmesg | tail' for kernel detail; manual recovery: 'sudo partprobe $BOOT_DISK' then 'lsblk' to verify partition table"
for d in "${DATA_DISKS[@]}"; do
  sudo partprobe "$d" || bail "partprobe failed for DATA disk $d — check 'dmesg | tail'; manual recovery: 'sudo partprobe $d' then 'lsblk' to verify partition table"
done
sleep 2

# ── Step 5: format + mount ────────────────────────────────────────
ESP_PART=$(part_name "$BOOT_DISK" 1)
ROOT_PART=$(part_name "$BOOT_DISK" 2)
LH1_PART=$(part_name "$BOOT_DISK" 3)

echo "Formatting ..."
sudo mkfs.fat -F 32 -n boot "$ESP_PART"
sudo mkfs.ext4 -F -L nixos     "$ROOT_PART"
sudo mkfs.ext4 -F -L longhorn1 "$LH1_PART"

i=2
for d in "${DATA_DISKS[@]}"; do
  lhp=$(part_name "$d" 1)
  echo "Formatting $lhp as longhorn${i} ..."
  sudo mkfs.ext4 -F -L "longhorn${i}" "$lhp"
  i=$((i + 1))
done

echo "Mounting ..."
sudo mount "$ROOT_PART" /mnt
sudo mkdir -p /mnt/boot /mnt/var/lib/longhorn-disk1
sudo mount "$ESP_PART" /mnt/boot
sudo mount "$LH1_PART" /mnt/var/lib/longhorn-disk1

i=2
for d in "${DATA_DISKS[@]}"; do
  lhp=$(part_name "$d" 1)
  mp="/mnt/var/lib/longhorn-disk${i}"
  sudo mkdir -p "$mp"
  sudo mount "$lhp" "$mp"
  i=$((i + 1))
done

# ── Step 6: clone + install ───────────────────────────────────────
#
# 081KSKBP80008QG0R002J03WGA.X (cluster-type menu extension, 2026-05-27): replace the
# bare free-text prompt with a numbered menu + hardware-detection
# suggested default. Existing free-text override preserved as
# "other" option for advanced cases (custom flake host attribute
# added to nixos/hosts/<name>/ but not yet in the menu).
#
# Hardware-detection heuristic (suggested default):
#   - lspci shows NVIDIA / AMD / Intel GPU       -> worker-gpu
#   - default                                    -> control-plane
#
# Multi-role-on-single-host support (operator 2026-05-27: "letting
# you select multiple or detecting based on hardware etc..."):
# the current flake assigns one host attribute per node; multi-role
# compose-on-single-host is a future 081KSGS9H0008QG0R003V23XNZ-extension sub-row
# (requires flake-shape refactor to support role-tagging). This
# iteration ships the single-attribute menu; the multi-role
# composition follows when the flake substrate supports it.
if [[ -z "$HOST" ]]; then
  # 081KDWYPGV008QG0R00072K2NH-wire (2026-05-27): hardware-detection now routed through
  # the TS module at tools/installer/zeta-hardware-detect.ts (PR #5642).
  # Logic ported there per Rule 0 TS-over-bash discipline + extended
  # with storage-shape (≥4 disks + ≥64GB → worker-template) and
  # CPU-heavy (≥16 cores + ≥32GB → worker-template) classification
  # beyond the original GPU-only inline lspci heuristic.
  #
  # The TS module needs (a) bun on PATH AND (b) a reachable repo
  # checkout. zeta-install.sh runs from a live USB; the source repo
  # is typically two dirs up from the script location
  # (full-ai-cluster/usb-nixos-installer/zeta-install.sh → repo root).
  # If either precondition fails, fall back to the original inline
  # lspci-only heuristic so the menu still works in degraded environments.
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  HWDETECT_REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
  HWDETECT_TS="$HWDETECT_REPO_ROOT/tools/installer/zeta-hardware-detect.ts"
  SUGGESTED_HOST=""
  SUGGESTED_REASON=""
  if command -v bun >/dev/null 2>&1 && [ -f "$HWDETECT_TS" ]; then
    # TS module emits one line: the suggested host attribute.
    # Capture stderr separately so module diagnostics don't leak into HOST var.
    SUGGESTED_HOST="$(bun "$HWDETECT_TS" --suggested-host 2>/dev/null | tr -d '[:space:]' || true)"
    if [ -n "$SUGGESTED_HOST" ]; then
      SUGGESTED_REASON="(via zeta-hardware-detect.ts; GPU+storage+CPU classification)"
    fi
  fi
  if [ -z "$SUGGESTED_HOST" ]; then
    # Fallback: original inline lspci-only heuristic (degraded — GPU only).
    SUGGESTED_HOST="control-plane"
    if command -v lspci >/dev/null 2>&1; then
      if lspci 2>/dev/null | grep -qiE "(nvidia|vga.*amd|3d.*amd|vga.*intel.*arc|3d.*intel.*arc)"; then
        SUGGESTED_HOST="worker-gpu"
      fi
    fi
    SUGGESTED_REASON="(fallback inline lspci heuristic — bun or TS module unavailable)"
  fi
  echo
  echo "Cluster node type — select host attribute from the flake:"
  echo
  echo "  1) control-plane    K3S server + Cilium + ArgoCD bootstrap"
  echo "                      (Longhorn storage + cpu workloads also run here)"
  echo "  2) worker-gpu       GPU worker (NVIDIA passthrough + device-plugin"
  echo "                      + Longhorn storage)"
  echo "  3) worker-template  Cookie-cutter worker (multi-disk Longhorn;"
  echo "                      use after copying to nixos/hosts/worker-NN/"
  echo "                      per PROVISIONING.md)"
  echo "  4) other            type a custom flake host attribute (advanced;"
  echo "                      for hosts added under nixos/hosts/ + wired"
  echo "                      into flake.nix nixosConfigurations)"
  echo
  echo "Hardware detection suggests: $SUGGESTED_HOST  $SUGGESTED_REASON"
  case "$SUGGESTED_HOST" in
    worker-gpu)
      echo "  (GPU detected — likely worker node, not control-plane)"
      ;;
    worker-template)
      echo "  (storage-heavy OR CPU-heavy node — use worker-template + customize"
      echo "   per PROVISIONING.md cookie-cutter workflow)"
      ;;
    *)
      echo "  (no GPU + not storage/CPU-heavy — defaulting to control-plane;"
      echo "   override below if this is a dedicated CPU-only worker)"
      ;;
  esac
  echo
  # Default menu choice maps to suggested host.
  DEFAULT_CHOICE="1"
  case "$SUGGESTED_HOST" in
    control-plane)   DEFAULT_CHOICE="1" ;;
    worker-gpu)      DEFAULT_CHOICE="2" ;;
    worker-template) DEFAULT_CHOICE="3" ;;
  esac
  read -rp "Choice [1-4, default=$DEFAULT_CHOICE]: " MENU_CHOICE
  MENU_CHOICE="${MENU_CHOICE:-$DEFAULT_CHOICE}"
  case "$MENU_CHOICE" in
    1) HOST="control-plane" ;;
    2) HOST="worker-gpu" ;;
    3) HOST="worker-template" ;;
    4)
      read -rp "Custom flake host attribute: " HOST
      if [ -z "$HOST" ]; then
        echo "[ERROR] custom host attribute cannot be empty; aborting" >&2
        exit 1
      fi
      ;;
    *)
      echo "[ERROR] invalid choice '$MENU_CHOICE' (expected 1-4); aborting" >&2
      exit 1
      ;;
  esac
  echo "Selected: $HOST"
fi

echo "Cloning $REPO_URL ..."
sudo git clone "$REPO_URL" /mnt/etc/zeta

echo "Generating hardware-configuration.nix ..."
sudo nixos-generate-config --root /mnt --force
# 081KSNY2Z0008QG0R0008PN7RQ / 081KSGS9H0008QG0R0011BC7T2: flake hosts import ./hardware-configuration.nix from the
# repo tree (stub until replaced). Without this copy, nixos-install bakes the
# placeholder (no virtio_blk in initrd) and QEMU phase-2 UEFI boot hangs after
# earlycon when root is on virtio (CI run 27598982580).
HW_SRC="/mnt/etc/nixos/hardware-configuration.nix"
HW_DST="/mnt/etc/zeta/full-ai-cluster/nixos/hosts/${HOST}/hardware-configuration.nix"
if [ -f "$HW_SRC" ] && [ -e "$HW_DST" ]; then
  echo "[iter-5.1] installing probe-generated hardware-configuration.nix for ${HOST} ..."
  sudo cp "$HW_SRC" "$HW_DST"
else
  echo "[iter-5.1] WARN: hardware-configuration not copied (src=${HW_SRC} dst=${HW_DST})" >&2
fi

# ── Step 6.5: iter-4.2 probe boot USB for operator SSH pubkey ────
# Per 081KSGS9H0008QG0R002T3BJ2R: zflash on macOS writes ~/.ssh/id_ed25519.pub to the
# boot USB's FAT ESP as `zeta-authorized-keys.pub`. Find it + inject
# into operator-ssh-keys.nix before nixos-install so the freshly-
# installed system has SSH access on first boot. Diagnostics auto-run
# on failure (photo-friendly per the maintainer's 2026-05-26
# discipline); fallback path = iter-4 v1 manual edit + nixos-rebuild
# after first login.
echo
echo "[iter-4.2] probing boot USB for operator SSH pubkey ..."
# Per #5086 readFile redesign: write the pubkey content directly to
# operator-ssh-keys.txt; the sibling operator-ssh-keys.nix reads via
# builtins.readFile. NO Nix string parsing of USB-supplied content
# → zero injection surface, zero escaping complexity.
PUBKEY_DST="/mnt/etc/zeta/full-ai-cluster/nixos/modules/operator-ssh-keys.txt"
PROBE_MOUNT="/tmp/zeta-boot-esp"
sudo mkdir -p "$PROBE_MOUNT"

PUBKEY_FILE=""
INJECT_OK=0
BOOT_USB_CREDS_PRESEEDED=0

# Try 1: scan already-mounted filesystems.
# Per #5083 Copilot P0: under `set -euo pipefail`, `find` exits non-zero
# if any start-path doesn't exist (e.g., `/iso` on some installers),
# aborting the whole install. Filter to existing dirs first.
SEARCH_DIRS=()
for d in /iso /run /mnt /boot; do
  [ -d "$d" ] && SEARCH_DIRS+=("$d")
done
if [ ${#SEARCH_DIRS[@]} -gt 0 ]; then
  PUBKEY_FILE=$(sudo find "${SEARCH_DIRS[@]}" \
    -maxdepth 5 -name "zeta-authorized-keys.pub" -type f 2>/dev/null | head -1 || true)
fi

# Try 2: probe likely-USB block devices for a FAT partition with the pubkey.
# Skip BOOT_DISK + DATA_DISKS (install targets).
if [ -z "$PUBKEY_FILE" ]; then
  echo "[iter-4.2]   not in mounted FS; probing USB partitions ..."
  for dev in /dev/sd? /dev/nvme?n? /dev/vd? /dev/mmcblk?; do
    [ -b "$dev" ] || continue
    [ "$dev" = "$BOOT_DISK" ] && continue
    skip=0
    for data in "${DATA_DISKS[@]}"; do
      [ "$dev" = "$data" ] && { skip=1; break; }
    done
    [ "$skip" = 1 ] && continue

    # Partition suffix is 1/2 on sd/vd; p1/p2 on nvme/mmcblk
    for partsfx in 2 1; do
      case "$dev" in
        /dev/nvme*|/dev/mmcblk*) part="${dev}p${partsfx}" ;;
        *) part="${dev}${partsfx}" ;;
      esac
      [ -b "$part" ] || continue
      if sudo mount -t vfat -o ro "$part" "$PROBE_MOUNT" 2>/dev/null; then
        if [ -f "$PROBE_MOUNT/zeta-authorized-keys.pub" ]; then
          PUBKEY_FILE="$PROBE_MOUNT/zeta-authorized-keys.pub"
          break 2
        fi
        sudo umount "$PROBE_MOUNT" 2>/dev/null || true
      fi
    done
  done
fi

if [ -n "$PUBKEY_FILE" ]; then
  echo "[iter-4.2]   found: $PUBKEY_FILE"

  # Per #5086 readFile redesign: write the USB pubkey content directly
  # to operator-ssh-keys.txt. The sibling operator-ssh-keys.nix reads
  # via builtins.readFile + splits on newlines + filters blank/comment
  # lines. NO Nix string parsing of USB content → no escaping needed
  # (eliminates the entire Nix-injection class, not just current vectors).
  #
  # Per #5083 Copilot P0 (still applies): read via `sudo cat` since the
  # pubkey file may live on a root-owned mount (/mnt/* or /tmp/zeta-boot-
  # esp); plain shell redirect would fail as the unprivileged user and
  # `set -e` would abort the install.
  PUBKEY_LINE_COUNT=$(sudo cat "$PUBKEY_FILE" | grep -c '^ssh-\|^ecdsa-sha2-\|^sk-ssh-\|^sk-ecdsa-sha2-' || true)
  {
    echo "# operator-ssh-keys.txt — populated by iter-4.2 zeta-install.sh"
    echo "# Source: $PUBKEY_FILE (boot USB ESP)"
    echo "# Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
    echo "#"
    echo "# Read by sibling operator-ssh-keys.nix via builtins.readFile."
    echo "# Edit + sudo nixos-rebuild switch --flake /etc/zeta/full-ai-cluster#<host>"
    echo "# to update without re-flashing the USB."
    echo
    sudo cat "$PUBKEY_FILE"
  } | sudo tee "$PUBKEY_DST" > /dev/null
  echo "[iter-4.2]   wrote $PUBKEY_LINE_COUNT pubkey line(s) to operator-ssh-keys.txt"

  # ── 081KSKBP80008QG0R003AX2A69.3a-prep: capture USB UUID for cred-blob binding ────
  # The 081KSKBP80008QG0R003AX2A69 cred-blob encryption derives its key from
  # HKDF(USB-UUID || stretched-passphrase, salt, info) per
  # tools/installer/zeta-creds-crypto.ts deriveKey. The picker at
  # Step 6.95-picker reads /etc/zeta/usb-uuid to know which UUID to
  # bind the blob to. Without this file, the picker SKIPS (per its
  # current gate condition), and the operator has to enter
  # credentials over and over on every reboot (operator pain point
  # named 2026-05-27: "i'm witing on the tool to be resable so i
  # don't have to enter credentals over and over everytime").
  #
  # We're already at the ESP we just read the pubkey from. Capture
  # its UUID via blkid + write to /etc/zeta/usb-uuid (and to
  # /mnt/etc/zeta/usb-uuid so it survives the install). This closes
  # one of the three preconditions blocking the picker; the other
  # two (ZETA_CREDS_PICKER=1 + ZETA_CREDS_PASSPHRASE) follow in
  # subsequent sub-rows.
  USB_UUID_DEV=""
  # Derive the partition device that hosts PUBKEY_FILE.
  if [ -n "${part:-}" ] && [ -b "${part:-}" ]; then
    # Try 2 case: we mounted ESP ourselves; $part is the partition.
    USB_UUID_DEV="$part"
  else
    # Try 1 case: PUBKEY_FILE was on an already-mounted FS.
    # findmnt -no SOURCE <dir> returns the source device.
    PUBKEY_DIR="$(dirname "$PUBKEY_FILE")"
    if command -v findmnt >/dev/null 2>&1; then
      # Walk up the path until findmnt finds a mount point.
      probe_dir="$PUBKEY_DIR"
      while [ "$probe_dir" != "/" ]; do
        src=$(findmnt -no SOURCE "$probe_dir" 2>/dev/null || true)
        if [ -n "$src" ] && [ -b "$src" ]; then
          USB_UUID_DEV="$src"
          break
        fi
        probe_dir="$(dirname "$probe_dir")"
      done
    fi
  fi

  if [ -n "$USB_UUID_DEV" ] && command -v blkid >/dev/null 2>&1; then
    USB_UUID_VAL=$(sudo blkid -o value -s UUID "$USB_UUID_DEV" 2>/dev/null || true)
    if [ -n "$USB_UUID_VAL" ]; then
      sudo mkdir -p /etc/zeta /mnt/etc/zeta
      echo "$USB_UUID_VAL" | sudo tee /etc/zeta/usb-uuid >/dev/null
      echo "$USB_UUID_VAL" | sudo tee /mnt/etc/zeta/usb-uuid >/dev/null
      sudo chmod 0644 /etc/zeta/usb-uuid /mnt/etc/zeta/usb-uuid
      echo "[081KSKBP80008QG0R003AX2A69.3a-prep]   captured USB UUID: $USB_UUID_VAL (device: $USB_UUID_DEV)"
      echo "[081KSKBP80008QG0R003AX2A69.3a-prep]   wrote /etc/zeta/usb-uuid + /mnt/etc/zeta/usb-uuid"
      echo "[081KSKBP80008QG0R003AX2A69.3a-prep]   precondition #3 satisfied for Step 6.95-picker"
    else
      echo "[081KSKBP80008QG0R003AX2A69.3a-prep]   WARN: blkid returned empty UUID for $USB_UUID_DEV;"
      echo "[081KSKBP80008QG0R003AX2A69.3a-prep]         /etc/zeta/usb-uuid NOT written; picker will SKIP"
    fi
  else
    echo "[081KSKBP80008QG0R003AX2A69.3a-prep]   WARN: could not derive USB partition device OR blkid unavailable;"
    echo "[081KSKBP80008QG0R003AX2A69.3a-prep]         /etc/zeta/usb-uuid NOT written; picker will SKIP"
  fi

  # ── 081KSNY2Z0008QG0R0008PN7RQ/081KSKBP80008QG0R003AX2A69 retention preseed: carry zflash-baked creds forward ────
  # zflash can bake the encrypted credential blob onto the boot USB ESP as
  # zeta-creds.enc. Copy that blob onto the target ESP before we unmount the
  # USB ESP so a reformat-with-retention keeps the operator answers/accounts
  # without re-running the interactive picker.
  BOOT_USB_CREDS_BLOB="$(dirname "$PUBKEY_FILE")/zeta-creds.enc"
  if sudo test -f "$BOOT_USB_CREDS_BLOB"; then
    echo "[081KSNY2Z0008QG0R0008PN7RQ-retention]   found pre-baked zeta-creds.enc on boot USB ESP"
    if command -v mountpoint >/dev/null 2>&1 && mountpoint -q /mnt/boot; then
      sudo install -m 0600 "$BOOT_USB_CREDS_BLOB" /mnt/boot/zeta-creds.enc
      BOOT_USB_CREDS_PRESEEDED=1
      echo "[081KSNY2Z0008QG0R0008PN7RQ-retention]   copied retained cred blob to /mnt/boot/zeta-creds.enc"
      echo "[081KSNY2Z0008QG0R0008PN7RQ-retention]   Step 6.95-picker will skip account re-entry"
    else
      echo "[081KSNY2Z0008QG0R0008PN7RQ-retention]   WARN: /mnt/boot is not mounted; retained cred blob not copied"
    fi
  else
    echo "[081KSNY2Z0008QG0R0008PN7RQ-retention]   no pre-baked zeta-creds.enc on boot USB ESP; Step 6.95-picker remains normal"
  fi

  sudo umount "$PROBE_MOUNT" 2>/dev/null || true
  if [ "$PUBKEY_LINE_COUNT" -gt 0 ]; then
    INJECT_OK=1
  else
    echo "[iter-4.2]   WARN: 0 valid ssh-*/ecdsa-*/sk-* lines in source file"
    echo "[iter-4.2]          (operator-ssh-keys.nix will produce empty keys list)"
  fi
else
  echo
  echo "=== [iter-4.2] DIAGNOSTICS ==="
  echo "reason: no operator SSH pubkey found on boot USB ESP"
  echo
  echo "--- external block devices ---"
  ls /dev/sd? /dev/nvme?n? /dev/vd? /dev/mmcblk? 2>/dev/null || echo "(none)"
  echo
  echo "--- install targets (skipped during probe) ---"
  echo "  boot disk:  $BOOT_DISK"
  echo "  data disks: ${DATA_DISKS[*]:-(none)}"
  echo
  echo "--- lsblk (full topology) ---"
  lsblk 2>&1 || true
  echo
  echo "--- what to do next ---"
  echo "  - photograph this diagnostic block + send to your AI collaborator"
  echo "  - install will continue with EMPTY operator-ssh-keys.nix"
  echo "  - fallback (iter-4 v1): on first boot, login as zeta/zeta-change-me,"
  echo "    passwd zeta, edit /etc/zeta/full-ai-cluster/nixos/modules/operator-ssh-keys.nix,"
  echo "    sudo nixos-rebuild switch --flake /etc/zeta/full-ai-cluster#$HOST"
  echo "=============================="
fi

# ── Step 6.55: iter-5.3 prompt-for-initial-password (081KSGS9H0008QG0R003V23XNZ) ────
#
# Per the maintainer 2026-05-26: "also on startup can it ask for
# me to type a password instead of having a default" — replaces
# the iter-4.x hardcoded `zeta-change-me` default with an
# operator-chosen password set at install time.
#
# Operator types password ONCE on cluster console (read -s; hidden);
# script hashes via mkpasswd ($6$ = sha512crypt); writes hash to
# /mnt/etc/zeta/initial-hashedpassword. The
# nixos/modules/initial-password.nix module reads that file via
# builtins.readFile at NixOS evaluation time + sets
# users.users.zeta.hashedPassword.
#
# Fallback: if operator presses Enter to skip (no password typed),
# the module's BACKWARD-COMPAT fallback hash (= sha512crypt of
# "zeta-change-me") stays in effect so the system still boots
# with a known credential.
#
# Why type-on-console (one exception to typing-avoidance discipline):
# secrets shouldn't transit non-operator surfaces (USB ESP, Aaron's
# Mac keychain, etc.); operator-typed at install time is the
# safest path. This composes with the wifi nmtui exception in
# zeta-first-boot.sh — both are operator-typed-once-on-cluster.
echo
echo "[iter-5.3] ── prompt for initial password (instead of default) ──"
echo "[iter-5.3] Set initial password for the 'zeta' user (used for"
echo "[iter-5.3] console login; SSH uses the iter-4.2-injected pubkey)."
echo "[iter-5.3] Operator can rotate later via 'passwd zeta' on the"
echo "[iter-5.3] installed system. Press Enter to skip + keep the"
echo "[iter-5.3] iter-4.x default ('zeta-change-me')."
echo
INJECTED_PW=""
INJECTED_PW_CONFIRM=""
if zeta_install_prompts_enabled; then
  # -s = silent (hidden); -p = inline prompt
  read -r -s -p "[iter-5.3] Password (or Enter to skip): " INJECTED_PW
  echo
  if [ -n "$INJECTED_PW" ]; then
    read -r -s -p "[iter-5.3] Confirm:                       " INJECTED_PW_CONFIRM
    echo
    if [ "$INJECTED_PW" != "$INJECTED_PW_CONFIRM" ]; then
      echo "[iter-5.3]   WARN: passwords don't match; skipping (keeps default)"
      INJECTED_PW=""
    fi
  fi
else
  echo "[iter-5.3] non-interactive install (ZETA_AUTO_CONFIRM=WIPE or non-TTY); skipping password prompt"
fi
if [ -n "$INJECTED_PW" ]; then
  # mkpasswd from nixpkgs `mkpasswd` package. -m sha-512 selects
  # sha512crypt; -s reads password from stdin (avoids exposing it
  # in argv via ps).
  INJECTED_HASH=$(echo "$INJECTED_PW" | mkpasswd -m sha-512 -s 2>/dev/null || echo "")
  unset INJECTED_PW
  unset INJECTED_PW_CONFIRM
  if [ -n "$INJECTED_HASH" ] && echo "$INJECTED_HASH" | grep -Eq '^\$6\$'; then
    sudo mkdir -p /mnt/etc/zeta
    echo "$INJECTED_HASH" | sudo tee /mnt/etc/zeta/initial-hashedpassword >/dev/null
    sudo chmod 0600 /mnt/etc/zeta/initial-hashedpassword
    sudo chown root:root /mnt/etc/zeta/initial-hashedpassword
    echo "[iter-5.3]   operator-chosen password hash written + chmod 0600"
    unset INJECTED_HASH
  else
    echo "[iter-5.3]   WARN: mkpasswd produced invalid hash; falling back to default"
  fi
else
  echo "[iter-5.3]   no password entered; iter-4.x default 'zeta-change-me' stays"
  echo "[iter-5.3]   in effect (rotate via 'passwd zeta' after first SSH login)"
fi
echo

# ── Step 6.56: 081KSKBP80008QG0R003AX2A69.3b cred-blob passphrase prompt ────────────
#
# Two-step lifecycle for the operator-entered passphrase, designed
# to minimize /proc/<pid>/environ exposure window:
#
#   - Step 6.56 (here): captured into the NON-EXPORTED shell
#     variable ZETA_CREDS_PASSPHRASE_VAL. Bash shell variables
#     without `export` live in the shell's own variable table but
#     are NOT copied into /proc/<pid>/environ for child processes
#     to read.
#
#   - Step 6.95-picker: inline-set
#     `ZETA_CREDS_PASSPHRASE="$ZETA_CREDS_PASSPHRASE_VAL" sudo
#     --preserve-env=ZETA_CREDS_PASSPHRASE ...` exports the env
#     var into the sudo subprocess ONLY (where the picker bash -c
#     reads it via --passphrase-env). Parent installer shell never
#     has ZETA_CREDS_PASSPHRASE exported.
#
#   - Step 6.95 post-picker: ZETA_CREDS_PASSPHRASE_VAL `unset`
#     unconditionally after the if/else block so it fires whether
#     the picker actually ran OR was skipped (env opt-out / file
#     marker / missing UUID).
#
# Operator pain point 2026-05-27: "i'm witing on the tool to be
# resable so i don't have to enter credentals over and over
# everytime."
#
# Closes precondition #2 of 3 for the cred-persistence picker at
# Step 6.95-picker (precondition #1 = ZETA_CREDS_PICKER default-on
# via PR #5639; precondition #3 = /etc/zeta/usb-uuid auto-captured
# at iter-4.2 via PR #5637; this step closes #2).
#
# Same operator-typed-once-on-console pattern as iter-5.3 password
# (constitutional rail per zeta-install.sh line 452 verbatim:
# "secrets shouldn't transit non-operator surfaces; operator-typed
# at install time is the safest path").
echo
echo "[081KSKBP80008QG0R003AX2A69.3b] ── cred-blob passphrase prompt (081KSKBP80008QG0R003AX2A69 Phase 1) ──"
echo "[081KSKBP80008QG0R003AX2A69.3b] Set a passphrase to encrypt your credentials onto"
echo "[081KSKBP80008QG0R003AX2A69.3b] this USB. Future boots can RESTORE creds via the"
echo "[081KSKBP80008QG0R003AX2A69.3b] same passphrase (no more re-entering gh login etc."
echo "[081KSKBP80008QG0R003AX2A69.3b] on every reboot). Encryption: AES-256-GCM with key"
echo "[081KSKBP80008QG0R003AX2A69.3b] derived via scrypt -> HKDF chain bound to this USB's"
echo "[081KSKBP80008QG0R003AX2A69.3b] UUID (per src/Core.TypeScript/installer/zeta-creds-crypto.ts)."
echo "[081KSKBP80008QG0R003AX2A69.3b]"
echo "[081KSKBP80008QG0R003AX2A69.3b] Press Enter to SKIP (no cred-blob persistence;"
echo "[081KSKBP80008QG0R003AX2A69.3b] keeps current per-reboot re-entry behavior)."
echo
ZETA_CREDS_PASSPHRASE_INPUT=""
ZETA_CREDS_PASSPHRASE_CONFIRM=""
if zeta_install_prompts_enabled; then
  # -s = silent (hidden); -p = inline prompt
  read -r -s -p "[081KSKBP80008QG0R003AX2A69.3b] Passphrase (or Enter to skip): " ZETA_CREDS_PASSPHRASE_INPUT
  echo
  if [ -n "$ZETA_CREDS_PASSPHRASE_INPUT" ]; then
    read -r -s -p "[081KSKBP80008QG0R003AX2A69.3b] Confirm:                          " ZETA_CREDS_PASSPHRASE_CONFIRM
    echo
    if [ "$ZETA_CREDS_PASSPHRASE_INPUT" != "$ZETA_CREDS_PASSPHRASE_CONFIRM" ]; then
      echo "[081KSKBP80008QG0R003AX2A69.3b]   WARN: passphrases don't match; skipping (no cred-blob persistence)"
      ZETA_CREDS_PASSPHRASE_INPUT=""
    fi
  fi
else
  echo "[081KSKBP80008QG0R003AX2A69.3b] non-interactive install (ZETA_AUTO_CONFIRM=WIPE or non-TTY); skipping cred-blob passphrase prompt"
fi
unset ZETA_CREDS_PASSPHRASE_CONFIRM
# Initialize ZETA_CREDS_PASSPHRASE_VAL to empty unconditionally so the
# Step 6.95-picker gate check works whether or not operator entered a
# passphrase. Per 081KSKBP80008QG0R003AX2A69.3b-supersede discipline: do NOT export — keep
# in a non-exported shell variable to avoid /proc/<pid>/environ exposure.
ZETA_CREDS_PASSPHRASE_VAL=""
if [ -n "$ZETA_CREDS_PASSPHRASE_INPUT" ]; then
  ZETA_CREDS_PASSPHRASE_VAL="$ZETA_CREDS_PASSPHRASE_INPUT"
  unset ZETA_CREDS_PASSPHRASE_INPUT
  echo "[081KSKBP80008QG0R003AX2A69.3b]   passphrase captured + held in non-exported shell variable"
  echo "[081KSKBP80008QG0R003AX2A69.3b]   (NOT in /proc/self/environ; inline-set for sudo only at 6.95;"
  echo "[081KSKBP80008QG0R003AX2A69.3b]    shell var unset in ALL branches after Step 6.95 picker block)"
else
  unset ZETA_CREDS_PASSPHRASE_INPUT
  echo "[081KSKBP80008QG0R003AX2A69.3b]   skipped — no cred-blob persistence this install"
fi
echo

# ── Step 6.6: iter-5.2 hostname injection (081KSGS9H0008QG0R003V23XNZ) ──────────────
#
# Per the maintainer 2026-05-26: "since our different roles are
# multi install you can be control plane AND gpu node AND cpu
# node these distinctions are not very elegant and host names
# tied to them are not great either" — hostname should be just
# a unique identity, decoupled from role-stack selection.
#
# zflash on macOS writes the operator's chosen hostname to
# `zeta-hostname.txt` on the USB ESP if --host <name> was passed
# (e.g., zflash --host pikachu). This step writes that to
# /mnt/etc/zeta/cluster-node-id where the NixOS module
# `injected-hostname.nix` reads it via builtins.readFile at
# evaluation time + overrides networking.hostName.
#
# If no zeta-hostname.txt on ESP: skip; the flake's per-host
# config default (e.g., "control-plane") stays in effect.
# Backward-compatible with single-node zero-typing path.
echo
echo "[iter-5.2] ── probing boot USB for injected hostname ──"
HOSTNAME_DST="/mnt/etc/zeta/cluster-node-id"
HOSTNAME_FILE=""
# Reuse the SEARCH_DIRS pattern from the iter-4.2 pubkey probe;
# zflash writes zeta-hostname.txt alongside zeta-authorized-keys.pub
# in the same ESP mount session.
if [ ${#SEARCH_DIRS[@]} -gt 0 ]; then
  HOSTNAME_FILE=$(sudo find "${SEARCH_DIRS[@]}" \
    -maxdepth 5 -name "zeta-hostname.txt" -type f 2>/dev/null | head -1 || true)
fi
# Also check the PROBE_MOUNT in case the USB ESP was mounted there
# during iter-4.2 probe (don't re-mount; it's already there).
if [ -z "$HOSTNAME_FILE" ] && [ -f "$PROBE_MOUNT/zeta-hostname.txt" ]; then
  HOSTNAME_FILE="$PROBE_MOUNT/zeta-hostname.txt"
fi
if [ -n "$HOSTNAME_FILE" ]; then
  # Validate: hostname per RFC1123 (alphanumeric + hyphens, no
  # leading/trailing hyphen, 1-63 chars). Strip whitespace + newlines.
  INJECTED_HOSTNAME=$(sudo cat "$HOSTNAME_FILE" | tr -d '[:space:]' | head -c 63)
  if [ -n "$INJECTED_HOSTNAME" ] \
     && echo "$INJECTED_HOSTNAME" \
        | grep -Eq '^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$'; then
    echo "[iter-5.2]   found injected hostname: $INJECTED_HOSTNAME (source: $HOSTNAME_FILE)"
    sudo mkdir -p "$(dirname "$HOSTNAME_DST")"
    echo "$INJECTED_HOSTNAME" | sudo tee "$HOSTNAME_DST" >/dev/null
    sudo chmod 0644 "$HOSTNAME_DST"
    echo "[iter-5.2]   wrote $HOSTNAME_DST"
    echo "[iter-5.2]   networking.hostName will be '$INJECTED_HOSTNAME' on first boot"
    echo "[iter-5.2]   ssh access: ssh zeta@${INJECTED_HOSTNAME}.local"
  else
    echo "[iter-5.2]   WARN: $HOSTNAME_FILE contains invalid hostname '$INJECTED_HOSTNAME'"
    echo "[iter-5.2]          (must match RFC1123: alphanumeric + hyphens, 1-63 chars)"
    echo "[iter-5.2]          falling back to flake default ($HOST)"
  fi
else
  # iter-5.2.2 fix (081KSGS9H0008QG0R003V23XNZ): when no operator-explicit hostname is
  # on the ESP, generate a fresh random hostname ON THE NODE at
  # install time (NOT at flash time). This is the load-bearing fix
  # for the "same USB reused on second machine" multi-node case
  # the maintainer 2026-05-26 surfaced: *"i was thinking it would
  # be auto generated on each machine so i can't use that same
  # usb twice?"*. zflash no longer auto-generates at flash time;
  # zeta-install.sh now generates per-install. Each install from
  # the same USB gets a unique node-<6hex> hostname.
  #
  # Format: node-<6hex> from /dev/urandom (24-bit entropy =
  # ~16M unique names; negligible collision risk for any homelab
  # cluster size; mDNS uniqueness preserved per-node).
  echo "[iter-5.2]   no zeta-hostname.txt on USB ESP"
  echo "[iter-5.2.2] generating fresh random hostname on-node (per-install unique) ..."
  GENERATED_HOSTNAME="node-$(head -c 3 /dev/urandom | xxd -p)"
  if echo "$GENERATED_HOSTNAME" \
     | grep -Eq '^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$'; then
    echo "[iter-5.2.2]   generated: $GENERATED_HOSTNAME"
    sudo mkdir -p "$(dirname "$HOSTNAME_DST")"
    echo "$GENERATED_HOSTNAME" | sudo tee "$HOSTNAME_DST" >/dev/null
    sudo chmod 0644 "$HOSTNAME_DST"
    echo "[iter-5.2.2]   wrote $HOSTNAME_DST"
    echo "[iter-5.2.2]   networking.hostName will be '$GENERATED_HOSTNAME' on first boot"
    echo "[iter-5.2.2]   ssh access: ssh zeta@${GENERATED_HOSTNAME}.local"
    echo "[iter-5.2.2]   *** REMEMBER THIS HOSTNAME *** — printed in login banner per iter-5.2.2 substrate"
  else
    echo "[iter-5.2.2]   WARN: generation produced invalid hostname '$GENERATED_HOSTNAME'"
    echo "[iter-5.2.2]          falling back to flake default ($HOST)"
  fi
fi
echo

# ── Step 6.6: iter-5 wifi ESP → NetworkManager profile (no radio claim) ─────────
#
# zflash may bake /zeta-wifi-credentials.json ({ssid,password}) onto the boot
# USB ESP. This step copies a .nmconnection onto the *installed* system so
# first boot can autoconnect. Association / radio proof stays physical-gated
# (QEMU has no wifi NIC to validate). Helper:
#   src/Core.TypeScript/installer/wifi-esp-to-nm.ts
echo
echo "[iter-5-wifi] ── probing boot USB for wifi credentials payload ──"
WIFI_CREDS_FILE=""
if [ ${#SEARCH_DIRS[@]} -gt 0 ]; then
  WIFI_CREDS_FILE=$(sudo find "${SEARCH_DIRS[@]}" \
    -maxdepth 5 -name "zeta-wifi-credentials.json" -type f 2>/dev/null | head -1 || true)
fi
if [ -z "$WIFI_CREDS_FILE" ] && [ -f "$PROBE_MOUNT/zeta-wifi-credentials.json" ]; then
  WIFI_CREDS_FILE="$PROBE_MOUNT/zeta-wifi-credentials.json"
fi
if [ -n "$WIFI_CREDS_FILE" ]; then
  echo "[iter-5-wifi] found zeta-wifi-credentials.json on boot USB ESP"
  WIFI_HELPER="$ZETA_HOME/Zeta/src/Core.TypeScript/installer/wifi-esp-to-nm.ts"
  WIFI_NM_DST="/mnt/etc/NetworkManager/system-connections"
  if [ -f "$WIFI_HELPER" ]; then
    WIFI_TMP=/tmp/zeta-esp-wifi.nmconnection
    WIFI_PROFILE_NAME=$(
      sudo --preserve-env=PATH -u "#$ZETA_UID" HOME="$ZETA_HOME" BUN_INSTALL="$ZETA_HOME/.bun" \
        bash -c "set -o pipefail; export PATH='/run/current-system/sw/bin:${ZETA_HOME}/.local/share/mise/shims:${ZETA_HOME}/.bun/bin:/usr/bin:/bin'; eval \"\$(mise activate bash 2>/dev/null || true)\"; bun '$WIFI_HELPER' --input '$WIFI_CREDS_FILE' --output '$WIFI_TMP'" \
        2>/tmp/zeta-esp-wifi.err
    ) || WIFI_PROFILE_NAME=""
    WIFI_PROFILE_NAME=$(echo "$WIFI_PROFILE_NAME" | tr -d '[:space:]')
    if [ -n "$WIFI_PROFILE_NAME" ] && [ -f "$WIFI_TMP" ]; then
      sudo mkdir -p "$WIFI_NM_DST"
      sudo chmod 0700 "$WIFI_NM_DST"
      sudo cp "$WIFI_TMP" "$WIFI_NM_DST/$WIFI_PROFILE_NAME"
      sudo chown root:root "$WIFI_NM_DST/$WIFI_PROFILE_NAME"
      sudo chmod 0600 "$WIFI_NM_DST/$WIFI_PROFILE_NAME"
      rm -f "$WIFI_TMP" /tmp/zeta-esp-wifi.err
      echo "[iter-5-wifi] wrote NetworkManager profile to installed system ($WIFI_PROFILE_NAME)"
      echo "[iter-5-wifi] association deferred (physical-gated; no radio claim)"
    else
      echo "[iter-5-wifi] invalid zeta-wifi-credentials.json; skipping profile write"
      rm -f "$WIFI_TMP" /tmp/zeta-esp-wifi.err
    fi
  else
    # Fallback: stage raw JSON on target ESP for a later consume path.
    sudo mkdir -p /mnt/boot
    sudo cp "$WIFI_CREDS_FILE" /mnt/boot/zeta-wifi-credentials.json
    sudo chmod 0600 /mnt/boot/zeta-wifi-credentials.json
    echo "[iter-5-wifi] staged zeta-wifi-credentials.json on target ESP (helper unavailable)"
    echo "[iter-5-wifi] association deferred (physical-gated; no radio claim)"
  fi
else
  echo "[iter-5-wifi] no zeta-wifi-credentials.json on boot USB ESP; skipping wifi injection"
fi
echo

# ── Step 6.7: iter-5.1 wifi persistence (081KSGS9H0008QG0R003V23XNZ) ────────────────
#
# By the time this step runs, the live installer is already on the
# network — either via ethernet auto-DHCP (no profile to copy; this
# is a no-op) or via nmtui setup at first boot (`zeta-first-boot.sh`
# Step 2 launches nmtui when ethernet is absent; operator entered
# wifi creds once via TUI; NetworkManager wrote a .nmconnection
# profile to /etc/NetworkManager/system-connections/).
#
# Without this step, the freshly-installed system inherits the
# NixOS NetworkManager service but NOT the operator's connection
# profile. Result: wifi-only mini-PCs boot installed system,
# NetworkManager comes up with empty profile dir, no wifi, no SSH.
# The maintainer 2026-05-26: "we won't have ethernet for most
# machines it needs to remember the wifi on setup."
#
# Fix: copy *.nmconnection files from the live installer to /mnt.
# NetworkManager requires chmod 0600 + chown root:root on these
# files. sudo handles both during the cp.
echo
echo "[iter-5.1] ── checking for NetworkManager connection profiles to persist ──"
NM_SRC="/etc/NetworkManager/system-connections"
NM_DST="/mnt/etc/NetworkManager/system-connections"
NM_PROFILE_COUNT=0
if [ -d "$NM_SRC" ]; then
  # Enumerate .nmconnection files via find (NOT glob; bash globs
  # would need nullglob to handle the empty-dir case, but find +
  # filtered-output handles it naturally with no shell-option deps)
  NM_PROFILES=$(sudo find "$NM_SRC" -maxdepth 1 -name "*.nmconnection" -type f 2>/dev/null || true)
  if [ -n "$NM_PROFILES" ]; then
    NM_PROFILE_COUNT=$(echo "$NM_PROFILES" | wc -l | tr -d ' ')
    sudo mkdir -p "$NM_DST"
    sudo chmod 0700 "$NM_DST"
    # Copy preserving permissions; NM requires 0600 root:root on each
    # .nmconnection file (else it ignores them at startup with a
    # "permissions not strict enough" warning in journalctl)
    echo "$NM_PROFILES" | while read -r src; do
      [ -n "$src" ] || continue
      name=$(basename "$src")
      dst="$NM_DST/$name"
      sudo cp -p "$src" "$dst"
      sudo chown root:root "$dst"
      sudo chmod 0600 "$dst"
      # Print SSID (parsed from [wifi] ssid=...) without printing the psk.
      # Per 802.11 spec, SSIDs MAY contain '=' (and arbitrary bytes
      # including spaces). awk -F= '...; print $2' would truncate after
      # the first '='. sed-after-first-'ssid=' preserves the full SSID.
      ssid=$(sudo sed -n 's/^ssid=//p' "$dst" 2>/dev/null | head -1)
      [ -z "$ssid" ] && ssid="(unknown)"
      echo "[iter-5.1]   persisted: $name (ssid=$ssid)"
    done
    echo "[iter-5.1]   $NM_PROFILE_COUNT NetworkManager profile(s) persisted to installed system"
    echo "[iter-5.1]   installed system will reconnect to wifi automatically on reboot"
  else
    echo "[iter-5.1]   no .nmconnection profiles in $NM_SRC (ethernet-DHCP path; nothing to persist)"
  fi
else
  echo "[iter-5.1]   $NM_SRC does not exist; skipping wifi persistence (no harm; ethernet-DHCP works)"
fi
echo

# ── Step 6.8: iter-5.4.0 homelab gh-auth + operator pubkey copy ──
# 081KSGS9H0008QG0R0027HJZYH sub-target homelab-mode. The maintainer 2026-05-26: "i'll
# wait till we have the install.sh and git native device registration
# into github is ready before i run again". Per Mika 2026-05-26
# homelab-first substrate: USB ships with NO embedded credentials;
# operator authenticates interactively at install time via `gh auth
# login`; auto-fetch operator's GitHub SSH pubkeys + write to
# /mnt/etc/zeta/operator-authorized-keys for the
# operator-authorized-keys.nix module to inject at activation.
#
# Outputs:
#   /mnt/etc/zeta/operator-authorized-keys (one pubkey per line)
#
# Skippable (warning-only when iter-4.2 also failed): operator can type
# 'n' to skip if they prefer fallback to iter-4.2 statically-baked
# maintainer keys (or manual config-edit per iter-4 v1 if iter-4.2
# also was skipped/failed). The Copilot-P1-corrected behavior matches
# the implementation: always allow skip, log loudly when neither path
# succeeded.
#
# Composes with iter-4.2 (static keys; additive) + iter-5.3 password
# prompt (console-login fallback) + iter-5.2 hostname (which.local
# the operator SSHs to).
GH_AUTH_OK=0
GH_KEY_COUNT=0
echo
echo "[iter-5.4.0] ── homelab gh-auth + operator SSH-pubkey copy ──"
echo "[iter-5.4.0] Authenticate to GitHub to auto-copy your SSH pubkeys"
echo "[iter-5.4.0] to the installed node's authorized_keys. This makes"
echo "[iter-5.4.0] ssh-from-your-Mac work without manual config-edit + rebuild."
echo "[iter-5.4.0] Default is YES (recommended); press Enter to proceed"
echo "[iter-5.4.0] OR type 'n' to skip (fallback to iter-4.2 static keys"
echo "[iter-5.4.0] if injected, OR manual config-edit per the iter-4 v1 flow)."
echo
if zeta_install_prompts_enabled; then
  read -r -p "[iter-5.4.0] Run gh auth login now? [Y/n]: " GH_AUTH_REPLY
else
  echo "[iter-5.4.0] non-interactive install (ZETA_AUTO_CONFIRM=WIPE or non-TTY); skipping gh auth"
  GH_AUTH_REPLY=n
fi
GH_AUTH_REPLY="${GH_AUTH_REPLY:-Y}"
if [[ "$GH_AUTH_REPLY" =~ ^[Yy]$ ]]; then
  if ! command -v gh >/dev/null 2>&1; then
    echo "[iter-5.4.0]   WARN: gh binary not on PATH; skipping (likely"
    echo "[iter-5.4.0]         installer ISO bug — gh should be in"
    echo "[iter-5.4.0]         environment.systemPackages of"
    echo "[iter-5.4.0]         full-ai-cluster/usb-nixos-installer/nixos/installer/configuration.nix)"
  else
    echo "[iter-5.4.0]   running 'gh auth login' (interactive)..."
    echo
    # `gh auth login` is interactive (browser code OR device-flow OR
    # paste-token). Operator picks. Authenticates as their GitHub user.
    if gh auth login; then
      GH_AUTH_OK=1
      echo
      echo "[iter-5.4.0]   gh auth login: SUCCESS"

      # ── 081KSGS9H0008QG0R00120EEHM Bug 2a fix: wire git to use gh token for HTTPS pushes ──
      # `gh auth login` stores the token but does NOT configure git's
      # credential helper. Without this step, subsequent `git push` to
      # https://github.com/... prompts for HTTPS basic-auth (username +
      # password) — empirically observed 2026-05-26 physical hardware-
      # support test where iter-5.4.1 self-registration `git push -u
      # origin <branch>` prompted operator for "Password for
      # 'https://acehack@github.com':" despite gh auth login succeeding
      # as AceHack moments earlier. `gh auth setup-git` writes a
      # credential.helper entry that delegates to `gh auth git-credential`
      # so git push picks up the gh token automatically. The follow-up
      # git-config check is a dry-run guard: no network, no push, just
      # enough evidence to warn before self-registration reaches git push.
      echo "[iter-5.4.0]   wiring git credential helper to use gh token..."
      if gh auth setup-git 2>&1 | tail -3; then
        echo "[iter-5.4.0]   git credential helper: configured"
        if git config --global --get-all credential.https://github.com.helper 2>/dev/null | grep -q "gh auth git-credential"; then
          echo "[iter-5.4.0]   git credential helper dry-run check: gh auth git-credential present"
        else
          echo "[iter-5.4.0]   WARN: credential helper check did not find 'gh auth git-credential'; subsequent git push may prompt for password"
        fi
      else
        echo "[iter-5.4.0]   WARN: 'gh auth setup-git' failed; subsequent git push may prompt for password"
      fi

      echo "[iter-5.4.0]   fetching operator's SSH pubkeys via 'gh ssh-key list'..."
      KEY_DST_DIR=/mnt/etc/zeta
      sudo mkdir -p "$KEY_DST_DIR"
      KEY_DST="$KEY_DST_DIR/operator-authorized-keys"
      # gh ssh-key list outputs the key BODY per row in JSON; jq extracts
      # the `key` field which contains the standard authorized_keys line
      # (algo + base64-pubkey; no comment). Each gets a comment appended
      # so the operator can identify it later: "gh-key-<id>".
      #
      # 081KSGS9H0008QG0R00120EEHM Bug 2b fix: substrate-honest discrimination of failure modes.
      # Capture stderr so we can distinguish (a) auth-scope error from
      # (b) empty key list from (c) jq/tee pipe break. Empirically 2026-05-26:
      # device-flow `gh auth login` only requests default scopes
      # (`repo, read:org, workflow, gist`); `gh ssh-key list` requires
      # `admin:public_key` OR `read:public_key` which are NOT in defaults.
      # If scope is the issue, the WARN tells operator how to refresh.
      SSH_KEY_ERR_FILE=$(mktemp -t zeta-ghkey-err.XXXXXX)
      if gh ssh-key list --json id,key,title 2>"$SSH_KEY_ERR_FILE" \
          | jq -r '.[] | "\(.key) gh-key-\(.id)-\(.title // "")"' \
          | sudo tee "$KEY_DST" >/dev/null; then
        sudo chmod 0644 "$KEY_DST"
        GH_KEY_COUNT="$(wc -l < "$KEY_DST" | tr -d ' ')"
        if [ "$GH_KEY_COUNT" -gt 0 ]; then
          echo "[iter-5.4.0]   wrote $GH_KEY_COUNT key(s) to $KEY_DST"
          echo "[iter-5.4.0]   the operator-authorized-keys.nix module will pick"
          echo "[iter-5.4.0]   them up during nixos-install (next step)"
        else
          # Empty key list — either no keys at GitHub OR scope missing.
          # Check stderr for scope error to discriminate.
          if grep -qE "(scope|insufficient|admin:public_key|read:public_key)" "$SSH_KEY_ERR_FILE" 2>/dev/null; then
            echo "[iter-5.4.0]   WARN: 'gh ssh-key list' returned no keys — gh token lacks SSH-key scope"
            echo "[iter-5.4.0]   To enable SSH-from-Mac path, run on the installed system:"
            echo "[iter-5.4.0]     gh auth refresh -s admin:public_key"
            echo "[iter-5.4.0]     gh ssh-key list --json key | jq -r '.[].key' | sudo tee -a /etc/zeta/operator-authorized-keys"
            echo "[iter-5.4.0]     sudo nixos-rebuild switch  # picks up operator-authorized-keys.nix"
          else
            echo "[iter-5.4.0]   WARN: 'gh ssh-key list' returned no keys — operator has no SSH keys registered at GitHub"
            echo "[iter-5.4.0]   SSH-from-Mac fallback: add keys at https://github.com/settings/keys"
            echo "[iter-5.4.0]   then on the installed system, re-run the gh ssh-key list step (see 081KSGS9H0008QG0R00120EEHM Bug 2b)"
          fi
        fi
      else
        echo "[iter-5.4.0]   WARN: 'gh ssh-key list' failed; no keys written"
        echo "[iter-5.4.0]   stderr: $(head -3 "$SSH_KEY_ERR_FILE" 2>/dev/null | tr '\n' ' ')"
        GH_KEY_COUNT=0
      fi
      rm -f "$SSH_KEY_ERR_FILE" 2>/dev/null || true
    else
      echo
      echo "[iter-5.4.0]   gh auth login FAILED or was cancelled; skipping"
    fi
  fi
else
  echo "[iter-5.4.0]   skipped at operator request; iter-4.2 static keys (if"
  echo "[iter-5.4.0]   injected) remain the SSH path. If iter-4.2 also failed,"
  echo "[iter-5.4.0]   manual config-edit per the iter-4 v1 flow is required"
  echo "[iter-5.4.0]   post-install."
fi
echo

# ── Step 6.9: iter-5.4.1 self-registration commit+push (081KSGS9H0008QG0R0037H3W4T) ──
# 081KSGS9H0008QG0R0027HJZYH sub-target 3 full implementation. After iter-5.4.0 captures
# operator's gh-auth foothold + ssh pubkeys, this step:
#   1. Probes hardware (CPU/RAM/cores/GPU/storage/network/MAC)
#   2. Composes a ClusterNode YAML matching the provisional schema
#   3. Opens a PR on the Zeta repo registering this node under
#      maintainers/<operator-gh-user>/cluster-nodes/<hostname>/node.yaml
#
# Operator (or peer agent) merges the PR from anywhere (phone-merge OK).
# ArgoCD then watches maintainers/*/cluster-nodes/** and reconciles
# the node into the cluster (081KSGS9H0008QG0R002K93MWX iter-5.4.2; tracked separately).
#
# Skip conditions (cascade with iter-5.4.0):
#   - GH_AUTH_OK != 1 (gh auth login was skipped or failed)
#   - hostname unknown (iter-5.2 hostname injection also skipped)
#
# Empirical anchor: operator 2026-05-26 physical hardware-support test
# verified self-registration did NOT happen — maintainers/<operator>/
# cluster-nodes/ didn't exist on the repo. This Step 6.9 implements the
# missing substrate to fix 081KSGS9H0008QG0R00120EEHM Bug 4 (CRITICAL per operator's CORE
# REQUIREMENT of post-boot fully-operational chain without operator login).
SELF_REG_OK=0
SELF_REG_PR_URL=""

# Shared hostname + ClusterNode YAML compose (081KSGS9H0008QG0R0037H3W4T / 081KSGS9H0008QG0R002K93MWX schema).
zeta_self_reg_resolve_node_hostname() {
  if [ -f "$HOSTNAME_DST" ]; then
    NODE_HOSTNAME=$(cat "$HOSTNAME_DST" | tr -d '[:space:]')
  else
    NODE_HOSTNAME="$HOST"
    echo "[iter-5.4.1]   WARN: $HOSTNAME_DST absent; using flake-host '$HOST' as node-name"
    echo "[iter-5.4.1]          (may produce naming collision if multiple nodes use this flake-host)"
  fi
}

zeta_self_reg_compose_node_yaml() {
  CPU_MODEL=$(grep 'model name' /proc/cpuinfo 2>/dev/null | head -1 | cut -d: -f2- | sed 's/^[[:space:]]*//' | sed 's/"//g' || echo "")
  MEM_TOTAL=$(free -h --si 2>/dev/null | awk '/Mem:/{print $2}' || echo "")
  CPU_CORES=$(nproc 2>/dev/null || echo "")
  GPU_LINE=$(lspci -nn 2>/dev/null | grep -iE 'vga|3d|display' | head -1 | sed 's/"//g' || echo "")
  IP_ADDR=$(ip -4 -o addr 2>/dev/null | awk '/inet/ && !/lo/{print $4; exit}' || echo "")
  MAC_ADDR=$(ip -o link 2>/dev/null | awk '/state UP/ && !/lo/{for(i=1;i<=NF;i++) if($i=="link/ether"){print $(i+1); exit}}' || echo "")
  STORAGE_LINES=$(lsblk -ndo NAME,SIZE,TYPE -e7 2>/dev/null | awk '$3=="disk" && $2!="0B"{print "      - \"/dev/" $1 " " $2 "\""}' || echo "")
  REG_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
  FLAKE_COMMIT=$(git -C /mnt/etc/zeta rev-parse HEAD 2>/dev/null | head -c 12 || echo "unknown")

  NODE_YAML="apiVersion: zeta.lucent-financial-group.com/v1
kind: ClusterNode
metadata:
  name: $NODE_HOSTNAME
  namespace: zeta-cluster
  annotations:
    zeta.lucent-financial-group.com/registered-at: \"$REG_TIMESTAMP\"
    zeta.lucent-financial-group.com/flake-commit: \"$FLAKE_COMMIT\"
    zeta.lucent-financial-group.com/flake-host: \"$HOST\"
    zeta.lucent-financial-group.com/registered-via: \"iter-5.4.1\"
  labels:
    zeta.lucent-financial-group.com/maintainer: \"$MAINTAINER\"
spec:
  hostname: $NODE_HOSTNAME
  roles:
    - $HOST
  registration:
    maintainer: $MAINTAINER
    timestamp: \"$REG_TIMESTAMP\"
    flake-commit: \"$FLAKE_COMMIT\"
    flake-host: \"$HOST\"
    registered-via: \"iter-5.4.1\"
  hardware:"
  [ -n "$CPU_MODEL" ] && NODE_YAML="$NODE_YAML
    cpu: \"$CPU_MODEL\""
  [ -n "$MEM_TOTAL" ] && NODE_YAML="$NODE_YAML
    memory: \"$MEM_TOTAL\""
  [ -n "$CPU_CORES" ] && NODE_YAML="$NODE_YAML
    cores: $CPU_CORES"
  [ -n "$GPU_LINE" ] && NODE_YAML="$NODE_YAML
    gpu: \"$GPU_LINE\""
  [ -n "$STORAGE_LINES" ] && NODE_YAML="$NODE_YAML
    storage:
$STORAGE_LINES"
  if [ -n "$IP_ADDR" ] || [ -n "$MAC_ADDR" ]; then
    NODE_YAML="$NODE_YAML
    network:"
    [ -n "$IP_ADDR" ] && NODE_YAML="$NODE_YAML
      ip: \"$IP_ADDR\""
    [ -n "$MAC_ADDR" ] && NODE_YAML="$NODE_YAML
      mac: \"$MAC_ADDR\""
  fi
}

if [ "$GH_AUTH_OK" = 1 ]; then
  echo "[iter-5.4.1] ── self-registration commit+push (081KSGS9H0008QG0R0037H3W4T) ──"
  echo "[iter-5.4.1] Composing ClusterNode YAML + opening registration PR..."

  # Resolve operator GH user (used for the per-maintainer subtree path).
  MAINTAINER=$(gh api /user --jq .login 2>/dev/null || echo "")
  if [ -z "$MAINTAINER" ]; then
    echo "[iter-5.4.1]   WARN: gh api /user failed; cannot resolve operator GH login; skipping"
  else
    zeta_self_reg_resolve_node_hostname
    echo "[iter-5.4.1]   maintainer:  $MAINTAINER"
    echo "[iter-5.4.1]   node-name:   $NODE_HOSTNAME"
    zeta_self_reg_compose_node_yaml

    # ── clone repo to temp; write node.yaml; commit + open PR ──
    # CRITICAL: this whole block is wrapped in `|| true` at the subshell
    # boundary so that ANY failure inside (git push permission denied,
    # gh pr create scope missing, network drop, etc.) becomes a WARNING
    # rather than killing the entire installer (Copilot finding on #5352
    # — the outer `set -euo pipefail` would propagate subshell failure
    # out and prevent nixos-install from running; Step 6.9 is documented
    # warning-only/skippable so it MUST never abort the install).
    WORK_DIR=$(mktemp -d -t zeta-self-register.XXXXXX)
    REG_BRANCH="register-${NODE_HOSTNAME}-$(date -u +%Y%m%dT%H%M%SZ)"
    rm -f /tmp/zeta-self-reg-pr-url 2>/dev/null || true
    if gh repo clone Lucent-Financial-Group/Zeta "$WORK_DIR" -- --depth 1 --quiet 2>&1 | tail -3; then
      NODE_DIR="$WORK_DIR/maintainers/$MAINTAINER/cluster-nodes/$NODE_HOSTNAME"
      mkdir -p "$NODE_DIR"
      printf '%s\n' "$NODE_YAML" > "$NODE_DIR/node.yaml"
      (
        # subshell-local: disable error-exit so individual command failures
        # warn rather than abort. The outer `|| true` on the subshell
        # provides defense-in-depth.
        set +e
        cd "$WORK_DIR" || exit 1
        # commit-author = gh-auth'd operator (no shipped credentials;
        # clean attribution chain). Configure user.{name,email} from gh.
        OP_NAME=$(gh api /user --jq .name 2>/dev/null || echo "$MAINTAINER")
        OP_EMAIL=$(gh api /user/emails --jq '.[] | select(.primary == true) | .email' 2>/dev/null \
                   | head -1 || echo "${MAINTAINER}@users.noreply.github.com")
        git config user.name "$OP_NAME"
        git config user.email "$OP_EMAIL"
        git checkout -b "$REG_BRANCH" 2>&1 | tail -3
        # 081KSKBP80008QG0R000GPC0TB-fix: the manifest MUST exist + be non-empty before we stage it.
        # (A failed/empty write here was silently producing an empty commit.)
        if [ ! -s "$NODE_DIR/node.yaml" ]; then
          echo "[iter-5.4.1]   ERROR: node.yaml absent/empty at $NODE_DIR — not registering (nothing pushed)." >&2
          echo "[iter-5.4.1]          maintainer='$MAINTAINER' node='$NODE_HOSTNAME'" >&2
          exit 1
        fi
        git add "maintainers/$MAINTAINER/cluster-nodes/$NODE_HOSTNAME/" 2>&1 | tail -3
        # 081KSKBP80008QG0R000GPC0TB-fix: confirm something is actually staged BEFORE commit/push.
        # The old code committed an empty tree and pushed the branch ANYWAY,
        # leaving an orphaned register-* branch + a failed PR with NO signal to
        # the operator — this is exactly what stranded node-09485d. Fail loud,
        # emit diagnostics so the trigger is visible, and push nothing.
        if git diff --cached --quiet; then
          echo "[iter-5.4.1]   ERROR: nothing staged for $NODE_HOSTNAME — registration NOT performed." >&2
          echo "[iter-5.4.1]          diagnostics (so the cause is visible, not silent):" >&2
          echo "[iter-5.4.1]            maintainer='$MAINTAINER' node='$NODE_HOSTNAME' dir='$NODE_DIR'" >&2
          ls -la "$NODE_DIR" 2>&1 | sed 's/^/[iter-5.4.1]            /' >&2
          git status --porcelain 2>&1 | sed 's/^/[iter-5.4.1]            /' >&2
          echo "[iter-5.4.1]          NO empty branch pushed. Re-run registration after fixing." >&2
          exit 1
        fi
        git commit -m "feat(node-register): $NODE_HOSTNAME self-registers via iter-5.4.1

Auto-generated by zeta-install.sh Step 6.9 on the node during install.
Registers ${NODE_HOSTNAME} under maintainers/${MAINTAINER}/cluster-nodes/.
ArgoCD watches maintainers/*/cluster-nodes/** + reconciles per 081KSGS9H0008QG0R002K93MWX.

flake-host: ${HOST}
flake-commit: ${FLAKE_COMMIT}
registered-at: ${REG_TIMESTAMP}
" 2>&1 | tail -3
        # 081KSKBP80008QG0R000GPC0TB-fix: only push if a real commit now exists ahead of the clone
        # base — defense-in-depth so an empty/HEAD-only branch is never pushed.
        if [ "$(git rev-list --count HEAD ^origin/main 2>/dev/null || echo 0)" -lt 1 ]; then
          echo "[iter-5.4.1]   ERROR: commit produced no new revision — not pushing an empty branch." >&2
          exit 1
        fi
        if git push -u origin "$REG_BRANCH" 2>&1 | tail -3; then
          # gh pr create's output last line is the PR URL on success
          SELF_REG_PR_URL=$(gh pr create \
            --title "feat(node-register): $NODE_HOSTNAME self-registers via iter-5.4.1" \
            --body "Self-registration PR opened by zeta-install.sh on the node during install. Composes with 081KSGS9H0008QG0R0037H3W4T iter-5.4.1 + 081KSGS9H0008QG0R002K93MWX iter-5.4.2 ArgoCD reconciliation. Review + merge to bring the node into the cluster." \
            --base main \
            --head "$REG_BRANCH" 2>&1 | tail -1)
          if [ -n "$SELF_REG_PR_URL" ] && [[ "$SELF_REG_PR_URL" == https://* ]]; then
            echo "$SELF_REG_PR_URL" > /tmp/zeta-self-reg-pr-url
          else
            echo "[iter-5.4.1]   WARN: gh pr create did not return a URL; output was: $SELF_REG_PR_URL" >&2
            # 081KSKBP80008QG0R000GPC0TB-fix: PR creation failed after a successful push — delete the
            # branch so we don't leave an orphan (the node-09485d failure mode).
            echo "[iter-5.4.1]          deleting the just-pushed branch to avoid an orphan: $REG_BRANCH" >&2
            git push origin --delete "$REG_BRANCH" 2>&1 | tail -2 || true
          fi
        else
          echo "[iter-5.4.1]   WARN: git push failed; check gh-auth scope (needs repo:write); skipping PR" >&2
        fi
      ) || true
      if [ -s /tmp/zeta-self-reg-pr-url ]; then
        SELF_REG_PR_URL=$(cat /tmp/zeta-self-reg-pr-url)
        SELF_REG_OK=1
        echo "[iter-5.4.1]   SUCCESS — registration PR opened: $SELF_REG_PR_URL"
        echo "[iter-5.4.1]   Operator merges from anywhere (phone-merge OK)."
        echo "[iter-5.4.1]   ArgoCD reconciles after merge per 081KSGS9H0008QG0R002K93MWX iter-5.4.2."
      else
        echo "[iter-5.4.1]   ====================================================================" >&2
        echo "[iter-5.4.1]   WARN: self-registration did NOT complete — this node is NOT registered." >&2
        echo "[iter-5.4.1]         The install otherwise succeeded and the node will boot fine." >&2
        echo "[iter-5.4.1]         See the ERROR + diagnostics above for the cause. No orphaned" >&2
        echo "[iter-5.4.1]         register-* branch was left behind. To register after boot:" >&2
        echo "[iter-5.4.1]           ssh into the node → 'gh auth login' → re-run registration." >&2
        echo "[iter-5.4.1]   ====================================================================" >&2
      fi
    else
      echo "[iter-5.4.1]   WARN: gh repo clone failed; skipping self-registration"
      echo "[iter-5.4.1]          (operator can re-run manually post-install)"
    fi
    # Cleanup: temp dir is operator-owned + safe to remove
    rm -rf "$WORK_DIR" /tmp/zeta-self-reg-pr-url 2>/dev/null || true
  fi
else
  echo "[iter-5.4.1] skipped — iter-5.4.0 gh-auth was skipped or failed; no auth foothold for commit+push"
  echo "[iter-5.4.1] (operator can re-run manually post-install via tools/cluster/register-node.ts when that ships)"
  # 081KSGS9H0008QG0R0011BC7T2 slice 2: QEMU/CI dry-run — compose registration YAML without gh push.
  if ! zeta_install_prompts_enabled && [ -f "$HOSTNAME_DST" ]; then
    MAINTAINER="qemu-ci"
    zeta_self_reg_resolve_node_hostname
    zeta_self_reg_compose_node_yaml
    PREVIEW="/mnt/etc/zeta/cluster-node-registration-preview.yaml"
    sudo mkdir -p "$(dirname "$PREVIEW")"
    printf '%s\n' "$NODE_YAML" | sudo tee "$PREVIEW" >/dev/null
    echo "[iter-5.4.1-ci] composed ClusterNode maintainer=$MAINTAINER node=$NODE_HOSTNAME"
    echo "[iter-5.4.1-ci] tree-path=maintainers/$MAINTAINER/cluster-nodes/$NODE_HOSTNAME/node.yaml"
    echo "[iter-5.4.1-ci] preview=$PREVIEW"
  fi
fi
echo

# ── 081KSGS9H0008QG0R00120EEHM Bug 1 fix: pre-stage per-file symlinks so flake eval can ──
# read /etc/zeta/* files at build time. Several NixOS modules in the
# flake use `builtins.pathExists` + `builtins.readFile` on absolute
# `/etc/zeta/*` paths at evaluation time (flake build-time). During
# nixos-install from live ISO, those paths refer to the LIVE ISO root
# (files absent) NOT the install target /mnt/etc/zeta/ (files present
# from earlier install steps).
#
# Modules affected (same bug class):
#   - injected-hostname.nix       → /etc/zeta/cluster-node-id (Bug 1)
#   - operator-authorized-keys.nix → /etc/zeta/operator-authorized-keys
#                                    (081KSGS9H0008QG0R00120EEHM sibling — same bug; operator
#                                    SSH-from-Mac would silently lose
#                                    iter-5.4.0 captured pubkeys at
#                                    install-time eval without this fix)
# NOT affected (uses activation-script instead, per 081KSGS9H0008QG0R00120EEHM Bug 3b fix):
#   - initial-password.nix → activation reads /etc/zeta/initial-hashedpassword
#     at boot-time on installed system; doesn't need this symlink
#
# Fix: per-file symlinks (NOT directory-level — /etc/zeta may already
# exist as a real dir + sym-replacement would lose contents). Only
# create the symlink if the destination doesn't already exist (handles
# rebuild-on-installed-system case where /etc/zeta/* are real files).
#
# Cleanup: trap-based so removal happens even if nixos-install fails or
# is Ctrl-C'd. Defense-in-depth via explicit cleanup at end too.
#
# Empirical anchor: operator 2026-05-26 physical hardware-support test:
# login banner showed "control-plane login:" instead of unique
# node-<6hex>. Composes with the same path-mismatch class as 081KSGS9H0008QG0R00120EEHM
# Bug 3b (password) which was fixed via activation-script (different
# fix because password CAN apply at activation; hostname CANNOT cleanly
# change at activation because many services bake hostname at build).
SYMLINKED_FILES=()
cleanup_symlinks() {
  # Trap handler — runs on EXIT (success, failure, OR signal). Removes
  # only the symlinks WE created. Idempotent + safe to re-run.
  for f in "${SYMLINKED_FILES[@]}"; do
    [ -L "$f" ] && sudo rm -f "$f"
  done
}
trap cleanup_symlinks EXIT
sudo mkdir -p /etc/zeta
maybe_symlink() {
  local src="$1" dst="$2"
  if [ -f "$src" ] && [ ! -e "$dst" ]; then
    sudo ln -sf "$src" "$dst"
    SYMLINKED_FILES+=("$dst")
    echo "[081KSGS9H0008QG0R00120EEHM Bug 1 fix] symlinked $src → $dst (flake-eval visibility)"
  elif [ -e "$dst" ] && [ ! -L "$dst" ]; then
    echo "[081KSGS9H0008QG0R00120EEHM Bug 1 fix]   $dst already exists as real file; not symlinking"
  fi
}
maybe_symlink "$HOSTNAME_DST" /etc/zeta/cluster-node-id
maybe_symlink /mnt/etc/zeta/operator-authorized-keys /etc/zeta/operator-authorized-keys

# 081KSNY2Z0008QG0R0008PN7RQ QEMU phase-3: non-interactive CI installs enable boot-time first-session
# demo (systemd oneshot tees markers to ttyS0; qemu-full-install-test asserts them).
# Cascade #6 deepen: also enable post-boot self-register CI dry-run (compose-only; no live gh).
if [[ "${ZETA_AUTO_CONFIRM:-}" == "WIPE" ]]; then
  sudo mkdir -p /mnt/etc/zeta
  echo "setup-gh,local-only" | sudo tee /mnt/etc/zeta/qemu-first-session-ci >/dev/null
  sudo chmod 0644 /mnt/etc/zeta/qemu-first-session-ci
  echo "[081KSNY2Z0008QG0R0008PN7RQ]   wrote /mnt/etc/zeta/qemu-first-session-ci (QEMU phase-3 boot demo)"
  echo "ci-dry-run" | sudo tee /mnt/etc/zeta/qemu-self-register-ci >/dev/null
  sudo chmod 0644 /mnt/etc/zeta/qemu-self-register-ci
  echo "[081KSGS9H0008QG0R0011BC7T2]   wrote /mnt/etc/zeta/qemu-self-register-ci (QEMU post-boot self-register dry-run)"
fi

echo "Running nixos-install --flake /mnt/etc/zeta/full-ai-cluster#$HOST ..."
# --impure: required so builtins.pathExists + builtins.readFile in the
# affected modules (injected-hostname.nix + operator-authorized-keys.nix)
# can read the symlinked /etc/zeta/* files. Without --impure, flake
# pure-mode refuses non-store absolute paths even with symlinks in place.
# Safe here because:
#   - Impure reads are operator-chosen hostname + operator's PUBLIC SSH
#     pubkeys (NOT secrets — pubkeys are public by definition)
#   - initial-password.nix does NOT use builtins.readFile (per 081KSGS9H0008QG0R00120EEHM
#     Bug 3b fix uses activation-script instead); its hash file (which
#     IS a secret) doesn't transit the impure-eval path
#
# WiFi-reproducibility (empirical 2026-05-26: cache.nixos.org timeouts
# on same 5 derivations twice in a row over WiFi):
#   --option fallback true: build from source if substitute download fails
#               (don't bail — keeps the install moving even when cache is flaky)
#               (NOTE: this is the Nix-option pass-through form; nixos-install
#               does NOT accept top-level --fallback flag — empirical 2026-05-27
#               Aaron USB boot failure: `unknown option '--fallback'`)
#   --option connect-timeout 10: drop dead substituter connections fast
#               instead of waiting the default 0 (=no timeout)
#   --option stalled-download-timeout 60: cut the 300s default by 5×; a
#               stalled download is detected sooner so retry or fallback
#               fires faster
#   --option download-attempts 3: cap retries (default 5) so the loop
#               bounded-progresses to fallback
# Slower for the few stalled derivations (local build vs cache download)
# but UNBLOCKS the install instead of looping on the same 5 files.
# Full reproducibility work (closure-baking, Cachix mirror, extra-substituters)
# tracked at 081KSGS9H0008QG0R003X5Y2A5.
sudo nixos-install \
  --impure \
  --option fallback true \
  --option connect-timeout 10 \
  --option stalled-download-timeout 60 \
  --option download-attempts 3 \
  --flake "/mnt/etc/zeta/full-ai-cluster#$HOST" \
  --no-root-password

# Explicit cleanup at end (defense-in-depth; trap also handles this on
# success OR failure exit paths).
cleanup_symlinks
trap - EXIT

# ── Step 6.94: 081KSKBP80008QG0R003AX2A69.3a cred-picker stub ───────────────────────────
# The actual picker invocation lives at Step 6.95-picker (below) which
# fires AFTER 6.95a-bootstrap clones the repo + installs bun. This
# header reserves the step number for forward references; no work here.

# ── Step 6.95: iter-5.5.0 — claude-code install + credential persistence (081KSGS9H0008QG0R001JNKBFD Phase 2) ──
# Aaron 2026-05-27 ask: "wanna make this automatic on boot before i even
# login and have it save my claude code device login like gh, also make
# sure they are all on path for me to play with when i log in?"
#
# This step mirrors iter-5.4.0's gh-auth pattern at install-time for the
# node-local Claude Code agent (081KSGS9H0008QG0R001JNKBFD). Three parts:
#
#   1. INSTALL Claude Code via npm globally into a writable prefix
#      under /mnt/home/zeta (so it survives reboot AND is in the zeta
#      user's PATH via .npm-global/bin from /etc/profile.d).
#
#   2. PERSIST credentials to /mnt/home/zeta/.config/{gh,claude}/ with
#      zeta-user ownership. This closes the iter-5.4.0 gap empirically
#      observed 2026-05-27: gh auth login wrote /root/.config/gh/ in the
#      INSTALLER environment but the installed system's zeta user had no
#      credentials post-reboot. iter-5.5.0 fixes both `gh` and `claude`
#      auth persistence in one step.
#
#   3. PRE-CLONE the Zeta repo to /mnt/home/zeta/Zeta so first-login
#      operator workflow is "cd ~/Zeta && claude" with no extra setup.
#
# Skip conditions (P2 fix per PR #5388 Copilot review — comment
# updated to match ACTUAL control-flow, which doesn't gate on
# GH_AUTH_OK):
#   - /mnt/home/zeta doesn't exist (means nixos-install hasn't created
#     the user yet — possible if Step 6.x ordering changes)
# iter-5.5.0 runs REGARDLESS of GH_AUTH_OK because: (a) claude install
# only needs network, not gh auth; (b) claude login is operator-
# interactive and independent of gh; (c) gh credential persistence
# step 6.95c is itself conditional on /root/.config/gh existing
# (which iter-5.4.0 only creates if gh auth succeeded). Net behavior:
# install + claude login always attempted; gh credentials persisted
# ONLY when they exist.

ZETA_HOME=/mnt/home/zeta

# P0 fix (PR #5388 Copilot review): resolve zeta UID/GID from the
# INSTALLED system rather than hardcoding 1000:100 — if another user
# is created first or NixOS module config changes, hardcoded IDs would
# chown files to the wrong owner. chroot reads /mnt/etc/passwd via the
# installed system's id binary which is authoritative.
ZETA_UID=$(sudo chroot /mnt id -u zeta 2>/dev/null || echo "")
ZETA_GID=$(sudo chroot /mnt id -g zeta 2>/dev/null || echo "")
if [ -z "$ZETA_UID" ] || [ -z "$ZETA_GID" ]; then
  echo "[iter-5.5.0]   WARN: could not resolve zeta UID/GID from /mnt via chroot;"
  echo "[iter-5.5.0]   falling back to NixOS defaults (1000:100). If the installed"
  echo "[iter-5.5.0]   system uses different IDs, post-reboot file ownership may"
  echo "[iter-5.5.0]   need correction via 'sudo chown -R zeta:users ~/.{config,bun,Zeta}'"
  ZETA_UID=1000
  ZETA_GID=100
else
  echo "[iter-5.5.0]   resolved zeta UID:GID = $ZETA_UID:$ZETA_GID (via chroot id zeta)"
fi

if [ -d "$ZETA_HOME" ]; then
  echo "[iter-5.5.0] ── canonical runtime/agent CLI install + credential persistence (081KSGS9H0008QG0R001JNKBFD) ──"

  # 6.95a — bootstrap runtimes via mise (.mise.toml single source of
  # truth; operator 2026-05-27 ALIGNMENT catch) AND install peer/agent
  # CLIs via the canonical setup manifests:
  #
  #   tools/setup/manifests/from-bun-global       (claude/codex)
  #   tools/setup/manifests/from-installer  (grok/cursor/kiro/hermes/forge/agy)
  #
  # We pre-clone the Zeta repo at Step 6.95d-equivalent BEFORE this
  # step so .mise.toml + setup manifests are available; reorder vs the
  # original PR. The installer no longer hardcodes bun installs for
  # individual harnesses here — install.sh owns declarative dependency
  # drift, and this block only handles operator-interactive login.
  #
  # Pre-clone the repo NOW (was Step 6.95d; moved up so 6.95a can read
  # .mise.toml). Subsequent 6.95d block is a no-op if directory exists.
  if [ ! -d "$ZETA_HOME/Zeta" ]; then
    echo "[iter-5.5.0] pre-cloning Zeta repo to $ZETA_HOME/Zeta..."
    sudo -u "#$ZETA_UID" git clone https://github.com/Lucent-Financial-Group/Zeta.git "$ZETA_HOME/Zeta" 2>&1 | tail -3 || \
      echo "[iter-5.5.0]   WARN: clone failed — target runtime/agent bootstrap cannot run; can retry post-reboot"
  fi

  # 6.95a-bootstrap — invoke the canonical install entry from the
  # pre-cloned repo. tools/setup/install.sh is the single install graph
  # dev laptops + CI runners + devcontainers use (GOVERNANCE §24), now
  # extended to installed-target bootstrap from the live ISO.
  #
  # Important: this shell still runs in the LIVE ISO namespace where
  # /etc/NIXOS + /iso or /run/initramfs are present. Without the explicit
  # ZETA_INSTALL_NIXOS_MODE=installed override, install.sh intentionally
  # routes to the live-USB guard and exits 2. The override is scoped to
  # this target-runtime bootstrap call only; direct operator calls to
  # install.sh on the live ISO still get the safety guard.
  #
  # ZETA_INSTALL_FULL=1 opts into the one-liner registry even when the
  # install is launched non-interactively (first-boot flow), so the
  # installed system picks up the same declarative agent CLI surface as
  # an interactive dev shell.
  if [ -d "$ZETA_HOME/Zeta" ]; then
    echo "[iter-5.5.0] running tools/setup/install.sh (target runtime + declarative agent CLI bootstrap)..."
    ZETA_TARGET_PATH="/run/current-system/sw/bin:/run/current-system/sw/sbin:${ZETA_HOME}/.local/bin:/usr/bin:/bin"
    sudo -u "#$ZETA_UID" \
      HOME="$ZETA_HOME" \
      BUN_INSTALL="$ZETA_HOME/.bun" \
      PATH="$ZETA_TARGET_PATH" \
      ZETA_INSTALL_NIXOS_MODE=installed \
      ZETA_INSTALL_FULL=1 \
      bash -c "cd $ZETA_HOME/Zeta && ZETA_HOST_TIER=full tools/setup/install.sh" 2>&1 | tail -10 || \
        echo "[iter-5.5.0]   WARN: install.sh FAILED — runtimes/agent CLIs may be partial; can retry post-reboot via 'cd ~/Zeta && tools/setup/install.sh'"
  fi

  # install.sh owns the manifest-driven agent CLI installs. Keep the
  # ~/.bun directory present/owned so login flows and post-reboot retries
  # have the expected target home layout even if install.sh warned.
  sudo mkdir -p "$ZETA_HOME/.bun/bin"
  sudo chown -R "$ZETA_UID:$ZETA_GID" "$ZETA_HOME/.bun"

  # 6.95-picker — 081KSKBP80008QG0R003AX2A69.3a cred-picker (operator interactive at setup time)
  # Operator 2026-05-27 framing: "human interactive at setup time" + "ask what declared
  # creds you want to bake in vs go through device flow".
  #
  # Runs AFTER 6.95a-bootstrap (repo + bun + mise present) and BEFORE 6.95b-* device-flow
  # logins so picker decides per-cred bake-vs-defer + the device-flow steps handle the
  # deferred subset.
  #
  # Default behavior (081KSKBP80008QG0R003AX2A69.3c flip, 2026-05-27): AUTO-ENABLE when
  # both /etc/zeta/usb-uuid (PR #5637 closes this) and the
  # ZETA_CREDS_PASSPHRASE_VAL shell variable (populated by Step 6.56
  # prompt; held non-exported per 081KSKBP80008QG0R003AX2A69.3b-supersede discipline) are
  # present. Explicit opt-out via ZETA_CREDS_PICKER=0 (env or
  # /etc/zeta/no-picker marker file).
  #
  # Rationale: with all 3 preconditions auto-populated by the install
  # flow, the picker becomes the operator's "don't re-enter credentials
  # over and over" solution. Backward compat preserved: any automated
  # install that doesn't want the picker can opt out via
  # ZETA_CREDS_PICKER=0 OR by NOT entering a passphrase at Step 6.56
  # (empty passphrase keeps current per-reboot re-entry behavior).
  #
  # Three opt-out paths (any one disables the picker):
  #   1. ZETA_CREDS_PICKER=0 env var
  #   2. /etc/zeta/no-picker marker file present
  #   3. Operator entered empty passphrase at Step 6.56 (no PASSPHRASE)
  #
  # SECURITY: the passphrase is FORWARDED VIA SUDO --preserve-env=ZETA_CREDS_PASSPHRASE,
  # NOT inlined in bash -c arg-string (the latter would leak the literal passphrase
  # into the process arglist visible to ps). The picker reads it via --passphrase-env
  # which references the env-var-NAME only. The env var name ZETA_CREDS_PASSPHRASE
  # is set INLINE-IN-SUDO-INVOCATION (`ZETA_CREDS_PASSPHRASE="$ZETA_CREDS_PASSPHRASE_VAL"
  # sudo --preserve-env=ZETA_CREDS_PASSPHRASE ...`) so it lives in the sudo
  # subprocess env only; the parent installer shell holds the secret in the
  # NON-EXPORTED shell var ZETA_CREDS_PASSPHRASE_VAL, never exported anywhere.
  PICKER_OPT_OUT=0
  if [ "${BOOT_USB_CREDS_PRESEEDED:-0}" = "1" ] && [ -f /mnt/boot/zeta-creds.enc ]; then
    PICKER_OPT_OUT=1
    PICKER_SKIP_REASON="/mnt/boot/zeta-creds.enc already present from zflash retention preseed"
  elif [ "${ZETA_CREDS_PICKER:-1}" = "0" ]; then
    PICKER_OPT_OUT=1
    PICKER_SKIP_REASON="ZETA_CREDS_PICKER=0 (env opt-out)"
  elif [ -f /etc/zeta/no-picker ]; then
    PICKER_OPT_OUT=1
    PICKER_SKIP_REASON="/etc/zeta/no-picker marker present (file opt-out)"
  elif [ ! -f /etc/zeta/usb-uuid ]; then
    PICKER_OPT_OUT=1
    PICKER_SKIP_REASON="/etc/zeta/usb-uuid missing (081KSKBP80008QG0R003AX2A69.3a-prep did not capture UUID)"
  elif [ -z "${ZETA_CREDS_PASSPHRASE_VAL:-}" ]; then
    PICKER_OPT_OUT=1
    PICKER_SKIP_REASON="ZETA_CREDS_PASSPHRASE_VAL empty (operator skipped passphrase at Step 6.56)"
  fi
  if [ "$PICKER_OPT_OUT" = "0" ]; then
    USB_UUID="$(cat /etc/zeta/usb-uuid)"
    echo "[iter-5.5.0] ── 6.95-picker: 081KSKBP80008QG0R003AX2A69.3a cred-picker (DEFAULT-ON per 081KSKBP80008QG0R003AX2A69.3c) ──"
    echo "[iter-5.5.0]   passphrase from Step 6.56; usb-uuid from 081KSKBP80008QG0R003AX2A69.3a-prep"
    echo "[iter-5.5.0]   to opt out: set ZETA_CREDS_PICKER=0 OR touch /etc/zeta/no-picker"
    # mise activate inside bash -c matches sibling 6.95a-claude/gemini/codex
    # patterns at lines 1119-1141; without it, bun is not on the PATH the
    # subshell sees (mise installs bun via shims; activate sets PATH).
    # BUN_INSTALL pin matches sibling pattern too.
    #
    # Output path: write the cred-blob to the TARGET ESP mount during
    # install. The target ESP is mounted at /mnt/boot by Step 5
    # ('sudo mount "$ESP_PART" /mnt/boot'). After reboot into the
    # installed system, disko re-mounts the SAME ESP partition at
    # /boot — so the file persists across the install-vs-installed
    # boundary as the same physical file at two mount paths
    # (/mnt/boot during install → /boot post-reboot). The restore
    # service (zeta-creds-restore.nix) reads from /boot/zeta-creds.enc
    # at boot-time.
    #
    # Env-var passing: inline-set ZETA_CREDS_PASSPHRASE only into the
    # sudo subprocess (not exported in the parent installer shell).
    # See SECURITY block above for full lifecycle.
    ZETA_CREDS_PASSPHRASE="$ZETA_CREDS_PASSPHRASE_VAL" sudo --preserve-env=ZETA_CREDS_PASSPHRASE -u "#$ZETA_UID" \
      HOME="$ZETA_HOME" BUN_INSTALL="$ZETA_HOME/.bun" \
      bash -c "set -o pipefail; export PATH='/run/current-system/sw/bin:/run/current-system/sw/sbin:${ZETA_HOME}/.local/share/mise/shims:${ZETA_HOME}/.bun/bin:/usr/bin:/bin'; eval \"\$(mise activate bash 2>/dev/null || true)\"; cd '$ZETA_HOME/Zeta' && bun src/Core.TypeScript/installer/zeta-creds-picker.ts --usb-uuid '$USB_UUID' --output /mnt/boot/zeta-creds.enc --passphrase-env ZETA_CREDS_PASSPHRASE" || \
        echo "[iter-5.5.0]   WARN: picker exited non-zero; cred-blob may be partial"
  else
    echo "[iter-5.5.0]   SKIP 6.95-picker: $PICKER_SKIP_REASON"
  fi
  # 081KSKBP80008QG0R003AX2A69.3b-supersede discipline: unset ZETA_CREDS_PASSPHRASE_VAL
  # UNCONDITIONALLY after the picker block — fires in BOTH the
  # picker-ran branch AND the picker-skipped branch. Prior code only
  # unset inside the picker-ran branch, leaving the passphrase live
  # in the installer shell for the rest of execution whenever
  # ZETA_CREDS_PICKER=0 / /etc/zeta/no-picker / usb-uuid-missing path
  # was taken.
  unset ZETA_CREDS_PASSPHRASE_VAL
  echo "[iter-5.5.0]   ZETA_CREDS_PASSPHRASE_VAL unset from installer shell (post-picker block; fires in both branches)"

  # 6.95b — interactive claude login (mirror iter-5.4.0 gh auth login)
  CLAUDE_BIN="$ZETA_HOME/.bun/bin/claude"
  if [ -x "$CLAUDE_BIN" ]; then
    echo
    echo "[iter-5.5.0] Trigger Claude Code interactive device-flow login NOW (mirror of gh auth login)?"
    echo "[iter-5.5.0]   - Opens a code prompt; visit URL on this Mac browser; approve."
    echo "[iter-5.5.0]   - Credentials land at $ZETA_HOME/.config/claude/ and survive reboot."
    echo "[iter-5.5.0]   - Default YES (press Enter); 'n' to skip + login post-reboot manually."
    if zeta_install_prompts_enabled; then
      read -r -p "[iter-5.5.0] Run claude login now? [Y/n]: " CLAUDE_AUTH_REPLY
    else
      echo "[iter-5.5.0] non-interactive install (ZETA_AUTO_CONFIRM=WIPE or non-TTY); skipping claude login"
      CLAUDE_AUTH_REPLY=n
    fi
    case "${CLAUDE_AUTH_REPLY:-y}" in
      [Yy]*|"")
        echo "[iter-5.5.0]   running 'claude login' (interactive)..."
        sudo HOME="$ZETA_HOME" -u "#$ZETA_UID" "$CLAUDE_BIN" login || \
          echo "[iter-5.5.0]   WARN: claude login failed; can re-run post-reboot"
        # P0 security fix (PR #5388 Copilot review): restrict perms on
        # ~/.config/claude AFTER login completes — claude CLI may write
        # tokens with default umask which could leave them group/world-
        # readable. Parallel to the gh credential restriction below.
        if [ -d "$ZETA_HOME/.config/claude" ]; then
          sudo chown -R "$ZETA_UID:$ZETA_GID" "$ZETA_HOME/.config/claude"
          sudo chmod -R go-rwx "$ZETA_HOME/.config/claude"
        fi
        ;;
      *)
        echo "[iter-5.5.0]   SKIPPED claude login; run 'claude login' on first login"
        ;;
    esac
  else
    echo "[iter-5.5.0] claude binary not found at $CLAUDE_BIN; skipping interactive login"
  fi


  # 6.95b-codex — interactive codex login (081KSKBP80008QG0R003Z4C0D0 Phase 3c Vera).
  # 3rd vendor login — codex CLI has the most explicit device-flow
  # via `codex login --device-auth` (Anthropic claude device-flow
  # analog; works on headless / no-local-browser systems by
  # printing URL+code for paste into ANY browser). Credentials
  # cache at ~/.codex/auth.json (NOT ~/.config/codex/ — codex
  # uses its own dotdir convention per the codex docs).
  CODEX_BIN="$ZETA_HOME/.bun/bin/codex"
  if [ -x "$CODEX_BIN" ]; then
    echo
    echo "[iter-5.5.0] Trigger Codex CLI interactive device-flow login NOW (081KSKBP80008QG0R003Z4C0D0 Phase 3c Vera)?"
    echo "[iter-5.5.0]   - Uses 'codex login --device-auth' (clean device-flow shape)."
    echo "[iter-5.5.0]   - Prints URL + one-time code; visit on ANY browser on ANY device; paste code."
    echo "[iter-5.5.0]   - ChatGPT Plus/Pro/Business/Edu/Enterprise plans include Codex access."
    echo "[iter-5.5.0]   - Credentials land at $ZETA_HOME/.codex/auth.json (NOT ~/.config/codex)."
    echo "[iter-5.5.0]   - Default YES (press Enter); 'n' to skip + login post-reboot manually."
    if zeta_install_prompts_enabled; then
      read -r -p "[iter-5.5.0] Run codex login --device-auth now? [Y/n]: " CODEX_AUTH_REPLY
    else
      echo "[iter-5.5.0] non-interactive install (ZETA_AUTO_CONFIRM=WIPE or non-TTY); skipping codex login"
      CODEX_AUTH_REPLY=n
    fi
    case "${CODEX_AUTH_REPLY:-y}" in
      [Yy]*|"")
        echo "[iter-5.5.0]   running 'codex login --device-auth' (interactive)..."
        sudo HOME="$ZETA_HOME" -u "#$ZETA_UID" "$CODEX_BIN" login --device-auth || \
          echo "[iter-5.5.0]   WARN: codex login failed; can re-run post-reboot"
        # Codex stores at ~/.codex/auth.json (not ~/.config/codex);
        # restrict perms accordingly.
        if [ -d "$ZETA_HOME/.codex" ]; then
          sudo chown -R "$ZETA_UID:$ZETA_GID" "$ZETA_HOME/.codex"
          sudo chmod -R go-rwx "$ZETA_HOME/.codex"
        fi
        ;;
      *)
        echo "[iter-5.5.0]   SKIPPED codex login; run 'codex login --device-auth' on first login"
        ;;
    esac
  else
    echo "[iter-5.5.0] codex binary not found at $CODEX_BIN; skipping interactive login"
  fi

  # 6.95c — persist gh credentials from installer-root to installed-zeta
  # Closes the iter-5.4.0 credential-persistence gap (Bug 8).
  if [ -d /root/.config/gh ]; then
    echo "[iter-5.5.0] persisting /root/.config/gh → $ZETA_HOME/.config/gh (Bug 8 fix)"
    sudo mkdir -p "$ZETA_HOME/.config"
    sudo cp -r /root/.config/gh "$ZETA_HOME/.config/"
    sudo chown -R "$ZETA_UID:$ZETA_GID" "$ZETA_HOME/.config/gh"
    # Restrict perms — gh tokens are secrets
    sudo chmod -R go-rwx "$ZETA_HOME/.config/gh"
  else
    echo "[iter-5.5.0] /root/.config/gh absent; nothing to persist (gh auth login was skipped?)"
  fi

  # 6.95d — pre-clone now happens up in 6.95a-bootstrap (before mise
  # install needs .mise.toml). This sub-step is intentionally empty
  # since the clone moved up.

  echo "[iter-5.5.0] ── DONE — first login will have: install.sh-managed runtimes + declarative agent CLIs on PATH; ~/Zeta cloned (via 6.95a-bootstrap); ~/.config/{gh,claude} populated when available; ~/.bun/bin on PATH ──"
else
  echo "[iter-5.5.0] $ZETA_HOME absent; skipping (nixos-install ordering changed?)"
fi
echo

# ── Step 7: print initial credentials (iter-4 — per 081KSGS9H0008QG0R002T3BJ2R) ──────
echo
echo "================================================================"
echo "  ZETA CLUSTER NODE INSTALL COMPLETE"
echo "================================================================"
echo
echo "  Initial login credentials:"
echo
echo "    user:     zeta"
echo "    password: documented at install-time only; not shown"
echo "              here (security + UX)"
echo
if [ "$GH_AUTH_OK" = 1 ] && [ "$GH_KEY_COUNT" != "0" ]; then
  echo "  iter-5.4.0 GH-AUTH + OPERATOR-PUBKEY INJECTION: SUCCESS ($GH_KEY_COUNT keys)"
  echo "    SSH access works on first boot from any machine using"
  echo "    your registered-with-GitHub SSH keys:"
  echo "      ssh zeta@\$(hostname).local"
  echo

  # 081KSGS9H0008QG0R0037H3W4T iter-5.4.1: surface the self-registration PR URL if Step 6.9
  # opened one. This is the operator's call-to-action — merge the PR
  # from anywhere (phone OK) to bring the node into the cluster via
  # ArgoCD reconciliation (081KSGS9H0008QG0R002K93MWX iter-5.4.2).
  if [ "$SELF_REG_OK" = 1 ] && [ -n "$SELF_REG_PR_URL" ]; then
    echo "  iter-5.4.1 SELF-REGISTRATION: SUCCESS"
    echo "    Node-registration PR opened:"
    echo "      $SELF_REG_PR_URL"
    echo "    Review + merge → ArgoCD reconciles → node joins cluster"
    echo "    (phone-merge OK — no laptop kubectl required)"
    echo
  else
    echo "  iter-5.4.1 SELF-REGISTRATION: SKIPPED (see diagnostics above)"
    echo "    Manual fallback: tools/cluster/register-node.ts (when shipped)"
    echo "    OR push commit to maintainers/<your-gh-user>/cluster-nodes/<hostname>/node.yaml"
    echo
  fi

  echo "  AFTER FIRST LOGIN:"
  echo "    1. (password already set per iter-5.3 prompt — or unchanged"
  echo "        if iter-5.3 was skipped; rotate via 'passwd zeta' anytime)"
  echo "    2. (SSH already works — operator keys auto-injected)"
elif [ "$INJECT_OK" = 1 ]; then
  echo "  iter-4.2 SSH-KEY INJECTION: SUCCESS (iter-5.4.0 gh-auth skipped)"
  echo "    SSH access works on first boot from the workstation that flashed this USB:"
  echo "      ssh zeta@\$(hostname)"
  echo
  echo "  AFTER FIRST LOGIN:"
  echo "    1. passwd zeta            # rotate the initial password (if iter-5.3 skipped)"
  echo "    2. (SSH already works — no manual edit + rebuild required)"
else
  echo "  iter-4.2 SSH-KEY INJECTION: SKIPPED"
  echo "  iter-5.4.0 GH-AUTH SSH-PUBKEY INJECTION: SKIPPED"
  echo "  (see diagnostics above)"
  echo
  echo "  AFTER FIRST LOGIN (fallback to iter-4 v1 manual flow):"
  echo "    1. passwd zeta            # rotate the initial password (if iter-5.3 skipped)"
  echo "    2. Edit /etc/zeta/full-ai-cluster/nixos/modules/operator-ssh-keys.nix"
  echo "       and add your ssh-ed25519 pubkey, then:"
  echo "    3. sudo nixos-rebuild switch --flake /etc/zeta/full-ai-cluster#$HOST"
  echo "    4. Verify SSH from your workstation:"
  echo "       ssh zeta@\$(hostname)"
fi
echo
echo "================================================================"
echo

# ── 081KSGS9H0008QG0R001RR3ZXQ install log preservation — copy to install target ────────
# At end-of-script (success path), copy the live-ISO log to the
# installed system at /mnt/var/log/zeta-install.log so it survives
# the reboot. After first boot of the installed system, operator can
# inspect via `cat /var/log/zeta-install.log | less`. If /mnt is not
# mounted (e.g., script exited before disk setup), the copy is a
# no-op + the live-ISO log at $ZETA_INSTALL_LOG remains available
# until reboot.
if [ -d "/mnt/var" ]; then
  sudo mkdir -p /mnt/var/log
  sudo cp "$ZETA_INSTALL_LOG" /mnt/var/log/zeta-install.log
  sudo chmod 0644 /mnt/var/log/zeta-install.log
  echo "[081KSGS9H0008QG0R001RR3ZXQ] install log copied to /mnt/var/log/zeta-install.log"
  echo "[081KSGS9H0008QG0R001RR3ZXQ] post-reboot: \`cat /var/log/zeta-install.log | less\`"
fi
echo "[081KSGS9H0008QG0R001RR3ZXQ] live-ISO copy still available at $ZETA_INSTALL_LOG until reboot"
