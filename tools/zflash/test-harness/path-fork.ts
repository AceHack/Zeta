/**
 * B-0891 scenario 4 QEMU path-fork primitives.
 *
 * Scenario 4 starts from the same baseline disk and tests two operator
 * choices: migrate existing credentials to a new USB, or wipe and start a
 * fresh cluster. This module makes that fork executable as a structured
 * QEMU plan while keeping the dispatcher fail-closed until a process
 * executor and identity comparison proof consume the plan.
 */

import {
  DEFAULT_PATH_FORK,
  type PathForkVariant,
} from "./extensions";
import {
  INITIAL_INSTALL_SERIAL_MARKERS,
  RETENTION_ABSENT_TERMINAL_MARKERS,
  RETENTION_FAILURE_SERIAL_MARKERS,
  buildQemuSystemBootArgs,
  type QemuCommand,
  type QemuSerialStopCondition,
} from "./qemu-state";

export type PathForkId = PathForkVariant["forkId"];

export interface PathForkRuntimeInput {
  readonly isoPath: string;
  readonly bootImagePath?: string;
  readonly startingDiskPath: string;
  readonly migrateSerialLogPath: string;
  readonly freshSerialLogPath: string;
  readonly snapshotName?: string;
  readonly memoryMB?: number;
  readonly cpuCount?: number;
  readonly kvmAvailable?: boolean;
}

export interface PathForkRuntimeForkPlan {
  readonly forkId: PathForkId;
  readonly forkName: string;
  readonly restoreStartingState: QemuCommand;
  readonly qemuBootCommand?: QemuCommand;
  readonly stopCondition: QemuSerialStopCondition;
  readonly requiredSerialMarkers: readonly string[];
  readonly forbiddenSerialMarkers: readonly string[];
  readonly missingRuntimeRequirements: readonly string[];
  readonly expectedOutcome: string;
}

export interface PathForkRuntimePlan {
  readonly isoPath: string;
  readonly bootImagePath?: string;
  readonly startingStateRef: string;
  readonly startingDiskPath: string;
  readonly snapshotName: string;
  readonly comparisonStrategy: typeof DEFAULT_PATH_FORK.comparisonStrategy;
  readonly forks: readonly PathForkRuntimeForkPlan[];
}

export type PathForkRuntimeFeedback =
  | {
      readonly kind: "invalid-input";
      readonly field: keyof PathForkRuntimeInput;
      readonly reason: string;
    };

export type PathForkRuntimeResult =
  | { readonly ok: PathForkRuntimePlan }
  | { readonly error: PathForkRuntimeFeedback };

export interface PathForkSerialMarkerAssertion {
  readonly forkId: PathForkId;
  readonly matchedRequiredMarkers: readonly string[];
  readonly absentForbiddenMarkers: readonly string[];
}

export type PathForkSerialMarkerFeedback =
  | {
      readonly kind: "missing-serial-markers";
      readonly forkId: PathForkId;
      readonly missingMarkers: readonly string[];
      readonly requiredMarkers: readonly string[];
    }
  | {
      readonly kind: "forbidden-serial-markers-present";
      readonly forkId: PathForkId;
      readonly presentMarkers: readonly string[];
      readonly forbiddenMarkers: readonly string[];
    };

export type PathForkSerialMarkerResult =
  | { readonly ok: PathForkSerialMarkerAssertion }
  | { readonly error: PathForkSerialMarkerFeedback };

const DEFAULT_MEMORY_MB = 4096;
const DEFAULT_CPU_COUNT = 2;
const DEFAULT_SNAPSHOT_NAME = "post-initial-format";

export const MIGRATE_EXISTING_CREDS_SERIAL_MARKERS: readonly string[] = [
  "[B-0891-retention]   found pre-baked zeta-creds.enc on boot USB ESP",
  "[B-0891-retention]   Step 6.95-picker will skip account re-entry",
];

export const FRESH_CLUSTER_SERIAL_MARKERS: readonly string[] = [
  "[B-0891-retention]   no pre-baked zeta-creds.enc on boot USB ESP; Step 6.95-picker remains normal",
];

