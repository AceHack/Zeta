/**
 * Generic git<->cockroach (event-log <-> index) sync worker.
 *
 * Pure core over injected ports. No messaging/state package is imported — the
 * caller supplies the git event source/sink and the index row sink/source.
 *
 * Two directions, each an explicit DU:
 *   - {@link syncGitToIndex}: replay the git event log, project to rows, upsert
 *     into the index, and tombstone-delete index rows no longer in the
 *     projection.
 *   - {@link syncIndexToGit}: emit Upsert events into the git log for each
 *     changed index row.
 */
import { fromEvents } from "./crdt-log.ts";
import { project } from "./project.ts";
import {
  EventOp,
  asZetaIdDecimal,
  type FrontmatterEvent,
  type ZetaIdDecimal,
} from "./event.ts";
import type { FrontmatterRow } from "./schema.ts";

export const SyncDirection = {
  GitToIndex: "git_to_index",
  IndexToGit: "index_to_git",
} as const;
export type SyncDirection = (typeof SyncDirection)[keyof typeof SyncDirection];

/** Reads the immutable event log out of git for a table. */
export interface GitEventSource {
  readEvents(table: string): readonly FrontmatterEvent[];
}

/** Mutable index sink — receives projected rows + tombstone deletes. */
export interface IndexRowSink {
  upsertRow(row: FrontmatterRow): void;
  deleteRow(table: string, id: ZetaIdDecimal): void;
  currentRows(table: string): ReadonlyMap<ZetaIdDecimal, FrontmatterRow>;
}

/** Reads changed rows out of the index. */
export interface IndexRowSource {
  changedRows(table: string): readonly FrontmatterRow[];
}

/** Appends events into the git log. */
export interface GitEventSink {
  appendEvent(event: FrontmatterEvent): void;
}

/** Allocates fresh event ids. */
export interface IdGenerator {
  nextEventId(): ZetaIdDecimal;
}

export type SyncFeedback = {
  readonly reason: string;
  readonly message: string;
};

export type GitToIndexResult =
  | {
      readonly outcome: "ok";
      readonly direction: typeof SyncDirection.GitToIndex;
      readonly applied: { readonly upserted: number; readonly deleted: number };
    }
  | { readonly outcome: "feedback"; readonly feedback: SyncFeedback };

export type IndexToGitResult =
  | {
      readonly outcome: "ok";
      readonly direction: typeof SyncDirection.IndexToGit;
      readonly emitted: number;
    }
  | { readonly outcome: "feedback"; readonly feedback: SyncFeedback };

/**
 * Git -> index: build the log, project rows, upsert each, and tombstone-delete
 * any index row whose id is no longer in the projection.
 */
export function syncGitToIndex(
  table: string,
  deps: { readonly source: GitEventSource; readonly sink: IndexRowSink },
): GitToIndexResult {
  const log = fromEvents(deps.source.readEvents(table));
  const projection = project(log, table);

  let upserted = 0;
  for (const row of projection.values()) {
    deps.sink.upsertRow(row);
    upserted += 1;
  }

  let deleted = 0;
  const existing = deps.sink.currentRows(table);
  for (const id of existing.keys()) {
    if (!projection.has(id)) {
      deps.sink.deleteRow(table, id);
      deleted += 1;
    }
  }

  return {
    outcome: "ok",
    direction: SyncDirection.GitToIndex,
    applied: { upserted, deleted },
  };
}

/**
 * Index -> git: emit an Upsert event for each changed row. A row without a
 * non-empty `id` value yields a feedback outcome (`row_missing_id`).
 */
export function syncIndexToGit(
  table: string,
  deps: {
    readonly source: IndexRowSource;
    readonly sink: GitEventSink;
    readonly ids: IdGenerator;
  },
): IndexToGitResult {
  const changed = deps.source.changedRows(table);

  let emitted = 0;
  for (const row of changed) {
    const rawId = row.values["id"];
    if (typeof rawId !== "string" || rawId.length === 0) {
      return {
        outcome: "feedback",
        feedback: {
          reason: "row_missing_id",
          message: `changed row in table "${table}" has no usable id value`,
        },
      };
    }
    const event: FrontmatterEvent = {
      id: deps.ids.nextEventId(),
      table,
      aggregateId: asZetaIdDecimal(rawId),
      op: EventOp.Upsert,
      schemaVersion: 1,
      fields: row.values,
    };
    deps.sink.appendEvent(event);
    emitted += 1;
  }

  return {
    outcome: "ok",
    direction: SyncDirection.IndexToGit,
    emitted,
  };
}
