import {
  roomTranscriptToLlmtv,
  type RoomRunTranscript,
  type RoomTranscriptLlmtvOptions,
} from "../darkhall-ui/darkhall-room";
import type { DwellerMind } from "../darkhall-ui/darkhall-tv";
import { publishFrame, type BroadcastMessage, type BroadcastSource, type SourceMind } from "./llmtv-broadcast";
import { REPLAY_SCHEMA, replayFrame, type ReplayArtifact, type ReplayWireFrame } from "./llmtv-replay";

import { earnThenFrostOrThrow } from "../ledger/privacy-budget";

// Frost is EARNED now, not asserted: `SourceMind.personal.frost` takes a `FrostReceipt`, and the
// only way to get one is to have a peer attest value and then spend it. A `frosted: true` literal
// no longer typechecks. See src/Core.TypeScript/ledger/privacy-budget.ts.
const frostReceiptFor = (region: string) =>
  earnThenFrostOrThrow({
    owner: `owner-of-${region}`,
    attestor: `peer-of-${region}`,
    earn: 100,
    cost: 10,
    region,
    witness: "fixture: a peer attested that the owner added value",
  });

export interface RoomTranscriptReplayOptions extends RoomTranscriptLlmtvOptions {
  readonly sourceZid?: string;
  readonly sourceName?: string;
  readonly seq?: number;
  readonly frameNo?: number;
  readonly receivedAtMs?: number;
  readonly from?: string;
  readonly seed?: string;
  readonly expire?: ReplayArtifact["expire"];
}

export interface RoomTranscriptReplayEntry extends RoomTranscriptReplayOptions {
  readonly transcript: RoomRunTranscript;
}

export interface RoomTranscriptsReplayOptions {
  readonly seed?: string;
  readonly generatedBy?: string;
  readonly expire?: ReplayArtifact["expire"];
  readonly startReceivedAtMs?: number;
  readonly receivedAtStepMs?: number;
}

function finiteWhole(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.max(0, Math.trunc(value));
}

function finiteSeq(value: number | undefined, fallback: number): number {
  return Math.max(1, finiteWhole(value, fallback));
}

function projectionOptions(options: RoomTranscriptReplayOptions): RoomTranscriptLlmtvOptions {
  return {
    ...(options.name === undefined ? {} : { name: options.name }),
    ...(options.role === undefined ? {} : { role: options.role }),
    ...(options.hat === undefined ? {} : { hat: options.hat }),
    ...(options.live === undefined ? {} : { live: options.live }),
    ...(options.generatedBy === undefined ? {} : { generatedBy: options.generatedBy }),
  };
}

function sourceForTranscript(transcript: RoomRunTranscript, options: RoomTranscriptReplayOptions): BroadcastSource {
  return {
    zid: options.sourceZid ?? `room:${transcript.roomName}:${transcript.seed}`,
    name: options.sourceName ?? options.name ?? transcript.roomName,
  };
}

function sourceMindFromDweller(dweller: DwellerMind): SourceMind {
  const base = {
    role: dweller.role,
    hat: dweller.hat,
    required: dweller.predictions,
    ...(dweller.temperatureTreaty === undefined ? {} : { temperatureTreaty: dweller.temperatureTreaty }),
  };

  if (dweller.frost === undefined) {
    return base;
  }

  return {
    ...base,
    personal: {
      frost: frostReceiptFor("room-replay"),
      veilLabel: dweller.frost.veilLabel,
      predictions: [],
    },
  };
}

function projectedDweller(transcript: RoomRunTranscript, options: RoomTranscriptReplayOptions): DwellerMind {
  const projected = roomTranscriptToLlmtv(transcript, projectionOptions(options));
  const dweller = projected.dwellers[0];
  if (dweller !== undefined) {
    return dweller;
  }

  return {
    name: options.name ?? transcript.roomName,
    role: options.role ?? "room runtime",
    hat: options.hat ?? "room readout",
    live: options.live ?? true,
    predictions: [],
  };
}

export function roomTranscriptToBroadcastMessage(
  transcript: RoomRunTranscript,
  options: RoomTranscriptReplayOptions = {},
): BroadcastMessage {
  const dweller = projectedDweller(transcript, options);
  const frameNo = finiteWhole(options.frameNo, dweller.frame ?? transcript.ticks.length);
  const seq = finiteSeq(options.seq, frameNo);

  return publishFrame(sourceForTranscript(transcript, options), seq, frameNo, sourceMindFromDweller(dweller));
}

