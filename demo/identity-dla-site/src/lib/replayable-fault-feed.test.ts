import { describe, expect, test } from "bun:test";
import { readPublishedReplayFaultFeed } from "./replayable-fault-feed";

const response = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status });
const baseReceipt = {
  schema: "zeta.replayable-room-fault-feed-receipt.v1",
  contentKey: "0123456789abcdef0123456789abcdef",
  receipt: {
    scenario: "correctable-recovery",
    transport: { erasureMask: 7, classification: { status: "identifiable", erasedCount: 3 }, semanticReceipt: true },
    registers: { evidenceSign: "+1", contentIntegrity: "intact", causalContinuity: "settled", genesisAuthority: "witnessed" },
    outcome: "recovered",
    teaching: { code: "ADE-R1", lesson: "retained", nextGenerator: "append" },
  },
};
const index = { schema: "zeta.replayable-room-fault-feed-index.v1", entries: [{ scenario: "correctable-recovery", file: "correctable-recovery.json", contentKey: baseReceipt.contentKey }] };

describe("published static replay feed reader", () => {
  test("loads only a scenario-bound vector whose declared address matches its index", async () => {
    const state = await readPublishedReplayFaultFeed(async (url) => response(url.endsWith("index.json") ? index : baseReceipt));
    expect(state.kind).toBe("ready");
    if (state.kind === "ready") expect(state.vectors[0]?.receipt.teaching.code).toBe("ADE-R1");
  });

  test("fault injection: mismatched vector address and duplicate scenario are malformed", async () => {
    const wrongAddress = { ...baseReceipt, contentKey: "fedcba9876543210fedcba9876543210" };
    const mismatch = await readPublishedReplayFaultFeed(async (url) => response(url.endsWith("index.json") ? index : wrongAddress));
    expect(mismatch.kind).toBe("malformed");
    const duplicate = { ...index, entries: [...index.entries, index.entries[0]] };
    const repeated = await readPublishedReplayFaultFeed(async (url) => response(url.endsWith("index.json") ? duplicate : baseReceipt));
    expect(repeated.kind).toBe("malformed");
  });

  test("unavailable and incomplete vectors do not become locally invented replay facts", async () => {
    const missing = await readPublishedReplayFaultFeed(async () => response({}, 404));
    expect(missing.kind).toBe("unavailable");
    const incomplete = { ...baseReceipt, receipt: { ...baseReceipt.receipt, teaching: { code: "ADE-R1", lesson: "retained" } } };
    const malformed = await readPublishedReplayFaultFeed(async (url) => response(url.endsWith("index.json") ? index : incomplete));
    expect(malformed.kind).toBe("malformed");
  });
});
