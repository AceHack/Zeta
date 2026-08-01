import { describe, expect, test } from "bun:test";
import {
  BROWSER_CHECKPOINT_RECORD_SCHEMA,
  openNativeIndexedDbCheckpointPort,
  validateBrowserCheckpointRecord,
} from "./browser-indexeddb-checkpoint";

describe("browser IndexedDB checkpoint", () => {
  test("validates and copies checkpoint bytes", () => {
    const payload = new Uint8Array([1, 2, 3]);
    const result = validateBrowserCheckpointRecord({
      schema: BROWSER_CHECKPOINT_RECORD_SCHEMA,
      nodeId: "node-a",
      revision: 7,
      payload,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    payload[0] = 99;
    expect([...result.value.payload]).toEqual([1, 2, 3]);
  });

  test("rejects malformed records as typed feedback", () => {
    const result = validateBrowserCheckpointRecord({
      schema: BROWSER_CHECKPOINT_RECORD_SCHEMA,
      nodeId: "node-a",
      revision: -1,
      payload: [1, 2, 3],
    });

    expect(result).toEqual({
      ok: false,
      feedback: {
        severity: "heat",
        code: "checkpoint-record-invalid",
        detail:
          "A browser checkpoint must carry the current schema, a node identifier, a non-negative safe revision, and bytes.",
      },
    });
  });

  test("reports missing IndexedDB without throwing", async () => {
    const result = await openNativeIndexedDbCheckpointPort({}, { databaseName: "zeta", storeName: "checkpoints" });

    expect(result).toEqual({
      ok: false,
      feedback: {
        severity: "backpressure",
        code: "indexed-db-unavailable",
        detail: "This runtime does not expose IndexedDB.",
      },
    });
  });

  test("reports blocked capability inspection without throwing", async () => {
    const hostile = Object.defineProperty({}, "indexedDB", {
      get(): never {
        throw new Error("blocked");
      },
    });
    const result = await openNativeIndexedDbCheckpointPort(hostile, {
      databaseName: "zeta",
      storeName: "checkpoints",
    });

    expect(result).toEqual({
      ok: false,
      feedback: {
        severity: "heat",
        code: "indexed-db-unavailable",
        detail: "This runtime blocked access to IndexedDB.",
      },
    });
  });

  test("reports a native open exception as typed heat", async () => {
    const result = await openNativeIndexedDbCheckpointPort(
      {
        indexedDB: {
          open(): never {
            throw new Error("refused");
          },
        },
      },
      { databaseName: "zeta", storeName: "checkpoints" },
    );

    expect(result).toEqual({
      ok: false,
      feedback: {
        severity: "heat",
        code: "indexed-db-open-failed",
        detail: "IndexedDB open threw: Error: refused",
      },
    });
  });
});
