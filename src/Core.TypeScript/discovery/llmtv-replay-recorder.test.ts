import { describe, expect, it } from "bun:test";
import {
  encode,
  publishFrame,
  type BroadcastSource,
  type BroadcastTransport,
  type SourceMind,
} from "./llmtv-broadcast";
import { foldReplayArtifact } from "./llmtv-replay";
import { createReplayRecorder, recordBroadcastTransport, type ReplayRecorderHeat } from "./llmtv-replay-recorder";

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

const alexa: BroadcastSource = { zid: "zid-alexa", name: "alexa" };
const soraya: BroadcastSource = { zid: "zid-soraya", name: "soraya" };

const mind = (label: string): SourceMind => ({
  role: "coding",
  hat: "coder hat",
  required: [{ label, temp: "hot", valueMilli: 820, epsilonMilli: 120 }],
  personal: {
    frost: frostReceiptFor("replay-recorder"),
    veilLabel: "private room",
    predictions: [{ label: "SECRET", temp: "warm", valueMilli: 500, epsilonMilli: 300 }],
  },
});

function frame(source: BroadcastSource, seq: number, label: string): string {
  return encode(publishFrame(source, seq, seq, mind(label)));
}

function memoryTransport(): {
  readonly transport: BroadcastTransport;
  readonly published: string[];
  emitInbound(text: string, from: string): void;
} {
  const published: string[] = [];
  const handlers: Array<(text: string, from: string) => void> = [];
  return {
    published,
    transport: {
      publish: (text) => published.push(text),
      onFrame: (handler) => handlers.push(handler),
    },
    emitInbound(text, from) {
      for (const handler of handlers) handler(text, from);
    },
  };
}

describe("LLMTV replay recorder -- live wires to deterministic artifact", () => {
  it("records valid broadcast wires and snapshots them as a replay artifact", () => {
    const recorder = createReplayRecorder(() => 1000);

    const result = recorder.record(frame(alexa, 1, "next tick lands green"), "fake-bus/alexa");

    expect(result.ok).toBe(true);
    expect(recorder.frames()).toEqual([
      { receivedAtMs: 1000, wire: frame(alexa, 1, "next tick lands green"), from: "fake-bus/alexa" },
    ]);

    const artifact = recorder.artifact({ seed: "S4", generatedBy: "unit-recorder" });
    const folded = foldReplayArtifact(artifact);
    expect(artifact.generatedBy).toBe("unit-recorder");
    expect(folded.stats).toEqual({ accepted: 1, rejected: 0, expired: 0 });
    expect(folded.transcript.dwellers.map((d) => d.name)).toEqual(["alexa"]);
    expect(folded.transcript.dwellers[0]!.frost?.veilLabel).toBe("private room");
  });

  it("wraps a broadcast transport without changing delivery semantics", () => {
    let now = 10;
    const recorder = createReplayRecorder(() => now);
    const bus = memoryTransport();
    const transport = recordBroadcastTransport(bus.transport, recorder, { outboundFrom: "local-node" });
    const seen: string[] = [];
    transport.onFrame((text, from) => seen.push(`${from}:${text}`));

    const outbound = frame(alexa, 1, "self frame");
    transport.publish(outbound);
    now = 20;
    const inbound = frame(soraya, 1, "peer frame");
    bus.emitInbound(inbound, "peer-node");

    expect(bus.published).toEqual([outbound]);
    expect(seen).toEqual([`peer-node:${inbound}`]);
    expect(recorder.frames()).toEqual([
      { receivedAtMs: 10, wire: outbound, from: "local-node" },
      { receivedAtMs: 20, wire: inbound, from: "peer-node" },
    ]);
  });

  it("keeps malformed and foreign packets out of the artifact by default", () => {
    const recorder = createReplayRecorder(() => 42);

    const result = recorder.record("not json", "noise");

    expect(result).toEqual({ ok: false, reason: "rejected-wire", storedFrames: 0 });
    expect(recorder.frames()).toEqual([]);

    const noisy = createReplayRecorder(() => 43, { keepRejected: true });
    expect(noisy.record("not json", "noise").ok).toBe(true);
    expect(foldReplayArtifact(noisy.artifact({ seed: "S4" })).stats).toEqual({
      accepted: 0,
      rejected: 1,
      expired: 0,
    });
  });

  it("defaults bounded capture to no-forget backpressure", () => {
    const heat: ReplayRecorderHeat[] = [];
    const first = frame(alexa, 1, "first");
    const second = frame(soraya, 1, "second");
    const recorder = createReplayRecorder(() => 100, { maxFrames: 1, onHeat: (h) => heat.push(h) });

    expect(recorder.record(first, "a").ok).toBe(true);
    const result = recorder.record(second, "b");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("backpressure");
    expect(recorder.frames()).toEqual([{ receivedAtMs: 100, wire: first, from: "a" }]);
    expect(heat).toEqual([
      {
        kind: "llmtv-replay-recorder.overflow",
        policy: "no-forget",
        maxFrames: 1,
        attemptedStored: 2,
        droppedFrames: 0,
        rejectedFrame: true,
      },
    ]);
  });

  it("can drop oldest only when the caller opts into heat-emitting erasure", () => {
    const heat: ReplayRecorderHeat[] = [];
    const first = frame(alexa, 1, "first");
    const second = frame(soraya, 1, "second");
    const recorder = createReplayRecorder(() => 100, {
      maxFrames: 1,
      overflowPolicy: "drop-oldest",
      onHeat: (h) => heat.push(h),
    });

    recorder.record(first, "a");
    const result = recorder.record(second, "b");

    expect(result.ok).toBe(true);
    expect(recorder.frames()).toEqual([{ receivedAtMs: 100, wire: second, from: "b" }]);
    expect(heat).toEqual([
      {
        kind: "llmtv-replay-recorder.overflow",
        policy: "drop-oldest",
        maxFrames: 1,
        attemptedStored: 2,
        droppedFrames: 1,
        rejectedFrame: false,
      },
    ]);
  });

  it("treats zero capacity as backpressure, even for drop-oldest policy", () => {
    const heat: ReplayRecorderHeat[] = [];
    const recorder = createReplayRecorder(() => 100, {
      maxFrames: 0,
      overflowPolicy: "drop-oldest",
      onHeat: (h) => heat.push(h),
    });

    const result = recorder.record(frame(alexa, 1, "no room"), "a");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toBe("backpressure");
    expect(recorder.frames()).toEqual([]);
    expect(heat).toEqual([
      {
        kind: "llmtv-replay-recorder.overflow",
        policy: "drop-oldest",
        maxFrames: 0,
        attemptedStored: 1,
        droppedFrames: 0,
        rejectedFrame: true,
      },
    ]);
  });
});
