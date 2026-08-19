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
git -c user.name="${MAINTAINER}" -c user.email="${MAINTAINER}@users.noreply.github.com" \
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
