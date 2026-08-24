import { describe, expect, test } from "bun:test";
import { createReservedCapacityAdmissionPolicy } from "../zetadb/admission-policy";
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
    convergencePolicy: { maxAttempts: 3 },
  });
  expect(opened.ok).toBe(true);
  if (!opened.ok) throw new Error(opened.reason);
  return opened.value;
}

describe("ZetaDB content-addressed storage port", () => {
  test("rejects an unbounded convergence policy before opening the port", () => {
    expect(
      createZetaDbStoragePort({
        imagePort: createInMemoryZetaDbImagePort(),
        databaseNodeId: "browser/global/storage",
        executorId: "tab-a/storage",
        limits,
        convergencePolicy: { maxAttempts: 0 },
      }),
    ).toEqual({
      ok: false,
      reason: "A ZetaDB storage port requires identifiers and positive safe-integer tick and convergence budgets.",
      severity: "heat",
    });
  });

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

  // ── 081KZM0FTJM-adjacent · defect 1 · a write that never landed must not report success ──────
  //
  // Witnessed on 518499177: with `maxEntries: 2`, the kernel returned the correct
  // typed backpressure — `ok: true, admission: "backpressured", accepted: 0` with
  // `database-capacity-exhausted` — and the adapter collapsed it to
  // `{ ok: true, value: "<key of k3>" }` while the durable image held only k1 and k2.
  // A content-addressed write returned the address of a record nothing stored.
  test("refuses a write the admission budget could not admit", async () => {
    const opened = createZetaDbStoragePort({
      imagePort: createInMemoryZetaDbImagePort(),
      databaseNodeId: "browser/global/storage",
      executorId: "tab-a/storage",
      limits: { maxDeltas: 8, maxEntries: 2, maxCheckpointBytes: 32 * 1024 },
      convergencePolicy: { maxAttempts: 3 },
    });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const port = opened.value;

    const first = makeStorageRecord("k1");
    const second = makeStorageRecord("k2");
    const third = makeStorageRecord("k3");
    expect((await port.write(first)).ok).toBe(true);
    expect((await port.write(second)).ok).toBe(true);

    const refused = await port.write(third);
    expect(refused.ok).toBe(false);
    if (!refused.ok) {
      expect(refused.severity).toBe("backpressure");
      expect(refused.reason).toContain("database-capacity-exhausted");
    }
    // The refusal must agree with the store: the record really is not there.
    expect(await port.read(third.key)).toEqual({ ok: true, value: null });
    expect(await port.list()).toEqual({ ok: true, value: [first.key, second.key] });
  });

  test("forwards reserved headroom through the browser storage adapter", async () => {
    const policy = createReservedCapacityAdmissionPolicy({ retainedEvents: 1, checkpointBytes: 0 });
    expect(policy.ok).toBe(true);
    if (!policy.ok) return;
    const opened = createZetaDbStoragePort({
      imagePort: createInMemoryZetaDbImagePort(),
      databaseNodeId: "browser/global/storage",
      executorId: "tab-a/reserved-storage",
      limits: { maxDeltas: 8, maxEntries: 2, maxCheckpointBytes: 32 * 1024 },
      convergencePolicy: { maxAttempts: 3 },
      admissionPolicy: policy.value,
    });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const first = makeStorageRecord("reserved/first");
    const held = makeStorageRecord("reserved/held");

    expect((await opened.value.write(first)).ok).toBe(true);
    const refused = await opened.value.write(held);
    expect(refused).toMatchObject({ ok: false, severity: "backpressure" });
    if (!refused.ok) expect(refused.reason).toContain("reserved-capacity policy held 1 entries");
    expect(await opened.value.list()).toEqual({ ok: true, value: [first.key] });
  });

  // The other half of the same fix: "nothing was accepted" is NOT "nothing could be
  // accepted". Re-writing a stored record is a duplicate, and content-addressed writes
  // are idempotent (§12) — a naive `accepted === 0` guard would break this.
  test("keeps an idempotent re-write successful even though it admits no delta", async () => {
    const port = open();
    const record = makeStorageRecord("written once");
    expect(await port.write(record)).toEqual({ ok: true, value: record.key });
    expect(await port.write(record)).toEqual({ ok: true, value: record.key });
    expect(await port.list()).toEqual({ ok: true, value: [record.key] });
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
