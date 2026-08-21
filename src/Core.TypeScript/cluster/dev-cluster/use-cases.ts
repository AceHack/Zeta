import { randomBytes } from "node:crypto";
import type { DevClusterPorts } from "../ports.ts";
import { buildDevGrafanaAdminSecretManifest, DEV_GRAFANA_ADMIN_SECRET, devStorageAliasManifestPath } from "./lib.ts";

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
 * Today that is exactly one Secret: `kube-prometheus-stack` points Grafana at
 * `grafana.admin.existingSecret: grafana-admin-credentials`, on purpose, so that
 * no admin password is committed to this repository. Nothing in the dev lane
 * ever created that Secret, so Grafana sat in `CreateContainerConfigError`
 * (`secret "grafana-admin-credentials" not found`) while the rest of the
 * Application -- prometheus and alertmanager, both on bound PVCs -- ran 2/2.
 *
 * ORDER IS LOAD-BEARING for the same reason the StorageClass aliases are:
 * kubelet resolves `envFrom`/`env.valueFrom` at container-create time and a
 * missing Secret is a hard config error, so the Secret has to exist before the
 * Application that consumes it syncs.
 *
 * THE PASSWORD IS DRAWN FRESH PER CLUSTER, never committed and never printed.
 * A well-known constant would also have worked and would have been simpler; a
 * drawn one cannot be promoted to a real deployment by anybody copying it,
 * because there is nothing to copy. This is the ONLY place entropy enters --
 * `buildDevGrafanaAdminSecretManifest` is pure and takes the value.
 *
 * AND IT IS IDEMPOTENT BY ASKING FIRST. Re-running a bring-up against a cluster
 * that already exists is a supported path (both bring-ups say so), and a bare
 * apply would rotate Grafana's admin password every time. `resourceExists`
 * makes the second run a no-op instead.
 *
 * EXPORTED for the same reason `applyDevStorageClassAliases` is: `apply-root-app.ts`
 * is a third door into the root catalogue that neither bring-up guards.
 */
export function applyDevBootstrapSecrets(ports: DevClusterPorts): void {
  const { namespace, name } = DEV_GRAFANA_ADMIN_SECRET;
  const ref = `secret/${name}`;
  ports.controlPlane.ensureNamespace(namespace);
  if (ports.controlPlane.resourceExists(ref, namespace)) {
    console.log(`Dev/CI credential ${namespace}/${name} already present; leaving it alone.`);
    return;
  }
  console.log(`Minting dev/CI credential ${namespace}/${name} (value is per-cluster and never logged) ...`);
  ports.controlPlane.applyInlineManifest(buildDevGrafanaAdminSecretManifest(randomBytes(24).toString("base64url")));
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
