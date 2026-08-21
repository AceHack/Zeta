import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { buildRootDevCatalogManifest } from "../ports.ts";
import { buildDevGrafanaAdminSecretManifest, DEV_GRAFANA_ADMIN_SECRET, devStorageAliasManifestPath } from "./lib.ts";
import { bringUpK3dDevCluster, bringUpKindCiCluster } from "./use-cases.ts";
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
    run: () => ({ status: 0, stdout: "", stderr: "" }),
  };
  const containerHost: ContainerHost = { kind: "docker", probe: () => true, clusterDriverEnv: () => undefined };
  const localCluster: LocalClusterDriver = {
    shape: "kind-in-docker",
    list: () => [],
    create: () => log.push("create"),
    delete: () => log.push("delete"),
    contextName: (name) => `kind-${name}`,
  };
  const controlPlane: ClusterControlPlane = {
    selectContext: (ctx) => log.push(`context:${ctx}`),
    waitForAllNodesReady: () => log.push("nodes-ready"),
    waitForApiReady: () => log.push("api-ready"),
    applyRemoteManifest: (url) => log.push(`remote:${url}`),
    applyFileManifest: (path, ssa) => log.push(`file:${path}${ssa === true ? ":ssa" : ""}`),
    applyInlineManifest: (yaml) => log.push(`inline-manifest:${yaml}`),
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
    expect(log).toContain("context:kind-zeta-ci");
    expect(log).toContain("install:argocd");
    expect(log).toContain("catalog:main@https://github.com/Lucent-Financial-Group/Zeta");
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
 * THE DEV/CI CREDENTIAL MINT (kube-prometheus-stack / Grafana).
 *
 * Same falsifier shape as the StorageClass aliases above, and for the same
 * reason: `argocd-health-test.ts` stops deferring `kube-prometheus-stack`
 * because this Secret is minted at bring-up. That is a claim about CODE THAT
 * RUNS, and nothing on the harness side can notice a dropped call. These tests
 * can -- delete `applyDevBootstrapSecrets(ports)` from either bring-up and they
 * go red.
 */
describe("dev/CI Grafana admin credential", () => {
  const secretRef = `secret/${DEV_GRAFANA_ADMIN_SECRET.name}`;
  const existingRef = `${secretRef}@${DEV_GRAFANA_ADMIN_SECRET.namespace}`;

  test("kind bring-up mints it into the right namespace BEFORE the app-of-apps root", () => {
    const log: string[] = [];
    bringUpKindCiCluster(fakePorts(log), {
      configPath: "/tmp/kind.yaml",
      clusterName: "zeta-ci",
      gitRef: "main",
      gitRepoUrl: "https://github.com/Lucent-Financial-Group/Zeta",
    });
    const mintAt = log.findIndex((entry) => entry.startsWith("inline-manifest:"));
    const catalogAt = log.findIndex((entry) => entry.startsWith("catalog:"));
    expect(mintAt).toBeGreaterThan(-1);
    expect(catalogAt).toBeGreaterThan(-1);
    // Ordering is the property, not membership: kubelet resolves a Secret at
    // container-create time, so a Secret minted after the Application synced is
    // a Secret that arrived after Grafana already failed to start.
    expect(mintAt).toBeLessThan(catalogAt);
    expect(log).toContain(`ns:${DEV_GRAFANA_ADMIN_SECRET.namespace}`);
    expect(log.indexOf(`ns:${DEV_GRAFANA_ADMIN_SECRET.namespace}`)).toBeLessThan(mintAt);
  });

  test("k3d bring-up mints the same credential — the deferral was lifted provider-independently", () => {
    const log: string[] = [];
    bringUpK3dDevCluster(fakePorts(log), {
      configPath: "/tmp/k3d.yaml",
      clusterName: "zeta-dev",
      agentCount: 0,
      kubeApiHost: "host.k3d.internal",
      gitRef: "main",
      gitRepoUrl: "https://github.com/Lucent-Financial-Group/Zeta",
    });
    const mintAt = log.findIndex((entry) => entry.startsWith("inline-manifest:"));
    const catalogAt = log.findIndex((entry) => entry.startsWith("catalog:"));
    expect(mintAt).toBeGreaterThan(-1);
    expect(mintAt).toBeLessThan(catalogAt);
  });

  /**
   * The idempotency half. Bring-up against an already-standing cluster is a
   * supported path, and a bare apply there would ROTATE Grafana's admin password
   * on every invocation -- a credential silently changing under a running
   * service. The mint asks first.
   */
  test("a second bring-up against a cluster that already has it does NOT rotate it", () => {
    const log: string[] = [];
    bringUpKindCiCluster(fakePorts(log, [existingRef]), {
      configPath: "/tmp/kind.yaml",
      clusterName: "zeta-ci",
      gitRef: "main",
      gitRepoUrl: "https://github.com/Lucent-Financial-Group/Zeta",
    });
    expect(log).toContain(`exists?:${existingRef}`);
    expect(log.some((entry) => entry.startsWith("inline-manifest:"))).toBe(false);
  });

  /**
   * WHAT IS ACTUALLY IN THE SECRET. The three tests above would pass on an
   * empty manifest; the point of the mint is the two keys the chart reads by
   * name, so those are asserted against the shared constant rather than against
   * strings retyped here.
   */
  test("the minted manifest carries both keys the chart names, and no committed password", () => {
    const manifest = buildDevGrafanaAdminSecretManifest("a-test-value");
    expect(manifest).toContain(`name: ${DEV_GRAFANA_ADMIN_SECRET.name}`);
    expect(manifest).toContain(`namespace: ${DEV_GRAFANA_ADMIN_SECRET.namespace}`);
    expect(manifest).toContain(`${DEV_GRAFANA_ADMIN_SECRET.userKey}: ${DEV_GRAFANA_ADMIN_SECRET.user}`);
    expect(manifest).toContain(`${DEV_GRAFANA_ADMIN_SECRET.passwordKey}: a-test-value`);
    expect(manifest).toContain('zeta.io/dev-substrate-credential: "true"');
  });

  /**
   * The value is DRAWN, not constant. Two bring-ups into two fresh clusters must
   * not produce the same admin password -- otherwise the "nothing to copy"
   * argument for not committing one is false, and the mint is a well-known
   * credential wearing a random-looking coat.
   */
  test("two fresh clusters get different passwords", () => {
    const manifests = [0, 1].map((n) => {
      const log: string[] = [];
      bringUpKindCiCluster(fakePorts(log), {
        configPath: `/tmp/kind-${n}.yaml`,
        clusterName: "zeta-ci",
        gitRef: "main",
        gitRepoUrl: "https://github.com/Lucent-Financial-Group/Zeta",
      });
      return log.find((entry) => entry.startsWith("inline-manifest:")) ?? "";
    });
    expect(manifests[0]).not.toBe("");
    expect(manifests[0]).not.toBe(manifests[1]);
  });

  /** THE THIRD DOOR again — `apply-root-app.ts` cannot be driven with fakes. */
  test("applyRootApp mints the credential too, before the catalog", () => {
    const source = readFileSync(new URL("./apply-root-app.ts", import.meta.url), "utf8");
    const mintAt = source.indexOf("applyDevBootstrapSecrets(ports)");
    const catalogAt = source.indexOf("applyRootDevCatalog(gitRef, gitRepoUrl)");
    expect(mintAt).toBeGreaterThan(-1);
    expect(mintAt).toBeLessThan(catalogAt);
  });
});
