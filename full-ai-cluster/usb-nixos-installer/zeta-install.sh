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
#   3a. PRE-FORMAT PROBE (R6): read-only inspect every in-scope disk and
#       PRINT what is on it (partition table, Zeta ESP, zeta-creds blob,
#       foreign filesystems with labels and ext4 used space). Failure-closed:
#       a disk that will not probe never reads as blank.
#   3b. REPAIR MODE (R4): recognise a prior Zeta install, recover identity
#       read-only so a re-paved node rejoins as ITSELF. An unvalidatable
#       remembered identity STOPS the wipe (HWR-2: two registrations, one MAC).
#   3c. CIRCUIT BREAKER (R9): bounded destructive attempts, counted in a
#       ledger on the boot USB ESP. OPEN flips the cancel window default to
#       ABORT. It never silently retries.
#   4. CANCEL WINDOW (R7): a countdown whose default is PROCEED, so the USB
#      still boots headless; any keypress aborts to a shell. This runs on the
#      zero-typing path too. The typed WIPE prompt still exists for direct
#      interactive use and is still bypassed by ZETA_AUTO_CONFIRM=WIPE, but it
#      is NO LONGER the only gate: the countdown is unconditional.
#      ZETA_AUTO_CONFIRM=WIPE also skips iter-5.3 password,
#      081KSKBP80008QG0R003AX2A69.3b passphrase, gh-auth, vendor logins.
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

# ZETA-PREFLIGHT-PARITY-BEGIN ------------------------------------
# Pure decision functions for the pre-format probe (R6), the cancel
# window (R7) and the circuit breaker (R9).
#
# NOTHING IN THIS BLOCK TOUCHES A DEVICE. It consumes fact records on
# stdin and prints decisions on stdout. The fact GATHERING lives below
# in Step 2.5; the fact CONSUMING lives here so it can be executed by
# src/Core.TypeScript/installer/disk-preflight-shell-parity.test.ts,
# which extracts this block by these markers and runs it under bash
# against the same fixtures the TypeScript spec is tested with.
#
# Kept to a bash-3.2 subset on purpose: the parity test has to run on
# the maintainer macOS bash, which is 3.2.57. No mapfile, no ${v^^},
# no associative arrays.
#
# Fact record format, one key per line, on stdin:
#   pttype=<gpt|dos|>
#   volumelabel=<label>                       (repeatable)
#   part=<name>|<fstype>|<label>|<partlabel>  (repeatable)
#   esp=<part>|<hascreds01>|<factor|->|<hasefi01>
#   err=<message>                             (repeatable)
ZETA_INSTALLER_VOLUME_LABEL="ZETA_INSTALL"
ZETA_ESP_LABEL="boot"
ZETA_ROOT_LABEL="nixos"

# $1=fstype $2=label $3=partlabel  -> exit 0 when the partition is one we stamped.
zeta_pf_is_zeta_owned() {
  local fstype="$1" label="$2" partlabel="$3"
  [ "$label" = "$ZETA_ROOT_LABEL" ] && return 0
  case "$label" in
    longhorn[0-9]|longhorn[0-9][0-9]) return 0 ;;
  esac
  if [ "$label" = "$ZETA_ESP_LABEL" ]; then
    [ "$fstype" = "vfat" ] && return 0
  fi
  case "$partlabel" in
    ESP|root|longhorn1) return 0 ;;
  esac
  return 1
}

# Reads a fact record on stdin. Prints exactly one line: the disposition.
# Failure CLOSED: a probe error or an unaccountable layout never reads blank.
zeta_pf_classify() {
  local line key val
  local pttype="" nparts=0 nlabels=0 nerrs=0
  local zeta_root=0 zeta_esp=0 nzeta=0 nforeign=0
  local esp_creds=0 esp_efi=0 is_installer=0
  while IFS= read -r line; do
    [ -z "$line" ] && continue
    key="${line%%=*}"
    val="${line#*=}"
    case "$key" in
      pttype) pttype="$val" ;;
      err) nerrs=$((nerrs + 1)) ;;
      volumelabel)
        nlabels=$((nlabels + 1))
        [ "$val" = "$ZETA_INSTALLER_VOLUME_LABEL" ] && is_installer=1
        ;;
      esp)
        local e_hascreds e_hasefi rest
        rest="${val#*|}"
        e_hascreds="${rest%%|*}"
        e_hasefi="${val##*|}"
        [ "$e_hascreds" = "1" ] && esp_creds=1
        [ "$e_hasefi" = "1" ] && esp_efi=1
        ;;
      part)
        nparts=$((nparts + 1))
        local p_name p_fstype p_label p_partlabel r1 r2
        p_name="${val%%|*}"
        r1="${val#*|}"
        p_fstype="${r1%%|*}"
        r2="${r1#*|}"
        p_label="${r2%%|*}"
        p_partlabel="${r2#*|}"
        if zeta_pf_is_zeta_owned "$p_fstype" "$p_label" "$p_partlabel"; then
          nzeta=$((nzeta + 1))
          [ "$p_label" = "$ZETA_ROOT_LABEL" ] && zeta_root=1
          [ "$p_label" = "$ZETA_ESP_LABEL" ] && zeta_esp=1
        else
          if [ -n "$p_fstype" ] || [ -n "$p_label" ]; then
            nforeign=$((nforeign + 1))
          fi
        fi
        ;;
    esac
  done

  if [ "$is_installer" = "1" ]; then echo "installer-medium"; return 0; fi

  local looks_zeta=0
  [ "$esp_creds" = "1" ] && looks_zeta=1
  [ "$esp_efi" = "1" ] && looks_zeta=1
  [ "$zeta_root" = "1" ] && looks_zeta=1
  if [ "$zeta_esp" = "1" ] && [ "$nzeta" -ge 2 ]; then looks_zeta=1; fi

  if [ "$looks_zeta" = "1" ]; then echo "prior-zeta-install"; return 0; fi
  if [ "$nforeign" -gt 0 ]; then echo "foreign-data"; return 0; fi
  if [ "$nerrs" -gt 0 ]; then echo "indeterminate"; return 0; fi
  if [ -z "$pttype" ] && [ "$nparts" -eq 0 ] && [ "$nlabels" -eq 0 ]; then
    echo "blank"; return 0
  fi
  echo "indeterminate"
}


# Validate the attempt ledger read on stdin.
# Text format, one record per line: attempt|startedAt|outcome|stage
# Prints "trusted <consecutiveFailures>" or "untrusted <reason>".
# UNTRUSTED is NOT the same as empty. A corrupt counter that reads as zero is
# exactly the infinite destructive loop R9 was filed for.
#
# The `attempt` field is a contiguous RECORD ORDINAL, not an install counter.
# A completed install occupies TWO records -- `started` before the wipe and
# `ok` after the last step -- and an `ok` resets the consecutive-failure count.
# That is what makes the bound count real FAILURES instead of counting
# installs. See zeta_ledger_append for the write side.
#
# `|| [ -n "$line" ]` is load-bearing, not a style tic. The installer reads this
# ledger through `$(sudo cat ...)`, and command substitution strips trailing
# newlines, so the final record arrives WITHOUT one. A plain `while read` sets
# $line and then returns non-zero on such a line, silently dropping it.
# Measured on main before this change: a ledger whose last line was garbage
# validated as `trusted 1` on the installer's own read path while validating as
# `untrusted` everywhere else -- a fail-OPEN hole in a fail-closed gate, kept
# invisible because the parity test appended a newline the real caller never has.
zeta_pf_validate_ledger() {
  local line stripped npipes expected fails a b c rest
  line=""
  expected=1
  fails=0
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in "") continue ;; esac
    stripped="${line//|/}"
    npipes=$(( ${#line} - ${#stripped} ))
    if [ "$npipes" -ne 3 ]; then echo "untrusted ledger-line-not-4-fields"; return 0; fi
    a="${line%%|*}"
    rest="${line#*|}"
    b="${rest%%|*}"
    rest="${rest#*|}"
    c="${rest%%|*}"
    case "$a" in
      "" ) echo "untrusted ledger-attempt-empty"; return 0 ;;
      *[!0-9]* ) echo "untrusted ledger-attempt-not-integer"; return 0 ;;
    esac
    if [ "$a" -ne "$expected" ]; then echo "untrusted ledger-attempts-not-contiguous"; return 0; fi
    if [ -z "$b" ]; then echo "untrusted ledger-startedat-empty"; return 0; fi
    case "$c" in
      started|failed) fails=$((fails + 1)) ;;
      ok) fails=0 ;;
      *) echo "untrusted ledger-outcome-unknown"; return 0 ;;
    esac
    expected=$((expected + 1))
  done
  echo "trusted $fails"
}

# $1=trusted01 $2=consecutiveFailures $3=maxAttempts $4=ledgerWritable01
# Prints one of: closed | open | blind
zeta_pf_breaker() {
  local trusted="$1" fails="$2" maxa="$3" writable="$4"
  if [ "$trusted" != "1" ]; then echo "open"; return 0; fi
  if [ "$fails" -ge "$maxa" ]; then echo "open"; return 0; fi
  if [ "$writable" != "1" ]; then echo "blind"; return 0; fi
  echo "closed"
}

# $1=breakerState $2=fullSecs $3=blankSecs
# stdin: one line per disk, "<device>|<disposition>"
# stdout: mode=, window=, default=, then wipe=<dev> / refused=<dev> lines.
#
# R6 and R7 are NOT in tension. The greedy default (proceed) is what keeps the
# install headless; the window is what makes it consensual.
zeta_pf_decide_scope() {
  local bstate="$1" full="$2" blank="$3"
  local line dev disp mode window dflt allblank inscope
  local wipes="" refuseds="" databearing="" unreadable=""
  mode="fresh-install"
  allblank=1
  inscope=0
  while IFS= read -r line; do
    case "$line" in "") continue ;; esac
    dev="${line%%|*}"
    disp="${line#*|}"
    if [ "$disp" = "installer-medium" ]; then
      refuseds="$refuseds $dev"
      continue
    fi
    inscope=$((inscope + 1))
    wipes="$wipes $dev"
    [ "$disp" != "blank" ] && allblank=0
    [ "$disp" = "prior-zeta-install" ] && mode="repair"
    [ "$disp" = "foreign-data" ] && databearing="$databearing $dev"
    [ "$disp" = "indeterminate" ] && unreadable="$unreadable $dev"
  done
  [ "$inscope" -eq 0 ] && allblank=0
  if [ "$allblank" -eq 1 ]; then window="$blank"; else window="$full"; fi
  dflt="proceed"
  # 081M0WS33AK087G0R000BG9R8X: the greedy default is scoped to a FRESH box.
  # A window whose default is PROCEED is consent only where somebody is present
  # to withhold it, and this runs on the path defined by nobody being at the
  # keyboard. foreign-data and indeterminate flip it; blank and
  # prior-zeta-install do not, so the zero-typing install and the re-pave are
  # byte-for-byte unchanged. Additive with the breaker: proceed -> abort only.
  # Full reasoning: src/Core.TypeScript/installer/disk-preflight.ts decideWipeScope.
  if [ -n "$databearing" ] || [ -n "$unreadable" ]; then
    dflt="abort"
    window="$full"
  fi
  if [ "$bstate" = "open" ]; then
    dflt="abort"
    window="$full"
  elif [ "$bstate" = "blind" ]; then
    window="$full"
  fi
  echo "mode=$mode"
  echo "window=$window"
  echo "default=$dflt"
  for dev in $wipes; do echo "wipe=$dev"; done
  for dev in $refuseds; do echo "refused=$dev"; done
  for dev in $databearing; do echo "databearing=$dev"; done
  for dev in $unreadable; do echo "unreadable=$dev"; done
}

# ── Force-reformat override (R4-reformat, 2026-08-23) ─────────────
#
# Aaron 2026-08-22: "we could allow for an override to completely reformat and
# ignore the installed version as an override."
#
# THIS IS THE MOST DESTRUCTIVE ACTION THE INSTALLER CAN TAKE, so it is the
# MOST bounded, not the exception. It routes THROUGH `zeta_pf_breaker` with a
# STRICTER bound (`ZETA_MAX_REFORMAT_ATTEMPTS`, default 1) rather than around
# it. There is deliberately no branch anywhere that reaches the wipe with the
# breaker unread: a `blind` breaker (attempts cannot be counted) and an `open`
# one (the bound is already spent) both REFUSE the override outright, where the
# ordinary repair path merely widens the cancel window. A destructive attempt
# that cannot be COUNTED is exactly the R9 loop, and a reformat is the worst
# instance of it.
#
# THREE INDEPENDENT FACTORS, none of them inferrable:
#
#   1. `ZETA_FORCE_REFORMAT` must equal the exact literal `REFORMAT`. Not `1`,
#      not `yes`, not `true` — a truthy-looking value left in an environment
#      does nothing.
#   2. `ZETA_FORCE_REFORMAT_NODE_ID` must NAME the node actually found on the
#      disk THIS RUN (or the literal `unreadable` when, and only when, nothing
#      readable was recovered). This is what a stale env var cannot satisfy: it
#      names a DIFFERENT machine, and it also makes the override SELF-DISARMING
#      — once the reformat succeeds the node has a new id, so the same
#      environment on the next boot no longer matches and refuses.
#   3. Interactively, the operator types `REFORMAT` at a prompt of its own,
#      before the existing `WIPE` one. On the declared zero-typing path
#      (`ZETA_AUTO_CONFIRM=WIPE`) there is by construction nobody to type, so
#      factor 2 carries the per-machine attestation there. Note the mode is
#      taken from ZETA_AUTO_CONFIRM and NOT from `[ -t 0 ]`: the headless
#      first-boot path DOES have a tty (the cancel window reads keypresses on
#      it), so a tty test would have silently demanded typing from a path
#      whose whole premise is that nobody is at the keyboard.
#
# WHAT IT DOES NOT CHANGE: consent. Recovery still happens read-only under
# `-o ro,noload` BEFORE any of this is evaluated — indeed the override CANNOT
# arm without it, because factor 2 needs the recovered id. The override decides
# what happens AFTER consent (mint a fresh identity instead of reusing the
# recovered one), never when consent may be assumed. It never shortens the
# cancel window and never flips a `default=abort` back to `proceed`.
#
# $1=flagToken $2=declaredNodeId $3=recoveredNodeId $4=reformatBreakerState
# $5=typedConfirmation, or the literal `non-interactive` on the zero-typing path.
# Prints exactly one line: `armed`, or `refused <reason>`. Never blank.
zeta_pf_decide_force_reformat() {
  local flag="$1" declared="$2" recovered="$3" bstate="$4" typed="$5"
  if [ "$flag" != "REFORMAT" ]; then echo "refused flag-absent-or-not-exact"; return 0; fi
  case "$bstate" in
    open) echo "refused breaker-open"; return 0 ;;
    blind) echo "refused breaker-blind"; return 0 ;;
    closed) ;;
    *) echo "refused breaker-state-unknown"; return 0 ;;
  esac
  if [ -z "$declared" ]; then echo "refused node-id-not-declared"; return 0; fi
  if [ -n "$recovered" ]; then
    if [ "$declared" != "$recovered" ]; then echo "refused node-id-mismatch"; return 0; fi
  else
    if [ "$declared" != "unreadable" ]; then echo "refused node-id-declared-but-none-recovered"; return 0; fi
  fi
  if [ "$typed" != "non-interactive" ] && [ "$typed" != "REFORMAT" ]; then echo "refused confirmation-not-typed"; return 0; fi
  echo "armed"
}
# ZETA-PREFLIGHT-PARITY-END --------------------------------------

