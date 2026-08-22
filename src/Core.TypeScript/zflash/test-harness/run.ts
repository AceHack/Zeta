#!/usr/bin/env bun
/**
 * src/Core.TypeScript/zflash/test-harness/run.ts
 *
 * 081KSNY2Z0008QG0R0008PN7RQ — zflash 5-scenario test-harness CLI dispatcher (PoC scaffold)
 *
 * Usage:
 *   bun src/Core.TypeScript/zflash/test-harness/run.ts --list
 *   bun src/Core.TypeScript/zflash/test-harness/run.ts --dry-run [--scenario <id>]
 *   bun src/Core.TypeScript/zflash/test-harness/run.ts --scenario initial-format <iso-path>
 *   bun src/Core.TypeScript/zflash/test-harness/run.ts --all <iso-path>
 *
 * Modes:
 *   --list      Print scenario matrix as structured table; exit 0
 *   --dry-run   Validate scenarios + report dispatcher plan without
 *               executing QEMU. Exit 0 on valid plan, non-zero on
 *               misconfiguration.
 *   --scenario  Run one scenario by id.
 *               - initial-format → audit + zflash bake + qemu-boot-test
 *               - boot-cluster-up → qemu-full-install-test.ts
 *               - reformat-with-retention → runRetentionRuntime
 *                 (ZFLASH_QEMU_RETENTION_EXECUTE=1 to execute)
 *               - reformat-from-scratch → runPathForkRuntime
 *                 (ZFLASH_QEMU_PATH_FORK_EXECUTE=1 to execute)
 *               - cluster-joining → skipped, which is NOT a pass (multi-VM pending)
 *   --all       Run all 5 scenarios in orderIndex order; a non-passing
 *               scenario skips the scenarios it gates.
 *
 * Output:
 *   JSON-structured per-scenario result to stdout
 *   Human-readable summary to stderr
 *
 * Exit codes:
 *   0  --list / --dry-run succeeded (the plan is well-formed), OR every
 *      executed scenario PASSED
 *   1  one or more executed scenarios did not pass — failed, scaffolded, OR
 *      skipped. A skipped scenario is a check that did not run; reporting it
 *      as green would be a check that implies more than it tested.
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
import { fileURLToPath } from "node:url";
import { SCENARIOS, validateScenarios, findScenario, type Scenario, type ScenarioId } from "./scenarios";
import { SCENARIO_IMPL_DESIGN, computeImplDesignProgress } from "./extensions";
import { prepareBootImage } from "./prepare-boot-image";
import {
  createSpawnSyncQcow2RetentionExecutor,
  executeQcow2SnapshotRetentionPlan,
  planQcow2SnapshotRetention,
  type Qcow2RetentionExecutionFeedback,
  type Qcow2RetentionExecutionResult,
  type Qcow2RetentionExecutor,
  type Qcow2SnapshotRetentionPlan,
} from "./qemu-state";
import {
  executePathForkRuntimePlan,
  planPathForkBaselineBootstrap,
  planPathForkRuntime,
  type PathForkExecutionFeedback,
  type PathForkExecutionResult,
  type PathForkRuntimePlan,
} from "./path-fork";
const createSpawnSyncPathForkExecutor = createSpawnSyncQcow2RetentionExecutor;

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
  readonly pathForkPlan?: PathForkRuntimePlan;
  readonly pathForkExecution?: PathForkExecutionResult;
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

export interface PathForkRuntimeOptions {
  readonly execute?: boolean;
  readonly bootstrap?: boolean;
  readonly executor?: Qcow2RetentionExecutor;
  readonly cwd?: string;
  readonly timeoutMs?: number;
  readonly bootImagePath?: string;
  readonly freshBootImagePath?: string;
  readonly runDirectory?: string;
  readonly kvmAvailable?: boolean;
}

const currentDir = typeof import.meta.dir === "string" ? import.meta.dir : fileURLToPath(new URL(".", import.meta.url));
const REPO_ROOT = resolve(currentDir, "../../../..");
const CI_DIR = "src/Core.TypeScript/ci";
const AUDIT_INSTALLER_ISO = `${CI_DIR}/audit-installer-iso-content.ts`;
const QEMU_BOOT_TEST = `${CI_DIR}/qemu-boot-test.ts`;
const QEMU_FULL_INSTALL_TEST = `${CI_DIR}/qemu-full-install-test.ts`;
const RETENTION_EXECUTION_ENV = "ZFLASH_QEMU_RETENTION_EXECUTE";
const RETENTION_TIMEOUT_ENV = "ZFLASH_QEMU_RETENTION_TIMEOUT_MS";
const RETENTION_BOOT_IMAGE_ENV = "ZFLASH_QEMU_RETENTION_BOOT_IMAGE";
const RETENTION_RUN_DIRECTORY_ENV = "ZFLASH_QEMU_RETENTION_RUN_DIR";
const PATH_FORK_BOOT_IMAGE_ENV = "ZFLASH_QEMU_PATH_FORK_BOOT_IMAGE";
const PATH_FORK_RUN_DIRECTORY_ENV = "ZFLASH_QEMU_PATH_FORK_RUN_DIR";
const PATH_FORK_EXECUTION_ENV = "ZFLASH_QEMU_PATH_FORK_EXECUTE";
const PATH_FORK_BOOTSTRAP_ENV = "ZFLASH_QEMU_PATH_FORK_BOOTSTRAP";
const PATH_FORK_TIMEOUT_ENV = "ZFLASH_QEMU_PATH_FORK_TIMEOUT_MS";
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
        rowId: "081KSNY2Z0008QG0R0008PN7RQ",
        scenarioCount: SCENARIOS.length,
        implDesignProgress: computeImplDesignProgress(),
        scenarios: SCENARIOS.map((s) => {
          const implDesign =
            s.id === "reformat-with-retention" || s.id === "reformat-from-scratch" || s.id === "cluster-joining"
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
  const targets = scenarioId ? SCENARIOS.filter((s) => s.id === scenarioId) : SCENARIOS;
  if (targets.length === 0) {
    console.error(`scenario not found: ${scenarioId}`);
    return 2;
  }
  console.log(
    JSON.stringify(
      {
        rowId: "081KSNY2Z0008QG0R0008PN7RQ",
        mode: "dry-run",
        targets: targets.map((s) => ({
          id: s.id,
          status: s.status,
          plan: dryRunPlanMessage(s),
        })),
      },
      null,
      2,
    ),
  );
  return 0;
}

function dryRunPlanMessage(scenario: Scenario): string {
  if (scenario.id === "initial-format") {
    return "would run audit-installer-iso-content.ts + zflash-file-backed --test bake + qemu-boot-test.ts --usb-image <zflash-boot.img>";
  }
  // Scenario-specific plans must win over the generic composes-with-existing
  // delegate message — otherwise retention/path-fork look like full-install.
  if (scenario.id === "reformat-with-retention") {
    return "would generate QEMU snapshot/restart retention plan; auto-prepare zflash boot image when execute opt-in is set";
  }
  if (scenario.id === "reformat-from-scratch") {
    return "would generate QEMU path-fork plan for migrate-existing-creds + fresh-cluster; auto-prepare zflash boot image when execute opt-in is set";
  }
  if (scenario.id === "boot-cluster-up") {
    return `would delegate to existing tools/ci/ substrate: ${scenario.composesWith[0]}`;
  }
  if (scenario.status === "composes-with-existing") {
    return `would delegate to existing tools/ci/ substrate: ${scenario.composesWith[0]}`;
  }
  return `would report scaffolded — implementation pending; composes-with: ${scenario.composesWith.join(", ")}`;
}

function runHarnessScript(relPath: string, args: readonly string[]): { ok: boolean; exitCode: number | null } {
  const absPath = resolve(REPO_ROOT, relPath);
  if (!existsSync(absPath)) {
    return { ok: false, exitCode: null };
  }
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- bun is intentionally resolved from the active PATH; args are structured and never shell-expanded.
  const result = spawnSync("bun", [absPath, ...args], {
    cwd: REPO_ROOT,
    stdio: "inherit",
  });
  return { ok: result.status === 0, exitCode: result.status };
}

/**
 * Names the outcome behind a `qemu-boot-test.ts` exit code.
 *
 * That harness deliberately reports FOUR distinct outcomes (0 BOOTED /
 * 1 BOOT-FAILED / 3 TIMEOUT / 4 STALLED) precisely so a broken image and
 * a slow runner stop reading the same. Scenario 1 was collapsing all of
 * them back into "exit N" in the one line a CI reader actually sees, so
 * the distinction was being paid for and then thrown away at the last
 * step. The blocking policy is UNCHANGED — every non-zero code still
 * fails the scenario — only the reporting is repaired. Loosening the
 * gate would need evidence the x86_64 lane is flaky, and the evidence
 * says the opposite: 19 consecutive runs, 21-24s each, 300s budget.
 */
