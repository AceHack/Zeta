/**
 * 081KSNY2Z0008QG0R0008PN7RQ scenario 5 QEMU multi-VM primitives.
 *
 * Scenario 5 (cluster-joining) requires running two QEMU VMs simultaneously:
 * one existing cluster node (cluster-existing) and one joining node
 * (joining-node) connected by a shared virtual network. This module makes
 * that topology planning and coordination executable.
 */

import { DEFAULT_MULTI_VM, type VMSpec } from "./extensions";
import { B0891_CLUSTER_JOIN_SERIAL_MARKERS } from "./serial-markers";
import {
  RETENTION_ABSENT_TERMINAL_MARKERS,
  RETENTION_FAILURE_SERIAL_MARKERS,
  buildQemuSystemBootArgs,
  type Qcow2RetentionExecutor,
  type QemuCommand,
  type QemuCommandExecution,
  type QemuSerialStopCondition,
} from "./qemu-state";

export interface MultiVMRuntimeInput {
  readonly isoPath: string;
  readonly bootImagePath?: string;
  readonly existingDiskPath: string;
  readonly joiningDiskPath: string;
  readonly existingSerialLogPath: string;
  readonly joiningSerialLogPath: string;
  readonly snapshotName?: string;
  readonly memoryMB?: number;
  readonly cpuCount?: number;
  readonly kvmAvailable?: boolean;
}

export interface MultiVMRuntimeVMPlan {
  readonly name: string;
  readonly role: VMSpec["role"];
  readonly restoreStartingState?: QemuCommand;
  readonly qemuBootCommand?: QemuCommand;
  readonly stopCondition: QemuSerialStopCondition;
  readonly requiredSerialMarkers: readonly string[];
  readonly missingRuntimeRequirements: readonly string[];
}

export interface MultiVMRuntimePlan {
  readonly isoPath: string;
  readonly bootImagePath?: string;
  readonly networkTopology: typeof DEFAULT_MULTI_VM.networkTopology;
  readonly joinProtocol: typeof DEFAULT_MULTI_VM.joinProtocol;
  readonly orchestrator: typeof DEFAULT_MULTI_VM.orchestrator;
  readonly vms: readonly MultiVMRuntimeVMPlan[];
}

export interface MultiVMRuntimeFeedback {
  readonly kind: "invalid-input";
  readonly field: keyof MultiVMRuntimeInput;
  readonly reason: string;
}

export type MultiVMRuntimeResult = { readonly ok: MultiVMRuntimePlan } | { readonly error: MultiVMRuntimeFeedback };

const DEFAULT_MEMORY_MB = 2048;
const DEFAULT_CPU_COUNT = 2;
const DEFAULT_SNAPSHOT_NAME = "post-initial-format";

function nonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function positiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function validateInput(input: MultiVMRuntimeInput): MultiVMRuntimeFeedback | null {
  if (!nonEmpty(input.isoPath)) {
    return { kind: "invalid-input", field: "isoPath", reason: "ISO path is required" };
  }
  if (input.bootImagePath !== undefined && !nonEmpty(input.bootImagePath)) {
    return { kind: "invalid-input", field: "bootImagePath", reason: "boot image path must be non-empty when provided" };
  }
  if (!nonEmpty(input.existingDiskPath)) {
    return { kind: "invalid-input", field: "existingDiskPath", reason: "existing disk path is required" };
  }
  if (!nonEmpty(input.joiningDiskPath)) {
    return { kind: "invalid-input", field: "joiningDiskPath", reason: "joining disk path is required" };
  }
  if (!nonEmpty(input.existingSerialLogPath)) {
    return { kind: "invalid-input", field: "existingSerialLogPath", reason: "existing serial log path is required" };
  }
  if (!nonEmpty(input.joiningSerialLogPath)) {
    return { kind: "invalid-input", field: "joiningSerialLogPath", reason: "joining serial log path is required" };
  }
  if (input.memoryMB !== undefined && !positiveInteger(input.memoryMB)) {
    return { kind: "invalid-input", field: "memoryMB", reason: "memoryMB must be a positive integer" };
  }
  if (input.cpuCount !== undefined && !positiveInteger(input.cpuCount)) {
    return { kind: "invalid-input", field: "cpuCount", reason: "cpuCount must be a positive integer" };
  }
  return null;
}

interface NormalizedMultiVMRuntimeInput {
  readonly isoPath: string;
  readonly bootImagePath?: string;
  readonly existingDiskPath: string;
  readonly joiningDiskPath: string;
  readonly existingSerialLogPath: string;
  readonly joiningSerialLogPath: string;
  readonly snapshotName: string;
  readonly memoryMB: number;
  readonly cpuCount: number;
  readonly kvmAvailable: boolean;
}

