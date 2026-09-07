import { randomBytes } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ciliumK3dValues,
  ciliumKindValues,
  readCiliumValueSurfaces,
  renderValuesYaml,
  shippedCiliumChartVersion,
  CILIUM_CHART_REPO,
  GATEWAY_API_CRD_BUNDLE,
} from "../cilium-kind-lane.ts";
import type { DevClusterPorts, KindCni } from "../ports.ts";
import {
  buildDevAdminSecretManifest,
  buildDevSharedSecretManifest,
  buildDevRegistryPullSecretManifest,
  DEV_BOOTSTRAP_SECRETS,
  DEV_SHARED_SECRETS,
  DEV_CILIUM_LB_KIND_CRDS,
  DEV_GHCR_PULL_SECRET,
  devCiliumLbKindManifestPath,
  devStorageAliasManifestPath,
  resolveRegistryToken,
  REPO_ROOT,
} from "./lib.ts";
import { CHART_ROTATION_CONSTRAINTS } from "../chart-rotation-conformance.ts";
import { SERVED_GIT_REF } from "../lane-tree-source.ts";

/**
 * Apply the dev/CI alias StorageClasses, BEFORE the app-of-apps root syncs.
 *
 * Order is load-bearing: a PVC created by a synced Application before its class
 * exists sits `Pending` and only a `WaitForFirstConsumer` retry saves it. Both
 * aliases bind to `rancher.io/local-path`, the provisioner kind and k3s already
 * run -- this declares NAMES, never a second provisioner Deployment.
 *
 * Shared by the kind and k3d bring-ups on purpose. `isExcludedFromIncludedProof`
 * is provider-independent, so if only one provider created the `longhorn` alias
 * the harness would assert longhorn-backed Applications on a substrate that
 * cannot bind them, and they would hang `Pending` instead of failing.
 *
 * EXPORTED because `apply-root-app.ts` is a THIRD entrypoint that applies the
 * root catalogue without going through either bring-up. Left alone it would
 * sync longhorn-backed Applications into a cluster with no such class -- the
 * same hazard, reached by a door the bring-up falsifiers do not watch.
 */
export function applyDevStorageClassAliases(ports: DevClusterPorts): void {
  console.log("Ensuring dev/CI alias StorageClasses (zeta-local-path, longhorn) ...");
  ports.controlPlane.applyFileManifest(devStorageAliasManifestPath("zetaLocalPath"));
  ports.controlPlane.applyFileManifest(devStorageAliasManifestPath("longhorn"));
}

/**
 * Apply the kind/CI Cilium LB-IPAM pool, AFTER Cilium helm, BEFORE the catalogue.
 *
 * Same shape as `applyDevStorageClassAliases`: a name the workloads already
 * ask for (`type: LoadBalancer`), answered by a substrate object ArgoCD never
 * reads. Different from the StorageClass aliases in TWO ways that are load-
 * bearing, not tidy:
 *
 *   1. KIND `--cni cilium` ONLY. kindnetd has no Cilium CRDs. k3d helm-installs
 *      Cilium too, but its docker network is not this range -- applying the kind
 *      pool there is the same class of defect as applying the metal 192.168.1.x
 *      pool on kind. k3d is a follow-up, not this helper.
 *   2. CRDs FIRST. The pool is a Cilium CR. Helm `wait: true` is pods, not CRDs.
 *
 * NOT called from `apply-root-app.ts`. That entrypoint does not know the CNI,
 * and applying these CRs on kindnetd is a NotFound. The kind `--cni cilium`
 * bring-up is the door that created the cluster; it is the door that applies
 * the pool.
 */
export function applyDevCiliumLbKindAlias(ports: DevClusterPorts): void {
  console.log("Ensuring kind Cilium LB-IPAM pool (not the metal 192.168.1.x subnet) ...");
  for (const crd of DEV_CILIUM_LB_KIND_CRDS) {
    ports.controlPlane.waitForCrdEstablished(crd, 120);
  }
  ports.controlPlane.applyFileManifest(devCiliumLbKindManifestPath());
}

/**
 * Apply the vendored Gateway API CRD bundle metal first-boot applies as
 * `aa-gateway-api-crds`. Cilium does NOT ship these. cert-manager with
 * `enableGatewayAPI: true` crash-loops without them:
 *
 *     the Gateway API CRDs do not seem to be present, but
 *     ExperimentalGatewayAPISupport is set to true
 *
 * MEASURED k3d included lift run 33429761222 (job 99614682092): cert-manager
 * controller CrashLoopBackOff (17 restarts) on that line; trust-manager then
 * FailedMount on `trust-manager-tls`; openziti Init FailedMount on missing
 * ziti identity secrets. Kind `--cni cilium` already applies this file.
 * k3d skipped it. Kindnetd still uses the GitHub remote.
 *
 * BEFORE Cilium helm and BEFORE the catalogue. Metal's `aa-` prefix is the
 * same ordering intent. Shared by kind `--cni cilium` and k3d so the two
 * Cilium lanes cannot drift on which file they apply.
 */
export function applyVendoredGatewayApiCrds(ports: DevClusterPorts): void {
  console.log("Applying the VENDORED Gateway API CRD bundle (the same file first boot applies on metal) ...");
  ports.controlPlane.applyFileManifest(join(REPO_ROOT, GATEWAY_API_CRD_BUNDLE));
}

/**
 * Map `control-plane` to 127.0.0.1 on the k3d SERVER node.
 *
 * Metal `k3s-server.nix` does this on the founder (`networking.hosts."127.0.0.1"
 * = [ "control-plane" ]`) so Cilium can reach the API at the Application's
 * `k8sServiceHost: control-plane`. k3d skipped it. Helm install deltas that
 * host to the Docker DNS name; ArgoCD's cilium Application (included on k3d)
 * then wants the metal name back. Without this mapping the agent cannot dial
 * the API after that adopt.
 *
 * SERVER ONLY. The same mapping on an agent is the joining-node defect
 * k3s-server.nix refuses: control-plane would resolve to the agent itself.
 * `kubeApiHost` is `k3d-<cluster>-server-0`, the founder container.
 *
 * Idempotent: second bring-up against an existing cluster must not duplicate
 * the line. YAML `hostAliases` on the CI profile (agents: 0) is the create-time
 * twin; this call covers the existing-cluster path and the three-node local
 * profile, which must not put 127.0.0.1 on agents.
 */
