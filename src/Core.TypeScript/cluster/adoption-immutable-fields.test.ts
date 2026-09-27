/**
 * adoption-immutable-fields.test.ts — hermetic falsifiers for the bootstrap-vs-Application
 * immutable-field check (081M3HYPQCR087G0R003C2VPRS). No helm, no network: the comparison
 * is pure, and the render-both census runs as the CLI in CI.
 *
 * The negative control that matters is the measured one: spire-server's volumeClaimTemplate
 * at 5Gi (k3s bootstrap) against 512Mi (the dev-rung Application). It must be a finding, and
 * the served dev tree the first-boot replica builds must no longer produce it.
 */

import { describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";

import {
  adoptionPairs,
  canonical,
  compareAdoptedRenders,
  discoverBootstrapCrs,
  immutableFields,
  overridesOnAdoptedApplications,
} from "./adoption-immutable-fields.ts";
import { applyServeTreeRung } from "./argocd-health-test.ts";
import { stageLaneTree } from "./lane-tree-source.ts";
import { discoverApplications } from "./rendered-storage-claims.ts";
import { loadRungOverrides } from "./rung-overrides.ts";
import { loadResourceCatalogue } from "./storage-profiles.ts";

const REPO_ROOT = join(import.meta.dir, "../../..");

const spireServer = (size: string, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  apiVersion: "apps/v1",
  kind: "StatefulSet",
  metadata: { name: "spire-server", namespace: "spire" },
  spec: {
    replicas: 1,
    serviceName: "spire-server",
    selector: { matchLabels: { "app.kubernetes.io/name": "server" } },
    template: { spec: { containers: [{ name: "spire-server", image: "a:1" }] } },
    volumeClaimTemplates: [
      {
        metadata: { name: "spire-data" },
        spec: { accessModes: ["ReadWriteOnce"], resources: { requests: { storage: size } }, storageClassName: "zeta-block-local" },
      },
    ],
    ...extra,
  },
});

describe("compareAdoptedRenders", () => {
  test("NEGATIVE CONTROL: the measured spire divergence (5Gi vs 512Mi) is a finding on the claim template", () => {
    const result = compareAdoptedRenders([spireServer("5Gi")], [spireServer("512Mi")], "spire");
    expect(result.compared).toBe(1);
    expect(result.findings.map((f) => `${f.resource} ${f.field}`)).toEqual([
      "StatefulSet/spire/spire-server spec.volumeClaimTemplates[spire-data]",
    ]);
    expect(result.findings[0]?.bootstrap).toContain("5Gi");
    expect(result.findings[0]?.application).toContain("512Mi");
  });

  test("identical renders agree", () => {
    expect(compareAdoptedRenders([spireServer("5Gi")], [spireServer("5Gi")], "spire").findings).toEqual([]);
  });

  test("a MUTABLE difference (replicas, pod template) is not a finding", () => {
    const changed = spireServer("5Gi", { replicas: 3, template: { spec: { containers: [{ name: "x", image: "b:2" }] } } });
    expect(compareAdoptedRenders([spireServer("5Gi")], [changed], "spire").findings).toEqual([]);
  });

  test("an omitted podManagementPolicy equals an explicit OrderedReady, as the API server defaults it", () => {
    const explicit = spireServer("5Gi", { podManagementPolicy: "OrderedReady" });
    expect(compareAdoptedRenders([spireServer("5Gi")], [explicit], "spire").findings).toEqual([]);
    const parallel = spireServer("5Gi", { podManagementPolicy: "Parallel" });
    expect(compareAdoptedRenders([spireServer("5Gi")], [parallel], "spire").findings).toHaveLength(1);
  });

  test("serviceName and selector drift are findings", () => {
    expect(compareAdoptedRenders([spireServer("5Gi")], [spireServer("5Gi", { serviceName: "other" })], "spire").findings).toHaveLength(1);
    const deploy = (label: string): Record<string, unknown> => ({
      kind: "Deployment",
      metadata: { name: "d" },
      spec: { selector: { matchLabels: { app: label } } },
    });
    expect(compareAdoptedRenders([deploy("a")], [deploy("b")], "ns").findings[0]?.field).toBe("spec.selector");
  });

  test("a missing namespace inherits the release namespace, so the two sides key the same object", () => {
    const bare = spireServer("5Gi");
    (bare["metadata"] as Record<string, unknown>)["namespace"] = undefined;
    expect(compareAdoptedRenders([bare], [spireServer("512Mi")], "spire").compared).toBe(1);
  });

  test("helm hooks are skipped and one-sided resources are counted, not failed", () => {
    const hook = { kind: "Job", metadata: { name: "h", annotations: { "helm.sh/hook": "post-install" } }, spec: {} };
    expect(immutableFields(hook)).toBeNull();
    const result = compareAdoptedRenders([spireServer("5Gi")], [], "spire");
    expect(result).toEqual({ findings: [], compared: 0, oneSided: 1 });
  });

  test("canonical JSON ignores key order", () => {
    expect(canonical({ b: 1, a: [{ d: 2, c: 3 }] })).toBe(canonical({ a: [{ c: 3, d: 2 }], b: 1 }));
  });
});

describe("the served dev tree the first-boot replica builds (real repo, offline)", () => {
  const overrides = loadRungOverrides(loadResourceCatalogue(undefined, REPO_ROOT).profiles, REPO_ROOT);
  const pairs = adoptionPairs(discoverBootstrapCrs(REPO_ROOT), discoverApplications(REPO_ROOT));

  test("every bootstrap-installed chart that an Application also installs is paired", () => {
    const charts = pairs.map((p) => p.application.appId).sort();
    for (const app of ["full-ai-cluster/argocd", "full-ai-cluster/cilium", "full-ai-cluster/spire", "full-ai-cluster/spire-crds"]) {
      expect(charts).toContain(app);
    }
  });

  test("the overrides skipped for the replica are exactly the ones on adopted Applications", () => {
    expect(overridesOnAdoptedApplications(overrides, pairs).map((o) => o.id)).toEqual(["spire/disk-dev"]);
  });

  const bootstrapSpireSize = (): unknown => {
    const cr = discoverBootstrapCrs(REPO_ROOT).find((c) => c.chart === "spire" && c.file.startsWith("full-ai-cluster/"));
    return (parseYaml(cr?.values ?? "") as { "spire-server": { persistence: { size: unknown } } })["spire-server"].persistence.size;
  };
  const servedSpireSize = (skip: ReadonlySet<string>): unknown => {
    const staged = mkdtempSync(join(tmpdir(), "zeta-adoption-test-"));
    try {
      stageLaneTree(REPO_ROOT, staged, "http://lane.invalid/zeta.git");
      applyServeTreeRung("dev", staged, {}, { skipOverrideIds: skip });
      const app = parseYaml(readFileSync(join(staged, "full-ai-cluster/k8s/applications/spire/Application.yaml"), "utf8")) as {
        spec: { source: { helm: { valuesObject: { "spire-server": { persistence: { size: unknown } } } } } };
      };
      return app.spec.source.helm.valuesObject["spire-server"].persistence.size;
    } finally {
      rmSync(staged, { recursive: true, force: true });
    }
  };

  test("with the skip, the served spire Application declares the SAME claim size k3s installed", () => {
    const skip = new Set(overridesOnAdoptedApplications(overrides, pairs).map((o) => o.id));
    expect(servedSpireSize(skip)).toBe(bootstrapSpireSize());
  });

  test("NEGATIVE CONTROL: without the skip it diverges -- the tree run 36333824468 served", () => {
    expect(servedSpireSize(new Set())).not.toBe(bootstrapSpireSize());
  });
});
