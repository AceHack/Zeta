/**
 * Cockroach-backed review-stage-status ledger (CC2) — the per-stage audit trail
 * of the review fabric, keyed by (change_set, stage, revision) so a changes-
 * requested → resubmit bounce (revision++) re-runs stages cleanly without
 * clobbering the prior revision's record. KPI + must-address + the org snapshot
 * read this to see exactly which stage decided what, when, and by whom.
 */

import { StageOutcome } from "../../domain/src/index.ts";
import type { CockroachGenericSqlExecutor } from "./cockroach-sql-executor.ts";

export type ReviewStageStatusRecord = {
  changeSetId: string;
  stageId: string;
  revision: number;
  outcome?: StageOutcome;
  decidedBy?: string; // hatId | "human:<role>" | "external:<system>"
  decidedAt?: string;
};

export type ReviewStageStatusStore = {
  record: (status: ReviewStageStatusRecord) => Promise<void>;
  listByChangeSet: (changeSetId: string) => Promise<readonly ReviewStageStatusRecord[]>;
};

export type CreateCockroachReviewStageStatusStoreInput = { executor: CockroachGenericSqlExecutor };

type Row = {
  change_set_id: string;
  stage_id: string;
  revision: number | string;
  outcome: string | null;
  decided_by: string | null;
  decided_at: string | Date | null;
};

function rowTo(row: Row): ReviewStageStatusRecord {
  return {
    changeSetId: row.change_set_id,
    stageId: row.stage_id,
    revision: typeof row.revision === "number" ? row.revision : Number(row.revision),
    ...(row.outcome !== null ? { outcome: row.outcome as StageOutcome } : {}),
    ...(row.decided_by !== null ? { decidedBy: row.decided_by } : {}),
    ...(row.decided_at !== null
      ? { decidedAt: row.decided_at instanceof Date ? row.decided_at.toISOString() : new Date(row.decided_at).toISOString() }
      : {}),
  };
}

export function createCockroachReviewStageStatusStore(
  input: CreateCockroachReviewStageStatusStoreInput,
): ReviewStageStatusStore {
  return {
    async record(status: ReviewStageStatusRecord): Promise<void> {
      await input.executor.execute({
        name: "record_review_stage_status",
        sql: `
          INSERT INTO agentic_org_review_stage_status (
            change_set_id, stage_id, revision, outcome, decided_by, decided_at
          ) VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (change_set_id, stage_id, revision) DO UPDATE SET
            outcome = excluded.outcome,
            decided_by = excluded.decided_by,
            decided_at = excluded.decided_at`,
        parameters: [
          status.changeSetId, status.stageId, status.revision,
          status.outcome ?? null, status.decidedBy ?? null, status.decidedAt ?? null,
        ],
      });
    },

    async listByChangeSet(changeSetId: string): Promise<readonly ReviewStageStatusRecord[]> {
      const result = await input.executor.execute({
        name: "list_review_stage_status_by_change_set",
        sql: `SELECT * FROM agentic_org_review_stage_status WHERE change_set_id = $1 ORDER BY revision ASC, stage_id ASC`,
        parameters: [changeSetId],
      });
      return (result.rows as Row[]).map(rowTo);
    },
  };
}
