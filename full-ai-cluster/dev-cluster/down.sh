#!/usr/bin/env bash
# full-ai-cluster/dev-cluster/down.sh
#
# Tear down the local dev cluster + its registry. Idempotent.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_PATH="${SCRIPT_DIR}/k3d-config.yaml"

usage() {
  cat >&2 <<EOF
usage: ./down.sh [--config <k3d-config.yaml>]
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --config)
      if [ "$#" -lt 2 ]; then
        usage
        exit 1
      fi
      CONFIG_PATH="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      usage
      exit 1
      ;;
  esac
done

if [ ! -f "$CONFIG_PATH" ]; then
  echo "ERROR: k3d config not found: $CONFIG_PATH" >&2
  exit 1
fi

CLUSTER_NAME="$(awk '
  /^metadata:[[:space:]]*$/ { in_metadata=1; next }
  in_metadata && /^[^[:space:]]/ { exit }
  in_metadata && /^[[:space:]]+name:[[:space:]]*/ {
    sub(/^[[:space:]]+name:[[:space:]]*/, "")
    print
    exit
  }
' "$CONFIG_PATH")"
case "$CLUSTER_NAME" in
  ''|*[!a-z0-9-]*|-*|*-)
    echo "ERROR: k3d config metadata.name must be a DNS label (got: '${CLUSTER_NAME}')" >&2
    exit 1
    ;;
esac

REGISTRY_NAME="${CLUSTER_NAME}-registry"
KUBECONTEXT="k3d-${CLUSTER_NAME}"

if k3d cluster list 2>/dev/null | grep -q "^${CLUSTER_NAME} "; then
  echo "Deleting k3d cluster ${CLUSTER_NAME} ..."
  k3d cluster delete "$CLUSTER_NAME"
fi

if k3d registry list 2>/dev/null | grep -q "^k3d-${REGISTRY_NAME} "; then
  echo "Deleting k3d registry ${REGISTRY_NAME} ..."
  k3d registry delete "$REGISTRY_NAME" || true
fi

# kubectl context cleanup - k3d removes its own context on cluster
# delete but the kubeconfig file may carry stale current-context.
if kubectl config current-context 2>/dev/null | grep -q "^${KUBECONTEXT}$"; then
  kubectl config unset current-context || true
fi

echo "Dev cluster torn down."
