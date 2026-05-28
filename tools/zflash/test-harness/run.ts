#!/usr/bin/env bun
/**
 * tools/zflash/test-harness/run.ts
 *
 * B-0891 — zflash 5-scenario test-harness CLI dispatcher (PoC scaffold)
 *
 * Usage:
 *   bun tools/zflash/test-harness/run.ts --list
 *   bun tools/zflash/test-harness/run.ts --dry-run [--scenario <id>]
 *   bun tools/zflash/test-harness/run.ts --scenario initial-format <iso-path>
 *   bun tools/zflash/test-harness/run.ts --all <iso-path>
 *
 * Modes:
 *   --list      Print scenario matrix as structured table; exit 0
 *   --dry-run   Validate scenarios + report dispatcher plan without
 *               executing QEMU. Exit 0 on valid plan, non-zero on
 *               misconfiguration.
 *   --scenario  Run one scenario by id. For composes-with-existing
 *               scenarios, delegates to tools/ci/qemu-full-install-test.ts
 *               or tools/ci/qemu-boot-test.ts. For scaffolded scenarios,
 *               reports "not yet implemented" with the implementation
 *               substrate path documented.
 *   --all       Run all 5 scenarios in orderIndex order; gate failures
 *               skip dependent scenarios.
 *
 * Output:
 *   JSON-structured per-scenario result to stdout
 *   Human-readable summary to stderr
 *
 * Exit codes:
 *   0  all requested scenarios passed (or all skipped due to scaffolded status)
 *   1  one or more requested scenarios FAILED
 *   2  usage error OR scenario-definition invariant violation
 *
 * Per .claude/rules/rule-0-no-sh-files.md (TS-first for cross-platform DST).
 * PoC scope: dispatcher contract + --list + --dry-run paths fully wired;
 * --scenario + --all paths shell out to existing QEMU harnesses for
 * composes-with-existing scenarios + return scaffolded status for the
 * remaining 3.
 */

import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { SCENARIOS, validateScenarios, findScenario, type Scenario, type ScenarioId } from "./scenarios";

type Mode = "list" | "dry-run" | "scenario" | "all";

interface ParsedArgs {
  readonly mode: Mode;
  readonly scenarioId?: ScenarioId;
  readonly isoPath?: string;
}

interface ScenarioResult {
  readonly id: ScenarioId;
  readonly status: "passed" | "failed" | "skipped" | "scaffolded";
  readonly durationMs?: number;
  readonly message?: string;
}

function parseArgs(argv: ReadonlyArray<string>): ParsedArgs | { error: string } {
  const args = argv.slice(2);
  if (args.length === 0) {
    return { error: "no mode specified — use --list, --dry-run, --scenario, or --all" };
  }
  if (args.includes("--list")) {
    return { mode: "list" };
  }
  if (args.includes("--dry-run")) {
    const scenarioIdx = args.indexOf("--scenario");
    if (scenarioIdx >= 0 && scenarioIdx + 1 < args.length) {
      const id = args[scenarioIdx + 1] as ScenarioId;
      return { mode: "dry-run", scenarioId: id };
    }
    return { mode: "dry-run" };
  }
  if (args.includes("--scenario")) {
    const scenarioIdx = args.indexOf("--scenario");
    if (scenarioIdx + 1 >= args.length) {
      return { error: "--scenario requires a scenario id" };
    }
    const id = args[scenarioIdx + 1] as ScenarioId;
    const positional = args.filter((a, i) => i !== scenarioIdx && i !== scenarioIdx + 1 && !a.startsWith("--"));
    if (positional.length === 0) {
      return { error: "--scenario requires an ISO path positional argument" };
    }
    return { mode: "scenario", scenarioId: id, isoPath: positional[0] };
  }
  if (args.includes("--all")) {
    const positional = args.filter((a) => !a.startsWith("--"));
    if (positional.length === 0) {
      return { error: "--all requires an ISO path positional argument" };
    }
    return { mode: "all", isoPath: positional[0] };
  }
  return { error: `unrecognized arguments: ${args.join(" ")}` };
}

function emitListing(): void {
  console.log(
    JSON.stringify(
      {
        rowId: "B-0891",
        scenarioCount: SCENARIOS.length,
        scenarios: SCENARIOS.map((s) => ({
          orderIndex: s.orderIndex,
          id: s.id,
          title: s.title,
          status: s.status,
          gates: s.gates,
        })),
      },
      null,
      2,
    ),
  );
}