export function planMultiVMRuntime(input: MultiVMRuntimeInput): MultiVMRuntimeResult {
  const invalid = validateInput(input);
  if (invalid) {
    return { error: invalid };
  }

  const normalized: NormalizedMultiVMRuntimeInput = {
    isoPath: input.isoPath,
    ...(input.bootImagePath === undefined ? {} : { bootImagePath: input.bootImagePath }),
    existingDiskPath: input.existingDiskPath,
    joiningDiskPath: input.joiningDiskPath,
    existingSerialLogPath: input.existingSerialLogPath,
    joiningSerialLogPath: input.joiningSerialLogPath,
    snapshotName: input.snapshotName ?? DEFAULT_SNAPSHOT_NAME,
    memoryMB: input.memoryMB ?? DEFAULT_MEMORY_MB,
    cpuCount: input.cpuCount ?? DEFAULT_CPU_COUNT,
    kvmAvailable: input.kvmAvailable ?? false,
  };

  const vms = DEFAULT_MULTI_VM.vms.map((vmSpec): MultiVMRuntimeVMPlan => {
    const isExisting = vmSpec.role === "cluster-existing";
    const diskPath = isExisting ? normalized.existingDiskPath : normalized.joiningDiskPath;
    const serialLogPath = isExisting ? normalized.existingSerialLogPath : normalized.joiningSerialLogPath;

    // Command to restore the snapshot for the existing cluster VM
    const restoreStartingState = isExisting
      ? {
          bin: "qemu-img" as const,
          args: ["snapshot", "-a", normalized.snapshotName, diskPath],
        }
      : undefined;

    // Boot command
    let qemuBootCommand: QemuCommand | undefined;
    const missingRuntimeRequirements: string[] = [];

    if (isExisting) {
      qemuBootCommand = {
        bin: "qemu-system-x86_64",
        args: buildQemuSystemBootArgs({
          diskPath,
          serialLogPath,
          memoryMB: normalized.memoryMB,
          cpuCount: normalized.cpuCount,
          kvmAvailable: normalized.kvmAvailable,
          bootMedia: { kind: "iso", path: normalized.isoPath },
        }),
      };
    } else {
      if (normalized.bootImagePath === undefined) {
        missingRuntimeRequirements.push("zflash-prepared boot image containing joining credentials");
      } else {
        qemuBootCommand = {
          bin: "qemu-system-x86_64",
          args: buildQemuSystemBootArgs({
            diskPath,
            serialLogPath,
            memoryMB: normalized.memoryMB,
            cpuCount: normalized.cpuCount,
            kvmAvailable: normalized.kvmAvailable,
            bootMedia: { kind: "usb-image", path: normalized.bootImagePath },
          }),
        };
      }
    }

    const requiredSerialMarkers = isExisting
      ? ["zeta-creds-restore: already-present"]
      : B0891_CLUSTER_JOIN_SERIAL_MARKERS;

    return {
      name: vmSpec.name,
      role: vmSpec.role,
      ...(restoreStartingState ? { restoreStartingState } : {}),
      ...(qemuBootCommand ? { qemuBootCommand } : {}),
      stopCondition: {
        serialLogPath,
        successMarkers: requiredSerialMarkers,
        failureMarkers: RETENTION_FAILURE_SERIAL_MARKERS,
        terminalFailureMarkers: RETENTION_ABSENT_TERMINAL_MARKERS,
      },
      requiredSerialMarkers,
      missingRuntimeRequirements,
    };
  });

  return {
    ok: {
      isoPath: normalized.isoPath,
      ...(normalized.bootImagePath === undefined ? {} : { bootImagePath: normalized.bootImagePath }),
      networkTopology: DEFAULT_MULTI_VM.networkTopology,
      joinProtocol: DEFAULT_MULTI_VM.joinProtocol,
      orchestrator: DEFAULT_MULTI_VM.orchestrator,
      vms,
    },
  };
}

export interface MultiVMAssertion {
  readonly matchedRequiredMarkers: readonly string[];
}

export type MultiVMExecutionStep = "restore-existing" | "create-joining-disk" | "boot-existing" | "boot-joining";

export interface MultiVMExecutionFeedback {
  readonly kind: "missing-runtime-requirements" | "command-failed" | "executor-threw" | "serial-marker-failed";
  readonly step: MultiVMExecutionStep | "setup";
  readonly message: string;
  readonly commandExecutions: readonly QemuCommandExecution[];
}

export interface MultiVMVMExecution {
  readonly vmName: string;
  readonly commandExecutions: readonly QemuCommandExecution[];
}

export type MultiVMExecutionResult =
  | {
      readonly ok: {
        readonly vmExecutions: readonly MultiVMVMExecution[];
        readonly commandExecutions: readonly QemuCommandExecution[];
      };
    }
  | { readonly error: MultiVMExecutionFeedback };

type RestoreOutcome = { readonly ok: QemuCommandExecution | undefined } | { readonly error: MultiVMExecutionFeedback };

type BootOutcome = { readonly ok: QemuCommandExecution } | { readonly error: MultiVMExecutionFeedback };

function executionFeedback(
  kind: MultiVMExecutionFeedback["kind"],
  step: MultiVMExecutionFeedback["step"],
  message: string,
  commandExecutions: readonly QemuCommandExecution[],
): MultiVMExecutionFeedback {
  return { kind, step, message, commandExecutions };
}