# ZETA-NODE-ZETAID-BEGIN -----------------------------------------
# Mint a node ZetaId at install time — the stable 128-bit key this installer
# did not have.
#
# Aaron 2026-08-22, on the MEASURED GAP recorded at Step 2.7 ("nothing in the
# tree writes a ZetaId at install time"): *"yes we should move this to a
# zetaid."*
#
# WHY Category.InventoryAsset (10) AND NOT A NEW CATEGORY. A cluster node is a
# physical machine, and physical machines already have a category and a
# minting convention: `inventory/items/*.md` is described by
# inventory/reconcile-surfaces.ts as the *register* — "identity of record;
# ZetaId-keyed, git-as-database" — and `inventory/new-item.ts` mints exactly
# `packGeneric(1, Category.InventoryAsset, (ms << 78) | random78)`. This block
# reproduces THAT id scheme byte-for-byte rather than inventing a parallel one.
# There is no node/traveler category slot today; adding one is a four-oracle
# byte-lock change (TS + C# + F# + Rust all pack Category), and the smallest
# honest addition is to reuse the register a node is already IN. The sizing of
# a dedicated slot is filed, not silently skipped:
# workitems/081M0QB3HP2087G0R0029W97ZZ-*.md.
#
# BIT LAYOUT (src/Core.TypeScript/zeta-id/zeta-id.gen.ts BIT_MASKS + zeta-id.ts
# packGeneric), MSB first, so the string below can be read against the source:
#
#   bits 127..123  version  = 1                    -> 00001
#   bits 122..69   payload >> 65   (54 bits)
#   bits  68..65   category = 10                   -> 1010
#   bits  64..0    payload & (2^65-1)  (65 bits)
#
# and payload itself is 119 bits: ms(41) << 78 | random(78). So the emitted
# 26-char Crockford string sorts chronologically, exactly as `ls workitems/`
# does, for the same reason.
#
# WHY IT IS DONE IN SHELL AT ALL. The installer runs inside the NixOS ISO with
# no bun, no node and no network; a mint that needed the TypeScript generator
# would simply not run. So this is a fifth oracle for one narrow path, and it
# is BYTE-LOCKED against the TypeScript one over fixed vectors by
# installer/node-zetaid.test.ts. bash-3.2 subset (no bignum, no arrays here),
# same reason as the preflight parity block: the test must run on the
# maintainer's macOS bash too.
#
# DST SEAM: the pure function takes (ms, randomHex) as ARGUMENTS. The clock and
# /dev/urandom enter only in the `zeta_mint_node_zetaid` wrapper below — the
# same boundary discipline as new-workitem.ts's `WorkItemEnv`, and what lets
# the parity test pin exact vectors instead of asserting a shape.

# $1 = unsigned decimal, $2 = width in bits. Prints $2 binary digits, MSB first.
zeta_zid_uint_to_bin() {
  local v="$1" w="$2" out="" i=0
  while [ "$i" -lt "$w" ]; do
    out="$(( v & 1 ))$out"
    v=$(( v >> 1 ))
    i=$(( i + 1 ))
  done
  printf %s "$out"
}

# $1 = hex string. Prints 4 binary digits per hex char. Non-hex fails CLOSED
# (empty output, non-zero status) rather than emitting a wrong id.
zeta_zid_hex_to_bin() {
  local hex="$1" out="" i=0 c
  while [ "$i" -lt "${#hex}" ]; do
    c="${hex:$i:1}"
    case "$c" in
      0) out="${out}0000" ;; 1) out="${out}0001" ;; 2) out="${out}0010" ;; 3) out="${out}0011" ;;
      4) out="${out}0100" ;; 5) out="${out}0101" ;; 6) out="${out}0110" ;; 7) out="${out}0111" ;;
      8) out="${out}1000" ;; 9) out="${out}1001" ;;
      a|A) out="${out}1010" ;; b|B) out="${out}1011" ;; c|C) out="${out}1100" ;;
      d|D) out="${out}1101" ;; e|E) out="${out}1110" ;; f|F) out="${out}1111" ;;
      *) printf %s ""; return 1 ;;
    esac
    i=$(( i + 1 ))
  done
  printf %s "$out"
}

# $1 = exactly 128 binary digits. Prints the canonical 26-char Crockford
# base32 form, big-endian, with the two leading pad bits zero.
zeta_zid_bin_to_crockford() {
  local bits="$1" alpha="0123456789ABCDEFGHJKMNPQRSTVWXYZ" padded out="" i=0 j chunk v
  if [ "${#bits}" -ne 128 ]; then printf %s ""; return 1; fi
  padded="00$bits"
  while [ "$i" -lt 130 ]; do
    chunk="${padded:$i:5}"
    v=0
    j=0
    while [ "$j" -lt 5 ]; do
      v=$(( v * 2 + ${chunk:$j:1} ))
      j=$(( j + 1 ))
    done
    out="${out}${alpha:$v:1}"
    i=$(( i + 5 ))
  done
  printf %s "$out"
}

# $1 = milliseconds since the Unix epoch (decimal)
# $2 = at least 20 hex characters of randomness (80 bits; the low 78 are used)
# Prints the 26-char node ZetaId. FAILS CLOSED — empty output, non-zero status
# — on anything it cannot encode exactly.
#
# The 2^41 ms ceiling is not decoration: packGeneric caps the payload at 119
# bits and THROWS above it, so an ms that needed 42 bits would be a TypeScript
# exception and a silent wrap to 1970 here. Refusing keeps the two oracles
# honest at the same boundary. (2199023255552 ms = 2039-09-07.)
zeta_node_zetaid_from_parts() {
  local ms="$1" randhex="$2" msbin randbin payload high54 low65 bits
  case "$ms" in ""|*[!0-9]*) printf %s ""; return 1 ;; esac
  if [ "$ms" -ge 2199023255552 ]; then printf %s ""; return 1; fi
  if [ "${#randhex}" -lt 20 ]; then printf %s ""; return 1; fi
  randhex="${randhex:0:20}"
  msbin="$(zeta_zid_uint_to_bin "$ms" 41)"
  randbin="$(zeta_zid_hex_to_bin "$randhex")" || { printf %s ""; return 1; }
  randbin="${randbin:2:78}"
  payload="${msbin}${randbin}"
  high54="${payload:0:54}"
  low65="${payload:54:65}"
  bits="00001${high54}1010${low65}"
  zeta_zid_bin_to_crockford "$bits"
}

# The impure wrapper: the ONLY place the clock and the entropy source enter.
# $ZETA_ZETAID_MS / $ZETA_ZETAID_RANDHEX are the injection points a test uses;
# unset, they read the real ones.
zeta_mint_node_zetaid() {
  local ms randhex
  ms="${ZETA_ZETAID_MS:-}"
  if [ -z "$ms" ]; then
    ms="$(date +%s%3N 2>/dev/null || true)"
    case "$ms" in ""|*[!0-9]*) ms="$(( $(date +%s) * 1000 ))" ;; esac
  fi
  randhex="${ZETA_ZETAID_RANDHEX:-}"
  if [ -z "$randhex" ]; then
    # `od -An -tx1`, NOT `xxd -p`. The hostname generator a few hundred lines
    # below uses xxd, which is fine there because it runs inside the NixOS ISO
    # where xxd exists. This function also runs under `bun test` on a CI runner,
    # and Ubuntu 24.04 split xxd out of vim-common into its own package -- so a
    # runner without it would have made the mint silently produce an EMPTY id.
    # od is coreutils and is everywhere both of those are.
    randhex="$(head -c 10 /dev/urandom | od -An -tx1 | tr -d " \n")"
  fi
  zeta_node_zetaid_from_parts "$ms" "$randhex"
}
# Shape check for a recovered node ZetaId. 26 canonical Crockford base32 chars,
# and the first must be 0..7 because the top two bits of the 130 emitted bits
# are pad and MUST be zero (encoding.ts `parse` rejects the same values).
#
# CANONICAL CASE ONLY, deliberately: Crockford's LENIENT decode (I/L->1, O->0,
# lowercase) exists for humans re-typing an id off a label. Accepting it HERE
# would mean two different byte strings both "validate" as the same node, and
# the file is written by this installer, never typed. A lenient-shaped id in
# /etc/zeta/node-zetaid is evidence something else wrote it, which is exactly
# what we want to fail on rather than normalise away.
zeta_pf_validate_node_zetaid() {
  printf %s "$1" | grep -Eq '^[0-7][0-9ABCDEFGHJKMNPQRSTVWXYZ]{25}$'
}
# ZETA-NODE-ZETAID-END -------------------------------------------

# ZETA-HWCONFIG-CAPTURE-BEGIN ------------------------------------
# Pure decision functions for Step 6's hardware-configuration.nix capture.
#
# NOTHING IN THIS BLOCK TOUCHES A DEVICE, AND NOTHING IN IT WRITES.
# It reads paths and prints a verdict on stdout, so it can be extracted by
# src/Core.TypeScript/installer/hardware-config-capture.test.ts and executed
# under bash against tmpdir fixtures. Same bash-3.2 subset, same reason, as
# the ZETA-PREFLIGHT-PARITY block above.
#
# WHY THIS EXISTS AT ALL
# ----------------------
# The capture used to be:
#
#     if [ -f "$HW_SRC" ] && [ -e "$HW_DST" ]; then cp ...
#     else echo "WARN: hardware-configuration not copied" >&2; fi
#
# A FAILED capture printed one stderr line and the install continued, baking
# the committed placeholder -- which declares only / and /boot. The
# longhorn{1..N} partitions this script had just created, formatted and
# mounted therefore got no `fileSystems` entry and never mounted again on the
# installed node.
#
# That compounds with the boot-time Longhorn preflight added in PR #13252:
# nixos/modules/longhorn-preflight-checks.nix derives its must-be-mounted set
# from the host's OWN `fileSystems`. A placeholder node declares no Longhorn
# path, so the required set is EMPTY and the mount check passes with nothing
# to check. A silent install-time fallback turned a brand-new guard into a
# check that cannot fail -- a check that did not run looking exactly like a
# check that passed.
#
# So the capture fails CLOSED, and it checks the CONTENT rather than the file
# operation: the destination must declare every Longhorn mountpoint this
# install actually mounted. `cp` returning 0 was never the property we wanted.
#
# NOTE ON THE COMMITTED PLACEHOLDERS: hosts/control-plane and hosts/worker-gpu
# ship a `/`+`/boot` hardware-configuration.nix ON PURPOSE, so `nix flake
# check` can evaluate an unprovisioned host in CI. That committed state is
# CORRECT and is not what these functions object to. The defect was never the
# file's contents in git -- it was the install-time capture failing quietly.

# $1=hw_src $2=host_dir $3=hw_dst
# Prints exactly one verdict line. Failure CLOSED: every path that is not a
# proven-good capture prints REFUSE or SKIP, never blank.
#
#   COPY                      -- probe output exists and the host carries the
#                                file: copy it, then verify the content.
#   REFUSE no-generated-config
#   REFUSE no-host-dir
#   REFUSE host-imports-missing-file
#   SKIP host-declares-own-filesystems
#                             -- the host has no hardware-configuration.nix
#                                AND imports none (the disko-shaped hosts, e.g.
#                                hosts/worker-template). Its filesystems come
#                                from its own declarative config, so there is
#                                nothing for the probe output to replace. This
#                                is the ONE legitimate non-copy, and it is
#                                established by READING the host tree rather
#                                than assumed from a missing file.
zeta_hwcap_plan() {
  local hw_src="$1" host_dir="$2" hw_dst="$3"
  if [ ! -f "$hw_src" ]; then
    echo "REFUSE no-generated-config"
    return 0
  fi
  if [ ! -d "$host_dir" ]; then
    echo "REFUSE no-host-dir"
    return 0
  fi
  if [ -e "$hw_dst" ]; then
    echo "COPY"
    return 0
  fi
  if grep -Rql -- './hardware-configuration.nix' "$host_dir" 2>/dev/null; then
    echo "REFUSE host-imports-missing-file"
    return 0
  fi
  echo "SKIP host-declares-own-filesystems"
}

# $1=nix_file, $2..=mountpoints that MUST appear as fileSystems keys.
# Prints "OK" when every mountpoint is declared, otherwise one
# "MISSING <mountpoint>" line per undeclared path. An unreadable or absent
# file reports every mountpoint missing rather than passing quietly.
zeta_hwcap_verify() {
  local nix_file="$1" mp missing=0
  shift
  for mp in "$@"; do
    if [ -r "$nix_file" ] && grep -Fq "\"$mp\"" "$nix_file"; then
      continue
    fi
    echo "MISSING $mp"
    missing=$((missing + 1))
  done
  [ "$missing" -eq 0 ] && echo "OK"
  return 0
}
# ZETA-HWCONFIG-CAPTURE-END --------------------------------------

# ── Step 2.5: pre-format probe (R6 / R14, 2026-06-09) ─────────────
#
# Aaron 2026-06-09: "check if the partition exists every time before
# formatting; ask the questions BEFORE formatting ... do this now".
#
# Everything here is READ ONLY: blkid, lsblk, dumpe2fs -h, and read-only
# mounts. No wipefs, no sgdisk, no mkfs, no rw mount.
# ZETA-PROBE-BEGIN -----------------------------------------------
# EXTRACTED AND EXECUTED BY A TEST, same contract as the
# ZETA-RECOGNISE-SELF block below: installer/repair-mode-existing-install.test.ts
# runs zeta_pf_gather against a REAL partitioned disk and feeds its output to
# the real zeta_pf_classify, so the chain probe -> classify -> mode=repair is
# checked end to end rather than from either side alone. The lsblk defect fixed
# in zeta_pf_gather on 2026-08-23 lived precisely in the gap between those two
# halves, each of which was individually tested.
ZETA_PROBE_MOUNT="/tmp/zeta-preflight-probe"
ZETA_PROBE_ERRORS=""

# $1=partition -> prints used bytes for ext4, or nothing.
# dumpe2fs -h reads the superblock only; it does not modify the filesystem.
zeta_pf_ext4_used_bytes() {
  local part="$1" hdr bsz bcount bfree
  hdr="$(sudo dumpe2fs -h "$part" 2>/dev/null || true)"
  [ -z "$hdr" ] && return 0
  bsz="$(printf %s "$hdr" | sed -n "s/^Block size: *\([0-9]*\)$/\1/p" | head -1)"
  bcount="$(printf %s "$hdr" | sed -n "s/^Block count: *\([0-9]*\)$/\1/p" | head -1)"
  bfree="$(printf %s "$hdr" | sed -n "s/^Free blocks: *\([0-9]*\)$/\1/p" | head -1)"
  [ -z "$bsz" ] && return 0
  [ -z "$bcount" ] && return 0
  [ -z "$bfree" ] && return 0
  echo $(( (bcount - bfree) * bsz ))
}

# $1=partition. Read-only mount, look for the Zeta ESP payload, unmount.
# Prints "<hascreds01>|<factor>|<hasefi01>" or nothing when not mountable.
# NEVER reads the CONTENT of zeta-creds.enc. Presence and the recorded factor
# NAME only. The factor name lives in zeta-creds.factor and is not a secret.
zeta_pf_probe_esp() {
  local part="$1" hascreds hasefi factor
  sudo mkdir -p "$ZETA_PROBE_MOUNT" 2>/dev/null || return 1
  sudo mount -t vfat -o ro "$part" "$ZETA_PROBE_MOUNT" 2>/dev/null || return 1
  hascreds=0; hasefi=0; factor="-"
  if sudo test -f "$ZETA_PROBE_MOUNT/zeta-creds.enc"; then hascreds=1; fi
  if sudo test -d "$ZETA_PROBE_MOUNT/EFI/ZETA"; then hasefi=1; fi
  if sudo test -f "$ZETA_PROBE_MOUNT/zeta-creds.factor"; then
    factor="$(sudo head -c 32 "$ZETA_PROBE_MOUNT/zeta-creds.factor" 2>/dev/null | tr -cd "A-Za-z" || true)"
    [ -z "$factor" ] && factor="-"
  fi
  sudo umount "$ZETA_PROBE_MOUNT" 2>/dev/null || true
  echo "$hascreds|$factor|$hasefi"
  return 0
}

