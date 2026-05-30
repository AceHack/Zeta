/**
 * Graph traversal over git-as-db: foreign-key columns in frontmatter are the
 * edges (operator vision: "frontmatter can be graph traversed"). An `fk` column
 * is one edge; an `fk_array` column is many. Traversal resolves those ids
 * against a store of rows keyed by ZetaIdDecimal.
 */

import type { ZetaIdDecimal } from "./event.ts";
import { ColumnType, edgeColumns, type FrontmatterRow, type TableSchema } from "./schema.ts";

export type Edge = {
  column: string;
  references: string;
  toIds: readonly ZetaIdDecimal[];
};

/** Every outgoing edge from a row, derived from its fk / fk_array columns. */
export function edgesOf(row: FrontmatterRow, schema: TableSchema): readonly Edge[] {
  const edges: Edge[] = [];
  for (const column of edgeColumns(schema)) {
    const value = row.values[column.name];
    if (value === undefined) {
      continue;
    }
    if (column.type === ColumnType.Fk && typeof value === "string" && value.length > 0) {
      edges.push({ column: column.name, references: column.references, toIds: [value as ZetaIdDecimal] });
    } else if (column.type === ColumnType.FkArray && Array.isArray(value)) {
      edges.push({ column: column.name, references: column.references, toIds: value as readonly ZetaIdDecimal[] });
    }
  }
  return edges;
}

/** Resolve the rows reachable from `row` via one named edge column. */
export function neighbors(
  row: FrontmatterRow,
  schema: TableSchema,
  column: string,
  store: ReadonlyMap<ZetaIdDecimal, FrontmatterRow>,
): readonly FrontmatterRow[] {
  const edge = edgesOf(row, schema).find((candidate) => candidate.column === column);
  if (edge === undefined) {
    return [];
  }
  const resolved: FrontmatterRow[] = [];
  for (const id of edge.toIds) {
    const target = store.get(id);
    if (target !== undefined) {
      resolved.push(target);
    }
  }
  return resolved;
}
