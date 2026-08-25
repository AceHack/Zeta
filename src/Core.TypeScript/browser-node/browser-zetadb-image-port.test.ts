import { describe, expect, test } from "bun:test";
import {
  browserCheckpointSucceeded,
  copyBrowserCheckpointRecord,
  decideBrowserCheckpointSave,
  type BrowserCheckpointPort,
  type BrowserCheckpointRecord,
} from "./browser-checkpoint-port";
import { createBrowserZetaDbImagePort, openBrowserZetaDbImagePort } from "./browser-zetadb-image-port";
import { runConvergentZetaDbNodeTick, runZetaDbNodeTick } from "../zetadb/zeta-db-node";
import { monotoneLastWriterWinsRevisionPolicy } from "../persistence/revision-policy";
import { canonicalEventIdRetentionPolicy } from "../zetadb/retention-policy";

function fakeCheckpointPort(): BrowserCheckpointPort {
  let stored: BrowserCheckpointRecord | null = null;
  return {
    revisionPolicy: monotoneLastWriterWinsRevisionPolicy,
    load: () => Promise.resolve(browserCheckpointSucceeded(stored)),
    save: (record) => {
      const decision = decideBrowserCheckpointSave(stored, record, monotoneLastWriterWinsRevisionPolicy);
      if (!decision.ok) return Promise.resolve(decision);
      stored = copyBrowserCheckpointRecord(decision.value.record);
      return Promise.resolve(browserCheckpointSucceeded(copyBrowserCheckpointRecord(stored)));
    },
    remove: () => Promise.resolve(browserCheckpointSucceeded(false)),
    close: () => browserCheckpointSucceeded(null),
  };
}

describe("browser ZetaDB image port", () => {
  test("runs the database through the browser-owned checkpoint boundary", async () => {
    const checkpoints = fakeCheckpointPort();
    const port = createBrowserZetaDbImagePort(checkpoints);
    expect(port.revisionPolicy).toBe(checkpoints.revisionPolicy);
    const result = await runZetaDbNodeTick(port, {
      nodeId: "browser/global",
      executorId: "tab/1",
      executorKind: "browser-tab",
      deltas: [{ eventId: "event/1", rowKey: "counter", payload: "counter", weight: 1 }],
      limits: { maxDeltas: 8, maxEntries: 16, maxCheckpointBytes: 16 * 1024 },
    });

    expect(result.ok && result.value).toMatchObject({
      revision: 1,
      rows: [{ rowKey: "counter", payload: "counter", weight: 1 }],
    });
    const loaded = await port.load("browser/global");
    expect(loaded.ok && loaded.value?.revision).toBe(1);
  });

  test("maps browser revision races to database backpressure", async () => {
    const port = createBrowserZetaDbImagePort(fakeCheckpointPort());
    const record = { nodeId: "browser/global", revision: 1, payload: new Uint8Array([1]) };
    await port.save(record);
    const conflict = await port.save({ ...record, payload: new Uint8Array([2]) });

    expect(conflict).toEqual({
      ok: false,
      feedback: {
        severity: "backpressure",
        code: "database-revision-conflict",
        detail: "Revision 1 already names different bytes.",
      },
    });
  });

  test("executes retained-set selection through the browser-owned image port", async () => {
    const port = createBrowserZetaDbImagePort(fakeCheckpointPort());
    const request = (eventIds: readonly string[]) => ({
      nodeId: "browser/global",
      executorId: "tab/retention",
      executorKind: "browser-tab" as const,
      deltas: eventIds.map((eventId) => ({ eventId, rowKey: `row/${eventId}`, payload: eventId, weight: 1 })),
      limits: { maxDeltas: 8, maxEntries: 2, maxCheckpointBytes: 16 * 1024 },
    });

    expect(
      (
        await runConvergentZetaDbNodeTick(
          port,
          request(["e3", "e4"]),
          { maxAttempts: 2 },
          undefined,
          canonicalEventIdRetentionPolicy,
        )
      ).ok,
    ).toBe(true);
    const result = await runConvergentZetaDbNodeTick(
      port,
      request(["e1", "e2"]),
      { maxAttempts: 2 },
      undefined,
      canonicalEventIdRetentionPolicy,
    );

    expect(result.ok && result.value).toMatchObject({
      revision: 2,
      rows: [
        { rowKey: "row/e1", payload: "e1", weight: 1 },
        { rowKey: "row/e2", payload: "e2", weight: 1 },
      ],
      retentionReceipt: {
        policyId: "canonical-event-id",
        displacedEventIds: ["e3", "e4"],
      },
    });
  });

  test("reports IndexedDB absence as typed feedback", async () => {
    const opened = await openBrowserZetaDbImagePort({}, { databaseName: "zeta", storeName: "database-images" });

    expect(opened).toEqual({
      ok: false,
      feedback: {
        severity: "backpressure",
        code: "database-read-failed",
        detail: "This runtime does not expose IndexedDB.",
      },
    });
  });
});