# $1=disk. Prints the fact record zeta_pf_classify consumes, and a parallel
# human readable evidence block on fd 4 when one is open.
zeta_pf_gather() {
  local disk="$1" pttype dlabel parts p ptype plabel ppartlabel psize pused espres
  pttype="$(sudo blkid -p -o value -s PTTYPE "$disk" 2>/dev/null || true)"
  echo "pttype=$pttype"
  dlabel="$(sudo blkid -o value -s LABEL "$disk" 2>/dev/null || true)"
  if [ -n "$dlabel" ]; then echo "volumelabel=$dlabel"; fi
  # `-l` (LIST, not tree) IS LOAD-BEARING. Without it lsblk renders NAME as a
  # tree and glues UTF-8 box-drawing glyphs onto the path with NO separating
  # whitespace, so awk's $1 is the 15-byte string "\u251c\u2500/dev/vda1", not
  # "/dev/vda1". Measured 2026-08-23 against a real GPT disk:
  #
  #   $ lsblk -p -n -o NAME,TYPE /dev/vda | cat -A
  #   /dev/vda    disk$
  #   M-bM-^TM-^\M-bM-^TM-^@/dev/vda1 part$
  #
  # Every blkid on that mangled name then returned EMPTY, so this probe emitted
  # `part=<glyph+path>|||` for every partition and never a `volumelabel=` or an
  # `esp=` record. zeta_pf_classify saw parts with no fstype and no label,
  # counted them as neither Zeta-owned nor foreign, and returned INDETERMINATE
  # for a disk carrying a full prior Zeta install. Consequence, in order: mode
  # never became `repair`, so Step 2.7 never ran, so a re-paved node drew a new
  # random hostname while keeping its NIC -- HWR-2, two roster registrations on
  # one MAC, which is the exact failure the R4 block was written to prevent.
  #
  # Found by installer/repair-mode-existing-install.test.ts on its first real
  # run against a loop device. Nothing that existed before it could have found
  # this: the parity tests feed fact records to the classifier directly, so
  # they proved the classifier right about facts the prober could never gather.
  parts="$(lsblk -p -n -l -o NAME,TYPE "$disk" 2>/dev/null | awk "\$2==\"part\" {print \$1}" || true)"
  for p in $parts; do
    ptype="$(sudo blkid -o value -s TYPE "$p" 2>/dev/null || true)"
    plabel="$(sudo blkid -o value -s LABEL "$p" 2>/dev/null || true)"
    ppartlabel="$(sudo blkid -o value -s PARTLABEL "$p" 2>/dev/null || true)"
    echo "part=$p|$ptype|$plabel|$ppartlabel"
    if [ -n "$plabel" ]; then echo "volumelabel=$plabel"; fi
    if [ "$ptype" = "vfat" ]; then
      espres="$(zeta_pf_probe_esp "$p" || true)"
      if [ -n "$espres" ]; then
        echo "esp=$p|$espres"
      else
        echo "err=esp-probe-failed:$p"
      fi
    fi
  done
  # Explicit success: under set -e a function returning the status of its last
  # loop iteration can abort the install for no reason. The caller guards this
  # with || but that guard would OVERWRITE good facts with an error record.
  return 0
}

# ZETA-PROBE-END -------------------------------------------------

# $1=disk $2=factfile. Prints the operator facing findings for one disk.
# The disposition is decided by zeta_pf_classify; this only renders evidence.
zeta_pf_print_findings() {
  local disk="$1" factfile="$2" disp line key val used
  disp="$(zeta_pf_classify < "$factfile")"
  echo "  $disk: $disp   ($(lsblk -d -n -o SIZE "$disk" 2>/dev/null | tr -d " ") $(disk_class "$disk"))"
  while IFS= read -r line; do
    key="${line%%=*}"
    val="${line#*=}"
    case "$key" in
      pttype) [ -n "$val" ] && echo "      partition table: $val" ;;
      volumelabel) echo "      volume label: $val" ;;
      esp) echo "      ESP payload: $val   (partition|creds-blob|binding-factor|EFI-ZETA)" ;;
      err) echo "      PROBE ERROR: $val   (failure-closed: this disk cannot read as blank)" ;;
      part)
        local pn pf pl pp r
        pn="${val%%|*}"; r="${val#*|}"
        pf="${r%%|*}"; r="${r#*|}"
        pl="${r%%|*}"; pp="${r#*|}"
        used=""
        if [ "$pf" = "ext4" ]; then
          local ub
          ub="$(zeta_pf_ext4_used_bytes "$pn" || true)"
          [ -n "$ub" ] && used="  $((ub / 1073741824)) GiB used"
        fi
        if zeta_pf_is_zeta_owned "$pf" "$pl" "$pp"; then
          echo "      $pn: ${pf:-raw} label=${pl:-none} partlabel=${pp:-none}$used   [ZETA-STAMPED]"
        else
          if [ -n "$pf" ] || [ -n "$pl" ]; then
            echo "      $pn: ${pf:-raw} label=${pl:-none}$used   [NOT OURS]"
          fi
        fi
        ;;
    esac
  done < "$factfile"
  return 0
}

ZETA_PF_FACTDIR="$(mktemp -d /tmp/zeta-preflight-XXXXXX)"
ZETA_PF_DISPFILE="$ZETA_PF_FACTDIR/dispositions"
: > "$ZETA_PF_DISPFILE"

echo
echo "── Pre-format probe (R6): what is on these disks RIGHT NOW ──"
for d in "$BOOT_DISK" "${DATA_DISKS[@]+"${DATA_DISKS[@]}"}"; do
  zeta_pf_gather "$d" > "$ZETA_PF_FACTDIR/$(echo "$d" | tr "/" "_")" 2>/dev/null || echo "err=gather-failed" > "$ZETA_PF_FACTDIR/$(echo "$d" | tr "/" "_")"
  zeta_pf_print_findings "$d" "$ZETA_PF_FACTDIR/$(echo "$d" | tr "/" "_")"
  echo "$d|$(zeta_pf_classify < "$ZETA_PF_FACTDIR/$(echo "$d" | tr "/" "_")")" >> "$ZETA_PF_DISPFILE"
done
echo
# ── Step 2.6: circuit breaker (R9, filed P0 2026-06-09) ───────────
#
# Aaron: "reformat-with-broken-remembered -> infinite destructive loop,
# needs a circuit-breaker + validate-before-wipe."
#
# The loop R9 names is a REBOOT loop: install fails, first-boot runs again,
# the disks get wiped again. Breaking it therefore needs a NON-VOLATILE
# counter, and the only non-volatile writable surface that is not about to
# be wiped is the boot USB ESP. When that surface cannot be written the
# breaker is BLIND, and a breaker that cannot count must never read as a
# closed one, so BLIND forces the full cancel window.
ZETA_LEDGER_MOUNT="/tmp/zeta-attempt-ledger"
ZETA_LEDGER_PART=""
ZETA_LEDGER_FILE=""
ZETA_LEDGER_WRITABLE=0
ZETA_MAX_DESTRUCTIVE_ATTEMPTS="${ZETA_MAX_DESTRUCTIVE_ATTEMPTS:-3}"

# Find the boot USB ESP by the pubkey marker zeta-install already looks for at
# Step 6, but WITHOUT consuming it: this runs pre-wipe and only reads/writes
# the attempt ledger. Install-target disks are skipped by construction.
zeta_pf_open_ledger() {
  local dev part skip data
  sudo mkdir -p "$ZETA_LEDGER_MOUNT" 2>/dev/null || return 1
  for dev in /dev/sd? /dev/nvme?n? /dev/vd? /dev/mmcblk?; do
    [ -b "$dev" ] || continue
    [ "$dev" = "$BOOT_DISK" ] && continue
    skip=0
    for data in "${DATA_DISKS[@]+"${DATA_DISKS[@]}"}"; do
      [ "$dev" = "$data" ] && skip=1
    done
    [ "$skip" = 1 ] && continue
    for partsfx in 1 2; do
      case "$dev" in
        /dev/nvme*|/dev/mmcblk*) part="${dev}p${partsfx}" ;;
        *) part="${dev}${partsfx}" ;;
      esac
      [ -b "$part" ] || continue
      sudo mount -t vfat -o rw "$part" "$ZETA_LEDGER_MOUNT" 2>/dev/null || continue
      if sudo test -f "$ZETA_LEDGER_MOUNT/zeta-authorized-keys.pub"; then
        # mount -o rw can succeed on a QEMU USB with readonly=on; the first
        # write then dies EROFS. Claiming WRITABLE from the mount alone is
        # how wifi-ESP / picker / restore USB-boot installs aborted after
        # the R7 countdown (run 32638506247). Probe a real write.
        if sudo sh -c ': > "$1" && rm -f "$1"' _ "$ZETA_LEDGER_MOUNT/.zeta-ledger-write-probe" 2>/dev/null; then
          ZETA_LEDGER_PART="$part"
          ZETA_LEDGER_FILE="$ZETA_LEDGER_MOUNT/zeta-install-attempts.txt"
          ZETA_LEDGER_WRITABLE=1
          return 0
        fi
        echo "[R9-breaker] ESP $part mounted but not writable; breaker stays BLIND"
      fi
      sudo umount "$ZETA_LEDGER_MOUNT" 2>/dev/null || true
    done
  done
  return 1
}

# ZETA-LEDGER-APPEND-BEGIN ---------------------------------------
# Append ONE record to the attempt ledger, numbered contiguously after the
# records already on disk.
#
# BOTH ledger writes go through here -- the `started` record before the first
# destructive call and the `ok` record after the last step -- so the two can
# never disagree about numbering. Until this function existed there was only
# ONE write site and it only ever wrote `started`, which zeta_pf_validate_ledger
# counts as a failure. Nothing wrote `ok`, so the failure count never reset and
# the bound counted INSTALLS rather than failures: measured on main, three
# SUCCESSFUL installs from one stick left `trusted 3` and the fourth boot came
# up with the breaker OPEN. A breaker that counts successes as failures strands
# an operator who is doing nothing wrong.
#
# APPEND ONLY, deliberately. Rewriting the `started` line in place would need a
# read-modify-write on a FAT ESP whose entire job is to survive a node dying
# mid-install. A `started` with no `ok` after it IS the failure signal, so power
# loss needs no record of its own to be counted -- which is what keeps R9
# bounded rather than aspirational.
#
# $ZETA_SUDO exists so this function is reachable from a test with no root, no
# USB and no block device. It is "sudo" everywhere in the installer itself; the
# falsifier in installer/install-ledger-append.test.ts sets it empty.
ZETA_SUDO="${ZETA_SUDO-sudo}"
# $ZETA_LEDGER_SYNC is the SECOND injected seam, and it exists for the same
# reason as the first: `sync` with no argument flushes EVERY filesystem on the
# host, so its duration is set by the host's dirty page cache and by nothing
# this installer -- or a test of it -- did. In the installer that cost is the
# point: the whole reason the record is written is that the node may lose power
# in the next second. In a test it is a wall-clock wait on unrelated global
# state, which is the definition of a nondeterministic test.
#
# MEASURED 2026-08-22 on the fleet host: 40 `sync` calls took 3.78-4.19 s
# (~95 ms each) against 0.146-0.245 s for 40 trivial process spawns (~4 ms) --
# 24x, and the 95 ms is not a constant, it is whatever the machine owes the
# disk at that instant. The R9 falsifier runs six appends per scenario and had
# grown to 100.1% of bun's 5000 ms per-test cap on that term alone.
#
# The DEFAULT IS THE REAL BARRIER and must stay that way; pinned by
# install-ledger-append.test.ts ("the durability barrier defaults to a real
# sync"). A test may substitute a recorder, which is strictly more checking
# than the nothing that used to observe this line.
ZETA_LEDGER_SYNC="${ZETA_LEDGER_SYNC-sync}"
zeta_ledger_append() {
  local outcome="$1" stage="$2" text n
  [ "${ZETA_LEDGER_WRITABLE:-0}" = "1" ] || return 0
  [ -n "${ZETA_LEDGER_FILE:-}" ] || return 0
  text=""
  if $ZETA_SUDO test -f "$ZETA_LEDGER_FILE"; then
    text="$($ZETA_SUDO cat "$ZETA_LEDGER_FILE" 2>/dev/null || true)"
  fi
  # Count records off the FILE, never off a variable captured earlier: a stale
  # snapshot is how two writes in one run collide on the same ordinal and turn
  # the ledger non-contiguous, which the validator then reads as UNTRUSTED.
  n="$(printf %s "$text" | grep -c '|' || true)"
  n=$((n + 1))
  if ! printf '%s|%s|%s|%s\n' "$n" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$outcome" "$stage" \
    | $ZETA_SUDO tee -a "$ZETA_LEDGER_FILE" >/dev/null; then
    # Second belt: even if open_ledger claimed writable, a later EROFS/EACCES
    # must not abort the install under set -e. Drop to BLIND and continue.
    ZETA_LEDGER_WRITABLE=0
    return 0
  fi
  $ZETA_SUDO $ZETA_LEDGER_SYNC 2>/dev/null || true
  ZETA_ATTEMPT_N="$n"
}
# ZETA-LEDGER-APPEND-END -----------------------------------------

zeta_pf_open_ledger || true
ZETA_LEDGER_TEXT=""
if [ "$ZETA_LEDGER_WRITABLE" = "1" ]; then
  if sudo test -f "$ZETA_LEDGER_FILE"; then
    ZETA_LEDGER_TEXT="$(sudo cat "$ZETA_LEDGER_FILE" 2>/dev/null || true)"
  fi
  echo "[R9-breaker] attempt ledger: $ZETA_LEDGER_FILE"
else
  echo "[R9-breaker] attempt ledger surface NOT writable; breaker is BLIND"
fi
ZETA_LEDGER_VERDICT="$(printf %s "$ZETA_LEDGER_TEXT" | zeta_pf_validate_ledger)"
ZETA_LEDGER_TRUSTED=0
ZETA_LEDGER_FAILS=0
case "$ZETA_LEDGER_VERDICT" in
  trusted*) ZETA_LEDGER_TRUSTED=1; ZETA_LEDGER_FAILS="${ZETA_LEDGER_VERDICT##* }" ;;
  *) ZETA_LEDGER_TRUSTED=0; ZETA_LEDGER_FAILS="$ZETA_MAX_DESTRUCTIVE_ATTEMPTS" ;;
esac
ZETA_BREAKER_STATE="$(zeta_pf_breaker "$ZETA_LEDGER_TRUSTED" "$ZETA_LEDGER_FAILS" "$ZETA_MAX_DESTRUCTIVE_ATTEMPTS" "$ZETA_LEDGER_WRITABLE")"
echo "[R9-breaker] verdict=$ZETA_LEDGER_VERDICT state=$ZETA_BREAKER_STATE bound=$ZETA_MAX_DESTRUCTIVE_ATTEMPTS"

# ── Step 2.7: repair mode / recognise-self (R4, 2026-05-25) ───────
#
# Aaron: "the USB basically says, hey, am I already running on this? I am?
# Let me make sure I recover any hardware IDs and stuff and just reinstall
# the image."
#
# Recovery is READ ONLY and uses -o ro,noload on ext4 on purpose: a plain
# -o ro mount still REPLAYS THE JOURNAL, which is a write to a disk we have
# not yet been given consent to touch. noload suppresses that.
#
# THE GAP THIS USED TO RECORD IS CLOSED (2026-08-23, Aaron: "yes we should
# move this to a zetaid"). It read: "nothing in the tree writes a ZetaId at
# install time. /etc/zeta/cluster-node-id is the closest existing stable key,
# so that is what is recovered." Step 6.6 now writes /etc/zeta/node-zetaid
# (Category.InventoryAsset, minted by the ZETA-NODE-ZETAID block above), and
# this step RECOVERS it.
#
# RECOVERS, never re-mints. A repaired node that came back with a new ZetaId
# would have FORGOTTEN ITSELF across the repair -- manifesto §5, memory
# preservation, is the whole reason recognise-self exists. Re-minting is
# correct in exactly one place: a deliberate force-reformat, which is a
# different node by declaration (see Step 2.75).
#
# cluster-node-id is UNCHANGED and still written. The ZetaId is a sibling key,
# not a replacement: injected-hostname.nix reads cluster-node-id at evaluation
# time and the roster is keyed by hostname, so retiring it here would break
# both. Two keys with two jobs -- the hostname is what the network calls this
# machine, the ZetaId is what the substrate calls it.
# ZETA-RECOGNISE-SELF-BEGIN -------------------------------------
# EXTRACTED AND EXECUTED BY A TEST. installer/repair-mode-existing-install.test.ts
# pulls this block out of this file and runs zeta_pf_recover_identity against a
# REAL ext4 filesystem on a loop device that carries a real /etc/zeta tree --
# not a fixture, not a mock of `mount`. That is the whole reason for the
# markers: repair mode is the path a real operator depends on and the one where
# getting it wrong destroys data, and until 2026-08-23 nothing in CI had ever
# mounted an existing install.
#
# So nothing in here may assume a device that only a real node has. It reads
# $BOOT_DISK and $DATA_DISKS, uses lsblk/blkid/mount, and touches nothing else.
ZETA_REPAIR_ROOT_MOUNT="/tmp/zeta-repair-root"
ZETA_REPAIR_HOSTNAME=""
ZETA_REPAIR_MAC=""
ZETA_REPAIR_CIDR=""
ZETA_REPAIR_CPIP=""
ZETA_REPAIR_ZETAID=""
ZETA_REPAIR_FOUND=0

