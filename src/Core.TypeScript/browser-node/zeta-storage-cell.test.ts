/**
 * zeta-storage-cell.test.ts — Tests for the ZetaStorageCell dual-path storage.
 */
import { describe, test, expect } from "bun:test";
import {
  createInMemoryStorageCell,
  InMemoryStoragePort,
  ZetaStorageCell,
  hashPayload,
  merkleToHex,
  makeStorageRecord,
} from "./zeta-storage-cell";

describe("zeta-storage-cell", () => {
  // ZSC-1: hashPayload is deterministic (same input → same hash)
  test("ZSC-1: hashPayload is deterministic", () => {
    const h1 = hashPayload("hello world");
    const h2 = hashPayload("hello world");
    expect(h1.hi).toBe(h2.hi);
    expect(h1.lo).toBe(h2.lo);
  });

  // ZSC-2: hashPayload is collision-resistant (different inputs → different hashes)
  test("ZSC-2 (negative): different payloads produce different hashes", () => {
    const h1 = hashPayload("hello world");
    const h2 = hashPayload("hello world!");
    expect(h1.hi !== h2.hi || h1.lo !== h2.lo).toBe(true);
  });

  // ZSC-3: merkleToHex produces a 32-char hex string
  test("ZSC-3: merkleToHex produces 32-char hex string", () => {
    const hash = hashPayload("test");
    const hex = merkleToHex(hash);
    expect(hex).toHaveLength(32);
    expect(/^[0-9a-f]+$/.test(hex)).toBe(true);
  });

  // ZSC-4: makeStorageRecord produces correct key
  test("ZSC-4: makeStorageRecord key matches hashPayload", () => {
    const record = makeStorageRecord("test payload");
    const expectedKey = merkleToHex(hashPayload("test payload"));
    expect(record.key).toBe(expectedKey);
    expect(record.payload).toBe("test payload");
  });

  // ZSC-5: write and read roundtrip
  test("ZSC-5: write and read roundtrip", async () => {
    const cell = createInMemoryStorageCell("node-1");
    const writeResult = await cell.write("hello");
    expect(writeResult.ok).toBe(true);
    if (!writeResult.ok) return;
    const readResult = await cell.read(writeResult.value);
    expect(readResult.ok).toBe(true);
    if (!readResult.ok) return;
    expect(readResult.value?.payload).toBe("hello");
  });

  // ZSC-6: read returns null for unknown key
  test("ZSC-6: read returns null for unknown key", async () => {
    const cell = createInMemoryStorageCell("node-1");
    const result = await cell.read("0000000000000000000000000000000000000000");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBeNull();
  });

  // ZSC-7: verify confirms correct payload
  test("ZSC-7: verify confirms correct payload", async () => {
    const cell = createInMemoryStorageCell("node-1");
    const writeResult = await cell.write("verified payload");
    expect(writeResult.ok).toBe(true);
    if (!writeResult.ok) return;
    expect(cell.verify(writeResult.value, "verified payload")).toBe(true);
  });

  // ZSC-8 (negative): verify rejects tampered payload
  test("ZSC-8 (negative): verify rejects tampered payload", async () => {
    const cell = createInMemoryStorageCell("node-1");
    const writeResult = await cell.write("original");
    expect(writeResult.ok).toBe(true);
    if (!writeResult.ok) return;
    expect(cell.verify(writeResult.value, "tampered")).toBe(false);
  });

  // ZSC-9: dual-path write goes to both primary and fallback
  test("ZSC-9: dual-path write goes to both primary and fallback", async () => {
    const primary = new InMemoryStoragePort();
    const fallback = new InMemoryStoragePort();
    const cell = new ZetaStorageCell({ nodeId: "node-1", primary, fallback });
    const writeResult = await cell.write("dual path test");
    expect(writeResult.ok).toBe(true);
    if (!writeResult.ok) return;
    // Both backends should have the record
    const primaryRead = await primary.read(writeResult.value);
    const fallbackRead = await fallback.read(writeResult.value);
    expect(primaryRead.ok && primaryRead.value?.payload).toBe("dual path test");
    expect(fallbackRead.ok && fallbackRead.value?.payload).toBe("dual path test");
  });

  // ZSC-10: read falls back to secondary if primary returns null
  test("ZSC-10: read falls back to secondary if primary returns null", async () => {
    const primary = new InMemoryStoragePort();
    const fallback = new InMemoryStoragePort();
    const cell = new ZetaStorageCell({ nodeId: "node-1", primary, fallback });
    // Write only to fallback
    const record = makeStorageRecord("fallback only");
    await fallback.write(record);
    // Read from cell (should fall back to secondary)
    const readResult = await cell.read(record.key);
    expect(readResult.ok).toBe(true);
    if (!readResult.ok) return;
    expect(readResult.value?.payload).toBe("fallback only");
  });

  // ZSC-11: list returns all written keys
  test("ZSC-11: list returns all written keys", async () => {
    const cell = createInMemoryStorageCell("node-1");
    await cell.write("item 1");
    await cell.write("item 2");
    await cell.write("item 3");
    const listResult = await cell.list();
    expect(listResult.ok).toBe(true);
    if (!listResult.ok) return;
    expect(listResult.value.length).toBe(3);
  });

  // ZSC-12: content-addressed deduplication (same payload → same key, stored once)
  test("ZSC-12: same payload deduplicates (content-addressed)", async () => {
    const cell = createInMemoryStorageCell("node-1");
    const r1 = await cell.write("deduplicated content");
    const r2 = await cell.write("deduplicated content");
    expect(r1.ok && r2.ok).toBe(true);
    if (!r1.ok || !r2.ok) return;
    // Same content → same key
    expect(r1.value).toBe(r2.value);
    // Only one record in storage
    const listResult = await cell.list();
    expect(listResult.ok).toBe(true);
    if (!listResult.ok) return;
    expect(listResult.value.length).toBe(1);
  });
});
