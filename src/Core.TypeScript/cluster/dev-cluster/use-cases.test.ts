import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { buildRootDevCatalogManifest } from "../ports.ts";
import { devStorageAliasManifestPath } from "./lib.ts";
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

function fakePorts(log: string[]): DevClusterPorts {
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
    applyInlineManifest: () => log.push("inline-manifest"),
    ensureNamespace: (ns) => log.push(`ns:${ns}`),
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
