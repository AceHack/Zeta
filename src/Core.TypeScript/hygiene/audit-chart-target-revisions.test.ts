// src/Core.TypeScript/hygiene/audit-chart-target-revisions.test.ts
//
// The falsifiers for the chart-resolvability audit.
//
// The load-bearing one is §THE LIVE TREE: a resolvability checker that passes
// on a tree containing a pin upstream never published is worthless. It used to
// be pinned by asserting that the real `oz` manifest produced a real finding --
// and on 2026-08-21 that pin was CORRECTED to ziti-controller 3.1.1, so the
// tree no longer carries the defect and that assertion could no longer be made.
//
// Deleting it would have quietly removed the only thing standing between this
// suite and a checker that passes because it stopped looking. So it is replaced
// rather than dropped: the real tree's real coordinate, re-pinned in memory to a
// version the real roster does not carry, must still be reported. Same property,
// same inputs, no defect required to remain in the tree to prove it.
//
// Everything else in this file is a rule-level falsifier for the ways that
// finding could be silently lost.

import { describe, expect, test } from "bun:test";
import { resolve } from "node:path";
import {
  ACKNOWLEDGED_UNPUBLISHED,
  type Acknowledgement,
  type Roster,
  acknowledgementKey,
  auditCoordinates,
  classifyRepoUrl,
  extractSources,
  extractTree,
  normalizeRepoUrl,
  ociTarget,
  parseAuthChallenge,
  readRoster,
  resolveTargetRevision,
  rosterKey,
  sameIgnoringTimestamps,
} from "./audit-chart-target-revisions.ts";

const REPO_ROOT = resolve(import.meta.dir, "../../..");

const NO_ACKS: ReadonlyMap<string, Acknowledgement> = new Map();

function rosterOf(entries: Roster["entries"]): Roster {
  return { note: "", refreshCommand: "", entries };
}

function manifest(body: string): string {
  return "apiVersion: argoproj.io/v1alpha1\nkind: Application\nmetadata:\n  name: probe\nspec:\n" + body;
}