function nonEmpty(value: string): boolean {
  return value.trim().length > 0;
}

function positiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function validateInput(input: PathForkRuntimeInput): PathForkRuntimeFeedback | null {
  if (!nonEmpty(input.isoPath)) {
    return { kind: "invalid-input", field: "isoPath", reason: "ISO path is required" };
  }
  if (input.bootImagePath !== undefined && !nonEmpty(input.bootImagePath)) {
    return { kind: "invalid-input", field: "bootImagePath", reason: "boot image path must be non-empty when provided" };
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

interface NormalizedPathForkRuntimeInput {
  readonly isoPath: string;
  readonly bootImagePath?: string;
  readonly startingDiskPath: string;
  readonly migrateSerialLogPath: string;
  readonly freshSerialLogPath: string;
  readonly snapshotName: string;
  readonly memoryMB: number;
  readonly cpuCount: number;
  readonly kvmAvailable: boolean;
}

function requiredMarkers(forkId: PathForkId): readonly string[] {
  return [
    ...INITIAL_INSTALL_SERIAL_MARKERS,
    ...(forkId === "migrate-existing-creds"
      ? MIGRATE_EXISTING_CREDS_SERIAL_MARKERS
      : FRESH_CLUSTER_SERIAL_MARKERS),
  ];
}

function forbiddenMarkers(forkId: PathForkId): readonly string[] {
  return forkId === "migrate-existing-creds"
    ? FRESH_CLUSTER_SERIAL_MARKERS
    : MIGRATE_EXISTING_CREDS_SERIAL_MARKERS;
}

function serialLogPathForFork(input: NormalizedPathForkRuntimeInput, forkId: PathForkId): string {
  return forkId === "migrate-existing-creds"
    ? input.migrateSerialLogPath
    : input.freshSerialLogPath;
}

function bootCommandForFork(
  input: NormalizedPathForkRuntimeInput,
  forkId: PathForkId,
): QemuCommand | undefined {
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
      bootMedia: { kind: "iso", path: input.isoPath },
    }),
  };
}

function missingRequirementsForFork(input: NormalizedPathForkRuntimeInput, forkId: PathForkId): readonly string[] {
  if (forkId === "migrate-existing-creds" && input.bootImagePath === undefined) {
    return ["zflash-prepared boot image containing /zeta-creds.enc"];
  }
  return [];
}

function forkPlan(input: NormalizedPathForkRuntimeInput, fork: PathForkVariant): PathForkRuntimeForkPlan {
  const serialLogPath = serialLogPathForFork(input, fork.forkId);
  const forkRequiredMarkers = requiredMarkers(fork.forkId);
  const forkForbiddenMarkers = forbiddenMarkers(fork.forkId);
  const qemuBootCommand = bootCommandForFork(input, fork.forkId);

  return {
    forkId: fork.forkId,
    forkName: fork.forkName,
    restoreStartingState: {
      bin: "qemu-img",
      args: ["snapshot", "-a", input.snapshotName, input.startingDiskPath],
    },
    ...(qemuBootCommand === undefined
      ? {}
      : { qemuBootCommand }),
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

export function planPathForkRuntime(input: PathForkRuntimeInput): PathForkRuntimeResult {
  const invalid = validateInput(input);
  if (invalid) {
    return { error: invalid };
  }

  const normalized: NormalizedPathForkRuntimeInput = {
    isoPath: input.isoPath,
    ...(input.bootImagePath === undefined ? {} : { bootImagePath: input.bootImagePath }),
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
      startingStateRef: DEFAULT_PATH_FORK.startingStateRef,
      startingDiskPath: normalized.startingDiskPath,
      snapshotName: normalized.snapshotName,
      comparisonStrategy: DEFAULT_PATH_FORK.comparisonStrategy,
      forks: DEFAULT_PATH_FORK.forks.map((fork) => forkPlan(normalized, fork)),
    },
  };
}

export function assertPathForkSerialMarkers(
  forkPlan: PathForkRuntimeForkPlan,
  serialOutput: string,
): PathForkSerialMarkerResult {
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