function bootStep(vm: MultiVMRuntimeVMPlan): MultiVMExecutionStep {
  return vm.role === "cluster-existing" ? "boot-existing" : "boot-joining";
}

function retentionBootStep(vm: MultiVMRuntimeVMPlan): QemuCommandExecution["step"] {
  return vm.role === "cluster-existing" ? "restart-from-iso-with-disk" : "initial-install-from-iso-with-disk";
}

function restoreStartingState(
  vm: MultiVMRuntimeVMPlan,
  executor: Qcow2RetentionExecutor,
  commandExecutions: QemuCommandExecution[],
): RestoreOutcome {
  if (vm.restoreStartingState === undefined) {
    return { ok: undefined };
  }

  let execution: QemuCommandExecution;
  try {
    execution = executor.runCommand("restore-baseline-snapshot", vm.restoreStartingState);
  } catch (error) {
    return {
      error: executionFeedback(
        "executor-threw",
        "restore-existing",
        `Failed to restore starting state for VM ${vm.name}: ${error instanceof Error ? error.message : String(error)}`,
        commandExecutions,
      ),
    };
  }

  commandExecutions.push(execution);
  if (execution.exitCode !== 0) {
    return {
      error: executionFeedback(
        "command-failed",
        "restore-existing",
        `Restore baseline snapshot command failed for VM ${vm.name}: ${execution.stderr}`,
        commandExecutions,
      ),
    };
  }
  return { ok: execution };
}

function bootAndVerifyVm(
  vm: MultiVMRuntimeVMPlan,
  executor: Qcow2RetentionExecutor,
  commandExecutions: QemuCommandExecution[],
): BootOutcome {
  if (vm.qemuBootCommand === undefined) {
    return {
      error: executionFeedback(
        "missing-runtime-requirements",
        "setup",
        `VM ${vm.name} has no qemu boot command`,
        commandExecutions,
      ),
    };
  }

  const runCommandUntilSerialMarkers = executor.runCommandUntilSerialMarkers;
  const step = bootStep(vm);
  if (runCommandUntilSerialMarkers === undefined) {
    return {
      error: executionFeedback(
        "executor-threw",
        step,
        `Executor missing runCommandUntilSerialMarkers method for step ${step}`,
        commandExecutions,
      ),
    };
  }

  let bootExec: QemuCommandExecution;
  try {
    bootExec = runCommandUntilSerialMarkers(retentionBootStep(vm), vm.qemuBootCommand, vm.stopCondition);
  } catch (error) {
    return {
      error: executionFeedback(
        "executor-threw",
        step,
        `Failed to boot VM ${vm.name}: ${error instanceof Error ? error.message : String(error)}`,
        commandExecutions,
      ),
    };
  }

  commandExecutions.push(bootExec);
  if (bootExec.exitCode !== 0) {
    return {
      error: executionFeedback(
        "command-failed",
        step,
        `Boot command failed for VM ${vm.name}: ${bootExec.stderr}`,
        commandExecutions,
      ),
    };
  }

  let serialOutput: string;
  try {
    serialOutput = executor.readSerialOutput(vm.stopCondition.serialLogPath);
  } catch (error) {
    return {
      error: executionFeedback(
        "executor-threw",
        step,
        `Failed to read serial output for VM ${vm.name}: ${error instanceof Error ? error.message : String(error)}`,
        commandExecutions,
      ),
    };
  }

  const missingMarkers = vm.requiredSerialMarkers.filter((marker) => !serialOutput.includes(marker));
  if (missingMarkers.length > 0) {
    return {
      error: executionFeedback(
        "serial-marker-failed",
        step,
        `VM ${vm.name} missed required serial markers: ${missingMarkers.join(", ")}`,
        commandExecutions,
      ),
    };
  }

  return { ok: bootExec };
}

export function executeMultiVMRuntimePlan(
  plan: MultiVMRuntimePlan,
  executor: Qcow2RetentionExecutor,
): MultiVMExecutionResult {
  const commandExecutions: QemuCommandExecution[] = [];
  const vmExecutions: MultiVMVMExecution[] = [];

  for (const vm of plan.vms) {
    if (vm.missingRuntimeRequirements.length > 0) {
      return {
        error: executionFeedback(
          "missing-runtime-requirements",
          "setup",
          `VM ${vm.name} missing runtime requirements: ${vm.missingRuntimeRequirements.join(", ")}`,
          commandExecutions,
        ),
      };
    }

    const restored = restoreStartingState(vm, executor, commandExecutions);
    if ("error" in restored) {
      return { error: restored.error };
    }

    const booted = bootAndVerifyVm(vm, executor, commandExecutions);
    if ("error" in booted) {
      return { error: booted.error };
    }

    vmExecutions.push({
      vmName: vm.name,
      commandExecutions: restored.ok === undefined ? [booted.ok] : [restored.ok, booted.ok],
    });
  }

  return {
    ok: {
      vmExecutions,
      commandExecutions,
    },
  };
}
