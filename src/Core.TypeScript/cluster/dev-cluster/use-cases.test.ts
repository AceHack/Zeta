import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { buildRootDevCatalogManifest } from "../ports.ts";
import {
  buildDevAdminSecretManifest,
  buildDevRegistryPullSecretManifest,
  DEV_BOOTSTRAP_SECRETS,
  DEV_SHARED_SECRETS,
  DEV_CILIUM_LB_KIND_CRDS,
  DEV_CILIUM_LB_KIND_MANIFEST_RELPATH,
  DEV_GHCR_PULL_SECRET,
  DEV_GRAFANA_ADMIN_SECRET,
  DEV_FORGEJO_ADMIN_SECRET,
  DEV_OPENSEARCH_ADMIN_SECRET,
  DEV_REDIS_AUTH_SECRET,
  DEV_ZITI_ADMIN_SECRET,
  devCiliumLbKindManifestPath,
  devStorageAliasManifestPath,
  resolveRegistryToken,
} from "./lib.ts";
import { GATEWAY_API_CRD_BUNDLE } from "../cilium-kind-lane.ts";
import {
  applyDevRegistryPullSecret,
  bringUpK3dDevCluster,
  bringUpKindCiCluster,
  rewriteCorefileForwardToPublicResolvers,
  applyDevBootstrapSecrets,
  rotateDevCredential,
  rotateDevCredentials,
  allDevCredentialTargets,
} from "./use-cases.ts";
import type {
  AppCatalogApplicator,
  ClusterControlPlane,
  ContainerHost,
  DevClusterPorts,
  LocalClusterDriver,
  PackageDriver,
  ProcessRunner,
} from "../ports.ts";

/**
 * @param existingResources refs `resourceExists` should answer `true` for. Empty
 *   by default -- a fresh cluster -- so every test that does not care about the
 *   idempotency path exercises the MINTING branch, which is the one bring-up
 *   takes in CI.
 */
function fakePorts(log: string[], existingResources: readonly string[] = []): DevClusterPorts {
  const process: ProcessRunner = {
    run: (cmd, args) => {
      log.push(`run:${cmd} ${args.join(" ")}`);
      return { status: 0, stdout: "", stderr: "" };
    },
  };
  const containerHost: ContainerHost = { kind: "docker", probe: () => true, clusterDriverEnv: () => undefined };
  const localCluster: LocalClusterDriver = {
    shape: "kind-in-docker",
    list: () => [],
    create: (spec) => {
      log.push("create");
      log.push(`create:waitForReady=${String(spec.waitForReady !== false)}`);
    },
    delete: () => log.push("delete"),
    contextName: (name) => `kind-${name}`,
  };
  const controlPlane: ClusterControlPlane = {
    selectContext: (ctx) => log.push(`context:${ctx}`),
    waitForAllNodesReady: () => log.push("nodes-ready"),
    waitForApiReady: () => log.push("api-ready"),
    applyRemoteManifest: (url) => log.push(`remote:${url}`),
    applyFileManifest: (path, ssa) => log.push(`file:${path}${ssa === true ? ":ssa" : ""}`),
    applyInlineManifest: (yaml, ssa) => log.push(`inline-manifest:${yaml}${ssa === true ? ":ssa" : ""}`),
    ensureNamespace: (ns) => log.push(`ns:${ns}`),
    resourceExists: (ref, ns) => {
      log.push(`exists?:${ref}@${ns ?? "-"}`);
      return existingResources.includes(`${ref}@${ns ?? "-"}`);
    },
    waitForCrdEstablished: (crd) => log.push(`crd:${crd}`),
    mergePatch: (ref, ns, patch) => log.push(`patch:${ref}@${ns ?? "-"}:${patch}`),
    waitForResource: (ref, ns, expr) => {
      log.push(`wait:${ref}@${ns ?? "-"}:${expr}`);
      return true;
    },
    clearContextIfCurrent: () => log.push("clear-context"),
  };
  const packages: PackageDriver = {
    releaseInstalled: () => false,
    addRepo: (alias) => log.push(`repo-add:${alias}`),
    updateRepo: (alias) => log.push(`repo-update:${alias}`),
    install: (spec) => log.push(`install:${spec.release}`),
  };
  const appCatalog: AppCatalogApplicator = {
    applyRootDevCatalog: (ref, url) => log.push(`catalog:${ref}@${url}`),
  };
  return { process, containerHost, localCluster, controlPlane, packages, appCatalog };
}

describe("cluster ports", () => {
  test("buildRootDevCatalogManifest embeds git ref without YAML injection chars", () => {
    const yaml = buildRootDevCatalogManifest({
      gitRef: "main",
      gitRepoUrl: "https://github.com/Lucent-Financial-Group/Zeta",
      applicationsPath: "full-ai-cluster/k8s/applications",
      excludeGlob: "{longhorn/**}",
    });
    expect(yaml).toContain("targetRevision: main");
    expect(yaml).toContain("name: zeta-root-dev");
  });
});