zeta_pf_recover_identity() {
  local disk part plabel f
  for disk in "$BOOT_DISK" "${DATA_DISKS[@]+"${DATA_DISKS[@]}"}"; do
    # `-l` for the same reason as zeta_pf_gather above: the default tree output
    # glues box-drawing glyphs onto the device path, and the resulting name
    # matched no blkid LABEL, so this loop `continue`d over every partition and
    # zeta_pf_recover_identity returned "nothing found" on every real disk it
    # was ever pointed at.
    for part in $(lsblk -p -n -l -o NAME,TYPE "$disk" 2>/dev/null | awk "\$2==\"part\" {print \$1}"); do
      plabel="$(sudo blkid -o value -s LABEL "$part" 2>/dev/null || true)"
      [ "$plabel" = "nixos" ] || continue
      sudo mkdir -p "$ZETA_REPAIR_ROOT_MOUNT" 2>/dev/null || continue
      sudo mount -t ext4 -o ro,noload "$part" "$ZETA_REPAIR_ROOT_MOUNT" 2>/dev/null || continue
      ZETA_REPAIR_FOUND=1
      f="$ZETA_REPAIR_ROOT_MOUNT/etc/zeta"
      [ -f "$f/cluster-node-id" ] && ZETA_REPAIR_HOSTNAME="$(sudo cat "$f/cluster-node-id" 2>/dev/null | tr -d "[:space:]" || true)"
      [ -f "$f/cluster-segment-mac" ] && ZETA_REPAIR_MAC="$(sudo cat "$f/cluster-segment-mac" 2>/dev/null | tr -d "[:space:]" || true)"
      [ -f "$f/cluster-segment-address" ] && ZETA_REPAIR_CIDR="$(sudo cat "$f/cluster-segment-address" 2>/dev/null | tr -d "[:space:]" || true)"
      [ -f "$f/cluster-control-plane-address" ] && ZETA_REPAIR_CPIP="$(sudo cat "$f/cluster-control-plane-address" 2>/dev/null | tr -d "[:space:]" || true)"
      [ -f "$f/node-zetaid" ] && ZETA_REPAIR_ZETAID="$(sudo cat "$f/node-zetaid" 2>/dev/null | tr -d "[:space:]" || true)"
      sudo umount "$ZETA_REPAIR_ROOT_MOUNT" 2>/dev/null || true
      return 0
    done
  done
  return 1
}

# Validate BEFORE trusting. All-three-or-none on the segment trio, matching the
# discipline the installer already applies at Step 6.5.
zeta_pf_validate_identity() {
  local present=0 reasons=""
  if ! printf %s "$ZETA_REPAIR_HOSTNAME" | grep -Eq "^[a-z0-9][a-z0-9-]{0,62}$"; then
    case "$ZETA_REPAIR_HOSTNAME" in "") reasons="$reasons node-id-absent" ;; *) reasons="$reasons node-id-bad-shape" ;; esac
  fi
  [ -n "$ZETA_REPAIR_MAC" ] && present=$((present + 1))
  [ -n "$ZETA_REPAIR_CIDR" ] && present=$((present + 1))
  [ -n "$ZETA_REPAIR_CPIP" ] && present=$((present + 1))
  if [ "$present" -ne 0 ] && [ "$present" -ne 3 ]; then
    reasons="$reasons segment-trio-partial"
  fi
  if [ -n "$ZETA_REPAIR_MAC" ]; then
    printf %s "$ZETA_REPAIR_MAC" | grep -Eq "^[0-9a-f]{2}(:[0-9a-f]{2}){5}$" || reasons="$reasons mac-bad-shape"
  fi
  # An ABSENT node-zetaid is NOT a failure and must never become one: every
  # node installed before 2026-08-23 has no such file, and refusing to repair
  # them would turn adding a key into a fleet-wide outage. Absent means "mint
  # one during this repair" (Step 6.6, logged as minted-on-repair-legacy).
  #
  # A PRESENT-BUT-MALFORMED one IS a failure, and for the same reason the
  # hostname check is: we recognise the node but cannot READ its identity, so
  # proceeding would silently overwrite an identity we failed to parse. That
  # lands in the existing untrusted path, whose default is ABORT.
  if [ -n "$ZETA_REPAIR_ZETAID" ]; then
    zeta_pf_validate_node_zetaid "$ZETA_REPAIR_ZETAID" || reasons="$reasons node-zetaid-bad-shape"
  fi
  if [ -n "$reasons" ]; then echo "untrusted$reasons"; return 0; fi
  echo "trusted"
}

# ZETA-RECOGNISE-SELF-END ---------------------------------------

ZETA_CANCEL_WINDOW_SECS="${ZETA_CANCEL_WINDOW_SECS:-60}"
ZETA_CANCEL_WINDOW_BLANK_SECS="${ZETA_CANCEL_WINDOW_BLANK_SECS:-10}"
ZETA_SCOPE="$(zeta_pf_decide_scope "$ZETA_BREAKER_STATE" "$ZETA_CANCEL_WINDOW_SECS" "$ZETA_CANCEL_WINDOW_BLANK_SECS" < "$ZETA_PF_DISPFILE")"
ZETA_MODE="$(printf %s "$ZETA_SCOPE" | sed -n "s/^mode=//p")"
ZETA_WINDOW="$(printf %s "$ZETA_SCOPE" | sed -n "s/^window=//p")"
ZETA_CANCEL_DEFAULT="$(printf %s "$ZETA_SCOPE" | sed -n "s/^default=//p")"
ZETA_REFUSED="$(printf %s "$ZETA_SCOPE" | sed -n "s/^refused=//p")"
ZETA_DATABEARING="$(printf %s "$ZETA_SCOPE" | sed -n "s/^databearing=//p")"
ZETA_UNREADABLE="$(printf %s "$ZETA_SCOPE" | sed -n "s/^unreadable=//p")"
echo "[R6/R7] mode=$ZETA_MODE window=${ZETA_WINDOW}s default=$ZETA_CANCEL_DEFAULT"
for d in $ZETA_DATABEARING; do
  echo "[R7] $d carries FOREIGN DATA -> the cancel default is ABORT; a keypress is required to destroy it"
done
for d in $ZETA_UNREADABLE; do
  echo "[R7] $d could not be read (indeterminate) -> the cancel default is ABORT; an uncertain enumeration refuses"
done

# Drop refused devices from the wipe scope. A device carrying the ZETA_INSTALL
# volume label is the medium we booted from. Measured 2026-08-21: the ONLY
# thing keeping the boot stick out of scope until now was the TRAN != usb test
# at Step 1, so a Zeta installer stick behind an adapter that presents as nvme
# or virtio was IN SCOPE for wipefs. Reading the label the ISO already stamps
# closes that.
for r in $ZETA_REFUSED; do
  if [ "$r" = "$BOOT_DISK" ]; then
    bail "BOOT_DISK $r carries the ZETA_INSTALL volume label: that is the installer medium, not an install target. Pick a different disk with BOOT_DISK=/dev/..."
  fi
  NEW_DATA=()
  for d in "${DATA_DISKS[@]+"${DATA_DISKS[@]}"}"; do
    [ "$d" = "$r" ] || NEW_DATA+=("$d")
  done
  DATA_DISKS=("${NEW_DATA[@]+"${NEW_DATA[@]}"}")
  echo "[R6] REFUSED $r: carries the ZETA_INSTALL volume label; removed from the wipe scope"
done

if [ "$ZETA_MODE" = "repair" ]; then
  echo
  echo "[R4-repair] a prior Zeta install was recognised on an in-scope disk."
  zeta_pf_recover_identity || true
  ZETA_IDENTITY_VERDICT="$(zeta_pf_validate_identity)"
  echo "[R4-repair]   recovered hostname=${ZETA_REPAIR_HOSTNAME:-<none>} mac=${ZETA_REPAIR_MAC:-<none>} cidr=${ZETA_REPAIR_CIDR:-<none>} cp=${ZETA_REPAIR_CPIP:-<none>} zetaid=${ZETA_REPAIR_ZETAID:-<none>}"
  echo "[R4-repair]   identity verdict: $ZETA_IDENTITY_VERDICT"
  case "$ZETA_IDENTITY_VERDICT" in
    trusted)
      # NOT "HOST=$ZETA_REPAIR_HOSTNAME". HOST names a FLAKE OUTPUT
      # (control-plane / worker-gpu); cluster-node-id names THIS MACHINE
      # (zeta-a1b2c3). Conflating them would send nixos-install at a flake
      # attribute that does not exist.
      ZETA_REPAIR_REUSE=1
      export ZETA_REPAIR_NODE_ID="$ZETA_REPAIR_HOSTNAME"
      echo "[R4-repair]   REUSING identity: this node rejoins as $ZETA_REPAIR_HOSTNAME rather than registering a duplicate"
      ;;
    *)
      # HWR-2 (src/Core.TypeScript/inventory/reconcile-surfaces.ts) is exactly
      # this failure: two registrations sharing one MAC. Re-paving a node we
      # RECOGNISE but whose identity we cannot READ is how that happens, so
      # the wipe stops here instead of proceeding blind.
      ZETA_REPAIR_REUSE=0
      ZETA_CANCEL_DEFAULT="abort"
      ZETA_WINDOW="$ZETA_CANCEL_WINDOW_SECS"
      echo "[R4-repair]   REFUSING to proceed by default: prior install recognised but its remembered identity did not validate ($ZETA_IDENTITY_VERDICT)."
      echo "[R4-repair]   Re-paving now would register a duplicate for a MAC already in the roster (HWR-2)."
      echo "[R4-repair]   The cancel window below now defaults to ABORT; a keypress is required to proceed."
      ;;
  esac

  # ── Step 2.75: the force-reformat override (R4-reformat, 2026-08-23) ──
  #
  # Aaron: "we could allow for an override to completely reformat and ignore
  # the installed version as an override."
  #
  # Everything above has just finished RECOGNISING this node read-only. This
  # is where an operator gets to say: I know what is there, ignore it, treat
  # this as a new machine. The decision itself is
  # zeta_pf_decide_force_reformat in the parity block (pure, testable, byte-
  # locked against installer/force-reformat.ts); this is only its wiring.
  #
  # ROUTED THROUGH THE BREAKER, WITH A TIGHTER BOUND. Note what is NOT here:
  # there is no branch that skips zeta_pf_breaker. The same function is called
  # a second time with ZETA_MAX_REFORMAT_ATTEMPTS (default 1) instead of
  # ZETA_MAX_DESTRUCTIVE_ATTEMPTS (default 3), so the override is refused
  # strictly EARLIER than an ordinary attempt is, never later. `blind` refuses
  # too: the ordinary path treats an uncountable attempt as a reason to widen
  # the window, but a reformat that cannot be counted IS the R9 loop, so it
  # does not get to run at all.
  #
  # The documented escape is the same one R9 already documents, and it is
  # still a bound rather than a bypass: ZETA_MAX_REFORMAT_ATTEMPTS=<n>.
  ZETA_MAX_REFORMAT_ATTEMPTS="${ZETA_MAX_REFORMAT_ATTEMPTS:-1}"
  ZETA_REFORMAT_BREAKER_STATE="$(zeta_pf_breaker "$ZETA_LEDGER_TRUSTED" "$ZETA_LEDGER_FAILS" "$ZETA_MAX_REFORMAT_ATTEMPTS" "$ZETA_LEDGER_WRITABLE")"
  ZETA_FORCE_REFORMAT_TYPED="non-interactive"
  if [ "${ZETA_FORCE_REFORMAT:-}" = "REFORMAT" ] && [ "${ZETA_AUTO_CONFIRM:-}" != "WIPE" ]; then
    echo
    echo "[R4-reformat] !! FORCE REFORMAT REQUESTED. This IGNORES the install recognised above."
    echo "[R4-reformat] !! Everything on the disks listed at the probe is lost, and this node"
    echo "[R4-reformat] !! comes back with a NEW identity (new hostname, new ZetaId). A repair"
    echo "[R4-reformat] !! is what you want if you meant to keep the node."
    read -rp "Type REFORMAT to confirm the wipe-and-forget: " ZETA_FORCE_REFORMAT_TYPED
  fi
  ZETA_FORCE_REFORMAT_VERDICT="$(zeta_pf_decide_force_reformat \
    "${ZETA_FORCE_REFORMAT:-}" \
    "${ZETA_FORCE_REFORMAT_NODE_ID:-}" \
    "$ZETA_REPAIR_HOSTNAME" \
    "$ZETA_REFORMAT_BREAKER_STATE" \
    "$ZETA_FORCE_REFORMAT_TYPED")"
  ZETA_FORCE_REFORMAT_ARMED=0
  case "$ZETA_FORCE_REFORMAT_VERDICT" in
    armed)
      ZETA_FORCE_REFORMAT_ARMED=1
      ZETA_REPAIR_REUSE=0
      # THE POINT OF THE OVERRIDE, in two lines: drop the recovered identity so
      # Step 6.6 mints a fresh hostname AND a fresh ZetaId. Carrying the old
      # identity across a DELIBERATE wipe would be the opposite error to
      # forgetting it across a repair -- a new node wearing a dead node's name.
      unset ZETA_REPAIR_NODE_ID
      ZETA_REPAIR_ZETAID=""
      echo "[R4-reformat] ARMED. reformat-breaker=$ZETA_REFORMAT_BREAKER_STATE bound=$ZETA_MAX_REFORMAT_ATTEMPTS declared-node=${ZETA_FORCE_REFORMAT_NODE_ID:-<none>}"
      echo "[R4-reformat] The recognised install is being IGNORED ON PURPOSE, not failed into:"
      echo "[R4-reformat]   recovered hostname=${ZETA_REPAIR_HOSTNAME:-<none>} zetaid=<discarded> -> a fresh identity is minted at Step 6.6."
      echo "[R4-reformat] This attempt is recorded in the ledger with stage=reformat, so a later"
      echo "[R4-reformat] reader can tell a deliberate wipe from a repair that failed into one."
      ;;
    *)
      # Silence would be wrong here in the one case that matters: an operator
      # who BELIEVES they armed a reformat and did not. So a refusal is loud
      # whenever the flag was present at all, and invisible when it was not.
      if [ -n "${ZETA_FORCE_REFORMAT:-}" ]; then
        echo "[R4-reformat] $ZETA_FORCE_REFORMAT_VERDICT (reformat-breaker=$ZETA_REFORMAT_BREAKER_STATE bound=$ZETA_MAX_REFORMAT_ATTEMPTS)"
        echo "[R4-reformat] The override did NOT arm. This run continues as an ordinary repair."
      fi
      ;;
  esac

  # ── R8 SEAM: preserve -> format -> repersist is NOT wired here ──
  #
  # DECISION REQUIRED, AND IT IS NOT MINE: design doc 2026-08-21 section 5.2,
  # "what is the stable key?" TPM seal (node-bound, survives a stick swap,
  # dies on a machine swap) vs USB iSerial (stick-bound, survives a reformat,
  # dies on a stick swap). Aaron 2026-06-09 asked for creds tied to the USB
  # key AND a hardware key AND the UEFI boot partition; which of those is the
  # KDF binding factor is still open, 74 days.
  #
  # What IS decided, on evidence rather than preference: a blob whose recorded
  # binding factor is usbUuid is provably undecryptable after a reformat,
  # because the KDF binds the ephemeral FAT UUID. Carrying it forward produces
  # a dead file that LOOKS like a recovered credential, which is worse than
  # not carrying it. See credential-binding-model.ts
  # expectedBindingScenarioOutcome(factor, "reformat_same_stick") and
  # disk-preflight.ts credsCarryForwardDecision.
  ZETA_CREDS_FACTOR="$(grep -h "^esp=" "$ZETA_PF_FACTDIR"/* 2>/dev/null | head -1 | awk -F"|" "{print \$3}" || true)"
  ZETA_CREDS_PRESENT="$(grep -h "^esp=" "$ZETA_PF_FACTDIR"/* 2>/dev/null | head -1 | awk -F"|" "{print \$2}" || true)"
  if [ "${ZETA_CREDS_PRESENT:-0}" = "1" ]; then
    case "${ZETA_CREDS_FACTOR:--}" in
      usbUuid|-|"")
        echo "[R8-seam]   zeta-creds.enc found (binding=${ZETA_CREDS_FACTOR:-unrecorded}). NOT carried forward:"
        echo "[R8-seam]   that binding does not survive a reformat, so the blob would be dead on arrival."
        ;;
      *)
        echo "[R8-seam]   zeta-creds.enc found (binding=$ZETA_CREDS_FACTOR). Carry-forward is BLOCKED, not refused:"
        echo "[R8-seam]   the binding survives a reformat, but the DEFAULT binding is undecided (design doc section 5.2)."
        echo "[R8-seam]   Wiring preserve/repersist before that decision would bake in the wrong key."
        ;;
    esac
  fi
fi

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

