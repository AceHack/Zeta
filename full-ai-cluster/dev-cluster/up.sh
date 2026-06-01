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
#
# git-ref defaults to `main`. Pass a PR branch to dev-test before
# merging:
#   ./up.sh feat/my-branch-2026-05-25

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
GIT_REF="${1:-main}"

# Reject git refs that aren't safe to interpolate into the heredoc
# below. Branch names, tags, and SHAs all fit a narrow charset.
# Anything with whitespace / newlines / YAML metacharacters gets
# rejected — otherwise a creative ref name could inject extra YAML
# keys into the Application spec.
case "$GIT_REF" in
  *[!a-zA-Z0-9._/-]* | ''|/*|*/|*//*)
    echo "ERROR: git-ref must match [a-zA-Z0-9._/-]+ (got: '${GIT_REF}')" >&2
    exit 1 ;;
esac
# ── Pre-flight ────────────────────────────────────────────────
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

# ── Step 1: k3d cluster ───────────────────────────────────────
if k3d cluster list 2>/dev/null | grep -q '^zeta-dev '; then
  echo "Cluster zeta-dev already exists. Use ./down.sh to recreate."
else
  echo "Creating k3d cluster zeta-dev ..."
  k3d cluster create --config "${SCRIPT_DIR}/k3d-config.yaml"
fi

kubectl config use-context k3d-zeta-dev

# ── Step 2: Cilium CNI (chicken-and-egg — without this, no pods
# schedule because flannel/kube-proxy are disabled) ───────────
# Version kept aligned with full-ai-cluster/k8s/bootstrap/cilium-install.yaml
# so dev exercises the same chart that lands in prod.
if ! helm -n kube-system status cilium >/dev/null 2>&1; then
  echo "Installing Cilium ..."
  helm repo add cilium https://helm.cilium.io >/dev/null 2>&1 || true
  helm repo update cilium >/dev/null
  helm install cilium cilium/cilium \
    --version 1.16.5 \
    --namespace kube-system \
    --set kubeProxyReplacement=true \
    --set k8sServiceHost=k3d-zeta-dev-server-0 \
    --set k8sServicePort=6443 \
    --set hubble.enabled=true \
    --set hubble.relay.enabled=true \
    --set hubble.ui.enabled=true \
    --set ipam.mode=kubernetes \
    --wait
fi

# ── Step 3: ArgoCD ────────────────────────────────────────────
# Helm release check (vs `kubectl get ns argocd`) — namespace
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

# ── Step 4: root App-of-Apps pointing at this repo ────────────
# Uses GIT_REF so dev can pin to a feature branch.
echo "Applying root App-of-Apps (git ref: ${GIT_REF}) ..."
cat <<EOF | kubectl apply -f -
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: zeta-root-dev
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: https://github.com/Lucent-Financial-Group/Zeta
    targetRevision: ${GIT_REF}
    path: full-ai-cluster/k8s/applications
    directory:
      recurse: true
      include: '{*/Application.yaml,Application.yaml}'
      # Skip apps that don't belong in dev:
      #   cilium/**  — up.sh already installed Cilium directly via
      #                Helm with dev-cluster-specific values
      #                (kubeProxyReplacement, k3d-zeta-dev API host).
      #                The cilium/Application.yaml under
      #                k8s/applications/ targets PROD config
      #                (k8sServiceHost: control-plane.zeta.local) and
      #                would clobber the dev install.
      #   longhorn/** — no second NVMe to replicate to in dev;
      #                local-path-provisioner handles PVCs.
      #   ollama / vllm / deepseek-coder / qwen-coder — GPU stack;
      #                no GPUs on the Mac (or on CI runners).
      exclude: '{cilium/**,longhorn/**,ollama/**,vllm/**,deepseek-coder/**,qwen-coder/**}'
  destination:
    server: https://kubernetes.default.svc
    namespace: argocd
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    syncOptions:
      - CreateNamespace=true
      - ServerSideApply=true
EOF

# ── Done ──────────────────────────────────────────────────────
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
