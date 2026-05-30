/**
 * The CockroachDB-facing row sink: implements the IndexRowSink + IndexRowSource
 * sync ports. CockroachDB is the DERIVED query/index projection of the git
 * event log (not the source of truth), so this index is fully rebuildable by
 * replaying git through syncGitToIndex.
 *
 * This module provides an in-memory reference implementation (used in tests and
 * as a local projection cache) plus the seam for a real SQL-backed sink. The
 * real sink would translate upsertRow/deleteRow into parameterized UPSERT/DELETE
 * against the table emitted by schema-to-sql.emitCreateTable. That hosting is a
 * // TODO below; the port contract and the change-tracking semantics are done.
 */

import type { ZetaIdDecimal } from "./event.ts";
import type { FrontmatterRow } from "./schema.ts";
import type { IndexRowSink, IndexRowSource } from "./sync.ts";

export interface CockroachRowSink extends IndexRowSink, IndexRowSource {
  /** Rows changed (upserted) since the last clearChanged(), for index->git. */
  clearChanged(): void;
}

function rowId(row: FrontmatterRow): ZetaIdDecimal | undefined {
  const raw = row.values["id"];
  return typeof raw === "string" && raw.length > 0 ? (raw as ZetaIdDecimal) : undefined;
}

export function createInMemoryCockroachRowSink(): CockroachRowSink {
  // table -> (id -> row)
  const tables = new Map<string, Map<ZetaIdDecimal, FrontmatterRow>>();
  // table -> set of ids changed since last clearChanged()
  const changed = new Map<string, Set<ZetaIdDecimal>>();

  function tableMap(table: string): Map<ZetaIdDecimal, FrontmatterRow> {
    let map = tables.get(table);
    if (map === undefined) {
      map = new Map<ZetaIdDecimal, FrontmatterRow>();
      tables.set(table, map);
    }
    return map;
  }

  function changedSet(table: string): Set<ZetaIdDecimal> {
    let set = changed.get(table);
    if (set === undefined) {
      set = new Set<ZetaIdDecimal>();
      changed.set(table, set);
    }
    return set;
  }

  return {
    upsertRow(row: FrontmatterRow): void {
      const id = rowId(row);
      if (id === undefined) {
        return;
      }
      tableMap(row.table).set(id, row);
      changedSet(row.table).add(id);
    },

    deleteRow(table: string, id: ZetaIdDecimal): void {
      tableMap(table).delete(id);
      changedSet(table).delete(id);
    },

    currentRows(table: string): ReadonlyMap<ZetaIdDecimal, FrontmatterRow> {
      return tableMap(table);
    },

    changedRows(table: string): readonly FrontmatterRow[] {
      const map = tableMap(table);
      const rows: FrontmatterRow[] = [];
      for (const id of changedSet(table)) {
        const row = map.get(id);
        if (row !== undefined) {
          rows.push(row);
        }
      }
      return rows;
    },

    clearChanged(): void {
      changed.clear();
    },
  };
}

// TODO(cockroach-host): provide a SQL-backed CockroachRowSink. It should:
//   - on upsertRow: run an UPSERT into the table emitted by emitCreateTable,
//     mapping FrontmatterRow.values to typed columns (fk_array -> TEXT[]).
//   - on deleteRow: DELETE FROM <table> WHERE id = $1.
//   - track changedRows via a CDC feed / updated_at watermark rather than an
//     in-memory set, since a real index is multi-process.
//   - reuse the existing state-cockroach client + outbox transaction so
//     index<->git stays consistent with the command pipeline.