// ---------------------------------------------------------------------------
describe("THE LIVE TREE -- the check must be able to fail, on the real repo", () => {
  // The whole point. If this test ever passes for the wrong reason -- because
  // the walk stopped finding manifests, or the snapshot stopped covering the
  // coordinate -- the assertions below say so instead of quietly going green.
  test("the real oz coordinate now RESOLVES -- the defect this audit was written for is gone", () => {
    const extraction = extractTree(REPO_ROOT);
    const oz = extraction.coordinates.find((c) => c.chart === "ziti-controller");
    expect(oz).toBeDefined();
    expect(oz?.manifest).toBe("full-ai-cluster/k8s/applications/oz/Application.yaml");
    expect(oz?.targetRevision).toBe("3.1.1");

    // With NO acknowledgements at all, the real tree against the real roster is
    // clean. That is a stronger statement than "the shipped register makes it
    // clean", and it is only sayable because the pin was fixed rather than
    // excused.
    expect(auditCoordinates(extraction, readRoster(), NO_ACKS).findings).toEqual([]);
  });

  test("and the check STILL FIRES on the real tree when a real pin names nothing", () => {
    // THE ANTI-VACUITY TEST, and the reason the one above is not enough. A
    // checker that has stopped walking, or a roster that has stopped covering
    // this coordinate, would also make the tree look clean. Here the real
    // extraction is re-pinned in memory to a version the real roster genuinely
    // does not carry, and the finding must come back -- naming the rule and the
    // version.
    const extraction = extractTree(REPO_ROOT);
    const mutated = {
      ...extraction,
      coordinates: extraction.coordinates.map((coordinate) =>
        coordinate.chart === "ziti-controller" ? { ...coordinate, targetRevision: "1.4.5" } : coordinate,
      ),
    };
    const report = auditCoordinates(mutated, readRoster(), NO_ACKS);
    const ozFinding = report.findings.find((finding) => finding.subject.includes("/oz/"));
    expect(ozFinding?.rule).toBe("target-revision-unpublished");
    expect(ozFinding?.detail).toContain("1.4.5");
  });

  test("the real snapshot genuinely lacks 1.4.5 and genuinely has 3.1.1 -- so both verdicts are about the world", () => {
    // Guards the vacuity case from both sides: an empty version list would make
    // any pin "unpublished", and a roster that listed everything would make any
    // pin resolve. Neither is what is happening.
    const entry = readRoster().entries[rosterKey("https://docs.openziti.io/helm-charts/", "ziti-controller")];
    expect(entry).toBeDefined();
    expect(entry?.versions.length).toBeGreaterThan(50);
    expect(entry?.versions).not.toContain("1.4.5");
    expect(entry?.versions).toContain("1.3.4");
    expect(entry?.versions).toContain("3.1.1");
  });

  test("the live tree is fully classified -- every source is a chart or a git path, none dropped", () => {
    const extraction = extractTree(REPO_ROOT);
    expect(extraction.findings).toEqual([]);
    expect(extraction.coordinates.length).toBeGreaterThanOrEqual(35);
    expect(extraction.gitPaths.length).toBeGreaterThanOrEqual(11);
  });

  test("the register is EMPTY, and an empty register is the target state", () => {
    // It held exactly one entry -- oz@1.4.5 -- and it was retired by fixing the
    // pin, not by re-keying it to oz@3.1.1. Re-keying would have preserved a
    // "this pin does not resolve" claim that had stopped being true.
    expect(ACKNOWLEDGED_UNPUBLISHED.size).toBe(0);
  });

  test("with the shipped register the live tree is clean, and every acknowledgement is still live", () => {
    const extraction = extractTree(REPO_ROOT);
    const report = auditCoordinates(extraction, readRoster());
    expect(report.findings).toEqual([]);
    // A register entry that no longer matches a finding must fail as stale --
    // this asserts the shipped ones all still do match.
    expect(report.acknowledged.length).toBe(ACKNOWLEDGED_UNPUBLISHED.size);
  });

  test("every shipped acknowledgement carries a workitem, a date and a reason", () => {
    for (const [key, ack] of ACKNOWLEDGED_UNPUBLISHED) {
      expect(ack.workitem).toMatch(/^[0-9A-Z]{26}$/);
      expect(ack.recordedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(ack.reason.length).toBeGreaterThan(80);
      expect(key.split("|").length).toBe(3);
    }
  });
});

// ---------------------------------------------------------------------------
describe("extraction", () => {
  test("a chart source becomes a coordinate", () => {
    const { coordinates, gitPaths, findings } = extractSources(
      "a.yaml",
      manifest("  source:\n    repoURL: https://example.test/charts\n    chart: thing\n    targetRevision: 1.2.3\n"),
    );
    expect(findings).toEqual([]);
    expect(gitPaths).toEqual([]);
    expect(coordinates).toHaveLength(1);
    expect(coordinates[0]?.chart).toBe("thing");
    expect(coordinates[0]?.kind).toBe("helm-index");
  });

  test("spec.sources (plural) is walked, and each element keeps its index", () => {
    const { coordinates, gitPaths } = extractSources(
      "a.yaml",
      manifest(
        "  sources:\n" +
          "    - repoURL: https://example.test/charts\n      chart: one\n      targetRevision: 1.0.0\n" +
          "    - repoURL: https://github.com/o/r\n      path: k8s\n      targetRevision: main\n",
      ),
    );
    expect(coordinates.map((c) => [c.chart, c.sourceIndex])).toEqual([["one", 0]]);
    expect(gitPaths.map((g) => [g.path, g.sourceIndex])).toEqual([["k8s", 1]]);
  });

  test("a git-path source is classified, never turned into a chart coordinate", () => {
    const { coordinates, gitPaths, findings } = extractSources(
      "a.yaml",
      manifest("  source:\n    repoURL: https://github.com/o/r\n    path: k8s/app\n    targetRevision: main\n"),
    );
    expect(findings).toEqual([]);
    expect(coordinates).toEqual([]);
    expect(gitPaths).toHaveLength(1);
  });

  test("a source with NEITHER chart nor path is a finding, not a skip", () => {
    const { findings } = extractSources(
      "a.yaml",
      manifest("  source:\n    repoURL: https://example.test/charts\n    targetRevision: 1.0.0\n"),
    );
    expect(findings.map((f) => f.rule)).toEqual(["source-unclassifiable"]);
  });

  test("a source with BOTH chart and path is a finding -- the file will not guess", () => {
    const { findings, coordinates, gitPaths } = extractSources(
      "a.yaml",
      manifest(
        "  source:\n    repoURL: https://example.test/c\n    chart: thing\n    path: k8s\n    targetRevision: 1.0.0\n",
      ),
    );
    expect(findings.map((f) => f.rule)).toEqual(["source-unclassifiable"]);
    expect(coordinates).toEqual([]);
    expect(gitPaths).toEqual([]);
  });

  test("a source with no targetRevision is a finding -- an unpinned deploy is not `resolvable`", () => {
    const { findings } = extractSources(
      "a.yaml",
      manifest("  source:\n    repoURL: https://example.test/c\n    chart: thing\n"),
    );
    expect(findings.map((f) => f.rule)).toEqual(["source-unclassifiable"]);
  });

  test("unparseable YAML is a finding, NOT a skip", () => {
    const { findings, coordinates } = extractSources("a.yaml", "kind: Application\napiVersion: argoproj.io/v1\n\ta: [");
    expect(findings.map((f) => f.rule)).toEqual(["manifest-unparseable"]);
    expect(coordinates).toEqual([]);
  });

  test("a non-Application document is not a finding -- only Argo Applications are in scope", () => {
    const { findings, coordinates, gitPaths } = extractSources("a.yaml", "apiVersion: v1\nkind: ConfigMap\n");
    expect([findings.length, coordinates.length, gitPaths.length]).toEqual([0, 0, 0]);
  });

  test("a numeric targetRevision survives YAML's number coercion", () => {
    const { coordinates } = extractSources(
      "a.yaml",
      manifest("  source:\n    repoURL: https://example.test/c\n    chart: thing\n    targetRevision: 1.4\n"),
    );
    expect(coordinates[0]?.targetRevision).toBe("1.4");
  });
});

// ---------------------------------------------------------------------------
describe("repository classification", () => {
  test("https is a classic index repo; oci:// and a bare host are OCI", () => {
    expect(classifyRepoUrl("https://charts.jetstack.io")).toBe("helm-index");
    expect(classifyRepoUrl("oci://ghcr.io/a/b")).toBe("oci");
    expect(classifyRepoUrl("ghcr.io/actions/actions-runner-controller-charts")).toBe("oci");
  });

  test("a trailing slash does not fork one repository into two roster keys", () => {
    expect(rosterKey("https://charts.jetstack.io/", "cert-manager")).toBe(
      rosterKey("https://charts.jetstack.io", "cert-manager"),
    );
    expect(normalizeRepoUrl("https://x.test///")).toBe("https://x.test");
  });

  test("OCI target splits host from repository, with or without the scheme", () => {
    expect(ociTarget("oci://ghcr.io/a/b", "c")).toEqual({ host: "ghcr.io", repository: "a/b/c" });
    expect(ociTarget("ghcr.io/a/b", "c")).toEqual({ host: "ghcr.io", repository: "a/b/c" });
  });

  test("the Bearer challenge is READ, not guessed -- code.forgejo.org is the case that proves it", () => {
    const fields = parseAuthChallenge(
      'Bearer realm="https://code.forgejo.org/v2/token",service="container_registry",scope="*"',
    );
    // Guessing `https://<host>/token?service=<host>` gives a 401 that reads
    // exactly like "this chart does not exist".
    expect(fields.realm).toBe("https://code.forgejo.org/v2/token");
    expect(fields.service).toBe("container_registry");
  });
});

// ---------------------------------------------------------------------------
describe("resolution", () => {
  const published = ["1.0.0", "1.3.4", "2.0.0", "v3.1.0"];

  test("an exact match resolves, including a `v`-prefixed published string", () => {
    expect(resolveTargetRevision("1.3.4", published).outcome).toBe("exact");
    expect(resolveTargetRevision("v3.1.0", published).outcome).toBe("exact");
  });

  test("a version upstream never published is `unpublished`", () => {
    expect(resolveTargetRevision("1.4.5", published).outcome).toBe("unpublished");
  });

  test("a semver RANGE resolves when some published version satisfies it, and not otherwise", () => {
    expect(resolveTargetRevision("^1.0.0", published)).toEqual({ outcome: "range", matched: "1.3.4" });
    expect(resolveTargetRevision("^9.0.0", published).outcome).toBe("unpublished");
  });

  test("a pin that is neither a version nor a range is `unresolvable`, reported apart from `unpublished`", () => {
    expect(resolveTargetRevision("main", published).outcome).toBe("unresolvable");
  });

  test("an empty published list cannot make a pin look resolvable", () => {
    expect(resolveTargetRevision("1.0.0", []).outcome).toBe("unpublished");
  });
});

// ---------------------------------------------------------------------------
describe("the audit's refusals", () => {
  const coordinate = manifest(
    "  source:\n    repoURL: https://example.test/charts\n    chart: thing\n    targetRevision: 9.9.9\n",
  );
  const extraction = extractSources("app/Application.yaml", coordinate);
  const key = rosterKey("https://example.test/charts", "thing");

  test("a coordinate the snapshot does not cover FAILS -- an unchecked pin never shares an exit code with a checked one", () => {
    const report = auditCoordinates(extraction, rosterOf({}), NO_ACKS);
    expect(report.findings.map((f) => f.rule)).toEqual(["roster-entry-missing"]);
    expect(report.resolvedCount).toBe(0);
  });

  test("an `unreachable` repository is its own rule, distinct from `unpublished`", () => {
    const report = auditCoordinates(
      extraction,
      rosterOf({
        [key]: {
          repoURL: "https://example.test/charts",
          chart: "thing",
          kind: "helm-index",
          fetchedAt: "2026-08-21T00:00:00Z",
          versions: [],
          unreachable: "HTTP 404",
        },
      }),
      NO_ACKS,
    );
    expect(report.findings.map((f) => f.rule)).toEqual(["repository-unreachable"]);
    expect(report.findings[0]?.detail).toContain("HTTP 404");
  });

  test("a resolvable pin produces nothing and is counted", () => {
    const report = auditCoordinates(
      extraction,
      rosterOf({
        [key]: {
          repoURL: "https://example.test/charts",
          chart: "thing",
          kind: "helm-index",
          fetchedAt: "2026-08-21T00:00:00Z",
          versions: ["9.9.9"],
        },
      }),
      NO_ACKS,
    );
    expect(report.findings).toEqual([]);
    expect(report.resolvedCount).toBe(1);
  });

  test("an empty tree is a finding -- an audit that finds nothing to audit must not report success", () => {
    const report = auditCoordinates({ coordinates: [], gitPaths: [], findings: [] }, rosterOf({}), NO_ACKS);
    expect(report.findings.map((f) => f.rule)).toEqual(["no-applications-found"]);
  });

  test("a snapshot entry the tree no longer references is drift, and is reported", () => {
    const report = auditCoordinates(
      {
        coordinates: [],
        gitPaths: [{ manifest: "a", appName: "a", sourceIndex: 0, repoURL: "r", path: "p", targetRevision: "main" }],
        findings: [],
      },
      rosterOf({
        "https://gone.test|chart": {
          repoURL: "https://gone.test",
          chart: "chart",
          kind: "helm-index",
          fetchedAt: "2026-08-21T00:00:00Z",
          versions: ["1.0.0"],
        },
      }),
      NO_ACKS,
    );
    expect(report.findings.map((f) => f.rule)).toEqual(["roster-entry-orphaned"]);
  });
});

// ---------------------------------------------------------------------------
describe("the acknowledgement register is not an allowlist", () => {
  const extraction = extractSources(
    "app/Application.yaml",
    manifest("  source:\n    repoURL: https://example.test/charts\n    chart: thing\n    targetRevision: 9.9.9\n"),
  );
  const roster = rosterOf({
    [rosterKey("https://example.test/charts", "thing")]: {
      repoURL: "https://example.test/charts",
      chart: "thing",
      kind: "helm-index",
      fetchedAt: "2026-08-21T00:00:00Z",
      versions: ["1.0.0"],
    },
  });
  const ack: Acknowledgement = { workitem: "W", recordedOn: "2026-08-21", reason: "because" };
  const liveKey = acknowledgementKey({ manifest: "app/Application.yaml", chart: "thing", targetRevision: "9.9.9" });

  test("an acknowledged finding is still REPORTED -- it moves lists, it does not vanish", () => {
    const report = auditCoordinates(extraction, roster, new Map([[liveKey, ack]]));
    expect(report.findings).toEqual([]);
    expect(report.acknowledged).toHaveLength(1);
    expect(report.acknowledged[0]?.detail).toContain("ACKNOWLEDGED 2026-08-21");
  });

  test("the key is PIN-EXACT: change the version and the acknowledgement stops applying", () => {
    const staleKey = acknowledgementKey({ manifest: "app/Application.yaml", chart: "thing", targetRevision: "8.8.8" });
    const report = auditCoordinates(extraction, roster, new Map([[staleKey, ack]]));
    expect(report.findings.map((f) => f.rule).sort()).toEqual(["acknowledgement-stale", "target-revision-unpublished"]);
  });

  test("an acknowledgement whose pin has become resolvable fails as stale", () => {
    const resolvable = rosterOf({
      [rosterKey("https://example.test/charts", "thing")]: {
        repoURL: "https://example.test/charts",
        chart: "thing",
        kind: "helm-index",
        fetchedAt: "2026-08-21T00:00:00Z",
        versions: ["9.9.9"],
      },
    });
    const report = auditCoordinates(extraction, resolvable, new Map([[liveKey, ack]]));
    expect(report.findings.map((f) => f.rule)).toEqual(["acknowledgement-stale"]);
  });

  test("an acknowledgement also covers `repository-unreachable`, and drift-checks the same way", () => {
    const unreachable = rosterOf({
      [rosterKey("https://example.test/charts", "thing")]: {
        repoURL: "https://example.test/charts",
        chart: "thing",
        kind: "helm-index",
        fetchedAt: "2026-08-21T00:00:00Z",
        versions: [],
        unreachable: "HTTP 404",
      },
    });
    const report = auditCoordinates(extraction, unreachable, new Map([[liveKey, ack]]));
    expect(report.findings).toEqual([]);
    expect(report.acknowledged.map((f) => f.rule)).toEqual(["repository-unreachable"]);
  });
});

// ---------------------------------------------------------------------------
describe("the refresh lane's change signal", () => {
  test("a signal that is always on carries no information -- fetchedAt alone is not a change", () => {
    const a = '{\n  "fetchedAt": "2026-08-21T00:00:00Z",\n  "versions": ["1.0.0"]\n}\n';
    const b = '{\n  "fetchedAt": "2026-08-22T00:00:00Z",\n  "versions": ["1.0.0"]\n}\n';
    expect(sameIgnoringTimestamps(a, b)).toBe(true);
  });

  test("a new published version IS a change", () => {
    const a = '{\n  "fetchedAt": "2026-08-21T00:00:00Z",\n  "versions": ["1.0.0"]\n}\n';
    const b = '{\n  "fetchedAt": "2026-08-22T00:00:00Z",\n  "versions": ["1.0.0", "1.0.1"]\n}\n';
    expect(sameIgnoringTimestamps(a, b)).toBe(false);
  });
});
