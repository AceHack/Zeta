import {
  createOutboxPublishFailureEvidence,
  type AgenticEventEnvelope,
  type WorkerFailureEvidence,
} from "../../domain/src/index.ts";
import type { OutboxEventSource } from "../../state/src/index.ts";
import { CockroachTableName } from "./cockroach-schema.ts";

export const CockroachOutboxEventSourceStatement = {
  ClaimUnpublishedOutboxEvents: "claim_unpublished_outbox_events",
  FindOutboxEventPublishMarkFailureEvidence: "find_outbox_event_publish_mark_failure_evidence",
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

export const CockroachOutboxEventPublishMarkErrorCode = {
  StaleClaimOrMissing: "stale_claim_or_missing",
} as const;

export type CockroachOutboxEventPublishMarkErrorCode =
  (typeof CockroachOutboxEventPublishMarkErrorCode)[keyof typeof CockroachOutboxEventPublishMarkErrorCode];

export class CockroachOutboxEventPublishMarkError extends Error {
  readonly claimId: string;
  readonly code: CockroachOutboxEventPublishMarkErrorCode;
  readonly commandId: string | undefined;
  readonly currentClaimId: string | null | undefined;
  readonly eventId: string | undefined;
  readonly evidence: WorkerFailureEvidence;
  readonly outboxEventId: string;
  readonly publishedAt: string | null | undefined;
  readonly traceId: string | undefined;

  constructor(input: {
    claimId: string;
    commandId?: string | undefined;
    currentClaimId?: string | null | undefined;
    eventId?: string | undefined;
    outboxEventId: string;
    publishedAt?: string | null | undefined;
    traceId?: string | undefined;
  }) {
    super(createPublishMarkFailureMessage(input));
    this.claimId = input.claimId;
    this.code = CockroachOutboxEventPublishMarkErrorCode.StaleClaimOrMissing;
    this.commandId = input.commandId;
    this.currentClaimId = input.currentClaimId;
    this.eventId = input.eventId;
    this.outboxEventId = input.outboxEventId;
    this.publishedAt = input.publishedAt;
    this.traceId = input.traceId;
    this.evidence = createPublishMarkFailureEvidence(input);
  }
}

function createPublishMarkFailureMessage(input: {
  claimId: string;
  currentClaimId?: string | null | undefined;
  outboxEventId: string;
  publishedAt?: string | null | undefined;
}): string {
  return [
    "outbox event claim was stale, already published, or missing",
    `outboxEventId=${input.outboxEventId}`,
    `claimId=${input.claimId}`,
    `currentClaimId=${input.currentClaimId ?? "unknown"}`,
    `publishedAt=${input.publishedAt ?? "unpublished_or_unknown"}`,
  ].join("; ");
}

export function createCockroachOutboxEventSource(input: CreateCockroachOutboxEventSourceInput): OutboxEventSource {
  return {
    claimUnpublishedOutboxEvents: async (claimInput) => {
      const result = await input.executor.execute<OutboxEventRow>({
        name: CockroachOutboxEventSourceStatement.ClaimUnpublishedOutboxEvents,
        sql: CockroachOutboxEventSourceSql.ClaimUnpublishedOutboxEvents,
        parameters: [claimInput.batchSize, claimInput.claimId],
      });

      return result.rows.map((row) => ({
        outboxEventId: row.outbox_event_id,
        envelope: row.envelope_json,
        claimId: row.claim_id,
      }));
    },
    markOutboxEventPublished: async (markInput) => {
      const result = await input.executor.execute<PublishedOutboxEventRow>({
        name: CockroachOutboxEventSourceStatement.MarkOutboxEventPublished,
        sql: CockroachOutboxEventSourceSql.MarkOutboxEventPublished,
        parameters: [markInput.outboxEventId, markInput.claimId, markInput.publishedAt],
      });

      if (result.rows.length !== 1) {
        const evidence = await findPublishMarkFailureEvidenceBestEffort({
          executor: input.executor,
          outboxEventId: markInput.outboxEventId,
        });
        throw new CockroachOutboxEventPublishMarkError({
          claimId: markInput.claimId,
          commandId: evidence?.envelope_json.trace.commandId,
          currentClaimId: evidence?.claim_id,
          eventId: evidence?.event_id,
          outboxEventId: markInput.outboxEventId,
          publishedAt: evidence?.published_at,
          traceId: evidence?.trace_id,
        });
      }
    },
  };
}

async function findPublishMarkFailureEvidenceBestEffort(
  input: FindPublishMarkFailureEvidenceInput,
): Promise<OutboxEventPublishMarkFailureEvidenceRow | undefined> {
  try {
    return await findPublishMarkFailureEvidence(input);
  } catch {
    return undefined;
  }
}

type OutboxEventRow = {
  outbox_event_id: string;
  envelope_json: AgenticEventEnvelope;
  claim_id: string;
};

type PublishedOutboxEventRow = {
  outbox_event_id: string;
};

type OutboxEventPublishMarkFailureEvidenceRow = {
  outbox_event_id: string;
  event_id: string;
  envelope_json: AgenticEventEnvelope;
  trace_id: string;
  claim_id: string | null;
  published_at: string | null;
};

type FindPublishMarkFailureEvidenceInput = {
  executor: CockroachOutboxSqlExecutor;
  outboxEventId: string;
};

async function findPublishMarkFailureEvidence(
  input: FindPublishMarkFailureEvidenceInput,
): Promise<OutboxEventPublishMarkFailureEvidenceRow | undefined> {
  const result = await input.executor.execute<OutboxEventPublishMarkFailureEvidenceRow>({
    name: CockroachOutboxEventSourceStatement.FindOutboxEventPublishMarkFailureEvidence,
    sql: CockroachOutboxEventSourceSql.FindOutboxEventPublishMarkFailureEvidence,
    parameters: [input.outboxEventId],
  });

  return result.rows[0];
}

function createPublishMarkFailureEvidence(input: {
  claimId: string;
  commandId?: string | undefined;
  currentClaimId?: string | null | undefined;
  eventId?: string | undefined;
  outboxEventId: string;
  publishedAt?: string | null | undefined;
  traceId?: string | undefined;
}): WorkerFailureEvidence {
  return createOutboxPublishFailureEvidence(input);
}

const CockroachOutboxEventSourceSql = {
  ClaimUnpublishedOutboxEvents: `
    UPDATE ${CockroachTableName.OutboxEvents}
    SET
      claimed_at = transaction_timestamp(),
      claim_expires_at = transaction_timestamp() + INTERVAL '5 minutes',
      claim_id = $2
    WHERE outbox_event_id IN (
      SELECT outbox_event_id
      FROM ${CockroachTableName.OutboxEvents}
      WHERE published_at IS NULL
        AND (claim_expires_at IS NULL OR claim_expires_at < transaction_timestamp())
      ORDER BY outbox_event_id
      LIMIT $1
      FOR UPDATE SKIP LOCKED
    )
    RETURNING outbox_event_id, envelope_json, claim_id
  `,
  FindOutboxEventPublishMarkFailureEvidence: `
    SELECT outbox_event_id, event_id, envelope_json, trace_id, claim_id, published_at
    FROM ${CockroachTableName.OutboxEvents}
    WHERE outbox_event_id = $1
    LIMIT 1
  `,
  MarkOutboxEventPublished: `
    UPDATE ${CockroachTableName.OutboxEvents}
    SET
      published_at = $3,
      claim_expires_at = NULL,
      claim_id = NULL
    WHERE outbox_event_id = $1
      AND claim_id = $2
      AND published_at IS NULL
    RETURNING outbox_event_id
  `,
} as const;
