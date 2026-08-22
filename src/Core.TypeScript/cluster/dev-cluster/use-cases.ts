import { randomBytes } from "node:crypto";
import type { DevClusterPorts } from "../ports.ts";
import { buildDevAdminSecretManifest, DEV_BOOTSTRAP_SECRETS, devStorageAliasManifestPath } from "./lib.ts";

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
 * Mint the dev/CI credentials that Applications expect to find ALREADY PRESENT,
 * BEFORE the app-of-apps root syncs.
 *
 * TWO Secrets today, both listed in `DEV_BOOTSTRAP_SECRETS`, both for the same
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
}

export interface KindCiBringUpOptions {
  readonly configPath: string;
  readonly clusterName: string;
  readonly gitRef: string;
  readonly gitRepoUrl: string;
}

export interface K3dDevBringUpOptions {
  readonly configPath: string;
  readonly clusterName: string;
  readonly agentCount: number;
  readonly kubeApiHost: string;
  readonly gitRef: string;
  readonly gitRepoUrl: string;
}

export function bringUpKindCiCluster(ports: DevClusterPorts, options: KindCiBringUpOptions): void {
  const { localCluster, controlPlane, packages, appCatalog } = ports;
  const context = localCluster.contextName(options.clusterName);

  if (localCluster.list().includes(options.clusterName)) {
    console.log(
      `Cluster ${options.clusterName} already exists. Use bun src/Core.TypeScript/cluster/dev-cluster/kind-down.ts --cluster-name ${options.clusterName} to recreate.`,
    );
  } else {
    console.log(`Creating kind cluster ${options.clusterName} ...`);
    localCluster.create({ name: options.clusterName, configPath: options.configPath, waitForReady: true, waitTimeoutSec: 180 });
  }

  controlPlane.selectContext(context);
  controlPlane.waitForAllNodesReady(180);

  console.log("Installing Gateway API CRDs (cert-manager enableGatewayAPI on kind/k3d) ...");
  controlPlane.applyRemoteManifest(
    "https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.2.0/standard-install.yaml",
    true,
  );

  applyDevStorageClassAliases(ports);
  applyDevBootstrapSecrets(ports);

  if (!packages.releaseInstalled("argocd", "argocd")) {
    console.log("Installing ArgoCD ...");
    controlPlane.ensureNamespace("argocd");
    packages.addRepo("argo", "https://argoproj.github.io/argo-helm");
    packages.updateRepo("argo");
    packages.install({
      release: "argocd",
      chart: "argo/argo-cd",
      version: "7.7.10",
      namespace: "argocd",
      setValues: ["server.service.type=ClusterIP"],
      wait: true,
    });
  }

  controlPlane.waitForCrdEstablished("applications.argoproj.io", 120);
  appCatalog.applyRootDevCatalog(options.gitRef, options.gitRepoUrl);
}

export function tearDownKindCluster(ports: DevClusterPorts, clusterName: string): void {
  if (ports.localCluster.list().includes(clusterName)) {
    console.log(`Deleting kind cluster ${clusterName} ...`);
    ports.localCluster.delete(clusterName);
  } else {
    console.log(`Kind cluster ${clusterName} not present.`);
  }
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

  if (!packages.releaseInstalled("kube-system", "cilium")) {
    console.log("Installing Cilium ...");
    packages.addRepo("cilium", "https://helm.cilium.io");
    packages.updateRepo("cilium");
    const setValues = [
      "kubeProxyReplacement=true",
      `k8sServiceHost=${options.kubeApiHost}`,
      "k8sServicePort=6443",
      "hubble.enabled=true",
      "ipam.mode=kubernetes",
    ];
    if (options.agentCount === 0) {
      setValues.push("operator.replicas=1", "hubble.relay.enabled=false", "hubble.ui.enabled=false");
    } else {
      setValues.push("hubble.relay.enabled=true", "hubble.ui.enabled=true");
    }
    packages.install({
      release: "cilium",
      chart: "cilium/cilium",
      version: "1.16.5",
      namespace: "kube-system",
      setValues,
      wait: true,
    });
  }

  if (!packages.releaseInstalled("argocd", "argocd")) {
    console.log("Installing ArgoCD ...");
    controlPlane.ensureNamespace("argocd");
    packages.addRepo("argo", "https://argoproj.github.io/argo-helm");
    packages.updateRepo("argo");
    packages.install({
      release: "argocd",
      chart: "argo/argo-cd",
      version: "7.7.10",
      namespace: "argocd",
      setValues: ["server.service.type=LoadBalancer"],
      wait: true,
    });
  }

  controlPlane.waitForCrdEstablished("applications.argoproj.io", 120, true);

  applyDevStorageClassAliases(ports);
  applyDevBootstrapSecrets(ports);

  appCatalog.applyRootDevCatalog(options.gitRef, options.gitRepoUrl);
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