export function applyK3dControlPlaneHostsAlias(ports: DevClusterPorts, kubeApiHost: string): void {
  console.log("Mapping control-plane -> 127.0.0.1 on the k3d server node (metal k3s-server.nix founder hosts) ...");
  const script =
    "grep -qE '(^|[[:space:]])control-plane($|[[:space:]])' /etc/hosts || echo '127.0.0.1 control-plane' >> /etc/hosts";
  ports.process.run("docker", ["exec", kubeApiHost, "sh", "-c", script], { timeoutMs: 30_000 });
}

/**
 * Mint the dev/CI credentials that Applications expect to find ALREADY PRESENT,
 * BEFORE the app-of-apps root syncs.
 *
 * THREE Secrets today, all listed in `DEV_BOOTSTRAP_SECRETS`, all for the same
 * structural reason: the Application deliberately does not let its chart invent
 * an admin password (so none is committed here), and nothing in the dev lane
 * ever supplied one.
 *
 *   `monitoring/grafana-admin-credentials` -- kube-prometheus-stack points
 *      Grafana at `grafana.admin.existingSecret`. Without it Grafana sat in
 *      `CreateContainerConfigError` (`secret "grafana-admin-credentials" not
 *      found`) while the rest of the Application -- prometheus and
 *      alertmanager, both on bound PVCs -- ran 2/2.
 *   `openziti/ziti-admin-credentials` -- ziti-controller reads `admin-user` /
 *      `admin-password` by `secretKeyRef` because the Application sets
 *      `useCustomAdminSecret: true`. Its chart's generated fallback is guarded
 *      off by that same value, and turning the fallback back on is NOT the
 *      cheaper fix: it renders a fresh random password on every `helm template`
 *      (ArgoCD's repo-server has no cluster for the chart's `lookup` to hit),
 *      which under `selfHeal: true` rotates the credential forever. See
 *      `DEV_ZITI_ADMIN_SECRET` for the measurement.
 *   `redis/redis-auth` -- Valkey `auth.usersExistingSecret`. Without it the
 *      included proof reported `redis is OutOfSync/Progressing` (run
 *      33657954802). Same Progressing-not-Degraded class as the two above.
 *
 * ORDER IS LOAD-BEARING for the same reason the StorageClass aliases are:
 * kubelet resolves `envFrom`/`env.valueFrom` at container-create time and a
 * missing Secret is a hard config error, so the Secret has to exist before the
 * Application that consumes it syncs.
 *
 * `ensureNamespace` IS NOT INCIDENTAL for `openziti`. trust-manager's trust
 * namespace is now that namespace, and its Role over Secrets is created there
 * at sync-wave -45 -- forty-five waves before `oz` would have created it with
 * `CreateNamespace=true`. So this call is also what keeps trust-manager's own
 * sync from failing in the dev lane. On metal the same job is done declaratively
 * by `k8s/bootstrap/openziti-namespace.yaml`.
 *
 * THE PASSWORDS ARE DRAWN FRESH PER CLUSTER, never committed and never printed.
 * A well-known constant would also have worked and would have been simpler; a
 * drawn one cannot be promoted to a real deployment by anybody copying it,
 * because there is nothing to copy. This is the ONLY place entropy enters --
 * `buildDevAdminSecretManifest` is pure and takes the value.
 *
 * AND IT IS IDEMPOTENT BY ASKING FIRST, PER SECRET. Re-running a bring-up
 * against a cluster that already exists is a supported path (both bring-ups say
 * so), and a bare apply would rotate an admin password every time.
 * `resourceExists` makes the second run a no-op for each Secret independently,
 * so a cluster holding one and missing the other converges rather than
 * re-rolling the one it already had.
 *
 * EXPORTED for the same reason `applyDevStorageClassAliases` is: `apply-root-app.ts`
 * is a third door into the root catalogue that neither bring-up guards.
 */
export function applyDevBootstrapSecrets(ports: DevClusterPorts): void {
  for (const spec of DEV_BOOTSTRAP_SECRETS) {
    const { namespace, name } = spec;
    const ref = `secret/${name}`;
    ports.controlPlane.ensureNamespace(namespace);
    if (ports.controlPlane.resourceExists(ref, namespace)) {
      console.log(`Dev/CI credential ${namespace}/${name} already present; leaving it alone.`);
      continue;
    }
    console.log(`Minting dev/CI credential ${namespace}/${name} (value is per-cluster and never logged) ...`);
    ports.controlPlane.applyInlineManifest(buildDevAdminSecretManifest(spec, randomBytes(24).toString("base64url")));
  }
  applyDevSharedSecrets(ports);
}

/**
 * Mint the SHARED credentials -- one drawn value, several namespaces.
 *
 * THE DRAW IS OUTSIDE THE NAMESPACE LOOP, and that placement is the entire point. A producer
 * and its consumers must present the SAME string; drawing per namespace would mint three
 * different values and leave two services authenticating with a key the store does not know.
 * `applyDevBootstrapSecrets` draws per spec because each of those credentials has exactly one
 * consumer -- correct there, wrong here (081M1S6Z5S3087G0R000GEPSS2).
 *
 * ALL-OR-NOTHING ON RE-RUN, which is the subtle half. If ANY namespace already holds the
 * Secret the whole spec is skipped, because a partial mint is the failure this exists to
 * prevent: filling in the two missing namespaces with a FRESH draw would leave the third
 * holding the old value, and the mismatch would surface as an S3 auth error days later rather
 * than as a refusal now.
 */
/**
 * What a rotation did, and -- as loudly -- what it did NOT do.
 *
 * `restartRequired` is ADVISORY and the field name is the honest one: this
 * process cannot perform it. `ClusterControlPlane` exposes `applyInlineManifest`,
 * `ensureNamespace` and `resourceExists` and nothing that rolls a workload, so a
 * rotation here swaps the stored bytes and stops. Reporting the restart without
 * naming it as un-performed would be the exact failure this repo keeps finding:
 * an operation that reads as complete while the running service still presents
 * the credential it was started with.
 */
export interface CredentialRotation {
  /** `namespace/name`, or for a shared credential just `name`. */
  readonly credential: string;
  readonly rotated: boolean;
  /**
   * ALWAYS false, and typed as the literal so it cannot quietly become true.
   *
   * `docs/DECISIONS/2026-06-15-zero-downtime-id-rotation-pattern-overlap-window-dual-key.md`
   * wants old and new valid together, then a retirement. A Kubernetes Secret
   * holding ONE password under ONE key cannot express that, and every chart in
   * `CHART_ROTATION_CONSTRAINTS` reads exactly one -- see that register for which
   * ones could be fixed upstream and which are single-by-design. So this verb
   * does a REPLACE, and says so rather than claiming an overlap it did not open.
   */
  readonly overlapWindow: false;
  /** Workloads that keep the OLD credential until something restarts them. */
  readonly restartRequired: readonly string[];
  /** Set when nothing was rotated. Mutually exclusive with `rotated`. */
  readonly refusal?: string;
}

