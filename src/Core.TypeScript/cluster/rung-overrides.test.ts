// src/Core.TypeScript/cluster/rung-overrides.test.ts
//
// Falsifiers for the second override point. The one that matters most is the
// NO-OP refusal: an override that changes nothing reads as coverage and buys
// none, which is the failure this whole repository is organised against.

import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { stringify } from "yaml";

import {
  applyRungOverrides,
  loadOverrideDimensions,
  loadRungOverrides,
  type RungOverride,
  validateSelection,
} from "./rung-overrides.ts";
import { applyServeTreeRung } from "./argocd-health-test.ts";
import { stageLaneTree } from "./lane-tree-source.ts";

const RUNGS = ["dev", "metal"] as const;
const ROSTER_HEADER = { apiVersion: "cluster.zeta.io/v1", kind: "RungOverrides" };

function fixture(app: string, overrides: unknown, header: Record<string, unknown> = ROSTER_HEADER): string {
  const root = mkdtempSync(join(tmpdir(), "zeta-rung-override-"));
  const dir = join(root, "full-ai-cluster/k8s/applications/demo");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "Application.yaml"), app);
  mkdirSync(join(root, "full-ai-cluster/k8s"), { recursive: true });
  writeFileSync(join(root, "full-ai-cluster/k8s/rung-overrides.yaml"), stringify({ ...header, overrides }));
  return root;
}

const APP = ["spec:", "  replicaCount: 0", "  gpu: true", "  nodeSelector:", "    zeta.io/gpu: nvidia", ""].join("\n");

const BASE = {
  id: "demo/x",
  path: "full-ai-cluster/k8s/applications/demo/Application.yaml",
  docIndex: 0,
  rung: "dev",
  reason: "A runner has no GPU and the hardware box does; that is a substrate fact, not a preference.",
  liftsWhen: "a GPU-bearing runner serves this lane.",
};

describe("loadRungOverrides — refusals at load, before anything is written", () => {
  test("an override naming a rung the catalogue lacks is REFUSED", () => {
    const root = fixture(APP, [{ ...BASE, rung: "staging", set: { "spec.gpu": false } }]);
    expect(() => loadRungOverrides(RUNGS, root)).toThrow(/not one of dev, metal/);
  });

  test("an override with no reason, or a token one, is REFUSED", () => {
    const noReason = fixture(APP, [{ ...BASE, reason: "", set: { "spec.gpu": false } }]);
    expect(() => loadRungOverrides(RUNGS, noReason)).toThrow(/non-empty string/);
    const tooShort = fixture(APP, [{ ...BASE, reason: "no gpu", set: { "spec.gpu": false } }]);
    expect(() => loadRungOverrides(RUNGS, tooShort)).toThrow(/too short/);
  });

  test("an override with no liftsWhen is REFUSED — an exemption nobody can retire", () => {
    const root = fixture(APP, [{ ...BASE, liftsWhen: "", set: { "spec.gpu": false } }]);
    expect(() => loadRungOverrides(RUNGS, root)).toThrow(/liftsWhen/);
  });

  test("an override that sets nothing and removes nothing is REFUSED", () => {
    const root = fixture(APP, [{ ...BASE, set: {}, remove: [] }]);
    expect(() => loadRungOverrides(RUNGS, root)).toThrow(/sets nothing and removes nothing/);
  });

  test("a roster with the wrong kind is REFUSED — a stray manifest is not an override roster", () => {
    const root = fixture(APP, [{ ...BASE, set: { "spec.gpu": false } }], { apiVersion: "v1", kind: "ConfigMap" });
    expect(() => loadRungOverrides(RUNGS, root)).toThrow(/kind RungOverrides/);
    const bare = fixture(APP, [{ ...BASE, set: { "spec.gpu": false } }], {});
    expect(() => loadRungOverrides(RUNGS, bare)).toThrow(/kind RungOverrides/);
  });

  test("duplicate ids are REFUSED", () => {
    const one = { ...BASE, set: { "spec.gpu": false } };
    const root = fixture(APP, [one, one]);
    expect(() => loadRungOverrides(RUNGS, root)).toThrow(/duplicate/);
  });
});

