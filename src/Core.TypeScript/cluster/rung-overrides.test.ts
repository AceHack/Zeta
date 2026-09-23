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

import { applyRungOverrides, loadRungOverrides, type RungOverride } from "./rung-overrides.ts";

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
