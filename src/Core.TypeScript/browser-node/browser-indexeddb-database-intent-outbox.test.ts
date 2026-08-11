import { describe, expect, test } from "bun:test";
import { openNativeIndexedDbDatabaseIntentOutbox } from "./browser-indexeddb-database-intent-outbox";

const options = {
  databaseName: "zeta-intents",
  storeName: "intent-ledgers",
  limits: { maxIntents: 16, maxLedgerBytes: 64 * 1024 },
} as const;

describe("browser IndexedDB database intent outbox", () => {
  test("reports missing and blocked IndexedDB as typed feedback", async () => {
    expect(await openNativeIndexedDbDatabaseIntentOutbox({}, options)).toEqual({
      ok: false,
      feedback: {
        severity: "backpressure",
        code: "intent-read-failed",
        detail: "This runtime does not expose IndexedDB.",
      },
    });

    const hostile = Object.defineProperty({}, "indexedDB", {
      get(): never {
        throw new Error("blocked");
      },
    });
    expect(await openNativeIndexedDbDatabaseIntentOutbox(hostile, options)).toEqual({
      ok: false,
      feedback: {
        severity: "heat",
        code: "intent-read-failed",
        detail: "This runtime blocked IndexedDB access.",
      },
    });
  });

  test("reports native open exceptions without throwing", async () => {
    const result = await openNativeIndexedDbDatabaseIntentOutbox(
      {
        indexedDB: {
          open(): never {
            throw new Error("refused");
          },
        },
      },
      options,
    );
    expect(result).toEqual({
      ok: false,
      feedback: {
        severity: "heat",
        code: "intent-read-failed",
        detail: "IndexedDB outbox open threw: Error: refused",
      },
    });
  });
});
