/**
 * Inventory — type declarations for the shared custom-field logic (Phase 5).
 * ---------------------------------------------------------------------------
 * Sidecar for custom-fields.js. The .js stays a plain UMD module (no
 * import/export keywords) so it loads BOTH as a same-origin browser
 * `<script src>` (CSP script-src 'self', no build step) AND is importable by
 * bun via CJS interop — see the .js header. This .d.ts is type-only: it ships
 * nothing to the browser and compiles to nothing; it exists solely so the
 * strict repo-wide `tsc --noEmit` (lint (tsc tools)) can type-check the
 * `import CF from "../lib/custom-fields.js"` in custom-fields.unit.test.ts
 * WITHOUT excluding inventory from the gate (the test stays type-checked — the
 * shield is asserted, not skipped). Mirrors the runtime export object.
 */

/** Declared custom-field type tags (mirrors the runtime CUSTOM_TYPES array). */
export type CustomFieldType = "text" | "number" | "date" | "dropdown" | "boolean";

/** Which client-side comparator a declared field type sorts under. */
export type ComparatorType = "num" | "date" | "bool" | "str";

/** A custom-field definition (the app passes objects with at least `type`). */
export interface FieldDef {
  type: string;
  label?: string;
  key?: string;
  options?: readonly string[] | null;
}

/** A coerced/typed custom-field value; null = empty/cleared. */
export type TypedValue = string | number | boolean | null;

/** Result of coercing raw form input to a typed value. */
export type CoerceResult =
  | { ok: true; value: TypedValue }
  | { ok: false; error: string };

/** Result of validating an already-typed value against its declared type. */
export type ValidateResult =
  | { ok: true }
  | { ok: false; error: string };

/** The object returned by the UMD factory (default export + window.CustomFields). */
export interface CustomFieldsApi {
  readonly CUSTOM_TYPES: readonly string[];
  isValidCalendarDate(s: unknown): boolean;
  comparatorType(fieldType: string): ComparatorType;
  coerceFormValue(def: FieldDef, raw: unknown): CoerceResult;
  validateTypedValue(def: FieldDef, value: unknown): ValidateResult;
  compareValues(ctype: string, a: unknown, b: unknown): number;
  toNumeric(ctype: string, v: unknown): number | null;
  searchTextForValue(def: FieldDef, value: unknown): string;
  displayText(def: FieldDef, value: unknown): string;
  isValidKey(key: unknown): boolean;
  parseOptions(text: unknown): string[];
}

declare const CustomFields: CustomFieldsApi;
export default CustomFields;
