import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { SCENARIOS, validateScenarios, findScenario } from "./scenarios";
import { SCENARIO_IMPL_DESIGN, computeImplDesignProgress } from "./extensions";
import { prepareBootImage, DEFAULT_ESP_OFFSET_BYTES } from "./prepare-boot-image";
import {
  createSpawnSyncQcow2RetentionExecutor,
  executeQcow2SnapshotRetentionPlan,
  planQcow2SnapshotRetention
} from "./qemu-state";
import {
  createSpawnSyncQcow2RetentionExecutor as createSpawnSyncPathForkExecutor,
  executePathForkRuntimePlan,
  planPathForkBaselineBootstrap,
  planPathForkRuntime
} from "./path-fork";
const REPO_ROOT = resolve(import.meta.dir, "../../../.."), CI_DIR = "src/Core.TypeScript/ci", AUDIT_INSTALLER_ISO = `${CI_DIR}/audit-installer-iso-content.ts`, QEMU_BOOT_TEST = `${CI_DIR}/qemu-boot-test.ts`, QEMU_FULL_INSTALL_TEST = `${CI_DIR}/qemu-full-install-test.ts`, RETENTION_EXECUTION_ENV = "ZFLASH_QEMU_RETENTION_EXECUTE", RETENTION_TIMEOUT_ENV = "ZFLASH_QEMU_RETENTION_TIMEOUT_MS", RETENTION_BOOT_IMAGE_ENV = "ZFLASH_QEMU_RETENTION_BOOT_IMAGE", RETENTION_RUN_DIRECTORY_ENV = "ZFLASH_QEMU_RETENTION_RUN_DIR", PATH_FORK_BOOT_IMAGE_ENV = "ZFLASH_QEMU_PATH_FORK_BOOT_IMAGE", PATH_FORK_RUN_DIRECTORY_ENV = "ZFLASH_QEMU_PATH_FORK_RUN_DIR", PATH_FORK_EXECUTION_ENV = "ZFLASH_QEMU_PATH_FORK_EXECUTE", PATH_FORK_BOOTSTRAP_ENV = "ZFLASH_QEMU_PATH_FORK_BOOTSTRAP", PATH_FORK_TIMEOUT_ENV = "ZFLASH_QEMU_PATH_FORK_TIMEOUT_MS", KVM_PATH = "/dev/kvm";
function parseArgs(argv) {
  const args = argv.slice(2);
  if (args.length === 0)
    return { error: "no mode specified \u2014 use --list, --dry-run, --scenario, or --all" };
  if (args.includes("--list"))
    return { mode: "list" };
  if (args.includes("--dry-run")) {
    const scenarioIdx = args.indexOf("--scenario");
    if (scenarioIdx >= 0 && scenarioIdx + 1 < args.length)
      return { mode: "dry-run", scenarioId: args[scenarioIdx + 1] };
    return { mode: "dry-run" };
  }
  if (args.includes("--scenario")) {
    const scenarioIdx = args.indexOf("--scenario");
    if (scenarioIdx + 1 >= args.length)
      return { error: "--scenario requires a scenario id" };
    const id = args[scenarioIdx + 1], positional = args.filter((a, i) => i !== scenarioIdx && i !== scenarioIdx + 1 && !a.startsWith("--")), isoPath = positional[0];
    if (positional.length === 0 || isoPath === void 0)
      return { error: "--scenario requires an ISO path positional argument" };
    return { mode: "scenario", scenarioId: id, isoPath };
  }
  if (args.includes("--all")) {
    const positional = args.filter((a) => !a.startsWith("--")), isoPath = positional[0];
    if (positional.length === 0 || isoPath === void 0)
      return { error: "--all requires an ISO path positional argument" };
    return { mode: "all", isoPath };
  }
  return { error: `unrecognized arguments: ${args.join(" ")}` };
}
function emitListing() {
  console.log(JSON.stringify({
    rowId: "081KSNY2Z0008QG0R0008PN7RQ",
    scenarioCount: SCENARIOS.length,
    implDesignProgress: computeImplDesignProgress(),
    scenarios: SCENARIOS.map((s) => {
      const implDesign = s.id === "reformat-with-retention" || s.id === "reformat-from-scratch" || s.id === "cluster-joining" ? SCENARIO_IMPL_DESIGN[s.id] : void 0;
      return {
        orderIndex: s.orderIndex,
        id: s.id,
        title: s.title,
        status: s.status,
        gates: s.gates,
        implDesign
      };
    })
  }, null, 2));
}
function emitDryRun(scenarioId) {
  try {
    validateScenarios(SCENARIOS);
  } catch (e) {
    console.error(`scenarios.ts invariant violated: ${e.message}`);
    return 2;
  }
  const targets = scenarioId ? SCENARIOS.filter((s) => s.id === scenarioId) : SCENARIOS;
  if (targets.length === 0) {
    console.error(`scenario not found: ${scenarioId}`);
    return 2;
  }
  console.log(JSON.stringify({
    rowId: "081KSNY2Z0008QG0R0008PN7RQ",
    mode: "dry-run",
    targets: targets.map((s) => ({
      id: s.id,
      status: s.status,
      plan: dryRunPlanMessage(s)
    }))
  }, null, 2));
  return 0;
}
function dryRunPlanMessage(scenario) {
  if (scenario.id === "initial-format")
    return "would run audit-installer-iso-content.ts + zflash-file-backed --test bake + qemu-boot-test.ts --usb-image <zflash-boot.img>";
  if (scenario.id === "reformat-with-retention")
    return "would generate QEMU snapshot/restart retention plan; auto-prepare zflash boot image when execute opt-in is set";
  if (scenario.id === "reformat-from-scratch")
    return "would generate QEMU path-fork plan for migrate-existing-creds + fresh-cluster; auto-prepare zflash boot image when execute opt-in is set";
  if (scenario.id === "boot-cluster-up")
    return `would delegate to existing tools/ci/ substrate: ${scenario.composesWith[0]}`;
  if (scenario.status === "composes-with-existing")
    return `would delegate to existing tools/ci/ substrate: ${scenario.composesWith[0]}`;
  return `would report scaffolded \u2014 implementation pending; composes-with: ${scenario.composesWith.join(", ")}`;
}
function runHarnessScript(relPath, args) {
  const absPath = resolve(REPO_ROOT, relPath);
  if (!existsSync(absPath))
    return { ok: !1, exitCode: null };
  const result = spawnSync("bun", [absPath, ...args], {
    cwd: REPO_ROOT,
    stdio: "inherit"
  });
  return { ok: result.status === 0, exitCode: result.status };
}
function runInitialFormatScenario(isoPath) {
  const start = Date.now(), absIso = resolve(isoPath), steps = [], audit = runHarnessScript(AUDIT_INSTALLER_ISO, ["--iso", absIso]);
  steps.push("audit-installer-iso-content");
  if (!audit.ok)
    return {
      id: "initial-format",
      status: "failed",
      durationMs: Date.now() - start,
      message: `ISO content audit failed (exit ${audit.exitCode ?? "missing harness"})`
    };
  const runDir = mkdtempSync(join(tmpdir(), "zeta-zflash-initial-format-")), bootImagePath = join(runDir, `${basename(absIso)}.zflash-boot.img`), prepared = prepareBootImage({
    isoPath: absIso,
    outputImagePath: bootImagePath,
    withCredentialBlob: !0,
    testMode: !0,
    hostname: "node-qemu-test",
    espOffsetBytes: DEFAULT_ESP_OFFSET_BYTES,
    pubkeyPath: resolveTestInfraPubkeyPath()
  });
  steps.push("zflash-file-backed --test");
  if ("error" in prepared)
    return {
      id: "initial-format",
      status: "failed",
      durationMs: Date.now() - start,
      message: `zflash file-backed bake failed: ${prepared.error}`
    };
  const boot = runHarnessScript(QEMU_BOOT_TEST, ["--usb-image", prepared.outputImagePath]);
  steps.push("qemu-boot-test");
  const durationMs = Date.now() - start;
  if (!boot.ok)
    return {
      id: "initial-format",
      status: "failed",
      durationMs,
      message: `QEMU boot smoke-test failed (exit ${boot.exitCode ?? "missing harness"}) after ${steps.join(" \u2192 ")}`
    };
  return {
    id: "initial-format",
    status: "passed",
    durationMs,
    message: `passed ${steps.join(" \u2192 ")}; zflash boot image at ${prepared.outputImagePath}`
  };
}
function retentionRuntimeOptionsFromEnv() {
  const timeoutMs = retentionTimeoutMsFromEnv();
  return timeoutMs === void 0 ? { execute: retentionExecutionEnabledFromEnv() } : { execute: retentionExecutionEnabledFromEnv(), timeoutMs };
}
function pathForkRuntimeOptionsFromEnv() {
  const timeoutMs = pathForkTimeoutMsFromEnv();
  return timeoutMs === void 0 ? {
    execute: pathForkExecutionEnabledFromEnv(),
    bootstrap: pathForkBootstrapEnabledFromEnv()
  } : {
    execute: pathForkExecutionEnabledFromEnv(),
    bootstrap: pathForkBootstrapEnabledFromEnv(),
    timeoutMs
  };
}
function runComposingScenario(scenario, isoPath) {
  if (scenario.id === "initial-format")
    return runInitialFormatScenario(isoPath);
  if (scenario.id === "reformat-with-retention")
    return runRetentionRuntime(isoPath, retentionRuntimeOptionsFromEnv());
  if (scenario.id === "reformat-from-scratch")
    return runPathForkRuntime(isoPath, pathForkRuntimeOptionsFromEnv());
  if (scenario.id !== "boot-cluster-up")
    return {
      id: scenario.id,
      status: "failed",
      message: `composes-with-existing scenario "${scenario.id}" has no dedicated harness mapping`
    };
  const absHarnessPath = resolve(REPO_ROOT, QEMU_FULL_INSTALL_TEST);
  if (!existsSync(absHarnessPath))
    return {
      id: scenario.id,
      status: "failed",
      message: `composes-with harness not found: ${absHarnessPath}`
    };
  const start = Date.now(), result = spawnSync("bun", [absHarnessPath, isoPath], {
    cwd: REPO_ROOT,
    stdio: "inherit"
  }), durationMs = Date.now() - start;
  return result.status === 0 ? { id: scenario.id, status: "passed", durationMs } : {
    id: scenario.id,
    status: "failed",
    durationMs,
    message: `delegated harness exited ${result.status}`
  };
}
function reportScaffolded(scenario) {
  return {
    id: scenario.id,
    status: "scaffolded",
    message: `scenario definition only \u2014 implementation pending; composes-with: ${scenario.composesWith.join(", ")}`
  };
}
function describePathForkExecutionError(error) {
  switch (error.kind) {
    case "missing-runtime-requirements":
      return `QEMU path-fork missing runtime requirement(s) for ${error.forkId}: ${error.requirements.join(", ")}`;
    case "command-failed":
      return `QEMU path-fork command failed at ${error.step}${error.forkId === void 0 ? "" : ` (${error.forkId})`} with exit ${error.exitCode ?? "unknown"}: ${error.stderr || "no stderr"}`;
    case "executor-threw":
      return `QEMU path-fork executor threw at ${error.step}${error.forkId === void 0 ? "" : ` (${error.forkId})`}: ${error.reason}`;
    case "serial-marker-failed":
      if (error.assertion.kind === "missing-serial-markers")
        return `QEMU path-fork fork ${error.forkId} missing serial markers: ${error.assertion.missingMarkers.join(", ")}`;
      return `QEMU path-fork fork ${error.forkId} observed forbidden serial markers: ${error.assertion.presentMarkers.join(", ")}`;
    case "bootstrap-failed":
      return `QEMU path-fork baseline bootstrap failed: ${describeRetentionExecutionError(error.bootstrapError)}`;
  }
}
function describeRetentionExecutionError(error) {
  switch (error.kind) {
    case "command-failed":
      return `QEMU retention command failed at ${error.step} with exit ${error.exitCode ?? "unknown"}: ${error.stderr || "no stderr"}`;
    case "executor-threw":
      return `QEMU retention executor threw at ${error.step}: ${error.reason}`;
    case "serial-marker-failed":
      return `QEMU retention commands completed, but serial output did not prove retention; missing markers: ${error.assertion.missingMarkers.join(", ")}`;
  }
}
function retentionExecutionEnabledFromEnv() {
  return process.env[RETENTION_EXECUTION_ENV] === "1";
}
function retentionTimeoutMsFromEnv() {
  const raw = process.env[RETENTION_TIMEOUT_ENV];
  if (raw === void 0 || raw.trim().length === 0)
    return;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : void 0;
}
function retentionBootImagePathFromEnv() {
  const raw = process.env[RETENTION_BOOT_IMAGE_ENV];
  if (raw === void 0 || raw.trim().length === 0)
    return;
  return resolve(raw);
}
function pathForkExecutionEnabledFromEnv() {
  return process.env[PATH_FORK_EXECUTION_ENV] === "1";
}
function pathForkBootstrapEnabledFromEnv() {
  return process.env[PATH_FORK_BOOTSTRAP_ENV] === "1";
}
function pathForkTimeoutMsFromEnv() {
  const raw = process.env[PATH_FORK_TIMEOUT_ENV];
  if (raw === void 0 || raw.trim().length === 0)
    return;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : void 0;
}
function pathForkBootImagePathFromEnv() {
  const raw = process.env[PATH_FORK_BOOT_IMAGE_ENV];
  if (raw === void 0 || raw.trim().length === 0)
    return;
  return resolve(raw);
}
function prepareRetentionRunDirectory(option) {
  const raw = option ?? process.env[RETENTION_RUN_DIRECTORY_ENV];
  try {
    if (raw !== void 0 && raw.trim().length > 0) {
      const runDirectory = resolve(raw);
      mkdirSync(runDirectory, { recursive: !0 });
      return { ok: runDirectory };
    }
    return { ok: mkdtempSync(join(tmpdir(), "zeta-zflash-retention-")) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
function preparePathForkRunDirectory(option) {
  const raw = option ?? process.env[PATH_FORK_RUN_DIRECTORY_ENV];
  try {
    if (raw !== void 0 && raw.trim().length > 0) {
      const runDirectory = resolve(raw);
      mkdirSync(runDirectory, { recursive: !0 });
      return { ok: runDirectory };
    }
    return { ok: mkdtempSync(join(tmpdir(), "zeta-zflash-path-fork-")) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}
function retentionArtifactPaths(absIsoPath, runDirectory) {
  const artifactStem = basename(absIsoPath);
  return {
    diskPath: join(runDirectory, `${artifactStem}.scenario3.qcow2`),
    serialLogPath: join(runDirectory, `${artifactStem}.scenario3.serial.log`)
  };
}
function pathForkArtifactPaths(absIsoPath, runDirectory) {
  const artifactStem = basename(absIsoPath);
  return {
    startingDiskPath: join(runDirectory, `${artifactStem}.scenario4.qcow2`),
    baselineSerialLogPath: join(runDirectory, `${artifactStem}.scenario4.bootstrap.serial.log`),
    migrateSerialLogPath: join(runDirectory, `${artifactStem}.scenario4.migrate.serial.log`),
    freshSerialLogPath: join(runDirectory, `${artifactStem}.scenario4.fresh.serial.log`)
  };
}
function resolveTestInfraPubkeyPath() {
  return resolve(REPO_ROOT, "src/Core.TypeScript/zflash/test-harness/keys/zeta-test-infra.pub");
}
function ensureZflashBootImage(isoPath, outputPath, withCredentialBlob) {
  const prepared = prepareBootImage({
    isoPath,
    outputImagePath: outputPath,
    withCredentialBlob,
    testMode: !0,
    hostname: "node-qemu-test",
    espOffsetBytes: DEFAULT_ESP_OFFSET_BYTES,
    pubkeyPath: resolveTestInfraPubkeyPath()
  });
  if ("error" in prepared)
    return { error: prepared.error };
  return { ok: prepared.outputImagePath };
}
export function runRetentionRuntime(isoPath, options = {}) {
  const absIsoPath = resolve(isoPath), runDirectory = prepareRetentionRunDirectory(options.runDirectory);
  if ("error" in runDirectory)
    return {
      id: "reformat-with-retention",
      status: "failed",
      message: `could not prepare QEMU retention run directory: ${runDirectory.error}`
    };
  const bootImagePath = (() => {
    if (options.bootImagePath !== void 0)
      return resolve(options.bootImagePath);
    const fromEnv = retentionBootImagePathFromEnv();
    if (fromEnv !== void 0)
      return fromEnv;
    if (options.execute === !0 && existsSync(absIsoPath)) {
      const autoPath = join(runDirectory.ok, `${basename(absIsoPath)}.retention-boot.img`), ensured = ensureZflashBootImage(absIsoPath, autoPath, !0);
      if ("error" in ensured)
        return ensured;
      return ensured.ok;
    }
    return;
  })();
  if (typeof bootImagePath === "object" && "error" in bootImagePath)
    return {
      id: "reformat-with-retention",
      status: "failed",
      message: `could not prepare retention boot image: ${bootImagePath.error}`
    };
  const artifacts = retentionArtifactPaths(absIsoPath, runDirectory.ok), planned = planQcow2SnapshotRetention({
    isoPath: absIsoPath,
    ...bootImagePath === void 0 ? {} : { bootImagePath },
    diskPath: artifacts.diskPath,
    serialLogPath: artifacts.serialLogPath,
    snapshotName: "post-initial-format",
    kvmAvailable: options.kvmAvailable ?? existsSync(KVM_PATH)
  });
  if ("error" in planned)
    return {
      id: "reformat-with-retention",
      status: "failed",
      message: `could not plan QEMU retention runtime: ${planned.error.field} ${planned.error.reason}`
    };
  if (options.execute !== !0)
    return {
      id: "reformat-with-retention",
      status: "failed",
      message: `QEMU snapshot/restart retention plan generated; set ${RETENTION_EXECUTION_ENV}=1 to run the real QEMU process executor. Without that explicit opt-in, the scenario fails closed.`,
      qemuRetentionPlan: planned.ok
    };
  const executorOptions = options.timeoutMs === void 0 ? { cwd: options.cwd ?? REPO_ROOT } : { cwd: options.cwd ?? REPO_ROOT, timeoutMs: options.timeoutMs }, executor = options.executor ?? createSpawnSyncQcow2RetentionExecutor(executorOptions), executed = executeQcow2SnapshotRetentionPlan(planned.ok, executor);
  if ("error" in executed)
    return {
      id: "reformat-with-retention",
      status: "failed",
      message: describeRetentionExecutionError(executed.error),
      qemuRetentionPlan: planned.ok,
      qemuRetentionExecution: executed
    };
  return {
    id: "reformat-with-retention",
    status: "passed",
    message: "QEMU snapshot/restart retention execution observed all required serial markers.",
    qemuRetentionPlan: planned.ok,
    qemuRetentionExecution: executed
  };
}
export function runPathForkRuntime(isoPath, options = {}) {
  const absIsoPath = resolve(isoPath), runDirectory = preparePathForkRunDirectory(options.runDirectory);
  if ("error" in runDirectory)
    return {
      id: "reformat-from-scratch",
      status: "failed",
      message: `could not prepare QEMU path-fork run directory: ${runDirectory.error}`
    };
  const bootImagePath = (() => {
    if (options.bootImagePath !== void 0)
      return resolve(options.bootImagePath);
    const fromEnv = pathForkBootImagePathFromEnv();
    if (fromEnv !== void 0)
      return fromEnv;
    if (options.execute === !0 && existsSync(absIsoPath)) {
      const autoPath = join(runDirectory.ok, `${basename(absIsoPath)}.path-fork-boot-retain.img`), ensured = ensureZflashBootImage(absIsoPath, autoPath, !0);
      if ("error" in ensured)
        return ensured;
      return ensured.ok;
    }
    return;
  })();
  if (typeof bootImagePath === "object" && "error" in bootImagePath)
    return {
      id: "reformat-from-scratch",
      status: "failed",
      message: `could not prepare path-fork retention boot image: ${bootImagePath.error}`
    };
  const freshBootImagePath = (() => {
    if (options.freshBootImagePath !== void 0)
      return resolve(options.freshBootImagePath);
    if (options.execute === !0 && existsSync(absIsoPath)) {
      const autoPath = join(runDirectory.ok, `${basename(absIsoPath)}.path-fork-boot-fresh.img`), ensured = ensureZflashBootImage(absIsoPath, autoPath, !1);
      if ("error" in ensured)
        return ensured;
      return ensured.ok;
    }
    return;
  })();
  if (typeof freshBootImagePath === "object" && "error" in freshBootImagePath)
    return {
      id: "reformat-from-scratch",
      status: "failed",
      message: `could not prepare path-fork fresh boot image: ${freshBootImagePath.error}`
    };
  const artifacts = pathForkArtifactPaths(absIsoPath, runDirectory.ok), planned = planPathForkRuntime({
    isoPath: absIsoPath,
    ...bootImagePath === void 0 ? {} : { bootImagePath },
    ...freshBootImagePath === void 0 ? {} : { freshBootImagePath },
    startingDiskPath: artifacts.startingDiskPath,
    migrateSerialLogPath: artifacts.migrateSerialLogPath,
    freshSerialLogPath: artifacts.freshSerialLogPath,
    kvmAvailable: options.kvmAvailable ?? existsSync(KVM_PATH)
  });
  if ("error" in planned)
    return {
      id: "reformat-from-scratch",
      status: "failed",
      message: `could not plan QEMU path-fork runtime: ${planned.error.field} ${planned.error.reason}`
    };
  const missingRequirements = planned.ok.forks.flatMap((fork) => fork.missingRuntimeRequirements), requirementSuffix = missingRequirements.length === 0 ? "" : ` Missing runtime requirement(s): ${[...new Set(missingRequirements)].join(", ")}.`;
  if (options.execute !== !0)
    return {
      id: "reformat-from-scratch",
      status: "failed",
      message: `QEMU path-fork plan generated; set ${PATH_FORK_EXECUTION_ENV}=1 to run the real QEMU process executor. Without that explicit opt-in, the scenario fails closed.${requirementSuffix}`,
      pathForkPlan: planned.ok
    };
  const executorOptions = options.timeoutMs === void 0 ? { cwd: options.cwd ?? REPO_ROOT } : { cwd: options.cwd ?? REPO_ROOT, timeoutMs: options.timeoutMs }, executor = options.executor ?? createSpawnSyncPathForkExecutor(executorOptions), bootstrapPlan = options.bootstrap === !0 ? (() => {
    const plannedBootstrap = planPathForkBaselineBootstrap({
      isoPath: absIsoPath,
      startingDiskPath: artifacts.startingDiskPath,
      baselineSerialLogPath: artifacts.baselineSerialLogPath,
      kvmAvailable: options.kvmAvailable ?? existsSync(KVM_PATH)
    });
    if ("error" in plannedBootstrap)
      return { error: plannedBootstrap.error };
    return { ok: plannedBootstrap };
  })() : void 0;
  if (bootstrapPlan !== void 0 && "error" in bootstrapPlan)
    return {
      id: "reformat-from-scratch",
      status: "failed",
      message: `could not plan QEMU path-fork baseline bootstrap: ${bootstrapPlan.error}`,
      pathForkPlan: planned.ok
    };
  const executed = executePathForkRuntimePlan(planned.ok, executor, bootstrapPlan === void 0 ? {} : { bootstrapPlan: bootstrapPlan.ok });
  if ("error" in executed)
    return {
      id: "reformat-from-scratch",
      status: "failed",
      message: describePathForkExecutionError(executed.error),
      pathForkPlan: planned.ok,
      pathForkExecution: executed
    };
  return {
    id: "reformat-from-scratch",
    status: "passed",
    message: "QEMU path-fork execution observed both migrate-existing-creds and fresh-cluster serial marker contracts.",
    pathForkPlan: planned.ok,
    pathForkExecution: executed
  };
}
function runScenario(scenarioId, isoPath) {
  const scenario = findScenario(scenarioId);
  if (!scenario)
    return {
      id: scenarioId,
      status: "failed",
      message: `scenario not found: ${scenarioId}`
    };
  switch (scenario.status) {
    case "composes-with-existing":
      return runComposingScenario(scenario, isoPath);
    case "scaffolded":
      if (scenario.id === "cluster-joining")
        return {
          id: "cluster-joining",
          status: "skipped",
          message: "multi-VM QEMU orchestration not yet automated in CI \u2014 validates via extensions.ts design spec + operator-collaborative USB join"
        };
      return reportScaffolded(scenario);
    case "operator-runtime":
      return {
        id: scenarioId,
        status: "skipped",
        message: "operator-runtime scenario \u2014 physical USB / operator-collaborative testing required"
      };
  }
}
function emitResults(results) {
  console.log(JSON.stringify({
    rowId: "081KSNY2Z0008QG0R0008PN7RQ",
    summary: {
      total: results.length,
      passed: results.filter((r) => r.status === "passed").length,
      failed: results.filter((r) => r.status === "failed").length,
      scaffolded: results.filter((r) => r.status === "scaffolded").length,
      skipped: results.filter((r) => r.status === "skipped").length
    },
    results
  }, null, 2));
}
function main(argv) {
  const parsed = parseArgs(argv);
  if ("error" in parsed) {
    console.error(`usage error: ${parsed.error}`);
    console.error("see file header for usage examples");
    return 2;
  }
  try {
    validateScenarios(SCENARIOS);
  } catch (e) {
    console.error(`scenarios.ts invariant violated at startup: ${e.message}`);
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
      const sorted = [...SCENARIOS].sort((a, b) => a.orderIndex - b.orderIndex), results = [], failedIds = new Set;
      for (const scenario of sorted) {
        const gatedBy = sorted.find((g) => g.gates.includes(scenario.id) && failedIds.has(g.id));
        if (gatedBy) {
          results.push({
            id: scenario.id,
            status: "skipped",
            message: `gated by failed scenario: ${gatedBy.id}`
          });
          continue;
        }
        const result = runScenario(scenario.id, parsed.isoPath);
        results.push(result);
        if (result.status === "failed" || result.status === "scaffolded")
          failedIds.add(scenario.id);
      }
      emitResults(results);
      return failedIds.size > 0 ? 1 : 0;
    }
  }
}
if (import.meta.main)
  process.exit(main(process.argv));
