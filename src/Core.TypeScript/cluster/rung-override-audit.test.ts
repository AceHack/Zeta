// src/Core.TypeScript/cluster/rung-override-audit.test.ts
//
// Falsifiers for the two dev-lane checks: an override path the chart does not
// read is refused, and the dev lane's declared disk must fit beside its images
// -- with every claim PRICED, an unpriced one costing its metal size, and a
// resize naming a claim the render lacks refused as stale.

import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parse as parseYaml, stringify } from "yaml";

import { applyServeTreeRung } from "./argocd-health-test.ts";
import { stageLaneTree } from "./lane-tree-source.ts";

import { auditDevLaneStorage, auditOverrideValuePaths } from "./rung-override-audit.ts";
import { loadRungOverrides, type RungOverride } from "./rung-overrides.ts";
import { loadCatalogue, loadResourceCatalogue, storageProfileForResourceRung } from "./storage-profiles.ts";

const RUNGS = loadResourceCatalogue().profiles;
const LIVE = loadRungOverrides(RUNGS);

function synthetic(partial: Partial<RungOverride> & Pick<RungOverride, "id" | "path">): RungOverride {
  return {
    docIndex: 0,
    rung: "dev",
    reason: "a synthetic override for a falsifier, not a substrate fact at all",
    liftsWhen: "never; it exists only inside this test",
    set: {},
    remove: [],
    resizes: [],
    ...partial,
  };
}

describe("auditOverrideValuePaths -- an override the chart does not read is a no-op that looks applied", () => {
  test("every live override path is read by its pinned chart", () => {
    expect(auditOverrideValuePaths(LIVE)).toEqual([]);
  });

  test("a misspelled key is INERT and refused, even though the staged tree would change", () => {
    const typo = synthetic({
      id: "forgejo/typo",
      path: "full-ai-cluster/k8s/applications/forgejo/Application.yaml",
      set: { "spec.source.helm.valuesObject.persistance.size": "1Gi" },
    });
    const found = auditOverrideValuePaths([typo]);
    expect(found.map((f) => `${f.path}:${f.verdict}`)).toEqual(["persistance.size:inert"]);
  });

  test("an app with no chart schema is reported, never passed", () => {
    const rawManifest = synthetic({
      id: "nowhere/x",
      path: "full-ai-cluster/k8s/applications/does-not-exist/Application.yaml",
      set: { "spec.source.helm.valuesObject.a": 1 },
    });
    expect(auditOverrideValuePaths([rawManifest]).map((f) => f.verdict)).toEqual(["chart-unavailable"]);
  });

  test("paths outside valuesObject are not this check's business", () => {
    const raw = synthetic({
      id: "vllm/raw",
      path: "full-ai-cluster/k8s/applications/vllm/deployment.yaml",
      set: { "spec.replicas": 1 },
    });
    expect(auditOverrideValuePaths([raw])).toEqual([]);
  });
});

describe("auditDevLaneStorage -- declared disk must fit beside the images", () => {
  test("the shipped dev lane FITS, prices every claim, and has no stale resize", () => {
    const audit = auditDevLaneStorage();
    expect(audit.storageProfile).toBe("ci");
    expect(audit.staleResizes).toEqual([]);
    expect(audit.fits).toBe(true);
    // Nothing on the lane is left at its metal size: every claim is either on the
    // ladder at `ci` or resized by a dev override.
    expect(audit.priced.filter((p) => p.pricedBy.startsWith("committed"))).toEqual([]);
    expect(audit.budgetGib).toBeGreaterThan(0);
  });

  test("the budget is what is LEFT after the images -- one disk holds both", () => {
    const audit = auditDevLaneStorage();
    // The applied cohort's images are tens of GiB (hindsight alone is ~24).
    expect(audit.imageGib).toBeGreaterThan(10);
    expect(audit.budgetGib).toBeLessThanOrEqual(audit.freeDiskGib - audit.reservedDiskGib - 10);
  });

  test("an UNPRICED claim costs its committed size -- dropping one resize takes the lane OVER", () => {
    const withoutDapr = LIVE.filter((o) => o.id !== "dapr/scheduler-disk-dev");
    const audit = auditDevLaneStorage(undefined, withoutDapr);
    const dapr = audit.priced.find((p) => p.claim.startsWith("full-ai-cluster/dapr "));
    expect(dapr?.pricedBy).toContain("committed size");
    expect(dapr?.gib).toBe(48);
    expect(audit.fits).toBe(false);
  });

  test("a resize naming a claim the render does not carry is STALE", () => {
    const stale = synthetic({
      id: "ghost/resize",
      path: "full-ai-cluster/k8s/applications/forgejo/Application.yaml",
      set: { "spec.source.helm.valuesObject.persistence.size": "1Gi" },
      resizes: [{ claim: "full-ai-cluster/forgejo no-such-pvc", size: "1Gi" }],
    });
    expect(auditDevLaneStorage(undefined, [...LIVE, stale]).staleResizes).toEqual(["full-ai-cluster/forgejo no-such-pvc"]);
  });
});

