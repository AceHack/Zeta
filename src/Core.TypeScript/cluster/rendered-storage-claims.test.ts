// Falsifiers for `rendered-storage-claims.ts`.
//
// The thing under test is a REFUSAL, so every test here is built the same way:
// construct the defect, assert it is refused, then construct the corrected form
// and assert it passes. A test that only exercises the passing case cannot tell
// a working checker from a `return []`.

import { test, expect, describe } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  includeMatcher,
  extractRenderedPvcs,
  compareRenderedToDeclared,
  effectiveStorageClass,
  clusterDefaultStorageClass,
  adjudicate,
  loadBaseline,
  loadSnapshot,
  snapshotDrift,
  auditAgainstSnapshot,
  auditExitCode,
  renderApplication,
  discoverApplications,
  declaredExpectations,
  renderedTotalsByClass,
  declaredTotalGib,
  activeStorageProfile,
  parseArgs,
  type RenderedPvc,
  type DeclaredExpectation,
  type UnrenderableApp,
  type ApplicationSource,
} from "./rendered-storage-claims.ts";
import { loadCatalogue, verifyProfileApplied } from "./storage-profiles.ts";

const pvc = (over: Partial<RenderedPvc> = {}): RenderedPvc => ({
  appId: "t/app",
  origin: "volumeClaimTemplate",
  name: "data/app",
  workload: "StatefulSet/app",
  storageClassName: "longhorn",
  size: "10Gi",
  gibibytes: 10,
  count: 1,
  ...over,
});

const declared = (over: Partial<DeclaredExpectation> = {}): DeclaredExpectation => ({
  claimId: "t/app/data",
  app: "t/app",
  pattern: "^data/app$",
  size: "10Gi",
  gibibytes: 10,
  storageClass: "longhorn",
  pods: 1,
  ...over,
});

const compare = (
  expectations: readonly DeclaredExpectation[],
  rendered: readonly RenderedPvc[],
  unrenderable: readonly UnrenderableApp[] = [],
  clusterDefault: string | null = "zeta-local-path",
): readonly ReturnType<typeof compareRenderedToDeclared>[number][] =>
  compareRenderedToDeclared({ expectations, rendered, unrenderable, clusterDefault });

// ---------------------------------------------------------------------------
// THE THREE FIXTURES THE BRIEF NAMES: a wrong size, a wrong class, and an
// undeclared PVC are each refused, and each corrected form passes.
// ---------------------------------------------------------------------------

describe("a declared SIZE that the chart does not render", () => {
  test("is refused, and the delta is reported in GiB", () => {
    const findings = compare([declared({ size: "10Gi", gibibytes: 10 })], [pvc({ size: "8Gi", gibibytes: 8 })]);
    expect(findings.map((finding) => finding.kind)).toEqual(["size-mismatch"]);
    expect(findings[0]?.problem).toContain("declares 10Gi");
    expect(findings[0]?.problem).toContain("renders 8Gi");
    expect(findings[0]?.deltaGib).toBe(-2);
  });

  test("the CORRECTED form passes — the checker is not simply always-red", () => {
    expect(compare([declared({ size: "8Gi", gibibytes: 8 })], [pvc({ size: "8Gi", gibibytes: 8 })])).toEqual([]);
  });
});

describe("a declared storageClass that the chart does not render", () => {
  test("blank storageClassName is refused as the CLUSTER DEFAULT, not as a match", () => {
    const findings = compare([declared({ storageClass: "longhorn" })], [pvc({ storageClassName: "" })]);
    expect(findings.map((finding) => finding.kind)).toEqual(["storage-class-mismatch"]);
    expect(findings[0]?.problem).toContain('binds the cluster default "zeta-local-path"');
  });

  test("an explicitly WRONG class is refused too", () => {
    const findings = compare([declared({ storageClass: "longhorn" })], [pvc({ storageClassName: "zeta-local-path" })]);
    expect(findings.map((finding) => finding.kind)).toEqual(["storage-class-mismatch"]);
  });

  test("size alone would have MISSED this — the case that motivates comparing both", () => {
    // Identical sizes, different disks. A size-only checker returns clean here,
    // which is exactly how hindsight passed every check in the repo for months.
    const findings = compare(
      [declared({ size: "8Gi", gibibytes: 8 })],
      [pvc({ size: "8Gi", gibibytes: 8, storageClassName: "" })],
    );
    expect(findings.map((finding) => finding.kind)).toEqual(["storage-class-mismatch"]);
  });

  test("the CORRECTED form passes", () => {
    expect(compare([declared({ storageClass: "longhorn" })], [pvc({ storageClassName: "longhorn" })])).toEqual([]);
  });

  test("with NO cluster default declared, a blank class is UNKNOWN — refused, never resolved favourably", () => {
    const findings = compare([declared()], [pvc({ storageClassName: "" })], [], null);
    expect(findings.map((finding) => finding.kind)).toEqual(["unknown-default-storage-class"]);
    expect(findings[0]?.problem).toContain("UNKNOWN");
  });
});

