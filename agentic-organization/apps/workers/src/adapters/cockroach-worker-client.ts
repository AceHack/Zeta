import type { CockroachAnySqlResult, CockroachSqlClient } from "../../../../packages/state-cockroach/src/index.ts";
import { WorkerDependencyName } from "../worker-readiness.ts";
import type { WorkerProcessShutdownPort } from "../worker-process.ts";

export const CockroachWorkerTransactionErrorClassification = {
  AmbiguousCommit: "ambiguous_commit",
  Fatal: "fatal",
  Retryable: "retryable",
} as const;

export type CockroachWorkerTransactionErrorClassification =
  (typeof CockroachWorkerTransactionErrorClassification)[keyof typeof CockroachWorkerTransactionErrorClassification];

export const CockroachWorkerTransactionErrorCode = {
  AmbiguousCommit: "ambiguous_commit",
  RollbackFailed: "rollback_failed",
} as const;

export type CockroachWorkerTransactionErrorCode =
  (typeof CockroachWorkerTransactionErrorCode)[keyof typeof CockroachWorkerTransactionErrorCode];

export const CockroachWorkerTransactionStatement = {
  Begin: "BEGIN",
  Commit: "COMMIT",
  Rollback: "ROLLBACK",
} as const;

export type CockroachWorkerTransactionStatement =
  (typeof CockroachWorkerTransactionStatement)[keyof typeof CockroachWorkerTransactionStatement];

export type CockroachWorkerPoolClient = {
  query: <Row = Record<string, unknown>>(
    sql: string,
    parameters?: readonly unknown[],
  ) => Promise<CockroachAnySqlResult<Row>>;
  release: () => void;
};

export type CockroachWorkerPool = {
  connect: () => Promise<CockroachWorkerPoolClient>;
};

export type CockroachWorkerShutdownPool = {
  end: () => Promise<void>;
};

export type CreateCockroachWorkerSqlClientInput = {
  pool: CockroachWorkerPool;
  maxTransactionAttempts?: number;
  classifyTransactionError?: (error: unknown) => CockroachWorkerTransactionErrorClassification;
  waitBeforeRetry?: (input: CockroachWorkerTransactionRetryDelayInput) => Promise<void>;
};

export type CockroachWorkerTransactionRetryDelayInput = {
  attempt: number;
  error: unknown;
};

export class CockroachWorkerTransactionError extends Error {
  readonly code: CockroachWorkerTransactionErrorCode;
  readonly rollbackCause?: unknown;

  constructor(input: {
    code: CockroachWorkerTransactionErrorCode;
    message: string;
    cause: unknown;
    rollbackCause?: unknown;
  }) {
    super(input.message, {
      cause: input.cause,
    });
    this.code = input.code;
    this.rollbackCause = input.rollbackCause;
  }
}

export function createCockroachWorkerSqlClient(input: CreateCockroachWorkerSqlClientInput): CockroachSqlClient {
  return {
    query: async (sql, parameters) => await runWithPooledClient(input.pool, (client) => client.query(sql, parameters)),
    transaction: async (operation) => await runTransaction(input, operation),
  };
}

export function createCockroachWorkerShutdownPort(input: {
  pool: CockroachWorkerShutdownPool;
}): WorkerProcessShutdownPort {
  return {
    name: WorkerDependencyName.Cockroach,
    shutdown: async () => {
      await input.pool.end();
    },
  };
}

async function runWithPooledClient<Result>(
  pool: CockroachWorkerPool,
  operation: (client: CockroachWorkerPoolClient) => Promise<Result>,
): Promise<Result> {
  const client = await pool.connect();

  try {
    return await operation(client);
  } finally {
    client.release();
  }
}

