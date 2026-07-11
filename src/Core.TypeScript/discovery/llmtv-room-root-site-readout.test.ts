import { join } from "node:path";
import { describe, expect, it } from "bun:test";
import type { HeatRow, RoomRunTranscript } from "../darkhall-ui/darkhall-room";
import { decodeReplayArtifact, foldReplayArtifact } from "./llmtv-replay";
import {
  decodeRoomRunTranscript,
  parseRootSiteRoomLlmtvArgs,
  publishRoomTranscriptsToRootSiteLlmtv,
  ROOT_SITE_ROOM_LLMTV_GENERATED_BY,
  runRootSiteRoomLlmtvCli,
  type RootSiteRoomLlmtvIo,
} from "./llmtv-room-root-site-readout";
import {
  ROOT_SITE_LLMTV_HTML_RELATIVE_PATH,
  ROOT_SITE_LLMTV_REPLAY_RELATIVE_PATH,
  rootSiteLlmtvPaths,
} from "./llmtv-root-site-readout";
import {
  decodeRootSiteLlmtvStatus,
  ROOT_SITE_LLMTV_STATUS_RELATIVE_PATH,
  rootSiteLlmtvStatusPath,
} from "./llmtv-root-site-status";

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

function transcript(ticks: number, heatRows: readonly HeatRow[] = []): RoomRunTranscript {
  return {
    schema: "zeta.darkhall.room-ui.v1",
    roomName: "darkhall",
    seed: "S4",
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

function memoryIo(files: ReadonlyMap<string, string> = new Map()): {
  readonly io: RootSiteRoomLlmtvIo;
  readonly writes: Map<string, string>;
  readonly stdout: string[];
  readonly stderr: string[];
} {
  const writes = new Map<string, string>();
  const stdout: string[] = [];
  const stderr: string[] = [];
  return {
    writes,
    stdout,
    stderr,
    io: {
      readText: (path) => {
        const value = files.get(path);
        if (value === undefined) throw new Error("missing");
        return value;
      },
      writeText: (path, text) => writes.set(path, text),
      stdout: (text) => stdout.push(text),
      stderr: (text) => stderr.push(text),
    },
  };
}

describe("llmtv-room-root-site-readout -- room transcripts to root-site LLMTV", () => {
  it("writes the canonical replay ledger and zero-JS page from a room transcript", () => {
    const { io, writes } = memoryIo();
    const result = publishRoomTranscriptsToRootSiteLlmtv([transcript(2, [deniedHeat, forgottenHeat])], io, {
      rootDir: "/site",
      nowMs: 1_000,
      expireTtlMs: 10_000,
      title: "Room LLMTV",
    });
    const paths = rootSiteLlmtvPaths("/site");
    const statusPath = rootSiteLlmtvStatusPath("/site");
    const replayText = writes.get(paths.replayPath);
    const html = writes.get(paths.htmlPath);
    const statusText = writes.get(statusPath);

    expect(result.ok).toBe(true);
    expect(replayText).toBeString();
    expect(statusText).toBeString();
    expect(html).toContain("<title>Room LLMTV</title>");
    expect(html).toContain('data-readout-status="live"');
    expect(html).toContain('data-dweller="darkhall"');
    expect(html).toContain("frame 2");
    expect(html).not.toContain("<script");

    const replay = decodeReplayArtifact(replayText!);
    expect(replay?.schema).toBe("zeta.llmtv.replay.v1");
    expect(replay?.generatedBy).toBe(ROOT_SITE_ROOM_LLMTV_GENERATED_BY);
    expect(replay?.frames).toHaveLength(1);
    expect(foldReplayArtifact(replay!).transcript.dwellers[0]?.temperatureTreaty?.heatReceipts).toHaveLength(2);
    expect(decodeRootSiteLlmtvStatus(statusText!)).toMatchObject({
      channel: "room-transcript",
      generatedBy: ROOT_SITE_ROOM_LLMTV_GENERATED_BY,
      replayPath: paths.replayPath,
      htmlPath: paths.htmlPath,
      status: "live",
      reason: "live",
      frames: 1,
      dwellers: 1,
      stats: { accepted: 1, rejected: 0, expired: 0 },
      phaseClock: {
        schema: "zeta.darkhall.phase-clock.v1",
        source: "llmtv-broadcast",
        basis: "seed-phase",
        seed: "S4",
        phase: 2,
        skewBoundTicks: 0,
        appendOnly: true,
        travelers: 1,
      },
    });
  });

  it("uses the replay fold so repeated room snapshots converge by source sequence", () => {
    const { io, writes } = memoryIo();
    const result = publishRoomTranscriptsToRootSiteLlmtv(
      [transcript(1, [deniedHeat]), transcript(2, [deniedHeat, forgottenHeat])],
      io,
      { rootDir: "/site", nowMs: 5_000, expireTtlMs: 1_000 },
    );
    const replay = decodeReplayArtifact(writes.get(rootSiteLlmtvPaths("/site").replayPath)!);
    const folded = foldReplayArtifact(replay!);

    expect(result.ok).toBe(true);
    expect(replay?.frames.map((frame) => frame.receivedAtMs)).toEqual([4_999, 5_000]);
    expect(folded.stats).toEqual({ accepted: 2, rejected: 0, expired: 0 });
    expect(folded.transcript.dwellers).toHaveLength(1);
    expect(folded.transcript.dwellers[0]?.frame).toBe(2);
  });

  it("runs as an injected-IO CLI over same-origin root-site paths", () => {
    const files = new Map([["room.json", JSON.stringify(transcript(1, [deniedHeat]))]]);
    const { io, writes, stdout, stderr } = memoryIo(files);
    const code = runRootSiteRoomLlmtvCli([
      "--root-site",
      "/site",
      "--room",
      "room.json",
      "--now-ms",
      "1000",
      "--expire-ttl-ms",
      "100",
      "--title",
      "Room LLMTV",
    ], io);

    expect(code).toBe(0);
    expect(stderr).toEqual([]);
    expect(stdout.join("")).toContain(`wrote ${ROOT_SITE_LLMTV_REPLAY_RELATIVE_PATH}`);
    expect(stdout.join("")).toContain(`status-json=${ROOT_SITE_LLMTV_STATUS_RELATIVE_PATH}`);
    expect(stdout.join("")).toContain("status=live");
    expect(writes.get(join("/site", ...ROOT_SITE_LLMTV_REPLAY_RELATIVE_PATH.split("/")))).toBeString();
    expect(writes.get(join("/site", ...ROOT_SITE_LLMTV_STATUS_RELATIVE_PATH.split("/")))).toBeString();
    expect(writes.get(join("/site", ...ROOT_SITE_LLMTV_HTML_RELATIVE_PATH.split("/")))).toContain(
      'data-readout-status="live"',
    );
  });

  it("refuses malformed room transcript inputs before writing", () => {
    const { io, writes, stderr } = memoryIo(new Map([["bad.json", '{"schema":"wrong"}']]));

    const code = runRootSiteRoomLlmtvCli(["--root-site", "/site", "--room", "bad.json"], io);

    expect(code).toBe(1);
    expect(writes.size).toBe(0);
    expect(stderr.join("")).toContain("invalid room transcript: bad.json");
    expect(decodeRoomRunTranscript('{"schema":"wrong"}')).toBeNull();
  });

  it("parses help, positional rooms, and missing required inputs", () => {
    expect(parseRootSiteRoomLlmtvArgs(["--help"])).toEqual({ ok: true, request: { kind: "help" } });
    expect(parseRootSiteRoomLlmtvArgs(["/site", "one.json", "two.json", "--now-ms", "9"])).toEqual({
      ok: true,
      request: {
        kind: "publish",
        rootDir: "/site",
        transcriptPaths: ["one.json", "two.json"],
        nowMs: 9,
      },
    });

    const { io, stdout } = memoryIo();
    expect(runRootSiteRoomLlmtvCli(["--help"], io)).toBe(0);
    expect(stdout.join("")).toContain("zeta.darkhall.room-ui.v1");
    expect(parseRootSiteRoomLlmtvArgs(["--root-site", "/site"])).toEqual({
      ok: false,
      error: expect.stringContaining("at least one room transcript") as unknown as string,
    });
  });
});
