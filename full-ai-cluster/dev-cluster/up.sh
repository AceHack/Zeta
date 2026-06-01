#!/usr/bin/env bash
# full-ai-cluster/dev-cluster/up.sh
#
# Bring up the local dev cluster end-to-end:
#   1. Create the k3d cluster from k3d-config.yaml
#   2. Install Cilium (the chicken-and-egg CNI from prod's bootstrap)
#   3. Install ArgoCD
#   4. Apply the root App-of-Apps pointing at this repo's
#      k8s/applications/ directory
#
# After this completes, ArgoCD reconciles the SAME workloads it
# would in prod, with two exceptions noted in the dev-overlays
# section of README.md (no Longhorn, no GPU device plugin).
#
# Usage: ./up.sh [git-ref]
#        ./up.sh --config profiles/ci.k3d-config.yaml --git-ref <ref>
#
# git-ref defaults to `main`. Pass a PR branch to dev-test before
# merging:
#   ./up.sh feat/my-branch-2026-05-25

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
GIT_REF="main"
GIT_REPO_URL="${ZETA_ARGOCD_GIT_REPO_URL:-https://github.com/Lucent-Financial-Group/Zeta}"
CONFIG_PATH="${SCRIPT_DIR}/k3d-config.yaml"

usage() {
  cat >&2 <<EOF
usage: ./up.sh [git-ref]
       ./up.sh --config <k3d-config.yaml> [--git-ref <ref>] [--repo-url <url>]
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
    --git-ref)
      if [ "$#" -lt 2 ]; then
        usage
        exit 1
      fi
      GIT_REF="$2"
      shift 2
      ;;
    --repo-url)
      if [ "$#" -lt 2 ]; then
        usage
        exit 1
      fi
      GIT_REPO_URL="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      if [ "$GIT_REF" != "main" ]; then
        usage
        exit 1
      fi
      GIT_REF="$1"
      shift
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
KUBECONTEXT="k3d-${CLUSTER_NAME}"
K3D_SERVER_HOST="${KUBECONTEXT}-server-0"
AGENT_COUNT="$(awk '
  /^[[:space:]]*agents:[[:space:]]*/ {
    sub(/^[[:space:]]*agents:[[:space:]]*/, "")
    print
    exit
  }
' "$CONFIG_PATH")"
AGENT_COUNT="${AGENT_COUNT:-0}"

# Reject git refs that aren't safe to interpolate into the heredoc
# below. Branch names, tags, and SHAs all fit a narrow charset.
# Anything with whitespace / newlines / YAML metacharacters gets
# rejected -- otherwise a creative ref name could inject extra YAML
# keys into the Application spec.
case "$GIT_REF" in
  *[!a-zA-Z0-9._/-]* | ''|/*|*/|*//*)
    echo "ERROR: git-ref must match [a-zA-Z0-9._/-]+ (got: '${GIT_REF}')" >&2
    exit 1 ;;
esac

if ! [[ "$GIT_REPO_URL" =~ ^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+(\.git)?$ ]]; then
  echo "ERROR: git repo URL must be an https://github.com/<owner>/<repo> URL (got: '${GIT_REPO_URL}')" >&2
  exit 1
fi
# Pre-flight
for cmd in docker k3d kubectl helm; do
  command -v "$cmd" >/dev/null || {
    echo "ERROR: $cmd not found. Install with:"
    case "$cmd" in
      docker) echo "  Docker Desktop or Colima (https://docs.docker.com/desktop/install/mac-install/)" ;;
      k3d|kubectl|helm)
        echo "  bash \"${REPO_ROOT}/tools/setup/install.sh\""
        echo "  # installs k3d/kubectl/helm from the repo's .mise.toml"
        ;;
    esac
    exit 1
  }
done

# Step 1: k3d cluster
if k3d cluster list 2>/dev/null | grep -q "^${CLUSTER_NAME} "; then
  echo "Cluster ${CLUSTER_NAME} already exists. Use ./down.sh --config ${CONFIG_PATH} to recreate."
