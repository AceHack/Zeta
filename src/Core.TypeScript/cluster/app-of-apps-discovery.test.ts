import { describe, expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DISCOVERED_BUT_UNASSERTED_REASONS,
  argocdGlobMatches,
  auditAppOfAppsDiscovery,
  compileArgocdGlob,
  discoverAppOfAppsRoots,
  formatDiscoveryDrift,
  listApplicationManifests,
} from "./app-of-apps-discovery.ts";

const ROOT_INCLUDE = "{*/Application.yaml,Application.yaml}";

/** A minimal but real app-of-apps root, so a temp tree has something governing it. */
function writeRoot(repoRoot: string, include: string, exclude: string): void {
  const dir = join(repoRoot, "full-ai-cluster/k8s/bootstrap");
  mkdirSync(dir, { recursive: true });
  const excludeLine = exclude.length === 0 ? "" : `      exclude: '${exclude}'\n`;
  writeFileSync(
    join(dir, "root-application.yaml"),
    "apiVersion: argoproj.io/v1alpha1\n" +
      "kind: Application\n" +
      "metadata:\n  name: temp-root\n  namespace: argocd\n" +
      "spec:\n  source:\n    repoURL: https://github.com/Lucent-Financial-Group/Zeta\n" +
      "    path: full-ai-cluster/k8s/applications\n" +
      "    directory:\n      recurse: true\n" +
      `      include: '${include}'\n` +
      excludeLine,
  );
}

function writeApplication(repoRoot: string, relPath: string, name: string): void {
  const path = join(repoRoot, "full-ai-cluster/k8s/applications", relPath);
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(
    path,
    "apiVersion: argoproj.io/v1alpha1\nkind: Application\n" +
      `metadata:\n  name: ${name}\n  namespace: argocd\n` +
      "spec:\n  source:\n    repoURL: https://github.com/Lucent-Financial-Group/Zeta\n" +
      `    path: full-ai-cluster/k8s/applications/${relPath.replace(/\/Application\.yaml$/, "")}\n`,
  );
}

function withTempRepo(body: (repoRoot: string) => void): void {
  const repoRoot = mkdtempSync(join(tmpdir(), "zeta-app-of-apps-"));
  try {
    body(repoRoot);
  } finally {
    rmSync(repoRoot, { recursive: true, force: true });
  }
}

describe("ArgoCD glob semantics", () => {
  /**
   * THE LOAD-BEARING ASSERTION.
   *
   * ArgoCD matches directory.include with glob.Match(include, relPath) and
   * passes NO separator runes, so gobwas/glob treats '/' as an ordinary
   * character and '*' crosses directory boundaries. Under filepath.Match or
   * doublestar semantics this expectation would be false, and the whole
   * conclusion about game-hosting/gmod would invert.
   */
  test("'*' is NOT path-segment bounded — it crosses '/'", () => {
    expect(argocdGlobMatches("*/Application.yaml", "game-hosting/gmod/Application.yaml")).toBe(true);
    expect(argocdGlobMatches("*/Application.yaml", "cdi/Application.yaml")).toBe(true);
    // Still needs the literal '/': a top-level file is why the root glob
    // carries a second alternative.
    expect(argocdGlobMatches("*/Application.yaml", "Application.yaml")).toBe(false);
    expect(argocdGlobMatches(ROOT_INCLUDE, "Application.yaml")).toBe(true);
  });

  test("the include glob does not match supporting manifests beside an Application", () => {
    expect(argocdGlobMatches(ROOT_INCLUDE, "kubevirt/kubevirt-cr.yaml")).toBe(false);
    expect(argocdGlobMatches(ROOT_INCLUDE, "game-hosting/gmod/statefulset.yaml")).toBe(false);
  });

  test("'**' in an exclude glob reaches every depth under the named directory", () => {
    expect(argocdGlobMatches("{longhorn/**,platform/**}", "longhorn/Application.yaml")).toBe(true);
    expect(argocdGlobMatches("{longhorn/**,platform/**}", "platform/examples/deep/Application.yaml")).toBe(true);
    expect(argocdGlobMatches("{longhorn/**,platform/**}", "loki/Application.yaml")).toBe(false);
  });

  test("an empty pattern matches nothing — a root with no include is not a root that includes all", () => {
    // ArgoCD skips the include test entirely when the field is empty; this
    // module must never read that as "matched", or a root without an include
    // would silently vouch for every file in the tree.
    expect(argocdGlobMatches("", "cdi/Application.yaml")).toBe(false);
  });

  test("a pattern this translator does not implement is REFUSED, never approximated", () => {
    expect(() => compileArgocdGlob("[abc]/Application.yaml")).toThrow(/does not implement/);
    expect(() => compileArgocdGlob("{a,b/Application.yaml")).toThrow(/unbalanced/);
    expect(() => compileArgocdGlob("a,b}/Application.yaml")).toThrow(/unbalanced/);
  });

  test("a comma outside braces is a literal, not an alternation", () => {
    expect(argocdGlobMatches("a,b/Application.yaml", "a,b/Application.yaml")).toBe(true);
    expect(argocdGlobMatches("a,b/Application.yaml", "a/Application.yaml")).toBe(false);
  });
});

