#!/usr/bin/env bash
# tools/installer/zeta-self-register.sh — 081KDWYJVN008QG0R001XPR5X4 post-boot node self-registration.
#
# Runs as a first-boot systemd oneshot (see nixos/modules/zeta-self-register.nix)
# AFTER network-online + zeta-creds-restore, so gh auth is present. Opens a PR
# adding maintainers/<gh-user>/cluster-nodes/<host>/node.yaml (081KSGS9H0008QG0R002K93MWX ClusterNode).
#
# WHY post-boot (not install-time, Step 6.9): a zero-typing install restores gh
# creds on first boot via the cred-blob — AFTER the installer ran — so the
# install-time registration was always gated off (no auth yet). This closes that
# gap: it fires once the restored creds exist.
#
# Modes:
#   live (default)     — gh auth + clone + PR (needs network + restored creds)
#   ci-dry-run         — ZETA_SELF_REGISTER_MODE=ci-dry-run: compose ClusterNode
#                        preview only; no gh/git push. QEMU serial markers prove
#                        post-boot registration intent without live GitHub.
#
# Never edits the in-place repo working tree (fresh shallow clone in a tempdir).
# Honest exit: skips cleanly (exit 0) when gh isn't authed.
#
# ── 081M0BTFK85087G0R000A705AK: LEVEL-TRIGGERED CONVERGENCE ───────────────────
#
# This script used to open with `if [ -f "$MARKER" ]; then exit 0; fi`, and its
# systemd unit carried the matching `ConditionPathExists = "!marker"`. Together
# those made registration a one-time EDGE: once the marker existed the node
# no-opped forever, so a registration later wiped, reverted, or written against a
# stale identity could never be repaired without an operator deleting the marker
# by hand — on the node that is by hypothesis the unreachable one.
#
#   A marker-gated oneshot cannot re-converge, and repair IS re-convergence.
#
# The marker is now a RECEIPT, not a gate. Every run asks the LEVEL question —
# "is the desired state present?" — against the actual registration, and acts
# only on divergence. apply-N ≡ apply-once by construction (manifesto §12).
#
# ci-dry-run mode keeps the one-shot marker semantics deliberately: that path is
# a hermetic compose proof in a throwaway VM, not a repair path.
#
# A FAILED CHECK IS NOT A NEGATIVE RESULT. Every probe below separates "definitely
# absent" from "could not tell" and refuses to act on the second. Reading an
# unreachable API as "not registered" is how a converger becomes a PR spammer
# during exactly the outage it should stay quiet through.
#
# The write side is bounded, so redundant runs cannot manufacture damage:
#   * at most ONE open registration PR per host at a time; and
#   * at most one PR-creation ATTEMPT per ZETA_SELF_REGISTER_MIN_PR_INTERVAL.
# Neither is a give-up — both expire, so the node always re-converges eventually.
set -euo pipefail

MARKER="${ZETA_SELF_REGISTER_MARKER:-$HOME/.config/zeta/self-registered.marker}"
REPO_SLUG="${ZETA_SELF_REGISTER_REPO_SLUG:-Lucent-Financial-Group/Zeta}"
MODE="${ZETA_SELF_REGISTER_MODE:-live}"
MIN_PR_INTERVAL="${ZETA_SELF_REGISTER_MIN_PR_INTERVAL:-86400}"
NODE_PATH=""
log() { echo "[self-register] $*"; }

