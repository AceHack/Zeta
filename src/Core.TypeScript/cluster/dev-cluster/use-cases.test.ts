import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { buildRootDevCatalogManifest } from "../ports.ts";
import {
  buildDevAdminSecretManifest,
  buildDevRegistryPullSecretManifest,
  DEV_BOOTSTRAP_SECRETS,
  DEV_GHCR_PULL_SECRET,
  DEV_GRAFANA_ADMIN_SECRET,
  DEV_ZITI_ADMIN_SECRET,
  devStorageAliasManifestPath,
  resolveRegistryToken,
} from "./lib.ts";
import { applyDevRegistryPullSecret, bringUpK3dDevCluster, bringUpKindCiCluster } from "./use-cases.ts";
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
 * without wiring it is caught here rather than in a live run. The two named
 * constants appear only where a specific Application's contract is the subject.
 */
describe("dev/CI bootstrap credentials", () => {
  // `env: {}` IS LOAD-BEARING, not tidiness. The bring-up also mints a registry
  // pull credential when a token is in scope, and these tests are about the
  // DRAWN admin roster. Left ambient, `mints.length` below would be 2 on a
  // laptop and 3 in CI (which exports `GITHUB_TOKEN`) -- the same commit passing
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
  test("the roster holds both Applications' credentials, and they are distinct objects", () => {
    expect(DEV_BOOTSTRAP_SECRETS).toContain(DEV_GRAFANA_ADMIN_SECRET);
    expect(DEV_BOOTSTRAP_SECRETS).toContain(DEV_ZITI_ADMIN_SECRET);
    expect(DEV_BOOTSTRAP_SECRETS.length).toBe(2);
    const refs = DEV_BOOTSTRAP_SECRETS.map((spec) => `${spec.namespace}/${spec.name}`);
    expect(new Set(refs).size).toBe(refs.length);
  });

  test("kind bring-up mints EVERY rostered credential into its own namespace, BEFORE the app-of-apps root", () => {
    const log: string[] = [];
    bringUpKindCiCluster(fakePorts(log), kindOptions);
    const catalogAt = log.findIndex((entry) => entry.startsWith("catalog:"));
    expect(catalogAt).toBeGreaterThan(-1);

    const mints = log.filter((entry) => entry.startsWith("inline-manifest:"));
    expect(mints.length).toBe(DEV_BOOTSTRAP_SECRETS.length);

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
    const existing = DEV_BOOTSTRAP_SECRETS.map((spec) => `secret/${spec.name}@${spec.namespace}`);
    bringUpKindCiCluster(fakePorts(log, existing), kindOptions);
    for (const ref of existing) expect(log).toContain(`exists?:${ref}`);
    expect(log.some((entry) => entry.startsWith("inline-manifest:"))).toBe(false);
  });

  /**
   * PER-SECRET idempotency, which the all-present case above cannot show.
   *
   * A cluster can legitimately hold one and not the other -- a bring-up that
   * predates a roster entry is exactly that state, and it is the state every
   * existing dev cluster is in the moment `openziti/ziti-admin-credentials`
   * joins the roster. The mint must converge it by creating ONLY the missing
   * one. A loop that bailed on the first `resourceExists` hit, or that skipped
   * the check entirely, would fail here and pass every other test in this file.
   */
  test("a cluster holding only one converges by minting only the other", () => {
    const log: string[] = [];
    bringUpKindCiCluster(
      fakePorts(log, [`secret/${DEV_GRAFANA_ADMIN_SECRET.name}@${DEV_GRAFANA_ADMIN_SECRET.namespace}`]),
      kindOptions,
    );
    const mints = log.filter((entry) => entry.startsWith("inline-manifest:"));
    expect(mints.length).toBe(1);
    expect(mints[0]).toContain(`name: ${DEV_ZITI_ADMIN_SECRET.name}`);
    expect(mints[0]).not.toContain(`name: ${DEV_GRAFANA_ADMIN_SECRET.name}`);
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
  test("two fresh clusters get different passwords, and the two Secrets never share one", () => {
    const runs = [0, 1].map((n) => {
      const log: string[] = [];
      bringUpKindCiCluster(fakePorts(log), { ...kindOptions, configPath: `/tmp/kind-${n}.yaml` });
      return log.filter((entry) => entry.startsWith("inline-manifest:"));
    });
    expect(runs[0]!.length).toBe(DEV_BOOTSTRAP_SECRETS.length);
    // Across clusters.
    expect(runs[0]![0]).not.toBe(runs[1]![0]);
    // Within one cluster: strip the parts that are identical by construction
    // (both specs use `admin-user`/`admin-password`) and compare the values.
    const passwordOf = (manifest: string): string =>
      manifest.split("admin-password: ")[1]?.trim() ?? "";
    const values = runs[0]!.map(passwordOf);
    expect(values.every((v) => v.length > 0)).toBe(true);
    expect(new Set(values).size).toBe(values.length);
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
    expect(log.filter((e) => e.startsWith("inline-manifest:")).length).toBe(DEV_BOOTSTRAP_SECRETS.length);
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
