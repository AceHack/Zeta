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
  /**
   * `serverSideApply` is not a nicety. The vendored `kubevirts.kubevirt.io` CRD
   * serialises to 238350 bytes -- 91% of the 262144-byte ceiling on the
   * `last-applied-configuration` annotation a CLIENT-side apply writes. It fits
   * today and would stop fitting on an upstream bump, and the failure would look
   * like "KubeVirt cannot be installed here". It is also what the Application
   * itself declares (`syncOptions: [ ServerSideApply=true ]`), so a proof of
   * those bytes has to apply them the same way ArgoCD does or it is proving a
   * different thing. Defaults false: existing callers are unchanged.
   */
  applyFileManifest(path: string, serverSideApply?: boolean): void;
  applyInlineManifest(yaml: string): void;
  ensureNamespace(name: string): void;
  /**
   * Is one named object present? Read-only, and the ONLY read on this port.
   *
   * It exists so a bring-up step can be idempotent without being destructive.
   * The dev Grafana admin Secret is minted with fresh entropy per cluster; a
   * bare `apply` would therefore ROTATE the credential every time a bring-up
   * ran against an already-standing cluster, which is churn nobody asked for
   * and would look, from Grafana's side, like a password that silently changed.
   * Asking first makes re-running the bring-up a genuine no-op.
   *
   * Returns a boolean rather than exiting, like `waitForResource` and unlike
   * everything else here: "not there" is an ANSWER, not a failure. A caller
   * that wants absence to be fatal says so itself.
   */
  resourceExists(resourceRef: string, namespace: string | null): boolean;
  waitForCrdEstablished(crdName: string, timeoutSec: number, optional?: boolean): void;
  clearContextIfCurrent(context: string): void;
  /**
   * Merge-patch one already-applied object. Separate from `applyFileManifest`
   * on purpose: a patch is how a lane adapts a manifest it must NOT edit --
   * `full-ai-cluster/k8s/applications/kubevirt/kubevirt-cr.yaml` is captured
   * verbatim from node-5b2dfa and staying verbatim is the point, so the CI-only
   * `useEmulation` flip is applied on top rather than forked into a second copy.
   */
  mergePatch(resourceRef: string, namespace: string | null, patchJson: string): void;
  /**
   * Wait for one object to satisfy a `kubectl wait --for=` expression.
   *
   * Returns a boolean rather than exiting, unlike every other method on this
   * port. The virt proof runs two INDEPENDENT phases (CDI, then KubeVirt) and
   * has to report each one; exiting on the first failure would report "CDI is
   * broken" as "the lane is broken" and hide whichever phase never ran.
   */
  waitForResource(
    resourceRef: string,
    namespace: string | null,
    forExpression: string,
    timeoutSec: number,
  ): boolean;
}

export interface ChartInstallSpec {
  readonly release: string;
  readonly chart: string;
  readonly version: string;
  readonly namespace: string;
  readonly repoAlias?: string;
  readonly repoUrl?: string;
  readonly setValues: readonly string[];
  /**
   * `-f` values files, applied in order AFTER the chart defaults and BEFORE
   * `setValues`. Exists because the Cilium kind lane installs the checked-in
   * `valuesObject` verbatim, and flattening a nested value tree into `--set`
   * strings is lossy in exactly the places that matter (lists, nested maps) --
   * which would quietly make the tested configuration differ from the shipped
   * one, the failure that lane exists to avoid.
   */
  readonly valuesFiles?: readonly string[];
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

/**
 * What the dev/CI app-of-apps root NEVER APPLIES. Ground truth for "what
 * reaches the cluster" -- `argocd-health-test.ts` derives its view of the
 * applied set from this string rather than restating it.
 *
 * A directory belongs here when applying it to a kind/k3d CI cluster would
 * fail or would cost substrate the lane does not have. It does NOT belong here
 * merely because the workload is scaled to zero or is aspirational: an
 * Application whose declared resources all reconcile is a real Synced+Healthy
 * proof of the manifests, and excluding it buys nothing while hiding whether
 * the manifests still parse and apply.
 *
 * 2026-08-21 (081M0JXXFV0087G0R001PGEEM4): `deepseek-coder`, `qwen-coder` and
 * `orleans` were removed from this glob. Measured, not assumed -- see
 * `docs/research/2026-08-21-what-each-deferred-argocd-application-needs-to-boot.md`:
 * the first two render exactly one Namespace + one ConfigMap between them (no
 * image, no PVC, no GPU, no CRD), and `orleans` renders Namespace + SA + Role +
 * RoleBinding + ConfigMap + 3 Services + a StatefulSet at `replicas: 0`. They
 * were swept up by a blanket "GPU / local-models" and "deferred until dev
 * wiring" label that never matched what the manifests actually ask for.
 */
export const DEFAULT_ROOT_DEV_CATALOG: RootDevCatalogSpec = {
  gitRef: "main",
  gitRepoUrl: process.env.ZETA_ARGOCD_GIT_REPO_URL ?? "https://github.com/Lucent-Financial-Group/Zeta",
  applicationsPath: "full-ai-cluster/k8s/applications",
  excludeGlob:
    "{cilium/**,cilium-lb-ipam/**,longhorn/**,ollama/**,vllm/**,gitlab/**,temporal/**,agent-memory/**,platform/**}",
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