# ZETA-TPM-PARITY-BEGIN
#
# The five-state TPM 2.0 reading, in bash, so an UNATTENDED node can record what
# it found without a TypeScript runtime.
#
# WHY THIS EXISTS AT ALL. Aaron knows his machines have TPMs -- they are Windows
# 11 certified hardware, and Windows 11's minimum requirements mandate TPM 2.0.
# That answers the DESIGN question and it does not answer the INSTALLER's. A
# hands-off bring-up has to decide, on the node, with nobody watching, whether
# the machine it is standing on can hold a hardware seal; `node.yaml` recorded
# cpu / cores / memory / gpu / kernel / network and NOTHING about a TPM, so the
# one component the seal depends on was the one component the fleet never wrote
# down. The gap is the registration surface, not the silicon.
#
# THE STATES ARE NOT A BOOLEAN, AND THAT IS THE WHOLE POINT.
#   present       a usable device node AND positive family-2.0 evidence
#   absent        /sys/class/tpm ENUMERATED and registers no chip (the real
#                 negative -- commonly an fTPM left off in firmware)
#   unreadable    a source EXISTS and denied us; a privileged caller gets a
#                 different answer. NOT "no TPM".
#   unavailable   the subsystem is not exposed here at all -- "we could not ask"
#   indeterminate a node exists and nothing confirmed the family. NEVER rounded
#                 up to `present`.
#
# THIS IS A SECOND IMPLEMENTATION OF A RULE THAT ALREADY EXISTS, so it is pinned
# to the first one rather than trusted: `tpm-shell-parity.test.ts` extracts this
# block, runs it under bash, and compares its verdict against
# `classifyTpm2Linux` from tools/setup/persona-keys/tpm2-linux-probe.ts over
# EVERY committed capture in tpm2-linux-captures.json. Two implementations, one
# fixture set, and a red test the moment they disagree.
#
# The classifier is PURE: it consumes fact records on stdin and prints one word.
# All IO lives in zeta_tpm_read_facts, which is deliberately outside the parity
# claim -- reading a real /sys is not something a fixture can stand in for.

# Family from a `tpm_version_major` file. ASCII "2" => 2.0, "1" => 1.2.
# Anything else is `unrecognised` and is NEVER defaulted to 2.0.
zeta_tpm_family_from_version_file() {
  _t="$(tr -d '[:space:]' < "$1" 2>/dev/null || true)"
  case "$_t" in
    2) printf '2.0\n' ;;
    1) printf '1.2\n' ;;
    *) printf 'unrecognised\n' ;;
  esac
}

