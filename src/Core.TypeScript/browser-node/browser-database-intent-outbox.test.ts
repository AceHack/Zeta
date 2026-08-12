import { describe, expect, test } from "bun:test";
import {
  createInMemoryBrowserDatabaseIntentOutbox,
  decideBrowserDatabaseIntentEnqueue,
  validateBrowserDatabaseIntentLedger,
  type BrowserDatabaseIntentDraft,
} from "./browser-database-intent-outbox";

const limits = { maxIntents: 3, maxReceipts: 4, maxLedgerBytes: 4096 } as const;

function draft(intentId: string, rowKey = "game/score"): BrowserDatabaseIntentDraft {
  return {
    databaseNodeId: "browser/global",
    intentId,
    expectedRevision: null,
    deltas: [{ eventId: intentId, rowKey, payload: "9000", weight: 1 }],
  };
}

function tick(revision = 1) {
  return {
    schema: "zeta.db.tick.v1" as const,
    nodeId: "browser/global",
    executorId: "tab-a",
    executorKind: "browser-tab" as const,
    revision,
    admission: "complete" as const,
    accepted: 1,
    duplicates: 0,
    nextDeltaIndex: 1,
    rows: [{ rowKey: "game/score", payload: "9000", weight: 1 }],
    feedback: [],
  };
}

