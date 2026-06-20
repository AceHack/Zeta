/**
 * Inventory — shared export / import / deep-link logic (Phase 6)
 * ---------------------------------------------------------------------------
 * ONE SOURCE OF TRUTH for CSV/JSON serialize+parse and the QR deep-link URL,
 * used by BOTH:
 *   - index.html (loaded as a same-origin <script src> -> window.InventoryExport;
 *     CSP script-src 'self' already permits it, no build step)
 *   - inventory/proofs/inventory-export.unit.test.ts  (bun test, CJS interop)
 *   - inventory/proofs/phase6-export-roundtrip.ts      (staging-check round-trip)
 *
 * It is PURE (no DOM, no network) so the CSV encoding / parsing is unit-testable
 * in isolation — the part the Phase-6 gate cares about (round-trip identical
 * across unicode / comma / quote / apostrophe edge cases).
 *
 * CSV dialect: RFC 4180.
 *   - A field is quoted iff it contains  "  ,  CR  or  LF .
 *   - An embedded  "  is escaped by doubling it ("").
 *   - Records separated by CRLF.
 *   - VALUE-EXACT round trip: no UTF-8 BOM is emitted (a BOM would change the
 *     bytes and break "round-trip identical"); a leading BOM IS stripped on parse
 *     for defensiveness. We deliberately do NOT apply CSV-formula-injection
 *     guarding (prefixing =,+,-,@ with a quote) here, because that would mutate
 *     the value and break the gate's round-trip-identity requirement. That
 *     hardening, if wanted, is a separate "safe export" concern for later — it is
 *     NOT silently applied to the backup/round-trip path. (Apostrophes are not
 *     CSV-special and are passed through untouched — O'Brien stays O'Brien.)
 *
 * Empty cells: a nullable field that is null/undefined serializes to an empty CSV
 * cell, and an empty CSV cell parses back to null — so null round-trips to null.
 *
 * UMD wrapper: no import/export keywords, so it loads in a non-module browser
 * <script> AND is requireable/importable by bun.
 */