function emitDryRun(scenarioId?: ScenarioId): number {
  try {
    validateScenarios(SCENARIOS);
  } catch (e) {
    console.error(`scenarios.ts invariant violated: ${(e as Error).message}`);
    return 2;
  }
  const targets = scenarioId
    ? SCENARIOS.filter((s) => s.id === scenarioId)
    : SCENARIOS;
  if (targets.length === 0) {
    console.error(`scenario not found: ${scenarioId}`);
    return 2;
  }
  console.log(
    JSON.stringify(
      {
        rowId: "B-0891",
        mode: "dry-run",
        targets: targets.map((s) => ({
          id: s.id,
          status: s.status,
          plan:
            s.status === "composes-with-existing"
              ? `would delegate to existing tools/ci/ substrate: ${s.composesWith[0]}`
              : `would report scaffolded — implementation pending; composes-with: ${s.composesWith.join(", ")}`,
        })),
      },
      null,
      2,
    ),
  );
  return 0;
}

function runComposingScenario(scenario: Scenario, isoPath: string): ScenarioResult {
  const harnessPath = scenario.id === "initial-format"
    ? "tools/ci/qemu-boot-test.ts"
    : "tools/ci/qemu-full-install-test.ts";
  const repoRoot = resolve(import.meta.dir, "../../..");
  const absHarnessPath = resolve(repoRoot, harnessPath);
  if (!existsSync(absHarnessPath)) {
    return {
      id: scenario.id,
      status: "failed",
      message: `composes-with harness not found: ${absHarnessPath}`,
    };
  }
  const start = Date.now();
  const result = spawnSync("bun", [absHarnessPath, isoPath], {
    cwd: repoRoot,
    stdio: "inherit",
  });
  const durationMs = Date.now() - start;
  return {
    id: scenario.id,
    status: result.status === 0 ? "passed" : "failed",
    durationMs,
    message: result.status === 0 ? undefined : `delegated harness exited ${result.status}`,
  };
}

function reportScaffolded(scenario: Scenario): ScenarioResult {
  return {
    id: scenario.id,
    status: "scaffolded",
    message: `scenario definition only — implementation pending; composes-with: ${scenario.composesWith.join(", ")}`,
  };
}

function runScenario(scenarioId: ScenarioId, isoPath: string): ScenarioResult {
  const scenario = findScenario(scenarioId);
  if (!scenario) {
    return {
      id: scenarioId,
      status: "failed",
      message: `scenario not found: ${scenarioId}`,
    };
  }
  switch (scenario.status) {
    case "composes-with-existing":
      return runComposingScenario(scenario, isoPath);
    case "scaffolded":
      return reportScaffolded(scenario);
    case "operator-runtime":
      return {
        id: scenarioId,
        status: "skipped",
        message: "operator-runtime scenario — physical USB / operator-collaborative testing required",
      };
  }
}

function emitResults(results: ReadonlyArray<ScenarioResult>): void {
  console.log(
    JSON.stringify(
      {
        rowId: "B-0891",
        summary: {
          total: results.length,
          passed: results.filter((r) => r.status === "passed").length,
          failed: results.filter((r) => r.status === "failed").length,
          scaffolded: results.filter((r) => r.status === "scaffolded").length,
          skipped: results.filter((r) => r.status === "skipped").length,
        },
        results,
      },
      null,
      2,
    ),
  );
}

function main(argv: ReadonlyArray<string>): number {
  const parsed = parseArgs(argv);
  if ("error" in parsed) {
    console.error(`usage error: ${parsed.error}`);
    console.error("see file header for usage examples");
    return 2;
  }

  try {
    validateScenarios(SCENARIOS);
  } catch (e) {
    console.error(`scenarios.ts invariant violated at startup: ${(e as Error).message}`);
    return 2;
  }

  switch (parsed.mode) {
    case "list":
      emitListing();
      return 0;
    case "dry-run":
      return emitDryRun(parsed.scenarioId);
    case "scenario": {
      if (!parsed.scenarioId || !parsed.isoPath) {
        console.error("--scenario requires scenario id + iso path");
        return 2;
      }
      const result = runScenario(parsed.scenarioId, parsed.isoPath);
      emitResults([result]);
      return result.status === "failed" ? 1 : 0;
    }
    case "all": {
      if (!parsed.isoPath) {
        console.error("--all requires iso path");
        return 2;
      }
      const sorted = [...SCENARIOS].sort((a, b) => a.orderIndex - b.orderIndex);
      const results: ScenarioResult[] = [];
      const failedIds = new Set<ScenarioId>();
      for (const scenario of sorted) {
        const gatedBy = sorted.find((g) => g.gates.includes(scenario.id) && failedIds.has(g.id));
        if (gatedBy) {
          results.push({
            id: scenario.id,
            status: "skipped",
            message: `gated by failed scenario: ${gatedBy.id}`,
          });
          continue;
        }
        const result = runScenario(scenario.id, parsed.isoPath);
        results.push(result);
        if (result.status === "failed") {
          failedIds.add(scenario.id);
        }
      }
      emitResults(results);
      return failedIds.size > 0 ? 1 : 0;
    }
  }
}

if (import.meta.main) {
  process.exit(main(process.argv));
}
