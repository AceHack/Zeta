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
#
# Sourcing this file also RECORDS the measured host capability vector beside the
# tier it chose (081M0X0C932087G0R001SWQQVQ) — see zeta_emit_capability_vector
# below. That is measurement only; the enum above still drives every install.

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

# ── Capability-vector emission — MEASUREMENT ONLY, GATES NOTHING ─────────────
# Workitem 081M0X0C932087G0R001SWQQVQ. Aaron 2026-08-25: "in a perfect world i
# imagine some matrix for cpus, memory, solid state, and rotational disk and
# picking the right dependence to install based on those results."
#
# The tier above is a TOTAL ORDER and therefore cannot express "rotational disk
# but 128GB RAM"; two tiers also do not compose. The capability VECTOR is the
# shape that can. The redesign is blocked on hardware that is not installed, so
# this does the unblocked half: RECORD the pair (measured vector, chosen tier)
# so a later design can check whether the tier followed from the hardware or was
# a guess.
#
# NOTHING ABOUT INSTALL BEHAVIOUR CHANGES HERE. ZETA_HOST_TIER still decides
# every package. This function is pure side-record and is fail-open by design:
# a missing bun, a missing emitter, or a non-zero emit must never fail a setup
# run, because a measurement that can break an install would be worse than no
# measurement.
#
# Cost: one bun invocation per install run (~0.3s measured on darwin/arm64),
# spent once — ZETA_CAPABILITY_VECTOR_EMITTED is exported so the three sourcing
# sites (mise.sh, linux.sh, macos.sh) do not each pay it.
#
# Opt out with ZETA_CAPABILITY_VECTOR=0. Redirect with ZETA_CAPABILITY_VECTOR_OUT.
zeta_emit_capability_vector() {
  [ "${ZETA_CAPABILITY_VECTOR:-1}" = "0" ] && return 0
  [ -n "${ZETA_CAPABILITY_VECTOR_EMITTED:-}" ] && return 0

  local _here _repo _emitter
  _here="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)" || return 0
  _repo="$(cd "$_here/../../.." && pwd)" || return 0
  _emitter="$_repo/src/Core.TypeScript/installer/host-capability-vector.ts"

  if [ ! -f "$_emitter" ]; then
    echo "→ capability vector not emitted: $_emitter absent (tier=$ZETA_HOST_TIER still drives installs)" >&2
    return 0
  fi
  if ! command -v bun >/dev/null 2>&1; then
    # Expected during early bootstrap, before the toolchain exists. Loud, not fatal.
    echo "→ capability vector not emitted: bun not on PATH yet (tier=$ZETA_HOST_TIER still drives installs)" >&2
    return 0
  fi

  ZETA_CAPABILITY_VECTOR_EMITTED=1
  export ZETA_CAPABILITY_VECTOR_EMITTED
  if ! (cd "$_repo" && bun "$_emitter"); then
    echo "→ capability vector emit failed; continuing (measurement never gates a setup run)" >&2
  fi
  return 0
}

zeta_emit_capability_vector

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
