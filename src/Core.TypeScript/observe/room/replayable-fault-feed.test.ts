import { describe, expect, test } from "bun:test";
import {
  createReplayableRoomFaultFeed,
  encodeReplayableRoomFaultFeedIndex,
  encodeReplayableRoomFaultFeedReceipt,
  readReplayableRoomFaultFeed,
  replayFeedFile,
  replayableRoomFaultFeedFiles,
} from "./replayable-fault-feed";

function port(files: ReadonlyMap<string, string>) {
  return { read: async (path: string): Promise<string | null> => files.get(path) ?? null };
}

describe("static replayable room-fault feed", () => {
  test("publishes five finite, content-addressed, canonically ordered teaching vectors", async () => {
    const result = await readReplayableRoomFaultFeed(port(replayableRoomFaultFeedFiles()));
    expect(result.kind).toBe("ready");
    if (result.kind !== "ready") return;
    expect(result.receipts.map((entry) => entry.receipt.scenario)).toEqual([
      "altered-content",
      "correctable-recovery",
      "undecodable-transport",
      "unresolved-witness",
      "visible-witness-conflict",
    ]);
    expect(result.receipts.map((entry) => entry.contentKey)).toEqual(result.index.entries.map((entry) => entry.contentKey));
  });

  test("fault injection: changing a teaching generator fails the declared content address", async () => {
    const files = new Map(replayableRoomFaultFeedFiles());
    const feed = createReplayableRoomFaultFeed();
    const vector = feed.receipts.find((candidate) => candidate.receipt.scenario === "altered-content");
    expect(vector).toBeDefined();
    if (vector === undefined) return;
    files.set(replayFeedFile(vector.receipt.scenario), encodeReplayableRoomFaultFeedReceipt({
      ...vector,
      receipt: { ...vector.receipt, teaching: { ...vector.receipt.teaching, nextGenerator: "silently replace the earlier fact" } },
    }));
    const result = await readReplayableRoomFaultFeed(port(files));
    expect(result.kind).toBe("malformed");
    if (result.kind === "malformed") expect(result.reason).toMatch(/does not bind canonical receipt bytes/);
  });

  test("fault injection: a duplicate scenario in the discovery index is refused", async () => {
    const files = new Map(replayableRoomFaultFeedFiles());
    const feed = createReplayableRoomFaultFeed();
    const first = feed.index.entries[0];
    expect(first).toBeDefined();
    if (first === undefined) return;
    files.set("index.json", encodeReplayableRoomFaultFeedIndex({ ...feed.index, entries: [...feed.index.entries, first] }));
    const result = await readReplayableRoomFaultFeed(port(files));
    expect(result.kind).toBe("malformed");
    if (result.kind === "malformed") expect(result.reason).toMatch(/repeats scenario/);
  });

  test("missing index and missing declared vector remain unavailable, rather than becoming replay facts", async () => {
    expect((await readReplayableRoomFaultFeed(port(new Map()))).kind).toBe("unavailable");
    const files = new Map(replayableRoomFaultFeedFiles());
    files.delete("visible-witness-conflict.json");
    const result = await readReplayableRoomFaultFeed(port(files));
    expect(result.kind).toBe("unavailable");
    if (result.kind === "unavailable") expect(result.reason).toMatch(/visible-witness-conflict/);
  });
});