(function (root, factory) {
  "use strict";
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api; // bun / node
  root.InventoryExport = api; // browser global
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // ----- deep-link URL (QR encodes this) -----------------------------------
  // The QR encodes a URL to the item's record. The id is the stable surrogate
  // PK (already printed on physical labels); it is an opaque integer, not data.
  function itemUrl(baseUrl, id) {
    // baseUrl e.g. "https://lucent-financial-group.github.io/Zeta/inventory/"
    const sep = baseUrl.indexOf("?") >= 0 ? "&" : "?";
    return baseUrl + sep + "item=" + encodeURIComponent(String(id));
  }
  // Parse the item id out of a URL or a raw "?item=..." search string. Returns a
  // positive integer, or null if absent/malformed (so a stranger's bad/empty
  // value resolves to "no deep-link", never to a different item).
  function parseItemId(urlOrSearch) {
    if (typeof urlOrSearch !== "string") return null;
    const q = urlOrSearch.indexOf("?");
    const search = q >= 0 ? urlOrSearch.slice(q + 1) : urlOrSearch;
    for (const pair of search.split("&")) {
      const eq = pair.indexOf("=");
      const k = decodeURIComponent(eq >= 0 ? pair.slice(0, eq) : pair);
      if (k !== "item") continue;
      const raw = decodeURIComponent(eq >= 0 ? pair.slice(eq + 1) : "");
      if (!/^[0-9]+$/.test(raw)) return null;
      const n = Number(raw);
      return Number.isInteger(n) && n > 0 ? n : null;
    }
    return null;
  }

  // ----- CSV serialize ------------------------------------------------------
  function cellToString(v) {
    if (v === null || v === undefined) return "";
    if (typeof v === "boolean") return v ? "true" : "false";
    return String(v);
  }
  function csvEscape(s) {
    return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  // columns: [{ key, header, kind }]  kind in: "string"|"int"|"num"|"bool"|"json"
  // get(item, key): value accessor (lets a caller pull custom_fields[...] etc.)
  function toCSV(items, columns, get) {
    get = get || ((it, key) => it[key]);
    const out = [];
    out.push(columns.map((c) => csvEscape(c.header)).join(","));
    for (const it of items) {
      out.push(columns.map((c) => {
        let v = get(it, c.key);
        if (c.kind === "json" && v !== null && v !== undefined) v = JSON.stringify(v);
        return csvEscape(cellToString(v));
      }).join(","));
    }
    return out.join("\r\n") + "\r\n";
  }

  // ----- CSV parse (RFC 4180 state machine) ---------------------------------
  // Returns array-of-arrays of strings (no type coercion). Handles quoted fields
  // with embedded comma / quote / CR / LF, CRLF or LF line endings, and a final
  // record with or without a trailing newline.
  function parseCSV(text) {
    if (typeof text !== "string") return [];
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM if present
    const rows = [];
    let row = [], field = "", inQuotes = false, i = 0;
    const n = text.length;
    while (i < n) {
      const c = text[i];
      if (inQuotes) {
        if (c === '"') {
          if (text[i + 1] === '"') { field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if (c === '"') { inQuotes = true; i++; continue; }
      if (c === ",") { row.push(field); field = ""; i++; continue; }
      if (c === "\r") { if (text[i + 1] === "\n") i++; row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
      if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; i++; continue; }
      field += c; i++;
    }
    // flush a final field/record that wasn't terminated by a newline
    if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
    return rows;
  }

  function coerceCell(kind, s) {
    if (s === "") return null;                 // empty cell -> null (round-trips)
    switch (kind) {
      case "int": { const n = Number(s); return Number.isInteger(n) ? n : (Number.isFinite(n) ? n : s); }
      case "num": { const n = Number(s); return Number.isFinite(n) ? n : s; }
      case "bool": return s === "true" ? true : s === "false" ? false : s;
      case "json": try { return JSON.parse(s); } catch (_) { return s; }
      default: return s;                       // "string"
    }
  }

  // Parse a CSV text back into records keyed by column.key, coercing per kind.
  // Validates the header row matches the expected column headers exactly (order
  // and value) — a mismatch returns { ok:false, error } so the staging check can
  // abort+report, mirroring the Phase-3 seed importer discipline.
  function parseCSVToItems(text, columns) {
    const rows = parseCSV(text);
    if (rows.length === 0) return { ok: false, error: "empty CSV (no header)" };
    const header = rows[0];
    const want = columns.map((c) => c.header);
    if (header.length !== want.length) {
      return { ok: false, error: `header has ${header.length} cols, expected ${want.length}` };
    }
    for (let j = 0; j < want.length; j++) {
      if (header[j] !== want[j]) return { ok: false, error: `header col ${j} = ${JSON.stringify(header[j])}, expected ${JSON.stringify(want[j])}` };
    }
    const items = [];
    for (let r = 1; r < rows.length; r++) {
      const cells = rows[r];
      if (cells.length !== columns.length) {
        return { ok: false, error: `row ${r} has ${cells.length} cells, expected ${columns.length}` };
      }
      const it = {};
      for (let j = 0; j < columns.length; j++) it[columns[j].key] = coerceCell(columns[j].kind, cells[j]);
      items.push(it);
    }
    return { ok: true, items };
  }

  // ----- JSON (lossless backup) --------------------------------------------
  function toJSON(items) { return JSON.stringify(items, null, 2) + "\n"; }
  function parseJSON(text) {
    try { const v = JSON.parse(text); return Array.isArray(v) ? { ok: true, items: v } : { ok: false, error: "JSON is not an array" }; }
    catch (e) { return { ok: false, error: "invalid JSON: " + (e && e.message) }; }
  }

  return {
    itemUrl, parseItemId,
    toCSV, parseCSV, parseCSVToItems, coerceCell,
    toJSON, parseJSON,
  };
});
