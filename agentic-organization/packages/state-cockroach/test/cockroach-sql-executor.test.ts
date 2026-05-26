import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  CockroachCommandStateStoreStatement,
  createCockroachSqlExecutor,
  type CockroachSqlClient,
} from "../src/index.ts";

describe("cockroach SQL executor", () => {
  test("adapts a generic Cockroach client to statement executors", async () => {
    const client = createRecordingCockroachClient();
    const executor = createCockroachSqlExecutor({ client });

    const result = await executor.execute<{ idempotency_key: string }>({
      name: CockroachCommandStateStoreStatement.FindIdempotencyRecord,
      sql: "SELECT idempotency_key FROM idempotency_records WHERE idempotency_key = $1",
      parameters: ["idem-001"],
    });

    deepEqual(client.queries, [
      {
        sql: "SELECT idempotency_key FROM idempotency_records WHERE idempotency_key = $1",
        parameters: ["idem-001"],
      },
    ]);
    deepEqual(result.rows, [{ idempotency_key: "idem-001" }]);
  });

  test("runs transaction statements against the transaction client", async () => {
    const client = createRecordingCockroachClient();
    const transactionClient = createRecordingCockroachClient();
    client.transactionClient = transactionClient;
    const executor = createCockroachSqlExecutor({ client });

    const result = await executor.executeTransaction(async (transaction) => {
      await transaction.execute({
        name: CockroachCommandStateStoreStatement.InsertAuditEvent,
        sql: "INSERT INTO audit_events (audit_event_id) VALUES ($1)",
        parameters: ["audit-001"],
      });

      return "committed";
    });

    equal(result, "committed");
    equal(client.transactionCount, 1);
    deepEqual(transactionClient.queries, [
      {
        sql: "INSERT INTO audit_events (audit_event_id) VALUES ($1)",
        parameters: ["audit-001"],
      },
    ]);
  });
});

type RecordingCockroachClient = CockroachSqlClient & {
  queries: { sql: string; parameters: readonly unknown[] }[];
  transactionClient?: RecordingCockroachClient;
  transactionCount: number;
};

function createRecordingCockroachClient(): RecordingCockroachClient {
  const client: RecordingCockroachClient = {
    queries: [],
    transactionCount: 0,
    query: async <Row = Record<string, unknown>>(sql: string, parameters: readonly unknown[]) => {
      client.queries.push({ sql, parameters });

      return {
        rows: [{ idempotency_key: "idem-001" }] as Row[],
      };
    },
    transaction: async (operation) => {
      client.transactionCount += 1;
      return await operation(client.transactionClient ?? client);
    },
  };

  return client;
}
