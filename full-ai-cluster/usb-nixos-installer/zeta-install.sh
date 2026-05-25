#!/usr/bin/env bash
# zeta-install — guided 2-NVMe installer for the AI cluster.
#
# Lives on the USB at /run/current-system/sw/bin/zeta-install (installed
# by the installer's configuration.nix). Walks through:
#
#   1. Show internal NVMe disks (USB excluded automatically)
#   2. Confirm full wipe (typed confirmation required)
#   3. Wipe both disks (wipefs + sgdisk --zap-all)
#   4. Partition per the standard 2-NVMe shape
#   5. Format + mount
#   6. Clone Zeta + run nixos-install for the chosen host
#
# Use the cookie-cutter disko shape when the worktree carries it
# (post PR #4950); otherwise falls back to the same partition layout
# done manually so this script works against current main too.

set -euo pipefail

REPO_URL="${REPO_URL:-https://github.com/Lucent-Financial-Group/Zeta}"
HOST="${1:-}"

bail() { echo "ERROR: $*" >&2; exit 1; }

# ── Step 1: enumerate internal NVMes ─────────────────────────────
echo "Internal NVMe disks:"
mapfile -t NVMES < <(lsblk -d -p -n -o NAME,TRAN | awk '$2=="nvme"{print $1}')
if [[ ${#NVMES[@]} -ne 2 ]]; then
  bail "expected exactly 2 NVMes, found ${#NVMES[@]}: ${NVMES[*]:-none}"
fi
for d in "${NVMES[@]}"; do
  size=$(lsblk -d -n -o SIZE "$d")
  model=$(lsblk -d -n -o MODEL "$d" | tr -s ' ')
  serial=$(lsblk -d -n -o SERIAL "$d")
  echo "  $d  $size  $model  serial=$serial"
done
echo

# ── Step 2: pick boot disk ───────────────────────────────────────
if [[ -z "${BOOT_DISK:-}" ]]; then
  read -rp "Which disk is the BOOT disk (gets OS + first Longhorn path)? [${NVMES[0]}]: " BOOT_DISK
  BOOT_DISK="${BOOT_DISK:-${NVMES[0]}}"
fi
DATA_DISK=""
for d in "${NVMES[@]}"; do [[ "$d" != "$BOOT_DISK" ]] && DATA_DISK="$d"; done
[[ -n "$DATA_DISK" ]] || bail "could not pick data disk"

echo
echo "About to FULL-WIPE both disks:"
echo "  Boot: $BOOT_DISK"
echo "  Data: $DATA_DISK"
echo
read -rp "Type WIPE to confirm: " confirm
[[ "$confirm" == "WIPE" ]] || bail "aborted"

# ── Step 3: wipe ─────────────────────────────────────────────────
for d in "$BOOT_DISK" "$DATA_DISK"; do
  echo "Wiping $d ..."
  sudo wipefs -af "$d"
  sudo sgdisk --zap-all "$d"
done

# ── Step 4: partition ────────────────────────────────────────────
ROOT_SIZE="${ROOT_SIZE:-256G}"
echo "Partitioning $BOOT_DISK (ESP 1G + root ${ROOT_SIZE} + longhorn1 rest) ..."
sudo sgdisk -n 1:0:+1G          -t 1:ef00 -c 1:ESP        "$BOOT_DISK"
sudo sgdisk -n "2:0:+${ROOT_SIZE}" -t 2:8300 -c 2:root    "$BOOT_DISK"
sudo sgdisk -n 3:0:0            -t 3:8300 -c 3:longhorn1  "$BOOT_DISK"

echo "Partitioning $DATA_DISK (whole disk longhorn2) ..."
sudo sgdisk -n 1:0:0 -t 1:8300 -c 1:longhorn2 "$DATA_DISK"

sudo partprobe
sleep 2

# ── Step 5: format + mount ───────────────────────────────────────
echo "Formatting ..."
sudo mkfs.fat -F 32 -n boot "${BOOT_DISK}p1"
sudo mkfs.ext4 -F -L nixos     "${BOOT_DISK}p2"
sudo mkfs.ext4 -F -L longhorn1 "${BOOT_DISK}p3"
sudo mkfs.ext4 -F -L longhorn2 "${DATA_DISK}p1"

echo "Mounting ..."
sudo mount "${BOOT_DISK}p2" /mnt
sudo mkdir -p /mnt/boot /mnt/var/lib/longhorn-disk1 /mnt/var/lib/longhorn-disk2
sudo mount "${BOOT_DISK}p1" /mnt/boot
sudo mount "${BOOT_DISK}p3" /mnt/var/lib/longhorn-disk1
sudo mount "${DATA_DISK}p1" /mnt/var/lib/longhorn-disk2

# ── Step 6: clone + install ──────────────────────────────────────
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

echo
echo "Install complete. \`reboot\` when ready."
