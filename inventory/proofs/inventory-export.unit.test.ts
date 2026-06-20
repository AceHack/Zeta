/**
 * Inventory — Phase 6 export/import UNIT tests (pure, no network, deterministic)
 * ---------------------------------------------------------------------------
 * Tests the SHARED logic in inventory/lib/inventory-export.js that BOTH the
 * browser (index.html) and the proofs use — so the CSV encoding / parsing that
 * the Phase-6 gate hinges on (round-trip identical across unicode / comma /
 * quote / apostrophe) is covered in isolation, not only end-to-end.
 *
 * Run:  bun test inventory/proofs/inventory-export.unit.test.ts
 *
 * Includes the BROKEN-vs-FIXED demonstration CLAUDE.md requires: a NAIVE CSV
 * parser (split on "," / "\n") corrupts rows with embedded commas, quotes, and
 * newlines; the real RFC-4180 parser round-trips them exactly.
 */
import { describe, test, expect } from "bun:test";
import IE, { type Column, type ParseResult } from "../lib/inventory-export.js";

// Column spec mirrors what index.html exports for CSV (core string/typed fields).
const COLUMNS: Column[] = [
  { key: "id", header: "id", kind: "int" },
  { key: "name", header: "name", kind: "string" },
  { key: "qty", header: "qty", kind: "int" },
  { key: "notes", header: "notes", kind: "string" },
  { key: "is_archived", header: "is_archived", kind: "bool" },
];

type Row = { id: number; name: string; qty: number | null; notes: string | null; is_archived: boolean };

// Tricky rows: apostrophe, embedded comma, embedded double-quote, embedded
// newline, unicode (accent + CJK + emoji), and a null cell.
const TRICKY: Row[] = [
  { id: 1, name: "O'Brien's Drill", qty: 3, notes: "left shelf, row 2, bin 7", is_archived: false },
  { id: 2, name: 'Cable, 6" "HD" run', qty: 12, notes: 'note with "quotes" and, commas', is_archived: false },
  { id: 3, name: "Café Ω 设备 🔧", qty: null, notes: "line one\nline two\r\nline three", is_archived: true },
];
const COMMA_ROW = TRICKY[1]!; // the embedded-comma+quote row, used in the broken/fixed pair

// Narrow the parse result (discriminated union) and fail loudly on the wrong arm.
function okItems(r: ParseResult): Record<string, unknown>[] {
  if (!r.ok) throw new Error("expected parse OK, got error: " + r.error);
  return r.items;
}
function errOf(r: ParseResult): string {
  if (r.ok) throw new Error("expected parse FAILURE, got ok");
  return r.error;
}

describe("CSV round-trip is value-identical for tricky characters", () => {
  test("apostrophe / comma / quote / newline / unicode / null all survive", () => {
    const csv = IE.toCSV(TRICKY, COLUMNS);
    const parsed = IE.parseCSVToItems(csv, COLUMNS);
    expect(parsed.ok).toBe(true);
    expect(okItems(parsed)).toEqual(TRICKY);
  });

  test("apostrophe is NOT mangled (O'Brien stays O'Brien, no leading guard char)", () => {
    const csv = IE.toCSV([{ id: 1, name: "O'Brien", qty: null, notes: null, is_archived: false }], COLUMNS);
    // apostrophe needs no quoting under RFC 4180
    expect(csv.split("\r\n")[1]).toBe("1,O'Brien,,,false");
  });

  test("embedded double-quote is doubled, comma/newline fields are quoted", () => {
    const csv = IE.toCSV([{ id: 9, name: 'a"b,c', qty: null, notes: "x\ny", is_archived: false }], COLUMNS);
    const dataLine = csv.split("\r\n").slice(1).join("\r\n").replace(/\r\n$/, "");
    expect(dataLine).toContain('"a""b,c"');   // quote doubled + field quoted for the comma
    expect(dataLine).toContain('"x\ny"');      // newline field quoted
  });
});

describe("BROKEN vs FIXED parser (Green != verified)", () => {
  const naiveParse = (csv: string): string[][] =>
    csv.trimEnd().split("\n").slice(1).map((line) => line.split(","));

  test("NAIVE split-parser CORRUPTS the comma/quote row (demonstrates the bug)", () => {
    const csv = IE.toCSV([COMMA_ROW], COLUMNS); // 'Cable, 6" "HD" run'
    const naive = naiveParse(csv);
    // the single data row splits into MORE than 5 cells because of the embedded comma
    expect(naive[0]!.length).not.toBe(COLUMNS.length);
  });

  test("REAL RFC-4180 parser preserves the SAME row exactly", () => {
    const csv = IE.toCSV([COMMA_ROW], COLUMNS);
    const real = IE.parseCSVToItems(csv, COLUMNS);
    expect(real.ok).toBe(true);
    expect(okItems(real)[0]).toEqual(COMMA_ROW);
  });
});

describe("CSV staging-check rejects a corrupted import (abort+report)", () => {
  test("header mismatch is reported, not silently accepted", () => {
    const bad = "id,name,qty,notes\n1,x,1,y\n"; // missing is_archived column
    const r = IE.parseCSVToItems(bad, COLUMNS);
    expect(r.ok).toBe(false);
    expect(errOf(r)).toContain("header");
  });
  test("wrong cell count in a row is reported", () => {
    const header = COLUMNS.map((c) => c.header).join(",");
    const bad = header + "\r\n" + "1,only,two\r\n";
    const r = IE.parseCSVToItems(bad, COLUMNS);
    expect(r.ok).toBe(false);
    expect(errOf(r)).toContain("cells");
  });
});

describe("JSON round-trip is lossless", () => {
  test("tricky items survive JSON serialize/parse exactly", () => {
    const json = IE.toJSON(TRICKY);
    const r = IE.parseJSON(json);
    expect(r.ok).toBe(true);
    expect(okItems(r)).toEqual(TRICKY);
  });
});

describe("QR deep-link URL build/parse", () => {
  const BASE = "https://lucent-financial-group.github.io/Zeta/inventory/";
  test("itemUrl builds ?item=<id>", () => {
    expect(IE.itemUrl(BASE, 42)).toBe(BASE + "?item=42");
  });
  test("itemUrl appends with & when the base already has a query", () => {
    expect(IE.itemUrl(BASE + "?x=1", 42)).toBe(BASE + "?x=1&item=42");
  });
  test("parseItemId extracts the id from a full URL", () => {
    expect(IE.parseItemId(IE.itemUrl(BASE, 211))).toBe(211);
  });
  test("parseItemId rejects junk / missing / non-positive (no wrong-item routing)", () => {
    expect(IE.parseItemId(BASE)).toBe(null);
    expect(IE.parseItemId(BASE + "?item=")).toBe(null);
    expect(IE.parseItemId(BASE + "?item=abc")).toBe(null);
    expect(IE.parseItemId(BASE + "?item=-5")).toBe(null);
    expect(IE.parseItemId(BASE + "?item=0")).toBe(null);
    expect(IE.parseItemId("?item=7")).toBe(7);
  });
});
