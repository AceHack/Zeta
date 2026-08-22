import { spawn as nodeSpawn, spawnSync as nodeSpawnSync, type SpawnOptions } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { qemuUsbStorageDeviceArg } from "../../installer/qemu-usb-storage.ts";
import {
  B0891_RETENTION_USB_SERIAL_MARKERS,
  HOSTNAME_AUTOGENERATION_SERIAL_MARKERS,
  HOSTNAME_INJECTION_SERIAL_MARKERS,
  INITIAL_INSTALL_SERIAL_MARKERS,
  INSTALLED_OS_RETENTION_SERIAL_MARKERS,
  RETENTION_ABSENT_TERMINAL_MARKERS,
  RETENTION_FAILURE_SERIAL_MARKERS,
  FIRST_SESSION_SERIAL_MARKERS,
  serialFirstBootInProgress,
} from "./serial-markers";

/**
 * 081KSNY2Z0008QG0R0008PN7RQ scenario 3 QEMU state-preservation primitives.
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
  /**
   * Network backends for this VM. OMITTED means
   * `DEFAULT_QEMU_NETWORK_DEVICES` -- a single per-VM SLIRP NAT NIC, which is
   * byte-for-byte what this builder emitted before the field existed. Every
   * caller that does not pass it (scenarios 1-4) therefore gets an unchanged
   * command line; only a caller that explicitly asks for a shared L2 segment
   * (scenario 5) sees different args.
   */
  readonly networkDevices?: readonly QemuNetworkDevice[];
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
  HOSTNAME_AUTOGENERATION_SERIAL_MARKERS,
  HOSTNAME_INJECTION_SERIAL_MARKERS,
  INITIAL_INSTALL_SERIAL_MARKERS,
  INSTALLED_OS_RETENTION_SERIAL_MARKERS as RETENTION_SERIAL_MARKERS,
  RETENTION_ABSENT_TERMINAL_MARKERS,
  RETENTION_FAILURE_SERIAL_MARKERS,
  assertHappyPathFirstSessionSerial,
  assertSkipGhFirstSessionSerial,
} from "./serial-markers";

