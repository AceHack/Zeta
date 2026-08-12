import { describe, expect, test } from "bun:test";
import { openNativeIndexedDbDatabaseIntentOutbox } from "./browser-indexeddb-database-intent-outbox";

const options = {
  databaseName: "zeta-intents",
  storeName: "intent-ledgers",
  limits: { maxIntents: 16, maxReceipts: 64, maxLedgerBytes: 64 * 1024 },
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

  test("refuses an ARRAY-shaped IndexedDB without ever calling into it", async () => {
    // The runtime-shape guard is `value !== null && typeof value === "object" && !Array.isArray(value)`,
    // and the array exclusion is the half nothing exercised. It matters because `&&` binds tighter
    // than `||`: weaken the first conjunction and the guard reads
    // `value !== null || (typeof value === "object" && !Array.isArray(value))`, which is true for
    // EVERYTHING — strings, arrays, and `null` too, since `typeof null === "object"`. Every
    // `!isRecord(...)` check in this module then stops rejecting anything.
    //
    // Most malformed factories still fail closed by luck: `method` catches the `Reflect.get` throw
    // and returns null for non-functions, so the typed feedback comes out the same either way. An
    // array CARRYING an `open` function is the case that separates them — the weakened guard admits
    // it and calls into a factory this module is supposed to have refused.
    let opened = false;
    const arrayFactory = Object.assign([], {
      open(): never {
        opened = true;
        throw new Error("an array is not an IndexedDB factory");
      },
    });

    expect(await openNativeIndexedDbDatabaseIntentOutbox({ indexedDB: arrayFactory }, options)).toEqual({
      ok: false,
      feedback: {
        severity: "backpressure",
        code: "intent-read-failed",
        detail: "This runtime does not expose IndexedDB.",
      },
    });
    // The refusal must happen at the shape check, not by surviving the call.
    expect(opened).toBe(false);
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
