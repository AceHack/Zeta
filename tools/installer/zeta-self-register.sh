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
# Idempotent + safe to retry: no-ops if a local marker exists OR the node is
# already on main. Never edits the in-place repo working tree (fresh shallow
# clone in a tempdir). Honest exit: skips cleanly (exit 0) when gh isn't authed.
set -euo pipefail

MARKER="${ZETA_SELF_REGISTER_MARKER:-$HOME/.config/zeta/self-registered.marker}"
REPO_SLUG="${ZETA_SELF_REGISTER_REPO_SLUG:-Lucent-Financial-Group/Zeta}"
MODE="${ZETA_SELF_REGISTER_MODE:-live}"
log() { echo "[self-register] $*"; }
# QEMU / phase-3 serial vocabulary (distinct from install-time iter-5.4.1-ci).
ci_log() { echo "zeta-self-register: $*"; }

if [ -f "$MARKER" ]; then
  log "marker present ($MARKER) — already registered; nothing to do"
  if [ "$MODE" = "ci-dry-run" ]; then
    ci_log "begin"
    ci_log "already-registered"
    ci_log "complete"
  fi
  exit 0
fi

HOST="$(hostname | tr -d '[:space:]')"
if [ -z "$HOST" ]; then
  log "ERROR: hostname empty — aborting"
  exit 1
fi

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
if ! gh auth status >/dev/null 2>&1; then log "gh not authenticated yet — skipping (will retry next boot)"; exit 0; fi

MAINTAINER="$(gh api /user --jq .login)"
NODE_PATH="maintainers/${MAINTAINER}/cluster-nodes/${HOST}/node.yaml"
log "maintainer=${MAINTAINER} host=${HOST}"

# Idempotency: already on main? (write marker so we never poll the API again.)
if gh api "repos/${REPO_SLUG}/contents/${NODE_PATH}" >/dev/null 2>&1; then
  log "already registered on main: ${NODE_PATH}"
  mkdir -p "$(dirname "$MARKER")"; date -u +%FT%TZ > "$MARKER"
  exit 0
fi

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

BRANCH="register-${HOST}-$(date -u +%Y%m%dT%H%M%SZ)"
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
    log "gh pr create failed; cleaning up branch"; git push origin --delete "$BRANCH" >/dev/null 2>&1 || true; exit 1; }
log "registered: ${PR_URL}"
mkdir -p "$(dirname "$MARKER")"; printf '%s\n' "$PR_URL" > "$MARKER"
