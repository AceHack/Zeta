/**
 * Validate a frontmatter row against its TableSchema. The schema (derived from
 * SQL or authored directly) is the contract; rows that violate it are rejected
 * with explicit, listed violations (never a thrown exception).
 */

import {
  ColumnType,
  findColumn,
  type ColumnDef,
  type FrontmatterRow,
  type FrontmatterValue,
  type TableSchema,
} from "./schema.ts";

export type RowViolation = { column: string; reason: string; message: string };

export type ValidationResult =
  | { outcome: "valid" }
  | { outcome: "invalid"; violations: readonly RowViolation[] };

export function validateRow(row: FrontmatterRow, schema: TableSchema): ValidationResult {
  const violations: RowViolation[] = [];

  for (const column of schema.columns) {
    const value = row.values[column.name];
    const missing = value === undefined || value === "";
    if (missing) {
      if (column.required) {
        violations.push({ column: column.name, reason: "required_missing", message: `column '${column.name}' is required` });
      }
      continue;
    }
    checkType(column, value, violations);
  }

  // `table` is carried on FrontmatterRow.table, not in values; a `table` key in
  // values is a stray frontmatter key like any other and must be flagged, not
  // silently skipped (which would hide schema violations).
  for (const key of Object.keys(row.values)) {
    if (findColumn(schema, key) === undefined) {
      violations.push({ column: key, reason: "unknown_column", message: `column '${key}' is not in schema for ${schema.table}` });
    }
  }

  return violations.length === 0 ? { outcome: "valid" } : { outcome: "invalid", violations };
}

function checkType(column: ColumnDef, value: FrontmatterValue, violations: RowViolation[]): void {
  switch (column.type) {
    case ColumnType.ZetaId:
      if (typeof value !== "string" || !/^[0-9]+$/.test(value)) {
        violations.push({ column: column.name, reason: "bad_zeta_id", message: `column '${column.name}' must be a base-10 ZetaId` });
      }
      return;
    case ColumnType.Enum:
      if (typeof value !== "string" || !column.values.includes(value)) {
        violations.push({ column: column.name, reason: "enum_out_of_range", message: `column '${column.name}'='${String(value)}' not in [${column.values.join(", ")}]` });
      }
      return;
    case ColumnType.Fk:
      // FK targets a ZetaId pk, so the reference must be a base-10 ZetaId — not
      // just any non-empty string (traverse.ts brands these as ZetaIdDecimal).
      if (typeof value !== "string" || !/^[0-9]+$/.test(value)) {
        violations.push({ column: column.name, reason: "bad_fk", message: `column '${column.name}' must be a base-10 ZetaId reference` });
      }
      return;
    case ColumnType.FkArray:
      if (!Array.isArray(value) || value.some((v) => typeof v !== "string" || !/^[0-9]+$/.test(v))) {
        violations.push({ column: column.name, reason: "bad_fk_array", message: `column '${column.name}' must be an array of base-10 ZetaId references` });
      }
      return;
    case ColumnType.Int:
      if (typeof value !== "number" || !Number.isFinite(value)) {
        violations.push({ column: column.name, reason: "bad_int", message: `column '${column.name}' must be a number` });
      }
      return;
    case ColumnType.Bool:
      if (typeof value !== "boolean") {
        violations.push({ column: column.name, reason: "bad_bool", message: `column '${column.name}' must be a boolean` });
      }
      return;
    case ColumnType.Timestamp:
    case ColumnType.Text:
      if (typeof value !== "string") {
        violations.push({ column: column.name, reason: "bad_text", message: `column '${column.name}' must be a string` });
      }
      return;
    default: {
      // Exhaustiveness: every ColumnDef variant must be handled above. If a new
      // ColumnType is added without a case here, `column` is no longer `never`
      // and this assignment fails the build — forcing the validator to be
      // updated rather than silently dropping the new variant
      // (repo rule: IMPLICIT-NOT-EXPLICIT in DUs is class error).
      const _exhaustive: never = column;
      return _exhaustive;
    }
  }
}
