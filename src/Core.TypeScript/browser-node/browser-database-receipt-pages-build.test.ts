import { afterEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildBrowserDatabaseReceiptPages,
  type BrowserDatabaseReceiptPagesBuildLimits,
} from "./browser-database-receipt-pages-build";
import {
  BROWSER_DATABASE_RECEIPT_PAGES_INDEX_PATH,
  BROWSER_DATABASE_RECEIPT_PAGES_RECORD_ROOT,
  type BrowserDatabaseReceiptPagesIndex,
} from "./browser-database-receipt-pages-contract";

const roots: string[] = [];
const revision = "a".repeat(40);
const limits: BrowserDatabaseReceiptPagesBuildLimits = {
  maxRecords: 8,
  maxRecordBytes: 1024,
  maxIndexBytes: 4096,
};

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function root(): string {
  const value = mkdtempSync(join(tmpdir(), "zeta-receipt-pages-"));
  roots.push(value);
  return value;
}

function acceptedDir(sourceDir: string): string {
  return join(sourceDir, "db", "receipts", "browser", "v1");
}

describe("browser database receipt Pages build", () => {
  test("emits an empty revision-bound index when main has no accepted receipt records", () => {
    const sourceDir = root();
    const outDir = root();
    const result = buildBrowserDatabaseReceiptPages({ sourceDir, outDir, revision, limits });

    expect(result).toMatchObject({ ok: true, value: { recordCount: 0, recordBytes: 0 } });
    const index = JSON.parse(
      readFileSync(join(outDir, BROWSER_DATABASE_RECEIPT_PAGES_INDEX_PATH), "utf8"),
    ) as BrowserDatabaseReceiptPagesIndex;
    expect(index).toEqual({
      schema: "zeta.browser-database-receipt-pages-index.v1",
      repository: "Lucent-Financial-Group/Zeta",
      ref: "main",
      revision,
      records: [],
    });
  });

  test("sorts canonical records and copies their exact bytes without truncation", () => {
    const sourceDir = root();
    const outDir = root();
    const source = acceptedDir(sourceDir);
    mkdirSync(source, { recursive: true });
    const firstName = `${"1".repeat(64)}.json`;
    const secondName = `${"f".repeat(64)}.json`;
    const first = new TextEncoder().encode('{"sequence":1}\n');
    const second = new TextEncoder().encode('{"sequence":2}\n');
    writeFileSync(join(source, secondName), second);
    writeFileSync(join(source, firstName), first);

    const result = buildBrowserDatabaseReceiptPages({ sourceDir, outDir, revision, limits });

    expect(result).toEqual({
      ok: true,
      value: {
        indexPath: join(outDir, BROWSER_DATABASE_RECEIPT_PAGES_INDEX_PATH),
        recordCount: 2,
        recordBytes: first.byteLength + second.byteLength,
      },
    });
    const index = JSON.parse(
      readFileSync(join(outDir, BROWSER_DATABASE_RECEIPT_PAGES_INDEX_PATH), "utf8"),
    ) as BrowserDatabaseReceiptPagesIndex;
    expect(index.records).toEqual([
      { targetPath: `db/receipts/browser/v1/${firstName}`, byteLength: first.byteLength },
      { targetPath: `db/receipts/browser/v1/${secondName}`, byteLength: second.byteLength },
    ]);
    expect(Array.from(readFileSync(join(outDir, BROWSER_DATABASE_RECEIPT_PAGES_RECORD_ROOT, firstName)))).toEqual(
      Array.from(first),
    );
    expect(Array.from(readFileSync(join(outDir, BROWSER_DATABASE_RECEIPT_PAGES_RECORD_ROOT, secondName)))).toEqual(
      Array.from(second),
    );
  });

  test("fails closed on malformed directory entries instead of publishing an ambiguous index", () => {
    const sourceDir = root();
    const outDir = root();
    const source = acceptedDir(sourceDir);
    mkdirSync(source, { recursive: true });
    writeFileSync(join(source, "latest.json"), "{}\n", "utf8");

    const result = buildBrowserDatabaseReceiptPages({ sourceDir, outDir, revision, limits });

    expect(result).toEqual({
      ok: false,
      error: "The accepted receipt directory contains a non-canonical entry: latest.json.",
    });
    expect(existsSync(join(outDir, BROWSER_DATABASE_RECEIPT_PAGES_INDEX_PATH))).toBe(false);
  });

  test("backpressures record-count, record-byte, and index-byte budgets without partial output", () => {
    const sourceDir = root();
    const source = acceptedDir(sourceDir);
    mkdirSync(source, { recursive: true });
    writeFileSync(join(source, `${"1".repeat(64)}.json`), "one", "utf8");
    writeFileSync(join(source, `${"2".repeat(64)}.json`), "two", "utf8");

    const countOut = root();
    expect(
      buildBrowserDatabaseReceiptPages({ sourceDir, outDir: countOut, revision, limits: { ...limits, maxRecords: 1 } }),
    ).toMatchObject({ ok: false, error: expect.stringContaining("no-truncation budget") });
    expect(existsSync(join(countOut, BROWSER_DATABASE_RECEIPT_PAGES_INDEX_PATH))).toBe(false);

    const recordOut = root();
    expect(
      buildBrowserDatabaseReceiptPages({
        sourceDir,
        outDir: recordOut,
        revision,
        limits: { ...limits, maxRecordBytes: 1 },
      }),
    ).toMatchObject({ ok: false, error: expect.stringContaining("Pages budget") });
    expect(existsSync(join(recordOut, BROWSER_DATABASE_RECEIPT_PAGES_INDEX_PATH))).toBe(false);

    const indexOut = root();
    expect(
      buildBrowserDatabaseReceiptPages({
        sourceDir,
        outDir: indexOut,
        revision,
        limits: { ...limits, maxIndexBytes: 1 },
      }),
    ).toMatchObject({ ok: false, error: expect.stringContaining("index needs") });
    expect(existsSync(join(indexOut, BROWSER_DATABASE_RECEIPT_PAGES_INDEX_PATH))).toBe(false);
  });

  test("rejects mutable revisions and invalid build limits", () => {
    const sourceDir = root();
    const outDir = root();
    expect(buildBrowserDatabaseReceiptPages({ sourceDir, outDir, revision: "main", limits })).toMatchObject({
      ok: false,
    });
    expect(
      buildBrowserDatabaseReceiptPages({ sourceDir, outDir, revision, limits: { ...limits, maxRecords: 0 } }),
    ).toMatchObject({ ok: false });
  });
});
