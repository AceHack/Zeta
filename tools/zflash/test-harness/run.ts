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
 *               or tools/ci/qemu-boot-test.ts. For scenario 3, emits the
 *               QEMU snapshot/restart plan but still fails closed until
 *               the real process runner is connected to the execution
 *               contract. Other scaffolded
 *               scenarios report "not yet implemented" with the
 *               implementation substrate path documented.
 *   --all       Run all 5 scenarios in orderIndex order; gate failures
 *               skip dependent scenarios.
 *
 * Output:
 *   JSON-structured per-scenario result to stdout
 *   Human-readable summary to stderr
 *
 * Exit codes:
 *   0  all requested runnable scenarios passed; --list/--dry-run succeeded
 *   1  one or more requested scenarios FAILED
 *   2  usage error OR scenario-definition invariant violation
 *
 * Per .claude/rules/rule-0-no-sh-files.md (TS-first for cross-platform DST).
 * PoC scope: dispatcher contract + --list + --dry-run paths fully wired;
 * --scenario + --all paths shell out to existing QEMU harnesses for
 * composes-with-existing scenarios + return fail-closed implementation
 * status for the remaining 3.
 */

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { SCENARIOS, validateScenarios, findScenario, type Scenario, type ScenarioId } from "./scenarios";
import { SCENARIO_IMPL_DESIGN, computeImplDesignProgress } from "./extensions";
import {
  createSpawnSyncQcow2RetentionExecutor,
  executeQcow2SnapshotRetentionPlan,
  planQcow2SnapshotRetention,
  type Qcow2RetentionExecutionFeedback,
  type Qcow2RetentionExecutionResult,
  type Qcow2RetentionExecutor,
  type Qcow2SnapshotRetentionPlan,
} from "./qemu-state";

type Mode = "list" | "dry-run" | "scenario" | "all";

interface ParsedArgs {
  readonly mode: Mode;
  readonly scenarioId?: ScenarioId;
  readonly isoPath?: string;
}

export interface ScenarioResult {
  readonly id: ScenarioId;
  readonly status: "passed" | "failed" | "skipped" | "scaffolded";
  readonly durationMs?: number;
  readonly message?: string;
  readonly qemuRetentionPlan?: Qcow2SnapshotRetentionPlan;
  readonly qemuRetentionExecution?: Qcow2RetentionExecutionResult;
}

export interface RetentionRuntimeOptions {
  readonly execute?: boolean;
  readonly executor?: Qcow2RetentionExecutor;
  readonly cwd?: string;
  readonly timeoutMs?: number;
  readonly kvmAvailable?: boolean;
  readonly bootImagePath?: string;
  readonly runDirectory?: string;
}

const REPO_ROOT = resolve(import.meta.dir, "../../..");
const RETENTION_EXECUTION_ENV = "ZFLASH_QEMU_RETENTION_EXECUTE";
const RETENTION_TIMEOUT_ENV = "ZFLASH_QEMU_RETENTION_TIMEOUT_MS";
const RETENTION_BOOT_IMAGE_ENV = "ZFLASH_QEMU_RETENTION_BOOT_IMAGE";
const RETENTION_RUN_DIRECTORY_ENV = "ZFLASH_QEMU_RETENTION_RUN_DIR";
const KVM_PATH = "/dev/kvm";

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
    const isoPath = positional[0];
    if (positional.length === 0 || isoPath === undefined) {
      return { error: "--scenario requires an ISO path positional argument" };
    }
    return { mode: "scenario", scenarioId: id, isoPath };
  }
  if (args.includes("--all")) {
    const positional = args.filter((a) => !a.startsWith("--"));
    const isoPath = positional[0];
    if (positional.length === 0 || isoPath === undefined) {
      return { error: "--all requires an ISO path positional argument" };
    }
    return { mode: "all", isoPath };
  }
  return { error: `unrecognized arguments: ${args.join(" ")}` };
}

