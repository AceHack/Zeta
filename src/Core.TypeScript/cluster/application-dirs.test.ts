import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import { laneScopedExcludeGlob, listApplicationDirs, parseLaneDirs } from "./application-dirs.ts";
import { discoverExpectedApplications, rootDevCatalogExcludedDirs } from "./argocd-health-test.ts";
import {
  balancedAsPartition,
  buildModel,
  laneDirs,
  loadCatalogue,
  METAL_FIRST_BOOT_BASE,
  packBalanced,
} from "./lane-partition.ts";
import { rootDevCatalogExcludeGlobFor, type ClusterControlPlane } from "./ports.ts";
import { gitOpsAppCatalog } from "./adapters/gitops-app-catalog.ts";

const REPO_ROOT = resolve(import.meta.dir, "..", "..", "..");

describe("application directories match what ArgoCD applies", () => {
  test("depth 2: the nested game-hosting/gmod is discovered", () => {
    expect(listApplicationDirs(REPO_ROOT)).toContain("game-hosting/gmod");
  });

  // The partition and the harness used to disagree, 49 vs 48, because the
  // harness walked depth 1. One module now serves both.
  test("the harness and the partition roster count the same Applications", () => {
    const model = buildModel({ repoRoot: REPO_ROOT, rung: "dev" });
    expect(discoverExpectedApplications(REPO_ROOT).length).toBe(model.roster.length);
    expect(listApplicationDirs(REPO_ROOT).length).toBe(model.roster.length);
  });
});

describe("laneScopedExcludeGlob", () => {
  const all = ["a", "b", "c/d"];

  test("no lane returns the base glob verbatim -- existing callers unchanged", () => {
    expect(laneScopedExcludeGlob("{x/**}", null, all)).toBe("{x/**}");
  });

  test("every non-lane directory is excluded, nested ones included", () => {
    expect(laneScopedExcludeGlob("{x/**}", ["a"], all)).toBe("{b/**,c/d/**,x/**}");
  });

  test("base deferrals survive even when the lane contains the deferred chart", () => {
    expect(laneScopedExcludeGlob("{a/**}", ["a", "b"], all)).toContain("a/**");
  });

  // A typo would exclude the real chart and assert nothing about it.
  test("a lane naming a directory that does not exist throws", () => {
    expect(() => laneScopedExcludeGlob("{}", ["nope"], all)).toThrow(/do not exist/);
  });

  test("an empty --lane-dirs is refused, not read as 'no lane'", () => {
    expect(() => parseLaneDirs(" , ")).toThrow(/names no directories/);
    expect(parseLaneDirs(undefined)).toBeNull();
  });
});

// THE INVARIANT THIS WHOLE CHANGE EXISTS FOR. For every balanced lane, on both
// substrates, the directories the root catalogue does NOT exclude must be
// exactly the directories the harness expects. If they differ, a lane either
// hangs on a chart nobody deployed or goes green without looking at one it did.
describe("apply and assert are one list, for every real lane", () => {
  const model = buildModel({ repoRoot: REPO_ROOT, rung: "dev" });
  const partition = balancedAsPartition(
    model,
    packBalanced(model, loadCatalogue("metal", REPO_ROOT), { targetLanes: 6, base: METAL_FIRST_BOOT_BASE }),
  );
  const all = listApplicationDirs(REPO_ROOT);

  test("the balanced partition produced lanes (control)", () => {
    expect(partition.lanes.length).toBeGreaterThan(0);
  });

  for (const provider of ["kind", "k3d"] as const) {
    test(`${provider}: applied set == expected set, per lane`, () => {
      for (const lane of partition.lanes) {
        const dirs = laneDirs(model, lane);
        const glob = laneScopedExcludeGlob(rootDevCatalogExcludeGlobFor(provider, "kindnetd"), dirs, all);
        const excluded = rootDevCatalogExcludedDirs(glob);
        const applied = all.filter((d) => !excluded.has(d)).toSorted();
        const expected = discoverExpectedApplications(REPO_ROOT, provider, "kindnetd", dirs)
          .map((a) => a.dir)
          .filter((d) => !excluded.has(d))
          .toSorted();
        const expectedAll = discoverExpectedApplications(REPO_ROOT, provider, "kindnetd", dirs).map((a) => a.dir);
        // nothing outside the lane is expected at all
        for (const d of expectedAll) expect(dirs).toContain(d);
        expect(expected).toEqual(applied);
      }
    });
  }

  test("every Application is a lane subject or named infeasible -- none vanish", () => {
    const subjects = new Set(partition.lanes.flatMap((l) => l.assigned));
    const named = new Set([...partition.oversize, ...partition.unpriced].map((q) => q.name));
    for (const r of model.roster) expect(subjects.has(r.name) || named.has(r.name)).toBe(true);
  });
});

// THROUGH THE REAL ADAPTER. The lockstep test above computes the glob itself, so
// it would stay green if the adapter that actually APPLIES the catalogue ignored
// the lane. This drives `gitOpsAppCatalog` with a control plane that records the
// manifest instead of applying it, and reads the exclude that would have shipped.
describe("the applicator ships the lane-scoped exclude", () => {
  function captured(laneDirsArg: readonly string[] | null): string {
    let manifest = "";
    const recorder = new Proxy({} as ClusterControlPlane, {
      get: (_t, prop) =>
        prop === "applyInlineManifest"
          ? (m: string) => {
              manifest = m;
            }
          : () => undefined,
    });
    gitOpsAppCatalog(recorder, undefined, REPO_ROOT).applyRootDevCatalog("main", "https://example.invalid/repo.git", "k3d", "kindnetd", laneDirsArg);
    const m = /exclude: '([^']*)'/.exec(manifest);
    if (m?.[1] === undefined) throw new Error("no exclude in the applied manifest");
    return m[1];
  }

  test("no lane ships the substrate glob unchanged", () => {
    expect(captured(null)).toBe(rootDevCatalogExcludeGlobFor("k3d", "kindnetd"));
  });

  test("a lane ships exactly laneScopedExcludeGlob for that lane", () => {
    const dirs = ["argocd", "cert-manager"];
    expect(captured(dirs)).toBe(
      laneScopedExcludeGlob(rootDevCatalogExcludeGlobFor("k3d", "kindnetd"), dirs, listApplicationDirs(REPO_ROOT)),
    );
    expect(captured(dirs)).toContain("vllm/**");
  });
});