# Family from `tpm2_getcap properties-fixed` YAML. Prints NOTHING when the
# property is absent from the output -- "this tool did not tell us" is not
# "not 2.0", and collapsing the two is the empty-grep trap (081M00QP7G7087G0R002PZB5T2).
zeta_tpm_family_from_getcap_file() {
  awk '
    BEGIN { found = 0 }
    found == 0 {
      line = $0
      sub(/^[ \t]+/, "", line)
      if (index(line, "TPM2_PT_FAMILY_INDICATOR") == 1) { found = 1 }
      next
    }
    {
      if ($0 ~ /^[^ \t]/) { exit }              # next top-level key: stop
      if ($0 ~ /^[ \t]*value:[ \t]*/) {
        v = $0
        sub(/^[ \t]*value:[ \t]*/, "", v)
        gsub(/"/, "", v)
        gsub(/[ \t\r]/, "", v)
        if (v != "") {
          if (v == "2.0") print "2.0"
          else if (v == "1.2") print "1.2"
          else print "unrecognised"
          exit
        }
      }
    }
  ' "$1" 2>/dev/null || true
}

# Reads fact records on stdin, prints exactly one of the five states.
#
#   platform=<string>
#   node=<path>|<found|not-found|permission-denied|error|not-attempted>
#   sysclass=<listed|not-found|permission-denied|error|not-attempted>|<entries, space separated>
#   version=<path>|<read|not-found|permission-denied|error|not-attempted>|<file holding the text>
#   getcap=<ran|not-installed|failed|error|not-attempted>|<file holding stdout>
#
# The precedence below is the same ordering the TypeScript classifier documents,
# and two rules in it carry the discipline:
#   * a DENIAL outranks every negative, so it can never be spent as one
#   * `absent` has exactly ONE producer -- an enumeration that actually ran
zeta_tpm_classify() {
  _platform=""
  _found_node=""
  _denied_nodes=""
  _enumerated=0
  _chips=""
  _has20=0
  _has12=0
  _denied_sources=""

  while IFS= read -r _line || [ -n "$_line" ]; do
    [ -n "$_line" ] || continue
    _key="${_line%%=*}"
    _val="${_line#*=}"
    case "$_key" in
      platform)
        _platform="$_val"
        ;;
      node)
        _npath="${_val%%|*}"
        _nkind="${_val#*|}"
        case "$_nkind" in
          found)
            [ -n "$_found_node" ] || _found_node="$_npath"
            ;;
          permission-denied)
            _denied_nodes="$_denied_nodes $_npath"
            _denied_sources="$_denied_sources $_npath"
            ;;
        esac
        ;;
      sysclass)
        _skind="${_val%%|*}"
        _sentries="${_val#*|}"
        [ "$_sentries" != "$_val" ] || _sentries=""
        if [ "$_skind" = "listed" ]; then
          _enumerated=1
          for _e in $_sentries; do
            case "$_e" in
              tpm[0-9]|tpm[0-9][0-9]|tpm[0-9][0-9][0-9]) _chips="$_chips $_e" ;;
            esac
          done
        elif [ "$_skind" = "permission-denied" ]; then
          _denied_sources="$_denied_sources /sys/class/tpm"
        fi
        ;;
      version)
        _rest="${_val#*|}"
        _vkind="${_rest%%|*}"
        _vfile="${_rest#*|}"
        [ "$_vfile" != "$_rest" ] || _vfile=""
        if [ "$_vkind" = "read" ] && [ -n "$_vfile" ]; then
          _fam="$(zeta_tpm_family_from_version_file "$_vfile")"
          [ "$_fam" != "2.0" ] || _has20=1
          [ "$_fam" != "1.2" ] || _has12=1
        elif [ "$_vkind" = "permission-denied" ]; then
          _denied_sources="$_denied_sources tpm_version_major"
        fi
        ;;
      getcap)
        _gkind="${_val%%|*}"
        _gfile="${_val#*|}"
        [ "$_gfile" != "$_val" ] || _gfile=""
        if [ "$_gkind" = "ran" ] && [ -n "$_gfile" ]; then
          _fam="$(zeta_tpm_family_from_getcap_file "$_gfile")"
          [ "$_fam" != "2.0" ] || _has20=1
          [ "$_fam" != "1.2" ] || _has12=1
        fi
        ;;
    esac
  done

  # 1. not Linux at all -> we did not ask. Never "no TPM".
  if [ "$_platform" != "linux" ]; then printf 'unavailable\n'; return 0; fi

  # 2. the ONLY path to `present`
  if [ "$_has20" -eq 1 ] && [ -n "$_found_node" ]; then printf 'present\n'; return 0; fi

  if [ "$_has20" -eq 1 ]; then
    if [ -n "$_denied_nodes" ]; then printf 'unreadable\n'; return 0; fi
    printf 'indeterminate\n'; return 0
  fi

  # 3. a real TPM of the WRONG family. `absent` is about TPM 2.0, not about chips.
  if [ "$_has12" -eq 1 ]; then printf 'absent\n'; return 0; fi

  # 4. a denial outranks every negative below it
  if [ -n "$_denied_sources" ]; then printf 'unreadable\n'; return 0; fi

  if [ -n "$_found_node" ]; then printf 'indeterminate\n'; return 0; fi
  if [ -n "$_chips" ]; then printf 'indeterminate\n'; return 0; fi

  # 6. the only path to `absent`: an enumeration that ran and came back empty
  if [ "$_enumerated" -eq 1 ]; then printf 'absent\n'; return 0; fi

  printf 'unavailable\n'
}
# ZETA-TPM-PARITY-END

