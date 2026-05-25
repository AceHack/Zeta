import type { AgenticEventEnvelope } from "../../domain/src/index.ts";
import type { OutboxEventSource } from "../../state/src/index.ts";
import { CockroachTableName } from "./cockroach-schema.ts";

export const CockroachOutboxEventSourceStatement = {
  ClaimUnpublishedOutboxEvents: "claim_unpublished_outbox_events",
  MarkOutboxEventPublished: "mark_outbox_event_published",
} as const;

export type CockroachOutboxEventSourceStatement =
  (typeof CockroachOutboxEventSourceStatement)[keyof typeof CockroachOutboxEventSourceStatement];

export type CockroachOutboxSqlStatement = {
  name: CockroachOutboxEventSourceStatement;
  sql: string;
  parameters: readonly unknown[];
};

export type CockroachOutboxSqlResult<Row = Record<string, unknown>> = {
  rows: readonly Row[];
};

export type CockroachOutboxSqlExecutor = {
  execute: <Row = Record<string, unknown>>(
    statement: CockroachOutboxSqlStatement,
  ) => Promise<CockroachOutboxSqlResult<Row>>;
};

export type CreateCockroachOutboxEventSourceInput = {
  executor: CockroachOutboxSqlExecutor;
};

export function createCockroachOutboxEventSource(input: CreateCockroachOutboxEventSourceInput): OutboxEventSource {
  return {
    claimUnpublishedOutboxEvents: async (claimInput) => {
      const result = await input.executor.execute<OutboxEventRow>({
        name: CockroachOutboxEventSourceStatement.ClaimUnpublishedOutboxEvents,
        sql: CockroachOutboxEventSourceSql.ClaimUnpublishedOutboxEvents,
        parameters: [claimInput.batchSize],
      });

      return result.rows.map((row) => ({
        outboxEventId: row.outbox_event_id,
        envelope: row.envelope_json,
      }));
    },
    markOutboxEventPublished: async (markInput) => {
      const result = await input.executor.execute<PublishedOutboxEventRow>({
        name: CockroachOutboxEventSourceStatement.MarkOutboxEventPublished,
        sql: CockroachOutboxEventSourceSql.MarkOutboxEventPublished,
        parameters: [markInput.outboxEventId, markInput.publishedAt],
      });

      if (result.rows.length !== 1) {
        throw new Error(`outbox event was already published or missing: ${markInput.outboxEventId}`);
      }
    },
  };
}

type OutboxEventRow = {
  outbox_event_id: string;
  envelope_json: AgenticEventEnvelope;
};

type PublishedOutboxEventRow = {
  outbox_event_id: string;
};

const CockroachOutboxEventSourceSql = {
  ClaimUnpublishedOutboxEvents: `
    UPDATE ${CockroachTableName.OutboxEvents}
    SET
      claimed_at = transaction_timestamp(),
      claim_expires_at = transaction_timestamp() + INTERVAL '5 minutes'
    WHERE outbox_event_id IN (
      SELECT outbox_event_id
      FROM ${CockroachTableName.OutboxEvents}
      WHERE published_at IS NULL
        AND (claim_expires_at IS NULL OR claim_expires_at < transaction_timestamp())
      ORDER BY outbox_event_id
      LIMIT $1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING outbox_event_id, envelope_json
  `,
  MarkOutboxEventPublished: `
    UPDATE ${CockroachTableName.OutboxEvents}
    SET
      published_at = $2,
      claim_expires_at = NULL
    WHERE outbox_event_id = $1
      AND published_at IS NULL
    RETURNING outbox_event_id
  `,
} as const;