function defaultReceivedAtMs(
  transcript: RoomRunTranscript,
  message: BroadcastMessage,
  options: Pick<RoomTranscriptReplayOptions, "expire">,
): number {
  const fallbackFrameTime = message.t === "frame" ? message.frameNo : transcript.ticks.length;
  return finiteWhole(options.expire?.nowMs, fallbackFrameTime);
}

function messageFrameNo(message: BroadcastMessage): number {
  return message.t === "frame" ? message.frameNo : 0;
}

function replayFrameFromMessage(
  transcript: RoomRunTranscript,
  message: BroadcastMessage,
  options: Pick<RoomTranscriptReplayOptions, "expire" | "from" | "receivedAtMs">,
): ReplayWireFrame {
  return replayFrame(message, finiteWhole(options.receivedAtMs, defaultReceivedAtMs(transcript, message, options)), options.from);
}

export function roomTranscriptToReplayFrame(
  transcript: RoomRunTranscript,
  options: RoomTranscriptReplayOptions = {},
): ReplayWireFrame {
  const message = roomTranscriptToBroadcastMessage(transcript, options);
  return replayFrameFromMessage(transcript, message, options);
}

export function roomTranscriptToReplayArtifact(
  transcript: RoomRunTranscript,
  options: RoomTranscriptReplayOptions = {},
): ReplayArtifact {
  const base = {
    schema: REPLAY_SCHEMA,
    seed: options.seed ?? transcript.seed,
    frames: [roomTranscriptToReplayFrame(transcript, options)],
    generatedBy: options.generatedBy ?? "room-transcript -> llmtv-replay",
  } satisfies Omit<ReplayArtifact, "expire">;

  return options.expire === undefined ? base : { ...base, expire: options.expire };
}

export function roomTranscriptsToReplayArtifact(
  entries: readonly RoomTranscriptReplayEntry[],
  options: RoomTranscriptsReplayOptions = {},
): ReplayArtifact {
  const step = finiteWhole(options.receivedAtStepMs, 1);
  const prepared = entries.map((entry, index) => {
    const { transcript, ...entryOptions } = entry;
    return { entryOptions, index, message: roomTranscriptToBroadcastMessage(transcript, entryOptions), transcript };
  });
  const fallbackReceivedAtMs = new Map<number, number>();

  if (options.expire !== undefined && options.startReceivedAtMs === undefined) {
    const now = finiteWhole(options.expire.nowMs, 0);
    const bySource = new Map<string, typeof prepared>();
    for (const item of prepared) {
      const bucket = bySource.get(item.message.source.zid);
      if (bucket === undefined) {
        bySource.set(item.message.source.zid, [item]);
      } else {
        bucket.push(item);
      }
    }

    for (const bucket of bySource.values()) {
      const implicit = bucket
        .filter((item) => item.entryOptions.receivedAtMs === undefined)
        .sort(
          (left, right) =>
            left.message.seq - right.message.seq || messageFrameNo(left.message) - messageFrameNo(right.message) || left.index - right.index,
        );
      const start = Math.max(0, now - Math.max(0, implicit.length - 1) * step);
      implicit.forEach((item, rank) => fallbackReceivedAtMs.set(item.index, start + rank * step));
    }
  } else {
    const lastDefaultReceivedAtMs = finiteWhole(options.expire?.nowMs, 0);
    const defaultStartReceivedAtMs = Math.max(0, lastDefaultReceivedAtMs - Math.max(0, entries.length - 1) * step);
    const start = finiteWhole(options.startReceivedAtMs, defaultStartReceivedAtMs);
    prepared.forEach((item) => fallbackReceivedAtMs.set(item.index, start + item.index * step));
  }

  const frames = prepared.map(({ entryOptions, index, message, transcript }) => {
    const receivedAtMs = entryOptions.receivedAtMs ?? fallbackReceivedAtMs.get(index);
    const frameOptions = receivedAtMs === undefined ? entryOptions : { ...entryOptions, receivedAtMs };
    return replayFrameFromMessage(transcript, message, frameOptions);
  });
  const first = entries[0];
  const base = {
    schema: REPLAY_SCHEMA,
    seed: options.seed ?? first?.transcript.seed ?? "room-replay",
    frames,
    generatedBy: options.generatedBy ?? "room-transcripts -> llmtv-replay",
  } satisfies Omit<ReplayArtifact, "expire">;

  return options.expire === undefined ? base : { ...base, expire: options.expire };
}
