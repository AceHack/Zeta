#!/usr/bin/env bash
# full-ai-cluster/dev-cluster/down.sh
#
# Tear down the local dev cluster + its registry. Idempotent.

set -euo pipefail

if k3d cluster list 2>/dev/null | grep -q '^zeta-dev '; then
  echo "Deleting k3d cluster zeta-dev ..."
  k3d cluster delete zeta-dev
fi

if k3d registry list 2>/dev/null | grep -q '^k3d-zeta-dev-registry '; then
  echo "Deleting k3d registry zeta-dev-registry ..."
  k3d registry delete zeta-dev-registry || true
fi

# kubectl context cleanup — k3d removes its own context on cluster
# delete but the kubeconfig file may carry stale current-context.
if kubectl config current-context 2>/dev/null | grep -q '^k3d-zeta-dev$'; then
  kubectl config unset current-context || true
fi

echo "Dev cluster torn down."