/**
 * Rotate ONE dev/CI credential, by name, deliberately.
 *
 * -- WHY THIS IS A SEPARATE VERB, AND TAKES A TARGET ------------------------
 * `applyDevBootstrapSecrets` is mint-if-absent and must stay that way: a bare
 * apply on every bring-up would re-roll an admin password under a running
 * service, which `use-cases.test.ts` pins with "a second bring-up ... does NOT
 * rotate them". Rotation is therefore the OTHER verb, and it is deliberately
 * awkward to invoke in bulk -- it takes one credential, never a roster and never
 * an "all". The blast radius is chosen by the caller, in writing, per call.
 *
 * -- ROTATION IS NOT A MINT, AND REFUSES TO BECOME ONE ----------------------
 * A rotation against a credential the cluster does not hold is a MINT wearing a
 * rotation's name: the operator asked to replace something and would instead
 * have created it, learning nothing about the missing original. That is refused.
 * Rotating a name absent from the roster is refused for the same reason -- a
 * typo would otherwise mint an unreferenced Secret nobody consumes, which is the
 * "credential with no consumer" that `audit-existing-secret-is-minted` exists to
 * catch, arriving through a door that audit does not watch.
 *
 * -- SHARED CREDENTIALS ROTATE EVERYWHERE OR NOWHERE ------------------------
 * The all-or-nothing rule `applyDevSharedSecrets` states for minting binds
 * harder here. One value spans several namespaces; rotating a subset leaves the
 * rest presenting a key the store no longer knows, and that surfaces as an auth
 * error days later rather than as a refusal now. The draw stays OUTSIDE the
 * namespace loop for the same reason it does there.
 */
export function rotateDevCredential(ports: DevClusterPorts, target: string): CredentialRotation {
  const shared = DEV_SHARED_SECRETS.find((spec) => spec.name === target);
  if (shared !== undefined) {
    const missing = shared.namespaces.filter(
      (ns) => !ports.controlPlane.resourceExists(`secret/${shared.name}`, ns),
    );
    if (missing.length > 0) {
      return {
        credential: shared.name,
        rotated: false,
        overlapWindow: false,
        restartRequired: [],
        refusal:
          `refusing to rotate ${shared.name}: absent from ${missing.join(", ")}. ` +
          "A shared credential rotates in every namespace or in none -- a partial rotation " +
          "leaves consumers presenting a key the producer no longer knows.",
      };
    }
    // ONE draw for every namespace. See applyDevSharedSecrets: drawing per
    // namespace is the defect this placement prevents.
    const value = randomBytes(24).toString("base64url");
    for (const ns of shared.namespaces) {
      ports.controlPlane.applyInlineManifest(buildDevSharedSecretManifest(shared, ns, value));
    }
    return {
      credential: shared.name,
      rotated: true,
      overlapWindow: false,
      restartRequired: consumersOf(shared.name),
    };
  }

  const spec = DEV_BOOTSTRAP_SECRETS.find((entry) => `${entry.namespace}/${entry.name}` === target);
  if (spec === undefined) {
    return {
      credential: target,
      rotated: false,
      overlapWindow: false,
      restartRequired: [],
      refusal:
        `refusing to rotate ${target}: not a known dev credential. ` +
        "Rotation never mints -- an unrecognised name would create a Secret no Application reads.",
    };
  }

  if (!ports.controlPlane.resourceExists(`secret/${spec.name}`, spec.namespace)) {
    return {
      credential: target,
      rotated: false,
      overlapWindow: false,
      restartRequired: [],
      refusal:
        `refusing to rotate ${target}: the cluster does not hold it. ` +
        "Rotation is not a mint; run a bring-up if the credential should exist.",
    };
  }

  console.log(`Rotating dev/CI credential ${target} (new value is per-cluster and never logged) ...`);
  ports.controlPlane.applyInlineManifest(
    buildDevAdminSecretManifest(spec, randomBytes(24).toString("base64url")),
  );
  return {
    credential: target,
    rotated: true,
    overlapWindow: false,
    restartRequired: consumersOf(`${spec.namespace}/${spec.name}`),
  };
}

/**
 * Which Applications keep the old value until restarted.
 *
 * Read from `CHART_ROTATION_CONSTRAINTS` rather than re-listed here, so the
 * consumer of a credential has ONE source. A second hand-written list would
 * drift from the first, and the drift would be invisible: a rotation would
 * simply stop naming a service that still needed restarting.
 */
function consumersOf(credential: string): readonly string[] {
  return CHART_ROTATION_CONSTRAINTS.filter((c) => c.secret === credential).map((c) => c.consumer);
}


export function applyDevSharedSecrets(ports: DevClusterPorts): void {
  for (const spec of DEV_SHARED_SECRETS) {
    const ref = `secret/${spec.name}`;
    for (const namespace of spec.namespaces) ports.controlPlane.ensureNamespace(namespace);

    const present = spec.namespaces.filter((ns) => ports.controlPlane.resourceExists(ref, ns));
    if (present.length > 0) {
      console.log(
        `Dev/CI shared credential ${spec.name} already present in ${present.join(", ")}; leaving the whole set alone ` +
          `(a partial re-mint would give the namespaces DIFFERENT values).`,
      );
      continue;
    }
    console.log(
      `Minting dev/CI shared credential ${spec.name} into ${spec.namespaces.join(", ")} ` +
        `(one value, per-cluster, never logged) ...`,
    );
    const value = randomBytes(24).toString("base64url");
    for (const namespace of spec.namespaces) {
      ports.controlPlane.applyInlineManifest(buildDevSharedSecretManifest(spec, namespace, value));
    }
  }
}

