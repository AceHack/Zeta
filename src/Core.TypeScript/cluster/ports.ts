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

/** CNI the kind provider installs. k3d always uses Cilium; this flag is kind-only. */
export type KindCni = "kindnetd" | "cilium";

/**
 * Does this substrate already own the CNI slot with Cilium?
 *
 * k3d always does (flannel + kube-proxy disabled in the profile). kind does
 * only when `--cni cilium` selected the no-default-CNI profile. An unknown
 * provider lifts nothing.
 */
export function ciliumOwnsCniSlot(
  provider: "kind" | "k3d" | null,
  kindCni: KindCni = "kindnetd",
): boolean {
  if (provider === "k3d") return true;
  return provider === "kind" && kindCni === "cilium";
}

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
  /**
   * Same `serverSideApply` door as `applyFileManifest`. Defaults false.
   *
   * MEASURED live-k3d / live-kind-included 33821540802: `--serve-tree dev`
   * packed the k8s tree at 411676 bytes; `kubectl apply -f -` (client-side)
   * wrote that YAML into `last-applied-configuration` and died
   * `metadata.annotations: Too long: may not be more than 262144 bytes`.
   * The lane-tree ConfigMap is over that ceiling; it must be applied
   * server-side, the same way the kubevirt CRD already is.
   */
  applyInlineManifest(yaml: string, serverSideApply?: boolean): void;
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
  applyRootDevCatalog(
    gitRef: string,
    gitRepoUrl: string,
    provider?: "kind" | "k3d" | null,
    kindCni?: KindCni,
  ): void;
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
  // `game-hosting/gmod/**` ADDED 2026-09-07. A Garry's Mod dedicated server, and the
  // SINGLE LARGEST MEMORY RESERVATION in the dev lane: 2048Mi of a 9216Mi budget
  // — 18% — to prove a Source-engine server loads a map and idles. Its own
  // manifest calls it "a game-server sample workload, not on the PoC critical
  // path". It is not the platform under test.
  //
  // WHY EXCLUDED RATHER THAN SHRUNK, which was tried first and reverted. The dev
  // lane measured 11148Mi against a 9216Mi budget — over by 1932Mi — and gmod is
  // the obvious 2048Mi. But storage-profiles.json had already declined exactly
  // that cut, per app, in writing:
  //
  //   gmod    "MEMORY IS UNCHANGED AT BOTH RUNGS AND DELIBERATELY SO: a map's
  //            working set is real, memory is incompressible, and cutting this
  //            request would trade a Pending pod for an evicted one."
  //   kafka   "an OOMKill here loses the un-consumed tail."
  //   orleans "evicting the silo does not slow the cluster down, it dissolves
  //            the membership the cluster IS."
  //
  // Three reasoned refusals is not an obstacle to route around; it is the
  // answer. The lane does not need a smaller game server, it needs one fewer.
  //
  // MEASURED: this takes the dev lane to 9100Mi, which FITS with 116Mi of spare,
  // and NO REQUEST ANYWHERE CHANGES — so the metal rung, which the committed tree
  // carries and the 16-core box deploys, is untouched. That mattered: applying
  // the dev rung to the tree would have lowered requests for metal too, which
  // argocd-health-test.ts names as "a maintainer call, not a CI convenience".
  //
  // WHAT IS LOST, stated rather than glossed: the lane stops applying and
  // asserting gmod. That assertion is FAILING today anyway — its own record says
  // "gmod did not schedule TODAY because its sync fails on gatekeeper's webhook"
  // — so what is given up is a red assertion, not a green one.
  //
  // SCOPED TO `gmod`, NOT TO `game-hosting`, and the difference is not cosmetic. A
  // directory-level `game-hosting/**` would also hide every FUTURE Application added
  // beside gmod — app-of-apps-discovery.test.ts caught exactly that with a
  // `game-hosting/quake` fixture it expects to be reported as UNASSERTED, and a
  // broader glob swallowed it silently. Excluding one Application must not quietly
  // exclude its unwritten siblings.
  //
  // CARRIED HERE 2026-09-07 from DISCOVERED_BUT_UNASSERTED_REASONS in
  // app-of-apps-discovery.ts, which had to retire its `game-hosting/gmod/Application.yaml`
  // key when this glob stopped applying it -- that map's `stale` direction is keyed on
  // "discovered but unasserted", and an excluded app is no longer discovered. THE DEFECT
  // IT RECORDED IS NOT RETIRED and is written down here so the exclusion does not bury it:
  // gmod FAILS TO SYNC on every reconcile in any lane that does apply it, because
  // gatekeeper's check-ignore-label webhook denies the admission.gatekeeper.sh/ignore label
  // that game-hosting/gmod/namespace.yaml carries -- `game-hosting` is absent from the
  // exemptNamespaces list in applications/open-policy-agent/Application.yaml, where
  // `zeta-platform` is the worked precedent. The fix is a policy change only a live cluster
  // can confirm (081KSXN940008QG0R000SCP2H1), so it stays REGISTERED rather than guessed at.
  // This matters for the LIFTS WHEN below: restoring gmod to a lane restores the sync
  // failure too, so the memory headroom is necessary and NOT sufficient.
  //
  // LIFTS WHEN: the lane has 2048Mi of headroom again — a larger runner, or the
  // metal cluster — at which point gmod returns UNCHANGED, because nothing about
  // it was modified to make it leave.
  excludeGlob:
    "{cilium/**,cilium-lb-ipam/**,longhorn/**,ollama/**,vllm/**,gitlab/**,temporal/**,platform/**,game-hosting/gmod/**}",
};

