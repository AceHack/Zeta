// llmtv-replay -- pure artifact/replay adapter between live mesh frames and
// the generated LLMTV page. The impure transport is deliberately elsewhere:
// UDP/Reticulum runners emit broadcast wire frames; this module folds those
// frames into the same transcript that darkhall-tv renders.

import { renderLlmtvDocument, type LlmtvTranscript, type RenderDocumentOptions } from "../darkhall-ui/darkhall-tv";
import {
  decode,
  encode,
  expireChannels,
  observeBroadcast,
  toLlmtvTranscript,
  type BroadcastMessage,
  type ChannelTable,
} from "./llmtv-broadcast";

export const REPLAY_SCHEMA = "zeta.llmtv.replay.v1";

export interface ReplayWireFrame {
  readonly receivedAtMs: number;
  readonly wire: string;
  readonly from?: string;
}

export interface ReplayExpiry {
  readonly nowMs: number;
  readonly ttlMs: number;
}

export interface ReplayArtifact {
  readonly schema: typeof REPLAY_SCHEMA;
  readonly seed: string;
  readonly frames: readonly ReplayWireFrame[];
  readonly expire?: ReplayExpiry;
  readonly generatedBy?: string;
}

export interface ReplayStats {
  readonly accepted: number;
  readonly rejected: number;
  readonly expired: number;
}

export interface ReplayResult {
  readonly transcript: LlmtvTranscript;
  readonly table: ChannelTable;
  readonly stats: ReplayStats;
}

export function replayFrame(message: BroadcastMessage, receivedAtMs: number, from?: string): ReplayWireFrame {
  const frame = { receivedAtMs, wire: encode(message) };
  return from === undefined ? frame : { ...frame, from };
}

function generatedBy(value: string | undefined): string {
  return value === undefined ? "llmtv-replay" : value;
}

function withGeneratedBy(transcript: LlmtvTranscript, value: string): LlmtvTranscript {
  return { ...transcript, generatedBy: value };
}

export function foldReplayFrames(
  frames: readonly ReplayWireFrame[],
  seed: string,
  options: { readonly expire?: ReplayExpiry; readonly generatedBy?: string } = {},
): ReplayResult {
  let table: ChannelTable = new Map();
  let accepted = 0;
  let rejected = 0;

  for (const frame of frames) {
    const message = decode(frame.wire);
    if (message === null) {
      rejected++;
    } else {
      table = observeBroadcast(table, message, frame.receivedAtMs);
      accepted++;
    }
  }

  const beforeExpire = table.size;
  if (options.expire !== undefined) {
    table = expireChannels(table, options.expire.nowMs, options.expire.ttlMs);
  }

  return {
    table,
    transcript: withGeneratedBy(toLlmtvTranscript(table, seed), generatedBy(options.generatedBy)),
    stats: {
      accepted,
      rejected,
      expired: beforeExpire - table.size,
    },
  };
}

export function foldReplayArtifact(artifact: ReplayArtifact): ReplayResult {
  const withExpiry =
    artifact.expire === undefined
      ? {}
      : {
          expire: artifact.expire,
        };
  const options =
    artifact.generatedBy === undefined
      ? withExpiry
      : {
          ...withExpiry,
          generatedBy: artifact.generatedBy,
        };

  return foldReplayFrames(artifact.frames, artifact.seed, options);
}

export function renderReplayDocument(artifact: ReplayArtifact, options: RenderDocumentOptions = {}): string {
  return renderLlmtvDocument(foldReplayArtifact(artifact).transcript, options);
}

export function encodeReplayArtifact(artifact: ReplayArtifact): string {
  return `${JSON.stringify(artifact, null, 2)}\n`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseFrame(value: unknown): ReplayWireFrame | null {
  const record = asRecord(value);
  if (record === null || !isFiniteNumber(record.receivedAtMs) || typeof record.wire !== "string") {
    return null;
  }

  const from = record.from;
  if (from === undefined) {
    return { receivedAtMs: record.receivedAtMs, wire: record.wire };
  }
  if (typeof from !== "string") {
    return null;
  }
  return { receivedAtMs: record.receivedAtMs, wire: record.wire, from };
}

function parseExpiry(value: unknown): ReplayExpiry | null {
  const record = asRecord(value);
  if (record === null || !isFiniteNumber(record.nowMs) || !isFiniteNumber(record.ttlMs)) {
    return null;
  }

  return { nowMs: record.nowMs, ttlMs: record.ttlMs };
}

export function decodeReplayArtifact(text: string): ReplayArtifact | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  const record = asRecord(parsed);
  if (
    record === null ||
    record.schema !== REPLAY_SCHEMA ||
    typeof record.seed !== "string" ||
    !Array.isArray(record.frames)
  ) {
    return null;
  }

  const frames: ReplayWireFrame[] = [];
  for (const raw of record.frames) {
    const frame = parseFrame(raw);
    if (frame === null) {
      return null;
    }
    frames.push(frame);
  }

  const base = { schema: REPLAY_SCHEMA, seed: record.seed, frames } satisfies Pick<
    ReplayArtifact,
    "schema" | "seed" | "frames"
  >;

  let withExpiry: ReplayArtifact | null = base;
  if (record.expire !== undefined) {
    const expire = parseExpiry(record.expire);
    withExpiry = expire === null ? null : { ...base, expire };
  }

  if (withExpiry === null) {
    return null;
  }

  return typeof record.generatedBy === "string" ? { ...withExpiry, generatedBy: record.generatedBy } : withExpiry;
}