# ── Step 2.9: the cancel window (R7, 2026-06-09) ──────────────────
#
# Aaron: "it should NOT ask before format; it should ask to CANCEL for a
# minute before format; this USB should fully boot headless."
#
# What was here before this block: NOTHING. There was no sleep between the
# device list and wipefs, and zeta-first-boot.sh exported
# ZETA_AUTO_CONFIRM=WIPE which skipped the typed prompt, so the wipe followed
# the device list immediately. The comment in zeta-first-boot.sh claimed the
# consent WAS that Ctrl-C window. It described a window of zero width.
#
# THE ANSWER TO SECTION 5.5 (does the countdown run on the zero-typing path
# too): YES. It runs on every path, including ZETA_AUTO_CONFIRM=WIPE.
# Reasoning: the zero-typing path is precisely where nobody is watching a
# prompt, which makes it the one place a wrong-disk wipe is both
# unrecoverable and unwitnessed. A gate that is absent there is absent.
#
# THE COST, STATED: up to 60 s per node, once, at install. It is paid against
# an install that then runs for tens of minutes, and nodes flash in parallel
# so it overlaps rather than accumulating. It is NOT free and it is not being
# claimed as free.
#
# THE COST IS ALSO SHAPED: when every in-scope disk probes BLANK the window
# is 10 s, because there is nothing on those disks to consent to losing.
# Foreign data, a prior Zeta install, or a probe that FAILED all get the full
# 60 s. Failure-closed: an unreadable disk is treated as a full disk.
#
# THE ROSTER IS REPRINTED HERE, at the gate, and not left to the Step 1 table.
# The operator watching a countdown must not have to scroll back through a
# preflight probe to learn what is about to be destroyed, and "the disks listed
# above" names nothing on a console that has already scrolled. Every in-scope
# device is named by PATH, SIZE and MODEL at the moment the clock is running.
#
# FAIL CLOSED ON AN UNSIZEABLE DEVICE. A device the kernel will not report a
# size for is a device we cannot account for, so the default flips to ABORT
# rather than being destroyed on a description we could not produce. An empty
# MODEL is NOT that case -- virtio and many NVMe controllers report none, and
# treating a missing marketing string as an unreadable device would refuse
# every QEMU install for no safety gain. Size is the discriminator; model is
# for the human.
echo
echo "  ── ABOUT TO DESTROY EVERY DEVICE IN THIS LIST ──"
for d in "$BOOT_DISK" "${DATA_DISKS[@]+"${DATA_DISKS[@]}"}"; do
  # `|| true` IS LOAD-BEARING, and its absence was a bug in the first draft of
  # this block. `set -euo pipefail` is in force, so a failing lsblk (the device
  # disappeared, the kernel errored) makes the command substitution non-zero and
  # aborts the whole script HERE -- which means the SIZE-UNREADABLE branch below,
  # the entire point of the check, would be unreachable in exactly the case it
  # was written for. Swallow the status, keep the empty string, and let the
  # branch decide. A check that cannot run is worse than one that fails.
  zeta_gate_size="$(lsblk -d -n -o SIZE "$d" 2>/dev/null | tr -d " " || true)"
  zeta_gate_model="$(lsblk -d -n -o MODEL "$d" 2>/dev/null | tr -s " " | sed "s/^ *//;s/ *$//" || true)"
  zeta_gate_tran="$(lsblk -d -n -o TRAN "$d" 2>/dev/null | tr -d " " || true)"
  # Exact device match, not a prefix match: /dev/sda must not read /dev/sdaa.
  zeta_gate_disp="$(awk -F"|" -v dev="$d" "\$1==dev {print \$2}" "$ZETA_PF_DISPFILE" 2>/dev/null | head -1 || true)"
  [ -z "$zeta_gate_model" ] && zeta_gate_model="(no model reported)"
  [ -z "$zeta_gate_tran" ] && zeta_gate_tran="unknown"
  if [ -z "$zeta_gate_size" ]; then
    echo "    $d   SIZE UNREADABLE   transport=$zeta_gate_tran   $zeta_gate_model   [$zeta_gate_disp]"
    echo "      !! the kernel reports no size for this device: it cannot be accounted for"
    ZETA_CANCEL_DEFAULT=abort
    ZETA_WINDOW="$ZETA_CANCEL_WINDOW_SECS"
  else
    echo "    $d   $zeta_gate_size   transport=$zeta_gate_tran   $zeta_gate_model   [$zeta_gate_disp]"
  fi
done
echo
if [ "$ZETA_CANCEL_DEFAULT" = "abort" ]; then
  echo "  !! DESTRUCTIVE STEP GATED. Default is ABORT."
  echo "  !! Press any key within ${ZETA_WINDOW}s to PROCEED with the wipe."
  echo "  !! Do nothing and this install stops and drops to a shell."
else
  echo "  Formatting the devices listed above in ${ZETA_WINDOW}s."
  echo "  Press any key to CANCEL and drop to a shell."
  echo "  Do nothing and the install proceeds (headless default)."
fi
echo
ZETA_CANCEL_KEY=""
ZETA_CANCEL_PRESSED=0
if [ -t 0 ]; then
  # TWO BUGS LIVED HERE, and they compounded into the opposite of the intended
  # behaviour. Both were found by rehearsing the window rather than reading it.
  #
  # 1. `read -n 1` consumes Return as its DELIMITER and yields an EMPTY
  #    variable, while still returning success. The old loop tested
  #    `[ -n "$ZETA_CANCEL_KEY" ]`, so Enter -- the key a worried operator
  #    actually mashes -- did NOT cancel. A successful read IS a keypress; that
  #    is what is tested now.
  # 2. The countdown decremented once per ITERATION, but `read` returns
  #    IMMEDIATELY when a key arrives instead of spending its 1s timeout. So a
  #    burst of keypresses spun the window to zero in milliseconds. Measured:
  #    five Enters into a 5s window gave `cancelled=NO elapsed=0s`.
  #
  # Together: mashing Enter burned the entire window AND failed to cancel --
  # a guard that fails precisely when someone panics. The deadline is now
  # wall-clock, so an early return cannot spend time it did not wait.
  #
  # Local wall-clock is correct here and is not a shared-fold leak: this steers
  # a LOCAL action (a UI timeout) and never enters a shared conclusion.
  # See .claude/rules/local-time-never-enters-the-shared-fold.md.
  ZETA_CANCEL_END=$(( $(date +%s) + ZETA_WINDOW ))
  while :; do
    ZETA_CANCEL_REMAIN=$(( ZETA_CANCEL_END - $(date +%s) ))
    [ "$ZETA_CANCEL_REMAIN" -gt 0 ] || break
    printf "\r  %ss remaining ... " "$ZETA_CANCEL_REMAIN"
    if read -r -n 1 -s -t 1 ZETA_CANCEL_KEY 2>/dev/null; then
      ZETA_CANCEL_PRESSED=1
      break
    fi
  done
  echo
else
  # No controlling terminal. A read with a timeout would return instantly and
  # spin the window down to nothing, which is the zero-width window this block
  # exists to remove. Sleep the full window instead and take the default.
  echo "  (no tty on stdin: sleeping the full ${ZETA_WINDOW}s window; the default applies)"
  sleep "$ZETA_WINDOW"
fi

if [ "$ZETA_CANCEL_DEFAULT" = "abort" ]; then
  if [ "$ZETA_CANCEL_PRESSED" != "1" ]; then
    echo
    echo "[R7/R9] No keypress and the default is ABORT. Not wiping anything."
    echo "        Reason: $ZETA_BREAKER_STATE breaker / repair-identity refusal above."
    echo "        Manual override once the cause is understood:"
    echo "          ZETA_MAX_DESTRUCTIVE_ATTEMPTS=<n> zeta-install $HOST"
    exit 0
  fi
  echo "[R7] Keypress received; proceeding past the gate deliberately."
else
  if [ "$ZETA_CANCEL_PRESSED" = "1" ]; then
    echo
    echo "[R7] CANCELLED by operator keypress. Nothing was wiped."
    echo "     Re-run when ready:  zeta-install $HOST"
    # EXIT 10, not 0. A successful cancel used to exit 0, and the caller
    # (zeta-first-boot.sh) reads 0 as success -- so deliberately stopping the
    # install printed "Install complete. Rebooting in 10s". The operator saw
    # their abort reported as a finished install.
    exit 10
  fi
  echo "[R7] No keypress; proceeding (headless default preserved)."
fi

# Record the destructive attempt BEFORE the first destructive call, so a node
# that dies mid-wipe still counts against the bound on the next boot. This is
# what makes R9 bounded rather than aspirational.
if [ "$ZETA_LEDGER_WRITABLE" = "1" ]; then
  # An untrusted ledger that the operator deliberately walked past (they had to
  # press a key: the default was ABORT) is RESET rather than appended to, so the
  # next boot counts from a ledger that parses instead of staying open forever.
  if [ "$ZETA_LEDGER_TRUSTED" != "1" ]; then
    echo "[R9-breaker] resetting an unparseable ledger at deliberate operator override"
    : | sudo tee "$ZETA_LEDGER_FILE" >/dev/null
    ZETA_LEDGER_TEXT=""
  fi
  # STAGE, not outcome: `reformat` and `wipe` both validate as ordinary records
  # (zeta_pf_validate_ledger reads field 3, the outcome), so this costs the
  # breaker nothing and buys the audit everything -- a later reader of the
  # stick's ledger can tell a DELIBERATE reformat from a repair that failed
  # into one, which is otherwise indistinguishable after the disk is gone.
  if [ "${ZETA_FORCE_REFORMAT_ARMED:-0}" = "1" ]; then
    zeta_ledger_append started reformat
  else
    zeta_ledger_append started wipe
  fi
  echo "[R9-breaker] recorded destructive attempt $ZETA_ATTEMPT_N in the ledger"
  echo "[R9-breaker] this record counts as a FAILURE until the matching 'ok' is written at the end of the run"
else
  echo "[R9-breaker] ledger not writable; this attempt is NOT counted (breaker stays blind next boot)"
fi

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

# The Longhorn mountpoints AS THE INSTALLED SYSTEM WILL SEE THEM (no /mnt
# prefix -- `nixos-generate-config --root /mnt` strips it). Recorded here, at
# the one place that actually mounts them, so Step 6's capture check is
# derived from what this install DID rather than from a restated roster that
# can drift. Never empty: longhorn1 is created on every install.
LONGHORN_MOUNTS=("/var/lib/longhorn-disk1")

i=2
for d in "${DATA_DISKS[@]}"; do
  lhp=$(part_name "$d" 1)
  mp="/mnt/var/lib/longhorn-disk${i}"
  sudo mkdir -p "$mp"
  sudo mount "$lhp" "$mp"
  LONGHORN_MOUNTS+=("${mp#/mnt}")
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
  HWDETECT_TS="$HWDETECT_REPO_ROOT/src/Core.TypeScript/installer/zeta-hardware-detect.ts"
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
#
# FAILS CLOSED since 081M0JK4R26087G0R002SVJ5VW. The verdict + the content
# check are the pure functions in the ZETA-HWCONFIG-CAPTURE block near the top
# of this file; that block carries the full account of what the old
# `else echo WARN >&2` fallback silently installed. Short version: a node
# whose Longhorn partitions are absent from its own `fileSystems` is a node
# whose storage does not exist AND whose boot-time storage preflight has
# nothing to check. Refusing here costs the operator a re-run of an installer
# whose disks are already wiped either way; continuing cost them a node that
# looked healthy and was not.
HW_SRC="/mnt/etc/nixos/hardware-configuration.nix"
HOST_DIR="/mnt/etc/zeta/full-ai-cluster/nixos/hosts/${HOST}"
HW_DST="${HOST_DIR}/hardware-configuration.nix"
HW_PLAN="$(zeta_hwcap_plan "$HW_SRC" "$HOST_DIR" "$HW_DST")"
case "$HW_PLAN" in
  COPY)
    echo "[iter-5.1] installing probe-generated hardware-configuration.nix for ${HOST} ..."
    sudo cp "$HW_SRC" "$HW_DST" \
      || bail "could not copy $HW_SRC to $HW_DST. Without it nixos-install bakes the committed placeholder, which declares only / and /boot: the ${#LONGHORN_MOUNTS[@]} Longhorn partition(s) this installer just formatted would never mount again, and the boot-time zeta-longhorn-preflight would have an EMPTY required set and pass vacuously. Remedy: fix the copy ('sudo cp $HW_SRC $HW_DST'), then re-run this installer."
    HW_MISSING="$(zeta_hwcap_verify "$HW_DST" "${LONGHORN_MOUNTS[@]}")"
    if [ "$HW_MISSING" != "OK" ]; then
      echo "[iter-5.1] $HW_MISSING" >&2
      bail "the hardware configuration captured for ${HOST} does not declare every Longhorn mountpoint this install mounted (missing listed above; expected all of: ${LONGHORN_MOUNTS[*]}). Installing it would produce a node whose Longhorn disks are invisible to it AND whose boot-time zeta-longhorn-preflight has nothing to check. Remedy: confirm the mounts are live ('findmnt /var/lib/longhorn-disk1' under /mnt), re-run 'sudo nixos-generate-config --root /mnt --force', then re-run this installer."
    fi
    echo "[iter-5.1] verified: ${HW_DST} declares all ${#LONGHORN_MOUNTS[@]} Longhorn mountpoint(s): ${LONGHORN_MOUNTS[*]}"
    ;;
  "SKIP host-declares-own-filesystems")
    # A disko-shaped host (hosts/worker-template today). It imports no
    # hardware-configuration.nix, so the probe output has nothing to replace
    # and refusing here would be wrong. What we can NOT establish from here is
    # that its own declarative config names the disks this installer just
    # partitioned -- disko derives those mountpoints programmatically from
    # zeta.disko.extraDisks. So say so loudly rather than say nothing, and
    # name the boot-time check that DOES have the node in front of it.
    echo "[iter-5.1] NOTICE: host '${HOST}' carries no hardware-configuration.nix and imports none;"
    echo "[iter-5.1]   its filesystems come from its OWN declarative (disko) config, not from the"
    echo "[iter-5.1]   probe just run. This installer mounted ${#LONGHORN_MOUNTS[@]} Longhorn path(s):"
    echo "[iter-5.1]     ${LONGHORN_MOUNTS[*]}"
    echo "[iter-5.1]   Nothing here can prove '${HOST}' declares them. The boot-time preflight"
    echo "[iter-5.1]   (zeta-longhorn-preflight) REFUSES on the console if any longhorn-labelled"
    echo "[iter-5.1]   device ends up unmounted. On first boot look for ZETA_LONGHORN_PREFLIGHT_OK;"
    echo "[iter-5.1]   ZETA_LONGHORN_PREFLIGHT_FAILED means this node's storage is not wired up."
    ;;
  "REFUSE no-generated-config")
    bail "nixos-generate-config produced no $HW_SRC, so this install has NO capture of the hardware it just partitioned. Continuing would bake the committed placeholder (/ and /boot only) and leave the ${#LONGHORN_MOUNTS[@]} Longhorn partition(s) unmounted forever. Remedy: run 'sudo nixos-generate-config --root /mnt --force' and read its error, then re-run this installer."
    ;;
  "REFUSE no-host-dir")
    bail "flake host '${HOST}' has no directory at ${HOST_DIR#/mnt} in the cloned repo, so there is nowhere to install the hardware configuration and 'nixos-install --flake ...#${HOST}' has no such attribute. Remedy: pick a host that exists (ls ${HOST_DIR%/*}), or add nixos/hosts/${HOST}/ plus a nixosConfigurations.${HOST} entry to full-ai-cluster/flake.nix, then re-run this installer."
    ;;
  "REFUSE host-imports-missing-file")
    bail "host '${HOST}' imports ./hardware-configuration.nix but no such file exists at ${HW_DST#/mnt}. The flake cannot evaluate. Remedy: commit a hardware-configuration.nix for that host (the /-and-/boot stub in nixos/hosts/control-plane/ is the shape), or drop the import, then re-run this installer."
    ;;
  *)
    bail "internal error: zeta_hwcap_plan returned an unrecognised verdict '${HW_PLAN}'. Refusing rather than guessing -- an unhandled verdict here is exactly the silent-fallback class this check exists to remove."
    ;;
