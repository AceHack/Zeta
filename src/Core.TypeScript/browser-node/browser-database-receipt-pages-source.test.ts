import { describe, expect, test } from "bun:test";
import {
  BROWSER_DATABASE_RECEIPT_PAGES_INDEX_PATH,
  BROWSER_DATABASE_RECEIPT_PAGES_RECORD_ROOT,
  type BrowserDatabaseReceiptPagesIndex,
} from "./browser-database-receipt-pages-contract";
import {
  createBrowserDatabaseReceiptPagesSource,
  type BrowserDatabaseReceiptPagesFetch,
  type BrowserDatabaseReceiptPagesSourceLimits,
} from "./browser-database-receipt-pages-source";

const baseUrl = "https://lucent-financial-group.github.io/Zeta/hall/room/";
const expectedOrigin = "https://lucent-financial-group.github.io";
const revision = "a".repeat(40);
const hash = "1".repeat(64);
const targetPath = `db/receipts/browser/v1/${hash}.json`;
const recordPayload = new TextEncoder().encode('{"accepted":true}\n');
const limits: BrowserDatabaseReceiptPagesSourceLimits = {
  maxIndexBytes: 4096,
  maxRecords: 8,
  maxAuthors: 8,
  maxRecordBytes: 1024,
};

function index(overrides: Partial<BrowserDatabaseReceiptPagesIndex> = {}): BrowserDatabaseReceiptPagesIndex {
  return {
    schema: "zeta.browser-database-receipt-pages-index.v2",
    repository: "Lucent-Financial-Group/Zeta",
    ref: "main",
    revision,
    proposalAuthority: {
      registrySequence: 7,
      authors: [
        {
          credentialId: "credential-a",
          origin: expectedOrigin,
          rpId: "lucent-financial-group.github.io",
        },
      ],
    },
    records: [{ targetPath, byteLength: recordPayload.byteLength }],
    ...overrides,
  };
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(`${JSON.stringify(value)}\n`, {
    status,
    headers: { "content-type": "application/json" },
  });
}

function open(fetchImpl: BrowserDatabaseReceiptPagesFetch, sourceLimits = limits) {
  const result = createBrowserDatabaseReceiptPagesSource({
    baseUrl,
    expectedOrigin,
    fetch: fetchImpl,
    limits: sourceLimits,
  });
  if (!result.ok) throw new Error(result.feedback.detail);
  return result.value;
}

