import {
  TelemetrySpanStatusCode,
  type TelemetryPort,
} from "../../observability/src/index.ts";

export type CockroachAnySqlStatement = {
  name: string;
  sql: string;
  parameters: readonly unknown[];
};

export type CockroachAnySqlResult<Row = Record<string, unknown>> = {
  rows: readonly Row[];
};

export type CockroachSqlClient = {
  query: <Row = Record<string, unknown>>(
    sql: string,
    parameters: readonly unknown[],
  ) => Promise<CockroachAnySqlResult<Row>>;
  transaction: <Result>(operation: (client: CockroachSqlClient) => Promise<Result>) => Promise<Result>;
};

export type CockroachGenericSqlTransactionExecutor = {
  execute: <Row = Record<string, unknown>>(statement: CockroachAnySqlStatement) => Promise<CockroachAnySqlResult<Row>>;
};

export type CockroachGenericSqlExecutor = CockroachGenericSqlTransactionExecutor & {
  executeTransaction: <Result>(
    operation: (executor: CockroachGenericSqlTransactionExecutor) => Promise<Result>,
  ) => Promise<Result>;
};

export type CreateCockroachSqlExecutorInput = {
  client: CockroachSqlClient;
  telemetry?: TelemetryPort;
};

export function createCockroachSqlExecutor(input: CreateCockroachSqlExecutorInput): CockroachGenericSqlExecutor {
  return createExecutorForClient(input.client, input.telemetry);
}

function createExecutorForClient(
  client: CockroachSqlClient,
  telemetry: TelemetryPort | undefined,
): CockroachGenericSqlExecutor {
  return {
    execute: async (statement) => await executeQuery(client, statement, telemetry),
    executeTransaction: async (operation) =>
      await client.transaction(
        async (transactionClient) => await operation(createTransactionExecutor(transactionClient, telemetry)),
      ),
  };
}

function createTransactionExecutor(
  client: CockroachSqlClient,
  telemetry: TelemetryPort | undefined,
): CockroachGenericSqlTransactionExecutor {
  return {
    execute: async (statement) => await executeQuery(client, statement, telemetry),
  };
}

async function executeQuery<Row>(
  client: CockroachSqlClient,
  statement: CockroachAnySqlStatement,
  telemetry: TelemetryPort | undefined,
): Promise<CockroachAnySqlResult<Row>> {
  if (telemetry === undefined) {
    return await client.query<Row>(statement.sql, statement.parameters);
  }

  const span = telemetry.startSpan("org.db.query", {
    attributes: {
      "db.system": "cockroachdb",
      "db.operation.name": statement.name,
    },
  });

  try {
    const result = await client.query<Row>(statement.sql, statement.parameters);
    span.setAttribute("db.response.returned_rows", result.rows.length);
    span.setStatus({ code: TelemetrySpanStatusCode.Ok });
    span.end();
    return result;
  } catch (error) {
    span.setStatus({ code: TelemetrySpanStatusCode.Error, message: getErrorMessage(error) });
    span.end();
    throw error;
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
