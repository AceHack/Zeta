import {
  EventIngestionOutcomeStatus,
  type EventIngestionStore,
  type InboxReceiptRecord,
  type ReactionPlanRecord,
} from "../../state/src/index.ts";
import { CockroachTableName } from "./cockroach-schema.ts";

export const CockroachEventIngestionStoreStatement = {
  FindInboxReceipt: "find_inbox_receipt",
  ClaimPendingInboxReceipt: "claim_pending_inbox_receipt",
  InsertReactionPlan: "insert_reaction_plan",
  MarkInboxReceiptProcessed: "mark_inbox_receipt_processed",
} as const;

export type CockroachEventIngestionStoreStatement =
  (typeof CockroachEventIngestionStoreStatement)[keyof typeof CockroachEventIngestionStoreStatement];

export type CockroachEventIngestionSqlStatement = {
  name: CockroachEventIngestionStoreStatement;
  sql: string;
  parameters: readonly unknown[];
};

export type CockroachEventIngestionSqlResult<Row = Record<string, unknown>> = {
  rows: readonly Row[];
};

export type CockroachEventIngestionTransactionExecutor = {
  execute: <Row = Record<string, unknown>>(
    statement: CockroachEventIngestionSqlStatement,
  ) => Promise<CockroachEventIngestionSqlResult<Row>>;
};

export type CockroachEventIngestionSqlExecutor = {
  execute: <Row = Record<string, unknown>>(
    statement: CockroachEventIngestionSqlStatement,
  ) => Promise<CockroachEventIngestionSqlResult<Row>>;
  executeTransaction: <Result>(
    operation: (executor: CockroachEventIngestionTransactionExecutor) => Promise<Result>,
  ) => Promise<Result>;
};

export type CreateCockroachEventIngestionStoreInput = {
  executor: CockroachEventIngestionSqlExecutor;
};

export function createCockroachEventIngestionStore(
  input: CreateCockroachEventIngestionStoreInput,
): EventIngestionStore {
  return {
    findInboxReceipt: async (lookup) => {
      const result = await input.executor.execute<InboxReceiptRow>({
        name: CockroachEventIngestionStoreStatement.FindInboxReceipt,
        sql: CockroachEventIngestionStoreSql.FindInboxReceipt,
        parameters: [lookup.eventId, lookup.consumerName],
      });
      const row = result.rows[0];

      if (row === undefined) {
        return undefined;
      }

      return {
        eventId: row.event_id,
        consumerName: row.consumer_name,
        firstSeenAt: row.first_seen_at,
        payloadHash: row.payload_hash,
        ...(row.processed_at == null ? {} : { processedAt: row.processed_at }),
        ...(row.result == null ? {} : { result: row.result }),
      };
    },
    recordEventProcessingOutcome: async (outcome) => {
      const receipt = outcome.receipt;

      try {
        return await input.executor.executeTransaction(async (transaction) => {
          const claimResult = await transaction.execute<CockroachReceiptClaimRow>({
            name: CockroachEventIngestionStoreStatement.ClaimPendingInboxReceipt,
            sql: CockroachEventIngestionStoreSql.ClaimPendingInboxReceipt,
            parameters: [receipt.eventId, receipt.consumerName, receipt.firstSeenAt, receipt.payloadHash],
          });
          const claimStatus = claimResult.rows[0]?.claim_status ?? EventIngestionOutcomeStatus.PayloadConflict;

          if (claimStatus !== EventIngestionOutcomeStatus.Processed) {
            return {
              status: claimStatus,
              reactionPlans: [],
            };
          }

          for (const reactionPlan of outcome.reactionPlans) {
            await transaction.execute(createInsertReactionPlanStatement(reactionPlan));
          }

          const markResult = await transaction.execute<CockroachMarkedInboxReceiptRow>({
            name: CockroachEventIngestionStoreStatement.MarkInboxReceiptProcessed,
            sql: CockroachEventIngestionStoreSql.MarkInboxReceiptProcessed,
            parameters: [
              receipt.eventId,
              receipt.consumerName,
              outcome.processedAt,
              outcome.result,
              receipt.payloadHash,
            ],
          });

          if (markResult.rows.length !== 1) {
            throw new CockroachInboxReceiptCompletionLostError();
          }

          return {
            status: outcome.result,
            reactionPlans: outcome.reactionPlans,
          };
        });
      } catch (error) {
        if (error instanceof CockroachInboxReceiptCompletionLostError) {
          return {
            status: EventIngestionOutcomeStatus.Duplicate,
            reactionPlans: [],
          };
        }

        throw error;
      }
    },
  };
}