esac

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
# 081KZHJPJCF: remember which partition the boot USB ESP was found on, so iter-5.2 (hostname)
# and iter-5-wifi can RE-mount the same ESP after iter-4.2 unmounts it.
BOOT_ESP_PART=""

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
          BOOT_ESP_PART="$part"
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
    echo "# Edit + sudo nixos-rebuild switch --impure --flake /etc/zeta/full-ai-cluster#<host>"
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

  # ── 081KSNY2Z0008QG0R0008PN7RQ scenario 5: role-provisioning pickup ─────────
  #
  # zflash can bake two role-provisioning files onto the boot USB ESP
  # (src/Core.TypeScript/zflash/firstboot-role.ts):
  #
  #   /zeta-firstboot.conf  ZETA_ROLE / HOST / ZETA_JOIN_SERVER_URL /
  #                         ZETA_JOIN_TOKEN_ESP_PATH. zeta-first-boot.sh sources
  #                         it and exports the join values; this block re-reads
  #                         it so a MANUAL `zeta-install` gets the same
  #                         provisioning.
  #   /zeta-join-token      the k3s node-token a joining node needs.
  #
  # The conf is NOT sourced here. It is parsed with a strict pattern and the
  # value re-checked against the same conservative shape zflash validated
  # before writing. Sourcing would add a second execution surface to buy two
  # scalars, which is not a trade worth making on a script that is about to
  # partition a disk.
  BOOT_USB_FIRSTBOOT_CONF="$(dirname "$PUBKEY_FILE")/zeta-firstboot.conf"
  if [ -z "${ZETA_JOIN_SERVER_URL:-}" ] && sudo test -f "$BOOT_USB_FIRSTBOOT_CONF"; then
    ZETA_JOIN_SERVER_URL=$(sudo sed -n "s/^ZETA_JOIN_SERVER_URL='\([^']*\)'\$/\1/p" \
      "$BOOT_USB_FIRSTBOOT_CONF" | head -1 || true)
  fi
  if [ -n "${ZETA_JOIN_SERVER_URL:-}" ]; then
    if echo "$ZETA_JOIN_SERVER_URL" | grep -Eq '^https://[A-Za-z0-9._:-]+$'; then
      sudo mkdir -p /mnt/etc/zeta
      echo "$ZETA_JOIN_SERVER_URL" | sudo tee /mnt/etc/zeta/cluster-join-server-url >/dev/null
      sudo chmod 0644 /mnt/etc/zeta/cluster-join-server-url
      echo "[081KSNY2Z0008QG0R0008PN7RQ-role]   staged join server $ZETA_JOIN_SERVER_URL → /mnt/etc/zeta/cluster-join-server-url"
    else
      echo "[081KSNY2Z0008QG0R0008PN7RQ-role]   WARN: refusing malformed join server URL '$ZETA_JOIN_SERVER_URL'" >&2
      ZETA_JOIN_SERVER_URL=""
    fi
  fi

  # ── joining-node-address-assignment: static segment addressing pickup ──────
  #
  # Same conf, three more scalars (src/Core.TypeScript/zflash/cluster-address.ts):
  #
  #   ZETA_CLUSTER_NODE_CIDR         this node's address, e.g. 10.88.0.2/24
  #   ZETA_CLUSTER_SEGMENT_MAC       which NIC it belongs to
  #   ZETA_CLUSTER_CONTROL_PLANE_IP  the founder, for the /etc/hosts entry
  #
  # WHY these exist: the cluster segment has no DHCP server and no DNS, so
  # without them a joiner comes up with an RFC-3927 link-local address at best
  # and cannot resolve the name in its own --server URL. mDNS was already tried
  # on this stack and recorded as not working (see nixos/modules/k3s-server.nix).
  #
  # ALL THREE OR NONE. A node given an address but no MAC would configure some
  # arbitrary NIC; a node given a MAC but no control-plane address could speak
  # on the segment and not name what it is joining. Partial addressing fails in
  # ways that read as network faults, so it is refused as a set.
  ZETA_CLUSTER_NODE_CIDR=""
  ZETA_CLUSTER_SEGMENT_MAC=""
  ZETA_CLUSTER_CONTROL_PLANE_IP=""
  if sudo test -f "$BOOT_USB_FIRSTBOOT_CONF"; then
    ZETA_CLUSTER_NODE_CIDR=$(sudo sed -n "s/^ZETA_CLUSTER_NODE_CIDR='\([^']*\)'\$/\1/p" \
      "$BOOT_USB_FIRSTBOOT_CONF" | head -1 || true)
    ZETA_CLUSTER_SEGMENT_MAC=$(sudo sed -n "s/^ZETA_CLUSTER_SEGMENT_MAC='\([^']*\)'\$/\1/p" \
      "$BOOT_USB_FIRSTBOOT_CONF" | head -1 || true)
    ZETA_CLUSTER_CONTROL_PLANE_IP=$(sudo sed -n "s/^ZETA_CLUSTER_CONTROL_PLANE_IP='\([^']*\)'\$/\1/p" \
      "$BOOT_USB_FIRSTBOOT_CONF" | head -1 || true)
  fi
  if [ -n "$ZETA_CLUSTER_NODE_CIDR$ZETA_CLUSTER_SEGMENT_MAC$ZETA_CLUSTER_CONTROL_PLANE_IP" ]; then
    # Shapes re-checked here even though zflash validated them before writing:
    # the values came off a FAT filesystem that anyone with physical possession
    # of the stick can rewrite. Same reasoning as the join-server-url check.
    if ! echo "$ZETA_CLUSTER_NODE_CIDR" | grep -Eq '^[0-9]{1,3}(\.[0-9]{1,3}){3}/[0-9]{1,2}$' \
      || ! echo "$ZETA_CLUSTER_SEGMENT_MAC" | grep -Eq '^[0-9a-f]{2}(:[0-9a-f]{2}){5}$' \
      || ! echo "$ZETA_CLUSTER_CONTROL_PLANE_IP" | grep -Eq '^[0-9]{1,3}(\.[0-9]{1,3}){3}$'; then
      echo "[081KSNY2Z0008QG0R0008PN7RQ-addr]   WARN: refusing incomplete/malformed cluster addressing" >&2
      echo "[081KSNY2Z0008QG0R0008PN7RQ-addr]          cidr='$ZETA_CLUSTER_NODE_CIDR' mac='$ZETA_CLUSTER_SEGMENT_MAC' cp='$ZETA_CLUSTER_CONTROL_PLANE_IP'" >&2
    else
      sudo mkdir -p /mnt/etc/zeta
      echo "$ZETA_CLUSTER_NODE_CIDR" | sudo tee /mnt/etc/zeta/cluster-segment-address >/dev/null
      echo "$ZETA_CLUSTER_SEGMENT_MAC" | sudo tee /mnt/etc/zeta/cluster-segment-mac >/dev/null
      echo "$ZETA_CLUSTER_CONTROL_PLANE_IP" | sudo tee /mnt/etc/zeta/cluster-control-plane-address >/dev/null
      sudo chmod 0644 /mnt/etc/zeta/cluster-segment-address \
        /mnt/etc/zeta/cluster-segment-mac \
        /mnt/etc/zeta/cluster-control-plane-address
      echo "[081KSNY2Z0008QG0R0008PN7RQ-addr]   staged $ZETA_CLUSTER_NODE_CIDR on NIC $ZETA_CLUSTER_SEGMENT_MAC; control-plane at $ZETA_CLUSTER_CONTROL_PLANE_IP"
    fi
  else
    echo "[081KSNY2Z0008QG0R0008PN7RQ-addr]   no cluster addressing on ESP (node keeps DHCP)"
  fi

  # The token's destination is not a choice made here: nixos/modules/k3s-agent.nix
  # sets services.k3s.tokenFile = "/var/lib/rancher/k3s/agent/token". Landing it
  # anywhere else produces a node that boots, runs an agent, and never joins.
  BOOT_USB_JOIN_TOKEN="$(dirname "$PUBKEY_FILE")/zeta-join-token"
  #
  # SHAPE CHECK, not just non-emptiness. The token must carry the cluster CA
  # hash: `K10<64 lowercase hex>::<creds>`. Traced through k3s
  # pkg/clientaccess/token.go on 2026-08-21 — a token WITHOUT that prefix is not
  # rejected by k3s, it is rewritten by parseToken to `K10:::<password>`, the CA
  # bundle is then fetched by getCACerts over a client with
  # InsecureSkipVerify:true, and validateCAHash merely logs a warning. The agent
  # would trust whatever CA answered on the segment and hand it the cluster
  # credential. https:// in the server URL does not help; that first request is
  # the one that ignores TLS.
  #
  # Re-checked here even though zflash's file-backed CLI already refused it:
  # this is the last guard on a different substrate, and the bytes came off a
  # FAT filesystem anyone with physical possession of the stick can rewrite.
  # Every token k3s itself writes (server/token and its node-token symlink, both
  # via handlers.WriteToken -> clientaccess.FormatToken) carries the prefix, so
  # this refuses nothing an operator following the documented path would supply.
  if sudo test -f "$BOOT_USB_JOIN_TOKEN"; then
    if sudo test -s "$BOOT_USB_JOIN_TOKEN" \
      && sudo head -c 4096 "$BOOT_USB_JOIN_TOKEN" | head -1 \
         | grep -Eq '^K10[0-9a-f]{64}::.+$'; then
      sudo install -D -m 0600 "$BOOT_USB_JOIN_TOKEN" /mnt/var/lib/rancher/k3s/agent/token
      echo "[081KSNY2Z0008QG0R0008PN7RQ-role]   installed k3s node-token → /mnt/var/lib/rancher/k3s/agent/token"
      # ...and the SERVER copy, for a joining CONTROL PLANE.
      #
      # The line above is the AGENT path (`k3s-agent.nix` points `tokenFile`
      # there). A joining SERVER needs its own, and it must NOT be
      # /var/lib/rancher/k3s/server/token: that path is managed and written by
      # k3s itself, so pre-seeding it conflates "the credential I present to
      # join" with "the credential I hand out". `/etc/zeta/k3s-join-token` is
      # neither, which is why `nixos/modules/injected-server-join.nix` points
      # `tokenFile` there.
      #
      # WHY BOTH, unconditionally, rather than picking by role: this script
      # does not know which flake host it is installing at this point, and a
      # copy on the unused path costs one 0600 file. Guessing wrong costs a
      # node that boots, runs, and never joins -- the failure mode with no
      # symptom, which is the one this whole change exists to remove.
      sudo install -D -m 0600 "$BOOT_USB_JOIN_TOKEN" /mnt/etc/zeta/k3s-join-token
      echo "[081KSNY2Z0008QG0R0008PN7RQ-role]   installed k3s join token   → /mnt/etc/zeta/k3s-join-token (server-join path)"
    elif sudo test -s "$BOOT_USB_JOIN_TOKEN"; then
      echo "[081KSNY2Z0008QG0R0008PN7RQ-role]   REFUSED: zeta-join-token carries no cluster CA hash" >&2
      echo "[081KSNY2Z0008QG0R0008PN7RQ-role]           (expected K10<64 hex>::<creds> — use the founder's" >&2
      echo "[081KSNY2Z0008QG0R0008PN7RQ-role]            /var/lib/rancher/k3s/server/node-token verbatim). Without" >&2
      echo "[081KSNY2Z0008QG0R0008PN7RQ-role]            the hash k3s accepts any CA served on the segment." >&2
    else
      # An empty token file is worse than an absent one: k3s would start,
      # present an empty credential, and fail the join for a reason that reads
      # nothing like "the flash carried no token".
      echo "[081KSNY2Z0008QG0R0008PN7RQ-role]   WARN: zeta-join-token on ESP is EMPTY; not installing it" >&2
    fi
  else
    echo "[081KSNY2Z0008QG0R0008PN7RQ-role]   no zeta-join-token on boot USB ESP (founding node, or token provisioned elsewhere)"
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
  echo "    sudo nixos-rebuild switch --impure --flake /etc/zeta/full-ai-cluster#$HOST"
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
# 081KZHJPJCF: iter-4.2 unmounted the boot USB ESP after the pubkey/cred-blob copy. Re-mount
# the SAME ESP partition (read-only) so this hostname probe AND the iter-5-wifi probe below can
# read zeta-hostname.txt / zeta-wifi-credentials.json from $PROBE_MOUNT. Without this, both
# probes checked an empty $PROBE_MOUNT and silently no-op'd (only the pubkey, read while iter-4.2
# still had it mounted, was found). No-op if the ESP was never found (BOOT_ESP_PART empty) or is
# already mounted. Unmounted once after the iter-5-wifi probe.
if [ -n "$BOOT_ESP_PART" ] && [ -b "$BOOT_ESP_PART" ]; then
  sudo mount -t vfat -o ro "$BOOT_ESP_PART" "$PROBE_MOUNT" 2>/dev/null || true
fi
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
  # ── R4 / HWR-2: a re-paved node must rejoin as ITSELF ──────────
  #
  # This generator is where HWR-2 comes from. On a re-pave with no
  # zeta-hostname.txt on the ESP, the node draws a NEW random node-<6hex>
  # while keeping its physical NIC, so the roster ends up with two
  # registrations sharing one MAC. Step 2.7 recovered and VALIDATED the
  # previous cluster-node-id read-only before the wipe; prefer it.
  #
  # Only a VALIDATED identity gets here: zeta_pf_validate_identity refuses
  # anything that is not RFC1123-shaped, and an unvalidatable identity has
  # already stopped the install at the cancel window.
  if [ -n "${ZETA_REPAIR_NODE_ID:-}" ]; then
    echo "[R4-repair]  reusing the recovered node id instead of generating a new one: $ZETA_REPAIR_NODE_ID"
    sudo mkdir -p "$(dirname "$HOSTNAME_DST")"
    echo "$ZETA_REPAIR_NODE_ID" | sudo tee "$HOSTNAME_DST" >/dev/null
    sudo chmod 0644 "$HOSTNAME_DST"
    echo "[R4-repair]  wrote $HOSTNAME_DST (no duplicate MAC registration)"
  else
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
fi
echo

# ── Step 6.65: persist the node ZetaId (2026-08-23) ───────────────
#
# Aaron 2026-08-22: "yes we should move this to a zetaid."
#
# THE FILE THE GAP AT STEP 2.7 NAMED. /etc/zeta/node-zetaid is the node's
# stable 128-bit key: a Category.InventoryAsset ZetaId, minted by the
# ZETA-NODE-ZETAID block, byte-identical in scheme to inventory/new-item.ts.
#
# THREE PATHS, and which one ran is printed, because they mean different
# things to whoever reads this log after a data loss:
#
#   recovered              -- a repair. The node keeps the identity it had.
#                             This is manifesto §5 (memory preservation) doing
#                             its job: a node that came back with a new key
#                             would have forgotten itself across a repair.
#   minted-on-repair-legacy -- a repair of a node installed BEFORE this file
#                             existed. There is nothing to recover, so one is
#                             minted now. Stated separately from `minted` so
#                             the log never claims a recovery that did not
#                             happen.
#   minted                 -- a fresh install, or a deliberate force-reformat.
#                             A new node by declaration, so a new key.
#
# WHY IT IS WRITTEN HERE and not with the hostname above: the hostname block
# has three exits of its own (injected / recovered / generated) and threading
# a fourth concern through all of them is how one of them ends up silently not
# writing. One write site, one verdict, one log line.
#
# cluster-node-id is untouched by this step and keeps working exactly as it
# did: injected-hostname.nix reads it at evaluation time, the roster is keyed
# by it, and nothing here changes either.
NODE_ZETAID_DST="/mnt/etc/zeta/node-zetaid"
NODE_ZETAID_SOURCE=""
NODE_ZETAID_VALUE=""
if [ -n "${ZETA_REPAIR_ZETAID:-}" ]; then
  NODE_ZETAID_VALUE="$ZETA_REPAIR_ZETAID"
  NODE_ZETAID_SOURCE="recovered"
else
  NODE_ZETAID_VALUE="$(zeta_mint_node_zetaid || true)"
  if [ "${ZETA_REPAIR_FOUND:-0}" = "1" ] && [ "${ZETA_FORCE_REFORMAT_ARMED:-0}" != "1" ]; then
    NODE_ZETAID_SOURCE="minted-on-repair-legacy"
  else
    NODE_ZETAID_SOURCE="minted"
  fi
