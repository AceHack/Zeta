/**
 * 081KSNY2Z0008QG0R0008PN7RQ scenario 5 QEMU multi-VM primitives.
 *
 * Scenario 5 (cluster-joining) requires running two QEMU VMs simultaneously:
 * one existing cluster node (cluster-existing) and one joining node
 * (joining-node) connected by a shared virtual network. This module makes
 * that topology planning and coordination executable.
 */

import { DEFAULT_MULTI_VM, type NetworkTopology, type VMSpec } from "./extensions";
import {
  DEFAULT_JOINER_FLAKE_HOST,
  ZETA_JOIN_TOKEN_ESP_DESTINATION,
  type ZetaFirstbootRole,
} from "../firstboot-role";
import { clusterJoinServerUrl } from "../cluster-address";
import { B0891_CLUSTER_JOIN_SERIAL_MARKERS } from "./serial-markers";
import {
  RETENTION_ABSENT_TERMINAL_MARKERS,
  RETENTION_FAILURE_SERIAL_MARKERS,
  buildQemuSystemBootArgs,
  DEFAULT_QEMU_NETWORK_DEVICES,
  type QemuNetworkDevice,
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

/**
 * The hostname the scenario-5 existing node must install under, and therefore
 * the name the joining node dials.
 *
 * Load-bearing and easy to get wrong: `zeta-install.sh` GENERATES a random
 * `node-<6hex>` hostname when no `zeta-hostname.txt` is on the ESP (the
 * iter-5.2.2 path, added so one USB could install many machines). A joiner
 * pointed at a name the founder never took would dial nothing. So the
 * existing node must be flashed with `--host control-plane`, and this
 * constant is the single place both halves read that from.
 *
 * A BARE LABEL, not `.local` — corrected 2026-08-17 with the
 * `joining-node-address-assignment` blocker. The `.local` form was chosen
 * because mDNS was the only name service on the segment, and it was wrong on
 * both halves:
 *
 *   - It may not resolve. `k3s-server.nix` records that mDNS was already tried
 *     ("`control-plane.zeta.local` … never resolved") on this stack.
 *   - Worse, if it DID resolve the handshake would still fail:
 *     `k3s-server.nix` ships exactly one name SAN, `--tls-san=control-plane`,
 *     so `control-plane.local` is a name the API certificate does not cover.
 *     `nixos/tests/k3s-agent-join.nix` records that removing that SAN makes
 *     the join fail on certificate verification, so the check is real.
 *
 * Resolution now comes from static addressing carried on the medium
 * (`cluster-address.ts`) plus an injected `/etc/hosts` entry — the mechanism
 * `k3s-agent-join.nix` already supplies by hand and calls "still open" on
 * hardware. No DHCP, no DNS, no mDNS in the path.
 *
 * UNVERIFIED: no frame has crossed that segment. This is derived from the
 * committed guest configuration, not observed.
 */
export const SCENARIO5_EXISTING_NODE_HOSTNAME = "control-plane";
export const SCENARIO5_JOIN_SERVER_URL = clusterJoinServerUrl();

/**
 * Per-VM MACs for the shared segment. Distinct by construction: QEMU would
 * otherwise give both nodes 52:54:00:12:34:56 and the segment would carry two
 * NICs claiming one address. Locally administered (bit 1 of octet 0 set) and
 * unicast (bit 0 clear), so they cannot collide with a real vendor NIC.
 *
 * Declared here rather than beside the netdev builder because
 * `scenario5FirstbootRole` also reads them: the address written to the MEDIUM
 * and the MAC pinned on the COMMAND LINE have to be the same two constants or
 * the static address lands on the wrong NIC.
 */
const CLUSTER_EXISTING_SEGMENT_MAC = "52:54:00:7a:f1:01";
const JOINING_NODE_SEGMENT_MAC = "52:54:00:7a:f1:02";

/**
 * The firstboot role each scenario-5 VM's medium must carry.
 *
 * Pure function of the VM's declared role, so the mapping is checkable
 * without QEMU: the existing node founds the cluster, the joining node joins
 * it and expects its k3s node-token at the ESP path zflash writes.
 */
export function scenario5FirstbootRole(role: VMSpec["role"]): ZetaFirstbootRole {
  if (role === "cluster-existing") {
    return {
      kind: "first-control-plane",
      flakeHost: SCENARIO5_EXISTING_NODE_HOSTNAME,
      // The MAC is the SAME constant the QEMU command line pins below. That
      // identity is the whole mechanism: the medium says "configure the NIC
      // with this MAC", and QEMU is what gives a NIC that MAC. Reading them
      // from two places would let the segment be addressed on the NAT NIC.
      clusterSegment: { segmentNicMac: CLUSTER_EXISTING_SEGMENT_MAC },
    };
  }
  return {
    kind: "joiner",
    flakeHost: DEFAULT_JOINER_FLAKE_HOST,
    serverUrl: SCENARIO5_JOIN_SERVER_URL,
    tokenEspPath: ZETA_JOIN_TOKEN_ESP_DESTINATION,
    clusterSegment: { segmentNicMac: JOINING_NODE_SEGMENT_MAC },
  };
}

export interface MultiVMRuntimeVMPlan {
  readonly name: string;
  readonly role: VMSpec["role"];
  /**
   * What the VM's boot medium must be flashed with for this plan to mean what
   * it says. Carried on the plan rather than left implicit so that "the
   * joining node is a joiner" is a value a test can assert, not a hope.
   */
  readonly firstbootRole: ZetaFirstbootRole;
  readonly restoreStartingState?: QemuCommand;
  readonly qemuBootCommand?: QemuCommand;
  readonly stopCondition: QemuSerialStopCondition;
  readonly requiredSerialMarkers: readonly string[];
  readonly missingRuntimeRequirements: readonly string[];
}

export interface MultiVMRuntimePlan {
  readonly isoPath: string;
  readonly bootImagePath?: string;
  readonly networkTopology: NetworkTopology;
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

/** NIC ids: net0 keeps outbound NAT, net1 is the cluster segment. */
const NAT_NETDEV_ID = "net0";
const SEGMENT_NETDEV_ID = "net1";

/**
 * The two NICs a scenario-5 VM gets.
 *
 * net0 stays SLIRP NAT so the guest keeps outbound reachability exactly as it
 * had before. net1 is the shared L2 segment the two VMs meet on: the existing
 * cluster node LISTENS and the joining node CONNECTS, which fixes a real
 * ordering obligation on the executor -- the listener must be accepting before
 * the connector starts or QEMU exits immediately on the connect side. That
 * obligation is why `concurrent-vm-lifecycle` has to clear before this
 * topology can carry a single frame.
 */
function segmentNetworkDevices(role: VMSpec["role"], topology: NetworkTopology): readonly QemuNetworkDevice[] {
  if (topology.kind !== "shared-socket-segment") {
    return DEFAULT_QEMU_NETWORK_DEVICES;
  }
  const nat: QemuNetworkDevice = { id: NAT_NETDEV_ID, backend: { kind: "user-nat" } };
  if (role === "cluster-existing") {
    return [
      nat,
      {
        id: SEGMENT_NETDEV_ID,
        backend: { kind: "l2-socket-listen", port: topology.port },
        mac: CLUSTER_EXISTING_SEGMENT_MAC,
      },
    ];
  }
  return [
    nat,
    {
      id: SEGMENT_NETDEV_ID,
      backend: { kind: "l2-socket-connect", host: topology.host, port: topology.port },
      mac: JOINING_NODE_SEGMENT_MAC,
    },
  ];
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

  const networkTopology = DEFAULT_MULTI_VM.networkTopology;

  const vms = DEFAULT_MULTI_VM.vms.map((vmSpec): MultiVMRuntimeVMPlan => {
    const isExisting = vmSpec.role === "cluster-existing";
    const networkDevices = segmentNetworkDevices(vmSpec.role, networkTopology);
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

    const firstbootRole = scenario5FirstbootRole(vmSpec.role);

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
          networkDevices,
        }),
      };
    } else {
      if (normalized.bootImagePath === undefined) {
        // Names the role, not just "credentials": the medium has to carry
        // `/zeta-firstboot.conf` with `ZETA_ROLE=joiner` and
        // `HOST=worker-template`, or the VM installs a second control plane
        // and runs no agent — which is the failure this plan exists to stop.
        const tokenSource =
          DEFAULT_MULTI_VM.joinProtocol.kind === "explicit-join-token"
            ? DEFAULT_MULTI_VM.joinProtocol.tokenSource
            : "the existing node's k3s node-token";
        // The MAC is in the instruction because without it the medium carries
        // no address, and the segment has no DHCP to supply one — an image
        // flashed from the shorter command would boot, know it is a joiner,
        // and have no way to reach the founder.
        missingRuntimeRequirements.push(
          `zflash-prepared boot image flashed with --role joiner ` +
            `--join-server-url ${SCENARIO5_JOIN_SERVER_URL} ` +
            `--join-token <k3s node-token from ${tokenSource} on the existing node> ` +
            `--cluster-segment-mac ${JOINING_NODE_SEGMENT_MAC}`,
        );
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
            networkDevices,
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
      firstbootRole,
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