# ── the IO half: DELIBERATELY OUTSIDE the parity block ───────────────────────
#
# Reading a real /sys is not something a fixture can stand in for, so this half
# carries no parity claim. It is error-preserving on purpose: every probe emits
# WHAT HAPPENED (found / not-found / permission-denied / error / not-attempted),
# never a boolean, because `[ -e path ]` returning false for a denial is exactly
# how a check that could not run comes to look like one that ran and said no.
zeta_tpm_read_facts() {
  _scratch="$1"

  case "$(uname -s 2>/dev/null || echo unknown)" in
    Linux) printf 'platform=linux\n' ;;
    Darwin) printf 'platform=darwin\n'; return 0 ;;
    *) printf 'platform=unknown\n'; return 0 ;;
  esac

  for _p in /dev/tpmrm0 /dev/tpm0; do
    _err="$(ls -d "$_p" 2>&1 >/dev/null || true)"
    if [ -e "$_p" ]; then
      printf 'node=%s|found\n' "$_p"
    elif printf '%s' "$_err" | grep -qi 'permission denied'; then
      printf 'node=%s|permission-denied\n' "$_p"
    else
      printf 'node=%s|not-found\n' "$_p"
    fi
  done

  _entries=""
  if [ -d /sys/class/tpm ]; then
    _lserr="$(ls -1 /sys/class/tpm 2>&1 >/dev/null || true)"
    if printf '%s' "$_lserr" | grep -qi 'permission denied'; then
      printf 'sysclass=permission-denied|\n'
    else
      # A GLOB, NOT `ls` (SC2012). The consumer below is an unquoted
      # `for _e in $_entries`, so this list was always word-split — parsing
      # `ls` bought nothing it does not already assume, and shellcheck is
      # right to refuse it. The glob produces the same space-joined string
      # (including the trailing space) for sysfs names, and the `-e` guard
      # collapses the no-match case to the empty string exactly as `ls` did.
      # The `ls` on the line above STAYS: it is probing for EACCES, which a
      # glob cannot report.
      for _tpm in /sys/class/tpm/*; do
        [ -e "$_tpm" ] || continue
        _entries="${_entries}${_tpm##*/} "
      done
      printf 'sysclass=listed|%s\n' "$_entries"
    fi
  else
    printf 'sysclass=not-found|\n'
  fi

  for _e in $_entries; do
    _vp="/sys/class/tpm/${_e}/tpm_version_major"
    if [ -r "$_vp" ]; then
      _dst="${_scratch}/version-${_e}"
      if cat "$_vp" > "$_dst" 2>/dev/null; then
        printf 'version=%s|read|%s\n' "$_vp" "$_dst"
      else
        printf 'version=%s|error|\n' "$_vp"
      fi
    elif [ -e "$_vp" ]; then
      printf 'version=%s|permission-denied|\n' "$_vp"
    else
      printf 'version=%s|not-found|\n' "$_vp"
    fi
  done

  if command -v tpm2_getcap >/dev/null 2>&1; then
    _gout="${_scratch}/getcap"
    if tpm2_getcap properties-fixed > "$_gout" 2>/dev/null; then
      printf 'getcap=ran|%s\n' "$_gout"
    else
      printf 'getcap=failed|\n'
    fi
  else
    printf 'getcap=not-installed|\n'
  fi
}

# One word, for the registration manifest. Never throws, never blocks a boot:
# an unreadable host still registers, it just registers `unavailable`, which is
# the honest value for "we could not ask".
zeta_tpm_state() {
  _sc="$(mktemp -d -t zeta-tpm.XXXXXX 2>/dev/null || true)"
  if [ -z "$_sc" ]; then printf 'unavailable\n'; return 0; fi
  zeta_tpm_read_facts "$_sc" 2>/dev/null | zeta_tpm_classify
  rm -rf "$_sc" 2>/dev/null || true
}

# QEMU / phase-3 serial vocabulary (distinct from install-time iter-5.4.1-ci).
ci_log() { echo "zeta-self-register: $*"; }

# receipt_field <key> — last value of <key> in the receipt, or empty.
receipt_field() {
  [ -f "$MARKER" ] || return 0
  sed -n "s/^$1=//p" "$MARKER" | tail -1
}

