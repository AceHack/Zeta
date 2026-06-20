/**
 * Inventory — type declarations for the shared export/import logic (Phase 6).
 * ---------------------------------------------------------------------------
 * Sidecar for inventory-export.js (same pattern as custom-fields.d.ts). The .js
 * stays a plain UMD module so it loads BOTH as a same-origin browser
 * `<script src>` (CSP script-src 'self', no build step) AND is importable by bun
 * via CJS interop. This .d.ts is type-only — it ships nothing and compiles to
 * nothing; it exists so `import IE from "../lib/inventory-export.js"` in the
 * Phase-6 proofs/tests type-checks. Mirrors the runtime export object.
 */

/** How a CSV column's string cell is coerced back to a typed value on import. */
export type ColumnKind = "string" | "int" | "num" | "bool" | "json";

/** A CSV column spec: object key, CSV header text, and coercion kind. */
export interface Column {
  key: string;
  header: string;
  kind: ColumnKind;
}

/** A typed cell value after coercion; null = empty cell. */
export type CellValue = string | number | boolean | null | unknown;

/** A parsed inventory record (column.key -> value). */
export type ParsedItem = Record<string, CellValue>;

/** Result of a parse/staging-check: ok with items, or a reported error. */
export type ParseResult =
  | { ok: true; items: ParsedItem[] }
  | { ok: false; error: string };

/** The object returned by the UMD factory (default export + window.InventoryExport). */
export interface InventoryExportApi {
  itemUrl(baseUrl: string, id: string | number): string;
  parseItemId(urlOrSearch: unknown): number | null;
  toCSV(
    items: readonly Record<string, unknown>[],
    columns: readonly Column[],
    get?: (item: Record<string, unknown>, key: string) => unknown,
  ): string;
  parseCSV(text: unknown): string[][];
  parseCSVToItems(text: string, columns: readonly Column[]): ParseResult;
  coerceCell(kind: ColumnKind, s: string): CellValue;
  toJSON(items: readonly unknown[]): string;
  parseJSON(text: string): ParseResult;
}

declare const InventoryExport: InventoryExportApi;
export default InventoryExport;