fi
echo
echo "[zetaid] ── node identity key ──"
# FAILURE IS LOUD AND NON-FATAL, deliberately. A node with no ZetaId is a node
# that is missing a key it did not have at all until today; a node that failed
# to install because the key could not be minted is a regression against every
# path that worked yesterday. So this warns and continues -- and it VALIDATES
# what it is about to write rather than trusting the mint, because an unchecked
# 26-character string in an identity file is how a malformed id becomes a
# permanent one.
if zeta_pf_validate_node_zetaid "$NODE_ZETAID_VALUE"; then
  sudo mkdir -p "$(dirname "$NODE_ZETAID_DST")"
  echo "$NODE_ZETAID_VALUE" | sudo tee "$NODE_ZETAID_DST" >/dev/null
  sudo chmod 0644 "$NODE_ZETAID_DST"
  echo "[zetaid]   $NODE_ZETAID_SOURCE: $NODE_ZETAID_VALUE"
  echo "[zetaid]   wrote $NODE_ZETAID_DST (Category.InventoryAsset; the register is inventory/items/)"
else
  echo "[zetaid]   WARN: mint produced an invalid ZetaId ('$NODE_ZETAID_VALUE'); NOT writing $NODE_ZETAID_DST"
  echo "[zetaid]          the install continues -- cluster-node-id is unaffected and remains this node's key"
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
  # 081KZHJPJCF: the NetworkManager profile write needs the cloned repo + mise, which only exist
  # after the step-6.95a runtime bootstrap (~line 1593). This step (6.6) runs earlier, so here we
  # only STAGE the creds onto the target ESP (/mnt/boot — persistent on the installed system).
  # The actual NM profile is written by the iter-5.5.1 step AFTER 6.95a (search 'iter-5.5.1').
  # Splitting it this way is what lets the helper (wifi-esp-to-nm.ts) actually run — pre-6.95a
  # there is no bun/mise/repo to run it (the old inline attempt here could only ever fall through,
  # and referencing $ZETA_HOME before it was set was itself a set -u hard-fail).
  sudo mkdir -p /mnt/boot
  sudo cp "$WIFI_CREDS_FILE" /mnt/boot/zeta-wifi-credentials.json
  sudo chmod 0600 /mnt/boot/zeta-wifi-credentials.json
  echo "[iter-5-wifi] staged zeta-wifi-credentials.json on target ESP; NetworkManager profile write deferred to runtime bootstrap (iter-5.5.1)"
else
  echo "[iter-5-wifi] no zeta-wifi-credentials.json on boot USB ESP; skipping wifi injection"