export function describeBootExit(exitCode: number | null): string {
  if (exitCode === null) return "harness missing";
  const named: Readonly<Record<number, string>> = {
    0: "BOOTED",
    1: "BOOT-FAILED — positive evidence the image did not boot",
    2: "usage error",
    3: "TIMEOUT — budget exhausted while the guest was still progressing",
    4: "STALLED — serial silent past the kernel handoff",
  };
  const name = named[exitCode];
  return name === undefined ? `exit ${exitCode}` : `exit ${exitCode}: ${name}`;
}

function runInitialFormatScenario(isoPath: string): ScenarioResult {
  const start = Date.now();
  const absIso = resolve(isoPath);
  const steps: string[] = [];

  const audit = runHarnessScript(AUDIT_INSTALLER_ISO, ["--iso", absIso]);
  steps.push("audit-installer-iso-content");
  if (!audit.ok) {
    return {
      id: "initial-format",
      status: "failed",
      durationMs: Date.now() - start,
      message: `ISO content audit failed (exit ${audit.exitCode ?? "missing harness"})`,
    };
  }

  const runDir = mkdtempSync(join(tmpdir(), "zeta-zflash-initial-format-"));
  const bootImagePath = join(runDir, `${basename(absIso)}.zflash-boot.img`);
  const prepared = prepareBootImage({
    isoPath: absIso,
    outputImagePath: bootImagePath,
    withCredentialBlob: true,
    testMode: true,
    hostname: "node-qemu-test",
    pubkeyPath: resolveTestInfraPubkeyPath(),
  });
  steps.push("zflash-file-backed --test");
  if ("error" in prepared) {
    return {
      id: "initial-format",
      status: "failed",
      durationMs: Date.now() - start,
      message: `zflash file-backed bake failed: ${prepared.error}`,
    };
  }

  const boot = runHarnessScript(QEMU_BOOT_TEST, ["--usb-image", prepared.outputImagePath]);
  steps.push("qemu-boot-test");
  const durationMs = Date.now() - start;
  if (!boot.ok) {
    return {
      id: "initial-format",
      status: "failed",
      durationMs,
      message: `QEMU boot smoke-test failed (${describeBootExit(boot.exitCode)}) after ${steps.join(" → ")}`,
    };
  }

  return {
    id: "initial-format",
    status: "passed",
    durationMs,
    message: `passed ${steps.join(" → ")}; zflash boot image at ${prepared.outputImagePath}`,
  };
}