/**
 * The directories an ArgoCD `directory.exclude` brace-glob defers.
 *
 * ONE parser, exported, because there were two. `storage-profiles.ts` carried
 * an inline copy of this splitting logic and `lane-partition.ts` needed the
 * same answer to union a lane's exclude with the standing deferrals. Two
 * parsers of one constant is the drift shape this repo has already been bitten
 * by — a glob deferring nine directories while a registry reasoned about five,
 * both reporting green.
 *
 * Returns bare directory names (`cilium/**` -> `cilium`). Callers decide
 * whether to match by equality or by prefix; the nested-Application case needs
 * prefix, which is why this does not do the matching itself.
 */
/**
 * The root catalogue's exclude glob FOR A GIVEN PROVIDER.
 *
 * THE SECOND HALF OF A PAIR THAT MUST AGREE. `isExcludedFromIncludedProof`
 * decides what the harness ASSERTS; this decides what ArgoCD APPLIES. Making
 * only the first provider-aware is what produced the 48-minute timeout on
 * 2026-09-01: the harness waited for `cilium` while the catalogue still told
 * ArgoCD to skip it. `applied-vs-asserted-agreement.test.ts` is the check that
 * refuses that disagreement now; this function is what makes agreement possible.
 *
 * `null` (provider unknown) returns the glob unchanged — the conservative
 * default, identical to the behaviour before providers existed here.
 */
export function rootDevCatalogExcludeGlobFor(
  provider: "kind" | "k3d" | null,
  kindCni: KindCni = "kindnetd",
): string {
  if (!ciliumOwnsCniSlot(provider, kindCni)) return DEFAULT_ROOT_DEV_CATALOG.excludeGlob;
  // The substrate already handed the CNI slot to Cilium (k3d profile, or kind
  // `--cni cilium`), which is the condition `cilium`'s own LIFTS WHEN names.
  // Drop it from the exclude so ArgoCD actually syncs what the harness will
  // assert. `cilium-lb-ipam` deliberately stays: its lift is conjunctive and
  // the second conjunct (a substrate-parameterised Application pool) is
  // still false -- kind has a bring-up alias, which is not this Application.
  const kept = excludeGlobDirs(DEFAULT_ROOT_DEV_CATALOG.excludeGlob).filter((d) => d !== "cilium");
  return `{${kept.map((d) => `${d}/**`).join(",")}}`;
}

export function excludeGlobDirs(glob: string): readonly string[] {
  return [
    ...new Set(
      glob
        .replace(/^\{/, "")
        .replace(/\}$/, "")
        .split(",")
        .map((entry) => entry.trim().replace(/\/\*\*$/, ""))
        .filter((entry) => entry.length > 0),
    ),
  ];
}

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