/**
 * Mint the dev/CI registry pull credential, IF this environment has a token to
 * mint it from.
 *
 * SEPARATE FROM `applyDevBootstrapSecrets` BECAUSE IT CAN LEGITIMATELY DO
 * NOTHING, and that difference is the whole design. The admin credentials are
 * drawn from entropy, so their mint always succeeds and a skip would be a bug.
 * This one needs a token GHCR will honour, and a bring-up on a laptop that has
 * no such token is a normal, supported state -- so the honest outcomes are
 * MINTED or SKIPPED-AND-SAID-SO, never "minted something that will not work".
 *
 * THE THIRD OUTCOME IS THE ONE THIS EXISTS TO REFUSE. A Secret containing an
 * empty or whitespace token is strictly worse than no Secret at all: the
 * kubelet finds it, uses it, GHCR rejects it, and the pod lands in
 * ImagePullBackOff -- the SAME symptom as no credential, with an object sitting
 * in the namespace that makes it look like the credential half is done.
 * `resolveRegistryToken` treats whitespace-only as absent for exactly that
 * reason, and this function skips rather than mints when it returns null.
 *
 * WHAT MAKES THE SKIP SAFE RATHER THAN SILENT: `platform` is currently in
 * `DEFAULT_ROOT_DEV_CATALOG.excludeGlob`, so a cluster without this Secret
 * simply never syncs the Application that needs it. When that deferral lifts,
 * `assertDevRegistryPullSecretPresent` in `argocd-health-test.ts` refuses the
 * run in seconds and NAMES this Secret -- so the skip becomes a loud failure at
 * the moment, and only at the moment, it starts to matter.
 *
 * IDEMPOTENT BY ASKING FIRST, like the admin mint. Re-running a bring-up must
 * not churn a working credential.
 */
export function applyDevRegistryPullSecret(
  ports: DevClusterPorts,
  env: Readonly<Record<string, string | undefined>> = process.env,
): void {
  const spec = DEV_GHCR_PULL_SECRET;
  const { namespace, name, registry, tokenEnvVars } = spec;
  const token = resolveRegistryToken(spec, env);
  if (token === null) {
    console.log(
      `No ${registry} token in this environment (looked at ${tokenEnvVars.join(", ")}); ` +
        `NOT minting ${namespace}/${name}. A Secret holding an empty token is indistinguishable ` +
        `in-cluster from a real one that lacks permission, so none is created. Applications whose ` +
        `images live in ${registry} will not start in this cluster.`,
    );
    return;
  }
  const ref = `secret/${name}`;
  ports.controlPlane.ensureNamespace(namespace);
  if (ports.controlPlane.resourceExists(ref, namespace)) {
    console.log(`Dev/CI registry credential ${namespace}/${name} already present; leaving it alone.`);
    return;
  }
  const username = env[spec.userEnvVar]?.trim() || spec.defaultUser;
  console.log(`Minting dev/CI registry credential ${namespace}/${name} (token is never logged) ...`);
  ports.controlPlane.applyInlineManifest(buildDevRegistryPullSecretManifest(spec, username, token));
}

export interface KindCiBringUpOptions {
  readonly configPath: string;
  readonly clusterName: string;
  readonly gitRef: string;
  readonly gitRepoUrl: string;
  /**
   * CNI the kind cluster uses. Default kindnetd is the existing green
   * baseline. `cilium` uses the no-default-CNI profile and helm-installs
   * the shipped Cilium surface before ArgoCD, so the included proof can
   * create its own cluster instead of attaching with `--existing`
   * (081M1DFQ2MZ).
   */
  readonly cni?: KindCni;
  /**
   * SERVE THE TREE THE LANE SHOULD SYNC, instead of the committed one.
   *
   * The committed tree is the `metal` resource rung, which is correct for the
   * 16-core box it names and is 6390m of requests on the dev lane's 39 apps --
   * against a 4000m runner node. When present, this carries the manifests for an
   * in-cluster read-only git server (built by `lane-tree-source.ts`) plus the URL
   * ArgoCD should clone instead of GitHub. The server is applied and waited on
   * BEFORE the root Application, because a root app pointed at a server that is
   * not yet answering fails its first sync and retries with backoff.
   *
   * `gitRef` is the revision ArgoCD must request FROM THAT SERVER. It is not the
   * GitHub SHA: a 40-hex targetRevision is fetched as an object, and the served
   * commit is a new hash (MEASURED 33822942615). Absent defaults to the bring-up
   * `gitRef`, which is correct only when that value is also a branch the served
   * repo has (local `main`). The harness always sets this to `SERVED_GIT_REF`.
   *
   * Absent -- the default -- leaves every existing caller syncing `gitRepoUrl`
   * exactly as before.
   */
  readonly laneTree?: { readonly manifests: string; readonly repoUrl: string; readonly gitRef?: string };
  /**
   * The environment the registry pull credential is sourced from.
   *
   * DECLARED rather than ambient (manifesto §13 noninterference): this value
   * decides whether `applyDevRegistryPullSecret` MINTS OR SKIPS, so a bring-up
   * reading `process.env` directly would take a different code path depending on
   * whether the host happened to export `GITHUB_TOKEN` -- and the falsifiers in
   * `use-cases.test.ts` would pass or fail on the same commit for the same
   * reason. Entropy for the admin passwords is still drawn ambiently, and that
   * is not the same thing: a drawn value changes what is IN a manifest, this
   * changes WHETHER THERE IS ONE.
   */
  readonly env?: Readonly<Record<string, string | undefined>>;
}

export interface K3dDevBringUpOptions {
  readonly configPath: string;
  readonly clusterName: string;
  readonly agentCount: number;
  readonly kubeApiHost: string;
  readonly gitRef: string;
  readonly gitRepoUrl: string;
  /**
   * Same override as `KindCiBringUpOptions.laneTree`. Absent leaves the
   * committed `metal` tree. GitHub-hosted runners are 4000m; the metal rung is
   * 6390m on the dev lane. `--serve-tree dev` is the runner CPU/memory overlay;
   * metal stays in git for USB/hardware. Disk is a different ladder
   * (`runnerEnvelope` + storage profiles) and is not rewritten here.
   */
  readonly laneTree?: { readonly manifests: string; readonly repoUrl: string; readonly gitRef?: string };
  /**
   * The environment the registry pull credential is sourced from.
   *
   * DECLARED rather than ambient (manifesto §13 noninterference): this value
   * decides whether `applyDevRegistryPullSecret` MINTS OR SKIPS, so a bring-up
   * reading `process.env` directly would take a different code path depending on
   * whether the host happened to export `GITHUB_TOKEN` -- and the falsifiers in
   * `use-cases.test.ts` would pass or fail on the same commit for the same
   * reason. Entropy for the admin passwords is still drawn ambiently, and that
   * is not the same thing: a drawn value changes what is IN a manifest, this
   * changes WHETHER THERE IS ONE.
   */
  readonly env?: Readonly<Record<string, string | undefined>>;
}