fi
BIND_MARKER_FILE=""
if [ ${#SEARCH_DIRS[@]} -gt 0 ]; then
  BIND_MARKER_FILE=$(sudo find "${SEARCH_DIRS[@]}" \
    -maxdepth 5 -name "zeta-bind-uefi-keyfile" -type f 2>/dev/null | head -1 || true)
fi
if [ -z "$BIND_MARKER_FILE" ] && [ -f "$PROBE_MOUNT/zeta-bind-uefi-keyfile" ]; then
  BIND_MARKER_FILE="$PROBE_MOUNT/zeta-bind-uefi-keyfile"
fi
if [ -n "$BIND_MARKER_FILE" ]; then
  echo "[uefi-keyfile] found zeta-bind-uefi-keyfile on boot USB ESP"
  ZETA_BIND_UEFI_FROM_ESP=1
else
  echo "[uefi-keyfile] no zeta-bind-uefi-keyfile on boot USB ESP"
  ZETA_BIND_UEFI_FROM_ESP=0
fi
# QEMU-only: /zeta-qemu-creds-passphrase lets non-interactive installs run
# 6.95-picker (Step 6.56 skips the typed prompt on non-TTY). Metal still types
# at 6.56. Never echo the file contents. Typed passphrase wins if already set.
QEMU_PP_FILE=""
if [ ${#SEARCH_DIRS[@]} -gt 0 ]; then
  QEMU_PP_FILE=$(sudo find "${SEARCH_DIRS[@]}" \
    -maxdepth 5 -name "zeta-qemu-creds-passphrase" -type f 2>/dev/null | head -1 || true)
fi
if [ -z "$QEMU_PP_FILE" ] && [ -f "$PROBE_MOUNT/zeta-qemu-creds-passphrase" ]; then
  QEMU_PP_FILE="$PROBE_MOUNT/zeta-qemu-creds-passphrase"
fi
if [ -n "$QEMU_PP_FILE" ]; then
  echo "[uefi-keyfile] found zeta-qemu-creds-passphrase on boot USB ESP"
  if [ -z "${ZETA_CREDS_PASSPHRASE_VAL:-}" ]; then
    ZETA_CREDS_PASSPHRASE_VAL="$(sudo cat "$QEMU_PP_FILE" | tr -d '\r' | sed -n '1p' || true)"
    if [ -n "$ZETA_CREDS_PASSPHRASE_VAL" ]; then
      echo "[uefi-keyfile] passphrase captured from boot USB ESP (QEMU; not typed)"
    else
      echo "[uefi-keyfile] zeta-qemu-creds-passphrase empty; staying skip"
    fi
  fi
else
  echo "[uefi-keyfile] no zeta-qemu-creds-passphrase on boot USB ESP"
fi
# 081KZHJPJCF: unmount the boot USB ESP that was RE-mounted for the iter-5.2 hostname +
# iter-5-wifi probes (see the re-mount before iter-5.2). Harmless no-op if it was never
# re-mounted (no pubkey / empty BOOT_ESP_PART).
sudo umount "$PROBE_MOUNT" 2>/dev/null || true
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
        # The fallback address is `<id>+<login>@users.noreply.github.com`, NEVER the legacy
        # plain `<login>@users.noreply.github.com`: GitHub resolves the plain form to
        # whoever owns that username today, so a login that is also a common first name
        # attributes the commit to an unrelated real person. AH005
        # (src/Core.TypeScript/hygiene/audit-coauthor-identity-collides.ts) enforces this.
        #
        # The old `|| echo` fallback was ALSO broken, and it reached main: `gh api` prints
        # its 404 BODY to stdout, `2>/dev/null` hides only stderr, so under `pipefail` the
        # fallback fires while the JSON is already captured — and the two CONCATENATE.
        # Commits bb581641 and 5144b5be carry the result verbatim:
        #   Co-authored-by: ... <{"message":"Not Found",...}Addisons820@users.noreply.github.com>
        # A fallback appended to a failure's output is not a fallback. Capture, then
        # validate the value, instead of branching on an exit status.
        OP_ID=$(gh api /user --jq .id 2>/dev/null || true)
        OP_EMAIL=$(gh api /user/emails --jq '.[] | select(.primary == true) | .email' 2>/dev/null | head -1)
        case "$OP_EMAIL" in
          *@*.*) : ;;                       # a plausible address; use it
          *) OP_EMAIL="" ;;                 # anything else (404 body, empty) is not an address
        esac
        if [ -z "$OP_EMAIL" ]; then
          case "$OP_ID" in
            ''|*[!0-9]*)
              echo "[iter-5.4.1]   ERROR: no primary email and no numeric GitHub id for '$MAINTAINER' — refusing to commit under an ambiguous identity." >&2
              exit 1 ;;
            *) OP_EMAIL="${OP_ID}+${MAINTAINER}@users.noreply.github.com" ;;
          esac
        fi
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
# 081KSNY2Z0008QG0R0008PN7RQ scenario 5: injected-join-server.nix is the same bug
# class — it readFile's /etc/zeta/cluster-join-server-url at EVALUATION time, so
# without this symlink a joiner's serverAddr would silently stay at the
# k3s-agent.nix default and the node would dial the wrong host.
maybe_symlink /mnt/etc/zeta/cluster-join-server-url /etc/zeta/cluster-join-server-url
# Same bug class again, and this one decides whether a control plane FOUNDS or
# JOINS. `injected-server-join.nix` overrides `clusterInit` to false only when
# BOTH the endpoint above and this token are visible at evaluation time; with
# the token invisible it takes the half-provisioned branch and REFUSES, which
# is loud but is not the install anyone wanted. Symlinked so evaluation sees
# what the installed system will see.
maybe_symlink /mnt/etc/zeta/k3s-join-token /etc/zeta/k3s-join-token

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
# affected modules (injected-hostname.nix, injected-join-server.nix,
# injected-cluster-address.nix, operator-authorized-keys.nix) can read the
# symlinked /etc/zeta/* files.
#
# CORRECTION 2026-08-21 — this comment used to say "flake pure-mode REFUSES
# non-store absolute paths", which is the readFile half only and is wrong in
# the direction that hurts. Measured on Determinate Nix 3.21.0 / Nix 2.34.6:
#
#     builtins.readFile   "/etc/hosts"  in pure eval -> error, loud
#     builtins.pathExists "/etc/hosts"  in pure eval -> false, SILENT
#
# Every module above guards its readFile behind a pathExists, so pure eval
# does not refuse — it takes the "no file, keep the default" branch. A pure
# rebuild therefore reverts the node with no error at all: hostname back to
# the flake default, k3s serverAddr back to mkDefault, static segment
# addressing gone, and the operator's captured pubkeys REMOVED from
# authorized_keys. Every nixos-rebuild string this script prints now carries
# --impure, and src/Core.TypeScript/hygiene/lint-nixos-rebuild-needs-impure.ts
# keeps it that way.
#
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
    # NON-FATAL BY DESIGN — but this script runs under `set -euo pipefail` (line 29), so
    # an UNGUARDED failing pipeline trips errexit and ABORTS zeta-install.sh right here,
    # before the rc-capture / WARN / PARTIAL-PROVISION marker below can run. That is
    # exactly what turned this intended-non-fatal step into a first-boot HARD FAIL
    # (`[zeta-first-boot] Install failed`) and reded build-iso from 2026-08-01: #9937
    # removed the old `| tail -10 || echo WARN` whose `||` had been suppressing errexit
    # for this pipeline. Scope errexit OFF around the pipeline only (the same
    # subshell-local pattern used for node-registration above), capture the REAL
    # install.sh rc via PIPESTATUS[0], then restore errexit. `tail -40` (was -10) keeps
    # enough of the mise/toolchain error to diagnose WHY install.sh fails (the separate
    # latent bug 081KZETP6AT08QG0R003MG1VYN).
    # 081KZETP6AT diagnosis instrumentation: the first-boot install.sh failure is INTERMITTENT
    # (fails rc=1 some runs, succeeds others) and the last capture had NO `mise ERROR` line, so the
    # cause is not necessarily mise and can sit ABOVE tail's window. Two additive changes (no
    # success-path behavior change): (1) MISE_VERBOSE=1 so a mise-side failure is fully explained;
    # (2) tee the FULL output to a durable log and, on failure, grep the actual error lines to the
    # console (which reaches the CI serial log) so the rc=1 cause is captured regardless of source
    # or position. Remove the extra grep once the root cause is fixed.
    set +e
    sudo -u "#$ZETA_UID" mkdir -p "$ZETA_HOME/.zeta" 2>/dev/null || true
    install_log="$ZETA_HOME/.zeta/install-sh-firstboot.log"
    # 081KZETP6AT: the first-boot install.sh fails rc=1 INTERMITTENTLY (~1 in 4 dispatch runs) —
    # a transient network/toolchain-fetch blip in mise's toolchain download, not a deterministic
    # bug (the same code succeeds on the other runs). tools/setup/install.sh is idempotent (mise
    # trust/install and bun installs are upserts — discipline #6), so a re-run after a short
    # backoff clears a transient blip without side effects. Retry up to 3 attempts with linear
    # backoff; only the FINAL failure takes the non-fatal WARN + diag + PARTIAL-PROVISION path.
    # This is deliberately scoped to the first-boot path — the shared tools/setup/install.sh (also
    # consumed by CI runners + devcontainers, GOVERNANCE §24) is left untouched.
    install_rc=1
    install_max_attempts=3
    install_attempt=1
    while [ "$install_attempt" -le "$install_max_attempts" ]; do
      { echo "=== 081KZETP6AT install.sh attempt ${install_attempt}/${install_max_attempts} @ $(date -u +%Y-%m-%dT%H:%M:%SZ) ==="
        sudo -u "#$ZETA_UID" \
          HOME="$ZETA_HOME" \
          BUN_INSTALL="$ZETA_HOME/.bun" \
          PATH="$ZETA_TARGET_PATH" \
          ZETA_INSTALL_NIXOS_MODE=installed \
          ZETA_INSTALL_FULL=1 \
          MISE_VERBOSE=1 \
          bash -c "cd $ZETA_HOME/Zeta && ZETA_HOST_TIER=full tools/setup/install.sh" 2>&1
      } | sudo -u "#$ZETA_UID" tee -a "$install_log" | tail -40
      install_rc=${PIPESTATUS[0]}
      [ "$install_rc" -eq 0 ] && break
      if [ "$install_attempt" -lt "$install_max_attempts" ]; then
        install_backoff=$((install_attempt * 12))
        echo "[iter-5.5.0]   install.sh attempt ${install_attempt}/${install_max_attempts} FAILED rc=$install_rc — retrying in ${install_backoff}s (081KZETP6AT transient-blip backoff)"
        sleep "$install_backoff"
      fi
      install_attempt=$((install_attempt + 1))
    done
    set -e
      # Non-fatal is right: a node that boots without agent CLIs is still recoverable, and
      # hard-failing a first-boot install is worse. But "do not fail" and "do not notice"
      # are different instructions — #9937's rc-capture + marker (below) keep the "notice".
      if [ "$install_rc" -ne 0 ]; then
        echo "[iter-5.5.0]   WARN: install.sh FAILED rc=$install_rc after ${install_max_attempts} attempts — runtimes/agent CLIs may be partial; retry post-reboot via 'cd ~/Zeta && ZETA_HOST_TIER=full tools/setup/install.sh'"
        # 081KZETP6AT: surface the actual error lines from the FULL log (verbose output can bury the
        # failure above tail's window). Regardless of whether the cause is mise, bun, nix, or a script.
        echo "[iter-5.5.0]   --- install.sh error lines (081KZETP6AT diag) ---"
        grep -iE 'error|fatal|fail|cannot|not found|no such|denied|refused|traceback|exit code|command not' "$install_log" 2>/dev/null | tail -40 || true
        echo "[iter-5.5.0]   --- end install.sh error lines (full log at ~/.zeta/install-sh-firstboot.log) ---"
        # Durable marker, not just a line that scrolls past on a first-boot console. The
        # full tier carries k3d/kubectl/helm (.mise.full.toml, base tier has none), so
        # without it this node cannot host the ARC runners — and that must be discoverable
        # ON the node, not only in whichever terminal happened to be watching.
        sudo -u "#$ZETA_UID" mkdir -p "$ZETA_HOME/.zeta" 2>/dev/null || true
        printf 'install.sh rc=%s after %s attempts at %s\nPARTIAL PROVISION: agent CLIs and/or the full mise tier (k3d/kubectl/helm) may be absent.\nretry: cd ~/Zeta && ZETA_HOST_TIER=full tools/setup/install.sh\n' \
          "$install_rc" "$install_max_attempts" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
          | sudo -u "#$ZETA_UID" tee "$ZETA_HOME/.zeta/PARTIAL-PROVISION" >/dev/null 2>&1 || true
      elif [ "$install_attempt" -gt 1 ]; then
        echo "[iter-5.5.0]   install.sh succeeded on attempt ${install_attempt}/${install_max_attempts} (081KZETP6AT transient-blip recovered by retry)"
      fi
  fi

  # install.sh owns the manifest-driven agent CLI installs. Keep the
  # ~/.bun directory present/owned so login flows and post-reboot retries
  # have the expected target home layout even if install.sh warned.
  sudo mkdir -p "$ZETA_HOME/.bun/bin"
  sudo chown -R "$ZETA_UID:$ZETA_GID" "$ZETA_HOME/.bun"

  # ── Step 6.95c: iter-5.5.1 wifi NetworkManager profile write (081KZHJPJCF) ──────────────────
  # iter-5.2/6.6 staged /mnt/boot/zeta-wifi-credentials.json but could NOT write the NM profile
  # there (no repo/mise pre-6.95a). Now the runtime bootstrap has run ($ZETA_HOME/Zeta cloned,
  # mise/bun available), so consume the staged creds and write the profile via the helper. This
  # emits the acceptance-contract markers "wrote NetworkManager profile" + "association deferred";
  # the "found zeta-wifi-credentials.json on boot USB ESP" marker was already emitted at 6.6.
  # ZETA_HOME/ZETA_UID are set (~1525) and this runs inside the `[ -d "$ZETA_HOME" ]` block, so no
  # unbound-variable risk. Graceful no-op if creds weren't staged or the helper isn't present.
  WIFI_STAGED="/mnt/boot/zeta-wifi-credentials.json"
  WIFI_HELPER="$ZETA_HOME/Zeta/src/Core.TypeScript/installer/wifi-esp-to-nm.ts"
  WIFI_NM_DST="/mnt/etc/NetworkManager/system-connections"
  if [ -f "$WIFI_STAGED" ] && [ -f "$WIFI_HELPER" ]; then
    WIFI_TMP=/tmp/zeta-esp-wifi.nmconnection
    WIFI_PROFILE_NAME=$(
      sudo --preserve-env=PATH -u "#$ZETA_UID" HOME="$ZETA_HOME" BUN_INSTALL="$ZETA_HOME/.bun" \
        MISE_TRUSTED_CONFIG_PATHS="$ZETA_HOME/Zeta" \
        bash -c "set -o pipefail; export PATH='/run/current-system/sw/bin:${ZETA_HOME}/.local/share/mise/shims:${ZETA_HOME}/.bun/bin:/usr/bin:/bin'; eval \"\$(mise activate bash 2>/dev/null || true)\"; cd '$ZETA_HOME/Zeta' && bun '$WIFI_HELPER' --input '$WIFI_STAGED' --output '$WIFI_TMP'" \
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
      # 081KZETP6AT diagnosability: "the converter produced nothing" has TWO very
      # different causes, and reporting both as "invalid ... json" actively misleads.
      # (1) the runtime is missing — install.sh did not complete, so there is no `bun`
      #     to run the converter with (the creds file may be perfectly fine); vs
      #     (2) the creds JSON really is malformed.
      # Case (1) cost a whole diagnosis cycle chasing a creds bug that was really the
      # first-boot install failure. Distinguish them, and stop swallowing the helper's
      # stderr (it was captured to the .err file and deleted UNREAD).
      if ! sudo --preserve-env=PATH -u "#$ZETA_UID" HOME="$ZETA_HOME" BUN_INSTALL="$ZETA_HOME/.bun" \
             bash -c "export PATH='/run/current-system/sw/bin:${ZETA_HOME}/.local/share/mise/shims:${ZETA_HOME}/.bun/bin:/usr/bin:/bin'; command -v bun >/dev/null 2>&1"; then
        echo "[iter-5-wifi] converter unavailable (bun/runtime missing — install.sh incomplete); skipping profile write"
        echo "[iter-5-wifi]   creds file itself was NOT validated; see ~/.zeta/PARTIAL-PROVISION + 081KZETP6AT"
      else
        echo "[iter-5-wifi] invalid zeta-wifi-credentials.json; skipping profile write"
      fi
      if [ -s /tmp/zeta-esp-wifi.err ]; then
        echo "[iter-5-wifi]   --- converter stderr ---"
        sed -e 's/^/[iter-5-wifi]   /' /tmp/zeta-esp-wifi.err 2>/dev/null | tail -10
        echo "[iter-5-wifi]   --- end converter stderr ---"
      fi
      rm -f "$WIFI_TMP" /tmp/zeta-esp-wifi.err
    fi
  fi

  # ── Step 6.95d: USB iSerial guest sysfs probe (QEMU-testable; no metal claim) ──
  # Reads guest /sys/bus/usb/devices/*/serial. QEMU usb-storage,serial=ZETA-QEMU-001
  # is what the guest sees; host sysfs is not this. Does not change default persist
  # (still FAT UUID). ZETA_BIND_USB_ISERIAL=1 opt-in binds the probed serial when
  # the probe actually produced one. A failed probe must not fail the install.
  ISERIAL_HELPER="$ZETA_HOME/Zeta/src/Core.TypeScript/installer/usb-iserial-probe.ts"
  ISERIAL_SERIAL_FILE=/tmp/zeta-usb-iserial
  rm -f "$ISERIAL_SERIAL_FILE"
  echo "[usb-iserial] ── probing guest USB iSerial via sysfs ──"
  if [ -f "$ISERIAL_HELPER" ]; then
    sudo --preserve-env=PATH -u "#$ZETA_UID" HOME="$ZETA_HOME" BUN_INSTALL="$ZETA_HOME/.bun" \
      MISE_TRUSTED_CONFIG_PATHS="$ZETA_HOME/Zeta" \
      bash -c "set -o pipefail; export PATH='/run/current-system/sw/bin:${ZETA_HOME}/.local/share/mise/shims:${ZETA_HOME}/.bun/bin:/usr/bin:/bin'; eval \"\$(mise activate bash 2>/dev/null || true)\"; cd '$ZETA_HOME/Zeta' && bun '$ISERIAL_HELPER' --serial-file '$ISERIAL_SERIAL_FILE'" \
      || echo "[usb-iserial] probe helper unavailable (bun/runtime missing); factor not probed"
  else
    echo "[usb-iserial] probe helper absent; skipping"
  fi
  # Persist-factor markers always print (picker may be skipped). Default stays
  # FAT UUID. Opt-in bind is env-gated and requires a non-empty serial file.
  # ZETA_BIND_UEFI_KEYFILE=1 is mutually exclusive with iSerial opt-in.
  # ESP marker /zeta-bind-uefi-keyfile (QEMU_UEFI_KEYFILE_PHASE1) synthesizes the env.
  if [ "${ZETA_BIND_UEFI_FROM_ESP:-0}" = "1" ]; then
    ZETA_BIND_UEFI_KEYFILE=1
  fi
  BIND_BOTH_OPT_INS=0
  if [ "${ZETA_BIND_USB_ISERIAL:-0}" = "1" ] && [ "${ZETA_BIND_UEFI_KEYFILE:-0}" = "1" ]; then
    BIND_BOTH_OPT_INS=1
    echo "[uefi-keyfile] ZETA_BIND_UEFI_KEYFILE and ZETA_BIND_USB_ISERIAL both set; staying --usb-uuid"
  fi
  if [ "$BIND_BOTH_OPT_INS" = "1" ]; then
    :
  elif [ "${ZETA_BIND_USB_ISERIAL:-0}" = "1" ] && [ -s "$ISERIAL_SERIAL_FILE" ]; then
    echo "[usb-iserial] persist-opt-in --usb-iserial (ZETA_BIND_USB_ISERIAL=1)"
  elif [ "${ZETA_BIND_USB_ISERIAL:-0}" = "1" ]; then
    echo "[usb-iserial] persist-opt-in requested but probe failed; staying --usb-uuid"
  else
    echo "[usb-iserial] persist-default remains --usb-uuid"
  fi

  # Opt-in UEFI keyfile on the target ESP. Binding is the ESP file itself
  # (not copied to /etc). Failed write stays UUID. Default QEMU phase-1
  # (wifi / iSerial probe) must not bake /zeta-bind-uefi-keyfile.
  # QEMU_UEFI_KEYFILE_PHASE1=1 bakes that marker and asserts the write.
  KEYFILE_HELPER="$ZETA_HOME/Zeta/src/Core.TypeScript/installer/uefi-keyfile-esp.ts"
  KEYFILE_TMP=/tmp/zeta-uefi-keyfile
  KEYFILE_INSTALL=/mnt/boot/EFI/ZETA/keyfile
  KEYFILE_WRITTEN=0
  rm -f "$KEYFILE_TMP"
  if [ "$BIND_BOTH_OPT_INS" != "1" ] && [ "${ZETA_BIND_UEFI_KEYFILE:-0}" = "1" ]; then
    echo "[uefi-keyfile] ── writing ESP keyfile (opt-in persist) ──"
    if [ -f "$KEYFILE_HELPER" ]; then
      if sudo --preserve-env=PATH -u "#$ZETA_UID" HOME="$ZETA_HOME" BUN_INSTALL="$ZETA_HOME/.bun" \
        MISE_TRUSTED_CONFIG_PATHS="$ZETA_HOME/Zeta" \
        bash -c "set -o pipefail; export PATH='/run/current-system/sw/bin:${ZETA_HOME}/.local/share/mise/shims:${ZETA_HOME}/.bun/bin:/usr/bin:/bin'; eval \"\$(mise activate bash 2>/dev/null || true)\"; cd '$ZETA_HOME/Zeta' && bun '$KEYFILE_HELPER' --write '$KEYFILE_TMP'"; then
        sudo mkdir -p /mnt/boot/EFI/ZETA
        if sudo cp "$KEYFILE_TMP" "$KEYFILE_INSTALL"; then
          KEYFILE_WRITTEN=1
          echo "[uefi-keyfile] persist-opt-in --uefi-keyfile (ZETA_BIND_UEFI_KEYFILE=1)"
        else
          echo "[uefi-keyfile] persist-opt-in requested but keyfile write failed; staying --usb-uuid"
        fi
        rm -f "$KEYFILE_TMP"
      else
        echo "[uefi-keyfile] write helper unavailable (bun/runtime missing); staying --usb-uuid"
      fi
    else
      echo "[uefi-keyfile] write helper absent; staying --usb-uuid"
    fi
  fi

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
    PICKER_BIND_FLAG="--usb-uuid"
    PICKER_BIND_VALUE="$USB_UUID"
    if [ "${ZETA_BIND_USB_ISERIAL:-0}" = "1" ] && [ -s "$ISERIAL_SERIAL_FILE" ] && [ "${BIND_BOTH_OPT_INS:-0}" != "1" ]; then
      PICKER_BIND_FLAG="--usb-iserial"
      PICKER_BIND_VALUE="$(cat "$ISERIAL_SERIAL_FILE")"
      echo "$PICKER_BIND_VALUE" | sudo tee /mnt/etc/zeta/usb-iserial >/dev/null
      sudo chmod 0644 /mnt/etc/zeta/usb-iserial
    elif [ "${ZETA_BIND_UEFI_KEYFILE:-0}" = "1" ] && [ "${KEYFILE_WRITTEN:-0}" = "1" ] && [ "${BIND_BOTH_OPT_INS:-0}" != "1" ]; then
      PICKER_BIND_FLAG="--uefi-keyfile"
      PICKER_BIND_VALUE="$KEYFILE_INSTALL"
    fi
    echo "[iter-5.5.0] ── 6.95-picker: 081KSKBP80008QG0R003AX2A69.3a cred-picker (DEFAULT-ON per 081KSKBP80008QG0R003AX2A69.3c) ──"
    echo "[iter-5.5.0]   passphrase from Step 6.56; binding $PICKER_BIND_FLAG (default FAT UUID; iSerial/keyfile only if the matching ZETA_BIND_* opt-in succeeded)"
    echo "[iter-5.5.0]   to opt out: set ZETA_CREDS_PICKER=0 OR touch /etc/zeta/no-picker"
    # QEMU serial has no TTY. readline.question hangs until the 1800s phase-1
    # timeout (run 32724820159). --defer-all is HC-8: empty bake, never bake.
    PICKER_DEFER=""
    if [ ! -t 0 ] || [ -n "${QEMU_PP_FILE:-}" ]; then
      PICKER_DEFER="--defer-all"
      echo "[iter-5.5.0]   non-TTY or QEMU passphrase file: picker --defer-all (no bake)"
    fi
    # mise activate inside bash -c matches sibling 6.95a-claude/gemini/codex
    # patterns at lines 1119-1141; without it, bun is not on the PATH the
    # subshell sees (mise installs bun via shims; activate sets PATH).
    # BUN_INSTALL pin matches sibling pattern too.
    #
    # MISE_TRUSTED_CONFIG_PATHS matches wifi / iSerial / keyfile sudo -u
    # lines (PR #10226). This is a separate sudo and does not inherit
    # install.sh's export. Without it, `mise activate` dies:
    # "Config files in ~/Zeta/.mise.toml are not trusted" (QEMU picker
    # bind, run 32647553460). HOME-local trust does not survive
    # /mnt/home/zeta → post-reboot $HOME.
    #
    # Output path: bun persist runs as zeta uid (`sudo -u`). VFAT
    # /mnt/boot is root-write. Measured run 32804383505: --defer-all
    # worked, then EACCES on /mnt/boot/zeta-creds.enc, so phase-2
    # had no blob and restore markers never fired. Same shape as
    # UEFI keyfile: write /tmp, sudo install onto the target ESP.
    # After reboot, disko remounts that ESP at /boot; restore reads
    # /boot/zeta-creds.enc (zeta-creds-restore.nix).
    #
    # Env-var passing: inline-set ZETA_CREDS_PASSPHRASE only into the
    # sudo subprocess (not exported in the parent installer shell).
    # See SECURITY block above for full lifecycle.
    PICKER_TMP=/tmp/zeta-creds.enc
    PICKER_TMP_FACTOR=/tmp/zeta-creds.factor
    rm -f "$PICKER_TMP" "$PICKER_TMP_FACTOR"
    ZETA_CREDS_PASSPHRASE="$ZETA_CREDS_PASSPHRASE_VAL" sudo --preserve-env=ZETA_CREDS_PASSPHRASE -u "#$ZETA_UID" \
      HOME="$ZETA_HOME" BUN_INSTALL="$ZETA_HOME/.bun" \
      MISE_TRUSTED_CONFIG_PATHS="$ZETA_HOME/Zeta" \
      bash -c "set -o pipefail; export PATH='/run/current-system/sw/bin:/run/current-system/sw/sbin:${ZETA_HOME}/.local/share/mise/shims:${ZETA_HOME}/.bun/bin:/usr/bin:/bin'; eval \"\$(mise activate bash 2>/dev/null || true)\"; cd '$ZETA_HOME/Zeta' && bun src/Core.TypeScript/installer/zeta-creds-picker.ts $PICKER_BIND_FLAG '$PICKER_BIND_VALUE' --output $PICKER_TMP --passphrase-env ZETA_CREDS_PASSPHRASE $PICKER_DEFER" || \
        echo "[iter-5.5.0]   WARN: picker exited non-zero; cred-blob may be partial"
    if [ -f "$PICKER_TMP" ]; then
      sudo install -m 0600 "$PICKER_TMP" /mnt/boot/zeta-creds.enc
      if [ -f "$PICKER_TMP_FACTOR" ]; then
        sudo install -m 0600 "$PICKER_TMP_FACTOR" /mnt/boot/zeta-creds.factor
      else
        echo "[iter-5.5.0]   WARN: picker blob written but factor sidecar missing"
      fi
      rm -f "$PICKER_TMP" "$PICKER_TMP_FACTOR"
      # 081M0WTB5MN Layer-3: flush the VFAT write so a reboot cannot drop it, then
      # NAME what landed and on which device. `sudo install` does not fsync, and
      # the ESP is FAT; if the guest reboots before the page cache flushes, the
      # blob is silently lost. The injected durability seam
      # ($ZETA_SUDO $ZETA_LEDGER_SYNC, default a real flush) closes that and keeps
      # the one-flush-site invariant (install-ledger-append.test.ts forbids a
      # second bare flush). The two echoes split a phase-2
      # "MISSING /boot/zeta-creds.enc" into "write never landed" vs "phase-2
      # mounts a different /boot than this one".
      $ZETA_SUDO $ZETA_LEDGER_SYNC 2>/dev/null || true
      echo "[081M0WTB5MN] post-persist /mnt/boot/zeta-creds.enc: $(sudo ls -l /mnt/boot/zeta-creds.enc 2>&1 || echo ABSENT)"
      echo "[081M0WTB5MN] /mnt/boot source device: $(findmnt -no SOURCE /mnt/boot 2>/dev/null || echo unknown)"
    fi
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
  echo "    3. sudo nixos-rebuild switch --impure --flake /etc/zeta/full-ai-cluster#$HOST"
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

# ── Step 8: close the R9 attempt ledger ───────────────────────────
#
# The install reached the end, so RECORD THE SUCCESS. Until this existed
# nothing ever wrote an `ok`, every record in the ledger was a `started`, and
# zeta_pf_validate_ledger counts a `started` as a failure -- so the bound
# counted installs rather than failures and the FOURTH install from one stick
# opened the breaker even when the first three all succeeded.
#
# This is deliberately the LAST statement in the script. `set -e` is on, so
# anything that can still fail has already failed before control gets here, and
# "we got here" is the entire evidence this record asserts. Do not move it
# earlier and do not wrap it in a trap: a trap fires on the failure paths too,
# which would turn the success record into an unconditional one -- a check that
# cannot fail, and the exact way this breaker would go back to being decorative.
#
# The blind case stays blind. An unwritable ESP means this attempt was never
# counted in the first place, so there is nothing to close out.
if [ "$ZETA_LEDGER_WRITABLE" = "1" ]; then
  zeta_ledger_append ok complete
  echo "[R9-breaker] recorded install COMPLETION as ledger record $ZETA_ATTEMPT_N"
  echo "[R9-breaker] consecutive-failure count is now 0; this stick can install again"
else
  echo "[R9-breaker] ledger not writable; completion NOT recorded (breaker stays blind next boot)"
fi
