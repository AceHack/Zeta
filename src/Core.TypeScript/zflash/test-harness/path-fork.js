/**
 * B-0891 scenario 4 QEMU path-fork primitives.
 *
 * Scenario 4 starts from the same baseline disk and tests two operator
 * choices: migrate existing credentials to a new USB, or wipe and start a
 * fresh cluster. This module makes that fork executable as a structured
 * QEMU plan while keeping the dispatcher fail-closed until a process
 * executor and identity comparison proof consume the plan.
 */
import { DEFAULT_PATH_FORK } from "./extensions";
import { B0891_FRESH_USB_SERIAL_MARKER, B0891_RETENTION_USB_SERIAL_MARKERS } from "./serial-markers";
import { RETENTION_ABSENT_TERMINAL_MARKERS, RETENTION_FAILURE_SERIAL_MARKERS, buildQemuSystemBootArgs, createSpawnSyncQcow2RetentionExecutor, planQcow2SnapshotRetention, } from "./qemu-state";
const DEFAULT_MEMORY_MB = 4096;
const DEFAULT_CPU_COUNT = 2;
const DEFAULT_SNAPSHOT_NAME = "post-initial-format";
export const MIGRATE_EXISTING_CREDS_SERIAL_MARKERS = B0891_RETENTION_USB_SERIAL_MARKERS;
export const FRESH_CLUSTER_SERIAL_MARKERS = [B0891_FRESH_USB_SERIAL_MARKER];
function nonEmpty(value) {
    return value.trim().length > 0;
}
function positiveInteger(value) {
    return Number.isInteger(value) && value > 0;
}
function validateInput(input) {
    if (!nonEmpty(input.isoPath)) {
        return { kind: "invalid-input", field: "isoPath", reason: "ISO path is required" };
    }
    if (input.bootImagePath !== undefined && !nonEmpty(input.bootImagePath)) {
        return { kind: "invalid-input", field: "bootImagePath", reason: "boot image path must be non-empty when provided" };
    }
    if (input.freshBootImagePath !== undefined && !nonEmpty(input.freshBootImagePath)) {
        return {
            kind: "invalid-input",
            field: "freshBootImagePath",
            reason: "fresh boot image path must be non-empty when provided",
        };
    }
    if (!nonEmpty(input.startingDiskPath)) {
        return { kind: "invalid-input", field: "startingDiskPath", reason: "starting qcow2 disk path is required" };
    }
    if (!nonEmpty(input.migrateSerialLogPath)) {
        return { kind: "invalid-input", field: "migrateSerialLogPath", reason: "migrate fork serial log path is required" };
    }
    if (!nonEmpty(input.freshSerialLogPath)) {
        return { kind: "invalid-input", field: "freshSerialLogPath", reason: "fresh fork serial log path is required" };
    }
    if (input.snapshotName !== undefined && !nonEmpty(input.snapshotName)) {
        return { kind: "invalid-input", field: "snapshotName", reason: "snapshot name must be non-empty when provided" };
    }
    if (input.memoryMB !== undefined && !positiveInteger(input.memoryMB)) {
        return { kind: "invalid-input", field: "memoryMB", reason: "memoryMB must be a positive integer" };
    }
    if (input.cpuCount !== undefined && !positiveInteger(input.cpuCount)) {
        return { kind: "invalid-input", field: "cpuCount", reason: "cpuCount must be a positive integer" };
    }
    return null;
}
/** Fork boots prove the operator path choice only — B-0891 early markers, not a second full install. */
function forkSuccessMarkers(forkId) {
    return forkId === "migrate-existing-creds" ? MIGRATE_EXISTING_CREDS_SERIAL_MARKERS : FRESH_CLUSTER_SERIAL_MARKERS;
}
function forbiddenMarkers(forkId) {
    return forkId === "migrate-existing-creds" ? FRESH_CLUSTER_SERIAL_MARKERS : MIGRATE_EXISTING_CREDS_SERIAL_MARKERS;
}
function serialLogPathForFork(input, forkId) {
    return forkId === "migrate-existing-creds" ? input.migrateSerialLogPath : input.freshSerialLogPath;
}
function bootCommandForFork(input, forkId) {
    const serialLogPath = serialLogPathForFork(input, forkId);
    if (forkId === "migrate-existing-creds") {
        const bootImagePath = input.bootImagePath;
        if (bootImagePath === undefined) {
            return undefined;
        }
        return {
            bin: "qemu-system-x86_64",
            args: buildQemuSystemBootArgs({
                diskPath: input.startingDiskPath,
                serialLogPath,
                memoryMB: input.memoryMB,
                cpuCount: input.cpuCount,
                kvmAvailable: input.kvmAvailable,
                bootMedia: { kind: "usb-image", path: bootImagePath },
            }),
        };
    }
    return {
        bin: "qemu-system-x86_64",
        args: buildQemuSystemBootArgs({
            diskPath: input.startingDiskPath,
            serialLogPath,
            memoryMB: input.memoryMB,
            cpuCount: input.cpuCount,
            kvmAvailable: input.kvmAvailable,
            bootMedia: input.freshBootImagePath === undefined
                ? { kind: "iso", path: input.isoPath }
                : { kind: "usb-image", path: input.freshBootImagePath },
        }),
    };
}
function missingRequirementsForFork(input, forkId) {
    if (forkId === "migrate-existing-creds" && input.bootImagePath === undefined) {
        return ["zflash-prepared boot image containing /zeta-creds.enc"];
    }
    if (forkId === "fresh-cluster" && input.freshBootImagePath === undefined) {
        return ["zflash-prepared boot image without /zeta-creds.enc"];
    }
    return [];
}
function forkPlan(input, fork) {
    const serialLogPath = serialLogPathForFork(input, fork.forkId);
    const forkRequiredMarkers = forkSuccessMarkers(fork.forkId);
    const forkForbiddenMarkers = forbiddenMarkers(fork.forkId);
    const qemuBootCommand = bootCommandForFork(input, fork.forkId);
    return {
        forkId: fork.forkId,
        forkName: fork.forkName,
        restoreStartingState: {
            bin: "qemu-img",
            args: ["snapshot", "-a", input.snapshotName, input.startingDiskPath],
        },
        ...(qemuBootCommand === undefined ? {} : { qemuBootCommand }),
        stopCondition: {
            serialLogPath,
            successMarkers: forkRequiredMarkers,
            failureMarkers: [...RETENTION_FAILURE_SERIAL_MARKERS, ...forkForbiddenMarkers],
            terminalFailureMarkers: RETENTION_ABSENT_TERMINAL_MARKERS,
        },
        requiredSerialMarkers: forkRequiredMarkers,
        forbiddenSerialMarkers: forkForbiddenMarkers,
        missingRuntimeRequirements: missingRequirementsForFork(input, fork.forkId),
        expectedOutcome: fork.expectedOutcome,
    };
}
export function planPathForkRuntime(input) {
    const invalid = validateInput(input);
    if (invalid) {
        return { error: invalid };
    }
    const normalized = {
        isoPath: input.isoPath,
        ...(input.bootImagePath === undefined ? {} : { bootImagePath: input.bootImagePath }),
        ...(input.freshBootImagePath === undefined ? {} : { freshBootImagePath: input.freshBootImagePath }),
        startingDiskPath: input.startingDiskPath,
        migrateSerialLogPath: input.migrateSerialLogPath,
        freshSerialLogPath: input.freshSerialLogPath,
        snapshotName: input.snapshotName ?? DEFAULT_SNAPSHOT_NAME,
        memoryMB: input.memoryMB ?? DEFAULT_MEMORY_MB,
        cpuCount: input.cpuCount ?? DEFAULT_CPU_COUNT,
        kvmAvailable: input.kvmAvailable ?? false,
    };
    return {
        ok: {
            isoPath: normalized.isoPath,
            ...(normalized.bootImagePath === undefined ? {} : { bootImagePath: normalized.bootImagePath }),
            ...(normalized.freshBootImagePath === undefined ? {} : { freshBootImagePath: normalized.freshBootImagePath }),
            startingStateRef: DEFAULT_PATH_FORK.startingStateRef,
            startingDiskPath: normalized.startingDiskPath,
            snapshotName: normalized.snapshotName,
            comparisonStrategy: DEFAULT_PATH_FORK.comparisonStrategy,
            forks: DEFAULT_PATH_FORK.forks.map((fork) => forkPlan(normalized, fork)),
        },
    };
}
export function assertPathForkSerialMarkers(forkPlan, serialOutput) {
    const matchedRequiredMarkers = forkPlan.requiredSerialMarkers.filter((marker) => serialOutput.includes(marker));
    const missingMarkers = forkPlan.requiredSerialMarkers.filter((marker) => !serialOutput.includes(marker));
    if (missingMarkers.length > 0) {
        return {
            error: {
                kind: "missing-serial-markers",
                forkId: forkPlan.forkId,
                missingMarkers,
                requiredMarkers: forkPlan.requiredSerialMarkers,
            },
        };
    }
    const presentForbiddenMarkers = forkPlan.forbiddenSerialMarkers.filter((marker) => serialOutput.includes(marker));
    if (presentForbiddenMarkers.length > 0) {
        return {
            error: {
                kind: "forbidden-serial-markers-present",
                forkId: forkPlan.forkId,
                presentMarkers: presentForbiddenMarkers,
                forbiddenMarkers: forkPlan.forbiddenSerialMarkers,
            },
        };
    }
    return {
        ok: {
            forkId: forkPlan.forkId,
            matchedRequiredMarkers,
            absentForbiddenMarkers: forkPlan.forbiddenSerialMarkers,
        },
    };
}
export function planPathForkBaselineBootstrap(input) {
    const planned = planQcow2SnapshotRetention({
        isoPath: input.isoPath,
        diskPath: input.startingDiskPath,
        serialLogPath: input.baselineSerialLogPath,
        snapshotName: input.snapshotName ?? DEFAULT_SNAPSHOT_NAME,
        ...(input.diskSizeGB === undefined ? {} : { diskSizeGB: input.diskSizeGB }),
        ...(input.memoryMB === undefined ? {} : { memoryMB: input.memoryMB }),
        ...(input.cpuCount === undefined ? {} : { cpuCount: input.cpuCount }),
        ...(input.kvmAvailable === undefined ? {} : { kvmAvailable: input.kvmAvailable }),
    });
    if ("error" in planned) {
        return { error: `${planned.error.field}: ${planned.error.reason}` };
    }
    return planned.ok;
}
function bootstrapExecutionSteps(bootstrapPlan) {
    return [
        { step: "bootstrap-create-disk-image", command: bootstrapPlan.createDiskImage },
        {
            step: "bootstrap-initial-install-from-iso-with-disk",
            command: bootstrapPlan.initialInstallFromIsoWithDisk,
            stopCondition: bootstrapPlan.initialInstallStopCondition,
        },
        { step: "bootstrap-create-baseline-snapshot", command: bootstrapPlan.createBaselineSnapshot },
    ];
}
export function executePathForkRuntimePlan(plan, executor, options = {}) {
    const commandExecutions = [];
    if (options.bootstrapPlan !== undefined) {
        for (const { step, command, stopCondition } of bootstrapExecutionSteps(options.bootstrapPlan)) {
            let execution;
            try {
                if (stopCondition !== undefined) {
                    if (executor.runCommandUntilSerialMarkers === undefined) {
                        return {
                            error: {
                                kind: "bootstrap-failed",
                                bootstrapError: {
                                    kind: "command-failed",
                                    step: "initial-install-from-iso-with-disk",
                                    command,
                                    exitCode: null,
                                    stderr: `missing runCommandUntilSerialMarkers executor for bootstrap step ${step}`,
                                    commandExecutions,
                                },
                                commandExecutions,
                            },
                        };
                    }
                    execution = executor.runCommandUntilSerialMarkers(step, command, stopCondition);
                }
                else {
                    execution = executor.runCommand(step, command);
                }
            }
            catch (error) {
                return {
                    error: {
                        kind: "bootstrap-failed",
                        bootstrapError: {
                            kind: "executor-threw",
                            step: "initial-install-from-iso-with-disk",
                            reason: error instanceof Error ? error.message : String(error),
                            commandExecutions,
                        },
                        commandExecutions,
                    },
                };
            }
            commandExecutions.push(execution);
            if (execution.exitCode !== 0) {
                return {
                    error: {
                        kind: "bootstrap-failed",
                        bootstrapError: {
                            kind: "command-failed",
                            step: "initial-install-from-iso-with-disk",
                            command,
                            exitCode: execution.exitCode,
                            stderr: execution.stderr,
                            commandExecutions,
                        },
                        commandExecutions,
                    },
                };
            }
        }
    }
    const forkExecutions = [];
    for (const fork of plan.forks) {
        if (fork.missingRuntimeRequirements.length > 0) {
            return {
                error: {
                    kind: "missing-runtime-requirements",
                    forkId: fork.forkId,
                    requirements: fork.missingRuntimeRequirements,
                    commandExecutions,
                },
            };
        }
        const restoreStep = `restore-${fork.forkId}`;
        let restoreExecution;
        try {
            restoreExecution = executor.runCommand(restoreStep, fork.restoreStartingState);
        }
        catch (error) {
            return {
                error: {
                    kind: "executor-threw",
                    step: restoreStep,
                    forkId: fork.forkId,
                    reason: error instanceof Error ? error.message : String(error),
                    commandExecutions,
                },
            };
        }
        commandExecutions.push(restoreExecution);
        if (restoreExecution.exitCode !== 0) {
            return {
                error: {
                    kind: "command-failed",
                    step: restoreStep,
                    forkId: fork.forkId,
                    command: fork.restoreStartingState,
                    exitCode: restoreExecution.exitCode,
                    stderr: restoreExecution.stderr,
                    commandExecutions,
                },
            };
        }
        const bootCommand = fork.qemuBootCommand;
        if (bootCommand === undefined) {
            return {
                error: {
                    kind: "missing-runtime-requirements",
                    forkId: fork.forkId,
                    requirements: ["qemu boot command"],
                    commandExecutions,
                },
            };
        }
        const bootStep = `boot-${fork.forkId}`;
        let bootExecution;
        try {
            if (executor.runCommandUntilSerialMarkers === undefined) {
                return {
                    error: {
                        kind: "executor-threw",
                        step: bootStep,
                        forkId: fork.forkId,
                        reason: `missing runCommandUntilSerialMarkers executor for ${bootStep}`,
                        commandExecutions,
                    },
                };
            }
            bootExecution = executor.runCommandUntilSerialMarkers(bootStep, bootCommand, fork.stopCondition);
        }
        catch (error) {
            return {
                error: {
                    kind: "executor-threw",
                    step: bootStep,
                    forkId: fork.forkId,
                    reason: error instanceof Error ? error.message : String(error),
                    commandExecutions,
                },
            };
        }
        commandExecutions.push(bootExecution);
        if (bootExecution.exitCode !== 0) {
            return {
                error: {
                    kind: "command-failed",
                    step: bootStep,
                    forkId: fork.forkId,
                    command: bootCommand,
                    exitCode: bootExecution.exitCode,
                    stderr: bootExecution.stderr,
                    commandExecutions,
                },
            };
        }
        let serialOutput;
        try {
            serialOutput = executor.readSerialOutput(fork.stopCondition.serialLogPath);
        }
        catch (error) {
            return {
                error: {
                    kind: "executor-threw",
                    step: bootStep,
                    forkId: fork.forkId,
                    reason: error instanceof Error ? error.message : String(error),
                    commandExecutions,
                },
            };
        }
        const assertion = assertPathForkSerialMarkers(fork, serialOutput);
        if ("error" in assertion) {
            return {
                error: {
                    kind: "serial-marker-failed",
                    forkId: fork.forkId,
                    assertion: assertion.error,
                    commandExecutions,
                },
            };
        }
        forkExecutions.push({
            forkId: fork.forkId,
            commandExecutions: [restoreExecution, bootExecution],
            serialAssertion: assertion.ok,
        });
    }
    return {
        ok: {
            forkExecutions,
            commandExecutions,
        },
    };
}
export { createSpawnSyncQcow2RetentionExecutor };
