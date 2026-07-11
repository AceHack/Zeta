import { join } from "node:path";
import { PHASE_CLOCK_BASIS, PHASE_CLOCK_SCHEMA, type PhaseClockReadout } from "../darkhall-ui/darkhall-tv";
import type { ReplayStats } from "./llmtv-replay";

export const ROOT_SITE_LLMTV_STATUS_SCHEMA = "zeta.llmtv.root-site-status.v1";
export const ROOT_SITE_LLMTV_STATUS_RELATIVE_PATH = "data/llmtv-live.status.json";

export type RootSiteLlmtvStatusKind = "live" | "cold" | "stale" | "heat";
export type RootSiteLlmtvStatusChannel = "live-mesh" | "room-transcript" | "static-reader";

export interface RootSiteLlmtvStatus {
  readonly schema: typeof ROOT_SITE_LLMTV_STATUS_SCHEMA;
  readonly seed: string;
  readonly generatedBy: string;
  readonly channel: RootSiteLlmtvStatusChannel;
  readonly writtenAtMs: number;
  readonly replayPath: string;
  readonly htmlPath: string;
  readonly status: RootSiteLlmtvStatusKind;
  readonly reason: string;
  readonly frames: number;
  readonly dwellers: number;
  readonly stats: ReplayStats;
  readonly phaseClock?: PhaseClockReadout;
  readonly lastFrameAgeMs?: number;
}

export interface RootSiteLlmtvStatusInput {
  readonly seed: string;
  readonly generatedBy: string;
  readonly channel: RootSiteLlmtvStatusChannel;
  readonly writtenAtMs: number;
  readonly replayPath: string;
  readonly htmlPath: string;
  readonly status: RootSiteLlmtvStatusKind;
  readonly reason: string;
  readonly frames: number;
  readonly dwellers: number;
  readonly stats: ReplayStats;
  readonly phaseClock?: PhaseClockReadout;
  readonly lastFrameAgeMs?: number;
}

function joinRelative(rootDir: string, relativePath: string): string {
  return join(rootDir, ...relativePath.split("/"));
}

export function rootSiteLlmtvStatusPath(rootDir: string): string {
  return joinRelative(rootDir, ROOT_SITE_LLMTV_STATUS_RELATIVE_PATH);
}

export function rootSiteLlmtvStatus(input: RootSiteLlmtvStatusInput): RootSiteLlmtvStatus {
  const base = {
    schema: ROOT_SITE_LLMTV_STATUS_SCHEMA,
    seed: input.seed,
    generatedBy: input.generatedBy,
    channel: input.channel,
    writtenAtMs: input.writtenAtMs,
    replayPath: input.replayPath,
    htmlPath: input.htmlPath,
    status: input.status,
    reason: input.reason,
    frames: input.frames,
    dwellers: input.dwellers,
    stats: input.stats,
  } satisfies Omit<RootSiteLlmtvStatus, "phaseClock" | "lastFrameAgeMs">;

  const withPhase = input.phaseClock === undefined ? base : { ...base, phaseClock: input.phaseClock };
  return input.lastFrameAgeMs === undefined ? withPhase : { ...withPhase, lastFrameAgeMs: input.lastFrameAgeMs };
}

export function encodeRootSiteLlmtvStatus(status: RootSiteLlmtvStatus): string {
  return `${JSON.stringify(status, null, 2)}\n`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function decodeStats(value: unknown): ReplayStats | null {
  const record = asRecord(value);
  if (
    record === null ||
    !finiteNumber(record.accepted) ||
    !finiteNumber(record.rejected) ||
    !finiteNumber(record.expired)
  ) {
    return null;
  }

  return {
    accepted: record.accepted,
    rejected: record.rejected,
    expired: record.expired,
  };
}

function decodeStatusKind(value: unknown): RootSiteLlmtvStatusKind | null {
  return value === "live" || value === "cold" || value === "stale" || value === "heat" ? value : null;
}

function decodeChannel(value: unknown): RootSiteLlmtvStatusChannel | null {
  return value === "live-mesh" || value === "room-transcript" || value === "static-reader" ? value : null;
}

function decodePhaseClock(value: unknown): PhaseClockReadout | null {
  const record = asRecord(value);
  if (
    record === null ||
    record.schema !== PHASE_CLOCK_SCHEMA ||
    typeof record.source !== "string" ||
    record.basis !== PHASE_CLOCK_BASIS ||
    typeof record.seed !== "string" ||
    !finiteNumber(record.phase) ||
    !finiteNumber(record.skewBoundTicks) ||
    typeof record.appendOnly !== "boolean" ||
    !finiteNumber(record.travelers)
  ) {
    return null;
  }

  return {
    schema: PHASE_CLOCK_SCHEMA,
    source: record.source,
    basis: PHASE_CLOCK_BASIS,
    seed: record.seed,
    phase: record.phase,
    skewBoundTicks: record.skewBoundTicks,
    appendOnly: record.appendOnly,
    travelers: record.travelers,
  };
}

export function decodeRootSiteLlmtvStatus(text: string): RootSiteLlmtvStatus | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  const record = asRecord(parsed);
  const stats = decodeStats(record?.stats);
  const status = decodeStatusKind(record?.status);
  const channel = decodeChannel(record?.channel);
  const phaseClock = record?.phaseClock === undefined ? undefined : decodePhaseClock(record.phaseClock);

  if (
    record === null ||
    record.schema !== ROOT_SITE_LLMTV_STATUS_SCHEMA ||
    typeof record.seed !== "string" ||
    typeof record.generatedBy !== "string" ||
    channel === null ||
    !finiteNumber(record.writtenAtMs) ||
    typeof record.replayPath !== "string" ||
    typeof record.htmlPath !== "string" ||
    status === null ||
    typeof record.reason !== "string" ||
    !finiteNumber(record.frames) ||
    !finiteNumber(record.dwellers) ||
    stats === null ||
    phaseClock === null
  ) {
    return null;
  }

  const base = rootSiteLlmtvStatus({
    seed: record.seed,
    generatedBy: record.generatedBy,
    channel,
    writtenAtMs: record.writtenAtMs,
    replayPath: record.replayPath,
    htmlPath: record.htmlPath,
    status,
    reason: record.reason,
    frames: record.frames,
    dwellers: record.dwellers,
    stats,
    ...(phaseClock === undefined ? {} : { phaseClock }),
  });

  if (record.lastFrameAgeMs === undefined) {
    return base;
  }

  return finiteNumber(record.lastFrameAgeMs) ? { ...base, lastFrameAgeMs: record.lastFrameAgeMs } : null;
}
