import { describe, expect, it } from "bun:test";
import { HEAT_RECEIPT_SCHEMA, HEAT_SIGNAL_TREATY_PATH } from "../darkhall-ui/heat";
import { roomTranscriptToLlmtv, type HeatRow, type RoomRunTranscript } from "../darkhall-ui/darkhall-room";
import { foldReplayArtifact, renderReplayDocument } from "./llmtv-replay";
import {
  roomTranscriptToReplayArtifact,
  roomTranscriptToReplayFrame,
  roomTranscriptsToReplayArtifact,
} from "./llmtv-room-replay";

const deniedHeat: HeatRow = {
  tick: 1,
  roomName: "darkhall",
  heatRejected: 1,
  backpressured: 1,
  storageErrors: 0,
  heatKinds: ["room-boundary.door-denied"],
  signals: ["denied"],
  reasons: ["darkhall -> glass refused"],
};

const forgottenHeat: HeatRow = {
  tick: 2,
  roomName: "darkhall",
  heatRejected: 2,
  backpressured: 0,
  storageErrors: 1,
  heatKinds: ["room-horizon.forgotten"],
  signals: ["forgotten"],
  reasons: ["bounded horizon forgot materialized keys"],
};

function transcript(ticks: number, heatRows: readonly HeatRow[]): RoomRunTranscript {
  return {
    schema: "zeta.darkhall.room-ui.v1",
    roomName: "darkhall",
    seed: "0x2a",
    generatedBy: "DarkHallRoomTranscript.Tests",
    controller: [
      {
        cell: 0,
        label: "play/meta-cart",
        actionId: "darkhall.play.meta-cart-host",
        actionClass: "transition",
        gate: "append-only",
        selected: true,
      },
    ],
    ticks: Array.from({ length: ticks }, (_, index) => {
      const tick = index + 1;
      const heat = heatRows.find((row) => row.tick === tick);
      return {
        tick,
        phase: tick === ticks ? "measure" : "observe",
        event: tick === ticks ? "room measured" : "controller readout banked",
        outcome: heat === undefined ? "ok" : "backpressure",
        ...(heat === undefined ? {} : { heat }),
      };
    }),
    heatRows,
  };
}