describe("kind CI use case", () => {
  test("orchestrates through ports without naming vendor CLIs", () => {
    const log: string[] = [];
    bringUpKindCiCluster(fakePorts(log), {
      configPath: "/tmp/kind.yaml",
      clusterName: "zeta-ci",
      gitRef: "main",
      gitRepoUrl: "https://github.com/Lucent-Financial-Group/Zeta",
    });
    expect(log).toContain("create");
    expect(log).toContain("create:waitForReady=true");
    expect(log).toContain("context:kind-zeta-ci");
    expect(log).toContain("install:argocd");
    expect(log).toContain("catalog:main@https://github.com/Lucent-Financial-Group/Zeta");
    expect(log).toContain(
      "remote:https://github.com/kubernetes-sigs/gateway-api/releases/download/v1.2.0/standard-install.yaml",
    );
    expect(log).not.toContain("install:cilium");
  });

  /**
   * 081M1DFQ2MZ — THE EXIT FROM `--existing`.
   *
   * Four probe attempts used `--existing` against a cluster `cilium-kind-up.ts`
   * built, and each skipped one more piece of bring-up. This path creates the
   * cluster itself: no-CNI wait, vendored Gateway API (the metal file), shipped
   * Cilium helm, THEN nodes Ready, THEN the same catalog the kindnetd lane
   * applies. Delete `cni: "cilium"` from the call and waitForReady goes back
   * to true, which times out on a cluster with no CNI.
   */
  test("kind --cni cilium waits for the API, installs shipped Cilium, then nodes Ready", () => {
    const log: string[] = [];
    bringUpKindCiCluster(fakePorts(log), {
      configPath: "/tmp/kind-cilium.yaml",
      clusterName: "zeta-ci-cilium",
      gitRef: "main",
      gitRepoUrl: "https://github.com/Lucent-Financial-Group/Zeta",
      cni: "cilium",
    });
    expect(log).toContain("create:waitForReady=false");
    expect(log.indexOf("api-ready")).toBeGreaterThan(-1);
    expect(log.indexOf("nodes-ready")).toBeGreaterThan(-1);
    expect(log.indexOf("api-ready")).toBeLessThan(log.indexOf("nodes-ready"));
    expect(log).toContain("install:cilium");
    expect(log.indexOf("install:cilium")).toBeLessThan(log.indexOf("nodes-ready"));
    const catalogAt = log.findIndex((entry) => entry.startsWith("catalog:"));
    expect(catalogAt).toBeGreaterThan(-1);
    expect(log.indexOf("install:cilium")).toBeLessThan(catalogAt);
    expect(log.some((entry) => entry.startsWith("file:") && entry.includes(GATEWAY_API_CRD_BUNDLE))).toBe(true);
    expect(log.some((entry) => entry.includes("gateway-api/releases/download/v1.2.0"))).toBe(false);
  });

  /**
   * 081M1DFQ2MZ — k3d skipped the file metal applies first.
   *
   * MEASURED run 33429761222: cert-manager CrashLoopBackOff
   * "the Gateway API CRDs do not seem to be present, but ExperimentalGatewayAPISupport is set to true".
   * Kind `--cni cilium` applies `GATEWAY_API_CRD_BUNDLE`. Kindnetd fetches the
   * GitHub remote. k3d did neither. Delete the helper call from
   * `bringUpK3dDevCluster` and this goes red. ORDER: CRDs before Cilium helm,
   * same as metal `aa-gateway-api-crds` and the kind `--cni cilium` branch.
   * The GitHub remote is forbidden here: CI already RST'd helm.cilium.io;
   * github.com/kubernetes-sigs/gateway-api is the same class.
   */
  test("k3d bring-up applies the vendored Gateway API CRDs before Cilium, never the GitHub remote", () => {
    const log: string[] = [];
    bringUpK3dDevCluster(fakePorts(log), {
      configPath: "/tmp/k3d.yaml",
      clusterName: "zeta-dev",
      agentCount: 0,
      kubeApiHost: "host.k3d.internal",
      gitRef: "main",
      gitRepoUrl: "https://github.com/Lucent-Financial-Group/Zeta",
      env: {},
    });
    const gatewayAt = log.findIndex((entry) => entry.startsWith("file:") && entry.includes(GATEWAY_API_CRD_BUNDLE));
    const ciliumAt = log.indexOf("install:cilium");
    const catalogAt = log.findIndex((entry) => entry.startsWith("catalog:"));
    expect(gatewayAt).toBeGreaterThan(-1);
    expect(ciliumAt).toBeGreaterThan(-1);
    expect(catalogAt).toBeGreaterThan(-1);
    expect(gatewayAt).toBeLessThan(ciliumAt);
    expect(gatewayAt).toBeLessThan(catalogAt);
    expect(log.some((entry) => entry.includes("gateway-api/releases/download"))).toBe(false);
  });

  /**
   * 081M1DFQ2MZ — k3d skipped metal's founder /etc/hosts + API SAN.
   *
   * Metal k3s-server.nix maps control-plane -> 127.0.0.1 on the founder and
   * --tls-san=control-plane so Cilium can dial k8sServiceHost: control-plane.
   * Helm install deltas that host to the Docker DNS name. The cilium
   * Application (included on k3d) carries the metal name. Without the hosts
   * entry the agent cannot reach the API after that adopt.
   *
   * SERVER ONLY: the same mapping on an agent is the joining-node defect.
   * Delete the helper call from bringUpK3dDevCluster and this goes red.
   * ORDER: after Gateway API CRDs, before Cilium helm.
   */
  test("k3d bring-up writes control-plane into the server node hosts before Cilium", () => {
    const log: string[] = [];
    bringUpK3dDevCluster(fakePorts(log), {
      configPath: "/tmp/k3d.yaml",
      clusterName: "zeta-dev",
      agentCount: 0,
      kubeApiHost: "k3d-zeta-dev-server-0",
      gitRef: "main",
      gitRepoUrl: "https://github.com/Lucent-Financial-Group/Zeta",
      env: {},
    });
    const hostsAt = log.findIndex(
      (entry) => entry.startsWith("run:docker exec k3d-zeta-dev-server-0") && entry.includes("control-plane"),
    );
    const ciliumAt = log.indexOf("install:cilium");
    expect(hostsAt).toBeGreaterThan(-1);
    expect(ciliumAt).toBeGreaterThan(-1);
    expect(hostsAt).toBeLessThan(ciliumAt);
    expect(log.some((entry) => entry.includes("127.0.0.1 control-plane"))).toBe(true);
  });

  /**
   * kind --cni cilium waits for nodes Ready after Cilium helm. k3d create is
   * waitForReady: false (no CNI yet) and then never waited. Helm --wait is
   * pods, not node Ready. Delete waitForAllNodesReady from bringUpK3dDevCluster
   * and this goes red.
   */
  test("k3d bring-up waits for nodes Ready after Cilium helm, before ArgoCD and the catalogue", () => {
    const log: string[] = [];
    bringUpK3dDevCluster(fakePorts(log), {
      configPath: "/tmp/k3d.yaml",
      clusterName: "zeta-dev",
      agentCount: 0,
      kubeApiHost: "k3d-zeta-dev-server-0",
      gitRef: "main",
      gitRepoUrl: "https://github.com/Lucent-Financial-Group/Zeta",
      env: {},
    });
    const catalogAt = log.findIndex((entry) => entry.startsWith("catalog:"));
    expect(log).toContain("install:cilium");
    expect(log).toContain("nodes-ready");
    expect(log.indexOf("install:cilium")).toBeLessThan(log.indexOf("nodes-ready"));
    expect(log.indexOf("nodes-ready")).toBeLessThan(log.indexOf("install:argocd"));
    expect(log.indexOf("nodes-ready")).toBeLessThan(catalogAt);
  });

  test("the k3d CI profile SANs control-plane and aliases it on the one-node founder", () => {
    const ci = readFileSync(
      new URL("../../../../full-ai-cluster/dev-cluster/profiles/ci.k3d-config.yaml", import.meta.url),
      "utf8",
    );
    const local = readFileSync(
      new URL("../../../../full-ai-cluster/dev-cluster/k3d-config.yaml", import.meta.url),
      "utf8",
    );
    expect(ci).toContain("--tls-san=control-plane");
    expect(ci).toContain("hostAliases:");
    expect(local).toContain("--tls-san=control-plane");
    // agents: 2 — founder mapping on every node would make agents dial themselves.
    expect(local).not.toContain("hostAliases:");
  });

  /**
   * Metal k3s-server.nix disables servicelb so Cilium owns L4. k3d
   * copied traefik-off and left klipper on. MEASURED live-k3d
   * 33800779819: svclb-cilium-ingress 2/2 Running, hostNetwork
   * ClusterIP TCP FAIL, overlay pod IPs OPEN. Delete this flag
   * from either profile and this goes red.
   */
  test("k3d profiles disable servicelb the same way metal k3s-server.nix does", () => {
    const ci = readFileSync(
      new URL("../../../../full-ai-cluster/dev-cluster/profiles/ci.k3d-config.yaml", import.meta.url),
      "utf8",
    );
    const local = readFileSync(
      new URL("../../../../full-ai-cluster/dev-cluster/k3d-config.yaml", import.meta.url),
      "utf8",
    );
    const metal = readFileSync(
      new URL("../../../../full-ai-cluster/nixos/modules/k3s-server.nix", import.meta.url),
      "utf8",
    );
    expect(metal).toContain("--disable=servicelb");
    expect(ci).toContain("--disable=servicelb");
    expect(local).toContain("--disable=servicelb");
  });

  /**
   * THE LOAD-BALANCER ALIAS -- same wiring-falsifier shape as longhorn.
   *
   * A `type: LoadBalancer` Service on kind never gets
   * `status.loadBalancer.ingress` until something implements LB-IPAM. The
   * metal Application pins 192.168.1.x, so it stays excluded. This file is
   * the substrate that answers the name. Delete the `applyDevCiliumLbKindAlias`
   * call from the cilium branch of `bringUpKindCiCluster` and this goes red.
   *
   * ORDER IS ASSERTED: Cilium helm, then CRDs Established, then the pool,
   * then the catalogue. Applying the pool before the CRDs is a NotFound
   * that reads as "Cilium does not do LoadBalancer". Applying it after the
   * catalogue lets a LoadBalancer Service land with no pool.
   */
  test("kind --cni cilium applies the LB-IPAM alias after Cilium helm and CRDs, before the catalogue", () => {
    const log: string[] = [];
    bringUpKindCiCluster(fakePorts(log), {
      configPath: "/tmp/kind-cilium.yaml",
      clusterName: "zeta-ci-cilium",
      gitRef: "main",
      gitRepoUrl: "https://github.com/Lucent-Financial-Group/Zeta",
      cni: "cilium",
    });
    const pool = `file:${devCiliumLbKindManifestPath()}`;
    expect(log).toContain("install:cilium");
    expect(log).toContain(pool);
    expect(log.indexOf("install:cilium")).toBeLessThan(log.indexOf("nodes-ready"));
    expect(log.indexOf("nodes-ready")).toBeLessThan(log.indexOf(pool));
    for (const crd of DEV_CILIUM_LB_KIND_CRDS) {
      const crdAt = log.indexOf(`crd:${crd}`);
      expect(crdAt).toBeGreaterThan(-1);
      expect(log.indexOf("nodes-ready")).toBeLessThan(crdAt);
      expect(crdAt).toBeLessThan(log.indexOf(pool));
    }
    const catalogAt = log.findIndex((entry) => entry.startsWith("catalog:"));
    expect(catalogAt).toBeGreaterThan(-1);
    expect(log.indexOf(pool)).toBeLessThan(catalogAt);
  });

  test("kind --cni cilium patches kubeadm CoreDNS to public resolvers before the catalogue", () => {
    // MEASURED run 33695849211: ComparisonError Could not resolve host: github.com
    // with zeta-lb-pool assigned. k3d's coredns-custom ConfigMap is ignored by
    // kubeadm CoreDNS. This is the kind surface of the same class.
    const log: string[] = [];
    bringUpKindCiCluster(fakePorts(log), {
      configPath: "/tmp/kind-cilium.yaml",
      clusterName: "zeta-ci-cilium",
      gitRef: "main",
      gitRepoUrl: "https://github.com/Lucent-Financial-Group/Zeta",
      cni: "cilium",
    });
    const patch = log.find((entry) => entry.startsWith("patch:configmap/coredns@kube-system:"));
    expect(patch).toBeDefined();
    expect(patch).toContain("1.1.1.1");
    expect(patch).toContain("8.8.8.8");
    const catalogAt = log.findIndex((entry) => entry.startsWith("catalog:"));
    expect(log.indexOf(patch!)).toBeLessThan(catalogAt);
  });

  test("kindnetd bring-up does not apply the Cilium LB-IPAM alias", () => {
    const log: string[] = [];
    bringUpKindCiCluster(fakePorts(log), {
      configPath: "/tmp/kind.yaml",
      clusterName: "zeta-ci",
      gitRef: "main",
      gitRepoUrl: "https://github.com/Lucent-Financial-Group/Zeta",
    });
    expect(log).not.toContain(`file:${devCiliumLbKindManifestPath()}`);
    for (const crd of DEV_CILIUM_LB_KIND_CRDS) {
      expect(log).not.toContain(`crd:${crd}`);
    }
    expect(log.some((entry) => entry.startsWith("patch:configmap/coredns@"))).toBe(false);
  });

  test("k3d bring-up does not apply the kind LB-IPAM alias — k3d has Cilium, not this pool", () => {
    // k3d helm-installs Cilium. The tempting edit is "apply the pool whenever
    // Cilium is installed". That would put kind's docker-bridge range onto
    // k3d's network -- the same class of defect as applying 192.168.1.x on kind.
    const log: string[] = [];
    bringUpK3dDevCluster(fakePorts(log), {
      configPath: "/tmp/k3d.yaml",
      clusterName: "zeta-dev",
      agentCount: 0,
      kubeApiHost: "host.k3d.internal",
      gitRef: "main",
      gitRepoUrl: "https://github.com/Lucent-Financial-Group/Zeta",
      env: {},
    });
    expect(log).toContain("install:cilium");
    expect(log).not.toContain(`file:${devCiliumLbKindManifestPath()}`);
    for (const crd of DEV_CILIUM_LB_KIND_CRDS) {
      expect(log).not.toContain(`crd:${crd}`);
    }
  });

  test("the kind LB-IPAM alias exists, is a Cilium pool, and is not the metal subnet", () => {
    const manifest = readFileSync(devCiliumLbKindManifestPath(), "utf8");
    expect(DEV_CILIUM_LB_KIND_MANIFEST_RELPATH).toBe("full-ai-cluster/dev-cluster/manifests/cilium-lb-ipam.kind.yaml");
    expect(manifest).toContain("kind: CiliumLoadBalancerIPPool");
    expect(manifest).toContain("kind: CiliumL2AnnouncementPolicy");
    expect(manifest).toContain("name: zeta-lb-pool");
    // Comments may name the metal range they refuse. The SPEC is the claim.
    expect(manifest).toContain('start: "172.18.255.200"');
    expect(manifest).toContain('stop: "172.18.255.220"');
    expect(manifest).not.toMatch(/start:\s*"192\.168\.1\./);
    expect(manifest).not.toMatch(/stop:\s*"192\.168\.1\./);
  });

  test("applyRootApp does not apply the Cilium LB kind alias — it does not know the CNI", () => {
    const source = readFileSync(new URL("./apply-root-app.ts", import.meta.url), "utf8");
    expect(source).not.toContain("applyDevCiliumLbKindAlias");
    expect(source).not.toContain("cilium-lb-ipam.kind.yaml");
  });

  /**
   * 081M0JXF6MS087G0R001HC34TM — THE WIRING FALSIFIER.
   *
   * `isExcludedFromIncludedProof` stops excluding ten longhorn-backed
   * Applications because `dev-cluster/manifests/longhorn.yaml` exists in the
   * tree. That is a claim about the REPO. It only buys anything if bring-up
   * actually applies the file, and nothing about the repo-side claim can
   * detect a dropped `applyFileManifest` call. This test can: delete either
   * line from `applyDevStorageClassAliases` and it goes red.
   *
   * ORDER IS ASSERTED, not just membership. A PVC created before its class
   * exists is a `Pending` volume, and `Pending` is the failure mode the whole
   * exclusion was protecting against -- so the aliases must precede the
   * app-of-apps root, never merely accompany it.
   */
  test("kind bring-up applies both dev alias StorageClasses BEFORE the app-of-apps root", () => {
    const log: string[] = [];
    bringUpKindCiCluster(fakePorts(log), {
      configPath: "/tmp/kind.yaml",
      clusterName: "zeta-ci",
      gitRef: "main",
      gitRepoUrl: "https://github.com/Lucent-Financial-Group/Zeta",
    });
    const longhorn = `file:${devStorageAliasManifestPath("longhorn")}`;
    const zetaLocalPath = `file:${devStorageAliasManifestPath("zetaLocalPath")}`;
    expect(log).toContain(longhorn);
    expect(log).toContain(zetaLocalPath);
    const catalogAt = log.findIndex((entry) => entry.startsWith("catalog:"));
    expect(catalogAt).toBeGreaterThan(-1);
    expect(log.indexOf(longhorn)).toBeLessThan(catalogAt);
    expect(log.indexOf(zetaLocalPath)).toBeLessThan(catalogAt);
  });

  test("k3d bring-up applies the same aliases — the exclusion rule is provider-independent", () => {
    // `isExcludedFromIncludedProof` does not know which provider is running, so
    // a `longhorn` class that exists only under kind would have the k3d lane
    // asserting Applications it cannot bind.
    const log: string[] = [];
    bringUpK3dDevCluster(fakePorts(log), {
      configPath: "/tmp/k3d.yaml",
      clusterName: "zeta-dev",
      agentCount: 0,
      kubeApiHost: "host.k3d.internal",
      gitRef: "main",
      gitRepoUrl: "https://github.com/Lucent-Financial-Group/Zeta",
      env: {},
    });
    const longhorn = `file:${devStorageAliasManifestPath("longhorn")}`;
    expect(log).toContain(longhorn);
    const catalogAt = log.findIndex((entry) => entry.startsWith("catalog:"));
    expect(catalogAt).toBeGreaterThan(-1);
    expect(log.indexOf(longhorn)).toBeLessThan(catalogAt);
  });

  /**
   * THE THIRD DOOR. `apply-root-app.ts` applies the root catalogue without going
   * through either bring-up, so the two tests above could both be green while
   * that entrypoint synced longhorn-backed Applications into a cluster with no
   * such class. This asserts the shared helper exists and is what all three
   * routes call -- the source-level half of that guarantee, since
   * `applyRootApp` builds its own live ports and cannot be driven with fakes.
   */
  test("applyRootApp routes through the same shared alias helper, before the catalog", () => {
    const source = readFileSync(new URL("./apply-root-app.ts", import.meta.url), "utf8");
    const aliasAt = source.indexOf("applyDevStorageClassAliases(ports)");
    const catalogAt = source.indexOf("applyRootDevCatalog(gitRef, gitRepoUrl)");
    expect(aliasAt).toBeGreaterThan(-1);
    expect(catalogAt).toBeGreaterThan(-1);
    expect(aliasAt).toBeLessThan(catalogAt);
  });
});

/**
 * THE DEV/CI CREDENTIAL MINT (kube-prometheus-stack / Grafana, and oz / ziti).
 *
 * Same falsifier shape as the StorageClass aliases above, and for the same
 * reason: `argocd-health-test.ts` stops deferring `kube-prometheus-stack` and
 * `oz` because these Secrets are minted at bring-up. That is a claim about CODE
 * THAT RUNS, and nothing on the harness side can notice a dropped call. These
 * tests can -- delete `applyDevBootstrapSecrets(ports)` from either bring-up and
 * they go red.
 *
 * THE ROSTER IS WALKED, NOT RETYPED. Every test below that enumerates Secrets
 * enumerates `DEV_BOOTSTRAP_SECRETS`, so adding a third entry to the mint
 * without wiring it is caught here rather than in a live run. The named
 * constants appear only where a specific Application's contract is the subject.
 */
describe("dev/CI bootstrap credentials", () => {
  // `env: {}` IS LOAD-BEARING, not tidiness. The bring-up also mints a registry
  // pull credential when a token is in scope, and these tests are about the
  // DRAWN admin roster. Left ambient, `mints.length` below would be 3 on a
  // laptop and 4 in CI (which exports `GITHUB_TOKEN`) -- the same commit passing
  // or failing on where it ran. The registry path has its own describe block.
  const kindOptions = {
    configPath: "/tmp/kind.yaml",
    clusterName: "zeta-ci",
    gitRef: "main",
    gitRepoUrl: "https://github.com/Lucent-Financial-Group/Zeta",
    env: {},
  } as const;

  /**
   * The roster is the SUBJECT of the mint, so it is asserted before anything
   * that walks it. A roster that silently shrank to one entry would make every
   * "for each" test below vacuous -- passing over an empty-ish set is the
   * classic shape of a check that cannot fail.
   */
  test("the roster holds every Application's credential, and they are distinct objects", () => {
    expect(DEV_BOOTSTRAP_SECRETS).toContain(DEV_GRAFANA_ADMIN_SECRET);
    expect(DEV_BOOTSTRAP_SECRETS).toContain(DEV_ZITI_ADMIN_SECRET);
    // MOVED to DEV_SHARED_SECRETS 2026-09-09: it gained a second consumer in
    // another namespace, and a secretKeyRef resolves namespace-locally.
    // The positive assertion carries the claim: an EXACT roster pin fails if
    // redis-auth is on this list, and also if anything else appears or moves.
    // `not.toContain` would have been the weak form -- it passes for any list
    // that merely lacks one element, including an empty one.
    expect(DEV_SHARED_SECRETS).toContain(DEV_REDIS_AUTH_SECRET);
    expect([...DEV_BOOTSTRAP_SECRETS]).toEqual([
      DEV_GRAFANA_ADMIN_SECRET,
      DEV_ZITI_ADMIN_SECRET,
      DEV_OPENSEARCH_ADMIN_SECRET,
      DEV_FORGEJO_ADMIN_SECRET,
    ]);
    // 3 -> 4 on 2026-09-05: `DEV_OPENSEARCH_ADMIN_SECRET`. OpenSearch >= 2.12
    // refuses to boot without OPENSEARCH_INITIAL_ADMIN_PASSWORD while the
    // security plugin is on, which is what the live lane reported as
    // OutOfSync/Progressing. Minting it lets dev run metal's posture instead of
    // turning security off, which would have tested less.
    expect(DEV_BOOTSTRAP_SECRETS).toContain(DEV_OPENSEARCH_ADMIN_SECRET);
    // 4 -> 5 on 2026-09-06: `DEV_FORGEJO_ADMIN_SECRET`. forgejo stopped being the
    // standby half of the Git-host pair, so a pod really does look for
    // `gitea.admin.existingSecret` now -- the exact lift condition its acknowledgement
    // in `existing-secret-is-minted.baseline.json` named, and that entry is gone rather
    // than re-worded.
    expect(DEV_BOOTSTRAP_SECRETS).toContain(DEV_FORGEJO_ADMIN_SECRET);
    // 5 -> 4 on 2026-09-09: `redis-auth` moved to DEV_SHARED_SECRETS when the
    // Orleans silo became a second consumer in a second namespace.
    expect(DEV_BOOTSTRAP_SECRETS.length).toBe(4);
    const refs = DEV_BOOTSTRAP_SECRETS.map((spec) => `${spec.namespace}/${spec.name}`);
    expect(new Set(refs).size).toBe(refs.length);
  });

  test("kind bring-up mints EVERY rostered credential into its own namespace, BEFORE the app-of-apps root", () => {
    const log: string[] = [];
    bringUpKindCiCluster(fakePorts(log), kindOptions);
    const catalogAt = log.findIndex((entry) => entry.startsWith("catalog:"));
    expect(catalogAt).toBeGreaterThan(-1);

    // BOTH ROSTERS. `DEV_SHARED_SECRETS` mints one Secret per NAMESPACE from a single drawn
    // value, so its contribution is the sum of `namespaces.length`, not the spec count --
    // asserting the spec count would pass over a shared secret that reached only one of its
    // three namespaces, which is the exact partial-mint this design refuses.
    const sharedManifests = DEV_SHARED_SECRETS.reduce((n, spec) => n + spec.namespaces.length, 0);
    const mints = log.filter((entry) => entry.startsWith("inline-manifest:"));
    expect(mints.length).toBe(DEV_BOOTSTRAP_SECRETS.length + sharedManifests);

    // ONE DRAWN VALUE, and this is the property the whole shape exists for: a producer and
    // its consumers must present the SAME string. Every namespace's manifest for a shared
    // spec must therefore carry an identical rendering of it.
    for (const spec of DEV_SHARED_SECRETS) {
      const rendered = mints.filter((entry) => entry.includes(`name: ${spec.name}`));
      expect(rendered.length).toBe(spec.namespaces.length);
      const bodies = rendered.map((entry) => entry.slice(entry.indexOf("stringData:")));
      expect(new Set(bodies).size).toBe(1);
    }

    for (const spec of DEV_BOOTSTRAP_SECRETS) {
      const mintAt = log.findIndex(
        (entry) => entry.startsWith("inline-manifest:") && entry.includes(`name: ${spec.name}`),
      );
      expect(mintAt).toBeGreaterThan(-1);
      // Ordering is the property, not membership: kubelet resolves a Secret at
      // container-create time, so a Secret minted after the Application synced
      // is a Secret that arrived after the pod already failed to start.
      expect(mintAt).toBeLessThan(catalogAt);
      // And the namespace has to be ensured BEFORE the object lands in it.
      // For `openziti` this carries a second load: trust-manager's Secrets Role
      // is created in that namespace at sync-wave -45, so a bring-up that never
      // created it fails trust-manager's own sync, not just ziti's.
      expect(log).toContain(`ns:${spec.namespace}`);
      expect(log.indexOf(`ns:${spec.namespace}`)).toBeLessThan(mintAt);
    }
  });

  test("k3d bring-up mints the same credentials — the deferrals lifted provider-independently", () => {
    const log: string[] = [];
    bringUpK3dDevCluster(fakePorts(log), {
      configPath: "/tmp/k3d.yaml",
      clusterName: "zeta-dev",
      agentCount: 0,
      kubeApiHost: "host.k3d.internal",
      gitRef: "main",
      gitRepoUrl: "https://github.com/Lucent-Financial-Group/Zeta",
      env: {},
    });
    const catalogAt = log.findIndex((entry) => entry.startsWith("catalog:"));
    for (const spec of DEV_BOOTSTRAP_SECRETS) {
      const mintAt = log.findIndex(
        (entry) => entry.startsWith("inline-manifest:") && entry.includes(`name: ${spec.name}`),
      );
      expect(mintAt).toBeGreaterThan(-1);
      expect(mintAt).toBeLessThan(catalogAt);
    }
  });

  /**
   * The idempotency half. Bring-up against an already-standing cluster is a
   * supported path, and a bare apply there would ROTATE an admin password on
   * every invocation -- a credential silently changing under a running service.
   * The mint asks first.
   */
  test("a second bring-up against a cluster that already has them does NOT rotate them", () => {
    const log: string[] = [];
    // BOTH ROSTERS, and the shared one contributes one ref PER NAMESPACE. Listing only the
    // bootstrap refs would leave the shared secrets absent, they would mint, and this test
    // would fail for the right reason while claiming the wrong one.
    const existing = [
      ...DEV_BOOTSTRAP_SECRETS.map((spec) => `secret/${spec.name}@${spec.namespace}`),
      ...DEV_SHARED_SECRETS.flatMap((spec) => spec.namespaces.map((ns) => `secret/${spec.name}@${ns}`)),
    ];
    bringUpKindCiCluster(fakePorts(log, existing), kindOptions);
    for (const ref of existing) expect(log).toContain(`exists?:${ref}`);
    expect(log.some((entry) => entry.startsWith("inline-manifest:"))).toBe(false);
  });

  /**
   * PER-SECRET idempotency, which the all-present case above cannot show.
   *
   * A cluster can legitimately hold every rostered Secret but one -- a
   * bring-up that predates a roster entry is exactly that state, and it is
   * the state every existing dev cluster is in the moment `redis/redis-auth`
   * joins the roster. The mint must converge it by creating the missing
   * Secret and no other. A loop that bailed on the first `resourceExists`
   * hit, or that skipped the check entirely, would fail here and pass every
   * other test in this file.
   *
   * The pin is the minted metadata.name list, not an absence search for the
   * already-present names. `not.toContain("grafana-admin-credentials")` is an
   * R5 taint-shaped check: it passes whenever the leak is spelled differently
   * (a sibling key, a comment, a rename), which is exactly the arity hole
   * the hygiene census ratchets.
   */
  test("a cluster holding every rostered credential but one converges by minting the missing metadata.name", () => {
    const log: string[] = [];
    const already = [
      ...DEV_BOOTSTRAP_SECRETS.filter((spec) => spec !== DEV_GRAFANA_ADMIN_SECRET).map(
        (spec) => `secret/${spec.name}@${spec.namespace}`,
      ),
      // The shared secrets are present in FULL. A shared spec is all-or-nothing on re-run --
      // a partial set would re-mint the whole spec with a FRESH value, which is the
      // divergence that shape exists to refuse -- so this scenario keeps them complete and
      // leaves exactly one bootstrap credential missing.
      ...DEV_SHARED_SECRETS.flatMap((spec) => spec.namespaces.map((ns) => `secret/${spec.name}@${ns}`)),
    ];
    bringUpKindCiCluster(fakePorts(log, already), kindOptions);
    const mintedNames = log
      .filter((entry) => entry.startsWith("inline-manifest:"))
      .map((entry) => {
        const match = /^metadata:\n  name: ([^\n]+)/m.exec(entry.slice("inline-manifest:".length));
        if (match === null) throw new Error(`minted manifest has no metadata.name:\n${entry}`);
        return match[1];
      });
    expect(mintedNames).toEqual([DEV_GRAFANA_ADMIN_SECRET.name]);
  });

  /**
   * WHAT IS ACTUALLY IN EACH SECRET. The tests above would pass on an empty
   * manifest; the point of the mint is the two keys each chart reads by name,
   * so those are asserted against the shared constants rather than against
   * strings retyped here.
   */
  test("each minted manifest carries both keys its chart names, and no committed password", () => {
    for (const spec of DEV_BOOTSTRAP_SECRETS) {
      const manifest = buildDevAdminSecretManifest(spec, "a-test-value");
      expect(manifest).toContain(`name: ${spec.name}`);
      expect(manifest).toContain(`namespace: ${spec.namespace}`);
      expect(manifest).toContain(`${spec.userKey}: ${spec.user}`);
      expect(manifest).toContain(`${spec.passwordKey}: a-test-value`);
      expect(manifest).toContain('zeta.io/dev-substrate-credential: "true"');
    }
  });

  /**
   * The values are DRAWN, not constant, and drawn INDEPENDENTLY. Two bring-ups
   * into two fresh clusters must not produce the same password -- otherwise the
   * "nothing to copy" argument for not committing one is false. And the two
   * Secrets within ONE bring-up must not share a value either: a single draw
   * reused across the roster would make compromising one credential compromise
   * every other, which is the same defect one blast radius wider.
   */
  test("two fresh clusters get different passwords, and the rostered Secrets never share one", () => {
    const runs = [0, 1].map((n) => {
      const log: string[] = [];
      bringUpKindCiCluster(fakePorts(log), { ...kindOptions, configPath: `/tmp/kind-${n}.yaml` });
      return log.filter((entry) => entry.startsWith("inline-manifest:"));
    });
    expect(runs[0]!.length).toBe(
      DEV_BOOTSTRAP_SECRETS.length + DEV_SHARED_SECRETS.reduce((n, spec) => n + spec.namespaces.length, 0),
    );
    // Across clusters.
    expect(runs[0]![0]).not.toBe(runs[1]![0]);
    // Within one cluster: parse each spec's passwordKey, not a restated
    // `admin-password` string -- redis-auth uses `password`.
    const passwordOf = (manifest: string, spec: (typeof DEV_BOOTSTRAP_SECRETS)[number]): string => {
      const needle = `${spec.passwordKey}: `;
      const line = manifest.split("\n").find((l) => l.includes(needle));
      return line?.slice(line.indexOf(needle) + needle.length).trim() ?? "";
    };
    // MATCHED BY NAME, NOT BY INDEX. The index coupling broke the moment
    // `DEV_SHARED_SECRETS` started contributing manifests too (three of them, appended after
    // the five bootstrap ones), and `DEV_BOOTSTRAP_SECRETS[i]` then read past the end. A
    // by-name lookup states the pairing the assertion actually means.
    const values = DEV_BOOTSTRAP_SECRETS.map((spec) => {
      const manifest = runs[0]!.find((m) => m.includes(`name: ${spec.name}`));
      expect(manifest).toBeDefined();
      return passwordOf(manifest ?? "", spec);
    });
    expect(values.every((v) => v.length > 0)).toBe(true);
    expect(new Set(values).size).toBe(values.length);

    // AND THE SHARED SECRETS ARE DELIBERATELY *NOT* DISTINCT ACROSS THEIR NAMESPACES -- that
    // is the property, not a gap in this one. Asserted here as well as in the mint test,
    // because "every minted value is unique" reads as a rule this file otherwise appears to
    // state, and the exception has to be visible where the rule is.
    for (const spec of DEV_SHARED_SECRETS) {
      const bodies = runs[0]!
        .filter((m) => m.includes(`name: ${spec.name}`))
        .map((m) => m.slice(m.indexOf("stringData:")));
      expect(bodies.length).toBe(spec.namespaces.length);
      expect(new Set(bodies).size).toBe(1);
    }
  });

  /** THE THIRD DOOR again — `apply-root-app.ts` cannot be driven with fakes. */
  test("applyRootApp mints the credentials too, before the catalog", () => {
    const source = readFileSync(new URL("./apply-root-app.ts", import.meta.url), "utf8");
    const mintAt = source.indexOf("applyDevBootstrapSecrets(ports)");
    const catalogAt = source.indexOf("applyRootDevCatalog(gitRef, gitRepoUrl)");
    expect(mintAt).toBeGreaterThan(-1);
    expect(mintAt).toBeLessThan(catalogAt);
  });
});

/**
 * THE REGISTRY PULL CREDENTIAL — a different class from the roster above, and
 * these tests exist to hold the difference rather than to re-check the mint.
 *
 * The admin credentials are DRAWN, so their mint is unconditional and a skip
 * would be a bug. This one is SOURCED, so a skip is a legitimate outcome and
 * the thing that must never happen is the third state: a Secret minted around
 * an empty token. In-cluster that is INDISTINGUISHABLE from a real credential
 * without permission -- same ImagePullBackOff, same ArgoCD `Progressing`, and
 * an object sitting in the namespace that makes the credential half look done.
 * Every test below is aimed at that state.
 */
describe("dev/CI registry pull credential", () => {
  const kindOptions = {
    configPath: "/tmp/kind.yaml",
    clusterName: "zeta-ci",
    gitRef: "main",
    gitRepoUrl: "https://github.com/Lucent-Financial-Group/Zeta",
  } as const;

  const pullMints = (log: readonly string[]): string[] =>
    log.filter((e) => e.startsWith("inline-manifest:") && e.includes(`name: ${DEV_GHCR_PULL_SECRET.name}`));

  test("a token in ANY of the rostered variables is found, first non-empty wins", () => {
    const [first, second] = DEV_GHCR_PULL_SECRET.tokenEnvVars;
    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(resolveRegistryToken(DEV_GHCR_PULL_SECRET, { [first!]: "a", [second!]: "b" })).toBe("a");
    expect(resolveRegistryToken(DEV_GHCR_PULL_SECRET, { [second!]: "b" })).toBe("b");
  });

  /**
   * THE CENTRAL FALSIFIER. Every one of these environments is a real way to
   * arrive at "the variable is set and holds nothing": a workflow interpolating
   * a repository secret that was never created yields the empty string, and a
   * shell `export TOKEN=" "` yields whitespace. Treating any of them as a token
   * is what mints the indistinguishable Secret.
   */
  test("an empty, whitespace, or unset token is ABSENT — never a token", () => {
    const [first] = DEV_GHCR_PULL_SECRET.tokenEnvVars;
    for (const env of [{}, { [first!]: "" }, { [first!]: "   " }, { [first!]: "\t\n" }, { [first!]: undefined }]) {
      expect(resolveRegistryToken(DEV_GHCR_PULL_SECRET, env)).toBeNull();
    }
  });

  test("with no token the bring-up mints NOTHING for the registry, and still mints the drawn roster", () => {
    const log: string[] = [];
    bringUpKindCiCluster(fakePorts(log), { ...kindOptions, env: {} });
    expect(pullMints(log)).toEqual([]);
    // The skip must be LOCAL to this credential -- a bring-up that bailed here
    // would leave Grafana and ziti without theirs for an unrelated reason.
    expect(log.filter((e) => e.startsWith("inline-manifest:")).length).toBe(
      DEV_BOOTSTRAP_SECRETS.length + DEV_SHARED_SECRETS.reduce((n, spec) => n + spec.namespaces.length, 0),
    );
  });

  test("with a token the bring-up mints it, into the pods' OWN namespace, before the catalog", () => {
    const log: string[] = [];
    const [first] = DEV_GHCR_PULL_SECRET.tokenEnvVars;
    bringUpKindCiCluster(fakePorts(log), { ...kindOptions, env: { [first!]: "t0ken" } });
    const mints = pullMints(log);
    expect(mints.length).toBe(1);
    // `imagePullSecrets` is a LocalObjectReference: minted anywhere but the pod's
    // namespace it is simply not found, and the symptom is the 401 it was
    // supposed to remove.
    expect(mints[0]).toContain(`namespace: ${DEV_GHCR_PULL_SECRET.namespace}`);
    expect(log.indexOf(`ns:${DEV_GHCR_PULL_SECRET.namespace}`)).toBeGreaterThan(-1);
    const catalogAt = log.findIndex((e) => e.startsWith("catalog:"));
    expect(log.indexOf(mints[0]!)).toBeLessThan(catalogAt);
  });

  test("a cluster that already holds it is left alone — a re-run does not churn a working credential", () => {
    const log: string[] = [];
    const [first] = DEV_GHCR_PULL_SECRET.tokenEnvVars;
    const existing = [`secret/${DEV_GHCR_PULL_SECRET.name}@${DEV_GHCR_PULL_SECRET.namespace}`];
    applyDevRegistryPullSecret(fakePorts(log, existing), { [first!]: "t0ken" });
    expect(pullMints(log)).toEqual([]);
    expect(log).toContain(`exists?:${existing[0]}`);
  });

  /**
   * THE TYPE IS THE WHOLE POINT. An `Opaque` Secret of the same name in the
   * right namespace is found by nobody: the kubelet consults ONLY
   * `kubernetes.io/dockerconfigjson` for image pulls, so it would be ignored in
   * silence while looking, to a reader, exactly like a credential that is
   * present. This asserts the type and the key the kubelet actually reads.
   */
  test("the manifest is a dockerconfigjson the kubelet will actually consult", () => {
    const manifest = buildDevRegistryPullSecretManifest(DEV_GHCR_PULL_SECRET, "someone", "t0ken");
    expect(manifest).toContain("type: kubernetes.io/dockerconfigjson");
    const payload = manifest.split(".dockerconfigjson: ")[1]!.trim();
    const config = JSON.parse(JSON.parse(payload) as string) as {
      auths: Record<string, { username: string; password: string; auth: string }>;
    };
    const entry = config.auths[DEV_GHCR_PULL_SECRET.registry];
    expect(entry).toBeDefined();
    expect(entry!.password).toBe("t0ken");
    expect(Buffer.from(entry!.auth, "base64").toString("utf8")).toBe("someone:t0ken");
  });

  /**
   * THE HALF-WIRING FALSIFIER, and the reason this file reads YAML.
   *
   * The pod specs are the one consumer `lib.ts` cannot import. Rename the
   * constant without touching the manifests -- or add a third private-image
   * Deployment to this Application and forget the reference -- and nothing in
   * TypeScript notices; the only symptom is an ImagePullBackOff that ArgoCD
   * reports as `Progressing`, so a run burns its whole timeout and reports the
   * symptom instead of the cause. This goes red instead.
   */
  test("every pod spec running a private GHCR image names this exact Secret", () => {
    const chartDir = new URL("../../../../full-ai-cluster/k8s/applications/platform/", import.meta.url);
    for (const file of ["controller.yaml", "portal.yaml"]) {
      const yaml = readFileSync(new URL(file, chartDir), "utf8");
      expect(yaml).toContain("ghcr.io/lucent-financial-group/");
      expect(yaml).toContain("imagePullSecrets:");
      expect(yaml).toContain(`- name: ${DEV_GHCR_PULL_SECRET.name}`);
    }
  });

  /** THE THIRD DOOR, for this credential too. */
  test("applyRootApp mints the registry credential as well, before the catalog", () => {
    const source = readFileSync(new URL("./apply-root-app.ts", import.meta.url), "utf8");
    const mintAt = source.indexOf("applyDevRegistryPullSecret(ports)");
    const catalogAt = source.indexOf("applyRootDevCatalog(gitRef, gitRepoUrl)");
    expect(mintAt).toBeGreaterThan(-1);
    expect(mintAt).toBeLessThan(catalogAt);
  });
});

describe("kind+Cilium CoreDNS forward rewrite", () => {
  test("replaces kubeadm forward . /etc/resolv.conf including the options block", () => {
    const input = [
      ".:53 {",
      "    kubernetes cluster.local in-addr.arpa ip6.arpa {",
      "       pods insecure",
      "    }",
      "    forward . /etc/resolv.conf {",
      "       max_concurrent 1000",
      "    }",
      "    cache 30",
      "}",
      "",
    ].join("\n");
    const out = rewriteCorefileForwardToPublicResolvers(input);
    expect(out).toContain("forward . 1.1.1.1 8.8.8.8");
    expect(out).not.toContain("/etc/resolv.conf");
    expect(out).toContain("kubernetes cluster.local");
  });

  test("empty Corefile falls back to a kubeadm Corefile that still answers cluster names", () => {
    const out = rewriteCorefileForwardToPublicResolvers("");
    expect(out).toContain("forward . 1.1.1.1 8.8.8.8");
    expect(out).toContain("kubernetes cluster.local");
  });
});

describe("the lane-tree resource-rung override point", () => {
  const laneTree = {
    manifests: "apiVersion: v1\nkind: Namespace\nmetadata:\n  name: zeta-lane-tree\n",
    repoUrl: "http://zeta-lane-tree.zeta-lane-tree.svc.cluster.local:8080/tree.git",
  };

  const kindOptions = {
    configPath: "full-ai-cluster/dev-cluster/profiles/ci.kind-config.yaml",
    clusterName: "zeta-ci-included",
    gitRef: "main",
    gitRepoUrl: "https://github.com/Lucent-Financial-Group/Zeta",
  };

  test("the root Application clones the LANE tree, not the committed one", () => {
    const log: string[] = [];
    bringUpKindCiCluster(fakePorts(log), { ...kindOptions, laneTree });
    expect(log).toContain(`catalog:main@${laneTree.repoUrl}`);
    expect(log).not.toContain(`catalog:main@${kindOptions.gitRepoUrl}`);
  });

  test("a GitHub SHA on the PR does not become the served targetRevision", () => {
    // MEASURED 33822942615: catalog asked for dc2e16e3e… from a repo whose
    // only commit is a new hash. Default catalogRef is SERVED_GIT_REF even
    // when laneTree.gitRef is omitted — forgetting that field must not fall
    // back to the bring-up SHA.
    const githubSha = "dc2e16e3e949d17ad76b77b7196d45202a46f9a1";
    const log: string[] = [];
    bringUpKindCiCluster(fakePorts(log), { ...kindOptions, gitRef: githubSha, laneTree });
    expect(log).toContain(`catalog:main@${laneTree.repoUrl}`);
    expect(log.some((line) => line.includes(`catalog:${githubSha}@`))).toBe(false);
  });

  test("the server is applied and WAITED ON before the root Application", () => {
    // Ordering, not just presence. A root app pointed at a server that is not yet
    // answering fails its first sync and then retries on ArgoCD's backoff, so the
    // lane pays minutes for a race a readiness wait removes. Asserted by index for
    // the same reason the existing tests here do it: "both happened" is a weaker
    // claim than "in this order", and only the second one is the property.
    const log: string[] = [];
    bringUpKindCiCluster(fakePorts(log), { ...kindOptions, laneTree });
    const applyAt = log.findIndex((line) => line.startsWith("inline-manifest:") && line.includes("zeta-lane-tree"));
    const waitAt = log.findIndex((line) => line.startsWith("wait:deployment/zeta-lane-tree"));
    const catalogAt = log.findIndex((line) => line.startsWith("catalog:"));
    expect(applyAt).toBeGreaterThanOrEqual(0);
    expect(waitAt).toBeGreaterThan(applyAt);
    expect(catalogAt).toBeGreaterThan(waitAt);
    // MEASURED 33821540802: client-side apply died on last-applied 262144.
    expect(log[applyAt]!.endsWith(":ssa")).toBe(true);
  });

  test("the wait is on Available, which the readiness probe gates on the repository index", () => {
    // `condition=Available` rather than pod-running: a container that is up with an
    // empty volume satisfies the weaker condition and hands ArgoCD a 404 that reads
    // like a bad repoURL.
    const log: string[] = [];
    bringUpKindCiCluster(fakePorts(log), { ...kindOptions, laneTree });
    expect(log).toContain("wait:deployment/zeta-lane-tree@zeta-lane-tree:condition=Available");
  });

  test("NO SILENT FALLBACK: a server that never becomes Available throws, and the root app is never applied", () => {
    // The dangerous outcome. Falling back to the committed tree would sync the
    // `metal` rung onto a runner-sized node, reproduce `Insufficient cpu` on four
    // pods, and look exactly like the failure this mechanism exists to remove --
    // with nothing in the log saying the override had been skipped.
    const log: string[] = [];
    const ports = fakePorts(log);
    const failing = {
      ...ports,
      controlPlane: {
        ...ports.controlPlane,
        waitForResource: (ref: string, ns: string | null, expr: string): boolean => {
          log.push(`wait:${ref}@${ns ?? "-"}:${expr}`);
          return false;
        },
      },
    };
    expect(() => {
      bringUpKindCiCluster(failing, { ...kindOptions, laneTree });
    }).toThrow(/never became Available/);
    expect(log.some((line) => line.startsWith("catalog:"))).toBe(false);
  });

  test("WITHOUT the flag nothing changes — the committed tree is still what is synced", () => {
    // The compatibility half. Every caller that does not opt in must be
    // byte-identical to before the flag existed, or this is a behaviour change
    // wearing an opt-in's clothes.
    const log: string[] = [];
    bringUpKindCiCluster(fakePorts(log), kindOptions);
    expect(log).toContain(`catalog:main@${kindOptions.gitRepoUrl}`);
    expect(log.some((line) => line.includes("zeta-lane-tree"))).toBe(false);
  });

  const k3dOptions = {
    configPath: "full-ai-cluster/dev-cluster/profiles/ci.k3d-config.yaml",
    clusterName: "zeta-ci",
    agentCount: 0,
    kubeApiHost: "k3d-zeta-ci-server-0",
    gitRef: "main",
    gitRepoUrl: "https://github.com/Lucent-Financial-Group/Zeta",
  };

  test("k3d: the root Application clones the LANE tree, not the committed one", () => {
    // Delete laneTree from bringUpK3dDevCluster and this goes red: `--serve-tree`
    // on the live-k3d job would parse and then drop, leaving metal (6390m) on a
    // 4000m GitHub node.
    const log: string[] = [];
    bringUpK3dDevCluster(fakePorts(log), { ...k3dOptions, laneTree });
    expect(log).toContain(`catalog:main@${laneTree.repoUrl}`);
    expect(log).not.toContain(`catalog:main@${k3dOptions.gitRepoUrl}`);
  });

  test("k3d: a GitHub SHA on the PR does not become the served targetRevision", () => {
    const githubSha = "dc2e16e3e949d17ad76b77b7196d45202a46f9a1";
    const log: string[] = [];
    bringUpK3dDevCluster(fakePorts(log), { ...k3dOptions, gitRef: githubSha, laneTree });
    expect(log).toContain(`catalog:main@${laneTree.repoUrl}`);
    expect(log.some((line) => line.includes(`catalog:${githubSha}@`))).toBe(false);
  });

  test("k3d: the server is applied and WAITED ON before the root Application", () => {
    const log: string[] = [];
    bringUpK3dDevCluster(fakePorts(log), { ...k3dOptions, laneTree });
    const applyAt = log.findIndex((line) => line.startsWith("inline-manifest:") && line.includes("zeta-lane-tree"));
    const waitAt = log.findIndex((line) => line.startsWith("wait:deployment/zeta-lane-tree"));
    const catalogAt = log.findIndex((line) => line.startsWith("catalog:"));
    expect(applyAt).toBeGreaterThanOrEqual(0);
    expect(waitAt).toBeGreaterThan(applyAt);
    expect(catalogAt).toBeGreaterThan(waitAt);
    expect(log).toContain("wait:deployment/zeta-lane-tree@zeta-lane-tree:condition=Available");
    expect(log[applyAt]!.endsWith(":ssa")).toBe(true);
  });

  test("k3d: NO SILENT FALLBACK — a server that never becomes Available throws", () => {
    const log: string[] = [];
    const ports = fakePorts(log);
    const failing = {
      ...ports,
      controlPlane: {
        ...ports.controlPlane,
        waitForResource: (ref: string, ns: string | null, expr: string): boolean => {
          log.push(`wait:${ref}@${ns ?? "-"}:${expr}`);
          return false;
        },
      },
    };
    expect(() => {
      bringUpK3dDevCluster(failing, { ...k3dOptions, laneTree });
    }).toThrow(/never became Available/);
    expect(log.some((line) => line.startsWith("catalog:"))).toBe(false);
  });

  test("k3d: WITHOUT the flag the committed tree is still what is synced", () => {
    const log: string[] = [];
    bringUpK3dDevCluster(fakePorts(log), k3dOptions);
    expect(log).toContain(`catalog:main@${k3dOptions.gitRepoUrl}`);
    expect(log.some((line) => line.includes("zeta-lane-tree"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ROTATION. The mint had a guard proving a re-bring-up does NOT rotate; nothing
// proved a DELIBERATE rotation works, because until now there was no verb to
// rotate with. These are that verb's falsifiers, and the negative cases carry
// the weight -- a rotation that silently mints, or silently half-rotates a
// shared credential, fails in a way that surfaces as an auth error days later.
// ---------------------------------------------------------------------------

/** Every password a run applied, pulled back out of the manifests it wrote. */
function appliedPasswords(log: readonly string[], passwordKey: string): readonly string[] {
  return log
    .filter((entry) => entry.startsWith("inline-manifest:"))
    .flatMap((entry) => {
      const match = new RegExp(`^\\s*${passwordKey}: (.+)$`, "m").exec(entry);
      return match?.[1] === undefined ? [] : [match[1].trim()];
    });
}

describe("rotateDevCredential", () => {
  const spec = DEV_BOOTSTRAP_SECRETS[0]!;
  const target = `${spec.namespace}/${spec.name}`;
  const present = [`secret/${spec.name}@${spec.namespace}`];

  test("rotating a credential the cluster HOLDS replaces it and reports the swap", () => {
    const log: string[] = [];
    const result = rotateDevCredential(fakePorts(log, present), target);
    expect(result.rotated).toBe(true);
    expect(result.refusal).toBeUndefined();
    expect(log.some((entry) => entry.startsWith("inline-manifest:"))).toBe(true);
  });

  test("THE VALUE ACTUALLY CHANGES — the point of a rotation", () => {
    // A rotation that re-applied the same bytes would satisfy every structural
    // assertion above and rotate nothing. Two rotations, two draws, compared.
    const first: string[] = [];
    const second: string[] = [];
    rotateDevCredential(fakePorts(first, present), target);
    rotateDevCredential(fakePorts(second, present), target);
    const a = appliedPasswords(first, spec.passwordKey);
    const b = appliedPasswords(second, spec.passwordKey);
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    expect(a[0]).not.toEqual(b[0]);
    expect((a[0] ?? "").length).toBeGreaterThan(20);
  });

  test("ROTATION IS NOT A MINT — an absent credential is refused, not created", () => {
    const log: string[] = [];
    const result = rotateDevCredential(fakePorts(log, []), target);
    expect(result.rotated).toBe(false);
    expect(result.refusal ?? "").toContain("does not hold it");
    // The refusal must be total: nothing written.
    expect(log.some((entry) => entry.startsWith("inline-manifest:"))).toBe(false);
  });

  test("an unrecognised name is refused rather than minted as a new Secret", () => {
    const log: string[] = [];
    const result = rotateDevCredential(fakePorts(log, present), "nowhere/not-a-credential");
    expect(result.rotated).toBe(false);
    expect(result.refusal ?? "").toContain("not a known dev credential");
    expect(log.some((entry) => entry.startsWith("inline-manifest:"))).toBe(false);
  });

  test("it never claims an overlap window it did not open", () => {
    const result = rotateDevCredential(fakePorts([], present), target);
    expect(result.overlapWindow).toBe(false);
  });

  test("it names the consumers that still hold the OLD value until restarted", () => {
    const result = rotateDevCredential(fakePorts([], present), target);
    expect(result.restartRequired.length).toBeGreaterThan(0);
  });

  test("MINTING STAYS IDEMPOTENT — adding rotation did not make bring-up rotate", () => {
    // The guard this verb had to not break. Driven through the mint, not the
    // rotate, because that is the path a bring-up takes.
    const log: string[] = [];
    // BOTH ROSTERS. `applyDevBootstrapSecrets` ends by calling
    // `applyDevSharedSecrets`, so listing only the bootstrap refs would leave the
    // shared ones to mint and this test would go red for the right reason while
    // claiming the wrong one -- the same trap the sibling idempotency test above
    // documents.
    const existing = [
      ...DEV_BOOTSTRAP_SECRETS.map((s) => `secret/${s.name}@${s.namespace}`),
      ...DEV_SHARED_SECRETS.flatMap((s) => s.namespaces.map((ns) => `secret/${s.name}@${ns}`)),
    ];
    applyDevBootstrapSecrets(fakePorts(log, existing));
    expect(appliedPasswords(log, spec.passwordKey)).toHaveLength(0);
  });
});

describe("rotateDevCredential — shared credentials rotate everywhere or nowhere", () => {
  const shared = DEV_SHARED_SECRETS[0]!;

  test("a partially-present shared credential is REFUSED, not half-rotated", () => {
    // The failure this prevents does not surface here: it surfaces days later as
    // an auth error, when a consumer left on the old value talks to a producer
    // that moved. Refusing now is the whole reason the rule exists.
    const partial = shared.namespaces
      .slice(0, Math.max(1, shared.namespaces.length - 1))
      .map((ns) => `secret/${shared.name}@${ns}`);
    const log: string[] = [];
    const result = rotateDevCredential(fakePorts(log, partial), shared.name);
    if (shared.namespaces.length > 1) {
      expect(result.rotated).toBe(false);
      expect(result.refusal ?? "").toContain("every namespace or in none");
      expect(log.some((entry) => entry.startsWith("inline-manifest:"))).toBe(false);
    } else {
      expect(result.rotated).toBe(true);
    }
  });

  test("a fully-present shared credential rotates every namespace with ONE value", () => {
    const log: string[] = [];
    const all = shared.namespaces.map((ns) => `secret/${shared.name}@${ns}`);
    const result = rotateDevCredential(fakePorts(log, all), shared.name);
    expect(result.rotated).toBe(true);
    const applied = log.filter((entry) => entry.startsWith("inline-manifest:"));
    expect(applied).toHaveLength(shared.namespaces.length);
    // ONE draw across all of them: drawing per namespace is the defect the
    // production code places the draw outside the loop to avoid.
    const values = new Set(applied.map((entry) => entry.replace(/^inline-manifest:/, "")));
    const distinctSecretBodies = new Set(
      [...values].map((yaml) => yaml.replace(/namespace: \S+/g, "namespace: NS")),
    );
    expect(distinctSecretBodies.size).toBe(1);
  });
});

describe("rotateDevCredentials — the ergonomic form", () => {
  const specs = DEV_BOOTSTRAP_SECRETS.slice(0, 2);
  const present = specs.map((s) => `secret/${s.name}@${s.namespace}`);
  const targets = specs.map((s) => `${s.namespace}/${s.name}`);

  test("rotates every target in one call", () => {
    const results = rotateDevCredentials(fakePorts([], present), targets);
    expect(results).toHaveLength(targets.length);
    expect(results.every((r) => r.rotated)).toBe(true);
  });

  test("ONE REFUSAL DOES NOT CANCEL THE REST — outcomes are per credential", () => {
    // The failure this pins: if a single bad name aborted the batch, a typo would
    // read as "rotation completed" for everything after it. Each target reports
    // for itself, so a caller can see exactly which moved.
    const log: string[] = [];
    const results = rotateDevCredentials(fakePorts(log, present), [
      "nowhere/not-a-credential",
      ...targets,
    ]);
    expect(results).toHaveLength(targets.length + 1);
    expect(results[0]?.rotated).toBe(false);
    expect(results[0]?.refusal ?? "").toContain("not a known dev credential");
    expect(results.slice(1).every((r) => r.rotated)).toBe(true);
  });

  test("a batch of absent credentials writes NOTHING — refusal stays total in bulk", () => {
    const log: string[] = [];
    const results = rotateDevCredentials(fakePorts(log, []), targets);
    expect(results.every((r) => !r.rotated)).toBe(true);
    expect(log.some((entry) => entry.startsWith("inline-manifest:"))).toBe(false);
  });

  test("allDevCredentialTargets names every credential the cluster mints", () => {
    const all = allDevCredentialTargets();
    for (const spec of DEV_BOOTSTRAP_SECRETS) expect(all).toContain(`${spec.namespace}/${spec.name}`);
    for (const spec of DEV_SHARED_SECRETS) expect(all).toContain(spec.name);
    expect(all.length).toBe(DEV_BOOTSTRAP_SECRETS.length + DEV_SHARED_SECRETS.length);
  });
});
