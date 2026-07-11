// llmtv-live-readout -- cadence sink from live replay bridge to artifact/page.
//
// The mesh runner owns sockets. The bridge owns capture. This module owns the readout tick:
// drain the captured wires, write the replay artifact, and render the zero-JS LLMTV page.

import {
  renderLlmtvDocument,
  type LlmtvReadoutStatus,
  type PhaseClockReadout,
  type RenderDocumentOptions,
} from "../darkhall-ui/darkhall-tv";
import type { LlmtvLiveReplayBridge } from "./llmtv-live-replay-bridge";
import {
  encodeReplayArtifact,
  REPLAY_SCHEMA,
  type ReplayArtifact,
  type ReplayStats,
  type ReplayWireFrame,
} from "./llmtv-replay";
import {
  decode,
  encode,
  expireChannels,
  observeBroadcast,
  phaseClockForFrame,
  toLlmtvTranscript,
  type BroadcastMessage,
  type Channel,
  type ChannelTable,
} from "./llmtv-broadcast";
import type { Scheduler } from "./llmtv-node";
import { encodeRootSiteLlmtvStatus, rootSiteLlmtvStatus, type RootSiteLlmtvStatusKind } from "./llmtv-root-site-status";

export interface LlmtvLiveReadoutIo {
  readonly writeText: (path: string, text: string) => void;
}

export interface LlmtvLiveReadoutOptions {
  readonly seed: string;
  readonly readoutEveryMs: number;
  readonly replayPath: string;
  readonly htmlPath: string;
  readonly statusPath?: string;
  readonly generatedBy?: string;
  readonly title?: string;
  readonly expireTtlMs?: number;
  readonly skipEmpty?: boolean;
}

export interface LlmtvLiveReadoutSummary {
  readonly atMs: number;
  readonly replayPath: string;
  readonly htmlPath: string;
  readonly statusPath?: string;
  readonly frames: number;
  readonly dwellers: number;
  readonly status: RootSiteLlmtvStatusKind;
  readonly reason: string;
  readonly stats: ReplayStats;
  readonly phaseClock?: PhaseClockReadout;
}

export type LlmtvLiveReadoutFlushResult =
  | { readonly ok: true; readonly skipped: false; readonly summary: LlmtvLiveReadoutSummary }
  | { readonly ok: true; readonly skipped: true; readonly reason: "empty" }
  | { readonly ok: false; readonly reason: "write-failed"; readonly error: string };

