#!/usr/bin/env bash
#
# tools/setup/common/host-tier.sh — THE HOST-TIER HELPER, sourced by installers.
# Workitem 081KTWQZY7F08QG0R0034KN17T (Aaron 2026-06-12: "packages can declare their
# requirements and os declare their capabilities and that's how we know not to install on
# small/slow runners") — the cap/support pattern applied to setup: manifest entries declare
# `tier=<slim|standard|full>` (untagged = slim = required everywhere); the host declares
# ZETA_HOST_TIER, or we AUTO-DETECT from memory when undeclared (>=16GB full; >=8GB standard;
# else slim). Skips must be LOUD — every caller prints the named entry + both tiers.
#
# Usage (in a sourced installer):
#   . "$(dirname "$0")/host-tier.sh"
#   req="$(zeta_tier_of_line "$line")"; line="$(zeta_strip_tier "$line")"
#   if ! zeta_tier_allows "$req"; then echo "→ $name skipped: requires tier=$req, host is $ZETA_HOST_TIER"; continue; fi

zeta_tier_rank() {
  case "$1" in
    slim) echo 0 ;;
    standard) echo 1 ;;
    full) echo 2 ;;
    *) echo "error: unknown tier '$1' (slim|standard|full)" >&2; return 1 ;;
  esac
}

zeta_detect_host_tier() {
  local mem_bytes=""
  if [ "$(uname -s)" = "Darwin" ]; then
    mem_bytes="$(sysctl -n hw.memsize 2>/dev/null || echo 0)"
  elif [ -r /proc/meminfo ]; then
    mem_bytes="$(( $(awk '/^MemTotal:/{print $2}' /proc/meminfo) * 1024 ))"
  fi
  if [ -z "$mem_bytes" ] || [ "$mem_bytes" -eq 0 ] 2>/dev/null; then
    echo full # unknown hardware: degrade to the permissive default, never silently slim
  elif [ "$mem_bytes" -ge $((16 * 1024 * 1024 * 1024)) ]; then
    echo full
  elif [ "$mem_bytes" -ge $((8 * 1024 * 1024 * 1024)) ]; then
    echo standard
  else
    echo slim
  fi
}

# Resolve once: explicit declaration wins; otherwise detect (and say which path was taken).
if [ -n "${ZETA_HOST_TIER:-}" ]; then
  zeta_tier_rank "$ZETA_HOST_TIER" >/dev/null # validate or die loudly
  ZETA_HOST_TIER_SOURCE="declared"
else
  ZETA_HOST_TIER="$(zeta_detect_host_tier)"
  ZETA_HOST_TIER_SOURCE="detected"
fi
ZETA_HOST_RANK="$(zeta_tier_rank "$ZETA_HOST_TIER")"
export ZETA_HOST_TIER ZETA_HOST_RANK ZETA_HOST_TIER_SOURCE

# tier of a manifest line (default slim).
zeta_tier_of_line() {
  local token tier="slim"
  for token in $1; do
    case "$token" in tier=*) tier="${token#tier=}" ;; esac
  done
  echo "$tier"
}

# the line with its tier= token removed.
zeta_strip_tier() {
  local token out=""
  for token in $1; do
    case "$token" in tier=*) ;; *) out="$out $token" ;; esac
  done
  echo "${out# }"
}

# does the host allow an entry requiring $1?
zeta_tier_allows() {
  [ "$(zeta_tier_rank "$1")" -le "$ZETA_HOST_RANK" ]
}

# ── Manifest filter: bare-package-name manifests, tier-gated ─────────────────
# For manifests whose entries are BARE package names with an optional
# `tier=<slim|standard|full>` token (manifests/apt). Reads $1, strips `#`
# comments + whitespace (the same awk parser linux.sh has always used — the
# 2026-05-26 `p7zip-full  # comment` bug is guarded by it), drops entries the
# host's tier does not allow, and prints the ALLOWED package names one per line
# on stdout. Skips are printed to STDERR, named, with both tiers — loud, per the
# discipline at the top of this file.
#
# stdout/stderr are split so a caller can do `PKGS="$(zeta_filter_manifest_by_tier f)"`
# and still have the operator see every skip in the log.
#
# NOT used for manifests/brew: brew entries carry version pins and other tokens,
# so macos.sh keeps its own line-wise parse. This helper is for the bare-name shape.
zeta_filter_manifest_by_tier() {
  local _manifest="$1" _line _tier _pkg
  [ -f "$_manifest" ] || return 0
  while IFS= read -r _line; do
    [ -n "$_line" ] || continue
    _tier="$(zeta_tier_of_line "$_line")"
    _pkg="$(zeta_strip_tier "$_line")"
    [ -n "$_pkg" ] || continue
    if ! zeta_tier_allows "$_tier"; then
      echo "→ $_pkg skipped: requires tier=$_tier, host is $ZETA_HOST_TIER ($ZETA_HOST_TIER_SOURCE)" >&2
      continue
    fi
    printf '%s\n' "$_pkg"
  done <<EOF2
$(awk '
    { sub(/#.*$/, ""); gsub(/^[[:space:]]+|[[:space:]]+$/, "") }
    NF > 0 { print }
  ' "$_manifest")
EOF2
}
