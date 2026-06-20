import { spawn as nodeSpawn, spawnSync as nodeSpawnSync, type SpawnOptions } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import {
  B0891_RETENTION_USB_SERIAL_MARKERS,
  INITIAL_INSTALL_SERIAL_MARKERS,
  INSTALLED_OS_RETENTION_SERIAL_MARKERS,
  RETENTION_ABSENT_TERMINAL_MARKERS,
  RETENTION_FAILURE_SERIAL_MARKERS,
  serialFirstBootInProgress,
} from "./serial-markers";

/**
 * B-0891 scenario 3 QEMU state-preservation primitives.
 *
 * This file defines the qemu-img snapshot/restart sequence and the
 * serial-marker lifecycle gates that keep QEMU boot phases bounded without
 * waiting for the guest to exit by itself.
 */

export interface QemuCommand {
  readonly bin: "qemu-img" | "qemu-system-x86_64";
  readonly args: readonly string[];
}

export type QemuSystemBootMedia =
  | { readonly kind: "iso"; readonly path: string }
  | { readonly kind: "usb-image"; readonly path: string };

export interface QemuSystemBootArgsInput {
  readonly diskPath: string;
  readonly serialLogPath: string;
  readonly memoryMB: number;
  readonly cpuCount: number;
  readonly kvmAvailable: boolean;
  readonly bootMedia: QemuSystemBootMedia;
}

export interface Qcow2SnapshotRetentionInput {
  readonly isoPath: string;
  readonly bootImagePath?: string;
  readonly diskPath: string;
  readonly serialLogPath: string;
  readonly snapshotName: string;
  readonly diskSizeGB?: number;
  readonly memoryMB?: number;
  readonly cpuCount?: number;
  readonly kvmAvailable?: boolean;
}

export interface Qcow2SnapshotRetentionPlan {
  readonly isoPath: string;
  readonly bootImagePath?: string;
  readonly diskPath: string;
  readonly serialLogPath: string;
  readonly snapshotName: string;
  readonly diskSizeGB: number;
  readonly createDiskImage: QemuCommand;
  readonly initialInstallFromIsoWithDisk: QemuCommand;
  readonly initialInstallStopCondition: QemuSerialStopCondition;
  readonly createBaselineSnapshot: QemuCommand;
  readonly restoreBaselineSnapshot: QemuCommand;
  readonly listSnapshots: QemuCommand;
  readonly restartFromIsoWithDisk: QemuCommand;
  readonly restartStopCondition: QemuSerialStopCondition;
  readonly requiredSerialMarkers: readonly string[];
}

export type Qcow2SnapshotRetentionFeedback = {
  readonly kind: "invalid-input";
  readonly field: keyof Qcow2SnapshotRetentionInput;
  readonly reason: string;
};

export type Qcow2SnapshotRetentionResult =
  | { readonly ok: Qcow2SnapshotRetentionPlan }
  | { readonly error: Qcow2SnapshotRetentionFeedback };

export interface RetentionSerialMarkerAssertion {
  readonly matchedMarkers: readonly string[];
}

export type RetentionSerialMarkerFeedback = {
  readonly kind: "missing-serial-markers";
  readonly missingMarkers: readonly string[];
  readonly requiredMarkers: readonly string[];
};

export type RetentionSerialMarkerResult =
  | { readonly ok: RetentionSerialMarkerAssertion }
  | { readonly error: RetentionSerialMarkerFeedback };

export type Qcow2RetentionExecutionStep =
  | "create-disk-image"
  | "initial-install-from-iso-with-disk"
  | "create-baseline-snapshot"
  | "list-baseline-snapshots"
  | "restore-baseline-snapshot"
  | "restart-from-iso-with-disk"
  | "bootstrap-create-disk-image"
  | "bootstrap-initial-install-from-iso-with-disk"
  | "bootstrap-create-baseline-snapshot"
  | "restore-migrate-existing-creds"
  | "restore-fresh-cluster"
  | "boot-migrate-existing-creds"
  | "boot-fresh-cluster";

