import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  scanSpecs,
  scanModules,
  buildGapReport,
  evaluateInventoryGate,
  parseCliArgs,
  CAPABILITY_MODULE_MAP,
  CAPABILITY_ARTIFACT_MAP,
  EXCLUDED_MODULES,
} from "./inventory.ts";
import type { SpecEntry, ModuleEntry, GapReport } from "./inventory.ts";

function makeTempDir(): string {
  return mkdtempSync(join(tmpdir(), "openspec-inventory-test-"));
}

function makeGateReport(overrides: Partial<GapReport> = {}): GapReport {
  return {
    timestamp: "2026-05-31T00:00:00.000Z",
    specs: [],
    modules: [],
    mappings: [],
    artifactMappings: [],
    coveredModules: [],
    uncoveredModules: [],
    mappedArtifacts: [],
    missingArtifacts: [],
    unmappedSpecs: [],
    coveragePercent: 0,
    ...overrides,
  };
}

describe("scanSpecs", () => {
  test("returns empty for nonexistent dir", () => {
    expect(scanSpecs("/nonexistent/path")).toEqual([]);
  });

  test("finds specs with purpose and profiles", () => {
    const root = makeTempDir();
    const specDir = join(root, "my-cap");
    const profilesDir = join(specDir, "profiles");
    mkdirSync(profilesDir, { recursive: true });
    writeFileSync(join(specDir, "spec.md"), "## Purpose\n\nThis defines the foo capability.\n\n## Requirements\n");
    writeFileSync(join(profilesDir, "fsharp.md"), "# F# overlay\n");

    const specs = scanSpecs(root);
    expect(specs).toHaveLength(1);
    expect(specs[0]!.capability).toBe("my-cap");
    expect(specs[0]!.specPath).toBe(join(root, "my-cap", "spec.md"));
    expect(specs[0]!.profiles).toEqual(["fsharp"]);
    expect(specs[0]!.purposeSnippet).toContain("foo capability");

    rmSync(root, { recursive: true });
  });

  test("skips dirs without spec.md", () => {
    const root = makeTempDir();
    mkdirSync(join(root, "empty-cap"), { recursive: true });

    const specs = scanSpecs(root);
    expect(specs).toHaveLength(0);

    rmSync(root, { recursive: true });
  });

  test("returns entries in sorted order", () => {
    const root = makeTempDir();
    for (const name of ["zebra", "alpha", "middle"]) {
      mkdirSync(join(root, name), { recursive: true });
      writeFileSync(join(root, name, "spec.md"), "## Purpose\n\nTest.\n");
    }

    const specs = scanSpecs(root);
    expect(specs.map((s) => s.capability)).toEqual(["alpha", "middle", "zebra"]);

    rmSync(root, { recursive: true });
  });
});

describe("scanModules", () => {
  test("returns empty for nonexistent dir", () => {
    expect(scanModules("/nonexistent/path")).toEqual([]);
  });

  test("finds .fs files and extracts namespace", () => {
    const root = makeTempDir();
    writeFileSync(join(root, "Foo.fs"), "namespace Zeta.Core\n\ntype Foo = { X: int }\n");
    writeFileSync(join(root, "NotFs.txt"), "ignored");

    const modules = scanModules(root);
    expect(modules).toHaveLength(1);
    expect(modules[0]!.name).toBe("Foo.fs");
    expect(modules[0]!.path).toBe(join(root, "Foo.fs"));
    expect(modules[0]!.namespace).toBe("Zeta.Core");

    rmSync(root, { recursive: true });
  });

  test("returns entries in sorted order", () => {
    const root = makeTempDir();
    for (const name of ["Zebra.fs", "Alpha.fs", "Middle.fs"]) {
      writeFileSync(join(root, name), "namespace Zeta.Core\n");
    }

    const modules = scanModules(root);
    expect(modules.map((m) => m.name)).toEqual(["Alpha.fs", "Middle.fs", "Zebra.fs"]);

    rmSync(root, { recursive: true });
  });
});