describe("a rendered PVC that no declaration covers", () => {
  test("is refused, with its full GiB cost", () => {
    const findings = compare([], [pvc({ size: "50Gi", gibibytes: 50, count: 3 })]);
    expect(findings.map((finding) => finding.kind)).toEqual(["undeclared-rendered-pvc"]);
    expect(findings[0]?.deltaGib).toBe(150);
    expect(findings[0]?.problem).toContain("150 GiB of real disk that no profile total includes");
  });

  test("the CORRECTED form — adding the declaration — passes", () => {
    expect(
      compare([declared({ size: "50Gi", gibibytes: 50, pods: 3 })], [pvc({ size: "50Gi", gibibytes: 50, count: 3 })]),
    ).toEqual([]);
  });

  test("a declaration whose pattern matches nothing does NOT cover the PVC it was meant to", () => {
    const findings = compare([declared({ pattern: "^data/typo$" })], [pvc({ name: "data/app" })]);
    expect(findings.map((finding) => finding.kind).sort()).toEqual([
      "declared-never-rendered",
      "undeclared-rendered-pvc",
    ]);
  });
});

describe("an UNPARSEABLE rendered size is unknown, never zero", () => {
  test("a matched claim whose render carries a junk quantity is refused, not summed as 0", () => {
    const findings = compare([declared()], [pvc({ size: "lots", gibibytes: null })]);
    expect(findings.map((finding) => finding.kind)).toEqual(["unparseable-rendered-size"]);
    expect(findings[0]?.problem).toContain("refused rather than folded in as zero");
  });

  test("an UNDECLARED PVC with a junk quantity does not read as 0 GiB of disk", () => {
    const findings = compare([], [pvc({ size: "lots", gibibytes: null })]);
    expect(findings[0]?.problem).toContain("an UNPARSEABLE amount");
  });

  test("it lands in its own totals bucket rather than inflating a class total's credibility", () => {
    const totals = renderedTotalsByClass([pvc({ size: "lots", gibibytes: null })], "zeta-local-path");
    expect([...totals.keys()]).toEqual(["longhorn (UNPARSEABLE SIZE)"]);
  });
});

// ---------------------------------------------------------------------------
// BOTH DIRECTIONS. Disabling either one is a mutation the suite must catch.
// ---------------------------------------------------------------------------

describe("both directions are load-bearing", () => {
  test("direction 1 alone would miss an undeclared consumer", () => {
    const findings = compare([declared()], [pvc(), pvc({ name: "other/app", size: "99Gi", gibibytes: 99 })]);
    expect(findings.map((finding) => finding.kind)).toEqual(["undeclared-rendered-pvc"]);
  });

  test("direction 2 alone would miss a stale row inflating the total", () => {
    const findings = compare(
      [declared(), declared({ claimId: "t/app/ghost", pattern: "^ghost$", gibibytes: 40, pods: 2 })],
      [pvc()],
    );
    expect(findings.map((finding) => finding.kind)).toEqual(["declared-never-rendered"]);
    expect(findings[0]?.deltaGib).toBe(-80);
  });
});

// ---------------------------------------------------------------------------
// POD COUNT — mimir's trap, and the general rule that a claim's cost is
// size x pods.
// ---------------------------------------------------------------------------