/** Restart phase markers: zflash USB retention when boot image provided; else installed-OS cred-restore. */
export function restartRetentionSerialMarkers(bootImagePath?: string): readonly string[] {
  if (bootImagePath !== undefined) {
    // CI proves cred retention during reinstall (081KSNY2Z0008QG0R0008PN7RQ ESP copy + picker skip) without
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

/**
 * 081KSNY2Z0008QG0R0008PN7RQ scenario 5 -- QEMU network backends.
 *
 * `user-nat` is per-VM SLIRP: it gives one VM outbound NAT and nothing else.
 * Two `user-nat` VMs sit on two DISJOINT networks and cannot address each
 * other at any layer. That -- not sequencing, not disk provisioning -- is why
 * `cluster-joining` could never observe a join: the harness planned a
 * `networkTopology` field that no emitted argument implemented.
 *
 * The `l2-*` backends put VMs on ONE Ethernet segment:
 *
 *   - `l2-socket-listen` / `l2-socket-connect` -- QEMU carries raw L2 frames
 *     over a TCP socket between the two processes. Needs no root, no `tap`
 *     device and no host bridge, so it runs on a stock hosted runner. The
 *     ordering constraint is real and is the caller's to honour: the listener
 *     must be accepting before the connector starts, or the connector exits.
 *   - `l2-multicast` -- order-independent (VMs join the group whenever they
 *     start, in any order) at the cost of depending on host multicast, which
 *     not every CI sandbox delivers.
 *
 * A bridge/tap topology is deliberately NOT offered: creating
 * `zflash-test-br0` requires root on the host, which a hosted runner does not
 * grant. The previously-declared `shared-bridge` topology was undeliverable in
 * the environment this harness has to run in.
 */
export type QemuNetworkBackend =
  | { readonly kind: "user-nat" }
  | { readonly kind: "l2-socket-listen"; readonly port: number }
  | { readonly kind: "l2-socket-connect"; readonly host: string; readonly port: number }
  | { readonly kind: "l2-multicast"; readonly group: string; readonly port: number };

/**
 * One guest NIC: a backend plus the MAC the guest presents.
 *
 * MAC DISCIPLINE -- the reason `mac` is mandatory on every `l2-*` backend:
 * QEMU assigns EVERY guest NIC the same default MAC (52:54:00:12:34:56) when
 * none is given. On disjoint SLIRP networks that is harmless, which is why it
 * has never bitten scenarios 1-4. On a SHARED segment it is a duplicate-MAC
 * collision between the two nodes, and the failure mode is the worst
 * available: both VMs boot cleanly, the segment carries frames, and traffic
 * misroutes silently -- which would surface as an intermittently-failing
 * cluster join and send the reader hunting a k3s bug that is not there.
 * `buildQemuNetworkDeviceArgs` refuses such a plan up front instead.
 */
export interface QemuNetworkDevice {
  readonly id: string;
  readonly backend: QemuNetworkBackend;
  readonly mac?: string;
}

export type QemuNetworkDeviceArgsResult = { readonly ok: readonly string[] } | { readonly error: string };

/**
 * The pre-existing behaviour, now named: one SLIRP NAT NIC on `net0`.
 * `buildQemuSystemBootArgs` falls back to this when no devices are injected,
 * so scenarios 1-4 keep their exact command line.
 */
export const DEFAULT_QEMU_NETWORK_DEVICES: readonly QemuNetworkDevice[] = [
  { id: "net0", backend: { kind: "user-nat" } },
];

const NETDEV_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const MAC_PATTERN = /^[0-9A-Fa-f]{2}(:[0-9A-Fa-f]{2}){5}$/;

function validatePort(port: number, field: string): string | null {
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return `${field} must be an integer in 1..65535 (got ${String(port)})`;
  }
  return null;
}

function validateMac(mac: string): string | null {
  if (!MAC_PATTERN.test(mac)) {
    return `mac "${mac}" is not a 6-octet colon-separated MAC address`;
  }
  const firstOctet = Number.parseInt(mac.slice(0, 2), 16);
  // Bit 0 of the first octet is the I/G bit. A frame source address must be
  // unicast; a NIC configured with a multicast MAC is not a legal sender.
  if ((firstOctet & 0x01) !== 0) {
    return `mac "${mac}" has the multicast bit set; a NIC source address must be unicast`;
  }
  return null;
}

function validateMulticastGroup(group: string): string | null {
  const octets = group.split(".");
  if (octets.length !== 4) {
    return `multicast group "${group}" is not a dotted-quad IPv4 address`;
  }
  const parsed: number[] = [];
  for (const octet of octets) {
    if (!/^[0-9]{1,3}$/.test(octet)) {
      return `multicast group "${group}" is not a dotted-quad IPv4 address`;
    }
    const value = Number.parseInt(octet, 10);
    if (value > 255) {
      return `multicast group "${group}" has an octet above 255`;
    }
    parsed.push(value);
  }
  const first = parsed[0] ?? 0;
  // 224.0.0.0/4 is the IPv4 multicast range (RFC 5771). A unicast address here
  // would make the VMs silently fail to share a segment.
  if (first < 224 || first > 239) {
    return `multicast group "${group}" is outside 224.0.0.0/4`;
  }
  return null;
}

function netdevBackendArg(device: QemuNetworkDevice): { readonly ok: string } | { readonly error: string } {
  const backend = device.backend;
  switch (backend.kind) {
    case "user-nat":
      return { ok: `user,id=${device.id}` };
    case "l2-socket-listen": {
      const portError = validatePort(backend.port, `netdev "${device.id}" listen port`);
      if (portError !== null) {
        return { error: portError };
      }
      return { ok: `socket,id=${device.id},listen=:${String(backend.port)}` };
    }
    case "l2-socket-connect": {
      const portError = validatePort(backend.port, `netdev "${device.id}" connect port`);
      if (portError !== null) {
        return { error: portError };
      }
      if (backend.host.trim().length === 0) {
        return { error: `netdev "${device.id}" connect host is required` };
      }
      return { ok: `socket,id=${device.id},connect=${backend.host}:${String(backend.port)}` };
    }
    case "l2-multicast": {
      const portError = validatePort(backend.port, `netdev "${device.id}" multicast port`);
      if (portError !== null) {
        return { error: portError };
      }
      const groupError = validateMulticastGroup(backend.group);
      if (groupError !== null) {
        return { error: `netdev "${device.id}": ${groupError}` };
      }
      return { ok: `socket,id=${device.id},mcast=${backend.group}:${String(backend.port)}` };
    }
  }
}

/**
 * Build the netdev plus device argument pairs for one VM's NICs.
 *
 * Result-shaped rather than throwing, so a caller assembling a multi-VM plan
 * turns a bad segment into typed feedback instead of an exception.
 */
export function buildQemuNetworkDeviceArgs(devices: readonly QemuNetworkDevice[]): QemuNetworkDeviceArgsResult {
  if (devices.length === 0) {
    return { error: "at least one network device is required" };
  }

  const seenIds = new Set<string>();
  const seenMacs = new Set<string>();
  const args: string[] = [];

  for (const device of devices) {
    if (!NETDEV_ID_PATTERN.test(device.id)) {
      return { error: `netdev id "${device.id}" must be alphanumeric with optional _ or - separators` };
    }
    if (seenIds.has(device.id)) {
      return { error: `netdev id "${device.id}" is used more than once` };
    }
    seenIds.add(device.id);

    const isL2 = device.backend.kind !== "user-nat";
    if (isL2 && device.mac === undefined) {
      // See the MAC DISCIPLINE note on QemuNetworkDevice: the QEMU default MAC
      // is a constant, so two shared-segment VMs would collide.
      return {
        error:
          `netdev "${device.id}" is on a shared L2 segment and must declare an explicit mac -- ` +
          "QEMU defaults every NIC to 52:54:00:12:34:56, which collides on a shared segment",
      };
    }

    if (device.mac !== undefined) {
      const macError = validateMac(device.mac);
      if (macError !== null) {
        return { error: `netdev "${device.id}": ${macError}` };
      }
      const normalized = device.mac.toLowerCase();
      if (seenMacs.has(normalized)) {
        return { error: `mac "${device.mac}" is assigned to more than one netdev` };
      }
      seenMacs.add(normalized);
    }

    const backendArg = netdevBackendArg(device);
    if ("error" in backendArg) {
      return { error: backendArg.error };
    }

    args.push("-netdev", backendArg.ok);
    args.push(
      "-device",
      device.mac === undefined
        ? `virtio-net-pci,netdev=${device.id}`
        : `virtio-net-pci,netdev=${device.id},mac=${device.mac}`,
    );
  }

  return { ok: args };
}

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
  ];

  const network = buildQemuNetworkDeviceArgs(input.networkDevices ?? DEFAULT_QEMU_NETWORK_DEVICES);
  if ("error" in network) {
    throw new Error(network.error);
  }
  args.push(...network.ok);

  if (input.bootMedia.kind === "usb-image") {
    const usb = qemuUsbStorageDeviceArg("zflashboot");
    if (!usb.ok) {
      throw new Error(usb.error);
    }
    args.push(
      "-drive",
      `file=${input.bootMedia.path},if=none,format=raw,readonly=on,id=zflashboot`,
      "-device",
      "qemu-xhci,id=xhci",
      "-device",
      usb.device,
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
          `If install is progressing on tty1 only, ensure zeta-first-boot mirrors to /dev/ttyS0 (081KSNY2Z0008QG0R0008PN7RQ).`,
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

/** Phase-3 post-login proof: first-session adventure reached completion on serial. */
export function assertFirstSessionSerialMarkers(
  serialOutput: string,
  requiredMarkers: readonly string[] = FIRST_SESSION_SERIAL_MARKERS,
): RetentionSerialMarkerResult {
  return assertRetentionSerialMarkers(serialOutput, requiredMarkers);
}

/** QEMU-testable proof that zeta-install consumed /zeta-hostname.txt from the ESP. */
export function assertHostnameInjectionSerialMarkers(
  serialOutput: string,
  requiredMarkers: readonly string[] = HOSTNAME_INJECTION_SERIAL_MARKERS,
): RetentionSerialMarkerResult {
  return assertRetentionSerialMarkers(serialOutput, requiredMarkers);
}

/** QEMU-testable proof that zeta-install generated a hostname when no ESP hostname was present. */
export function assertHostnameAutogenerationSerialMarkers(
  serialOutput: string,
  requiredMarkers: readonly string[] = HOSTNAME_AUTOGENERATION_SERIAL_MARKERS,
): RetentionSerialMarkerResult {
  return assertRetentionSerialMarkers(serialOutput, requiredMarkers);
}