function emitListing(): void {
  console.log(
    JSON.stringify(
      {
        rowId: "B-0891",
        scenarioCount: SCENARIOS.length,
        implDesignProgress: computeImplDesignProgress(),
        scenarios: SCENARIOS.map((s) => {
          const implDesign =
            s.id === "reformat-with-retention" ||
            s.id === "reformat-from-scratch" ||
            s.id === "cluster-joining"
              ? SCENARIO_IMPL_DESIGN[s.id]
              : undefined;
          return {
            orderIndex: s.orderIndex,
            id: s.id,
            title: s.title,
            status: s.status,
            gates: s.gates,
            implDesign,
          };
        }),
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
  const absHarnessPath = resolve(REPO_ROOT, harnessPath);
  if (!existsSync(absHarnessPath)) {
    return {
      id: scenario.id,
      status: "failed",
      message: `composes-with harness not found: ${absHarnessPath}`,
    };
  }
  const start = Date.now();
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- bun is intentionally resolved from the active PATH; args are structured and never shell-expanded.
  const result = spawnSync("bun", [absHarnessPath, isoPath], {
    cwd: REPO_ROOT,
    stdio: "inherit",
  });
  const durationMs = Date.now() - start;
  const passed = result.status === 0;
  return passed
    ? { id: scenario.id, status: "passed", durationMs }
    : {
        id: scenario.id,
        status: "failed",
        durationMs,
        message: `delegated harness exited ${result.status}`,
      };
}

function reportScaffolded(scenario: Scenario): ScenarioResult {
  return {
    id: scenario.id,
    status: "scaffolded",
    message: `scenario definition only — implementation pending; composes-with: ${scenario.composesWith.join(", ")}`,
  };
}

function describeRetentionExecutionError(error: Qcow2RetentionExecutionFeedback): string {
  switch (error.kind) {
    case "command-failed":
      return `QEMU retention command failed at ${error.step} with exit ${error.exitCode ?? "unknown"}: ${error.stderr || "no stderr"}`;
    case "executor-threw":
      return `QEMU retention executor threw at ${error.step}: ${error.reason}`;
    case "serial-marker-failed":
      return `QEMU retention commands completed, but serial output did not prove retention; missing markers: ${error.assertion.missingMarkers.join(", ")}`;
  }
}

function retentionExecutionEnabledFromEnv(): boolean {
  return process.env[RETENTION_EXECUTION_ENV] === "1";
}

function retentionTimeoutMsFromEnv(): number | undefined {
  const raw = process.env[RETENTION_TIMEOUT_ENV];
  if (raw === undefined || raw.trim().length === 0) {
    return undefined;
  }
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function retentionBootImagePathFromEnv(): string | undefined {
  const raw = process.env[RETENTION_BOOT_IMAGE_ENV];
  if (raw === undefined || raw.trim().length === 0) {
    return undefined;
  }
  return resolve(raw);
}

function prepareRetentionRunDirectory(option: string | undefined): { ok: string } | { error: string } {
  const raw = option ?? process.env[RETENTION_RUN_DIRECTORY_ENV];
  try {
    if (raw !== undefined && raw.trim().length > 0) {
      const runDirectory = resolve(raw);
      mkdirSync(runDirectory, { recursive: true });
      return { ok: runDirectory };
    }
    return { ok: mkdtempSync(join(tmpdir(), "zeta-zflash-retention-")) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

function retentionArtifactPaths(absIsoPath: string, runDirectory: string): {
  readonly diskPath: string;
  readonly serialLogPath: string;
} {
  const artifactStem = basename(absIsoPath);
  return {
    diskPath: join(runDirectory, `${artifactStem}.scenario3.qcow2`),
    serialLogPath: join(runDirectory, `${artifactStem}.scenario3.serial.log`),
  };
}

export function runRetentionRuntime(
  isoPath: string,
  options: RetentionRuntimeOptions = {},
): ScenarioResult {
  const absIsoPath = resolve(isoPath);
  const runDirectory = prepareRetentionRunDirectory(options.runDirectory);
  if ("error" in runDirectory) {
    return {
      id: "reformat-with-retention",
      status: "failed",
      message: `could not prepare QEMU retention run directory: ${runDirectory.error}`,
    };
  }
  const bootImagePath = options.bootImagePath === undefined
    ? retentionBootImagePathFromEnv()
    : resolve(options.bootImagePath);
  const artifacts = retentionArtifactPaths(absIsoPath, runDirectory.ok);
  const planned = planQcow2SnapshotRetention({
    isoPath: absIsoPath,
    ...(bootImagePath === undefined ? {} : { bootImagePath }),
    diskPath: artifacts.diskPath,
    serialLogPath: artifacts.serialLogPath,
    snapshotName: "post-initial-format",
    kvmAvailable: options.kvmAvailable ?? existsSync(KVM_PATH),
  });
  if ("error" in planned) {
    return {
      id: "reformat-with-retention",
      status: "failed",
      message: `could not plan QEMU retention runtime: ${planned.error.field} ${planned.error.reason}`,
    };
  }

  if (options.execute !== true) {
    return {
      id: "reformat-with-retention",
      status: "failed",
      message: `QEMU snapshot/restart retention plan generated; set ${RETENTION_EXECUTION_ENV}=1 to run the real QEMU process executor. Without that explicit opt-in, the scenario fails closed.`,
      qemuRetentionPlan: planned.ok,
    };
  }

  const executorOptions = options.timeoutMs === undefined
    ? { cwd: options.cwd ?? REPO_ROOT }
    : { cwd: options.cwd ?? REPO_ROOT, timeoutMs: options.timeoutMs };
  const executor = options.executor ?? createSpawnSyncQcow2RetentionExecutor(executorOptions);
  const executed = executeQcow2SnapshotRetentionPlan(planned.ok, executor);

  if ("error" in executed) {
    return {
      id: "reformat-with-retention",
      status: "failed",
      message: describeRetentionExecutionError(executed.error),
      qemuRetentionPlan: planned.ok,
      qemuRetentionExecution: executed,
    };
  }

  return {
    id: "reformat-with-retention",
    status: "passed",
    message: "QEMU snapshot/restart retention execution observed all required serial markers.",
    qemuRetentionPlan: planned.ok,
    qemuRetentionExecution: executed,
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
      if (scenario.id === "reformat-with-retention") {
        const timeoutMs = retentionTimeoutMsFromEnv();
        const options = timeoutMs === undefined
          ? { execute: retentionExecutionEnabledFromEnv() }
          : { execute: retentionExecutionEnabledFromEnv(), timeoutMs };
        return runRetentionRuntime(isoPath, options);
      }
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
      return result.status === "failed" || result.status === "scaffolded" ? 1 : 0;
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
        if (result.status === "failed" || result.status === "scaffolded") {
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