describe("applyRungOverrides — the no-op refusal is the load-bearing one", () => {
  /**
   * THE FALSIFIER THIS MODULE EXISTS FOR. An override whose values the tree
   * already carries produces no edits, exits 0, and is indistinguishable from
   * one that applied. That is the vacuity class in a config file, so it throws.
   */
  test("an override the tree already satisfies THROWS rather than passing quietly", () => {
    const root = fixture(APP, [{ ...BASE, set: { "spec.replicaCount": 0 } }]);
    const loaded = loadRungOverrides(RUNGS, root);
    expect(() => applyRungOverrides(loaded, "dev", root)).toThrow(/produced NO edits/);
  });

  test("removing a path that is not there also THROWS — same defect, other direction", () => {
    const root = fixture(APP, [{ ...BASE, set: {}, remove: ["spec.tolerations"] }]);
    // `set: {}` alone would be refused at load, so pair it with a real remove
    // target that is absent from the fixture.
    const loaded = loadRungOverrides(RUNGS, fixture(APP, [{ ...BASE, remove: ["spec.tolerations"] }]));
    expect(() => applyRungOverrides(loaded, "dev", root)).toThrow(/produced NO edits/);
  });

  test("it applies set and remove, and reports each edit", () => {
    const root = fixture(APP, [
      { ...BASE, set: { "spec.replicaCount": 1, "spec.gpu": false }, remove: ["spec.nodeSelector"] },
    ]);
    const edits = applyRungOverrides(loadRungOverrides(RUNGS, root), "dev", root);
    expect(edits).toHaveLength(3);
    const written = readFileSync(join(root, BASE.path), "utf8");
    expect(written).toContain("replicaCount: 1");
    expect(written).toContain("gpu: false");
    expect(written).not.toContain("zeta.io/gpu");
  });

  test("an object value replaces the whole map — which is how a dotted KEY is removed", () => {
    // `nvidia.com/gpu` cannot be addressed by a dotted path because its own name
    // contains dots. Replacing the containing map is the only way to drop it,
    // and that is exactly what the live ollama override does.
    const app = ["spec:", "  resources:", "    requests:", "      cpu: '2'", "      nvidia.com/gpu: 1", ""].join("\n");
    const root = fixture(app, [{ ...BASE, set: { "spec.resources.requests": { cpu: "250m" } } }]);
    applyRungOverrides(loadRungOverrides(RUNGS, root), "dev", root);
    const written = readFileSync(join(root, BASE.path), "utf8");
    expect(written).toContain("250m");
    expect(written).not.toContain("nvidia.com/gpu");
  });

  test("a DIFFERENT rung leaves the tree byte-identical", () => {
    const root = fixture(APP, [{ ...BASE, set: { "spec.replicaCount": 1 } }]);
    const before = readFileSync(join(root, BASE.path), "utf8");
    const edits = applyRungOverrides(loadRungOverrides(RUNGS, root), "metal", root);
    expect(edits).toEqual([]);
    expect(readFileSync(join(root, BASE.path), "utf8")).toBe(before);
  });
});

describe("the LIVE override roster", () => {
  test("every committed override loads, and ollama's applies cleanly to a copy", () => {
    const live = loadRungOverrides(RUNGS);
    expect(live.length).toBeGreaterThan(0);
    expect(live.some((o: RungOverride) => o.id === "ollama/cpu-only-dev")).toBe(true);
    // Each one names a rung the catalogue has and carries both a reason and an exit.
    for (const o of live) {
      expect(RUNGS).toContain(o.rung as (typeof RUNGS)[number]);
      expect(o.reason.length).toBeGreaterThan(40);
      expect(o.liftsWhen.length).toBeGreaterThan(0);
    }
  });
});

/**
 * THE GPU VENDOR DIMENSION (2026-09-23). nodeSelector cannot express OR and
 * `nvidia.com/gpu` / `amd.com/gpu` are different resources, so the vendor is a
 * per-cluster selection, not a fork. These pin: conditioned overrides never
 * fire for the committed selection, the AMD selection rewrites BOTH GPU
 * workloads completely (no NVIDIA key survives), and a typo cannot build the
 * committed tree under the AMD label.
 */