export interface QemuSerialStopCondition {
  readonly serialLogPath: string;
  readonly successMarkers: readonly string[];
  readonly failureMarkers: readonly string[];
  readonly terminalFailureMarkers?: readonly string[];
}

export interface QemuSerialStopAssertion {
  readonly matchedMarkers: readonly string[];
  readonly elapsedMs: number;
  readonly stoppedPid?: number;
}

export interface QemuCommandExecution {
  readonly step: Qcow2RetentionExecutionStep;
  readonly command: QemuCommand;
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly serialStop?: QemuSerialStopAssertion;
}

export interface Qcow2RetentionExecutor {
  readonly runCommand: (step: Qcow2RetentionExecutionStep, command: QemuCommand) => QemuCommandExecution;
  readonly runCommandUntilSerialMarkers?: (
    step: Qcow2RetentionExecutionStep,
    command: QemuCommand,
    stopCondition: QemuSerialStopCondition,
  ) => QemuCommandExecution;
  readonly readSerialOutput: (serialLogPath: string) => string;
}

export interface SpawnSyncQemuCommandOptions {
  readonly cwd?: string;
  readonly timeoutMs: number;
}

export interface SpawnSyncQemuCommandResult {
  readonly exitCode: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

export type SpawnSyncQemuCommand = (
  command: QemuCommand,
  options: SpawnSyncQemuCommandOptions,
) => SpawnSyncQemuCommandResult;

export interface ManagedQemuCommandProcess {
  readonly pid?: number;
  readonly isRunning: () => boolean;
  readonly stop: (signal?: NodeJS.Signals) => void;
  readonly stderr: () => string;
}

export type SpawnManagedQemuCommand = (
  command: QemuCommand,
  options: SpawnSyncQemuCommandOptions,
) => ManagedQemuCommandProcess;

export interface SpawnSyncQcow2RetentionExecutorOptions {
  readonly cwd?: string;
  readonly timeoutMs?: number;
  readonly pollIntervalMs?: number;
  readonly spawnCommand?: SpawnSyncQemuCommand;
  readonly spawnManagedCommand?: SpawnManagedQemuCommand;
  readonly readSerialOutput?: (serialLogPath: string) => string;
}

export type Qcow2RetentionExecutionFeedback =
  | {
      readonly kind: "command-failed";
      readonly step: Qcow2RetentionExecutionStep;
      readonly command: QemuCommand;
      readonly exitCode: number | null;
      readonly stderr: string;
      readonly commandExecutions: readonly QemuCommandExecution[];
    }
  | {
      readonly kind: "executor-threw";
      readonly step: Qcow2RetentionExecutionStep | "read-serial-output";
      readonly reason: string;
      readonly commandExecutions: readonly QemuCommandExecution[];
    }
  | {
      readonly kind: "serial-marker-failed";
      readonly assertion: RetentionSerialMarkerFeedback;
      readonly commandExecutions: readonly QemuCommandExecution[];
    };

export interface Qcow2RetentionExecutionAssertion {
  readonly commandExecutions: readonly QemuCommandExecution[];
  readonly serialAssertion: RetentionSerialMarkerAssertion;
}

export type Qcow2RetentionExecutionResult =
  | { readonly ok: Qcow2RetentionExecutionAssertion }
  | { readonly error: Qcow2RetentionExecutionFeedback };

const DEFAULT_MEMORY_MB = 4096;
const DEFAULT_CPU_COUNT = 2;
const DEFAULT_DISK_SIZE_GB = 20;
const DEFAULT_RETENTION_COMMAND_TIMEOUT_MS = 30 * 60 * 1000;
const DEFAULT_RETENTION_POLL_INTERVAL_MS = 1000;
const DEFAULT_QEMU_STOP_TIMEOUT_MS = 5000;
const DEFAULT_QEMU_KILL_TIMEOUT_MS = 1000;

export {
  B0891_RETENTION_USB_SERIAL_MARKERS,
  INITIAL_INSTALL_SERIAL_MARKERS,
  INSTALLED_OS_RETENTION_SERIAL_MARKERS as RETENTION_SERIAL_MARKERS,
  RETENTION_ABSENT_TERMINAL_MARKERS,
  RETENTION_FAILURE_SERIAL_MARKERS,
} from "./serial-markers";

/** Restart phase markers: zflash USB retention when boot image provided; else installed-OS cred-restore. */
export function restartRetentionSerialMarkers(bootImagePath?: string): readonly string[] {
  if (bootImagePath !== undefined) {
    // CI proves cred retention during reinstall (B-0891 ESP copy + picker skip) without
    // waiting for post-reboot installed-OS zeta-creds-restore in the same QEMU session.
    return B0891_RETENTION_USB_SERIAL_MARKERS;
  }
  return INSTALLED_OS_RETENTION_SERIAL_MARKERS;
}

function nonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function positiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function validateInput(input: Qcow2SnapshotRetentionInput): Qcow2SnapshotRetentionFeedback | null {
  if (!nonEmpty(input.isoPath)) {
    return { kind: "invalid-input", field: "isoPath", reason: "ISO path is required" };
  }
  if (input.bootImagePath !== undefined && !nonEmpty(input.bootImagePath)) {
    return { kind: "invalid-input", field: "bootImagePath", reason: "boot image path must be non-empty when provided" };
  }
  if (!nonEmpty(input.diskPath)) {
    return { kind: "invalid-input", field: "diskPath", reason: "qcow2 disk path is required" };
  }
  if (!nonEmpty(input.serialLogPath)) {
    return { kind: "invalid-input", field: "serialLogPath", reason: "serial log path is required" };
  }
  if (!nonEmpty(input.snapshotName)) {
    return { kind: "invalid-input", field: "snapshotName", reason: "snapshot name is required" };
  }
  if (input.diskSizeGB !== undefined && !positiveInteger(input.diskSizeGB)) {
    return { kind: "invalid-input", field: "diskSizeGB", reason: "diskSizeGB must be a positive integer" };
  }
  if (input.memoryMB !== undefined && !positiveInteger(input.memoryMB)) {
    return { kind: "invalid-input", field: "memoryMB", reason: "memoryMB must be a positive integer" };
  }
  if (input.cpuCount !== undefined && !positiveInteger(input.cpuCount)) {
    return { kind: "invalid-input", field: "cpuCount", reason: "cpuCount must be a positive integer" };
  }
  return null;
}

type NormalizedQcow2SnapshotRetentionInput = Required<Omit<Qcow2SnapshotRetentionInput, "bootImagePath">> &
  Pick<Qcow2SnapshotRetentionInput, "bootImagePath">;

export function buildQemuSystemBootArgs(input: QemuSystemBootArgsInput): readonly string[] {
  const args: string[] = [
    "-machine",
    "q35",
    "-m",
    String(input.memoryMB),
    "-smp",
    String(input.cpuCount),
    "-drive",
    `file=${input.diskPath},if=virtio,format=qcow2`,
    "-serial",
    `file:${input.serialLogPath}`,
    "-display",
    "none",
    "-netdev",
    "user,id=net0",
    "-device",
    "virtio-net-pci,netdev=net0",
  ];

  if (input.bootMedia.kind === "usb-image") {
    args.push(
      "-drive",
      `file=${input.bootMedia.path},if=none,format=raw,readonly=on,id=zflashboot`,
      "-device",
      "qemu-xhci,id=xhci",
      "-device",
      "usb-storage,bus=xhci.0,drive=zflashboot,bootindex=1",
    );
  } else {
    args.push("-cdrom", input.bootMedia.path, "-boot", "d");
  }

  if (input.kvmAvailable) {
    args.push("-enable-kvm", "-cpu", "host");
  } else {
    args.push("-cpu", "qemu64");
  }

  return args;
}

function buildRestartArgs(input: NormalizedQcow2SnapshotRetentionInput): readonly string[] {
  return buildQemuSystemBootArgs({
    diskPath: input.diskPath,
    serialLogPath: input.serialLogPath,
    memoryMB: input.memoryMB,
    cpuCount: input.cpuCount,
    kvmAvailable: input.kvmAvailable,
    bootMedia:
      input.bootImagePath === undefined
        ? { kind: "iso", path: input.isoPath }
        : { kind: "usb-image", path: input.bootImagePath },
  });
}

export function planQcow2SnapshotRetention(input: Qcow2SnapshotRetentionInput): Qcow2SnapshotRetentionResult {
  const invalid = validateInput(input);
  if (invalid) {
    return { error: invalid };
  }

  const normalized: NormalizedQcow2SnapshotRetentionInput = {
    isoPath: input.isoPath,
    ...(input.bootImagePath === undefined ? {} : { bootImagePath: input.bootImagePath }),
    diskPath: input.diskPath,
    serialLogPath: input.serialLogPath,
    snapshotName: input.snapshotName,
    diskSizeGB: input.diskSizeGB ?? DEFAULT_DISK_SIZE_GB,
    memoryMB: input.memoryMB ?? DEFAULT_MEMORY_MB,
    cpuCount: input.cpuCount ?? DEFAULT_CPU_COUNT,
    kvmAvailable: input.kvmAvailable ?? false,
  };

  return {
    ok: {
      isoPath: normalized.isoPath,
      ...(normalized.bootImagePath === undefined ? {} : { bootImagePath: normalized.bootImagePath }),
      diskPath: normalized.diskPath,
      serialLogPath: normalized.serialLogPath,
      snapshotName: normalized.snapshotName,
      diskSizeGB: normalized.diskSizeGB,
      createDiskImage: {
        bin: "qemu-img",
        args: ["create", "-f", "qcow2", normalized.diskPath, `${String(normalized.diskSizeGB)}G`],
      },
      initialInstallFromIsoWithDisk: {
        bin: "qemu-system-x86_64",
        args: buildRestartArgs(normalized),
      },
      initialInstallStopCondition: {
        serialLogPath: normalized.serialLogPath,
        successMarkers: INITIAL_INSTALL_SERIAL_MARKERS,
        failureMarkers: RETENTION_FAILURE_SERIAL_MARKERS,
        terminalFailureMarkers: RETENTION_ABSENT_TERMINAL_MARKERS,
      },
      createBaselineSnapshot: {
        bin: "qemu-img",
        args: ["snapshot", "-c", normalized.snapshotName, normalized.diskPath],
      },
      restoreBaselineSnapshot: {
        bin: "qemu-img",
        args: ["snapshot", "-a", normalized.snapshotName, normalized.diskPath],
      },
      listSnapshots: {
        bin: "qemu-img",
        args: ["snapshot", "-l", normalized.diskPath],
      },
      restartFromIsoWithDisk: {
        bin: "qemu-system-x86_64",
        args: buildRestartArgs(normalized),
      },
      restartStopCondition: {
        serialLogPath: normalized.serialLogPath,
        successMarkers: restartRetentionSerialMarkers(normalized.bootImagePath),
        failureMarkers: RETENTION_FAILURE_SERIAL_MARKERS,
        terminalFailureMarkers: RETENTION_ABSENT_TERMINAL_MARKERS,
      },
      requiredSerialMarkers: restartRetentionSerialMarkers(normalized.bootImagePath),
    },
  };
}

interface RetentionExecutionPlannedStep {
  readonly step: Qcow2RetentionExecutionStep;
  readonly command: QemuCommand;
  readonly stopCondition?: QemuSerialStopCondition;
}

function retentionExecutionSteps(plan: Qcow2SnapshotRetentionPlan): readonly RetentionExecutionPlannedStep[] {
  return [
    { step: "create-disk-image", command: plan.createDiskImage },
    {
      step: "initial-install-from-iso-with-disk",
      command: plan.initialInstallFromIsoWithDisk,
      stopCondition: plan.initialInstallStopCondition,
    },
    { step: "create-baseline-snapshot", command: plan.createBaselineSnapshot },
    { step: "list-baseline-snapshots", command: plan.listSnapshots },
    { step: "restore-baseline-snapshot", command: plan.restoreBaselineSnapshot },
    {
      step: "restart-from-iso-with-disk",
      command: plan.restartFromIsoWithDisk,
      stopCondition: plan.restartStopCondition,
    },
  ];
}

function unknownReason(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function qemuCommandOptions(cwd: string | undefined, timeoutMs: number): SpawnSyncQemuCommandOptions {
  return cwd === undefined ? { timeoutMs } : { cwd, timeoutMs };
}

function stringifySpawnOutput(output: string | Buffer | null | undefined): string {
  if (typeof output === "string") {
    return output;
  }
  return output?.toString("utf8") ?? "";
}

function appendSpawnError(stderr: string, error: unknown): string {
  if (!(error instanceof Error)) {
    return stderr;
  }
  if (stderr.length === 0) {
    return error.message;
  }
  return `${stderr}\n${error.message}`;
}

function defaultSpawnSyncQemuCommand(
  command: QemuCommand,
  options: SpawnSyncQemuCommandOptions,
): SpawnSyncQemuCommandResult {
  const spawnOptions =
    options.cwd === undefined
      ? { encoding: "utf8" as const, timeout: options.timeoutMs }
      : { cwd: options.cwd, encoding: "utf8" as const, timeout: options.timeoutMs };
  const result = nodeSpawnSync(command.bin, [...command.args], spawnOptions);
  const stdout = stringifySpawnOutput(result.stdout);
  const stderr = appendSpawnError(stringifySpawnOutput(result.stderr), result.error);
  return {
    exitCode: result.status,
    stdout,
    stderr,
  };
}

function pidIsRunning(pid: number | undefined): boolean {
  if (pid === undefined) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function defaultSpawnManagedQemuCommand(
  command: QemuCommand,
  options: SpawnSyncQemuCommandOptions,
): ManagedQemuCommandProcess {
  const spawnOptions: SpawnOptions = { stdio: ["ignore", "ignore", "pipe"] };
  if (options.cwd !== undefined) {
    spawnOptions.cwd = options.cwd;
  }
  const child = nodeSpawn(command.bin, [...command.args], spawnOptions);
  let stderr = "";
  child.stderr?.on("data", (chunk: Buffer | string) => {
    stderr += typeof chunk === "string" ? chunk : chunk.toString("utf8");
  });
  return {
    ...(child.pid === undefined ? {} : { pid: child.pid }),
    isRunning: () => pidIsRunning(child.pid),
    stop: (signal = "SIGTERM") => {
      if (pidIsRunning(child.pid)) {
        child.kill(signal);
      }
    },
    stderr: () => stderr,
  };
}

function sleepSync(ms: number): void {
  const buffer = new SharedArrayBuffer(4);
  const view = new Int32Array(buffer);
  Atomics.wait(view, 0, 0, ms);
}

function waitForManagedProcessStop(
  managed: ManagedQemuCommandProcess,
  timeoutMs: number,
  pollIntervalMs: number,
): boolean {
  const deadline = Date.now() + timeoutMs;
  while (managed.isRunning() && Date.now() < deadline) {
    sleepSync(Math.min(pollIntervalMs, Math.max(deadline - Date.now(), 1)));
  }
  return !managed.isRunning();
}

function stopManagedProcess(managed: ManagedQemuCommandProcess, signal: NodeJS.Signals, pollIntervalMs: number): void {
  if (!managed.isRunning()) {
    return;
  }
  managed.stop(signal);
  if (waitForManagedProcessStop(managed, DEFAULT_QEMU_STOP_TIMEOUT_MS, pollIntervalMs)) {
    return;
  }
  if (signal !== "SIGKILL" && managed.isRunning()) {
    managed.stop("SIGKILL");
    waitForManagedProcessStop(managed, DEFAULT_QEMU_KILL_TIMEOUT_MS, pollIntervalMs);
  }
}

function readSerialOutputIfPresent(serialLogPath: string, readSerialOutput: (serialLogPath: string) => string): string {
  try {
    return readSerialOutput(serialLogPath);
  } catch (error) {
    if (!existsSync(serialLogPath)) {
      return "";
    }
    throw error;
  }
}

function matchedMarkers(serialOutput: string, markers: readonly string[]): readonly string[] {
  return markers.filter((marker) => serialOutput.includes(marker));
}

function allMarkersPresent(serialOutput: string, markers: readonly string[]): boolean {
  return matchedMarkers(serialOutput, markers).length === markers.length;
}

function firstMatchedMarker(serialOutput: string, markers: readonly string[]): string | undefined {
  return markers.find((marker) => serialOutput.includes(marker));
}

function serialOutputAfterBaseline(serialOutput: string, baseline: string): string {
  if (baseline.length === 0) {
    return serialOutput;
  }
  return serialOutput.startsWith(baseline) ? serialOutput.slice(baseline.length) : serialOutput;
}

function runManagedCommandUntilSerialMarkers(
  step: Qcow2RetentionExecutionStep,
  command: QemuCommand,
  stopCondition: QemuSerialStopCondition,
  options: SpawnSyncQemuCommandOptions,
  pollIntervalMs: number,
  spawnManagedCommand: SpawnManagedQemuCommand,
  readSerialOutput: (serialLogPath: string) => string,
): QemuCommandExecution {
  const startedAt = Date.now();
  const deadline = startedAt + options.timeoutMs;
  let serialBaseline: string;
  try {
    serialBaseline = readSerialOutputIfPresent(stopCondition.serialLogPath, readSerialOutput);
  } catch (error) {
    return {
      step,
      command,
      exitCode: 1,
      stdout: "",
      stderr: `serial log baseline read failed while waiting for markers: ${unknownReason(error)}`,
    };
  }
  const managed = spawnManagedCommand(command, options);

  while (Date.now() < deadline) {
    let serialOutput: string;
    try {
      serialOutput = readSerialOutputIfPresent(stopCondition.serialLogPath, readSerialOutput);
    } catch (error) {
      stopManagedProcess(managed, "SIGTERM", pollIntervalMs);
      return {
        step,
        command,
        exitCode: 1,
        stdout: "",
        stderr: `serial log read failed while waiting for markers: ${unknownReason(error)}`,
      };
    }

    const phaseSerialOutput = serialOutputAfterBaseline(serialOutput, serialBaseline);
    const failureMarker = firstMatchedMarker(phaseSerialOutput, stopCondition.failureMarkers);
    if (failureMarker !== undefined) {
      stopManagedProcess(managed, "SIGTERM", pollIntervalMs);
      return {
        step,
        command,
        exitCode: 1,
        stdout: "",
        stderr: `failure marker observed in serial log: ${failureMarker}`,
      };
    }

    if (allMarkersPresent(phaseSerialOutput, stopCondition.successMarkers)) {
      const stoppedPid = managed.pid;
      stopManagedProcess(managed, "SIGTERM", pollIntervalMs);
      return {
        step,
        command,
        exitCode: 0,
        stdout: `serial markers observed: ${stopCondition.successMarkers.join(", ")}`,
        stderr: managed.stderr(),
        serialStop: {
          matchedMarkers: matchedMarkers(phaseSerialOutput, stopCondition.successMarkers),
          elapsedMs: Date.now() - startedAt,
          ...(stoppedPid === undefined ? {} : { stoppedPid }),
        },
      };
    }

    const terminalFailureMarker = firstMatchedMarker(phaseSerialOutput, stopCondition.terminalFailureMarkers ?? []);
    if (
      terminalFailureMarker !== undefined &&
      !(
        terminalFailureMarker === "nixos@zeta-installer:~" &&
        serialFirstBootInProgress(phaseSerialOutput)
      )
    ) {
      stopManagedProcess(managed, "SIGTERM", pollIntervalMs);
      return {
        step,
        command,
        exitCode: 1,
        stdout: "",
        stderr:
          `terminal marker observed before required serial markers: ${terminalFailureMarker}; ` +
          `still waiting for ${stopCondition.successMarkers.join(", ")}. ` +
          `If install is progressing on tty1 only, ensure zeta-first-boot mirrors to /dev/ttyS0 (B-0891).`,
      };
    }

    if (!managed.isRunning()) {
      return {
        step,
        command,
        exitCode: 1,
        stdout: "",
        stderr: `QEMU exited before serial markers were observed: ${stopCondition.successMarkers.join(", ")}`,
      };
    }

    sleepSync(pollIntervalMs);
  }

  stopManagedProcess(managed, "SIGTERM", pollIntervalMs);
  return {
    step,
    command,
    exitCode: 1,
    stdout: "",
    stderr: `timeout (${String(options.timeoutMs)}ms) waiting for serial markers: ${stopCondition.successMarkers.join(", ")}`,
  };
}

export function createSpawnSyncQcow2RetentionExecutor(
  options: SpawnSyncQcow2RetentionExecutorOptions = {},
): Qcow2RetentionExecutor {
  const timeoutMs = options.timeoutMs ?? DEFAULT_RETENTION_COMMAND_TIMEOUT_MS;
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_RETENTION_POLL_INTERVAL_MS;
  const spawnCommand = options.spawnCommand ?? defaultSpawnSyncQemuCommand;
  const spawnManagedCommand = options.spawnManagedCommand ?? defaultSpawnManagedQemuCommand;
  const readSerialOutput = options.readSerialOutput ?? ((serialLogPath: string) => readFileSync(serialLogPath, "utf8"));
  return {
    runCommand: (step, command) => {
      const execution = spawnCommand(command, qemuCommandOptions(options.cwd, timeoutMs));
      return {
        step,
        command,
        exitCode: execution.exitCode,
        stdout: execution.stdout,
        stderr: execution.stderr,
      };
    },
    runCommandUntilSerialMarkers: (step, command, stopCondition) =>
      runManagedCommandUntilSerialMarkers(
        step,
        command,
        stopCondition,
        qemuCommandOptions(options.cwd, timeoutMs),
        pollIntervalMs,
        spawnManagedCommand,
        readSerialOutput,
      ),
    readSerialOutput,
  };
}

export function executeQcow2SnapshotRetentionPlan(
  plan: Qcow2SnapshotRetentionPlan,
  executor: Qcow2RetentionExecutor,
): Qcow2RetentionExecutionResult {
  const commandExecutions: QemuCommandExecution[] = [];

  for (const { step, command, stopCondition } of retentionExecutionSteps(plan)) {
    let execution: QemuCommandExecution;
    try {
      if (stopCondition !== undefined) {
        if (executor.runCommandUntilSerialMarkers === undefined) {
          return {
            error: {
              kind: "command-failed",
              step,
              command,
              exitCode: null,
              stderr: `missing runCommandUntilSerialMarkers executor for serial-gated QEMU step ${step}`,
              commandExecutions,
            },
          };
        }
        execution = executor.runCommandUntilSerialMarkers(step, command, stopCondition);
      } else {
        execution = executor.runCommand(step, command);
      }
    } catch (error) {
      return {
        error: {
          kind: "executor-threw",
          step,
          reason: unknownReason(error),
          commandExecutions,
        },
      };
    }
    commandExecutions.push(execution);

    if (execution.exitCode !== 0) {
      return {
        error: {
          kind: "command-failed",
          step,
          command,
          exitCode: execution.exitCode,
          stderr: execution.stderr,
          commandExecutions,
        },
      };
    }
  }

  let serialOutput: string;
  try {
    serialOutput = executor.readSerialOutput(plan.serialLogPath);
  } catch (error) {
    return {
      error: {
        kind: "executor-threw",
        step: "read-serial-output",
        reason: unknownReason(error),
        commandExecutions,
      },
    };
  }

  const assertion = assertRetentionSerialMarkers(serialOutput, plan.requiredSerialMarkers);
  if ("error" in assertion) {
    return {
      error: {
        kind: "serial-marker-failed",
        assertion: assertion.error,
        commandExecutions,
      },
    };
  }

  return {
    ok: {
      commandExecutions,
      serialAssertion: assertion.ok,
    },
  };
}

export function assertRetentionSerialMarkers(
  serialOutput: string,
  requiredMarkers: readonly string[] = INSTALLED_OS_RETENTION_SERIAL_MARKERS,
): RetentionSerialMarkerResult {
  const missingMarkers = requiredMarkers.filter((marker) => !serialOutput.includes(marker));
  if (missingMarkers.length > 0) {
    return {
      error: {
        kind: "missing-serial-markers",
        missingMarkers,
        requiredMarkers,
      },
    };
  }

  return {
    ok: {
      matchedMarkers: requiredMarkers,
    },
  };
}
