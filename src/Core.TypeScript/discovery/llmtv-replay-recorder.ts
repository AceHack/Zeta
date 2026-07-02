// llmtv-replay-recorder -- live mesh to replay-artifact seam.
//
// The socket/Reticulum edge owns physical delivery. This module owns the deterministic
// capture contract: record the LLMTV broadcast wires that crossed an injected port, then
// expose them as zeta.llmtv.replay.v1 so the zero-JS page can be rebuilt later.

import { decode, type BroadcastTransport } from "./llmtv-broadcast";
import { REPLAY_SCHEMA, encodeReplayArtifact, type ReplayArtifact, type ReplayWireFrame } from "./llmtv-replay";

export type ReplayRecorderOverflowPolicy = "no-forget" | "drop-oldest";

export interface ReplayRecorderHeat {
  readonly kind: "llmtv-replay-recorder.overflow";
  readonly policy: ReplayRecorderOverflowPolicy;
  readonly maxFrames: number;
  readonly attemptedStored: number;
  readonly droppedFrames: number;
  readonly rejectedFrame: boolean;
}

export interface ReplayRecorderOptions {
  /// Default false: discovery/foreign/malformed wires are telemetry, not replay payload.
  readonly keepRejected?: boolean;
  /// Undefined means unbounded. When set, default policy is no-forget/backpressure.
  readonly maxFrames?: number;
  readonly overflowPolicy?: ReplayRecorderOverflowPolicy;
  readonly onHeat?: (heat: ReplayRecorderHeat) => void;
}

export type RecordReplayWireResult =
  | {
      readonly ok: true;
      readonly frame: ReplayWireFrame;
      readonly storedFrames: number;
      readonly heat?: ReplayRecorderHeat;
    }
  | {
      readonly ok: false;
      readonly reason: "rejected-wire" | "backpressure";
      readonly storedFrames: number;
      readonly heat?: ReplayRecorderHeat;
    };

export interface ReplayRecorderSnapshotOptions {
  readonly seed: string;
  readonly generatedBy?: string;
  readonly expire?: ReplayArtifact["expire"];
}

export interface ReplayRecorder {
  record(wire: string, from?: string): RecordReplayWireResult;
  frames(): readonly ReplayWireFrame[];
  artifact(options: ReplayRecorderSnapshotOptions): ReplayArtifact;
  encode(options: ReplayRecorderSnapshotOptions): string;
  clear(): void;
}

function nowFrame(wire: string, nowMs: number, from: string | undefined): ReplayWireFrame {
  const frame = { receivedAtMs: nowMs, wire };
  return from === undefined ? frame : { ...frame, from };
}

function emitHeat(options: ReplayRecorderOptions, heat: ReplayRecorderHeat): ReplayRecorderHeat {
  options.onHeat?.(heat);
  return heat;
}

function normalizedCapacity(maxFrames: number | undefined): number | undefined {
  return maxFrames === undefined ? undefined : Math.max(0, Math.floor(maxFrames));
}

function capacityResult(
  frames: ReplayWireFrame[],
  frame: ReplayWireFrame,
  options: ReplayRecorderOptions,
): RecordReplayWireResult {
  const maxFrames = normalizedCapacity(options.maxFrames);
  if (maxFrames === undefined || frames.length < maxFrames) {
    frames.push(frame);
    return { ok: true, frame, storedFrames: frames.length };
  }

  const policy = options.overflowPolicy ?? "no-forget";
  if (policy === "drop-oldest" && maxFrames > 0) {
    frames.shift();
    frames.push(frame);
    const heat = emitHeat(options, {
      kind: "llmtv-replay-recorder.overflow",
      policy,
      maxFrames,
      attemptedStored: maxFrames + 1,
      droppedFrames: 1,
      rejectedFrame: false,
    });
    return { ok: true, frame, storedFrames: frames.length, heat };
  }

  const heat = emitHeat(options, {
    kind: "llmtv-replay-recorder.overflow",
    policy,
    maxFrames,
    attemptedStored: maxFrames + 1,
    droppedFrames: 0,
    rejectedFrame: true,
  });
  return { ok: false, reason: "backpressure", storedFrames: frames.length, heat };
}

export function createReplayRecorder(nowMs: () => number, options: ReplayRecorderOptions = {}): ReplayRecorder {
  const frames: ReplayWireFrame[] = [];

  return {
    record(wire, from) {
      if (decode(wire) === null && options.keepRejected !== true) {
        return { ok: false, reason: "rejected-wire", storedFrames: frames.length };
      }

      return capacityResult(frames, nowFrame(wire, nowMs(), from), options);
    },
    frames: () => frames.slice(),
    artifact(snapshot) {
      const base = {
        schema: REPLAY_SCHEMA,
        seed: snapshot.seed,
        frames: frames.slice(),
      } satisfies Pick<ReplayArtifact, "schema" | "seed" | "frames">;

      const withGeneratedBy =
        snapshot.generatedBy === undefined ? base : { ...base, generatedBy: snapshot.generatedBy };
      return snapshot.expire === undefined ? withGeneratedBy : { ...withGeneratedBy, expire: snapshot.expire };
    },
    encode(snapshot) {
      return encodeReplayArtifact(this.artifact(snapshot));
    },
    clear() {
      frames.length = 0;
    },
  };
}

export interface RecordingBroadcastOptions {
  readonly recordInbound?: boolean;
  readonly recordOutbound?: boolean;
  readonly outboundFrom?: string;
}

export function recordBroadcastTransport(
  transport: BroadcastTransport,
  recorder: ReplayRecorder,
  options: RecordingBroadcastOptions = {},
): BroadcastTransport {
  const recordInbound = options.recordInbound ?? true;
  const recordOutbound = options.recordOutbound ?? true;
  const outboundFrom = options.outboundFrom ?? "self";

  return {
    publish(text) {
      if (recordOutbound) {
        recorder.record(text, outboundFrom);
      }
      transport.publish(text);
    },
    onFrame(handler) {
      transport.onFrame((text, from) => {
        if (recordInbound) {
          recorder.record(text, from);
        }
        handler(text, from);
      });
    },
  };
}
