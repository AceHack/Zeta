#!/usr/bin/env bash
# full-ai-cluster/dev-cluster/kind-down.sh

set -euo pipefail

CLUSTER_NAME="zeta-ci"
OCI_RUNTIME="${ZETA_CONTAINER_RUNTIME:-docker}"

usage() {
  cat >&2 <<EOF
usage: ./kind-down.sh [--cluster-name <name>]
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --cluster-name)
      if [ "$#" -lt 2 ]; then
        usage
        exit 1
      fi
      CLUSTER_NAME="$2"
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

case "$CLUSTER_NAME" in
  ''|*[!a-z0-9-]*|-*|*-)
    echo "ERROR: cluster name must be a DNS label (got: '${CLUSTER_NAME}')" >&2
    exit 1
    ;;
esac

if [ "${CONTAINER_RUNTIME:-}" != "" ]; then
  echo "ERROR: CONTAINER_RUNTIME is not supported; use ZETA_CONTAINER_RUNTIME" >&2
  exit 1
fi

case "$OCI_RUNTIME" in
  docker)
    unset KIND_EXPERIMENTAL_PROVIDER
    ;;
  podman)
    export KIND_EXPERIMENTAL_PROVIDER=podman
    ;;
  *)
    echo "ERROR: ZETA_CONTAINER_RUNTIME must be docker or podman (got: '${OCI_RUNTIME}')" >&2
    exit 1
    ;;
esac

if kind get clusters 2>/dev/null | grep -qx "$CLUSTER_NAME"; then
  echo "Deleting kind cluster ${CLUSTER_NAME} ..."
  kind delete cluster --name "$CLUSTER_NAME"
else
  echo "Kind cluster ${CLUSTER_NAME} not present."
fi