function retentionRuntimeOptionsFromEnv(): RetentionRuntimeOptions {
  const timeoutMs = retentionTimeoutMsFromEnv();
  return timeoutMs === undefined
    ? { execute: retentionExecutionEnabledFromEnv() }
    : { execute: retentionExecutionEnabledFromEnv(), timeoutMs };
}

function pathForkRuntimeOptionsFromEnv(): PathForkRuntimeOptions {
  const timeoutMs = pathForkTimeoutMsFromEnv();
  return timeoutMs === undefined
    ? {
        execute: pathForkExecutionEnabledFromEnv(),
        bootstrap: pathForkBootstrapEnabledFromEnv(),
      }
    : {
        execute: pathForkExecutionEnabledFromEnv(),
        bootstrap: pathForkBootstrapEnabledFromEnv(),
        timeoutMs,
      };
}

function runComposingScenario(scenario: Scenario, isoPath: string): ScenarioResult {
  if (scenario.id === "initial-format") {
    return runInitialFormatScenario(isoPath);
  }
  // Scenarios 3/4 were promoted to composes-with-existing but keep dedicated
  // runtimes — do NOT fall through to qemu-full-install-test (CI workflow_dispatch
  // sets ZFLASH_QEMU_*_EXECUTE=1 for these paths).
  if (scenario.id === "reformat-with-retention") {
    return runRetentionRuntime(isoPath, retentionRuntimeOptionsFromEnv());
  }
  if (scenario.id === "reformat-from-scratch") {
    return runPathForkRuntime(isoPath, pathForkRuntimeOptionsFromEnv());
  }
  if (scenario.id !== "boot-cluster-up") {
    return {
      id: scenario.id,
      status: "failed",
      message: `composes-with-existing scenario "${scenario.id}" has no dedicated harness mapping`,
    };
  }
  const harnessPath = QEMU_FULL_INSTALL_TEST;
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

function describePathForkExecutionError(error: PathForkExecutionFeedback): string {
  switch (error.kind) {
    case "missing-runtime-requirements":
      return `QEMU path-fork missing runtime requirement(s) for ${error.forkId}: ${error.requirements.join(", ")}`;
    case "command-failed":
      return `QEMU path-fork command failed at ${error.step}${error.forkId === undefined ? "" : ` (${error.forkId})`} with exit ${error.exitCode ?? "unknown"}: ${error.stderr || "no stderr"}`;
    case "executor-threw":
      return `QEMU path-fork executor threw at ${error.step}${error.forkId === undefined ? "" : ` (${error.forkId})`}: ${error.reason}`;
    case "serial-marker-failed":
      if (error.assertion.kind === "missing-serial-markers") {
        return `QEMU path-fork fork ${error.forkId} missing serial markers: ${error.assertion.missingMarkers.join(", ")}`;
      }
      return `QEMU path-fork fork ${error.forkId} observed forbidden serial markers: ${error.assertion.presentMarkers.join(", ")}`;
    case "bootstrap-failed":
      return `QEMU path-fork baseline bootstrap failed: ${describeRetentionExecutionError(error.bootstrapError)}`;
  }
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

function pathForkExecutionEnabledFromEnv(): boolean {
  return process.env[PATH_FORK_EXECUTION_ENV] === "1";
}

function pathForkBootstrapEnabledFromEnv(): boolean {
  return process.env[PATH_FORK_BOOTSTRAP_ENV] === "1";
}

function pathForkTimeoutMsFromEnv(): number | undefined {
  const raw = process.env[PATH_FORK_TIMEOUT_ENV];
  if (raw === undefined || raw.trim().length === 0) {
    return undefined;
  }
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function pathForkBootImagePathFromEnv(): string | undefined {
  const raw = process.env[PATH_FORK_BOOT_IMAGE_ENV];
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

function preparePathForkRunDirectory(option: string | undefined): { ok: string } | { error: string } {
  const raw = option ?? process.env[PATH_FORK_RUN_DIRECTORY_ENV];
  try {
    if (raw !== undefined && raw.trim().length > 0) {
      const runDirectory = resolve(raw);
      mkdirSync(runDirectory, { recursive: true });
      return { ok: runDirectory };
    }
    return { ok: mkdtempSync(join(tmpdir(), "zeta-zflash-path-fork-")) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

function retentionArtifactPaths(
  absIsoPath: string,
  runDirectory: string,
): {
  readonly diskPath: string;
  readonly serialLogPath: string;
} {
  const artifactStem = basename(absIsoPath);
  return {
    diskPath: join(runDirectory, `${artifactStem}.scenario3.qcow2`),
    serialLogPath: join(runDirectory, `${artifactStem}.scenario3.serial.log`),
  };
}

function pathForkArtifactPaths(
  absIsoPath: string,
  runDirectory: string,
): {
  readonly startingDiskPath: string;
  readonly baselineSerialLogPath: string;
  readonly migrateSerialLogPath: string;
  readonly freshSerialLogPath: string;
} {
  const artifactStem = basename(absIsoPath);
  return {
    startingDiskPath: join(runDirectory, `${artifactStem}.scenario4.qcow2`),
    baselineSerialLogPath: join(runDirectory, `${artifactStem}.scenario4.bootstrap.serial.log`),
    migrateSerialLogPath: join(runDirectory, `${artifactStem}.scenario4.migrate.serial.log`),
    freshSerialLogPath: join(runDirectory, `${artifactStem}.scenario4.fresh.serial.log`),
  };
}

function resolveTestInfraPubkeyPath(): string {
  return resolve(REPO_ROOT, "src/Core.TypeScript/zflash/test-harness/keys/zeta-test-infra.pub");
}

function ensureZflashBootImage(
  isoPath: string,
  outputPath: string,
  withCredentialBlob: boolean,
): { ok: string } | { error: string } {
  const prepared = prepareBootImage({
    isoPath,
    outputImagePath: outputPath,
    withCredentialBlob,
    testMode: true,
    hostname: "node-qemu-test",
    pubkeyPath: resolveTestInfraPubkeyPath(),
  });
  if ("error" in prepared) {
    return { error: prepared.error };
  }
  return { ok: prepared.outputImagePath };
}

export function runRetentionRuntime(isoPath: string, options: RetentionRuntimeOptions = {}): ScenarioResult {
  const absIsoPath = resolve(isoPath);
  const runDirectory = prepareRetentionRunDirectory(options.runDirectory);
  if ("error" in runDirectory) {
    return {
      id: "reformat-with-retention",
      status: "failed",
      message: `could not prepare QEMU retention run directory: ${runDirectory.error}`,
    };
  }
  const bootImagePath = (() => {
    if (options.bootImagePath !== undefined) {
      return resolve(options.bootImagePath);
    }
    const fromEnv = retentionBootImagePathFromEnv();
    if (fromEnv !== undefined) {
      return fromEnv;
    }
    if (options.execute === true && existsSync(absIsoPath)) {
      const autoPath = join(runDirectory.ok, `${basename(absIsoPath)}.retention-boot.img`);
      const ensured = ensureZflashBootImage(absIsoPath, autoPath, true);
      if ("error" in ensured) {
        return ensured;
      }
      return ensured.ok;
    }
    return undefined;
  })();
  if (typeof bootImagePath === "object" && "error" in bootImagePath) {
    return {
      id: "reformat-with-retention",
      status: "failed",
      message: `could not prepare retention boot image: ${bootImagePath.error}`,
    };
  }
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

  const executorOptions =
    options.timeoutMs === undefined
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

export function runPathForkRuntime(isoPath: string, options: PathForkRuntimeOptions = {}): ScenarioResult {
  const absIsoPath = resolve(isoPath);
  const runDirectory = preparePathForkRunDirectory(options.runDirectory);
  if ("error" in runDirectory) {
    return {
      id: "reformat-from-scratch",
      status: "failed",
      message: `could not prepare QEMU path-fork run directory: ${runDirectory.error}`,
    };
  }
  const bootImagePath = (() => {
    if (options.bootImagePath !== undefined) {
      return resolve(options.bootImagePath);
    }
    const fromEnv = pathForkBootImagePathFromEnv();
    if (fromEnv !== undefined) {
      return fromEnv;
    }
    if (options.execute === true && existsSync(absIsoPath)) {
      const autoPath = join(runDirectory.ok, `${basename(absIsoPath)}.path-fork-boot-retain.img`);
      const ensured = ensureZflashBootImage(absIsoPath, autoPath, true);
      if ("error" in ensured) {
        return ensured;
      }
      return ensured.ok;
    }
    return undefined;
  })();
  if (typeof bootImagePath === "object" && "error" in bootImagePath) {
    return {
      id: "reformat-from-scratch",
      status: "failed",
      message: `could not prepare path-fork retention boot image: ${bootImagePath.error}`,
    };
  }
  const freshBootImagePath = (() => {
    if (options.freshBootImagePath !== undefined) {
      return resolve(options.freshBootImagePath);
    }
    if (options.execute === true && existsSync(absIsoPath)) {
      const autoPath = join(runDirectory.ok, `${basename(absIsoPath)}.path-fork-boot-fresh.img`);
      const ensured = ensureZflashBootImage(absIsoPath, autoPath, false);
      if ("error" in ensured) {
        return ensured;
      }
      return ensured.ok;
    }
    return undefined;
  })();
  if (typeof freshBootImagePath === "object" && "error" in freshBootImagePath) {
    return {
      id: "reformat-from-scratch",
      status: "failed",
      message: `could not prepare path-fork fresh boot image: ${freshBootImagePath.error}`,
    };
  }
  const artifacts = pathForkArtifactPaths(absIsoPath, runDirectory.ok);
  const planned = planPathForkRuntime({
    isoPath: absIsoPath,
    ...(bootImagePath === undefined ? {} : { bootImagePath }),
    ...(freshBootImagePath === undefined ? {} : { freshBootImagePath }),
    startingDiskPath: artifacts.startingDiskPath,
    migrateSerialLogPath: artifacts.migrateSerialLogPath,
    freshSerialLogPath: artifacts.freshSerialLogPath,
    kvmAvailable: options.kvmAvailable ?? existsSync(KVM_PATH),
  });
  if ("error" in planned) {
    return {
      id: "reformat-from-scratch",
      status: "failed",
      message: `could not plan QEMU path-fork runtime: ${planned.error.field} ${planned.error.reason}`,
    };
  }

  const missingRequirements = planned.ok.forks.flatMap((fork) => fork.missingRuntimeRequirements);
  const requirementSuffix =
    missingRequirements.length === 0
      ? ""
      : ` Missing runtime requirement(s): ${[...new Set(missingRequirements)].join(", ")}.`;

  if (options.execute !== true) {
    return {
      id: "reformat-from-scratch",
      status: "failed",
      message: `QEMU path-fork plan generated; set ${PATH_FORK_EXECUTION_ENV}=1 to run the real QEMU process executor. Without that explicit opt-in, the scenario fails closed.${requirementSuffix}`,
      pathForkPlan: planned.ok,
    };
  }

  const executorOptions =
    options.timeoutMs === undefined
      ? { cwd: options.cwd ?? REPO_ROOT }
      : { cwd: options.cwd ?? REPO_ROOT, timeoutMs: options.timeoutMs };
  const executor = options.executor ?? createSpawnSyncPathForkExecutor(executorOptions);
  const bootstrapPlan =
    options.bootstrap === true
      ? (() => {
          const plannedBootstrap = planPathForkBaselineBootstrap({
            isoPath: absIsoPath,
            startingDiskPath: artifacts.startingDiskPath,
            baselineSerialLogPath: artifacts.baselineSerialLogPath,
            kvmAvailable: options.kvmAvailable ?? existsSync(KVM_PATH),
          });
          if ("error" in plannedBootstrap) {
            return { error: plannedBootstrap.error };
          }
          return { ok: plannedBootstrap };
        })()
      : undefined;

  if (bootstrapPlan !== undefined && "error" in bootstrapPlan) {
    return {
      id: "reformat-from-scratch",
      status: "failed",
      message: `could not plan QEMU path-fork baseline bootstrap: ${bootstrapPlan.error}`,
      pathForkPlan: planned.ok,
    };
  }

  const executed = executePathForkRuntimePlan(
    planned.ok,
    executor,
    bootstrapPlan === undefined ? {} : { bootstrapPlan: bootstrapPlan.ok },
  );

  if ("error" in executed) {
    return {
      id: "reformat-from-scratch",
      status: "failed",
      message: describePathForkExecutionError(executed.error),
      pathForkPlan: planned.ok,
      pathForkExecution: executed,
    };
  }

  return {
    id: "reformat-from-scratch",
    status: "passed",
    message: "QEMU path-fork execution observed both migrate-existing-creds and fresh-cluster serial marker contracts.",
    pathForkPlan: planned.ok,
    pathForkExecution: executed,
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
      if (scenario.id === "cluster-joining") {
        // NOT a pass — `skipped` names what happened (nothing ran) and the
        // exit code says so.
        //
        // The FIRST blocker has CLEARED. There is now a join to observe:
        // k3s's join is the join (Aaron 2026-08-13, closing PR #10493's open
        // question), and full-ai-cluster/nixos/modules/k3s-join-observer.nix
        // witnesses it, emitting B0891_CLUSTER_JOIN_SERIAL_MARKERS to serial
        // on every agent-role node. nixos/tests/k3s-agent-join.nix proves that
        // end-to-end against the shipped modules, two nodes on one segment.
        //
        // The status stays `skipped` anyway, because four separate things
        // still stand between this harness and an honest verdict — and none of
        // them is the join:
        //
        //   1. joining-node-role-provisioning. Until 2026-08-17 zflash wrote
        //      no firstboot config at all, so a prepared image installed
        //      HOST=control-plane and the "joining" VM came up as a second
        //      control plane running no agent and therefore no observer.
        //      A carrier now exists end to end on paper: firstboot-role.ts
        //      composes /zeta-firstboot.conf, planFileBackedZflashImage writes
        //      it (plus an optional /zeta-join-token), zeta-first-boot.sh
        //      sources the ESP copy in preference to the ISO's,
        //      zeta-install.sh installs the token where k3s-agent.nix reads
        //      it, and injected-join-server.nix overrides serverAddr on
        //      agents. NOT ONE OF THOSE STEPS HAS BEEN OBSERVED ON A BOOTED
        //      GUEST — they are unit-tested pure functions and untested bash
        //      and Nix. The blocker stands until a guest logs `role=joiner`.
        //   2. joining-node-address-assignment. The shared segment is a bare
        //      QEMU socket: no DHCP, no DNS, no router. Avahi/nss-mdns is the
        //      only name service on the guests and it answers for `.local`
        //      names only, so k3s-agent.nix's default
        //      https://control-plane:6443 cannot resolve there. The scenario-5
        //      plan therefore uses control-plane.local and requires the
        //      existing node to be flashed --host control-plane; whether mDNS
        //      completes over IPv4 link-local on that segment is UNMEASURED.
        //   3. shared-l2-segment. The args half has cleared:
        //      buildQemuSystemBootArgs takes injected netdev specs and
        //      planMultiVMRuntime puts both VMs on one rootless QEMU socket
        //      segment with distinct MACs. The proof half has not: no frame
        //      has crossed it, because nothing runs the VMs concurrently.
        //   4. concurrent-vm-lifecycle. executeMultiVMRuntimePlan boots the
        //      VMs serially and SIGTERMs each on marker match, so the existing
        //      node is dead before the joining node starts.
        //
        // Dispatching now would produce a `failed` whose cause is none of the
        // things this scenario claims to test — which is worse than an honest
        // skip, because it sends the next reader hunting a join bug that is
        // not there.
        return {
          id: "cluster-joining",
          status: "skipped",
          message:
            "NOT RUN (counts as non-passing): the join itself is no longer the blocker — " +
            "k3s-join-observer.nix emits B0891_CLUSTER_JOIN_SERIAL_MARKERS on agent nodes " +
            "and nixos/tests/k3s-agent-join.nix proves the two-node join. Still blocked on " +
            "four items, none of them the join: (1) joining-node-role-provisioning — zflash " +
            "can now write /zeta-firstboot.conf and /zeta-join-token and the guest reads both, " +
            "but nothing has BOOTED from a joiner-flashed image, so the chain is unit-tested " +
            "and unexercised; (2) joining-node-address-assignment — the socket segment has no " +
            "DHCP and no DNS and nss-mdns answers for .local only, so a bare control-plane " +
            "label cannot resolve there; (3) shared-l2-segment — the netdev args and " +
            "socket-segment plan now exist with distinct MACs, but no frame has crossed the " +
            "segment because nothing boots the VMs concurrently; (4) concurrent-vm-lifecycle — " +
            "executeMultiVMRuntimePlan boots serially and kills each VM on marker match. All " +
            "four must clear before this scenario can honestly report passed or failed.",
        };
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

/**
 * Exit-code truth rule: ONLY `"passed"` is green.
 *
 * `"skipped"` — a scenario the harness declined to run — is NOT a pass. The
 * dispatcher used to count only `"failed"` and `"scaffolded"` as non-zero, so
 * `--all` exited 0 while silently omitting `cluster-joining`: a full-matrix
 * run reported green having never run a fifth of the matrix. That is the same
 * defect class `.github/workflows/zflash-harness-lint.yml` confesses one level
 * up ("a green check that implies more than it tested is worse than no
 * check"). `"scaffolded"` and `"failed"` are likewise non-zero.
 *
 * This governs EXECUTION modes only (`--scenario` / `--all`). `--list` and
 * `--dry-run` never execute a scenario, never produce a `ScenarioResult`, and
 * legitimately exit 0 on a valid plan: they claim only "this plan is
 * well-formed", which is exactly what they checked.
 */
export function isPassing(result: ScenarioResult): boolean {
  return result.status === "passed";
}

/** 0 iff EVERY executed scenario passed; 1 otherwise. See {@link isPassing}. */
export function exitCodeForResults(results: readonly ScenarioResult[]): number {
  return results.every(isPassing) ? 0 : 1;
}

function emitResults(results: ReadonlyArray<ScenarioResult>): void {
  const nonPassing = results.filter((r) => !isPassing(r));
  console.log(
    JSON.stringify(
      {
        rowId: "081KSNY2Z0008QG0R0008PN7RQ",
        summary: {
          total: results.length,
          passed: results.filter((r) => r.status === "passed").length,
          failed: results.filter((r) => r.status === "failed").length,
          scaffolded: results.filter((r) => r.status === "scaffolded").length,
          skipped: results.filter((r) => r.status === "skipped").length,
          // Everything the exit code refuses to call green, counted where a
          // reader of the JSON sees it — so the summary cannot imply more
          // than the run tested either.
          nonPassing: nonPassing.length,
        },
        results,
      },
      null,
      2,
    ),
  );
  if (nonPassing.length > 0) {
    const detail = nonPassing.map((r) => `${r.id}=${r.status}`).join(", ");
    console.error(
      `081KSNY2Z0008QG0R0008PN7RQ: ${String(nonPassing.length)} of ${String(results.length)} scenario(s) did not pass — ${detail}. ` +
        "A scenario that did not run is not a scenario that passed; exiting non-zero.",
    );
  }
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
      return exitCodeForResults([result]);
    }
    case "all": {
      if (!parsed.isoPath) {
        console.error("--all requires iso path");
        return 2;
      }
      const sorted = [...SCENARIOS].sort((a, b) => a.orderIndex - b.orderIndex);
      const results: ScenarioResult[] = [];
      // Gating keys off NON-PASSING, not just "failed": a scenario that never
      // ran cannot vouch for the scenarios it gates, so it skips them too.
      const nonPassingIds = new Set<ScenarioId>();
      for (const scenario of sorted) {
        const gatedBy = sorted.find((g) => g.gates.includes(scenario.id) && nonPassingIds.has(g.id));
        if (gatedBy) {
          results.push({
            id: scenario.id,
            status: "skipped",
            message: `gated by non-passing scenario: ${gatedBy.id}`,
          });
          nonPassingIds.add(scenario.id);
          continue;
        }
        const result = runScenario(scenario.id, parsed.isoPath);
        results.push(result);
        if (!isPassing(result)) {
          nonPassingIds.add(scenario.id);
        }
      }
      emitResults(results);
      return exitCodeForResults(results);
    }
  }
}

if (import.meta.main) {
  process.exit(main(process.argv));
}