export function bringUpKindCiCluster(ports: DevClusterPorts, options: KindCiBringUpOptions): void {
  const { localCluster, controlPlane, packages, appCatalog } = ports;
  const context = localCluster.contextName(options.clusterName);
  const cni: KindCni = options.cni ?? "kindnetd";
  // No default CNI: nodes cannot reach Ready until Cilium is installed.
  // Waiting here would time out every time and blame the wrong thing.
  const waitForReady = cni !== "cilium";

  if (localCluster.list().includes(options.clusterName)) {
    console.log(
      `Cluster ${options.clusterName} already exists. Use bun src/Core.TypeScript/cluster/dev-cluster/kind-down.ts --cluster-name ${options.clusterName} to recreate.`,
    );
  } else {
    console.log(`Creating kind cluster ${options.clusterName} (cni=${cni}) ...`);
    localCluster.create({
      name: options.clusterName,
      configPath: options.configPath,
      waitForReady,
      waitTimeoutSec: 180,
    });
  }

  controlPlane.selectContext(context);
  if (cni === "cilium") {
    console.log("Waiting for Kubernetes API readiness (nodes stay NotReady until Cilium is the CNI) ...");
    controlPlane.waitForApiReady(60, 3000);
    applyVendoredGatewayApiCrds(ports);
    installShippedCiliumOnKind(ports, options.clusterName);
    controlPlane.waitForAllNodesReady(180);
    applyDevCiliumLbKindAlias(ports);
    applyKindCiliumCoreDnsUpstreamOverride(ports);
  } else {
    controlPlane.waitForAllNodesReady(180);
    console.log(
      "Installing Gateway API CRDs (cert-manager enableGatewayAPI on kindnetd; k3d applies the vendored metal bundle) ...",
    );
    controlPlane.applyRemoteManifest(
      "https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.2.0/standard-install.yaml",
      true,
    );
  }

  applyDevStorageClassAliases(ports);
  applyDevBootstrapSecrets(ports);
  applyDevRegistryPullSecret(ports, options.env ?? process.env);

  if (!packages.releaseInstalled("argocd", "argocd")) {
    console.log("Installing ArgoCD ...");
    controlPlane.ensureNamespace("argocd");
    packages.addRepo("argo", "https://argoproj.github.io/argo-helm");
    packages.updateRepo("argo");
    packages.install({
      release: "argocd",
      chart: "argo/argo-cd",
      // 7.7.10 -> 10.7.0 on 2026-09-03 (ArgoCD v2.13.2 -> v3.5.2). NOT cosmetic, and NOT
      // "match the Application": v3.5.x is the first ArgoCD that ships Helm 4 ONLY
      // (hack/tool-versions.sh: helm4_version=4.2.1; util/helm/cmd.go: "We now support
      // v4 only"), and seaweedfs >= 4.33.0 uses the Helm-4-only template function
      // `fromToml` (templates/shared/security-configmap.yaml). Under v2.13.2 the
      // repo-server fails `helm template` with `function "fromToml" not defined`, and
      // ArgoCD CACHES that manifest-generation error per revision -- so the wave -90
      // self-upgrade to 10.7.0 arrives after the failure is already cached and cannot
      // clear it. Measured on run 33736439359 (2026-09-03): seaweedfs sync=Unknown with
      // `Manifest generation error (cached)`, health=Healthy VACUOUSLY (zero applied
      // resources), so no Service, kube-dns answers `no such host` 700x, and mimir's
      // startup sanity-check dies -- every mimir module "depends on sanity-check".
      // The k3s bootstrap (k8s/bootstrap/argocd-install.yaml) was moved to 10.6.0 on
      // 2026-09-01; this kind-lane pin was the one left behind. Pinned to 10.7.0 to
      // EQUAL the self-managed Application, so bootstrap and self-management agree and
      // no mid-run upgrade happens at all.
      // 10.7.0 -> 10.7.2 on 2026-09-04: a PURE CHART bump -- appVersion is v3.5.2 at both, checked
      // against the live repo index, so ArgoCD itself does not move. All FOUR pin sites move
      // together (this Application, k8s/bootstrap/argocd-install.yaml, and the kind and k3d
      // bootstraps in dev-cluster/use-cases.ts) because 2026-09-03 made them EQUAL on purpose: a
      // bootstrap behind the self-managed Application means a mid-run self-upgrade, which is exactly
      // the failure that cached the seaweedfs manifest error.
      version: "10.8.0",
      namespace: "argocd",
      setValues: ["server.service.type=ClusterIP"],
      wait: true,
    });
  }

  controlPlane.waitForCrdEstablished("applications.argoproj.io", 120);

  // THE RESOURCE-RUNG OVERRIDE POINT. `applyRootDevCatalog` takes a repo URL and
  // ArgoCD clones whatever it is handed, so serving a rung-applied copy of the
  // tree is the whole mechanism -- no new concept, just a different repository.
  //
  // ORDERED BEFORE THE ROOT APPLICATION, and the wait is not optional: a root app
  // pointed at a server that is not yet answering fails its first sync and then
  // retries on ArgoCD's backoff, so the lane pays minutes for a race that a
  // readiness wait removes entirely.
  const rootRepoUrl = applyLaneTreeSource(ports, options.laneTree) ?? options.gitRepoUrl;
  const catalogRef = laneTreeCatalogRef(options.laneTree, options.gitRef);
  appCatalog.applyRootDevCatalog(catalogRef, rootRepoUrl, "kind", cni);
}

/**
 * Revision the root Application asks the in-cluster server for.
 *
 * When the lane tree is present, default to `SERVED_GIT_REF` (`main`) even if
 * the caller forgot `laneTree.gitRef`. Falling back to the bring-up `gitRef`
 * is how 33822942615 pointed ArgoCD at a GitHub SHA the served repo does not
 * contain. Absent a lane tree, the bring-up ref is still what GitHub-hosted
 * catalogs need on a PR.
 */
function laneTreeCatalogRef(
  laneTree: { readonly gitRef?: string } | undefined,
  bringUpRef: string,
): string {
  if (laneTree === undefined) return bringUpRef;
  return laneTree.gitRef ?? SERVED_GIT_REF;
}

