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

export interface CommandResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly signal?: NodeJS.Signals | null;
}

/** Lowest adapter seam — never referenced from use-case orchestration. */
export interface ProcessRunner {
  run(
    argv0: string,
    args: readonly string[],
    options?: {
      cwd?: string;
      env?: NodeJS.ProcessEnv;
      timeoutMs?: number;
      stdin?: string;
      stdio?: "inherit" | "pipe" | "ignore";
    },
  ): CommandResult;
}

export type ContainerHostKind = "docker" | "podman";

/** OCI-compatible container runtime backing node VMs. */
export interface ContainerHost {
  readonly kind: ContainerHostKind;
  probe(): boolean;
  /** Extra env vars local-cluster adapters may need (e.g. kind + podman). */
  clusterDriverEnv(): NodeJS.ProcessEnv | undefined;
}

export type LocalClusterShape = "kind-in-docker" | "k3d-in-docker";

export interface LocalClusterCreateSpec {
  readonly name: string;
  readonly configPath: string;
  readonly waitForReady?: boolean;
  readonly waitTimeoutSec?: number;
}

/** Lifecycle for a multi-node cluster on a container host. */
export interface LocalClusterDriver {
  readonly shape: LocalClusterShape;
  list(): readonly string[];
  create(spec: LocalClusterCreateSpec): void;
  delete(name: string): void;
  contextName(clusterName: string): string;
  mergeCredentials?(clusterName: string): void;
  registryName?(clusterName: string): string | null;
  deleteRegistry?(clusterName: string): void;
}

/** Cluster API admin — apply manifests, wait for readiness (kubectl-shaped today). */
export interface ClusterControlPlane {
  selectContext(context: string): void;
  waitForAllNodesReady(timeoutSec: number): void;
  waitForApiReady(maxAttempts: number, pollMs: number): void;
  applyRemoteManifest(url: string, serverSideApply?: boolean): void;
  applyFileManifest(path: string): void;
  applyInlineManifest(yaml: string): void;
  ensureNamespace(name: string): void;
  waitForCrdEstablished(crdName: string, timeoutSec: number, optional?: boolean): void;
  clearContextIfCurrent(context: string): void;
}

export interface ChartInstallSpec {
  readonly release: string;
  readonly chart: string;
  readonly version: string;
  readonly namespace: string;
  readonly repoAlias?: string;
  readonly repoUrl?: string;
  readonly setValues: readonly string[];
  readonly wait?: boolean;
}

/** Declarative package/chart reconciliation. */
export interface PackageDriver {
  releaseInstalled(namespace: string, release: string): boolean;
  addRepo(alias: string, url: string): void;
  updateRepo(alias: string): void;
  install(spec: ChartInstallSpec): void;
}

/** Git-backed app-of-apps bootstrap for dev/CI. */
export interface AppCatalogApplicator {
  applyRootDevCatalog(gitRef: string, gitRepoUrl: string): void;
}

export interface DevClusterPorts {
  readonly process: ProcessRunner;
  readonly containerHost: ContainerHost;
  readonly localCluster: LocalClusterDriver;
  readonly controlPlane: ClusterControlPlane;
  readonly packages: PackageDriver;
  readonly appCatalog: AppCatalogApplicator;
}

export interface RootDevCatalogSpec {
  readonly gitRef: string;
  readonly gitRepoUrl: string;
  readonly applicationsPath: string;
  readonly excludeGlob: string;
}

export const DEFAULT_ROOT_DEV_CATALOG: RootDevCatalogSpec = {
  gitRef: "main",
  gitRepoUrl: process.env.ZETA_ARGOCD_GIT_REPO_URL ?? "https://github.com/Lucent-Financial-Group/Zeta",
  applicationsPath: "full-ai-cluster/k8s/applications",
  excludeGlob:
    "{cilium/**,cilium-lb-ipam/**,longhorn/**,ollama/**,vllm/**,deepseek-coder/**,qwen-coder/**,gitlab/**,orleans/**,temporal/**,agent-memory/**,platform/**}",
};

export function buildRootDevCatalogManifest(spec: RootDevCatalogSpec): string {
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