# write_receipt <state> <detail> [pr-attempt-epoch]
# Observation record only. Nothing reads `state` to decide whether to run — that
# is the whole point. It exists so an operator (or a future zeta-hail verb) can
# see what the node last concluded, and when, without shelling in.
write_receipt() {
  _rc_state="$1"
  _rc_detail="${2:-}"
  if [ "$#" -ge 3 ]; then _rc_prat="$3"; else _rc_prat="$(receipt_field last-pr-attempt-epoch)"; fi
  [ -n "$_rc_prat" ] || _rc_prat=0
  mkdir -p "$(dirname "$MARKER")"
  {
    printf 'state=%s\n' "$_rc_state"
    printf 'observed-at=%s\n' "$(date -u +%FT%TZ)"
    printf 'node-path=%s\n' "$NODE_PATH"
    printf 'detail=%s\n' "$_rc_detail"
    printf 'last-pr-attempt-epoch=%s\n' "$_rc_prat"
  } > "$MARKER"
}

if [ "$MODE" = "ci-dry-run" ] && [ -f "$MARKER" ]; then
  log "marker present ($MARKER) — ci-dry-run already proven; nothing to do"
  ci_log "begin"
  ci_log "already-registered"
  ci_log "complete"
  exit 0
fi

HOST="$(hostname | tr -d '[:space:]')"
# Validated, not merely non-empty: HOST is interpolated into a git branch name and
# into the jq program that finds an in-flight PR, so anything outside this class is
# refused rather than escaped.
case "$HOST" in
  "" | *[!A-Za-z0-9._-]*)
    log "ERROR: hostname '${HOST}' empty or outside [A-Za-z0-9._-] — aborting"
    exit 1
    ;;
esac
BRANCH_PREFIX="register-${HOST}-"

if [ "$MODE" = "ci-dry-run" ]; then
  # Hermetic QEMU path: no gh, no push. Prove compose + tree-path contract.
  MAINTAINER="${ZETA_SELF_REGISTER_CI_MAINTAINER:-qemu-ci}"
  NODE_PATH="maintainers/${MAINTAINER}/cluster-nodes/${HOST}/node.yaml"
  PREVIEW="${ZETA_SELF_REGISTER_CI_PREVIEW:-/var/lib/zeta-self-register/cluster-node-registration-preview.yaml}"
  TS="$(date -u +%FT%TZ)"
  CPU="$(grep -m1 'model name' /proc/cpuinfo 2>/dev/null | cut -d: -f2- | sed 's/^[[:space:]]*//;s/"//g' || true)"
  CORES="$(nproc 2>/dev/null || echo 0)"
  MEM="$(free -h --si 2>/dev/null | awk '/Mem:/{print $2}' || true)"
  GPU="$(lspci -nn 2>/dev/null | grep -iE 'vga|3d|display' | head -1 | sed 's/"//g' | cut -d: -f3- | sed 's/^[[:space:]]*//' || true)"
  IP="$(ip -4 -o addr 2>/dev/null | awk '/inet/ && !/lo/{print $4; exit}' || true)"
  MAC="$(ip -o link 2>/dev/null | awk '/state UP/ && !/lo/{for(i=1;i<=NF;i++) if($i=="link/ether"){print $(i+1); exit}}' || true)"
  KVER="$(uname -r 2>/dev/null || true)"
  TPM2="$(zeta_tpm_state 2>/dev/null || echo unavailable)"

  ci_log "begin"
  ci_log "ci-dry-run"
  mkdir -p "$(dirname "$PREVIEW")"
  cat > "$PREVIEW" <<YAML
apiVersion: zeta.lucent-financial-group.com/v1
kind: ClusterNode
metadata:
  name: ${HOST}
  namespace: zeta-cluster
  annotations:
    zeta.lucent-financial-group.com/registered-at: "${TS}"
    zeta.lucent-financial-group.com/registered-via: "081KDWYJVN008QG0R001XPR5X4-postboot-ci-dry-run"
  labels:
    zeta.lucent-financial-group.com/maintainer: "${MAINTAINER}"
