// Hexagonal ports for local cluster bring-up — vendor-neutral CS vocabulary.
//
// Dependency categories (we own the interface; adapters own the tool):
//
// | Category          | Port                  | Today (adapter)     | Future (adapter)        |
// |-------------------|-----------------------|---------------------|-------------------------|
// | container-host    | ContainerHost         | docker, podman      | Zeta node runtime       |
// | local-cluster     | LocalClusterDriver    | kind-in-docker,     | Zeta local cluster      |
// |                   |                       | k3d-in-docker       |                         |
// | control-plane     | ClusterControlPlane   | kubectl-shaped CLI  | Zeta cluster API        |
// | package-driver    | PackageDriver         | helm                | Zeta package reconciler |
// | app-catalog       | AppCatalogApplicator  | gitops via CP apply | Zeta catalog controller |
// | process-spawn     | ProcessRunner         | node:child_process  | (adapter-only seam)       |
//
// Use cases MUST depend on these ports only — never import kind/k3d/kubectl/helm by name.
export const DEFAULT_ROOT_DEV_CATALOG = {
    gitRef: "main",
    gitRepoUrl: process.env.ZETA_ARGOCD_GIT_REPO_URL ?? "https://github.com/Lucent-Financial-Group/Zeta",
    applicationsPath: "full-ai-cluster/k8s/applications",
    excludeGlob: "{cilium/**,cilium-lb-ipam/**,longhorn/**,ollama/**,vllm/**,deepseek-coder/**,qwen-coder/**,gitlab/**,orleans/**,temporal/**,agent-memory/**,platform/**}",
};
export function buildRootDevCatalogManifest(spec) {
    return `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: zeta-root-dev
  namespace: argocd
  finalizers:
    - resources-finalizer.argocd.argoproj.io
spec:
  project: default
  source:
    repoURL: ${spec.gitRepoUrl}
    targetRevision: ${spec.gitRef}
    path: ${spec.applicationsPath}
    directory:
      recurse: true
      include: '{*/Application.yaml,Application.yaml}'
      exclude: '${spec.excludeGlob}'
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
`;
}