describe("LLMTV room replay adapter", () => {
  it("snapshots a room transcript as the existing zeta.llmtv.replay.v1 artifact", () => {
    const source = transcript(2, [deniedHeat, forgottenHeat]);
    const artifact = roomTranscriptToReplayArtifact(source, {
      sourceZid: "room:darkhall",
      sourceName: "darkhall",
      seq: 7,
      receivedAtMs: 42,
      from: "darkhall-room-loop",
    });

    expect(artifact.schema).toBe("zeta.llmtv.replay.v1");
    expect(artifact.seed).toBe("0x2a");
    expect(artifact.frames).toHaveLength(1);
    expect(artifact.frames[0]).toMatchObject({ receivedAtMs: 42, from: "darkhall-room-loop" });

    const folded = foldReplayArtifact(artifact);
    const projected = roomTranscriptToLlmtv(source);
    const dweller = folded.transcript.dwellers[0];

    expect(folded.stats).toEqual({ accepted: 1, rejected: 0, expired: 0 });
    expect(dweller?.name).toBe("darkhall");
    expect(dweller?.frame).toBe(2);
    expect(dweller?.predictions).toEqual(projected.dwellers[0]?.predictions);
    expect(dweller?.temperatureTreaty?.heatReceipts?.map((receipt) => receipt.schema)).toEqual([
      HEAT_RECEIPT_SCHEMA,
      HEAT_RECEIPT_SCHEMA,
    ]);
  });

  it("renders room replay artifacts through the zero-script LLMTV replay renderer", () => {
    const artifact = roomTranscriptToReplayArtifact(transcript(1, [deniedHeat]), {
      sourceZid: "room:darkhall",
      seq: 1,
    });

    const html = renderReplayDocument(artifact, { title: "Dark Hall replay" });

    expect(html).toContain("<title>Dark Hall replay</title>");
    expect(html).toContain('data-schema="zeta.darkhall.llmtv.v1"');
    expect(html).toContain('data-dweller="darkhall"');
    expect(html).toContain(`data-temperature-treaty="${HEAT_SIGNAL_TREATY_PATH}"`);
    expect(html).toContain('data-heat-receipts="1"');
    expect(html).toContain("frame 1");
    expect(html).not.toContain("<script");
  });

  it("uses the injected expiry clock as the default snapshot receipt time", () => {
    const artifact = roomTranscriptToReplayArtifact(transcript(1, [deniedHeat]), {
      sourceZid: "room:darkhall",
      seq: 1,
      expire: { nowMs: 1000, ttlMs: 100 },
    });

    const folded = foldReplayArtifact(artifact);

    expect(artifact.frames[0]?.receivedAtMs).toBe(1000);
    expect(folded.stats).toEqual({ accepted: 1, rejected: 0, expired: 0 });
    expect(folded.transcript.dwellers).toHaveLength(1);
  });

  it("defaults multi-snapshot receipt times by source sequence under expiry", () => {
    const newRoom = transcript(2, [deniedHeat, forgottenHeat]);
    const oldRoom = transcript(1, [deniedHeat]);
    const newestFirst = roomTranscriptsToReplayArtifact(
      [
        {
          transcript: newRoom,
          sourceZid: "room:darkhall",
          seq: 2,
        },
        {
          transcript: oldRoom,
          sourceZid: "room:darkhall",
          seq: 1,
        },
      ],
      { expire: { nowMs: 1000, ttlMs: 0 } },
    );
    const oldestFirst = roomTranscriptsToReplayArtifact(
      [
        {
          transcript: oldRoom,
          sourceZid: "room:darkhall",
          seq: 1,
        },
        {
          transcript: newRoom,
          sourceZid: "room:darkhall",
          seq: 2,
        },
      ],
      { expire: { nowMs: 1000, ttlMs: 0 } },
    );

    const foldedNewestFirst = foldReplayArtifact(newestFirst);
    const foldedOldestFirst = foldReplayArtifact(oldestFirst);

    expect(newestFirst.frames.map((frame) => frame.receivedAtMs)).toEqual([1000, 999]);
    expect(oldestFirst.frames.map((frame) => frame.receivedAtMs)).toEqual([999, 1000]);
    expect(foldedNewestFirst.stats).toEqual({ accepted: 2, rejected: 0, expired: 0 });
    expect(foldedOldestFirst.stats).toEqual({ accepted: 2, rejected: 0, expired: 0 });
    expect(foldedNewestFirst.transcript.dwellers[0]?.frame).toBe(2);
    expect(foldedOldestFirst.transcript.dwellers[0]?.frame).toBe(2);
  });

  it("lets repeated room snapshots converge by the replay fold's LWW sequence rule", () => {
    const oldRoom = transcript(1, [deniedHeat]);
    const newRoom = transcript(2, [deniedHeat, forgottenHeat]);
    const artifact = roomTranscriptsToReplayArtifact(
      [
        {
          transcript: newRoom,
          sourceZid: "room:darkhall",
          sourceName: "darkhall",
          seq: 2,
        },
        {
          transcript: oldRoom,
          sourceZid: "room:darkhall",
          sourceName: "darkhall",
          seq: 1,
        },
      ],
      { seed: "0x2a", generatedBy: "room-replay-test" },
    );

    const duplicateNewest = roomTranscriptToReplayFrame(newRoom, {
      sourceZid: "room:darkhall",
      sourceName: "darkhall",
      seq: 2,
      receivedAtMs: 99,
    });
    const folded = foldReplayArtifact({ ...artifact, frames: [...artifact.frames, duplicateNewest] });

    expect(folded.transcript.generatedBy).toBe("room-replay-test");
    expect(folded.stats).toEqual({ accepted: 3, rejected: 0, expired: 0 });
    expect(folded.transcript.dwellers).toHaveLength(1);
    expect(folded.transcript.dwellers[0]?.frame).toBe(2);
    expect(folded.transcript.dwellers[0]?.temperatureTreaty?.heatReceipts).toHaveLength(2);
  });
});
