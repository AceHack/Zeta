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
};

export function createCockroachSqlExecutor(input: CreateCockroachSqlExecutorInput): CockroachGenericSqlExecutor {
  return createExecutorForClient(input.client);
}

function createExecutorForClient(client: CockroachSqlClient): CockroachGenericSqlExecutor {
  return {
    execute: async (statement) => await client.query(statement.sql, statement.parameters),
    executeTransaction: async (operation) =>
      await client.transaction(
        async (transactionClient) => await operation(createTransactionExecutor(transactionClient)),
      ),
  };
}

function createTransactionExecutor(client: CockroachSqlClient): CockroachGenericSqlTransactionExecutor {
  return {
    execute: async (statement) => await client.query(statement.sql, statement.parameters),
  };
}
