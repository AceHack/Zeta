#!/usr/bin/env bash
# full-ai-cluster/dev-cluster/apply-root-app.sh
#
# Apply the dev/CI root App-of-Apps against the current kubectl context.

set -euo pipefail

GIT_REF="${1:-main}"
GIT_REPO_URL="${2:-${ZETA_ARGOCD_GIT_REPO_URL:-https://github.com/Lucent-Financial-Group/Zeta}}"

case "$GIT_REF" in
  *[!a-zA-Z0-9._/-]* | ''|/*|*/|*//*)
    echo "ERROR: git-ref must match [a-zA-Z0-9._/-]+ (got: '${GIT_REF}')" >&2
    exit 1 ;;
esac

if ! [[ "$GIT_REPO_URL" =~ ^https://github\.com/[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+(\.git)?$ ]]; then
  echo "ERROR: git repo URL must be an https://github.com/<owner>/<repo> URL (got: '${GIT_REPO_URL}')" >&2
  exit 1
fi

echo "Applying root App-of-Apps (git repo: ${GIT_REPO_URL}, git ref: ${GIT_REF}) ..."
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
    repoURL: ${GIT_REPO_URL}
    targetRevision: ${GIT_REF}
    path: full-ai-cluster/k8s/applications
    directory:
      recurse: true
      include: '{*/Application.yaml,Application.yaml}'
      # Skip apps that don't belong in dev/CI:
      #   cilium/**  - k3d dev installs Cilium directly via Helm with
      #                cluster-specific values; kind CI keeps its default CNI.
      #                The cilium/Application.yaml under k8s/applications/
      #                targets prod config and would clobber either substrate.
      #   longhorn/** - no second NVMe to replicate to in dev/CI;
      #                local-path-provisioner handles PVCs.
      #   ollama / vllm / deepseek-coder / qwen-coder - GPU stack;
      #                no GPUs on the Mac or on normal CI runners.
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