export interface LlmtvLiveReadout {
  start(): void;
  stop(): void;
  flushNow(): LlmtvLiveReadoutFlushResult;
  lastSummary(): LlmtvLiveReadoutSummary | undefined;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function renderOptions(
  options: LlmtvLiveReadoutOptions,
  readoutStatus: LlmtvReadoutStatus | undefined,
): RenderDocumentOptions {
  const base = options.title === undefined ? {} : { title: options.title };
  return readoutStatus === undefined ? base : { ...base, readoutStatus };
}

function generatedBy(options: LlmtvLiveReadoutOptions): string {
  return options.generatedBy ?? "llmtv-live-readout";
}

function shouldSkipEmpty(options: LlmtvLiveReadoutOptions): boolean {
  return options.skipEmpty ?? true;
}

function withGeneratedBy(transcript: ReturnType<typeof toLlmtvTranscript>, options: LlmtvLiveReadoutOptions) {
  return { ...transcript, generatedBy: generatedBy(options) };
}

function observeFrames(
  table: ChannelTable,
  frames: readonly ReplayWireFrame[],
): { readonly table: ChannelTable; readonly accepted: number; readonly rejected: number } {
  let next = table;
  let accepted = 0;
  let rejected = 0;

  for (const frame of frames) {
    const message = decode(frame.wire);
    if (message === null) {
      rejected++;
    } else {
      next = observeBroadcast(next, message, frame.receivedAtMs);
      accepted++;
    }
  }

  return { table: next, accepted, rejected };
}

function expireTable(
  table: ChannelTable,
  expire: ReplayArtifact["expire"],
): { readonly table: ChannelTable; readonly expired: number } {
  if (expire === undefined) {
    return { table, expired: 0 };
  }

  const before = table.size;
  const next = expireChannels(table, expire.nowMs, expire.ttlMs);
  return { table: next, expired: before - next.size };
}

function frameFromChannel(channel: Channel, seed: string): ReplayWireFrame {
  const message = {
    t: "frame",
    source: channel.source,
    seq: channel.seq,
    frameNo: channel.frameNo,
    mind: channel.mind,
    phaseClock:
      channel.phaseClock?.seed === seed
        ? channel.phaseClock
        : phaseClockForFrame(channel.phaseClock?.source ?? channel.source.zid, seed, channel.frameNo),
  } satisfies BroadcastMessage;

  return {
    receivedAtMs: channel.lastSeenMs,
    wire: encode(message),
    from: channel.source.zid,
  };
}

function snapshotFrames(table: ChannelTable, seed: string): ReplayWireFrame[] {
  return Array.from(table.values())
    .sort((left, right) => (left.source.zid < right.source.zid ? -1 : left.source.zid > right.source.zid ? 1 : 0))
    .map((channel) => frameFromChannel(channel, seed));
}

function snapshotArtifact(
  table: ChannelTable,
  options: LlmtvLiveReadoutOptions,
  expire: ReplayArtifact["expire"],
): ReplayArtifact {
  const base = {
    schema: REPLAY_SCHEMA,
    seed: options.seed,
    frames: snapshotFrames(table, options.seed),
  } satisfies Pick<ReplayArtifact, "schema" | "seed" | "frames">;

  const withGenerator = { ...base, generatedBy: generatedBy(options) };
  return expire === undefined ? withGenerator : { ...withGenerator, expire };
}

function statusKind(frames: number, dwellers: number, stats: ReplayStats): RootSiteLlmtvStatusKind {
  if (stats.rejected > 0 || stats.expired > 0) return "heat";
  if (frames === 0 || dwellers === 0) return "cold";
  return "live";
}

function statusReason(status: RootSiteLlmtvStatusKind): string {
  if (status === "heat") return "replay-heat";
  if (status === "cold") return "empty";
  return "live";
}

function phaseMetrics(phaseClock: PhaseClockReadout | undefined): LlmtvReadoutStatus["metrics"] {
  if (phaseClock === undefined) return [];
  return [
    { label: "phase", value: phaseClock.phase },
    { label: "skew", value: phaseClock.skewBoundTicks },
    { label: "travelers", value: phaseClock.travelers },
  ];
}

function readoutStatus(summary: LlmtvLiveReadoutSummary): LlmtvReadoutStatus {
  const label =
    summary.status === "live"
      ? "live · mesh readout"
      : summary.status === "heat"
        ? "heat · replay fold"
        : "cold · no channels";
  const detail =
    summary.status === "live"
      ? "The live mesh fold is current and phase-stamped; the browser only reads the rendered artifact."
      : summary.status === "heat"
        ? "The live fold reported rejected or expired evidence. Phase is shown only for the surviving rows."
        : "No live channels were available on this readout tick.";
  const heatSignals = summary.status === "heat" ? (["denied"] as const) : undefined;

  return {
    kind: summary.status,
    label,
    detail,
    source: summary.statusPath ?? summary.replayPath,
    metrics: [
      { label: "frames", value: summary.frames },
      { label: "dwellers", value: summary.dwellers },
      { label: "accepted", value: summary.stats.accepted },
      { label: "rejected", value: summary.stats.rejected },
      { label: "expired", value: summary.stats.expired },
      ...phaseMetrics(summary.phaseClock),
    ],
    ...(heatSignals === undefined ? {} : { heatSignals }),
  };
}

function encodeStatus(summary: LlmtvLiveReadoutSummary, options: LlmtvLiveReadoutOptions): string {
  return encodeRootSiteLlmtvStatus(
    rootSiteLlmtvStatus({
      seed: options.seed,
      generatedBy: generatedBy(options),
      channel: "live-mesh",
      writtenAtMs: summary.atMs,
      replayPath: summary.replayPath,
      htmlPath: summary.htmlPath,
      status: summary.status,
      reason: summary.reason,
      frames: summary.frames,
      dwellers: summary.dwellers,
      stats: summary.stats,
      ...(summary.phaseClock === undefined ? {} : { phaseClock: summary.phaseClock }),
    }),
  );
}

export function createLlmtvLiveReadout(
  bridge: LlmtvLiveReplayBridge,
  scheduler: Scheduler,
  io: LlmtvLiveReadoutIo,
  options: LlmtvLiveReadoutOptions,
): LlmtvLiveReadout {
  let cancel: (() => void) | undefined;
  let last: LlmtvLiveReadoutSummary | undefined;
  let table: ChannelTable = new Map();

  const flushNow = (): LlmtvLiveReadoutFlushResult => {
    const atMs = scheduler.now();
    const expire = options.expireTtlMs === undefined ? undefined : { nowMs: atMs, ttlMs: options.expireTtlMs };
    const captured = bridge.artifact({ seed: options.seed, generatedBy: generatedBy(options) });
    const observed = observeFrames(table, captured.frames);
    const expired = expireTable(observed.table, expire);

    if (captured.frames.length === 0 && expired.expired === 0 && shouldSkipEmpty(options)) {
      return { ok: true, skipped: true, reason: "empty" };
    }

    const artifact = snapshotArtifact(expired.table, options, expire);
    const transcript = withGeneratedBy(toLlmtvTranscript(expired.table, options.seed), options);
    const stats = {
      accepted: observed.accepted,
      rejected: observed.rejected,
      expired: expired.expired,
    };
    const status = statusKind(artifact.frames.length, transcript.dwellers.length, stats);
    const summary = {
      atMs,
      replayPath: options.replayPath,
      htmlPath: options.htmlPath,
      ...(options.statusPath === undefined ? {} : { statusPath: options.statusPath }),
      frames: artifact.frames.length,
      dwellers: transcript.dwellers.length,
      status,
      reason: statusReason(status),
      stats,
      ...(transcript.phaseClock === undefined ? {} : { phaseClock: transcript.phaseClock }),
    } satisfies LlmtvLiveReadoutSummary;
    const html = renderLlmtvDocument(transcript, renderOptions(options, readoutStatus(summary)));

    try {
      io.writeText(options.replayPath, encodeReplayArtifact(artifact));
      io.writeText(options.htmlPath, `${html}\n`);
      if (options.statusPath !== undefined) {
        io.writeText(options.statusPath, encodeStatus(summary, options));
      }
    } catch (error) {
      return { ok: false, reason: "write-failed", error: errorMessage(error) };
    }

    table = expired.table;
    bridge.recorder.clear();
    last = summary;
    return { ok: true, skipped: false, summary: last };
  };

  return {
    start() {
      if (cancel === undefined) {
        cancel = scheduler.setInterval(options.readoutEveryMs, () => {
          flushNow();
        });
      }
    },
    stop() {
      cancel?.();
      cancel = undefined;
    },
    flushNow,
    lastSummary: () => last,
  };
}