spec:
  hostname: ${HOST}
  registration:
    maintainer: ${MAINTAINER}
    timestamp: "${TS}"
    via: post-boot-self-register-ci-dry-run
  hardware:
    cpu: "${CPU}"
    cores: ${CORES}
    memory: "${MEM}"
    gpu: "${GPU}"
    kernel: "${KVER}"
    tpm2: "${TPM2}"
    network:
      ip: "${IP}"
      mac: "${MAC}"
YAML
  ci_log "composed maintainer=${MAINTAINER} node=${HOST}"
  ci_log "tree-path=${NODE_PATH}"
  ci_log "preview=${PREVIEW}"
  mkdir -p "$(dirname "$MARKER")"
  printf 'ci-dry-run\n' > "$MARKER"
  ci_log "complete"
  exit 0
fi

command -v gh  >/dev/null || { log "gh not found — cannot register"; exit 1; }
command -v git >/dev/null || { log "git not found — cannot register"; exit 1; }
if ! gh auth status >/dev/null 2>&1; then
  log "gh not authenticated yet — skipping (the reconcile timer will re-check)"
  write_receipt unauthenticated "gh auth status non-zero"
  exit 0
fi

MAINTAINER="$(gh api /user --jq .login)"
# The NUMERIC id, not just the login. `<login>@users.noreply.github.com` is the LEGACY
# plain form: GitHub resolves it to whoever owns that username today, so a login that is
# also a common first name attributes this commit to a stranger. `<id>+<login>@...` is
# checked by GitHub against the login and cannot be squatted. Enforced by
# src/Core.TypeScript/hygiene/audit-coauthor-identity-collides.ts (AH005).
# `|| true` on purpose: `set -e` would abort here with only gh's own "Not Found" on
# stderr, which does not say why the registration stopped. The refusal belongs at the
# commit, where the reason can be stated -- and where the already-converged path, which
# needs no identity at all, has already exited 0.
MAINTAINER_ID="$(gh api /user --jq .id 2>/dev/null || true)"
NODE_PATH="maintainers/${MAINTAINER}/cluster-nodes/${HOST}/node.yaml"
log "maintainer=${MAINTAINER} host=${HOST}"

# ── CONVERGENCE CHECK 1: is the desired state already present on main? ────────
# The LEVEL question. Note this check always ran — it was simply unreachable once
# the marker existed, which is precisely how a working convergence test ended up
# gated behind a stale assertion about the past.
set +e
CONTENTS_ERR="$(gh api "repos/${REPO_SLUG}/contents/${NODE_PATH}" 2>&1 >/dev/null)"
CONTENTS_RC=$?
set -e
if [ "$CONTENTS_RC" -eq 0 ]; then
  log "converged: ${NODE_PATH} present on main"
  write_receipt converged "present on main"
  exit 0
fi
# Distinguish "definitely absent" (404) from "could not tell" (network, 5xx, auth
# revoked). Only the first licenses acting.
case "$CONTENTS_ERR" in
  *"HTTP 404"* | *"Not Found"*) : ;;
  *)
    log "ERROR: registration status unreadable (${CONTENTS_ERR}) — refusing to act on an unknown state"
    write_receipt check-failed "contents probe: ${CONTENTS_ERR}"
    exit 1
    ;;
esac

# ── CONVERGENCE CHECK 2: is a registration already in flight? ────────────────
# THE ANTI-STORM INVARIANT: at most one open registration PR per host, ever. This
# is what makes the reconcile timer safe at any cadence — a converger that cannot
# see its own in-flight work opens a fresh PR on every tick.
if ! OPEN_PR_JSON="$(gh pr list --repo "${REPO_SLUG}" --state open --limit 200 \
      --json headRefName,number 2>&1)"; then
  log "ERROR: could not list open PRs (${OPEN_PR_JSON}) — refusing to register (a failed check is not a negative result)"
  write_receipt check-failed "pr list probe failed"
  exit 1
