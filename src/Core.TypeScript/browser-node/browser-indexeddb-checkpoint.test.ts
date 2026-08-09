import { describe, expect, test } from "bun:test";
import { openNativeIndexedDbCheckpointPort } from "./browser-indexeddb-checkpoint";

describe("browser IndexedDB checkpoint", () => {
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