else
  echo "Creating k3d cluster ${CLUSTER_NAME} ..."
  k3d cluster create --config "$CONFIG_PATH" --wait=false
fi

k3d kubeconfig merge "$CLUSTER_NAME" \
  --kubeconfig-merge-default \
  --kubeconfig-switch-context \
  >/dev/null
kubectl config use-context "$KUBECONTEXT"

echo "Waiting for Kubernetes API readiness ..."
for _ in {1..60}; do
  if kubectl get --raw=/readyz >/dev/null 2>&1; then
    break
  fi
  sleep 3
done
kubectl get --raw=/readyz >/dev/null

# Step 2: Cilium CNI (chicken-and-egg -- without this, no pods
# schedule because flannel/kube-proxy are disabled)
# Version kept aligned with full-ai-cluster/k8s/bootstrap/cilium-install.yaml
# so dev exercises the same chart that lands in prod.
if ! helm -n kube-system status cilium >/dev/null 2>&1; then
  echo "Installing Cilium ..."
  helm repo add cilium https://helm.cilium.io >/dev/null 2>&1 || true
  helm repo update cilium >/dev/null

  cilium_extra_values=()
  if [ "$AGENT_COUNT" = "0" ]; then
    cilium_extra_values+=(
      --set operator.replicas=1
      --set hubble.relay.enabled=false
      --set hubble.ui.enabled=false
    )
  else
    cilium_extra_values+=(
      --set hubble.relay.enabled=true
      --set hubble.ui.enabled=true
    )
  fi

  helm install cilium cilium/cilium \
    --version 1.16.5 \
    --namespace kube-system \
    --set kubeProxyReplacement=true \
    --set k8sServiceHost="$K3D_SERVER_HOST" \
    --set k8sServicePort=6443 \
    --set hubble.enabled=true \
    --set ipam.mode=kubernetes \
    "${cilium_extra_values[@]}" \
    --wait
fi

# Step 3: ArgoCD
# Helm release check (vs `kubectl get ns argocd`) -- namespace
# existing doesn't imply the chart was installed; an earlier failed
# install can leave the ns behind. `helm status` is the canonical
# release-exists test.
# Version kept aligned with full-ai-cluster/k8s/bootstrap/argocd-install.yaml
# AND full-ai-cluster/k8s/applications/argocd/Application.yaml so the
# adoption in the self-management wave is a no-op.
if ! helm -n argocd status argocd >/dev/null 2>&1; then
  echo "Installing ArgoCD ..."
  kubectl create namespace argocd >/dev/null 2>&1 || true
  helm repo add argo https://argoproj.github.io/argo-helm >/dev/null 2>&1 || true
  helm repo update argo >/dev/null
  helm install argocd argo/argo-cd \
    --version 7.7.10 \
    --namespace argocd \
    --set server.service.type=LoadBalancer \
    --wait
fi

# Wait for the Application CRD to be Established before applying
# the root App-of-Apps. On a fresh install the CRDs land via the
# Helm hooks; kubectl apply against an un-Established CRD fails
# with "no matches for kind 'Application'".
kubectl wait --for=condition=Established \
  --timeout=120s \
  crd/applications.argoproj.io \
  >/dev/null 2>&1 || true

"${SCRIPT_DIR}/apply-root-app.sh" "$GIT_REF" "$GIT_REPO_URL"

# Done
cat <<EOF

Dev cluster up. Same substrate as prod, minus Longhorn + GPU stack.

  kubectl get nodes                       # 1 server + 2 agents, env=dev label
  kubectl -n argocd get applications      # ArgoCD reconciling app-of-apps
  kubectl -n argocd port-forward svc/argocd-server 8443:443
  open https://localhost:8443             # ArgoCD UI (initial password below)

  kubectl -n argocd get secret argocd-initial-admin-secret \\
    -o jsonpath='{.data.password}' | base64 -d ; echo

Tear down: ./down.sh
EOF