describe("app-of-apps roots, discovered rather than listed", () => {
  test("both live roots are found, and both carry the same include glob", () => {
    const roots = discoverAppOfAppsRoots();
    const names = roots.map((root) => root.name).sort();
    expect(names).toContain("zeta-root");
    expect(names).toContain("zeta-root-dev");
    for (const root of roots) {
      expect(root.include, `include for ${root.name}`).toBe(ROOT_INCLUDE);
    }
    // Only the dev/CI root defers anything; the production root applies the
    // whole tree.
    expect(roots.find((root) => root.name === "zeta-root")?.exclude).toBe("");
    expect((roots.find((root) => root.name === "zeta-root-dev")?.exclude ?? "").length).toBeGreaterThan(0);
  });

  test("the nested Application is really in the tree and really reached by the root glob", () => {
    const manifests = listApplicationManifests();
    expect(manifests).toContain("game-hosting/gmod/Application.yaml");
    expect(argocdGlobMatches(ROOT_INCLUDE, "game-hosting/gmod/Application.yaml")).toBe(true);
  });
});

describe("discovery drift audit", () => {
  test("the live tree is clean", () => {
    const drift = auditAppOfAppsDiscovery();
    expect(drift.neverDiscovered).toEqual([]);
    expect(drift.unexplained).toEqual([]);
    expect(drift.stale).toEqual([]);
  });

  test("every registered reason is non-empty — an entry without a why is a mute button", () => {
    expect(DISCOVERED_BUT_UNASSERTED_REASONS.size).toBeGreaterThan(0);
    for (const [relPath, reason] of DISCOVERED_BUT_UNASSERTED_REASONS) {
      expect(reason.trim().length, `reason for ${relPath}`).toBeGreaterThan(0);
    }
  });

  /** RED CASE A: a manifest no root's include glob can reach. */
  test("an Application no root glob matches is reported as NEVER-DISCOVERED", () => {
    withTempRepo((repoRoot) => {
      writeRoot(repoRoot, ROOT_INCLUDE, "");
      writeApplication(repoRoot, "orphan/app.yaml", "orphan");
      const drift = auditAppOfAppsDiscovery(repoRoot);
      expect(drift.neverDiscovered).toEqual(["orphan/app.yaml"]);
      expect(formatDiscoveryDrift(drift)).toContain("NEVER-DISCOVERED");
    });
  });

  /** RED CASE B: a second nested Application, applied and unregistered. */
  test("a newly nested Application the roster cannot see is reported as UNASSERTED", () => {
    withTempRepo((repoRoot) => {
      writeRoot(repoRoot, ROOT_INCLUDE, "");
      writeApplication(repoRoot, "game-hosting/quake/Application.yaml", "quake");
      const drift = auditAppOfAppsDiscovery(repoRoot);
      expect(drift.unexplained).toContain("game-hosting/quake/Application.yaml");
      expect(formatDiscoveryDrift(drift)).toContain("UNASSERTED");
    });
  });

  /** A depth-1 Application IS in the roster, so it must NOT be reported. */
  test("a depth-1 Application is asserted by the roster and stays out of the gap", () => {
    withTempRepo((repoRoot) => {
      writeRoot(repoRoot, ROOT_INCLUDE, "");
      writeApplication(repoRoot, "newcomer/Application.yaml", "newcomer");
      const drift = auditAppOfAppsDiscovery(repoRoot);
      expect(drift.unexplained).toEqual([]);
      expect(drift.neverDiscovered).toEqual([]);
    });
  });

  /** An excluded directory is a deliberate deferral, not an unasserted gap. */
  test("a dev-root exclude keeps a nested Application out of the applied set", () => {
    withTempRepo((repoRoot) => {
      writeRoot(repoRoot, ROOT_INCLUDE, "");
      writeApplication(repoRoot, "platform/nested/Application.yaml", "nested-platform");
      // `platform/**` is excluded by the real dev catalog glob, which the audit
      // reads from buildRootDevCatalogManifest rather than from this test.
      const drift = auditAppOfAppsDiscovery(repoRoot);
      expect(drift.unexplained).toEqual([]);
    });
  });

  /** RED CASE C: a registry entry that no longer describes a real gap. */
  test("a registered manifest that is no longer in the gap is reported as STALE", () => {
    withTempRepo((repoRoot) => {
      writeRoot(repoRoot, ROOT_INCLUDE, "");
      writeApplication(repoRoot, "cdi/Application.yaml", "cdi");
      const drift = auditAppOfAppsDiscovery(repoRoot);
      expect(drift.stale).toEqual([...DISCOVERED_BUT_UNASSERTED_REASONS.keys()].sort());
      expect(formatDiscoveryDrift(drift)).toContain("STALE");
    });
  });
});