describe("buildGapReport", () => {
  test("correctly classifies covered vs uncovered", () => {
    const specs: SpecEntry[] = [
      {
        capability: "operator-algebra",
        specPath: "openspec/specs/operator-algebra/spec.md",
        profiles: ["fsharp"],
        purposeSnippet: "the core algebra",
      },
    ];

    const modules: ModuleEntry[] = [
      { name: "ZSet.fs", path: "src/Core/ZSet.fs", namespace: "Zeta.Core" },
      { name: "Sketch.fs", path: "src/Core/Sketch.fs", namespace: "Zeta.Core" },
      { name: "AssemblyInfo.fs", path: "src/Core/AssemblyInfo.fs", namespace: "Zeta.Core" },
    ];

    const report = buildGapReport(specs, modules);

    expect(report.coveredModules).toContain("ZSet.fs");
    expect(report.uncoveredModules).toContain("Sketch.fs");
    expect(report.uncoveredModules).not.toContain("AssemblyInfo.fs");
    expect(report.uncoveredModules).not.toContain("ZSet.fs");
    expect(report.coveragePercent).toBeGreaterThan(0);
  });

  test("coverage denominator excludes only present excluded modules", () => {
    const specs: SpecEntry[] = [
      {
        capability: "operator-algebra",
        specPath: "openspec/specs/operator-algebra/spec.md",
        profiles: ["fsharp"],
        purposeSnippet: "the core algebra",
      },
    ];
    const modules: ModuleEntry[] = [
      { name: "ZSet.fs", path: "src/Core/ZSet.fs", namespace: "Zeta.Core" },
      { name: "Sketch.fs", path: "src/Core/Sketch.fs", namespace: "Zeta.Core" },
    ];

    const report = buildGapReport(specs, modules);
    // Neither AssemblyInfo.fs nor FSharpApi.fs is in the module list,
    // so denominator should be 2 (not 2 - 2 = 0).
    // ZSet.fs is covered via operator-algebra mapping (spec present), so 1/2 = 50%.
    expect(report.coveragePercent).toBe(50);
    expect(report.uncoveredModules).toHaveLength(1);
    expect(report.uncoveredModules).toContain("Sketch.fs");
  });

  test("modules are not covered when their capability spec is missing", () => {
    const modules: ModuleEntry[] = [
      { name: "ZSet.fs", path: "src/Core/ZSet.fs", namespace: "Zeta.Core" },
      { name: "Sketch.fs", path: "src/Core/Sketch.fs", namespace: "Zeta.Core" },
    ];

    const report = buildGapReport([], modules);
    // No specs present — even though ZSet.fs is in the operator-algebra mapping,
    // coverage should be 0% because the spec itself doesn't exist.
    expect(report.coveragePercent).toBe(0);
    expect(report.coveredModules).toHaveLength(0);
    expect(report.uncoveredModules).toHaveLength(2);
  });

  test("reports missing mapped modules", () => {
    const modules: ModuleEntry[] = [{ name: "ZSet.fs", path: "src/Core/ZSet.fs", namespace: "Zeta.Core" }];

    const report = buildGapReport([], modules);
    const algebraMapping = report.mappings.find((m) => m.capability === "operator-algebra");
    expect(algebraMapping).toBeDefined();
    expect(algebraMapping!.missingModules).toContain("Algebra.fs");
    expect(algebraMapping!.missingModules).not.toContain("ZSet.fs");
  });

  test("flags specs not in mapping table", () => {
    const specs: SpecEntry[] = [
      {
        capability: "brand-new-spec",
        specPath: "openspec/specs/brand-new-spec/spec.md",
        profiles: [],
        purposeSnippet: "new",
      },
    ];

    const report = buildGapReport(specs, []);
    expect(report.unmappedSpecs).toContain("brand-new-spec");
  });

  test("artifact-only mappings prevent specs from being marked unmapped", () => {
    const root = makeTempDir();
    mkdirSync(join(root, "evidence"), { recursive: true });
    writeFileSync(join(root, "evidence", "proof.md"), "# Proof\n");

    const specs: SpecEntry[] = [
      {
        capability: "artifact-only",
        specPath: "openspec/specs/artifact-only/spec.md",
        profiles: [],
        purposeSnippet: "artifact-backed",
      },
    ];

    const report = buildGapReport(specs, [], {
      artifactRoot: root,
      artifactMap: {
        "artifact-only": ["evidence/proof.md"],
      },
    });

    expect(report.unmappedSpecs).not.toContain("artifact-only");
    expect(report.artifactMappings).toEqual([
      {
        capability: "artifact-only",
        artifacts: ["evidence/proof.md"],
        missingArtifacts: [],
      },
    ]);
    expect(report.mappedArtifacts).toEqual(["evidence/proof.md"]);
    expect(report.missingArtifacts).toEqual([]);

    rmSync(root, { recursive: true });
  });

  test("artifact mappings surface missing backing files", () => {
    const root = makeTempDir();
    const report = buildGapReport([], [], {
      artifactRoot: root,
      artifactMap: {
        "artifact-only": ["evidence/missing.md"],
      },
    });

    expect(report.artifactMappings).toEqual([
      {
        capability: "artifact-only",
        artifacts: [],
        missingArtifacts: ["evidence/missing.md"],
      },
    ]);
    expect(report.mappedArtifacts).toEqual([]);
    expect(report.missingArtifacts).toEqual(["evidence/missing.md"]);

    rmSync(root, { recursive: true });
  });

  test("default artifact root is stable across caller working directories", () => {
    const originalCwd = process.cwd();
    const root = makeTempDir();
    const artifact = "tests/Tests.FSharp/Algebra/ZSet.Tests.fs";

    try {
      process.chdir(root);
      const report = buildGapReport([], [], {
        artifactMap: {
          "z-set-algebra": [artifact],
        },
      });

      expect(report.mappedArtifacts).toEqual([artifact]);
      expect(report.missingArtifacts).toEqual([]);
    } finally {
      process.chdir(originalCwd);
      rmSync(root, { recursive: true });
    }
  });

  test("coverage is 0% with no modules", () => {
    const report = buildGapReport([], []);
    expect(report.coveragePercent).toBe(0);
  });
});

