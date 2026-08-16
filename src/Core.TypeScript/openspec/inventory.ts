#!/usr/bin/env bun
/**
 * src/Core.TypeScript/openspec/inventory.ts (v0.2.0)
 *
 * Phase 1 mechanization for 081KQNJ500008QG0R001N94412: scans openspec/specs/ and src/Core/
 * to produce a structured gap report — which code modules have specs,
 * which don't, and which specs have no matching code module.
 *
 * Output: JSON to stdout. Human-readable summary to stderr.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";

// ── Types ────────────────────────────────────────────────────────────

interface SpecEntry {
  capability: string;
  specPath: string;
  profiles: string[];
  purposeSnippet: string;
}

interface ModuleEntry {
  name: string;
  path: string;
  namespace: string;
}

interface Mapping {
  capability: string;
  modules: string[];
  missingModules: string[];
}

interface ArtifactMapping {
  capability: string;
  artifacts: string[];
  missingArtifacts: string[];
}

interface GapReportOptions {
  artifactRoot?: string;
  artifactMap?: Record<string, string[]>;
}

interface InventoryGateOptions {
  failOnUnmappedSpecs?: boolean;
  failOnUncoveredModules?: boolean;
}

interface InventoryGateEvaluation {
  passed: boolean;
  failures: string[];
}

interface GapReport {
  timestamp: string;
  specs: SpecEntry[];
  modules: ModuleEntry[];
  mappings: Mapping[];
  artifactMappings: ArtifactMapping[];
  coveredModules: string[];
  uncoveredModules: string[];
  mappedArtifacts: string[];
  missingArtifacts: string[];
  unmappedSpecs: string[];
  coveragePercent: number;
}

// ── Known capability → module mappings ──────────────────────────────
//
// This is the authoritative map of which specs cover which F# modules.
// Maintained manually — when a new spec or module lands, add the link.
// The inventory tool flags anything not in this map as a gap.

const CAPABILITY_MODULE_MAP: Record<string, string[]> = {
  "operator-algebra": [
    "ZSet.fs",
    "Algebra.fs",
    "Operators.fs",
    "IndexedZSet.fs",
    "Incremental.fs",
    "Units.fs",
    "Primitive.fs",
    "Handles.fs",
  ],
  "retraction-safe-recursion": ["Recursive.fs", "RecursiveSigned.fs"],
  "durability-modes": ["Durability.fs"],
  "circuit-recursion": ["Circuit.fs", "NestedCircuit.fs"],
  "lsm-spine-family": ["Spine.fs", "SpineAsync.fs", "DiskSpine.fs", "BalancedSpine.fs", "SpineSelector.fs"],
  "repo-automation": [],
  "retraction-native": ["Graph.fs"],
};

// Some OpenSpec capabilities are backed by repo artifacts outside src/Core/.
// Keeping this separate prevents tests, proofs, and profile-only evidence from
// inflating source-module coverage while still making the mapping explicit.
const CAPABILITY_ARTIFACT_MAP: Record<string, string[]> = {
  "agentic-organization": [
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
  ],
  "z-set-algebra": [
    "tests/Tests.FSharp/Algebra/ZSet.Tests.fs",
    "tests/Tests.FSharp/Algebra/ZSet.Overflow.Tests.fs",
    "tests/Tests.FSharp/Algebra/IndexedZSet.Tests.fs",
    "tests/Tests.CSharp/ZSetTests.cs",
  ],
  "tick-history": [
    "docs/hygiene-history/loop-tick-history.md",
    "docs/hygiene-history/ticks/README.md",
    "src/Core.TypeScript/hygiene/check-tick-history-order.ts",
    "src/Core.TypeScript/hygiene/check-tick-history-order.test.ts",
    "src/Core.TypeScript/hygiene/check-tick-history-shard-schema.ts",
    "src/Core.TypeScript/hygiene/check-tick-history-shard-schema.test.ts",
  ],
  "retraction-native": [
    "tests/Tests.FSharp/Algebra/Graph.Tests.fs",
    "docs/DECISIONS/2026-04-24-graph-substrate-zset-backed-retraction-native.md",
  ],
};

// Modules excluded from gap analysis — infrastructure, assembly metadata,
// or modules whose spec coverage is tracked under a different capability.
const EXCLUDED_MODULES = new Set(["AssemblyInfo.fs", "FSharpApi.fs"]);

// ── Scanning ─────────────────────────────────────────────────────────

function findRepoRoot(): string {
  let cur = resolve(import.meta.dir);
  while (cur !== "/" && cur !== "") {
    if (existsSync(join(cur, ".git"))) {
      return cur;
    }

    const parent = resolve(cur, "..");
    if (parent === cur) break;
    cur = parent;
  }
  return process.cwd();
}

function scanSpecs(specsDir: string): SpecEntry[] {
  const entries: SpecEntry[] = [];
  let dirs: string[];
  try {
    dirs = readdirSync(specsDir).sort();
  } catch {
    return entries;
  }

  for (const name of dirs) {
    const specPath = join(specsDir, name, "spec.md");
    let content: string;
    try {
      content = readFileSync(specPath, "utf8");
    } catch {
      continue;
    }

    const purposeMatch = content.match(/##\s*Purpose\s*\n+([\s\S]*?)(?=\n##\s|\n$)/);
    const purposeSnippet = purposeMatch
      ? purposeMatch[1]!.trim().split("\n")[0]!.slice(0, 200)
      : "(no purpose section found)";

    let profiles: string[] = [];
    const profilesDir = join(specsDir, name, "profiles");
    try {
      profiles = readdirSync(profilesDir)
        .filter((f) => f.endsWith(".md"))
        .map((f) => f.replace(/\.md$/, ""))
        .sort();
    } catch {
      // no profiles dir
    }

    entries.push({
      capability: name,
      specPath,
      profiles,
      purposeSnippet,
    });
  }

  return entries;
}

function scanModules(coreDir: string): ModuleEntry[] {
  const entries: ModuleEntry[] = [];
  let files: string[];
  try {
    files = readdirSync(coreDir)
      .filter((f) => f.endsWith(".fs"))
      .sort();
  } catch {
    return entries;
  }

  for (const file of files) {
    const filePath = join(coreDir, file);
    const content = readFileSync(filePath, "utf8");
    const nsMatch = content.match(/^namespace\s+(\S+)/m);
    entries.push({
      name: file,
      path: filePath,
      namespace: nsMatch ? nsMatch[1]! : "unknown",
    });
  }

  return entries;
}

// ── Gap analysis ─────────────────────────────────────────────────────

function buildGapReport(specs: SpecEntry[], modules: ModuleEntry[], options: GapReportOptions = {}): GapReport {
  const artifactRoot = options.artifactRoot ?? findRepoRoot();
  const artifactMap = options.artifactMap ?? CAPABILITY_ARTIFACT_MAP;
  const allModuleNames = new Set(modules.map((m) => m.name));
  const specCapabilities = new Set(specs.map((s) => s.capability));
  const coveredSet = new Set<string>();
  const mappings: Mapping[] = [];
  const artifactMappings: ArtifactMapping[] = [];
  const mappedArtifactSet = new Set<string>();
  const missingArtifactSet = new Set<string>();

  for (const [capability, moduleNames] of Object.entries(CAPABILITY_MODULE_MAP)) {
    const actualModules = moduleNames.filter((m) => allModuleNames.has(m));
    const missingModules = moduleNames.filter((m) => !allModuleNames.has(m));
    mappings.push({ capability, modules: actualModules, missingModules });
    if (specCapabilities.has(capability)) {
      for (const m of actualModules) {
        coveredSet.add(m);
      }
    }
  }

  for (const [capability, artifactPaths] of Object.entries(artifactMap)) {
    const artifacts: string[] = [];
    const missingArtifacts: string[] = [];
    for (const artifactPath of artifactPaths) {
      if (existsSync(join(artifactRoot, artifactPath))) {
        artifacts.push(artifactPath);
        mappedArtifactSet.add(artifactPath);
      } else {
        missingArtifacts.push(artifactPath);
        missingArtifactSet.add(artifactPath);
      }
    }
    artifactMappings.push({ capability, artifacts, missingArtifacts });
  }

  const coveredModules = [...coveredSet].sort();
  const uncoveredModules = modules
    .map((m) => m.name)
    .filter((m) => !coveredSet.has(m) && !EXCLUDED_MODULES.has(m))
    .sort();

  const mappedCapabilities = new Set([...Object.keys(CAPABILITY_MODULE_MAP), ...Object.keys(artifactMap)]);
  const unmappedSpecs = [...specCapabilities].filter((c) => !mappedCapabilities.has(c)).sort();

  const excludedPresent = modules.filter((m) => EXCLUDED_MODULES.has(m.name)).length;
  const totalAnalyzable = modules.length - excludedPresent;
  const coveragePercent = totalAnalyzable > 0 ? Math.round((coveredModules.length / totalAnalyzable) * 1000) / 10 : 0;

  return {
    timestamp: new Date().toISOString(),
    specs,
    modules,
    mappings,
    artifactMappings,
    coveredModules,
    uncoveredModules,
    mappedArtifacts: [...mappedArtifactSet].sort(),
    missingArtifacts: [...missingArtifactSet].sort(),
    unmappedSpecs,
    coveragePercent,
  };
}

function evaluateInventoryGate(report: GapReport, options: InventoryGateOptions = {}): InventoryGateEvaluation {
  const failures: string[] = [];
  const missingModules = report.mappings.flatMap((m) => m.missingModules).sort();

  if (missingModules.length > 0) {
    failures.push(`mapped modules missing from src/Core/: ${missingModules.join(", ")}`);
  }

  if (report.missingArtifacts.length > 0) {
    failures.push(`mapped artifacts missing: ${report.missingArtifacts.join(", ")}`);
  }

  if (options.failOnUnmappedSpecs === true && report.unmappedSpecs.length > 0) {
    failures.push(`specs without module or artifact mapping: ${report.unmappedSpecs.join(", ")}`);
  }

  if (options.failOnUncoveredModules === true && report.uncoveredModules.length > 0) {
    failures.push(`uncovered modules: ${report.uncoveredModules.join(", ")}`);
  }

  return {
    passed: failures.length === 0,
    failures,
  };
}

interface CliOptions {
  enforce: boolean;
  gateOptions: InventoryGateOptions;
  help: boolean;
  error?: string;
}

function parseCliArgs(args: string[]): CliOptions {
  const parsed: CliOptions = {
    enforce: false,
    gateOptions: {},
    help: false,
  };

  for (const arg of args) {
    switch (arg) {
      case "--enforce":
        parsed.enforce = true;
        break;
      case "--fail-on-unmapped-specs":
        // A --fail-on-* flag is a request to gate on that condition, which is
        // meaningless unless the gate is actually evaluated — so it implies
        // --enforce. Without this, passing the flag alone silently exited 0.
        parsed.gateOptions.failOnUnmappedSpecs = true;
        parsed.enforce = true;
        break;
      case "--fail-on-uncovered-modules":
        parsed.gateOptions.failOnUncoveredModules = true;
        parsed.enforce = true;
        break;
      case "--help":
      case "-h":
        parsed.help = true;
        break;
      default:
        parsed.error = `Unknown argument: ${arg}`;
        return parsed;
    }
  }

  return parsed;
}

function printUsage(err: (message?: unknown, ...optionalParams: unknown[]) => void): void {
  err(
    "Usage: bun src/Core.TypeScript/openspec/inventory.ts [--enforce] [--fail-on-unmapped-specs] [--fail-on-uncovered-modules]",
  );
  err("");
  err("Options:");
  err("  --enforce                    Exit nonzero when the inventory gate fails.");
  err("  --fail-on-unmapped-specs     Treat specs without mappings as gate failures (implies --enforce).");
  err("  --fail-on-uncovered-modules  Treat uncovered Core modules as gate failures (implies --enforce).");
}

// ── CLI ──────────────────────────────────────────────────────────────

export {
  scanSpecs,
  scanModules,
  buildGapReport,
  evaluateInventoryGate,
  parseCliArgs,
  CAPABILITY_MODULE_MAP,
  CAPABILITY_ARTIFACT_MAP,
  EXCLUDED_MODULES,
};
export type {
  SpecEntry,
  ModuleEntry,
  GapReport,
  GapReportOptions,
  InventoryGateOptions,
  InventoryGateEvaluation,
  Mapping,
  ArtifactMapping,
  CliOptions,
};

export function main(): number {
  const cli = parseCliArgs(process.argv.slice(2));
  const err = console.error.bind(console);

  if (cli.error) {
    err(cli.error);
    printUsage(err);
    return 2;
  }

  if (cli.help) {
    printUsage(err);
    return 0;
  }

  const repoRoot = findRepoRoot();
  const specsDir = join(repoRoot, "openspec", "specs");
  const coreDir = join(repoRoot, "src", "Core");

  const specs = scanSpecs(specsDir);
  const modules = scanModules(coreDir);
  const report = buildGapReport(specs, modules, { artifactRoot: repoRoot });

  // Convert absolute paths to repo-relative for display
  for (const s of report.specs) {
    s.specPath = relative(repoRoot, s.specPath);
  }
  for (const m of report.modules) {
    m.path = relative(repoRoot, m.path);
  }

  // Structured JSON to stdout
  console.log(JSON.stringify(report, null, 2));

  // Human-readable summary to stderr
  err("");
  err(`── OpenSpec inventory ──────────────────────────`);
  err(`  Specs:             ${report.specs.length}`);
  err(`  Core modules:      ${report.modules.length}`);
  err(`  Covered modules:   ${report.coveredModules.length}`);
  err(`  Uncovered modules: ${report.uncoveredModules.length}`);
  err(`  Mapped artifacts:  ${report.mappedArtifacts.length}`);
  err(`  Coverage:          ${report.coveragePercent}%`);
  err("");

  const allMissing = report.mappings.flatMap((m) => m.missingModules);
  if (allMissing.length > 0) {
    err(`  Mapped modules not found in src/Core/ (possible drift):`);
    for (const m of allMissing) {
      err(`    - ${m}`);
    }
    err("");
  }

  if (report.missingArtifacts.length > 0) {
    err(`  Mapped artifacts not found (possible drift):`);
    for (const artifact of report.missingArtifacts) {
      err(`    - ${artifact}`);
    }
    err("");
  }

  if (report.unmappedSpecs.length > 0) {
    err(`  Specs without module or artifact mapping:`);
    for (const s of report.unmappedSpecs) {
      err(`    - ${s}`);
    }
    err("");
  }

  if (report.uncoveredModules.length > 0) {
    err(`  Uncovered modules (candidates for new specs):`);
    for (const m of report.uncoveredModules) {
      err(`    - ${m}`);
    }
    err("");
  }

  if (cli.enforce) {
    const gate = evaluateInventoryGate(report, cli.gateOptions);
    if (!gate.passed) {
      err(`  Inventory gate: FAIL`);
      for (const failure of gate.failures) {
        err(`    - ${failure}`);
      }
      err("");
      return 1;
    }

    err(`  Inventory gate: PASS`);
    err("");
  }

  return 0;
}

if (import.meta.main) {
  process.exit(main());
}
