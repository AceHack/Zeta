import { describe, expect, test } from "bun:test";
import type { RoomRunTranscript } from "../darkhall-ui/darkhall-room";
import {
  BROWSER_ROOM_CHECKPOINT_SCHEMA,
  MAX_BROWSER_ROOM_CHECKPOINT_BYTES,
  decodeBrowserRoomCheckpoint,
  encodeBrowserRoomCheckpoint,
} from "./browser-room-checkpoint";

const transcript: RoomRunTranscript = {
  schema: "zeta.darkhall.room-ui.v1",
  roomName: "checkpoint-room",
  seed: "room-seed-7",
  controller: [{ cell: 3, label: "resume", actionId: "room.resume", selected: true }],
  ticks: [
    {
      tick: 7,
      phase: "continue",
      event: "checkpoint-written",
      outcome: "continued",
      continuation: "resume:8",
    },
  ],
  heatRows: [
    {
      tick: 7,
      roomName: "checkpoint-room",
      heatRejected: 0,
      backpressured: 1,
      storageErrors: 0,
      heatKinds: ["checkpoint-backpressure"],
      signals: ["backpressure"],
      reasons: ["bounded test pressure"],
    },
  ],
  continuationReadout: {
    schema: "zeta.darkhall.continuation-readout.v1",
    source: "checkpoint-room",
    loopId: "loop-1",
    resumable: true,
    token: "resume:8",
    statePointer: "room-seed-7:7",
    nextLap: 8,
    ticksSpent: 7,
    resumeBaseTick: 7,
    stopReason: "checkpoint",
    admissionFeedback: [],
  },
  generatedBy: "browser-room-checkpoint.test",
};

describe("browser room checkpoint codec", () => {
  test("round-trips canonical bounded room state", () => {
    const encoded = encodeBrowserRoomCheckpoint(transcript);

    expect(encoded.ok).toBe(true);
    if (!encoded.ok) return;
    expect(new TextDecoder().decode(encoded.value)).toStartWith(
      `{"schema":"${BROWSER_ROOM_CHECKPOINT_SCHEMA}","transcript":{`,
    );

    const decoded = decodeBrowserRoomCheckpoint(encoded.value);
    expect(decoded).toEqual({ ok: true, value: transcript });
  });

  test("emits the same bytes regardless of object insertion order", () => {
    const reordered: RoomRunTranscript = {
      generatedBy: transcript.generatedBy!,
      continuationReadout: transcript.continuationReadout!,
      heatRows: transcript.heatRows,
      ticks: transcript.ticks,
      controller: transcript.controller,
      seed: transcript.seed,
      roomName: transcript.roomName,
      schema: transcript.schema,
    };
    const left = encodeBrowserRoomCheckpoint(transcript);
    const right = encodeBrowserRoomCheckpoint(reordered);

    expect(left.ok).toBe(true);
    expect(right.ok).toBe(true);
    if (!left.ok || !right.ok) return;
    expect([...left.value]).toEqual([...right.value]);
  });

  test("refuses transient browser state instead of silently persisting or dropping it", () => {
    const result = encodeBrowserRoomCheckpoint({
      ...transcript,
      browserTabReadout: {} as never,
      browserTransportReadout: {} as never,
      databaseReadout: {} as never,
      causalReadout: {} as never,
      causalHandoffReadout: {} as never,
    });

    expect(result).toEqual({
      ok: false,
      feedback: {
        severity: "backpressure",
        code: "room-checkpoint-non-durable-state",
        detail:
          "Room checkpoint input contains non-durable fields: browserTabReadout, browserTransportReadout, causalHandoffReadout, causalReadout, databaseReadout. Recompute them after recovery.",
      },
    });
  });

  test("rejects malformed nested execution state", () => {
    const result = encodeBrowserRoomCheckpoint({
      ...transcript,
      ticks: [{ ...transcript.ticks[0]!, tick: 1.5 }],
    });

    expect(result).toEqual({
      ok: false,
      feedback: {
        severity: "heat",
        code: "room-checkpoint-state-invalid",
        detail: "The room checkpoint transcript does not satisfy its bounded integer-valued schema.",
      },
    });
  });

  test("turns hostile runtime objects into typed feedback", () => {
    const hostile = new Proxy(transcript, {
      get(): never {
        throw new Error("blocked");
      },
    });

    expect(encodeBrowserRoomCheckpoint(hostile)).toEqual({
      ok: false,
      feedback: {
        severity: "heat",
        code: "room-checkpoint-encode-failed",
        detail: "Room checkpoint inspection failed: Error: blocked",
      },
    });
  });

  test("rejects non-canonical and over-budget bytes", () => {
    const nonCanonical = new TextEncoder().encode(
      JSON.stringify({ schema: BROWSER_ROOM_CHECKPOINT_SCHEMA, transcript }),
    );
    const decoded = decodeBrowserRoomCheckpoint(nonCanonical);
    const oversized = decodeBrowserRoomCheckpoint(new Uint8Array(MAX_BROWSER_ROOM_CHECKPOINT_BYTES + 1));

    expect(decoded).toEqual({
      ok: false,
      feedback: {
        severity: "heat",
        code: "room-checkpoint-non-canonical",
        detail: "Room checkpoint bytes are valid JSON but not canonical bytes.",
      },
    });
    expect(oversized).toEqual({
      ok: false,
      feedback: {
        severity: "backpressure",
        code: "room-checkpoint-too-large",
        detail: `Room checkpoint payload is ${String(MAX_BROWSER_ROOM_CHECKPOINT_BYTES + 1)} bytes; the limit is ${String(MAX_BROWSER_ROOM_CHECKPOINT_BYTES)}.`,
      },
    });
  });
});