describe("evaluateInventoryGate", () => {
  test("fails by default on missing mapped modules", () => {
    const report = makeGateReport({
      mappings: [{ capability: "operator-algebra", modules: [], missingModules: ["Algebra.fs"] }],
    });

    const gate = evaluateInventoryGate(report);

    expect(gate.passed).toBe(false);
    expect(gate.failures).toEqual(["mapped modules missing from src/Core/: Algebra.fs"]);
  });

  test("fails by default on missing mapped artifacts", () => {
    const report = makeGateReport({
      missingArtifacts: ["evidence/missing.md"],
    });

    const gate = evaluateInventoryGate(report);

    expect(gate.passed).toBe(false);
    expect(gate.failures).toEqual(["mapped artifacts missing: evidence/missing.md"]);
  });

  test("allows known coverage gaps unless strict options are set", () => {
    const report = makeGateReport({
      unmappedSpecs: ["brand-new-spec"],
      uncoveredModules: ["Sketch.fs"],
    });

    expect(evaluateInventoryGate(report).passed).toBe(true);

    const strictSpecGate = evaluateInventoryGate(report, { failOnUnmappedSpecs: true });
    expect(strictSpecGate.passed).toBe(false);
    expect(strictSpecGate.failures).toEqual(["specs without module or artifact mapping: brand-new-spec"]);

    const strictModuleGate = evaluateInventoryGate(report, { failOnUncoveredModules: true });
    expect(strictModuleGate.passed).toBe(false);
    expect(strictModuleGate.failures).toEqual(["uncovered modules: Sketch.fs"]);
  });
});

