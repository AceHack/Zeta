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
#      ZETA_AUTO_CONFIRM=WIPE for non-interactive first-boot flow)
#   5. Wipe + partition:
#        BOOT disk: ESP 1G + root ${ROOT_SIZE:-256G} + longhorn1 (rest)
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

REPO_URL="${REPO_URL:-https://github.com/Lucent-Financial-Group/Zeta}"
HOST="${1:-}"
STORAGE_BACKEND="${STORAGE_BACKEND:-longhorn}"
ROOT_SIZE="${ROOT_SIZE:-256G}"

bail() { echo "ERROR: $*" >&2; exit 1; }

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
echo "  BOOT: $BOOT_DISK   (ESP 1G + root $ROOT_SIZE + longhorn1 rest)"
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
# (per B-0754 zero-typing-USB-install design). Direct interactive
# use still requires the typed WIPE.
if [[ "${ZETA_AUTO_CONFIRM:-}" == "WIPE" ]]; then
  echo "[ZETA_AUTO_CONFIRM=WIPE] non-interactive mode; proceeding without prompt"
else
  read -rp "Type WIPE to confirm: " confirm
  [[ "$confirm" == "WIPE" ]] || bail "aborted"
fi

# ── Step 3: wipe every disk in scope ──────────────────────────────
for d in "$BOOT_DISK" "${DATA_DISKS[@]}"; do
  echo "Wiping $d ..."
  sudo wipefs -af "$d"
  sudo sgdisk --zap-all "$d"
done

# ── Step 4: partition ─────────────────────────────────────────────
echo "Partitioning $BOOT_DISK (ESP 1G + root $ROOT_SIZE + longhorn1 rest) ..."
sudo sgdisk -n "1:0:+1G"           -t 1:ef00 -c 1:ESP        "$BOOT_DISK"
sudo sgdisk -n "2:0:+${ROOT_SIZE}" -t 2:8300 -c 2:root       "$BOOT_DISK"
sudo sgdisk -n "3:0:0"             -t 3:8300 -c 3:longhorn1  "$BOOT_DISK"

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
# then bails the whole install. Fix per B-0754 iter-3 empirical
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
if [[ -z "$HOST" ]]; then
  read -rp "Flake host attribute to install [control-plane]: " HOST
  HOST="${HOST:-control-plane}"
fi

echo "Cloning $REPO_URL ..."
sudo git clone "$REPO_URL" /mnt/etc/zeta

echo "Generating hardware-configuration.nix ..."
sudo nixos-generate-config --root /mnt --force

echo "Running nixos-install --flake /mnt/etc/zeta/full-ai-cluster#$HOST ..."
sudo nixos-install --flake "/mnt/etc/zeta/full-ai-cluster#$HOST" --no-root-password

# ── Step 7: print initial credentials (iter-4 — per B-0789) ──────
echo
echo "================================================================"
echo "  ZETA CLUSTER NODE INSTALL COMPLETE"
echo "================================================================"
echo
echo "  Initial login credentials (rotate immediately after first login):"
echo
echo "    user:     zeta"
echo "    password: zeta-change-me"
echo
echo "  AFTER FIRST LOGIN:"
echo "    1. passwd zeta            # rotate the initial password"
echo "    2. Edit /etc/zeta/full-ai-cluster/nixos/modules/operator-ssh-keys.nix"
echo "       and add your ssh-ed25519 pubkey, then:"
echo "    3. sudo nixos-rebuild switch --flake /etc/zeta/full-ai-cluster#$HOST"
echo "    4. Verify SSH from your workstation:"
echo "       ssh zeta@\$(hostname)"
echo
echo "  (Per docs/backlog/P1/B-0789 iter-4: SSH-key auto-inject from"
echo "   the boot USB is a follow-up — for v1, the SSH key flow is"
echo "   manual edit + nixos-rebuild as above.)"
echo
echo "================================================================"
echo
