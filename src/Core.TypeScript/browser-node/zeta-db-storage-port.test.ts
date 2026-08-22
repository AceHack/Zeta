import { describe, expect, test } from "bun:test";
import { createInMemoryZetaDbImagePort } from "../zetadb/zeta-db-node";
import { createZetaDbStoragePort } from "./zeta-db-storage-port";
import { InMemoryStoragePort, ZetaStorageCell, makeStorageRecord } from "./zeta-storage-cell";

const limits = { maxDeltas: 8, maxEntries: 32, maxCheckpointBytes: 32 * 1024 };

function open() {
  const opened = createZetaDbStoragePort({
    imagePort: createInMemoryZetaDbImagePort(),
    databaseNodeId: "browser/global/storage",
    executorId: "tab-a/storage",
    limits,
  });
  expect(opened.ok).toBe(true);
  if (!opened.ok) throw new Error(opened.reason);
  return opened.value;
}

describe("ZetaDB content-addressed storage port", () => {
  test("runs the storage cell primary path through the ZetaDB database kernel", async () => {
    const primary = open();
    const cell = new ZetaStorageCell({ nodeId: "node-a", primary });

    const first = await cell.write("stored in ZetaDB");
    const duplicate = await cell.write("stored in ZetaDB");
    expect(first.ok).toBe(true);
    expect(duplicate.ok).toBe(true);
    if (!first.ok || !duplicate.ok) return;
    expect(duplicate.value).toBe(first.value);
    expect(await cell.read(first.value)).toMatchObject({
      ok: true,
      value: { key: first.value, payload: "stored in ZetaDB" },
    });
    expect(await cell.list()).toEqual({ ok: true, value: [first.value] });
  });

  test("heals a fallback record into the ZetaDB primary path", async () => {
    const primary = open();
    const fallback = new InMemoryStoragePort();
    const record = makeStorageRecord("fallback content");
    await fallback.write(record);
    const cell = new ZetaStorageCell({ nodeId: "node-a", primary, fallback });

    expect(await cell.read(record.key)).toMatchObject({ ok: true, value: { payload: "fallback content" } });
    expect(await primary.read(record.key)).toMatchObject({ ok: true, value: { payload: "fallback content" } });
  });

  test("rejects records whose address does not match their payload", async () => {
    const port = open();
    const record = makeStorageRecord("original");

    expect(await port.write({ ...record, payload: "tampered" })).toEqual({
      ok: false,
      reason: "A storage record must be addressed by the Merkle hash of its payload.",
      severity: "heat",
    });
  });
});