describe("parseCliArgs", () => {
  test("parses enforce and strict gate modifiers", () => {
    const parsed = parseCliArgs(["--enforce", "--fail-on-unmapped-specs", "--fail-on-uncovered-modules"]);

    expect(parsed).toEqual({
      enforce: true,
      gateOptions: {
        failOnUnmappedSpecs: true,
        failOnUncoveredModules: true,
      },
      help: false,
    });
  });

  test("--fail-on-unmapped-specs alone implies --enforce", () => {
    const parsed = parseCliArgs(["--fail-on-unmapped-specs"]);

    // Without the implication the gate would never evaluate and the CLI would
    // exit 0 even with unmapped specs (regression guard for the silent-exit bug).
    expect(parsed.enforce).toBe(true);
    expect(parsed.gateOptions).toEqual({ failOnUnmappedSpecs: true });
  });

  test("--fail-on-uncovered-modules alone implies --enforce", () => {
    const parsed = parseCliArgs(["--fail-on-uncovered-modules"]);

    expect(parsed.enforce).toBe(true);
    expect(parsed.gateOptions).toEqual({ failOnUncoveredModules: true });
  });

  test("bare invocation does not enforce", () => {
    const parsed = parseCliArgs([]);

    expect(parsed.enforce).toBe(false);
    expect(parsed.gateOptions).toEqual({});
  });

  test("surfaces unknown arguments", () => {
    const parsed = parseCliArgs(["--wat"]);

    expect(parsed.error).toBe("Unknown argument: --wat");
  });
});

describe("mapping table integrity", () => {
  test("all mapped capabilities have entries in CAPABILITY_MODULE_MAP", () => {
    for (const [cap, modules] of Object.entries(CAPABILITY_MODULE_MAP)) {
      expect(typeof cap).toBe("string");
      expect(Array.isArray(modules)).toBe(true);
    }
  });

  test("z-set-algebra has non-core artifact coverage", () => {
    expect(CAPABILITY_ARTIFACT_MAP["z-set-algebra"]).toEqual([
      "tests/Tests.FSharp/Algebra/ZSet.Tests.fs",
      "tests/Tests.FSharp/Algebra/ZSet.Overflow.Tests.fs",
      "tests/Tests.FSharp/Algebra/IndexedZSet.Tests.fs",
      "tests/Tests.CSharp/ZSetTests.cs",
    ]);
  });

  test("tick-history has checker and documentation artifact coverage", () => {
    expect(CAPABILITY_ARTIFACT_MAP["tick-history"]).toEqual([
      "docs/hygiene-history/loop-tick-history.md",
      "docs/hygiene-history/ticks/README.md",
      "src/Core.TypeScript/hygiene/check-tick-history-order.ts",
      "src/Core.TypeScript/hygiene/check-tick-history-order.test.ts",
      "src/Core.TypeScript/hygiene/check-tick-history-shard-schema.ts",
      "src/Core.TypeScript/hygiene/check-tick-history-shard-schema.test.ts",
    ]);
  });

  test("agentic-organization has source, test, and documentation artifact coverage", () => {
    expect(CAPABILITY_ARTIFACT_MAP["agentic-organization"]).toEqual([
      "agentic-organization/package.json",
      "agentic-organization/packages/domain/src/org-event.ts",
      "agentic-organization/packages/domain/src/hat-binding.ts",
      "agentic-organization/packages/domain/src/supervisor-communication.ts",
      "agentic-organization/packages/application/src/command-contract.ts",
      "agentic-organization/packages/application/src/command-handler-registry.ts",
      "agentic-organization/packages/application/src/command-pipeline.ts",
      "agentic-organization/packages/application/src/ports.ts",
      "agentic-organization/packages/application/test/command-pipeline.test.ts",
      "agentic-organization/docs/NORTH_STAR_ALIGNMENT_CHECKPOINT.md",
      "agentic-organization/docs/ORGANIZATION_RUNTIME_ARCHITECTURE.md",
      "agentic-organization/docs/V0_POLICY_AND_RUNTIME_BOUNDARIES.md",
    ]);
  });

  test("EXCLUDED_MODULES is a Set of strings", () => {
    expect(EXCLUDED_MODULES).toBeInstanceOf(Set);
    for (const m of EXCLUDED_MODULES) {
      expect(typeof m).toBe("string");
      expect(m.endsWith(".fs")).toBe(true);
    }
  });
});

