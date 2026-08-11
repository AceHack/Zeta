import { describe, expect, test } from "bun:test";
import {
  createInMemoryBrowserDatabaseIntentOutbox,
  decideBrowserDatabaseIntentEnqueue,
  type BrowserDatabaseIntentDraft,
} from "./browser-database-intent-outbox";

const limits = { maxIntents: 3, maxLedgerBytes: 4096 } as const;

function draft(intentId: string, rowKey = "game/score"): BrowserDatabaseIntentDraft {
  return {
    databaseNodeId: "browser/global",
    intentId,
    expectedRevision: null,
    deltas: [{ eventId: intentId, rowKey, payload: "9000", weight: 1 }],
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
    expect(read.ok && read.value.pending).toBe(2);
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

  test("removes only durably completed work and never reuses its sequence", async () => {
    const opened = createInMemoryBrowserDatabaseIntentOutbox(limits);
    if (!opened.ok) throw new Error("test setup failed");
    const first = await opened.value.enqueue(draft("event/a"));
    if (!first.ok) throw new Error("test enqueue failed");

    const completed = await opened.value.complete("browser/global", first.value.intentId, first.value.sequence);
    expect(completed.ok && completed.value.pending).toBe(0);
    const second = await opened.value.enqueue(draft("event/b"));
    expect(second.ok && second.value.sequence).toBe(1);
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
    expect(refused.ok && refused.value).toMatchObject({ pending: 0, refused: 1 });
    expect(refused.ok && refused.value.intents[0]).toMatchObject({
      status: "refused",
      refusal: { code: "database-revision-conflict", detail: "revision changed" },
    });
  });

  test("backpressures at the no-forget budget without changing retained work", async () => {
    const opened = createInMemoryBrowserDatabaseIntentOutbox({ maxIntents: 1, maxLedgerBytes: 4096 });
    if (!opened.ok) throw new Error("test setup failed");
    await opened.value.enqueue(draft("event/a"));
    const rejected = await opened.value.enqueue(draft("event/b"));
    expect(rejected.ok ? null : rejected.feedback.code).toBe("intent-capacity-exhausted");
    const read = await opened.value.read("browser/global");
    expect(read.ok && read.value.intents.map((intent) => intent.intentId)).toEqual(["event/a"]);
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
