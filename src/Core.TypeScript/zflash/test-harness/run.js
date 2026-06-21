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
 *   --scenario  Run one scenario by id. For composes-with-existing
 *               scenarios, delegates to tools/ci/qemu-full-install-test.ts
 *               or tools/ci/qemu-boot-test.ts. For scenario 3, emits the
 *               QEMU snapshot/restart plan but still fails closed until
 *               the real process runner is connected to the execution
 *               contract. Scenario 4 emits the path-fork runtime plan
 *               and fails closed until the executor + identity comparison
 *               proof lands. Other scaffolded scenarios report "not yet
 *               implemented" with the implementation substrate path
 *               documented.
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
import { SCENARIOS, validateScenarios, findScenario } from "./scenarios";
import { SCENARIO_IMPL_DESIGN, computeImplDesignProgress } from "./extensions";
import { prepareBootImage, DEFAULT_ESP_OFFSET_BYTES } from "./prepare-boot-image";
import { createSpawnSyncQcow2RetentionExecutor, executeQcow2SnapshotRetentionPlan, planQcow2SnapshotRetention, } from "./qemu-state";
import { createSpawnSyncQcow2RetentionExecutor as createSpawnSyncPathForkExecutor, executePathForkRuntimePlan, planPathForkBaselineBootstrap, planPathForkRuntime, } from "./path-fork";
const REPO_ROOT = resolve(import.meta.dir, "../../../..");
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
function parseArgs(argv) {
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
            const id = args[scenarioIdx + 1];
            return { mode: "dry-run", scenarioId: id };
        }
        return { mode: "dry-run" };
    }
    if (args.includes("--scenario")) {
        const scenarioIdx = args.indexOf("--scenario");
        if (scenarioIdx + 1 >= args.length) {
            return { error: "--scenario requires a scenario id" };
        }
        const id = args[scenarioIdx + 1];
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
function emitListing() {
    console.log(JSON.stringify({
        rowId: "081KSNY2Z0008QG0R0008PN7RQ",
        scenarioCount: SCENARIOS.length,
        implDesignProgress: computeImplDesignProgress(),
        scenarios: SCENARIOS.map((s) => {
            const implDesign = s.id === "reformat-with-retention" || s.id === "reformat-from-scratch" || s.id === "cluster-joining"
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
    }, null, 2));
}
function emitDryRun(scenarioId) {
    try {
        validateScenarios(SCENARIOS);
    }
    catch (e) {
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
            plan: dryRunPlanMessage(s),
        })),
    }, null, 2));
    return 0;
}
function dryRunPlanMessage(scenario) {
    if (scenario.id === "initial-format") {
        return "would run audit-installer-iso-content.ts + zflash-file-backed --test bake + qemu-boot-test.ts --usb-image <zflash-boot.img>";
    }
    if (scenario.status === "composes-with-existing") {
        return `would delegate to existing tools/ci/ substrate: ${scenario.composesWith[0]}`;
    }
    if (scenario.id === "reformat-with-retention") {
        return "would generate QEMU snapshot/restart retention plan; auto-prepare zflash boot image when execute opt-in is set";
    }
    if (scenario.id === "reformat-from-scratch") {
        return "would generate QEMU path-fork plan for migrate-existing-creds + fresh-cluster; auto-prepare zflash boot image when execute opt-in is set";
    }
    return `would report scaffolded — implementation pending; composes-with: ${scenario.composesWith.join(", ")}`;
}
function runHarnessScript(relPath, args) {
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
function runInitialFormatScenario(isoPath) {
    const start = Date.now();
    const absIso = resolve(isoPath);
    const steps = [];
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
        espOffsetBytes: DEFAULT_ESP_OFFSET_BYTES,
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
            message: `QEMU boot smoke-test failed (exit ${boot.exitCode ?? "missing harness"}) after ${steps.join(" → ")}`,
        };
    }
    return {
        id: "initial-format",
        status: "passed",
        durationMs,
        message: `passed ${steps.join(" → ")}; zflash boot image at ${prepared.outputImagePath}`,
    };
}
function runComposingScenario(scenario, isoPath) {
    if (scenario.id === "initial-format") {
        return runInitialFormatScenario(isoPath);
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
function reportScaffolded(scenario) {
    return {
        id: scenario.id,
        status: "scaffolded",
        message: `scenario definition only — implementation pending; composes-with: ${scenario.composesWith.join(", ")}`,
    };
}
function describePathForkExecutionError(error) {
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
    if (raw === undefined || raw.trim().length === 0) {
        return undefined;
    }
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}
function retentionBootImagePathFromEnv() {
    const raw = process.env[RETENTION_BOOT_IMAGE_ENV];
    if (raw === undefined || raw.trim().length === 0) {
        return undefined;
    }
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
    if (raw === undefined || raw.trim().length === 0) {
        return undefined;
    }
    const parsed = Number(raw);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}
function pathForkBootImagePathFromEnv() {
    const raw = process.env[PATH_FORK_BOOT_IMAGE_ENV];
    if (raw === undefined || raw.trim().length === 0) {
        return undefined;
    }
    return resolve(raw);
}
function prepareRetentionRunDirectory(option) {
    const raw = option ?? process.env[RETENTION_RUN_DIRECTORY_ENV];
    try {
        if (raw !== undefined && raw.trim().length > 0) {
            const runDirectory = resolve(raw);
            mkdirSync(runDirectory, { recursive: true });
            return { ok: runDirectory };
        }
        return { ok: mkdtempSync(join(tmpdir(), "zeta-zflash-retention-")) };
    }
    catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
    }
}
function preparePathForkRunDirectory(option) {
    const raw = option ?? process.env[PATH_FORK_RUN_DIRECTORY_ENV];
    try {
        if (raw !== undefined && raw.trim().length > 0) {
            const runDirectory = resolve(raw);
            mkdirSync(runDirectory, { recursive: true });
            return { ok: runDirectory };
        }
        return { ok: mkdtempSync(join(tmpdir(), "zeta-zflash-path-fork-")) };
    }
    catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
    }
}
function retentionArtifactPaths(absIsoPath, runDirectory) {
    const artifactStem = basename(absIsoPath);
    return {
        diskPath: join(runDirectory, `${artifactStem}.scenario3.qcow2`),
        serialLogPath: join(runDirectory, `${artifactStem}.scenario3.serial.log`),
    };
}
function pathForkArtifactPaths(absIsoPath, runDirectory) {
    const artifactStem = basename(absIsoPath);
    return {
        startingDiskPath: join(runDirectory, `${artifactStem}.scenario4.qcow2`),
        baselineSerialLogPath: join(runDirectory, `${artifactStem}.scenario4.bootstrap.serial.log`),
        migrateSerialLogPath: join(runDirectory, `${artifactStem}.scenario4.migrate.serial.log`),
        freshSerialLogPath: join(runDirectory, `${artifactStem}.scenario4.fresh.serial.log`),
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
        testMode: true,
        hostname: "node-qemu-test",
        espOffsetBytes: DEFAULT_ESP_OFFSET_BYTES,
        pubkeyPath: resolveTestInfraPubkeyPath(),
    });
    if ("error" in prepared) {
        return { error: prepared.error };
    }
    return { ok: prepared.outputImagePath };
}
export function runRetentionRuntime(isoPath, options = {}) {
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
export function runPathForkRuntime(isoPath, options = {}) {
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
    const requirementSuffix = missingRequirements.length === 0
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
    const executorOptions = options.timeoutMs === undefined
        ? { cwd: options.cwd ?? REPO_ROOT }
        : { cwd: options.cwd ?? REPO_ROOT, timeoutMs: options.timeoutMs };
    const executor = options.executor ?? createSpawnSyncPathForkExecutor(executorOptions);
    const bootstrapPlan = options.bootstrap === true
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
    const executed = executePathForkRuntimePlan(planned.ok, executor, bootstrapPlan === undefined ? {} : { bootstrapPlan: bootstrapPlan.ok });
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
function runScenario(scenarioId, isoPath) {
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
            if (scenario.id === "reformat-from-scratch") {
                const timeoutMs = pathForkTimeoutMsFromEnv();
                const pathForkOptions = timeoutMs === undefined
                    ? {
                        execute: pathForkExecutionEnabledFromEnv(),
                        bootstrap: pathForkBootstrapEnabledFromEnv(),
                    }
                    : {
                        execute: pathForkExecutionEnabledFromEnv(),
                        bootstrap: pathForkBootstrapEnabledFromEnv(),
                        timeoutMs,
                    };
                return runPathForkRuntime(isoPath, pathForkOptions);
            }
            if (scenario.id === "cluster-joining") {
                return {
                    id: "cluster-joining",
                    status: "skipped",
                    message: "multi-VM QEMU orchestration not yet automated in CI — validates via extensions.ts design spec + operator-collaborative USB join",
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
function emitResults(results) {
    console.log(JSON.stringify({
        rowId: "081KSNY2Z0008QG0R0008PN7RQ",
        summary: {
            total: results.length,
            passed: results.filter((r) => r.status === "passed").length,
            failed: results.filter((r) => r.status === "failed").length,
            scaffolded: results.filter((r) => r.status === "scaffolded").length,
            skipped: results.filter((r) => r.status === "skipped").length,
        },
        results,
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
    }
    catch (e) {
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
            const sorted = [...SCENARIOS].sort((a, b) => a.orderIndex - b.orderIndex);
            const results = [];
            const failedIds = new Set();
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
