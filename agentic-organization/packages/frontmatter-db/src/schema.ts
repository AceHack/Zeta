/**
 * frontmatter-db: git-as-database where a markdown file IS a row, its YAML
 * frontmatter holds the typed columns + foreign-key edges, and the schema
 * itself is expressed as frontmatter (operator vision 2026-05-29).
 *
 * Path convention: <table>/<ZetaIdDecimal>.md  (ZetaId decimal = the index key).
 * Frontmatter = columns. Body = the freeform document (e.g. a task description).
 * CockroachDB is a *derived* query/index projection of these rows, not the
 * source of truth — see GIT_COCKROACH_SYNC_AND_ZETAID_ADDRESSING.md.
 *
 * Every column kind is an explicit discriminated-union variant so payload-bearing
 * kinds (enum values, fk target) are never buried in optional fields
 * (repo rule: IMPLICIT-NOT-EXPLICIT in DUs is class error).
 */

export const ColumnType = {
  ZetaId: "zeta_id",
  Text: "text",
  Int: "int",
  Bool: "bool",
  Timestamp: "timestamp",
  Enum: "enum",
  Fk: "fk",
  FkArray: "fk_array",
} as const;

export type ColumnType = (typeof ColumnType)[keyof typeof ColumnType];

export type ColumnDef =
  | { name: string; type: typeof ColumnType.ZetaId; pk: boolean; required: boolean }
  | { name: string; type: typeof ColumnType.Text; required: boolean }
  | { name: string; type: typeof ColumnType.Int; required: boolean }
  | { name: string; type: typeof ColumnType.Bool; required: boolean }
  | { name: string; type: typeof ColumnType.Timestamp; required: boolean }
  | { name: string; type: typeof ColumnType.Enum; required: boolean; values: readonly string[] }
  | { name: string; type: typeof ColumnType.Fk; required: boolean; references: string }
  | { name: string; type: typeof ColumnType.FkArray; required: boolean; references: string };

export type TableSchema = {
  table: string;
  schemaVersion: number;
  columns: readonly ColumnDef[];
};

/** A frontmatter value: scalar or an inline string array (fk arrays / lists). */
export type FrontmatterValue = string | number | boolean | readonly string[];

/** A row = the parsed frontmatter of one markdown file. */
export type FrontmatterRow = {
  table: string;
  values: Readonly<Record<string, FrontmatterValue>>;
};

export function findColumn(schema: TableSchema, name: string): ColumnDef | undefined {
  return schema.columns.find((column) => column.name === name);
}

export function primaryKeyColumn(schema: TableSchema): ColumnDef | undefined {
  return schema.columns.find((column) => column.type === ColumnType.ZetaId && column.pk);
}

/** Foreign-key columns are the graph edges of the git-as-db. */
export function edgeColumns(schema: TableSchema): readonly ColumnDef[] {
  return schema.columns.filter(
    (column) => column.type === ColumnType.Fk || column.type === ColumnType.FkArray,
  );
}