/**
 * Apply the in-cluster tree server and wait for it to answer, returning the URL
 * the root Application should clone -- or `null` when no lane tree was supplied.
 *
 * FAILS LOUD RATHER THAN FALLING BACK. If the server never becomes Available the
 * function throws instead of returning `null`, because the silent fallback is the
 * dangerous outcome here: the lane would sync GitHub at the `metal` rung, report
 * `Insufficient cpu` on four pods, and look exactly like the failure this
 * mechanism exists to remove -- with nothing in the log saying the override had
 * been skipped.
 */
function applyLaneTreeSource(
  ports: DevClusterPorts,
  laneTree: { readonly manifests: string; readonly repoUrl: string } | undefined,
): string | null {
  if (laneTree === undefined) return null;
  const { controlPlane } = ports;
  console.log(`Serving the lane tree in-cluster; ArgoCD will clone ${laneTree.repoUrl} ...`);
  // SERVER-SIDE APPLY, not a nicety. MEASURED live-k3d and live-kind-included
  // 33821540802: packed=411676B, `kubectl apply -f -` failed
  // `metadata.annotations: Too long: may not be more than 262144 bytes`.
  // Client-side apply stores the whole YAML in last-applied-configuration.
  // `applyFileManifest` already takes this door for the kubevirt CRD.
  controlPlane.applyInlineManifest(laneTree.manifests, true);

  // `condition=Available` on the Deployment, which the readiness probe gates on
  // GET /tree.git/info/refs -- so this waits for the REPOSITORY to be servable,
  // not merely for a pod to be running. A container that is up with an empty
  // volume would satisfy the weaker condition and hand ArgoCD a 404 that reads
  // like a bad repoURL.
  const ready = controlPlane.waitForResource("deployment/zeta-lane-tree", "zeta-lane-tree", "condition=Available", 240);
  if (!ready) {
    throw new Error(
      "lane tree server never became Available within 240s. NOT falling back to the committed tree: that would " +
        "sync the `metal` rung onto a runner-sized node and reproduce the Insufficient-cpu failure this override " +
        "exists to remove, with nothing in the log saying the override had been skipped.",
    );
  }
  return laneTree.repoUrl;
}

/**
 * Helm-install the SHIPPED Cilium surface onto a kind cluster whose profile
 * left the CNI slot empty. Same refusal as k3d: a missing Application.yaml
 * valuesObject must not silently become the chart defaults.
 */
function installShippedCiliumOnKind(ports: DevClusterPorts, clusterName: string): void {
  if (ports.packages.releaseInstalled("kube-system", "cilium")) return;
  const surfaces = readCiliumValueSurfaces();
  const shipped = surfaces.find((surface) => surface.path.includes("applications/cilium/"))?.values;
  if (shipped === undefined) {
    throw new Error(
      "the ArgoCD Cilium value surface was not found in the roster; refusing to invent values for the kind cluster",
    );
  }
  const { values, deltas } = ciliumKindValues(shipped, clusterName);
  console.log(`Installing Cilium from ${surfaces.map((s) => s.path).join(", ")}`);
  console.log(`Value deltas for the kind substrate (${deltas.length}):`);
  for (const delta of deltas) console.log(`  ${delta.path}: ${delta.shipped} -> ${delta.kind} (${delta.reason})`);
  const valuesPath = join(process.env["RUNNER_TEMP"] ?? "/tmp", `cilium-kind-values-${clusterName}.json`);
  writeFileSync(valuesPath, renderValuesYaml(values));
  console.log(`Rendered Cilium values to ${valuesPath}`);
  ports.packages.addRepo("cilium", CILIUM_CHART_REPO);
  ports.packages.updateRepo("cilium");
  ports.packages.install({
    release: "cilium",
    chart: "cilium/cilium",
    version: shippedCiliumChartVersion(),
    namespace: "kube-system",
    setValues: [],
    valuesFiles: [valuesPath],
    wait: true,
  });
}

export function tearDownKindCluster(ports: DevClusterPorts, clusterName: string): void {
  if (ports.localCluster.list().includes(clusterName)) {
    console.log(`Deleting kind cluster ${clusterName} ...`);
    ports.localCluster.delete(clusterName);
  } else {
    console.log(`Kind cluster ${clusterName} not present.`);
  }
}

/**
 * Point k3d's CoreDNS at a REACHABLE upstream resolver.
 *
 * MEASURED 2026-08-31, and this is the whole reason the k3d lane could not
 * reconcile an App-of-Apps. `argocd-repo-server` failed every fetch with:
 *
 *     fatal: unable to access 'https://github.com/.../Zeta.git/':
 *     Could not resolve host: github.com
 *
 * so ArgoCD could never render, produced ZERO child Applications, and the
 * harness timed out waiting for one. The root Application sat `sync=Unknown`
 * (a ComparisonError) while reporting `health=Healthy`, which is why this took
 * three runs to see.
 *
 * THE MECHANISM, read off the cluster rather than guessed. k3s's shipped
 * Corefile ends with:
 *
 *     import /etc/coredns/custom/*.override
 *     forward . /etc/resolv.conf
 *
 * A k3d "node" is a Docker container, so that /etc/resolv.conf names Docker's
 * embedded resolver, `127.0.0.11`. CoreDNS runs as a POD on the cluster overlay,
 * where 127.0.0.11 is its OWN loopback and nothing is listening. Cluster names
 * still resolve (the `kubernetes` plugin answers them locally, which is exactly
 * why the cluster looks healthy); every external name fails.
 *
 * WHY KINDNETD DOES NOT HAVE THIS: kind's node image substitutes the host's
 * real resolvers into the node resolv.conf. kindnetd App-of-Apps clones
 * github.com without this override.
 *
 * KIND + CILIUM DOES HAVE THIS. MEASURED run 33695849211 (081M1DFQ2MZ):
 * same ComparisonError, same `Could not resolve host: github.com`, while
 * `zeta-lb-pool` assigned `cilium-ingress` 172.18.255.200. kubeadm CoreDNS
 * does not import `coredns-custom`, so the kind+Cilium path patches the
 * Corefile itself (`applyKindCiliumCoreDnsUpstreamOverride`). This k3d
 * function stays k3d-only. On metal /etc/resolv.conf names a routable
 * nameserver and neither override is necessary.
 *
 * The fix uses k3s's own documented extension point (`coredns-custom`, imported
 * by the shipped Corefile above) rather than rewriting the Corefile, so it
 * survives a k3s upgrade that regenerates it.
 *
 * SCOPE: k3d bring-up only. `bringUpKindCiCluster` kindnetd does not call this.
 * kind `--cni cilium` calls `applyKindCiliumCoreDnsUpstreamOverride` instead.
 */