describe("browser database intent outbox", () => {
  test("assigns stable monotonic order and returns defensive readout copies", async () => {
    const opened = createInMemoryBrowserDatabaseIntentOutbox(limits);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;

    const first = await opened.value.enqueue(draft("event/a"));
    const second = await opened.value.enqueue(draft("event/b", "game/lives"));
    expect(first.ok && first.value.sequence).toBe(0);
    expect(second.ok && second.value.sequence).toBe(1);

    const read = await opened.value.read("browser/global");
    expect(read.ok && read.value.intents.map((intent) => intent.intentId)).toEqual(["event/a", "event/b"]);
    expect(read.ok && read.value.queued).toBe(2);
    expect(read.ok && read.value.executing).toBe(0);
    if (read.ok) {
      const firstIntent = read.value.intents[0];
      const firstDelta = firstIntent?.deltas[0];
      if (firstDelta !== undefined) (firstDelta as { rowKey: string }).rowKey = "mutated";
    }
    const reread = await opened.value.read("browser/global");
    expect(reread.ok && reread.value.intents[0]?.deltas[0]?.rowKey).toBe("game/score");
  });

  test("replays identical enqueue idempotently and rejects conflicting identity", async () => {
    const opened = createInMemoryBrowserDatabaseIntentOutbox(limits);
    if (!opened.ok) throw new Error("test setup failed");

    const first = await opened.value.enqueue(draft("event/a"));
    const replay = await opened.value.enqueue(draft("event/a"));
    const conflict = await opened.value.enqueue(draft("event/a", "game/lives"));
    expect(first.ok).toBe(true);
    expect(replay.ok).toBe(true);
    if (first.ok && replay.ok) expect(replay.value).toEqual(first.value);
    expect(conflict).toEqual({
      ok: false,
      feedback: {
        severity: "heat",
        code: "intent-conflict",
        detail: "Intent identifier event/a already names different work.",
      },
    });
  });

  test("moves executing work into a compact durable receipt and never reuses its sequence", async () => {
    const opened = createInMemoryBrowserDatabaseIntentOutbox(limits);
    if (!opened.ok) throw new Error("test setup failed");
    const first = await opened.value.enqueue(draft("event/a"));
    if (!first.ok) throw new Error("test enqueue failed");

    const begun = await opened.value.begin("browser/global", first.value.intentId, first.value.sequence);
    expect(begun.ok && begun.value.status).toBe("executing");
    const settled = await opened.value.settle("browser/global", first.value.intentId, first.value.sequence, tick());
    expect(settled.ok && settled.value).toMatchObject({ queued: 0, executing: 0, settled: 1 });
    expect(settled.ok && settled.value.receipts[0]).toEqual({
      schema: "zeta.browser-database-execution-receipt.v1",
      databaseNodeId: "browser/global",
      intentId: "event/a",
      sequence: 0,
      status: "settled",
      executorId: "tab-a",
      executorKind: "browser-tab",
      revision: 1,
      accepted: 1,
      duplicates: 0,
      deltaCount: 1,
    });
    const second = await opened.value.enqueue(draft("event/b"));
    expect(second.ok && second.value.sequence).toBe(1);
  });

  test("keeps executing work recoverable and makes begin idempotent", async () => {
    const opened = createInMemoryBrowserDatabaseIntentOutbox(limits);
    if (!opened.ok) throw new Error("test setup failed");
    const enqueued = await opened.value.enqueue(draft("event/a"));
    if (!enqueued.ok) throw new Error("test enqueue failed");

    const first = await opened.value.begin("browser/global", "event/a", enqueued.value.sequence);
    const replay = await opened.value.begin("browser/global", "event/a", enqueued.value.sequence);
    expect(first.ok && first.value.status).toBe("executing");
    expect(replay).toEqual(first);
    expect(await opened.value.read("browser/global")).toMatchObject({
      ok: true,
      value: { queued: 0, executing: 1, settled: 0 },
    });
  });

  test("backpressures before execution when the status transition exceeds the byte budget", async () => {
    const probe = createInMemoryBrowserDatabaseIntentOutbox(limits);
    if (!probe.ok) throw new Error("test setup failed");
    await probe.value.enqueue(draft("event/a"));
    const queued = await probe.value.read("browser/global");
    if (!queued.ok) throw new Error("test read failed");

    const opened = createInMemoryBrowserDatabaseIntentOutbox({
      ...limits,
      maxLedgerBytes: queued.value.ledgerBytes,
    });
    if (!opened.ok) throw new Error("test setup failed");
    const enqueued = await opened.value.enqueue(draft("event/a"));
    if (!enqueued.ok) throw new Error("test enqueue failed");

    expect(await opened.value.begin("browser/global", "event/a", enqueued.value.sequence)).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "intent-capacity-exhausted" },
    });
    expect(await opened.value.read("browser/global")).toMatchObject({
      ok: true,
      value: { queued: 1, executing: 0 },
    });
  });

  test("retains refused work and its feedback for inspection", async () => {
    const opened = createInMemoryBrowserDatabaseIntentOutbox(limits);
    if (!opened.ok) throw new Error("test setup failed");
    const enqueued = await opened.value.enqueue(draft("event/a"));
    if (!enqueued.ok) throw new Error("test enqueue failed");

    const refused = await opened.value.refuse("browser/global", "event/a", enqueued.value.sequence, {
      severity: "backpressure",
      code: "database-revision-conflict",
      detail: "revision changed",
    });
    expect(refused.ok && refused.value).toMatchObject({ queued: 0, executing: 0, refused: 1 });
    expect(refused.ok && refused.value.intents[0]).toMatchObject({
      status: "refused",
      refusal: { code: "database-revision-conflict", detail: "revision changed" },
    });
  });

  test("does not reserve settlement capacity for refused work", async () => {
    const opened = createInMemoryBrowserDatabaseIntentOutbox({
      maxIntents: 3,
      maxReceipts: 1,
      maxLedgerBytes: 4096,
    });
    if (!opened.ok) throw new Error("test setup failed");
    const first = await opened.value.enqueue(draft("event/a"));
    if (!first.ok) throw new Error("test enqueue failed");
    await opened.value.refuse("browser/global", "event/a", first.value.sequence, {
      severity: "heat",
      code: "database-revision-conflict",
      detail: "revision changed",
    });

    const second = await opened.value.enqueue(draft("event/b"));
    expect(second.ok && second.value.sequence).toBe(1);
    expect(await opened.value.read("browser/global")).toMatchObject({
      ok: true,
      value: { admission: "backpressured", queued: 1, refused: 1 },
    });
  });

  test("retains receipts in sequence order when settlements arrive out of order", async () => {
    const opened = createInMemoryBrowserDatabaseIntentOutbox(limits);
    if (!opened.ok) throw new Error("test setup failed");
    const first = await opened.value.enqueue(draft("event/a"));
    const second = await opened.value.enqueue(draft("event/b"));
    if (!first.ok || !second.ok) throw new Error("test enqueue failed");
    await opened.value.begin("browser/global", first.value.intentId, first.value.sequence);
    await opened.value.begin("browser/global", second.value.intentId, second.value.sequence);

    await opened.value.settle("browser/global", second.value.intentId, second.value.sequence, tick(1));
    const settled = await opened.value.settle("browser/global", first.value.intentId, first.value.sequence, tick(2));
    expect(settled.ok && settled.value.receipts.map((receipt) => receipt.sequence)).toEqual([0, 1]);
  });

  test("backpressures at the no-forget budget without changing retained work", async () => {
    const opened = createInMemoryBrowserDatabaseIntentOutbox({
      maxIntents: 1,
      maxReceipts: 1,
      maxLedgerBytes: 4096,
    });
    if (!opened.ok) throw new Error("test setup failed");
    await opened.value.enqueue(draft("event/a"));
    const rejected = await opened.value.enqueue(draft("event/b"));
    expect(rejected.ok ? null : rejected.feedback.code).toBe("intent-capacity-exhausted");
    const read = await opened.value.read("browser/global");
    expect(read.ok && read.value.intents.map((intent) => intent.intentId)).toEqual(["event/a"]);
  });

  test("reserves receipt capacity before execution and retains settled history", async () => {
    const opened = createInMemoryBrowserDatabaseIntentOutbox({
      maxIntents: 3,
      maxReceipts: 1,
      maxLedgerBytes: 4096,
    });
    if (!opened.ok) throw new Error("test setup failed");
    const first = await opened.value.enqueue(draft("event/a"));
    if (!first.ok) throw new Error("test enqueue failed");

    expect(await opened.value.enqueue(draft("event/b"))).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "intent-capacity-exhausted" },
    });
    await opened.value.begin("browser/global", first.value.intentId, first.value.sequence);
    await opened.value.settle("browser/global", first.value.intentId, first.value.sequence, tick());
    expect(await opened.value.enqueue(draft("event/b"))).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "intent-capacity-exhausted" },
    });
    expect(await opened.value.read("browser/global")).toMatchObject({
      ok: true,
      value: { queued: 0, executing: 0, settled: 1, receipts: [{ intentId: "event/a" }] },
    });
  });

  test("migrates the legacy pending ledger without inventing receipts", () => {
    expect(
      validateBrowserDatabaseIntentLedger({
        schema: "zeta.browser-database-intent-ledger.v1",
        databaseNodeId: "browser/global",
        nextSequence: 1,
        intents: [
          {
            schema: "zeta.browser-database-intent.v1",
            databaseNodeId: "browser/global",
            intentId: "event/a",
            expectedRevision: null,
            deltas: [{ eventId: "event/a", rowKey: "game/score", payload: "9000", weight: 1 }],
            sequence: 0,
            status: "pending",
            refusal: null,
          },
        ],
      }),
    ).toEqual({
      ok: true,
      value: {
        schema: "zeta.browser-database-intent-ledger.v2",
        databaseNodeId: "browser/global",
        nextSequence: 1,
        intents: [expect.objectContaining({ schema: "zeta.browser-database-intent.v2", status: "queued" })],
        receipts: [],
      },
    });
  });

  test("rejects sequence reuse across retained intents and receipts", () => {
    const duplicateSequence = validateBrowserDatabaseIntentLedger({
      schema: "zeta.browser-database-intent-ledger.v2",
      databaseNodeId: "browser/global",
      nextSequence: 1,
      intents: [
        {
          schema: "zeta.browser-database-intent.v2",
          ...draft("event/a"),
          sequence: 0,
          status: "refused",
          refusal: { severity: "heat", code: "database-refused", detail: "retained" },
        },
      ],
      receipts: [
        {
          schema: "zeta.browser-database-execution-receipt.v1",
          databaseNodeId: "browser/global",
          intentId: "event/b",
          sequence: 0,
          status: "settled",
          executorId: "tab-a",
          executorKind: "browser-tab",
          revision: 1,
          accepted: 1,
          duplicates: 0,
          deltaCount: 1,
        },
      ],
    });
    expect(duplicateSequence.ok ? null : duplicateSequence.feedback.code).toBe("intent-record-invalid");
  });

  test("turns close and malformed ledgers into typed failures", async () => {
    const malformed = decideBrowserDatabaseIntentEnqueue(
      { schema: "wrong", databaseNodeId: "browser/global", nextSequence: 0, intents: [] },
      draft("event/a"),
      limits,
    );
    expect(malformed.ok ? null : malformed.feedback.code).toBe("intent-record-invalid");

    const opened = createInMemoryBrowserDatabaseIntentOutbox(limits);
    if (!opened.ok) throw new Error("test setup failed");
    opened.value.close();
    const read = await opened.value.read("browser/global");
    expect(read.ok ? null : read.feedback.code).toBe("intent-store-closed");
  });
});
