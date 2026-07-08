import { spawn as nodeSpawn, spawnSync as nodeSpawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import {
  B0891_RETENTION_USB_SERIAL_MARKERS,
  INITIAL_INSTALL_SERIAL_MARKERS,
  INSTALLED_OS_RETENTION_SERIAL_MARKERS,
  RETENTION_ABSENT_TERMINAL_MARKERS,
  RETENTION_FAILURE_SERIAL_MARKERS,
  FIRST_SESSION_SERIAL_MARKERS,
  serialFirstBootInProgress
} from "./serial-markers";
const DEFAULT_MEMORY_MB = 4096, DEFAULT_CPU_COUNT = 2, DEFAULT_DISK_SIZE_GB = 20, DEFAULT_RETENTION_COMMAND_TIMEOUT_MS = 1800000, DEFAULT_RETENTION_POLL_INTERVAL_MS = 1000, DEFAULT_QEMU_STOP_TIMEOUT_MS = 5000, DEFAULT_QEMU_KILL_TIMEOUT_MS = 1000;
export {
  B0891_RETENTION_USB_SERIAL_MARKERS,
  INITIAL_INSTALL_SERIAL_MARKERS,
  INSTALLED_OS_RETENTION_SERIAL_MARKERS as RETENTION_SERIAL_MARKERS,
  RETENTION_ABSENT_TERMINAL_MARKERS,
  RETENTION_FAILURE_SERIAL_MARKERS,
  assertHappyPathFirstSessionSerial,
  assertSkipGhFirstSessionSerial
} from "./serial-markers";
export function restartRetentionSerialMarkers(bootImagePath) {
  if (bootImagePath !== void 0)
    return B0891_RETENTION_USB_SERIAL_MARKERS;
  return INSTALLED_OS_RETENTION_SERIAL_MARKERS;
}
function nonEmpty(value) {
  return value.trim().length > 0;
}
function positiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}
function validateInput(input) {
  if (!nonEmpty(input.isoPath))
    return { kind: "invalid-input", field: "isoPath", reason: "ISO path is required" };
  if (input.bootImagePath !== void 0 && !nonEmpty(input.bootImagePath))
    return { kind: "invalid-input", field: "bootImagePath", reason: "boot image path must be non-empty when provided" };
  if (!nonEmpty(input.diskPath))
    return { kind: "invalid-input", field: "diskPath", reason: "qcow2 disk path is required" };
  if (!nonEmpty(input.serialLogPath))
    return { kind: "invalid-input", field: "serialLogPath", reason: "serial log path is required" };
  if (!nonEmpty(input.snapshotName))
    return { kind: "invalid-input", field: "snapshotName", reason: "snapshot name is required" };
  if (input.diskSizeGB !== void 0 && !positiveInteger(input.diskSizeGB))
    return { kind: "invalid-input", field: "diskSizeGB", reason: "diskSizeGB must be a positive integer" };
  if (input.memoryMB !== void 0 && !positiveInteger(input.memoryMB))
    return { kind: "invalid-input", field: "memoryMB", reason: "memoryMB must be a positive integer" };
  if (input.cpuCount !== void 0 && !positiveInteger(input.cpuCount))
    return { kind: "invalid-input", field: "cpuCount", reason: "cpuCount must be a positive integer" };
  return null;
}
export function buildQemuSystemBootArgs(input) {
  const args = [
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
    "virtio-net-pci,netdev=net0"
  ];
  if (input.bootMedia.kind === "usb-image")
    args.push("-drive", `file=${input.bootMedia.path},if=none,format=raw,readonly=on,id=zflashboot`, "-device", "qemu-xhci,id=xhci", "-device", "usb-storage,bus=xhci.0,drive=zflashboot,bootindex=1");
  else
    args.push("-cdrom", input.bootMedia.path, "-boot", "d");
  if (input.kvmAvailable)
    args.push("-enable-kvm", "-cpu", "host");
  else
    args.push("-cpu", "qemu64");
  return args;
}
function buildRestartArgs(input) {
  return buildQemuSystemBootArgs({
    diskPath: input.diskPath,
    serialLogPath: input.serialLogPath,
    memoryMB: input.memoryMB,
    cpuCount: input.cpuCount,
    kvmAvailable: input.kvmAvailable,
    bootMedia: input.bootImagePath === void 0 ? { kind: "iso", path: input.isoPath } : { kind: "usb-image", path: input.bootImagePath }
  });
}
export function planQcow2SnapshotRetention(input) {
  const invalid = validateInput(input);
  if (invalid)
    return { error: invalid };
  const normalized = {
    isoPath: input.isoPath,
    ...input.bootImagePath === void 0 ? {} : { bootImagePath: input.bootImagePath },
    diskPath: input.diskPath,
    serialLogPath: input.serialLogPath,
    snapshotName: input.snapshotName,
    diskSizeGB: input.diskSizeGB ?? DEFAULT_DISK_SIZE_GB,
    memoryMB: input.memoryMB ?? DEFAULT_MEMORY_MB,
    cpuCount: input.cpuCount ?? DEFAULT_CPU_COUNT,
    kvmAvailable: input.kvmAvailable ?? !1
  };
  return {
    ok: {
      isoPath: normalized.isoPath,
      ...normalized.bootImagePath === void 0 ? {} : { bootImagePath: normalized.bootImagePath },
      diskPath: normalized.diskPath,
      serialLogPath: normalized.serialLogPath,
      snapshotName: normalized.snapshotName,
      diskSizeGB: normalized.diskSizeGB,
      createDiskImage: {
        bin: "qemu-img",
        args: ["create", "-f", "qcow2", normalized.diskPath, `${String(normalized.diskSizeGB)}G`]
      },
      initialInstallFromIsoWithDisk: {
        bin: "qemu-system-x86_64",
        args: buildRestartArgs(normalized)
      },
      initialInstallStopCondition: {
        serialLogPath: normalized.serialLogPath,
        successMarkers: INITIAL_INSTALL_SERIAL_MARKERS,
        failureMarkers: RETENTION_FAILURE_SERIAL_MARKERS,
        terminalFailureMarkers: RETENTION_ABSENT_TERMINAL_MARKERS
      },
      createBaselineSnapshot: {
        bin: "qemu-img",
        args: ["snapshot", "-c", normalized.snapshotName, normalized.diskPath]
      },
      restoreBaselineSnapshot: {
        bin: "qemu-img",
        args: ["snapshot", "-a", normalized.snapshotName, normalized.diskPath]
      },
      listSnapshots: {
        bin: "qemu-img",
        args: ["snapshot", "-l", normalized.diskPath]
      },
      restartFromIsoWithDisk: {
        bin: "qemu-system-x86_64",
        args: buildRestartArgs(normalized)
      },
      restartStopCondition: {
        serialLogPath: normalized.serialLogPath,
        successMarkers: restartRetentionSerialMarkers(normalized.bootImagePath),
        failureMarkers: RETENTION_FAILURE_SERIAL_MARKERS,
        terminalFailureMarkers: RETENTION_ABSENT_TERMINAL_MARKERS
      },
      requiredSerialMarkers: restartRetentionSerialMarkers(normalized.bootImagePath)
    }
  };
}
function retentionExecutionSteps(plan) {
  return [
    { step: "create-disk-image", command: plan.createDiskImage },
    {
      step: "initial-install-from-iso-with-disk",
      command: plan.initialInstallFromIsoWithDisk,
      stopCondition: plan.initialInstallStopCondition
    },
    { step: "create-baseline-snapshot", command: plan.createBaselineSnapshot },
    { step: "list-baseline-snapshots", command: plan.listSnapshots },
    { step: "restore-baseline-snapshot", command: plan.restoreBaselineSnapshot },
    {
      step: "restart-from-iso-with-disk",
      command: plan.restartFromIsoWithDisk,
      stopCondition: plan.restartStopCondition
    }
  ];
}
function unknownReason(error) {
  return error instanceof Error ? error.message : String(error);
}
function qemuCommandOptions(cwd, timeoutMs) {
  return cwd === void 0 ? { timeoutMs } : { cwd, timeoutMs };
}
function stringifySpawnOutput(output) {
  if (typeof output === "string")
    return output;
  return output?.toString("utf8") ?? "";
}
function appendSpawnError(stderr, error) {
  if (!(error instanceof Error))
    return stderr;
  if (stderr.length === 0)
    return error.message;
  return `${stderr}
${error.message}`;
}
function defaultSpawnSyncQemuCommand(command, options) {
  const spawnOptions = options.cwd === void 0 ? { encoding: "utf8", timeout: options.timeoutMs } : { cwd: options.cwd, encoding: "utf8", timeout: options.timeoutMs }, result = nodeSpawnSync(command.bin, [...command.args], spawnOptions), stdout = stringifySpawnOutput(result.stdout), stderr = appendSpawnError(stringifySpawnOutput(result.stderr), result.error);
  return {
    exitCode: result.status,
    stdout,
    stderr
  };
}
function pidIsRunning(pid) {
  if (pid === void 0)
    return !1;
  try {
    process.kill(pid, 0);
    return !0;
  } catch {
    return !1;
  }
}
function defaultSpawnManagedQemuCommand(command, options) {
  const spawnOptions = { stdio: ["ignore", "ignore", "pipe"] };
  if (options.cwd !== void 0)
    spawnOptions.cwd = options.cwd;
  const child = nodeSpawn(command.bin, [...command.args], spawnOptions);
  let stderr = "";
  child.stderr?.on("data", (chunk) => {
    stderr += typeof chunk === "string" ? chunk : chunk.toString("utf8");
  });
  return {
    ...child.pid === void 0 ? {} : { pid: child.pid },
    isRunning: () => pidIsRunning(child.pid),
    stop: (signal = "SIGTERM") => {
      if (pidIsRunning(child.pid))
        child.kill(signal);
    },
    stderr: () => stderr
  };
}
function sleepSync(ms) {
  const buffer = new SharedArrayBuffer(4), view = new Int32Array(buffer);
  Atomics.wait(view, 0, 0, ms);
}
function waitForManagedProcessStop(managed, timeoutMs, pollIntervalMs) {
  const deadline = Date.now() + timeoutMs;
  while (managed.isRunning() && Date.now() < deadline)
    sleepSync(Math.min(pollIntervalMs, Math.max(deadline - Date.now(), 1)));
  return !managed.isRunning();
}
function stopManagedProcess(managed, signal, pollIntervalMs) {
  if (!managed.isRunning())
    return;
  managed.stop(signal);
  if (waitForManagedProcessStop(managed, DEFAULT_QEMU_STOP_TIMEOUT_MS, pollIntervalMs))
    return;
  if (signal !== "SIGKILL" && managed.isRunning()) {
    managed.stop("SIGKILL");
    waitForManagedProcessStop(managed, DEFAULT_QEMU_KILL_TIMEOUT_MS, pollIntervalMs);
  }
}
function readSerialOutputIfPresent(serialLogPath, readSerialOutput) {
  try {
    return readSerialOutput(serialLogPath);
  } catch (error) {
    if (!existsSync(serialLogPath))
      return "";
    throw error;
  }
}
function matchedMarkers(serialOutput, markers) {
  return markers.filter((marker) => serialOutput.includes(marker));
}
function allMarkersPresent(serialOutput, markers) {
  return matchedMarkers(serialOutput, markers).length === markers.length;
}
function firstMatchedMarker(serialOutput, markers) {
  return markers.find((marker) => serialOutput.includes(marker));
}
function serialOutputAfterBaseline(serialOutput, baseline) {
  if (baseline.length === 0)
    return serialOutput;
  return serialOutput.startsWith(baseline) ? serialOutput.slice(baseline.length) : serialOutput;
}
function runManagedCommandUntilSerialMarkers(step, command, stopCondition, options, pollIntervalMs, spawnManagedCommand, readSerialOutput) {
  const startedAt = Date.now(), deadline = startedAt + options.timeoutMs;
  let serialBaseline;
  try {
    serialBaseline = readSerialOutputIfPresent(stopCondition.serialLogPath, readSerialOutput);
  } catch (error) {
    return {
      step,
      command,
      exitCode: 1,
      stdout: "",
      stderr: `serial log baseline read failed while waiting for markers: ${unknownReason(error)}`
    };
  }
  const managed = spawnManagedCommand(command, options);
  while (Date.now() < deadline) {
    let serialOutput;
    try {
      serialOutput = readSerialOutputIfPresent(stopCondition.serialLogPath, readSerialOutput);
    } catch (error) {
      stopManagedProcess(managed, "SIGTERM", pollIntervalMs);
      return {
        step,
        command,
        exitCode: 1,
        stdout: "",
        stderr: `serial log read failed while waiting for markers: ${unknownReason(error)}`
      };
    }
    const phaseSerialOutput = serialOutputAfterBaseline(serialOutput, serialBaseline), failureMarker = firstMatchedMarker(phaseSerialOutput, stopCondition.failureMarkers);
    if (failureMarker !== void 0) {
      stopManagedProcess(managed, "SIGTERM", pollIntervalMs);
      return {
        step,
        command,
        exitCode: 1,
        stdout: "",
        stderr: `failure marker observed in serial log: ${failureMarker}`
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
          ...stoppedPid === void 0 ? {} : { stoppedPid }
        }
      };
    }
    const terminalFailureMarker = firstMatchedMarker(phaseSerialOutput, stopCondition.terminalFailureMarkers ?? []);
    if (terminalFailureMarker !== void 0 && !(terminalFailureMarker === "nixos@zeta-installer:~" && serialFirstBootInProgress(phaseSerialOutput))) {
      stopManagedProcess(managed, "SIGTERM", pollIntervalMs);
      return {
        step,
        command,
        exitCode: 1,
        stdout: "",
        stderr: `terminal marker observed before required serial markers: ${terminalFailureMarker}; still waiting for ${stopCondition.successMarkers.join(", ")}. If install is progressing on tty1 only, ensure zeta-first-boot mirrors to /dev/ttyS0 (081KSNY2Z0008QG0R0008PN7RQ).`
      };
    }
    if (!managed.isRunning())
      return {
        step,
        command,
        exitCode: 1,
        stdout: "",
        stderr: `QEMU exited before serial markers were observed: ${stopCondition.successMarkers.join(", ")}`
      };
    sleepSync(pollIntervalMs);
  }
  stopManagedProcess(managed, "SIGTERM", pollIntervalMs);
  return {
    step,
    command,
    exitCode: 1,
    stdout: "",
    stderr: `timeout (${String(options.timeoutMs)}ms) waiting for serial markers: ${stopCondition.successMarkers.join(", ")}`
  };
}
export function createSpawnSyncQcow2RetentionExecutor(options = {}) {
  const timeoutMs = options.timeoutMs ?? DEFAULT_RETENTION_COMMAND_TIMEOUT_MS, pollIntervalMs = options.pollIntervalMs ?? DEFAULT_RETENTION_POLL_INTERVAL_MS, spawnCommand = options.spawnCommand ?? defaultSpawnSyncQemuCommand, spawnManagedCommand = options.spawnManagedCommand ?? defaultSpawnManagedQemuCommand, readSerialOutput = options.readSerialOutput ?? ((serialLogPath) => readFileSync(serialLogPath, "utf8"));
  return {
    runCommand: (step, command) => {
      const execution = spawnCommand(command, qemuCommandOptions(options.cwd, timeoutMs));
      return {
        step,
        command,
        exitCode: execution.exitCode,
        stdout: execution.stdout,
        stderr: execution.stderr
      };
    },
    runCommandUntilSerialMarkers: (step, command, stopCondition) => runManagedCommandUntilSerialMarkers(step, command, stopCondition, qemuCommandOptions(options.cwd, timeoutMs), pollIntervalMs, spawnManagedCommand, readSerialOutput),
    readSerialOutput
  };
}
export function executeQcow2SnapshotRetentionPlan(plan, executor) {
  const commandExecutions = [];
  for (const { step, command, stopCondition } of retentionExecutionSteps(plan)) {
    let execution;
    try {
      if (stopCondition !== void 0) {
        if (executor.runCommandUntilSerialMarkers === void 0)
          return {
            error: {
              kind: "command-failed",
              step,
              command,
              exitCode: null,
              stderr: `missing runCommandUntilSerialMarkers executor for serial-gated QEMU step ${step}`,
              commandExecutions
            }
          };
        execution = executor.runCommandUntilSerialMarkers(step, command, stopCondition);
      } else
        execution = executor.runCommand(step, command);
    } catch (error) {
      return {
        error: {
          kind: "executor-threw",
          step,
          reason: unknownReason(error),
          commandExecutions
        }
      };
    }
    commandExecutions.push(execution);
    if (execution.exitCode !== 0)
      return {
        error: {
          kind: "command-failed",
          step,
          command,
          exitCode: execution.exitCode,
          stderr: execution.stderr,
          commandExecutions
        }
      };
  }
  let serialOutput;
  try {
    serialOutput = executor.readSerialOutput(plan.serialLogPath);
  } catch (error) {
    return {
      error: {
        kind: "executor-threw",
        step: "read-serial-output",
        reason: unknownReason(error),
        commandExecutions
      }
    };
  }
  const assertion = assertRetentionSerialMarkers(serialOutput, plan.requiredSerialMarkers);
  if ("error" in assertion)
    return {
      error: {
        kind: "serial-marker-failed",
        assertion: assertion.error,
        commandExecutions
      }
    };
  return {
    ok: {
      commandExecutions,
      serialAssertion: assertion.ok
    }
  };
}
export function assertRetentionSerialMarkers(serialOutput, requiredMarkers = INSTALLED_OS_RETENTION_SERIAL_MARKERS) {
  const missingMarkers = requiredMarkers.filter((marker) => !serialOutput.includes(marker));
  if (missingMarkers.length > 0)
    return {
      error: {
        kind: "missing-serial-markers",
        missingMarkers,
        requiredMarkers
      }
    };
  return {
    ok: {
      matchedMarkers: requiredMarkers
    }
  };
}
export function assertFirstSessionSerialMarkers(serialOutput, requiredMarkers = FIRST_SESSION_SERIAL_MARKERS) {
  return assertRetentionSerialMarkers(serialOutput, requiredMarkers);
}