export function applyK3dCoreDnsUpstreamOverride(ports: DevClusterPorts): void {
  console.log("Pointing k3d CoreDNS at a reachable upstream (127.0.0.11 is unreachable from a pod netns) ...");
  ports.controlPlane.applyInlineManifest(
    [
      "apiVersion: v1",
      "kind: ConfigMap",
      "metadata:",
      "  name: coredns-custom",
      "  namespace: kube-system",
      "data:",
      "  upstream.override: |",
      "    forward . 1.1.1.1 8.8.8.8 {",
      "      policy sequential",
      "    }",
      "",
    ].join("\n"),
  );
  // CoreDNS reloads on its own (`reload` is in the shipped Corefile), but the
  // interval is not instant and the very next thing this bring-up does is install
  // ArgoCD, whose repo-server resolves github.com immediately. Restart rather than
  // race it -- a flake here would look exactly like the bug this override fixes,
  // which is the worst possible thing to be ambiguous about.
  //
  // `process.run`, NOT an optional method on the control-plane port. The first
  // draft called `controlPlane.restartDeployment?.(...)` -- a method that DOES
  // NOT EXIST on that interface, so the optional-call would have compiled, run,
  // and done NOTHING. A silent no-op inside the fix for a silent no-op.
  ports.process.run("kubectl", ["-n", "kube-system", "rollout", "restart", "deployment/coredns"], {
    timeoutMs: 60_000,
  });
  ports.process.run("kubectl", ["-n", "kube-system", "rollout", "status", "deployment/coredns", "--timeout=90s"], {
    timeoutMs: 120_000,
  });
}

/**
 * kubeadm CoreDNS (kind) has no `coredns-custom` import. k3d's ConfigMap
 * would be ignored here. Patch the Corefile's `forward` stanza to public
 * resolvers, then restart, before ArgoCD's repo-server clones github.com.
 *
 * MEASURED run 33695849211: kind+Cilium included, 180s any-child wait,
 * `zeta-lb-pool` present, cilium-ingress EXTERNAL-IP 172.18.255.200,
 * then ComparisonError `Could not resolve host: github.com`. Kindnetd
 * on the same SHA creates children. Do not invent a Cilium values tweak
 * from that; this is the CoreDNS forward, the same class k3d already
 * patched via a different surface.
 */
export const DEV_COREDNS_UPSTREAM_FORWARD = "forward . 1.1.1.1 8.8.8.8";

const KIND_CILIUM_COREDNS_FALLBACK_COREFILE = [
  ".:53 {",
  "    errors",
  "    health {",
  "       lameduck 5s",
  "    }",
  "    ready",
  "    kubernetes cluster.local in-addr.arpa ip6.arpa {",
  "       pods insecure",
  "       fallthrough in-addr.arpa ip6.arpa",
  "       ttl 30",
  "    }",
  "    prometheus :9153",
  `    ${DEV_COREDNS_UPSTREAM_FORWARD} {`,
  "       max_concurrent 1000",
  "    }",
  "    cache 30",
  "    loop",
  "    reload",
  "    loadbalance",
  "}",
  "",
].join("\n");

export function rewriteCorefileForwardToPublicResolvers(corefile: string): string {
  const replacement = `${DEV_COREDNS_UPSTREAM_FORWARD} {\n       max_concurrent 1000\n    }`;
  if (/forward \. \/etc\/resolv\.conf/.test(corefile)) {
    return corefile.replace(/forward \. \/etc\/resolv\.conf(\s*\{[^}]*\})?/, replacement);
  }
  if (corefile.includes(DEV_COREDNS_UPSTREAM_FORWARD)) return corefile;
  return KIND_CILIUM_COREDNS_FALLBACK_COREFILE;
}

export function applyKindCiliumCoreDnsUpstreamOverride(ports: DevClusterPorts): void {
  console.log(
    "Pointing kind+Cilium CoreDNS at 1.1.1.1/8.8.8.8 (MEASURED run 33695849211: repo-server Could not resolve host: github.com) ...",
  );
  const get = ports.process.run(
    "kubectl",
    ["-n", "kube-system", "get", "configmap", "coredns", "-o", "jsonpath={.data.Corefile}"],
    {
      timeoutMs: 30_000,
    },
  );
  const corefile = rewriteCorefileForwardToPublicResolvers(get.stdout);
  ports.controlPlane.mergePatch("configmap/coredns", "kube-system", JSON.stringify({ data: { Corefile: corefile } }));
  ports.process.run("kubectl", ["-n", "kube-system", "rollout", "restart", "deployment/coredns"], {
    timeoutMs: 60_000,
  });
  ports.process.run("kubectl", ["-n", "kube-system", "rollout", "status", "deployment/coredns", "--timeout=90s"], {
    timeoutMs: 120_000,
  });
}

