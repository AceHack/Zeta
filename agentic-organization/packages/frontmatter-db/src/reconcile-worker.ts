/**
 * The periodic git<->cockroach reconcile worker.
 *
 * Mirrors the OrganizationWorkerHost runOnce() shape (packages/workers): a
 * single async cycle over injected ports that returns an explicit status DU and
 * lane-tagged failures rather than throwing. One cycle per table set:
 *   1. load the git event log into the adapter snapshot
 *   2. syncIndexToGit   -> emit events for index rows changed locally since the
 *      last cycle, appending them into the in-memory log FIRST so they are not
 *      seen as absent-from-git (which git->index would tombstone-delete)
 *   3. syncGitToIndex  -> rebuild/refresh the cockroach index from the unified
 *      log (now including this cycle's local emissions); git stays canonical
 *   4. flush the adapter -> write the new event files to the working tree
 * Ordering matters: index->git must precede git->index so a row written only to
 * the index this cycle becomes an event BEFORE the projection-vs-index diff runs,
 * otherwise git->index would delete it as a tombstone.
 */

import type { CockroachRowSink } from "./cockroach-row-sink.ts";
import type { GitFsAdapter } from "./git-fs-adapter.ts";
import type { IdGenerator } from "./sync.ts";
import { syncGitToIndex, syncIndexToGit } from "./sync.ts";

export const ReconcileCycleStatus = {
  Idle: "idle",
  Worked: "worked",
  Degraded: "degraded",
} as const;
export type ReconcileCycleStatus = (typeof ReconcileCycleStatus)[keyof typeof ReconcileCycleStatus];

export const ReconcileLane = {
  Load: "load",
  GitToIndex: "git_to_index",
  IndexToGit: "index_to_git",
  Flush: "flush",
} as const;
export type ReconcileLane = (typeof ReconcileLane)[keyof typeof ReconcileLane];

export type ReconcileLaneFailure = { lane: ReconcileLane; table: string; message: string };

export type ReconcileTableSummary = {
  table: string;
  upserted: number;
  deleted: number;
  emitted: number;
};

export type ReconcileCycleResult = {
  status: ReconcileCycleStatus;
  tables: readonly ReconcileTableSummary[];
  written: number;
  failures: readonly ReconcileLaneFailure[];
};

export type ReconcileWorker = {
  runOnce: () => Promise<ReconcileCycleResult>;
};

export type CreateReconcileWorkerInput = {
  tables: readonly string[];
  gitAdapter: GitFsAdapter;
  indexSink: CockroachRowSink;
  ids: IdGenerator;
};

export function createReconcileWorker(input: CreateReconcileWorkerInput): ReconcileWorker {
  return {
    runOnce: async (): Promise<ReconcileCycleResult> => {
      const failures: ReconcileLaneFailure[] = [];
      const summaries: ReconcileTableSummary[] = [];

      for (const table of input.tables) {
        const summary: ReconcileTableSummary = { table, upserted: 0, deleted: 0, emitted: 0 };

        const loaded = await input.gitAdapter.load(table);
        if (loaded.outcome === "feedback") {
          failures.push({ lane: ReconcileLane.Load, table, message: loaded.feedback.message });
          summaries.push(summary);
          continue;
        }

        // index->git FIRST: local index writes become events in the in-memory
        // log before the projection diff, so they are not tombstone-deleted.
        const toGit = syncIndexToGit(table, { source: input.indexSink, sink: input.gitAdapter, ids: input.ids });
        if (toGit.outcome === "feedback") {
          failures.push({ lane: ReconcileLane.IndexToGit, table, message: toGit.feedback.message });
        } else {
          summary.emitted = toGit.emitted;
        }

        // git->index SECOND: project the unified log (git + this cycle's
        // emissions) back into the index; git remains canonical.
        const toIndex = syncGitToIndex(table, { source: input.gitAdapter, sink: input.indexSink });
        if (toIndex.outcome === "feedback") {
          failures.push({ lane: ReconcileLane.GitToIndex, table, message: toIndex.feedback.message });
        } else {
          summary.upserted = toIndex.applied.upserted;
          summary.deleted = toIndex.applied.deleted;
        }

        summaries.push(summary);
      }

      // index->git emissions are now buffered in the adapter; persist them once.
      let written = 0;
      try {
        const flushed = await input.gitAdapter.flush();
        written = flushed.written;
      } catch (error) {
        failures.push({ lane: ReconcileLane.Flush, table: "*", message: error instanceof Error ? error.message : String(error) });
      }

      // Rows just emitted to git are now durable; clear the changed-set so the
      // next cycle does not re-emit them.
      input.indexSink.clearChanged();

      return {
        status: resolveStatus(summaries, written, failures),
        tables: summaries,
        written,
        failures,
      };
    },
  };
}

function resolveStatus(
  tables: readonly ReconcileTableSummary[],
  written: number,
  failures: readonly ReconcileLaneFailure[],
): ReconcileCycleStatus {
  if (failures.length > 0) {
    return ReconcileCycleStatus.Degraded;
  }
  const moved = tables.some((t) => t.upserted > 0 || t.deleted > 0 || t.emitted > 0) || written > 0;
  return moved ? ReconcileCycleStatus.Worked : ReconcileCycleStatus.Idle;
}