async function runTransaction<Result>(
  input: CreateCockroachWorkerSqlClientInput,
  operation: (client: CockroachSqlClient) => Promise<Result>,
): Promise<Result> {
  const maxAttempts = input.maxTransactionAttempts ?? 1;
  let attempt = 1;

  while (true) {
    try {
      return await runTransactionAttempt(input, operation);
    } catch (error) {
      if (
        error instanceof CockroachWorkerTransactionError &&
        error.code === CockroachWorkerTransactionErrorCode.AmbiguousCommit
      ) {
        throw error;
      }

      const classification = classifyTransactionError(input, error);

      if (classification === CockroachWorkerTransactionErrorClassification.AmbiguousCommit) {
        throw new CockroachWorkerTransactionError({
          code: CockroachWorkerTransactionErrorCode.AmbiguousCommit,
          message: "cockroach transaction commit outcome is ambiguous",
          cause: error,
        });
      }

      if (classification !== CockroachWorkerTransactionErrorClassification.Retryable || attempt >= maxAttempts) {
        throw error;
      }

      await input.waitBeforeRetry?.({
        attempt,
        error,
      });
      attempt += 1;
    }
  }
}

async function runTransactionAttempt<Result>(
  input: CreateCockroachWorkerSqlClientInput,
  operation: (client: CockroachSqlClient) => Promise<Result>,
): Promise<Result> {
  const client = await input.pool.connect();

  try {
    await executeTransactionStatement(client, CockroachWorkerTransactionStatement.Begin);
    const result = await operation(createTransactionClient(client));
    await commitOrThrowTransactionError(input, client);
    return result;
  } catch (error) {
    if (
      error instanceof CockroachWorkerTransactionError &&
      error.code === CockroachWorkerTransactionErrorCode.AmbiguousCommit
    ) {
      throw error;
    }

    await rollbackOrThrowTransactionError(client, error);
    throw error;
  } finally {
    client.release();
  }
}

async function commitOrThrowTransactionError(
  input: CreateCockroachWorkerSqlClientInput,
  client: CockroachWorkerPoolClient,
): Promise<void> {
  try {
    await executeTransactionStatement(client, CockroachWorkerTransactionStatement.Commit);
  } catch (cause) {
    if (classifyTransactionError(input, cause) !== CockroachWorkerTransactionErrorClassification.AmbiguousCommit) {
      throw cause;
    }

    let rollbackCause: unknown;

    try {
      await executeTransactionStatement(client, CockroachWorkerTransactionStatement.Rollback);
    } catch (error) {
      rollbackCause = error;
    }

    throw new CockroachWorkerTransactionError({
      code: CockroachWorkerTransactionErrorCode.AmbiguousCommit,
      message: "cockroach transaction commit outcome is ambiguous",
      cause,
      rollbackCause,
    });
  }
}

async function rollbackOrThrowTransactionError(client: CockroachWorkerPoolClient, cause: unknown): Promise<void> {
  try {
    await executeTransactionStatement(client, CockroachWorkerTransactionStatement.Rollback);
  } catch (rollbackCause) {
    throw new CockroachWorkerTransactionError({
      code: CockroachWorkerTransactionErrorCode.RollbackFailed,
      message: "cockroach transaction rollback failed after transaction error",
      cause,
      rollbackCause,
    });
  }
}

function classifyTransactionError(
  input: CreateCockroachWorkerSqlClientInput,
  error: unknown,
): CockroachWorkerTransactionErrorClassification {
  return input.classifyTransactionError?.(error) ?? classifyKnownCockroachTransactionError(error);
}

function classifyKnownCockroachTransactionError(error: unknown): CockroachWorkerTransactionErrorClassification {
  const code = isErrorWithCode(error) ? error.code : undefined;

  if (code === CockroachSqlState.SerializationFailure) {
    return CockroachWorkerTransactionErrorClassification.Retryable;
  }

  if (code === CockroachSqlState.TransactionResolutionUnknown) {
    return CockroachWorkerTransactionErrorClassification.AmbiguousCommit;
  }

  return CockroachWorkerTransactionErrorClassification.Fatal;
}

const CockroachSqlState = {
  SerializationFailure: "40001",
  TransactionResolutionUnknown: "40003",
} as const;

function isErrorWithCode(error: unknown): error is { code: string } {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string";
}

function createTransactionClient(client: CockroachWorkerPoolClient): CockroachSqlClient {
  return {
    query: async (sql, parameters) => await client.query(sql, parameters),
    transaction: async (operation) => await operation(createTransactionClient(client)),
  };
}

async function executeTransactionStatement(
  client: CockroachWorkerPoolClient,
  statement: CockroachWorkerTransactionStatement,
): Promise<void> {
  await client.query(statement, []);
}