describe("browser database receipt Pages accepted-record source", () => {
  test("reads the immutable proposal-author binding without browser credentials", async () => {
    const source = open(() => Promise.resolve(jsonResponse(index())));

    expect(await source.readIndex()).toEqual({ ok: true, value: index() });
  });

  test("reads an indexed record from the trusted origin without browser credentials", async () => {
    const calls: { readonly input: string; readonly init: RequestInit }[] = [];
    const source = open((input, init) => {
      calls.push({ input, init });
      return Promise.resolve(calls.length === 1 ? jsonResponse(index()) : new Response(recordPayload));
    });

    const result = await source.read(targetPath);

    expect(result).toEqual({
      ok: true,
      value: {
        schema: "zeta.browser-database-receipt-accepted-record.v1",
        repository: "Lucent-Financial-Group/Zeta",
        ref: "main",
        revision,
        targetPath,
        payload: recordPayload,
      },
    });
    expect(calls.map((call) => call.input)).toEqual([
      `${baseUrl}${BROWSER_DATABASE_RECEIPT_PAGES_INDEX_PATH}`,
      `${baseUrl}${BROWSER_DATABASE_RECEIPT_PAGES_RECORD_ROOT}/${hash}.json`,
    ]);
    for (const call of calls) {
      expect(call.init).toMatchObject({ method: "GET", credentials: "omit", cache: "no-store", redirect: "error" });
      expect(call.init).not.toHaveProperty("body");
    }
  });

  test("returns cold absence for an undeployed index, unlisted record, or missing record", async () => {
    expect(await open(() => Promise.resolve(new Response(null, { status: 404 }))).read(targetPath)).toEqual({
      ok: true,
      value: null,
    });

    let calls = 0;
    const unlisted = open(() => {
      calls++;
      return Promise.resolve(jsonResponse(index({ records: [] })));
    });
    expect(await unlisted.read(targetPath)).toEqual({ ok: true, value: null });
    expect(calls).toBe(1);

    const missingRecord = open((input) =>
      Promise.resolve(input.endsWith("index.json") ? jsonResponse(index()) : new Response(null, { status: 404 })),
    );
    expect(await missingRecord.read(targetPath)).toEqual({ ok: true, value: null });
  });

  test("rejects cross-origin configuration and non-canonical target paths before fetch", async () => {
    expect(
      createBrowserDatabaseReceiptPagesSource({
        baseUrl: "https://example.test/Zeta/",
        expectedOrigin,
        fetch: () => Promise.resolve(jsonResponse(index())),
        limits,
      }),
    ).toMatchObject({
      ok: false,
      feedback: { code: "receipt-handoff-acceptance-pages-configuration-invalid" },
    });

    let calls = 0;
    const source = open(() => {
      calls++;
      return Promise.resolve(jsonResponse(index()));
    });
    expect(await source.read("../secrets.json")).toMatchObject({
      ok: false,
      feedback: { code: "receipt-handoff-acceptance-pages-index-invalid" },
    });
    expect(calls).toBe(0);
  });

  test("rejects wrong identity, mutable revision, and unsorted or duplicate index entries", async () => {
    const invalid = [
      { ...index(), repository: "other/repository" },
      { ...index(), ref: "topic" },
      { ...index(), revision: "main" },
      { ...index(), proposalAuthority: { ...index().proposalAuthority, registrySequence: -1 } },
      {
        ...index(),
        proposalAuthority: {
          registrySequence: 7,
          authors: [...index().proposalAuthority.authors, ...index().proposalAuthority.authors],
        },
      },
      {
        ...index(),
        records: [
          { targetPath: `db/receipts/browser/v1/${"2".repeat(64)}.json`, byteLength: 1 },
          { targetPath, byteLength: recordPayload.byteLength },
        ],
      },
      { ...index(), records: [index().records[0], index().records[0]] },
    ];
    for (const value of invalid) {
      expect(await open(() => Promise.resolve(jsonResponse(value))).read(targetPath)).toMatchObject({
        ok: false,
        feedback: { code: "receipt-handoff-acceptance-pages-index-invalid" },
      });
    }
  });

  test("enforces finite streamed index, record-count, and record-byte budgets", async () => {
    expect(
      await open(() => Promise.resolve(jsonResponse(index())), { ...limits, maxIndexBytes: 1 }).read(targetPath),
    ).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "receipt-handoff-acceptance-pages-capacity-exhausted" },
    });

    expect(
      await open(() => Promise.resolve(jsonResponse(index({ records: [...index().records, ...index().records] }))), {
        ...limits,
        maxRecords: 1,
      }).read(targetPath),
    ).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "receipt-handoff-acceptance-pages-capacity-exhausted" },
    });

    const oversizedRecord = open(
      (input) => Promise.resolve(input.endsWith("index.json") ? jsonResponse(index()) : new Response(recordPayload)),
      { ...limits, maxRecordBytes: recordPayload.byteLength - 1 },
    );
    expect(await oversizedRecord.read(targetPath)).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "receipt-handoff-acceptance-pages-capacity-exhausted" },
    });
  });

  test("rejects byte-length mismatches and turns network or HTTP faults into typed feedback", async () => {
    const mismatched = open((input) =>
      Promise.resolve(input.endsWith("index.json") ? jsonResponse(index()) : new Response("short")),
    );
    expect(await mismatched.read(targetPath)).toMatchObject({
      ok: false,
      feedback: { code: "receipt-handoff-acceptance-pages-index-invalid" },
    });

    expect(await open(() => Promise.reject(new Error("offline"))).read(targetPath)).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "receipt-handoff-acceptance-pages-transport-failed" },
    });
    expect(await open(() => Promise.resolve(new Response(null, { status: 429 }))).read(targetPath)).toMatchObject({
      ok: false,
      feedback: { severity: "backpressure", code: "receipt-handoff-acceptance-pages-transport-failed" },
    });
  });
});