describe("integration: real repo scan", () => {
  test("finds at least 6 specs in the real openspec/specs/ dir", () => {
    const repoRoot = join(import.meta.dir, "../../..");
    const specs = scanSpecs(join(repoRoot, "openspec", "specs"));
    expect(specs.length).toBeGreaterThanOrEqual(6);

    const names = specs.map((s) => s.capability);
    expect(names).toContain("operator-algebra");
    expect(names).toContain("retraction-safe-recursion");
    expect(names).toContain("durability-modes");
    expect(names).toContain("circuit-recursion");
    expect(names).toContain("lsm-spine-family");
    expect(names).toContain("repo-automation");
  });

  test("finds at least 50 modules in the real src/Core/ dir", () => {
    const repoRoot = join(import.meta.dir, "../../..");
    const modules = scanModules(join(repoRoot, "src", "Core"));
    expect(modules.length).toBeGreaterThanOrEqual(50);
  });

  test("real z-set-algebra spec is artifact-mapped", () => {
    const repoRoot = join(import.meta.dir, "../../..");
    const specs = scanSpecs(join(repoRoot, "openspec", "specs"));
    const modules = scanModules(join(repoRoot, "src", "Core"));
    const report = buildGapReport(specs, modules, { artifactRoot: repoRoot });

    const zSetMapping = report.artifactMappings.find((m) => m.capability === "z-set-algebra");
    expect(zSetMapping).toBeDefined();
    expect(zSetMapping!.artifacts).toContain("tests/Tests.FSharp/Algebra/ZSet.Tests.fs");
    expect(zSetMapping!.missingArtifacts).toEqual([]);
    expect(report.unmappedSpecs).not.toContain("z-set-algebra");
  });

  test("real tick-history spec is artifact-mapped", () => {
    const repoRoot = join(import.meta.dir, "../../..");
    const specs = scanSpecs(join(repoRoot, "openspec", "specs"));
    const modules = scanModules(join(repoRoot, "src", "Core"));
    const report = buildGapReport(specs, modules, { artifactRoot: repoRoot });

    const tickHistoryMapping = report.artifactMappings.find((m) => m.capability === "tick-history");
    expect(tickHistoryMapping).toBeDefined();
    expect(tickHistoryMapping!.artifacts).toContain("src/Core.TypeScript/hygiene/check-tick-history-shard-schema.ts");
    expect(tickHistoryMapping!.missingArtifacts).toEqual([]);
    expect(report.unmappedSpecs).not.toContain("tick-history");
  });

  test("real agentic-organization spec is artifact-mapped", () => {
    const repoRoot = join(import.meta.dir, "../../..");
    const specs = scanSpecs(join(repoRoot, "openspec", "specs"));
    const modules = scanModules(join(repoRoot, "src", "Core"));
    const report = buildGapReport(specs, modules, { artifactRoot: repoRoot });

    const agenticOrgMapping = report.artifactMappings.find((m) => m.capability === "agentic-organization");
    expect(agenticOrgMapping).toBeDefined();
    expect(agenticOrgMapping!.artifacts).toContain("agentic-organization/packages/application/src/command-pipeline.ts");
    expect(agenticOrgMapping!.artifacts).toContain("agentic-organization/docs/ORGANIZATION_RUNTIME_ARCHITECTURE.md");
    expect(agenticOrgMapping!.missingArtifacts).toEqual([]);
    expect(report.unmappedSpecs).not.toContain("agentic-organization");
  });

  test("real README-only capability directories are not strict spec inputs", () => {
    const repoRoot = join(import.meta.dir, "../../..");
    const specs = scanSpecs(join(repoRoot, "openspec", "specs"));
    const report = buildGapReport(specs, [], { artifactRoot: repoRoot });

    // retraction-native was promoted to a full spec, so it should be contained.
    expect(specs.map((s) => s.capability)).toContain("retraction-native");
    expect(report.unmappedSpecs).not.toContain("retraction-native");
  });
});