describe("pod count", () => {
  test("a volumeClaimTemplate on a replicas:3 StatefulSet is THREE PVCs", () => {
    const [claim] = extractRenderedPvcs("t/app", [
      {
        kind: "StatefulSet",
        metadata: { name: "cockroachdb" },
        spec: {
          replicas: 3,
          volumeClaimTemplates: [
            {
              metadata: { name: "datadir" },
              spec: { storageClassName: "longhorn", resources: { requests: { storage: "48Gi" } } },
            },
          ],
        },
      },
    ]);
    expect(claim?.count).toBe(3);
    expect(claim?.name).toBe("datadir/cockroachdb");
  });

  test("an ABSENT replicas is ONE pod, not zero", () => {
    const [claim] = extractRenderedPvcs("t/app", [
      {
        kind: "StatefulSet",
        metadata: { name: "x" },
        spec: {
          volumeClaimTemplates: [{ metadata: { name: "d" }, spec: { resources: { requests: { storage: "1Gi" } } } }],
        },
      },
    ]);
    expect(claim?.count).toBe(1);
  });

  test("mimir's zone StatefulSets sum to the declared pod count without a replica scalar anywhere", () => {
    const zones = ["a", "b", "c"].map((zone) => ({
      kind: "StatefulSet",
      metadata: { name: `mimir-ingester-zone-${zone}` },
      spec: {
        replicas: 1,
        volumeClaimTemplates: [
          {
            metadata: { name: "storage" },
            spec: { storageClassName: "longhorn", resources: { requests: { storage: "16Gi" } } },
          },
        ],
      },
    }));
    const rendered = extractRenderedPvcs("full-ai-cluster/mimir", zones);
    expect(rendered).toHaveLength(3);
    expect(
      compare(
        [
          declared({
            claimId: "mimir/ingester",
            app: "full-ai-cluster/mimir",
            pattern: "^storage/mimir-ingester-zone-[a-c]$",
            size: "16Gi",
            gibibytes: 16,
            pods: 3,
          }),
        ],
        rendered,
      ),
    ).toEqual([]);
  });

  test("declaring 3 pods against a render of 1 is refused with the GiB it costs", () => {
    const findings = compare([declared({ pods: 3 })], [pvc({ count: 1 })]);
    expect(findings.map((finding) => finding.kind)).toEqual(["pod-count-mismatch"]);
    expect(findings[0]?.deltaGib).toBe(-20);
  });
});

// ---------------------------------------------------------------------------
// UNRENDERABLE IS NOT A SKIP
// ---------------------------------------------------------------------------

describe("unrenderable", () => {
  const broken: UnrenderableApp = {
    appId: "t/app",
    chart: "c",
    targetRevision: "1.0.0",
    reason: "helm-pull-failed",
    detail: "withdrawn tag",
    unchecked: ["t/app/data"],
  };

  test("an unrenderable app produces NO finding for its claims — they are UNCHECKED, not passed", () => {
    expect(compare([declared()], [], [broken])).toEqual([]);
  });

  test("but the audit still fails when the unrenderable app is not acknowledged", () => {
    const result = auditAgainstSnapshot(
      {
        measuredOn: "2026-08-21",
        clusterDefaultStorageClass: "zeta-local-path",
        rendered: [],
        unrenderable: [broken],
        appsDiscovered: 1,
      },
      { baselinePath: "src/Core.TypeScript/cluster/does-not-exist.json" },
    );
    expect(result.unacknowledgedUnrenderable.length).toBeGreaterThan(0);
    expect(auditExitCode(result)).toBe(1);
  });

  // M5 IN THE MUTATION RUN SURVIVED WITHOUT THIS TEST. Deleting
  // `unacknowledgedUnrenderable` from `auditExitCode` left the suite green,
  // because the test above ran against the real catalogue where 22 rows were
  // ALSO refused — so the exit code was 1 for a reason that had nothing to do
  // with the unrenderable app. A test that passes for the wrong reason is a
  // check that did not run. These isolate the three exit-code inputs.
  test("an UNACKNOWLEDGED unrenderable app alone is enough to fail — nothing else refused", () => {
    const clean = {
      profile: "measured",
      appsDiscovered: 1,
      appsRendered: 0,
      unrenderable: [broken],
      unacknowledgedUnrenderable: [broken],
      rendered: [],
      expectations: [],
      refused: [],
      acknowledged: [],
      staleBaselineKeys: [],
      clusterDefault: "zeta-local-path",
    };
    expect(auditExitCode(clean)).toBe(1);
    expect(auditExitCode({ ...clean, unrenderable: [], unacknowledgedUnrenderable: [] })).toBe(0);
  });

  test("a STALE baseline entry alone is enough to fail", () => {
    const clean = {
      profile: "measured",
      appsDiscovered: 0,
      appsRendered: 0,
      unrenderable: [],
      unacknowledgedUnrenderable: [],
      rendered: [],
      expectations: [],
      refused: [],
      acknowledged: [],
      staleBaselineKeys: ["size gone/away"],
      clusterDefault: null,
    };
    expect(auditExitCode(clean)).toBe(1);
    expect(auditExitCode({ ...clean, staleBaselineKeys: [] })).toBe(0);
  });

  test("the acknowledgement key carries the VERSION, so a bump invalidates rather than inherits", () => {
    const baseline = loadBaseline();
    expect(baseline.unrenderable.map((entry) => entry.key)).toContain("full-ai-cluster/oz@1.4.5");
    for (const entry of baseline.unrenderable) expect(entry.key).toMatch(/@\S+$/);
  });
});