fi
# Filtered HERE rather than with `gh --jq` on purpose: the matching rule is the
# thing under test, so it must live in the artifact a test can execute, not inside
# gh's embedded jq. `tr '{' '\n'` splits the compact one-line array into one chunk
# per PR; the prefix and the number are then matched within the same chunk, so key
# order does not matter. (Residual: a foreign branch name containing `{` could
# mis-split. That direction fails toward standing down, and the 24h attempt
# throttle bounds the other direction.)
# Whitespace-tolerant on purpose: `gh --json` emits COMPACT JSON when stdout is a
# pipe (the systemd case) but PRETTY-PRINTS to a TTY (the operator-runs-it-by-hand
# case), and the pretty form has a space after each colon. A compact-only matcher
# would silently miss an in-flight PR when a human ran the script, which is the
# duplicate-PR direction. Dots in the prefix are escaped so a hostname's `.` cannot
# act as a regex wildcard.
BRANCH_PREFIX_RE="$(printf '%s' "$BRANCH_PREFIX" | sed 's/[.]/\\./g')"
# `tr '\n' ' '` FIRST: the pretty form spans several lines per object, and the
# per-object split below is line-based, so without flattening the branch name and
# its number land on different lines and the number is never found.
OPEN_PR="$(printf '%s' "$OPEN_PR_JSON" \
  | tr '\n' ' ' \
  | tr '{' '\n' \
  | grep -E "\"headRefName\"[[:space:]]*:[[:space:]]*\"${BRANCH_PREFIX_RE}" \
  | sed -n 's/.*"number"[[:space:]]*:[[:space:]]*\([0-9][0-9]*\).*/\1/p' \
  | head -1 || true)"
if [ -n "$OPEN_PR" ]; then
  log "converging: registration PR #${OPEN_PR} already open for ${HOST} — not opening another"
  write_receipt converging "open PR #${OPEN_PR}"
  exit 0
fi

# ── DIVERGED. Bound the write side before acting. ────────────────────────────
NOW_EPOCH="$(date -u +%s)"
LAST_PR_EPOCH="$(receipt_field last-pr-attempt-epoch)"
case "${LAST_PR_EPOCH:-}" in "" | *[!0-9]*) LAST_PR_EPOCH=0 ;; esac
PR_AGE=$((NOW_EPOCH - LAST_PR_EPOCH))
if [ "$PR_AGE" -lt "$MIN_PR_INTERVAL" ]; then
  log "diverged, but throttled: last PR attempt ${PR_AGE}s ago < ${MIN_PR_INTERVAL}s — standing down this tick"
  write_receipt throttled "min-pr-interval=${MIN_PR_INTERVAL}s age=${PR_AGE}s"
  exit 0
fi
log "diverged: ${NODE_PATH} absent from main, no open registration PR — registering"
# Recorded BEFORE the attempt, so a create that fails halfway still backs off. A
# throttle that only counted successes would retry a failing create every tick.
write_receipt registering "attempt starting" "$NOW_EPOCH"

# ── hardware probe (best-effort; absent fields emit empty strings) ──
CPU="$(grep -m1 'model name' /proc/cpuinfo 2>/dev/null | cut -d: -f2- | sed 's/^[[:space:]]*//;s/"//g' || true)"
CORES="$(nproc 2>/dev/null || echo 0)"
MEM="$(free -h --si 2>/dev/null | awk '/Mem:/{print $2}' || true)"
GPU="$(lspci -nn 2>/dev/null | grep -iE 'vga|3d|display' | head -1 | sed 's/"//g' | cut -d: -f3- | sed 's/^[[:space:]]*//' || true)"
IP="$(ip -4 -o addr 2>/dev/null | awk '/inet/ && !/lo/{print $4; exit}' || true)"
MAC="$(ip -o link 2>/dev/null | awk '/state UP/ && !/lo/{for(i=1;i<=NF;i++) if($i=="link/ether"){print $(i+1); exit}}' || true)"
KVER="$(uname -r 2>/dev/null || true)"
TPM2="$(zeta_tpm_state 2>/dev/null || echo unavailable)"
TS="$(date -u +%FT%TZ)"