function createInsertReactionPlanStatement(reactionPlan: ReactionPlanRecord): CockroachEventIngestionSqlStatement {
  return {
    name: CockroachEventIngestionStoreStatement.InsertReactionPlan,
    sql: CockroachEventIngestionStoreSql.InsertReactionPlan,
    parameters: [
      reactionPlan.reactionPlanId,
      reactionPlan.consumerName,
      reactionPlan.createdAt,
      reactionPlan.status,
      reactionPlan.action.triggerEventId,
      reactionPlan.action.organizationId,
      reactionPlan.action.projectId,
      reactionPlan.action.workItemId,
      reactionPlan.action,
    ],
  };
}

type InboxReceiptRow = {
  event_id: string;
  consumer_name: InboxReceiptRecord["consumerName"];
  first_seen_at: string;
  processed_at?: string | null;
  payload_hash: string;
  result?: InboxReceiptRecord["result"] | null;
};

type CockroachReceiptClaimRow = {
  claim_status: EventIngestionOutcomeStatus;
};

type CockroachMarkedInboxReceiptRow = {
  event_id: string;
};

class CockroachInboxReceiptCompletionLostError extends Error {
  constructor() {
    super("inbox receipt completion lost its claim");
  }
}

const CockroachEventIngestionStoreSql = {
  FindInboxReceipt: `
    SELECT event_id, consumer_name, first_seen_at, processed_at, payload_hash, result
    FROM ${CockroachTableName.InboxReceipts}
    WHERE event_id = $1
      AND consumer_name = $2
  `,
  ClaimPendingInboxReceipt: `
    WITH claimed_receipt AS (
      INSERT INTO ${CockroachTableName.InboxReceipts} (
        event_id,
        consumer_name,
        first_seen_at,
        payload_hash
      ) VALUES ($1, $2, $3, $4)
      ON CONFLICT (event_id, consumer_name) DO UPDATE
      SET payload_hash = excluded.payload_hash
      WHERE ${CockroachTableName.InboxReceipts}.payload_hash = excluded.payload_hash
        AND ${CockroachTableName.InboxReceipts}.processed_at IS NULL
        AND ${CockroachTableName.InboxReceipts}.result IS NULL
      RETURNING event_id
    )
    SELECT
      CASE
        WHEN EXISTS (SELECT 1 FROM claimed_receipt) THEN '${EventIngestionOutcomeStatus.Processed}'
        WHEN EXISTS (
          SELECT 1
          FROM ${CockroachTableName.InboxReceipts}
          WHERE event_id = $1
            AND consumer_name = $2
            AND payload_hash = $4
            AND processed_at IS NOT NULL
            AND result IS NOT NULL
        ) THEN '${EventIngestionOutcomeStatus.Duplicate}'
        ELSE '${EventIngestionOutcomeStatus.PayloadConflict}'
      END AS claim_status
  `,
  InsertReactionPlan: `
    INSERT INTO ${CockroachTableName.ReactionPlans} (
      reaction_plan_id,
      consumer_name,
      created_at,
      status,
      trigger_event_id,
      organization_id,
      project_id,
      work_item_id,
      action_json
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `,
  MarkInboxReceiptProcessed: `
    UPDATE ${CockroachTableName.InboxReceipts}
    SET
      processed_at = $3,
      result = $4
    WHERE event_id = $1
      AND consumer_name = $2
      AND payload_hash = $5
      AND processed_at IS NULL
      AND result IS NULL
    RETURNING event_id
  `,
} as const;

export type { ReactionPlanRecord };