export function bringUpK3dDevCluster(ports: DevClusterPorts, options: K3dDevBringUpOptions): void {
  const { localCluster, controlPlane, packages, appCatalog } = ports;
  const context = localCluster.contextName(options.clusterName);

  if (localCluster.list().includes(options.clusterName)) {
    console.log(
      `Cluster ${options.clusterName} already exists. Use bun src/Core.TypeScript/cluster/dev-cluster/k3d-down.ts --config ${options.configPath} to recreate.`,
    );
  } else {
    console.log(`Creating k3d cluster ${options.clusterName} ...`);
    localCluster.create({ name: options.clusterName, configPath: options.configPath, waitForReady: false });
  }

  localCluster.mergeCredentials?.(options.clusterName);
  controlPlane.selectContext(context);
  console.log("Waiting for Kubernetes API readiness ...");
  controlPlane.waitForApiReady(60, 3000);

  applyK3dCoreDnsUpstreamOverride(ports);
  applyVendoredGatewayApiCrds(ports);
  applyK3dControlPlaneHostsAlias(ports, options.kubeApiHost);

  if (!packages.releaseInstalled("kube-system", "cilium")) {
    // INSTALL THE SHIPPED VALUE SURFACE, never a hand-written --set list.
    //
    // This block used to hardcode five --set values, one of which was
    // `ipam.mode=kubernetes` against a shipped surface that says
    // `cluster-pool`. See `ciliumK3dValues` for the measurement that found it:
    // the CNI closest to metal was configured furthest from metal, so a green
    // run here would have proven nothing about what hardware boots.
    //
    // REFUSE rather than fall back. A missing surface must not silently become
    // "install the chart defaults" — that is the same class of defect as the
    // --set list, reached by a different door. `cilium-kind-up.ts` takes the
    // identical stance and prints the identical refusal.
    const surfaces = readCiliumValueSurfaces();
    const shipped = surfaces.find((surface) => surface.path.includes("applications/cilium/"))?.values;
    if (shipped === undefined) {
      throw new Error(
        "the ArgoCD Cilium value surface was not found in the roster; refusing to invent values for the k3d cluster",
      );
    }
    const { values, deltas } = ciliumK3dValues(shipped, options.kubeApiHost);

    console.log(`Installing Cilium from ${surfaces.map((s) => s.path).join(", ")}`);
    console.log(`Value deltas for the k3d substrate (${deltas.length}):`);
    for (const delta of deltas) console.log(`  ${delta.path}: ${delta.shipped} -> ${delta.kind} (${delta.reason})`);

    // writeFileSync, not Bun.write: helm reads this file in the very next
    // statement and Bun.write is async, so an unawaited call is a race that
    // would hand helm an EMPTY values file — i.e. the chart defaults, silently.
    const valuesPath = join(process.env["RUNNER_TEMP"] ?? "/tmp", `cilium-k3d-values-${options.clusterName}.json`);
    writeFileSync(valuesPath, renderValuesYaml(values));
    console.log(`Rendered Cilium values to ${valuesPath}`);

    packages.addRepo("cilium", CILIUM_CHART_REPO);
    packages.updateRepo("cilium");
    packages.install({
      release: "cilium",
      chart: "cilium/cilium",
      version: shippedCiliumChartVersion(),
      namespace: "kube-system",
      setValues: [],
      valuesFiles: [valuesPath],
      wait: true,
    });
  }

  // kind --cni cilium waits here. k3d create is waitForReady: false because
  // there is no CNI yet. Helm --wait is Cilium pods, not node Ready. MEASURED
  // live-k3d smoke 33754516236: kube-dns already had a cluster-pool IP, then
  // new pods stayed ContainerCreating and cilium-agent was missing at dump.
  console.log("Waiting for nodes Ready now that Cilium is the CNI ...");
  controlPlane.waitForAllNodesReady(180);

  if (!packages.releaseInstalled("argocd", "argocd")) {
    console.log("Installing ArgoCD ...");
    controlPlane.ensureNamespace("argocd");
    packages.addRepo("argo", "https://argoproj.github.io/argo-helm");
    packages.updateRepo("argo");
    packages.install({
      release: "argocd",
      chart: "argo/argo-cd",
      // 7.7.10 -> 10.7.0 on 2026-09-03 -- same reason and same measurement as the
      // default-profile install above (Helm-4-only `fromToml` in seaweedfs; cached
      // repo-server error survives the self-upgrade). Kept equal to the Application.
      // 10.7.0 -> 10.7.2 on 2026-09-04: a PURE CHART bump -- appVersion is v3.5.2 at both, checked
      // against the live repo index, so ArgoCD itself does not move. All FOUR pin sites move
      // together (this Application, k8s/bootstrap/argocd-install.yaml, and the kind and k3d
      // bootstraps in dev-cluster/use-cases.ts) because 2026-09-03 made them EQUAL on purpose: a
      // bootstrap behind the self-managed Application means a mid-run self-upgrade, which is exactly
      // the failure that cached the seaweedfs manifest error.
      version: "10.8.0",
      namespace: "argocd",
      // ClusterIP, NOT LoadBalancer -- and this line is downstream of installing
      // the shipped Cilium surface above.
      //
      // MEASURED 2026-08-31, the run after the CNI was fixed. k3s ships klipper
      // (`svclb`), so a `type: LoadBalancer` Service materialises a DaemonSet
      // that binds the service's ports on the HOST. The shipped Cilium values
      // enable `ingressController`, which creates its own LoadBalancer Service;
      // its `svclb-cilium-ingress` pod took 80/443 first and came up 2/2, and
      // `svclb-argocd-server` then sat Pending for the rest of the run:
      //
      //   0/1 nodes are available: 1 node(s) didn't have free ports
      //   for the requested pod ports.
      //
      // On one node there is exactly one host port 80 and one 443. The previous
      // `--set` list did not enable Cilium's ingress controller, so nothing
      // competed and LoadBalancer appeared to work -- it was only ever viable
      // while the CNI config diverged from metal.
      //
      // The kind bring-up above already installs ArgoCD as ClusterIP for its own
      // reasons, and the harness reaches ArgoCD through kubectl in both cases, so
      // no lane needs an externally-routable ArgoCD. Matching kind removes a
      // difference rather than adding one.
      setValues: ["server.service.type=ClusterIP"],
      wait: true,
    });
  }

  controlPlane.waitForCrdEstablished("applications.argoproj.io", 120, true);

  applyDevStorageClassAliases(ports);
  applyDevBootstrapSecrets(ports);
  applyDevRegistryPullSecret(ports, options.env ?? process.env);

  // SAME OVERRIDE POINT AS KIND. Without this, `--serve-tree dev` on the k3d
  // job is a flag the harness parses and then drops: k3d would keep syncing
  // the committed `metal` rung onto a 4000m runner. Metal stays in git.
  const rootRepoUrl = applyLaneTreeSource(ports, options.laneTree) ?? options.gitRepoUrl;
  const catalogRef = laneTreeCatalogRef(options.laneTree, options.gitRef);

  // PROVIDER PASSED. Without it the catalogue keeps the static exclude glob
  // while the harness asserts the k3d-lifted roster -- asserted-but-unapplied,
  // which hangs for the full timeout and blames the Application.
  appCatalog.applyRootDevCatalog(catalogRef, rootRepoUrl, "k3d");
}

export function tearDownK3dDevCluster(ports: DevClusterPorts, clusterName: string): void {
  const context = ports.localCluster.contextName(clusterName);
  if (ports.localCluster.list().includes(clusterName)) {
    console.log(`Deleting k3d cluster ${clusterName} ...`);
    ports.localCluster.delete(clusterName);
  }
  const registryName = ports.localCluster.registryName?.(clusterName);
  if (registryName !== undefined && registryName !== null) {
    ports.localCluster.deleteRegistry?.(registryName);
  }
  ports.controlPlane.clearContextIfCurrent(context);
  console.log("Dev cluster torn down.");
}
