import type { CockroachAnySqlResult } from "../../../../packages/state-cockroach/src/index.ts";
import type { CockroachWorkerPool, CockroachWorkerPoolClient, CockroachWorkerShutdownPool } from "./cockroach-worker-client.ts";

export const PgCockroachWorkerPoolErrorCode = {
  InvalidDriverModule: "invalid_driver_module",
} as const;

export type PgCockroachWorkerPoolErrorCode =
  (typeof PgCockroachWorkerPoolErrorCode)[keyof typeof PgCockroachWorkerPoolErrorCode];

export const PgCockroachDriverModuleName = {
  Pg: "pg",
} as const;

export type PgCockroachDriverModuleName =
  (typeof PgCockroachDriverModuleName)[keyof typeof PgCockroachDriverModuleName];

export class PgCockroachWorkerPoolError extends Error {
  readonly code: PgCockroachWorkerPoolErrorCode;

  constructor(input: { code: PgCockroachWorkerPoolErrorCode; message: string; cause?: unknown }) {
    super(input.message, {
      cause: input.cause,
    });
    this.code = input.code;
  }
}

export type PgCockroachQueryResult<Row = Record<string, unknown>> = {
  rows: Row[];
};

export type PgCockroachPoolClient = {
  query: <Row = Record<string, unknown>>(
    sql: string,
    parameters?: readonly unknown[],
  ) => Promise<PgCockroachQueryResult<Row>>;
  release: () => void;
};

export type PgCockroachPool = {
  connect: () => Promise<PgCockroachPoolClient>;
  end: () => Promise<void>;
};

export type PgCockroachPoolConstructor = new (input: { connectionString: string }) => PgCockroachPool;

export type PgCockroachDriverModule = {
  Pool: PgCockroachPoolConstructor;
};

export type PgCockroachDriverLoader = () => Promise<unknown>;

export type CreatePgCockroachWorkerPoolInput = {
  databaseUrl: string;
  loadDriver?: PgCockroachDriverLoader;
};

export type PgCockroachWorkerPool = CockroachWorkerPool & CockroachWorkerShutdownPool;

export async function createPgCockroachWorkerPool(
  input: CreatePgCockroachWorkerPoolInput,
): Promise<PgCockroachWorkerPool> {
  const driver = assertPgCockroachDriverModule(await (input.loadDriver ?? loadDefaultPgCockroachDriver)());
  const pool = new driver.Pool({
    connectionString: input.databaseUrl,
  });

  return {
    connect: async () => adaptPgCockroachPoolClient(await pool.connect()),
    end: async () => {
      await pool.end();
    },
  };
}

async function loadDefaultPgCockroachDriver(): Promise<unknown> {
  return await import(PgCockroachDriverModuleName.Pg);
}

function adaptPgCockroachPoolClient(client: PgCockroachPoolClient): CockroachWorkerPoolClient {
  return {
    query: async <Row = Record<string, unknown>>(
      sql: string,
      parameters: readonly unknown[] = [],
    ): Promise<CockroachAnySqlResult<Row>> => {
      const result = await client.query<Row>(sql, parameters);

      return {
        rows: result.rows,
      };
    },
    release: () => {
      client.release();
    },
  };
}

function assertPgCockroachDriverModule(module: unknown): PgCockroachDriverModule {
  if (
    typeof module === "object" &&
    module !== null &&
    "Pool" in module &&
    typeof module.Pool === "function"
  ) {
    return module as PgCockroachDriverModule;
  }

  throw new PgCockroachWorkerPoolError({
    code: PgCockroachWorkerPoolErrorCode.InvalidDriverModule,
    message: "pg-compatible Cockroach driver module must export Pool",
    cause: module,
  });
}