describe("cluster dimensions -- the GPU vendor", () => {
  const DIMS = { gpuVendor: { committed: "nvidia", values: ["nvidia", "amd"] } };
  const withDims = (overrides: unknown, dims: unknown = DIMS) =>
    fixture(APP, overrides, { ...ROSTER_HEADER, dimensions: dims });

  test("a `when` naming an undeclared dimension, an unknown value, or the COMMITTED value is REFUSED", () => {
    const set = { "spec.gpu": false };
    expect(() => loadRungOverrides(RUNGS, withDims([{ ...BASE, set, when: { cpuArch: "arm" } }]))).toThrow(/does not declare/);
    expect(() => loadRungOverrides(RUNGS, withDims([{ ...BASE, set, when: { gpuVendor: "intel" } }]))).toThrow(/is not one of/);
    expect(() => loadRungOverrides(RUNGS, withDims([{ ...BASE, set, when: { gpuVendor: "nvidia" } }]))).toThrow(/COMMITTED value/);
  });

  test("a dimension with one value, or a committed value outside its values, is REFUSED", () => {
    const one = { ...BASE, set: { "spec.gpu": false } };
    expect(() => loadRungOverrides(RUNGS, withDims([one], { gpuVendor: { committed: "nvidia", values: ["nvidia"] } }))).toThrow(/at least two/);
    expect(() => loadRungOverrides(RUNGS, withDims([one], { gpuVendor: { committed: "tpu", values: ["nvidia", "amd"] } }))).toThrow(/not one of its values/);
  });

  test("a conditioned override fires ONLY for its selection; the default selection is the committed tree", () => {
    const root = withDims([{ ...BASE, rung: "metal", when: { gpuVendor: "amd" }, set: { "spec.nodeSelector": { "zeta.io/gpu": "amd" } } }]);
    const loaded = loadRungOverrides(RUNGS, root);
    expect(applyRungOverrides(loaded, "metal", root, false)).toEqual([]);
    expect(applyRungOverrides(loaded, "metal", root, false, { gpuVendor: "nvidia" })).toEqual([]);
    expect(applyRungOverrides(loaded, "metal", root, false, { gpuVendor: "amd" })).toHaveLength(1);
  });

  test("a selection naming an undeclared dimension or value THROWS -- never the committed tree under another label", () => {
    const dims = loadOverrideDimensions();
    expect(() => validateSelection({ gpuVendor: "amdd" }, dims)).toThrow(/not one of/);
    expect(() => validateSelection({ gpu: "amd" }, dims)).toThrow(/unknown cluster dimension/);
    expect(() => validateSelection({ gpuVendor: "amd" }, dims)).not.toThrow();
  });

  test("LIVE: the AMD metal tree has no NVIDIA request or selector left in ollama or vllm; the committed tree is untouched", () => {
    const repoRoot = join(import.meta.dir, "../../..");
    const read = (root: string, rel: string) =>
      readFileSync(join(root, "full-ai-cluster/k8s/applications", rel), "utf8").replace(/#.*$/gm, "");
    const staged = mkdtempSync(join(tmpdir(), "zeta-amd-tree-"));
    stageLaneTree(repoRoot, staged, "http://lane.invalid/zeta.git");
    const result = applyServeTreeRung("metal", staged, { gpuVendor: "amd" });
    expect(result.overrideEdits).toBeGreaterThan(0);
    for (const rel of ["ollama/Application.yaml", "vllm/deployment.yaml"]) {
      expect(read(staged, rel), rel).not.toContain("nvidia");
      expect(read(staged, rel), rel).toContain("amd.com/gpu: 1");
      expect(read(staged, rel), rel).toContain("zeta.io/gpu: amd");
      // The committed tree keeps the NVIDIA default.
      expect(read(repoRoot, rel), rel).toContain("nvidia.com/gpu");
    }
    expect(read(staged, "ollama/Application.yaml")).toContain("type: amd");
    expect(read(staged, "vllm/deployment.yaml")).toContain("image: rocm/vllm:latest");
  });

  test("LIVE: the default metal build fires no vendor override at all", () => {
    const repoRoot = join(import.meta.dir, "../../..");
    const staged = mkdtempSync(join(tmpdir(), "zeta-nv-tree-"));
    stageLaneTree(repoRoot, staged, "http://lane.invalid/zeta.git");
    expect(applyServeTreeRung("metal", staged).overrideEdits).toBe(0);
  });
});
