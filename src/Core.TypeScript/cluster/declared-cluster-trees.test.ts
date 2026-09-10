import { describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ROSTER_FILE,
  assertRootsPresent,
  applicationDirs,
  bootstrapDirs,
  bootstrapManifests,
  clusterDirs,
  existingClusterDirs,
  clusterK8sRoots,
  readDeclaredTrees,
} from "./declared-cluster-trees.ts";

function fixture(surviving: string, stale: readonly string[], present: readonly string[]): string {
  const root = mkdtempSync(join(tmpdir(), "declared-trees-"));
  mkdirSync(join(root, "src/Core.TypeScript/hygiene"), { recursive: true });
  writeFileSync(
    join(root, ROSTER_FILE),
    JSON.stringify({ survivingTree: surviving, stalePatterns: stale }),
  );
  for (const p of present) mkdirSync(join(root, p, "bootstrap"), { recursive: true });
  return root;
}

describe("the derivation reproduces what the guards used to hardcode", () => {
  test("against the real roster: the surviving tree leads, and every derived root is on disk", () => {
    // Checked against the FILESYSTEM, which is an independent oracle. Asserting the derived
    // list equals a copy of the roster would be f(x) = f(x) — it would pass for any
    // implementation that read the same file, including a broken one.
    const trees = readDeclaredTrees();
    const roots = clusterK8sRoots(trees);
    expect(roots[0]).toBe(`${trees.surviving}/k8s`);
    expect(roots.length).toBeGreaterThanOrEqual(1);
    for (const r of roots) expect(existsSync(join(process.cwd(), r))).toBe(true);
    for (const m of bootstrapManifests("argocd-install.yaml")) {
      expect(existsSync(join(process.cwd(), m))).toBe(true);
    }
  });

  test("a NixOS stale tree is not a manifest root — last segment must be k8s", () => {
    // Synthetic names on purpose: a fixture that spelled the real stale path would make this
    // file a consumer of a tree scheduled for deletion, which is what the roster audit exists
    // to catch. The behaviour under test does not depend on the names.
    expect(clusterK8sRoots({ surviving: "live", stale: ["legacy/k8s", "legacy/nixos"] })).toEqual([
      "live/k8s",
      "legacy/k8s",
    ]);
  });
});

describe("clusterDirs reproduces the hardcoded lists it replaces, order included", () => {
  test("grouped by ROOT then by name — the order the literal lists already used", () => {
    const root = fixture("live", ["stale/k8s"], ["live/k8s", "stale/k8s"]);
    expect(clusterDirs(["applications", "bootstrap"], root)).toEqual([
      "live/k8s/applications",
      "live/k8s/bootstrap",
      "stale/k8s/applications",
      "stale/k8s/bootstrap",
    ]);
    expect(applicationDirs(root)).toEqual(["live/k8s/applications", "stale/k8s/applications"]);
    expect(bootstrapDirs(root)).toEqual(["live/k8s/bootstrap", "stale/k8s/bootstrap"]);
  });

  test("existingClusterDirs drops absent subdirectories; clusterDirs does not", () => {
    // `fixture` creates only `<root>/bootstrap`, so `tests` is absent under both trees.
    // Both branches asserted, so this cannot pass by the filter never removing anything.
    const root = fixture("live", ["stale/k8s"], ["live/k8s", "stale/k8s"]);
    expect(clusterDirs(["tests"], root)).toEqual(["live/k8s/tests", "stale/k8s/tests"]);
    expect(existingClusterDirs(["tests"], root)).toEqual([]);
    expect(existingClusterDirs(["bootstrap"], root)).toEqual([
      "live/k8s/bootstrap",
      "stale/k8s/bootstrap",
    ]);
  });
});

describe("the refusal that replaces the hardcoded list's safety", () => {
  // The hazard a literal list did not have: a derived list can silently shrink, and a guard
  // scanning one fewer tree than it claims is the vacuity class. Both branches are exercised
  // so the assertion cannot pass by the refusal never being reachable.
  test("all declared roots present → no refusal", () => {
    const root = fixture("live", ["stale/k8s"], ["live/k8s", "stale/k8s"]);
    expect(() => bootstrapDirs(root)).not.toThrow();
    expect(bootstrapDirs(root)).toEqual(["live/k8s/bootstrap", "stale/k8s/bootstrap"]);
  });

  test("a declared root missing from disk → refuses, and NAMES the tree that vanished", () => {
    const root = fixture("live", ["stale/k8s"], ["live/k8s"]);
    expect(() => bootstrapDirs(root)).toThrow(/stale\/k8s/);
  });

  test("assertRootsPresent is the mechanism, and it is not vacuous on an empty list", () => {
    const root = fixture("live", [], ["live/k8s"]);
    expect(() => assertRootsPresent(["live/k8s"], root)).not.toThrow();
    expect(() => assertRootsPresent(["nope/k8s"], root)).toThrow(/nope\/k8s/);
  });
});

describe("roster shape is checked, not assumed", () => {
  test("a roster without survivingTree refuses rather than deriving nonsense", () => {
    const root = mkdtempSync(join(tmpdir(), "declared-trees-bad-"));
    mkdirSync(join(root, "src/Core.TypeScript/hygiene"), { recursive: true });
    writeFileSync(join(root, ROSTER_FILE), JSON.stringify({ stalePatterns: [] }));
    expect(() => readDeclaredTrees(root)).toThrow(/survivingTree/);
  });

  test("a roster whose stalePatterns is not a string array refuses", () => {
    const root = mkdtempSync(join(tmpdir(), "declared-trees-bad2-"));
    mkdirSync(join(root, "src/Core.TypeScript/hygiene"), { recursive: true });
    writeFileSync(join(root, ROSTER_FILE), JSON.stringify({ survivingTree: "live", stalePatterns: [1] }));
    expect(() => readDeclaredTrees(root)).toThrow(/stalePatterns/);
  });
});