describe("the `ci` storage rung changes DISK, never the replica topology the lane asserts", () => {
  test("ci is the smallest rung, and its pod count equals `measured` on every row", () => {
    const catalogue = loadCatalogue();
    expect(catalogue.profiles[0]).toBe("ci");
    for (const claim of catalogue.claims) expect(claim.pods["ci"], claim.id).toBe(claim.pods["measured"]);
  });

  test("dev maps to ci; metal maps to nothing (the committed sizes)", () => {
    expect(storageProfileForResourceRung("dev")).toBe("ci");
    expect(storageProfileForResourceRung("metal")).toBeNull();
  });

  test("a mapping naming an unknown rung or an unknown storage profile is REFUSED", () => {
    const root = mkdtempSync(join(tmpdir(), "zeta-rung-storage-map-"));
    const path = "catalogue.json";
    writeFileSync(
      join(root, path),
      JSON.stringify({ resourceProfiles: ["dev", "metal"], profiles: ["ci", "large"], storageProfileForResourceRung: { staging: "ci" } }),
    );
    expect(() => storageProfileForResourceRung("dev", path, root)).toThrow(/resourceProfiles lacks/);
    writeFileSync(
      join(root, path),
      JSON.stringify({ resourceProfiles: ["dev", "metal"], profiles: ["ci", "large"], storageProfileForResourceRung: { dev: "tiny" } }),
    );
    expect(() => storageProfileForResourceRung("dev", path, root)).toThrow(/is not a storage profile/);
  });
});

describe("loadRungOverrides -- `resizes` must be something the override actually writes", () => {
  const header = { apiVersion: "cluster.zeta.io/v1", kind: "RungOverrides" };
  const base = {
    id: "demo/disk",
    path: "full-ai-cluster/k8s/applications/demo/Application.yaml",
    docIndex: 0,
    rung: "dev",
    reason: "A runner has 70 GiB free and the metal size does not fit beside the images.",
    liftsWhen: "a bigger runner serves this lane.",
    set: { "spec.x.size": "1Gi" },
  };
  const load = (override: Record<string, unknown>) => {
    const root = mkdtempSync(join(tmpdir(), "zeta-resize-"));
    mkdirSync(join(root, "full-ai-cluster/k8s"), { recursive: true });
    writeFileSync(join(root, "full-ai-cluster/k8s/rung-overrides.yaml"), stringify({ ...header, overrides: [override] }));
    return () => loadRungOverrides(["dev", "metal"], root);
  };

  test("a resize whose size no set value writes is REFUSED", () => {
    expect(load({ ...base, resizes: [{ claim: "full-ai-cluster/demo data", size: "2Gi" }] })).toThrow(/no `set` value writes/);
  });

  test("a malformed claim key is REFUSED", () => {
    expect(load({ ...base, resizes: [{ claim: "full-ai-cluster/demo", size: "1Gi" }] })).toThrow(/<appId> <rendered PVC name>/);
  });

  test("the well-formed shape loads", () => {
    const loaded = load({ ...base, resizes: [{ claim: "full-ai-cluster/demo data", size: "1Gi" }] })();
    expect(loaded[0]?.resizes).toEqual([{ claim: "full-ai-cluster/demo data", size: "1Gi" }]);
  });
});

/**
 * END TO END, OFFLINE: the tree `--serve-tree dev` would serve carries the dev
 * DISK sizes -- the ladder's `ci` rung for governed claims, the override sizes
 * for the rest -- while the committed tree keeps metal's. The audit above prices
 * the lane from these same declarations, so this is what makes its arithmetic a
 * statement about the served tree rather than about a spreadsheet.
 */
describe("applyServeTreeRung -- the served dev tree carries dev disk sizes", () => {
  const repoRoot = join(import.meta.dir, "../../..");
  const staged = mkdtempSync(join(tmpdir(), "zeta-serve-tree-"));
  stageLaneTree(repoRoot, staged, "http://lane.invalid/zeta.git");
  const result = applyServeTreeRung("dev", staged);
  const values = (root: string, dir: string): Record<string, any> =>
    (parseYaml(readFileSync(join(root, "full-ai-cluster/k8s/applications", dir, "Application.yaml"), "utf8")) as any).spec
      .source.helm.valuesObject;

  test("all three override points fired", () => {
    expect(result.storageProfile).toBe("ci");
    expect(result.rungEdits).toBeGreaterThan(0);
    expect(result.storageEdits).toBeGreaterThan(0);
    expect(result.overrideEdits).toBeGreaterThan(0);
  });

  test("a LADDER claim is at its ci size in the staged tree and at metal's in the committed one", () => {
    expect(values(staged, "cockroachdb").storage.persistentVolume.size).toBe("1Gi");
    expect(values(repoRoot, "cockroachdb").storage.persistentVolume.size).toBe("48Gi");
    // pods unchanged: ci changes disk, never the replica topology.
    expect(values(staged, "cockroachdb").statefulset.replicas).toBe(values(repoRoot, "cockroachdb").statefulset.replicas);
  });

  test("an OVERRIDE claim is at its dev size in the staged tree and at metal's in the committed one", () => {
    expect(values(staged, "forgejo").persistence.size).toBe("1Gi");
    expect(values(repoRoot, "forgejo").persistence.size).toBe("20Gi");
    expect(values(staged, "dapr").dapr_scheduler.cluster.storageSize).toBe("1Gi");
  });
});
