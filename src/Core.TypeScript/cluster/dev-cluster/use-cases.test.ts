import { describe, expect, test } from "bun:test";
import { buildRootDevCatalogManifest } from "../ports.ts";
import { bringUpKindCiCluster } from "./use-cases.ts";
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
});