# ── fresh shallow clone (never touch an in-place working tree) ──
WORK="$(mktemp -d -t zeta-self-register.XXXXXX)"
trap 'rm -rf "$WORK"' EXIT
log "cloning ${REPO_SLUG} (shallow)…"
git clone --depth 1 "https://github.com/${REPO_SLUG}.git" "$WORK/Zeta" >/dev/null 2>&1
cd "$WORK/Zeta"
gh auth setup-git >/dev/null 2>&1 || true

mkdir -p "$(dirname "$NODE_PATH")"
cat > "$NODE_PATH" <<YAML
apiVersion: zeta.lucent-financial-group.com/v1
kind: ClusterNode
metadata:
  name: ${HOST}
  namespace: zeta-cluster
  annotations:
    zeta.lucent-financial-group.com/registered-at: "${TS}"
    zeta.lucent-financial-group.com/registered-via: "081KDWYJVN008QG0R001XPR5X4-postboot"
  labels:
    zeta.lucent-financial-group.com/maintainer: "${MAINTAINER}"
spec:
  hostname: ${HOST}
  registration:
    maintainer: ${MAINTAINER}
    timestamp: "${TS}"
    via: post-boot-self-register
  hardware:
    cpu: "${CPU}"
    cores: ${CORES}
    memory: "${MEM}"
    gpu: "${GPU}"
    kernel: "${KVER}"
    tpm2: "${TPM2}"
    network:
      ip: "${IP}"
      mac: "${MAC}"
YAML

# The prefix is load-bearing, not cosmetic: convergence check 2 finds this host's
# in-flight registration by matching `headRefName` against it. Changing the shape
# here without changing it there re-arms the PR-storm this design forbids.
BRANCH="${BRANCH_PREFIX}$(date -u +%Y%m%dT%H%M%SZ)"
git checkout -b "$BRANCH" >/dev/null
git add "$NODE_PATH"
# Guard: never push an empty commit (the Step 6.9 / node-09485d failure mode).
if git diff --cached --quiet; then log "ERROR: nothing staged — aborting (not registering)"; exit 1; fi
# Refuse rather than guess: an unresolved id would leave only the colliding plain form,
# and a commit attributed to the wrong human is worse than a registration that retries.
case "${MAINTAINER_ID}" in
  ''|*[!0-9]*) log "ERROR: could not resolve numeric GitHub id for '${MAINTAINER}' — refusing to commit under an ambiguous identity"; exit 1 ;;
esac
git -c user.name="${MAINTAINER}" -c user.email="${MAINTAINER_ID}+${MAINTAINER}@users.noreply.github.com" \
    commit -q -m "feat(node-register): ${HOST} self-registers (post-boot, 081KDWYJVN008QG0R001XPR5X4)"
log "pushing ${BRANCH}…"
git push -u origin "$BRANCH" >/dev/null 2>&1
PR_URL="$(gh pr create --base main --head "$BRANCH" \
  --title "feat(node-register): ${HOST} self-registers" \
  --body "Automated post-boot self-registration of \`${HOST}\` (081KDWYJVN008QG0R001XPR5X4). Maintainer: @${MAINTAINER}. CPU: ${CPU:-?} · ${CORES} cores · ${MEM:-?} RAM." 2>&1 | tail -1)" || {
    log "gh pr create failed; cleaning up branch"
    git push origin --delete "$BRANCH" >/dev/null 2>&1 || true
    # The attempt epoch is retained on purpose: a failed create must back off too.
    write_receipt pr-failed "gh pr create failed for ${BRANCH}" "$NOW_EPOCH"
    exit 1
  }
log "registered: ${PR_URL}"
# NOT a completion marker. `pr-opened` means "converging" — the node is registered
# only when node.yaml is on main, which check 1 will observe on a later tick.
write_receipt pr-opened "$PR_URL" "$NOW_EPOCH"