// ---------------------------------------------------------------------------
// BASELINE
// ---------------------------------------------------------------------------

describe("baseline", () => {
  const finding = {
    kind: "size-mismatch" as const,
    key: "size t/app/data",
    claimId: "t/app/data",
    deltaGib: -2,
    problem: "declares 10Gi, renders 8Gi",
  };

  test("an acknowledged finding is not refused", () => {
    const result = adjudicate([finding], {
      findings: [{ key: finding.key, reason: "r", liftsWhen: "w", observed: finding.problem }],
      unrenderable: [],
    });
    expect(result.refused).toEqual([]);
    expect(result.acknowledged).toHaveLength(1);
  });

  test("an acknowledgement whose OBSERVED text has changed stops covering the finding", () => {
    const result = adjudicate([finding], {
      findings: [{ key: finding.key, reason: "r", liftsWhen: "w", observed: "declares 10Gi, renders 4Gi" }],
      unrenderable: [],
    });
    expect(result.refused).toHaveLength(1);
    expect(result.refused[0]?.problem).toContain("what was acknowledged has CHANGED");
  });

  test("an entry matching nothing is STALE and fails in its own right", () => {
    const result = adjudicate([], {
      findings: [{ key: "size gone/away", reason: "r", liftsWhen: "w", observed: "x" }],
      unrenderable: [],
    });
    expect(result.staleBaselineKeys).toEqual(["size gone/away"]);
  });

  test("an entry with no reason or no liftsWhen is REFUSED at load — no silent permanent exemption", () => {
    const dir = mkdtempSync(join(tmpdir(), "zeta-baseline-"));
    try {
      writeFileSync(join(dir, "b.json"), JSON.stringify({ findings: [{ key: "k", observed: "o", reason: "r" }] }));
      expect(() => loadBaseline("b.json", dir)).toThrow(/liftsWhen/);
      writeFileSync(join(dir, "c.json"), JSON.stringify({ findings: [{ key: "k", observed: "o", liftsWhen: "w" }] }));
      expect(() => loadBaseline("c.json", dir)).toThrow(/reason/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("every checked-in entry is keyed by identity, never by a line number", () => {
    const baseline = loadBaseline();
    for (const entry of [...baseline.findings, ...baseline.unrenderable]) {
      expect(entry.key).not.toMatch(/:\d+/);
      expect(entry.reason.trim().length).toBeGreaterThan(40);
      expect(entry.liftsWhen.trim().length).toBeGreaterThan(20);
    }
  });
});

// ---------------------------------------------------------------------------
// THE LIVE TREE, checked against the committed snapshot (offline, deterministic)
// ---------------------------------------------------------------------------

describe("the live catalogue against the measured render", () => {
  const snapshot = loadSnapshot();

  test("a snapshot is checked in", () => {
    expect(snapshot).not.toBeNull();
  });

  test("no UNACKNOWLEDGED finding, and no stale acknowledgement", () => {
    const result = auditAgainstSnapshot(snapshot!, {});
    expect(result.refused.map((finding) => `${finding.kind} ${finding.claimId}`)).toEqual([]);
    expect(result.staleBaselineKeys).toEqual([]);
    expect(result.unacknowledgedUnrenderable.map((app) => app.appId)).toEqual([]);
    expect(auditExitCode(result)).toBe(0);
  });

  test("the audit runs at the ACTIVE rung, not the last one in the ladder", () => {
    expect(activeStorageProfile()).toBe("measured");
    expect(auditAgainstSnapshot(snapshot!, {}).profile).toBe("measured");
  });

  // The numbers, pinned. Not decoration: this is what makes a declaration edit
  // that nobody re-measured go red offline, with no helm and no network.
  test("MEASURED 2026-08-22 — declared 967 GiB, rendered 861 GiB on longhorn", () => {
    const result = auditAgainstSnapshot(snapshot!, {});
    expect(declaredTotalGib(result.expectations)).toBe(967);
    const totals = renderedTotalsByClass(result.rendered, result.clusterDefault);
    // 831 -> 861 and 201 -> 193 on 2026-08-22: hindsight's postgres moved off
    // the Delete-reclaim default class onto longhorn (+10 there, -8 here) and
    // nats went from one JetStream pod to three (+20). Nothing else moved —
    // the rest of the snapshot re-rendered byte-identical.
    expect(totals.get("longhorn")).toBe(861);
    expect(totals.get("zeta-local-path")).toBe(193);
  });

  // WAS "the two live inert-values defects are still exactly two apps". Both
  // were fixed on 2026-08-22, so this is INVERTED rather than deleted — and it
  // does not stop at "the list is empty", because empty is also what a checker
  // that has stopped looking produces. The two rows that carried the defect are
  // asserted POSITIVELY against the render that judged them.
  test("the two inert-values defects are FIXED — and the render, not the declaration, says so", () => {
    const result = auditAgainstSnapshot(snapshot!, {});
    const declaredSide = result.acknowledged.filter((finding) => finding.kind !== "undeclared-rendered-pvc");
    expect(declaredSide.map((finding) => finding.claimId)).toEqual([]);

    const byName = new Map(result.rendered.map((pvc) => [`${pvc.appId} ${pvc.name}`, pvc]));
    const hindsight = byName.get("full-ai-cluster/hindsight data/hindsight-postgresql");
    expect(hindsight?.size).toBe("10Gi");
    // NOT "": a blank class binds zeta-local-path, which is rancher.io/local-path
    // with reclaimPolicy Delete. This assertion is the durability, not the size.
    expect(hindsight?.storageClassName).toBe("longhorn");
    expect(hindsight?.count).toBe(1);

    const nats = byName.get("full-ai-cluster/nats nats-js/nats");
    expect(nats?.size).toBe("10Gi");
    expect(nats?.storageClassName).toBe("longhorn");
    // Three, from `config.cluster.replicas`. At 1 there is no JetStream quorum
    // and a stream created with replicas > 1 refuses to create.
    expect(nats?.count).toBe(3);
  });

  // The catalogue's COORDINATES and the YAML have to move together. A field path
  // left pointing at the old `postgresql.primary.persistence.*` or at the old
  // top-level `cluster.replicas` reads as absent, and an absent coordinate is
  // how a row goes back to comparing against nothing — the same inert-declaration
  // shape one layer up. `verifyProfileApplied` reads every coordinate out of the
  // real manifests, so it is red if either edit was made without the other.
  test("every catalogue coordinate still resolves in the LIVE tree at the active rung", () => {
    const claim = loadCatalogue().claims.find((row) => row.id === "full-ai-cluster/nats/jetstream");
    expect(claim?.podsField).toBe("spec.source.helm.valuesObject.config.cluster.replicas");
    expect(verifyProfileApplied(loadCatalogue(), "measured").map((finding) => finding.problem)).toEqual([]);
  });

  test("every catalogue row carries a rendered coordinate, and every pattern compiles", () => {
    for (const claim of loadCatalogue().claims) {
      expect(claim.renderedApp.length).toBeGreaterThan(0);
      expect(claim.renderedPvcPattern.length).toBeGreaterThan(0);
      expect(() => new RegExp(claim.renderedPvcPattern)).not.toThrow();
    }
  });

  test("every renderedApp names an Application that actually exists in the tree", () => {
    const apps = new Set(discoverApplications().map((source) => source.appId));
    for (const claim of loadCatalogue().claims) expect(apps.has(claim.renderedApp)).toBe(true);
  });

  test("the snapshot agrees with itself — drift against an identical copy is empty", () => {
    expect(snapshotDrift(snapshot!, snapshot!)).toEqual([]);
  });

  test("a snapshot whose PVC moved is reported as drift, not silently accepted", () => {
    const moved = {
      ...snapshot!,
      rendered: snapshot!.rendered.map((entry, index) => (index === 0 ? { ...entry, size: "999Gi" } : entry)),
    };
    expect(snapshotDrift(moved, snapshot!).join(" ")).toContain("CHANGED");
  });
});

// ---------------------------------------------------------------------------
// The rest of the machinery
// ---------------------------------------------------------------------------

describe("machinery", () => {
  test("the cluster default StorageClass is read from the tree, not assumed", () => {
    expect(clusterDefaultStorageClass()).toBe("zeta-local-path");
    expect(clusterDefaultStorageClass(mkdtempSync(join(tmpdir(), "zeta-empty-")))).toBeNull();
  });

  test("an absent storageClassName resolves to the default; a set one wins", () => {
    expect(effectiveStorageClass("", "zeta-local-path")).toBe("zeta-local-path");
    expect(effectiveStorageClass("longhorn", "zeta-local-path")).toBe("longhorn");
    expect(effectiveStorageClass("", null)).toBeNull();
  });

  test("an operator CR's spec.storage.volumeClaimTemplate is a claim — kube-prometheus-stack renders no PVC object", () => {
    const [claim] = extractRenderedPvcs("t/kps", [
      {
        kind: "Prometheus",
        metadata: { name: "p" },
        spec: {
          replicas: 2,
          storage: {
            volumeClaimTemplate: {
              spec: { storageClassName: "longhorn", resources: { requests: { storage: "32Gi" } } },
            },
          },
        },
      },
    ]);
    expect(claim?.origin).toBe("operatorStorageSpec");
    expect(claim?.count).toBe(2);
    expect(claim?.gibibytes).toBe(32);
  });

  // A Blueprint is a TEMPLATE: a PVC exists only once a Deployable references
  // it. Counting one would over-state the disk, which is the opposite error to
  // the one this module exists to catch — and it WAS the error in
  // single-node-budget.json's 103 GiB zeta-local-path figure, which counted
  // blueprints-flowdent's 8Gi mssql template while missing 30 GiB of claims that
  // render with no class and bind the default. Two errors of opposite sign,
  // which is why the total looked plausible; corrected to 193 GiB on 2026-08-22
  // by deriving it from the snapshot instead of from our own YAML.
  test("a platform Blueprint's spec.storage is NOT counted as a PVC", () => {
    expect(
      extractRenderedPvcs("t/platform", [
        {
          kind: "Blueprint",
          metadata: { name: "mssql" },
          spec: { storage: { size: "8Gi" }, storageClassName: "zeta-local-path" },
        },
      ]),
    ).toEqual([]);
  });

  test("the directory.include glob is honoured — a file outside it does not render", () => {
    const matches = includeMatcher("{namespace,service,statefulset}.yaml");
    expect(matches("statefulset.yaml")).toBe(true);
    expect(matches("model-cache-pvc.yaml")).toBe(false);
    expect(matches("Application.yaml")).toBe(false);
    expect(includeMatcher("")("anything.yaml")).toBe(true);
  });

  test("a git-path Application renders the manifests its include glob selects", () => {
    const dir = mkdtempSync(join(tmpdir(), "zeta-gitpath-"));
    try {
      mkdirSync(join(dir, "app"), { recursive: true });
      writeFileSync(
        join(dir, "app", "statefulset.yaml"),
        "kind: StatefulSet\nmetadata:\n  name: s\nspec:\n  replicas: 2\n  volumeClaimTemplates:\n    - metadata: { name: d }\n      spec:\n        storageClassName: longhorn\n        resources: { requests: { storage: 4Gi } }\n",
      );
      writeFileSync(
        join(dir, "app", "excluded.yaml"),
        "kind: PersistentVolumeClaim\nmetadata:\n  name: nope\nspec:\n  resources: { requests: { storage: 99Gi } }\n",
      );
      const source: ApplicationSource = {
        appId: "t/app",
        manifestPath: "app/Application.yaml",
        kind: "git-path",
        repoURL: "",
        chart: "",
        targetRevision: "main",
        releaseName: "app",
        namespace: "n",
        valuesObject: {},
        gitPath: "app",
        includeGlob: "{statefulset}.yaml",
      };
      const result = renderApplication(source, { repoRoot: dir });
      expect(result.ok).toBe(true);
      const claims = result.ok ? extractRenderedPvcs("t/app", result.documents) : [];
      expect(claims.map((claim) => claim.name)).toEqual(["d/s"]);
      expect(claims[0]?.count).toBe(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a helm pull failure is UNRENDERABLE with the tool's own words, never a paraphrase", () => {
    const dir = mkdtempSync(join(tmpdir(), "zeta-helm-"));
    try {
      const source: ApplicationSource = {
        appId: "t/app",
        manifestPath: "a.yaml",
        kind: "helm-remote",
        repoURL: "https://example.invalid",
        chart: "c",
        targetRevision: "9.9.9",
        releaseName: "r",
        namespace: "n",
        valuesObject: {},
        gitPath: "",
        includeGlob: "",
      };
      const result = renderApplication(source, {
        repoRoot: dir,
        cacheDir: join(dir, "cache"),
        runHelm: () => ({ status: 1, stdout: "", stderr: 'chart "c" version "9.9.9" not found' }),
      });
      expect(result.ok).toBe(false);
      expect(result.ok ? "" : result.reason).toBe("helm-pull-failed");
      expect(result.ok ? "" : result.detail).toContain("not found");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a chart whose PACKAGED name differs from its index name still pulls (node-feature-discovery)", () => {
    const dir = mkdtempSync(join(tmpdir(), "zeta-helm2-"));
    try {
      const source: ApplicationSource = {
        appId: "t/nfd",
        manifestPath: "a.yaml",
        kind: "helm-remote",
        repoURL: "https://example.test",
        chart: "node-feature-discovery",
        targetRevision: "0.17.1",
        releaseName: "r",
        namespace: "n",
        valuesObject: {},
        gitPath: "",
        includeGlob: "",
      };
      const result = renderApplication(source, {
        repoRoot: dir,
        cacheDir: join(dir, "cache"),
        runHelm: (args, cwd) => {
          if (args[0] === "pull") {
            const destination = args[args.length - 1] ?? cwd;
            writeFileSync(join(destination, "node-feature-discovery-chart-0.17.1.tgz"), "not-a-real-archive");
            return { status: 0, stdout: "", stderr: "" };
          }
          return {
            status: 0,
            stdout:
              "kind: PersistentVolumeClaim\nmetadata: { name: p }\nspec: { storageClassName: longhorn, resources: { requests: { storage: 1Gi } } }\n",
            stderr: "",
          };
        },
      });
      expect(result.ok).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  test("--offline and --json are booleans and do NOT eat the argument after them", () => {
    expect(parseArgs(["--offline", "--profile", "measured"]).profile).toBe("measured");
    expect(parseArgs(["--json", "--profile", "minimal"]).profile).toBe("minimal");
  });

  test("declaredExpectations reads the storageClass from the MANIFEST, not from the row", () => {
    const catalogue = loadCatalogue();
    const hindsight = declaredExpectations(catalogue, "measured").find(
      (entry) => entry.claimId === "full-ai-cluster/hindsight/postgres",
    );
    expect(hindsight?.storageClass).toBe("longhorn");
    expect(hindsight?.size).toBe("10Gi");
  });
});
