import { describe, expect, test } from "bun:test";
import {
  BROWSER_CHECKPOINT_RECORD_SCHEMA,
  browserCheckpointFailed,
  browserCheckpointSucceeded,
  type BrowserCheckpointPort,
  type BrowserCheckpointRecord,
} from "./browser-checkpoint-port";
import { createBrowserZetaDbImagePort, openBrowserZetaDbImagePort } from "./browser-zetadb-image-port";
import { runZetaDbNodeTick } from "../zetadb/zeta-db-node";

function fakeCheckpointPort(): BrowserCheckpointPort {
  let stored: BrowserCheckpointRecord | null = null;
  return {
    load: () => Promise.resolve(browserCheckpointSucceeded(stored)),
    save: (record) => {
      if (stored !== null && stored.revision === record.revision) {
        return Promise.resolve(
          browserCheckpointFailed(
            "checkpoint-revision-conflict",
            `Checkpoint revision ${String(record.revision)} already names different bytes.`,
            "backpressure",
          ),
        );
      }
      stored = {
        schema: BROWSER_CHECKPOINT_RECORD_SCHEMA,
        nodeId: record.nodeId,
        revision: record.revision,
        payload: new Uint8Array(record.payload),
      };
      return Promise.resolve(browserCheckpointSucceeded(stored));
    },
    remove: () => Promise.resolve(browserCheckpointSucceeded(false)),
    close: () => browserCheckpointSucceeded(null),
  };
}

describe("browser ZetaDB image port", () => {
  test("runs the database through the browser-owned checkpoint boundary", async () => {
    const port = createBrowserZetaDbImagePort(fakeCheckpointPort());
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
        detail: "Checkpoint revision 1 already names different bytes.",
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
