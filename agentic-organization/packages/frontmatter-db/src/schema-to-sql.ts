/**
 * Emit a CREATE TABLE statement from a {@link TableSchema}.
 *
 * Inverse of {@link parseCreateTable} (sql-to-schema.ts). The column mapping
 * mirrors that parser's recognised DDL subset:
 *   - zeta_id pk -> `<name> TEXT PRIMARY KEY`
 *   - enum       -> `<name> TEXT[ NOT NULL] CHECK (<name> IN ('a', 'b'))`
 *   - fk         -> `<name> TEXT[ NOT NULL] REFERENCES <ref>(id)`
 *   - fk_array   -> `<name> TEXT[] REFERENCES <ref>(id)`
 *   - text       -> `<name> TEXT[ NOT NULL]`
 *   - int        -> `<name> INTEGER[ NOT NULL]`
 *   - bool       -> `<name> BOOLEAN[ NOT NULL]`
 *   - timestamp  -> `<name> TIMESTAMPTZ[ NOT NULL]`
 */
import { ColumnType, type TableSchema, type ColumnDef } from "./schema.ts";

function notNull(required: boolean): string {
  return required ? " NOT NULL" : "";
}

function emitColumn(col: ColumnDef): string {
  switch (col.type) {
    case ColumnType.ZetaId:
      // pk flag drives the PRIMARY KEY clause; a non-pk zeta_id degrades to TEXT.
      return col.pk
        ? `${col.name} TEXT PRIMARY KEY`
        : `${col.name} TEXT`;
    case ColumnType.Enum: {
      // escape single quotes (' -> '') so enum literals can't break the SQL
      // string or open an injection vector when schemas are author-supplied.
      const values = col.values.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ");
      return `${col.name} TEXT${notNull(col.required)} CHECK (${col.name} IN (${values}))`;
    }
    case ColumnType.Fk:
      return `${col.name} TEXT${notNull(col.required)} REFERENCES ${col.references}(id)`;
    case ColumnType.FkArray:
      return `${col.name} TEXT[] REFERENCES ${col.references}(id)`;
    case ColumnType.Text:
      return `${col.name} TEXT${notNull(col.required)}`;
    case ColumnType.Int:
      return `${col.name} INTEGER${notNull(col.required)}`;
    case ColumnType.Bool:
      return `${col.name} BOOLEAN${notNull(col.required)}`;
    case ColumnType.Timestamp:
      return `${col.name} TIMESTAMPTZ${notNull(col.required)}`;
  }
}

export function emitCreateTable(schema: TableSchema): string {
  const lines = schema.columns.map((c) => `  ${emitColumn(c)}`);
  return `CREATE TABLE ${schema.table} (\n${lines.join(",\n")}\n);`;
}
