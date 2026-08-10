import {
  runZetaDbNodeTick,
  type ZetaDbFeedback,
  type ZetaDbImagePort,
  type ZetaDbTickLimits,
  type ZetaDbTickReadout,
} from "../zetadb/zeta-db-node";
import {
  hashPayload,
  merkleToHex,
  type StorageRecord,
  type StorageResult,
  type ZetaStoragePort,
} from "./zeta-storage-cell";

const STORAGE_ROW_PREFIX = "storage/";

export interface ZetaDbStoragePortOptions {
  readonly imagePort: ZetaDbImagePort;
  readonly databaseNodeId: string;
  readonly executorId: string;
  readonly limits: ZetaDbTickLimits;
}

function succeeded<T>(value: T): StorageResult<T> {
  return { ok: true, value };
}

function failed(reason: string, severity: "backpressure" | "heat" = "heat"): StorageResult<never> {
  return { ok: false, reason, severity };
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 1024;
}

function validLimits(limits: ZetaDbTickLimits): boolean {
  return (
    Number.isSafeInteger(limits.maxDeltas) &&
    limits.maxDeltas > 0 &&
    Number.isSafeInteger(limits.maxEntries) &&
    limits.maxEntries > 0 &&
    Number.isSafeInteger(limits.maxCheckpointBytes) &&
    limits.maxCheckpointBytes > 0
  );
}

function mapFeedback(feedback: ZetaDbFeedback): StorageResult<never> {
  return failed(`${feedback.code}: ${feedback.detail}`, feedback.severity);
}

function validRecord(record: StorageRecord): boolean {
  const hash = hashPayload(record.payload);
  return record.key === merkleToHex(hash) && record.merkleHash.hi === hash.hi && record.merkleHash.lo === hash.lo;
}

function rowKey(key: string): string {
  return `${STORAGE_ROW_PREFIX}${key}`;
}

function recordFromRow(key: string, payload: string, weight: number): StorageResult<StorageRecord> {
  if (weight !== 1) {
    return failed(`ZetaDB storage row ${key} has weight ${String(weight)}; content-addressed rows require weight 1.`);
  }
  const merkleHash = hashPayload(payload);
  if (merkleToHex(merkleHash) !== key) {
    return failed(`ZetaDB storage row ${key} does not match the hash of its payload.`);
  }
  return succeeded({ key, payload, merkleHash });
}

/** Adapt the signed ZetaDB kernel into the content-addressed storage port. */
export function createZetaDbStoragePort(options: ZetaDbStoragePortOptions): StorageResult<ZetaStoragePort> {
  if (!isIdentifier(options.databaseNodeId) || !isIdentifier(options.executorId) || !validLimits(options.limits)) {
    return failed("A ZetaDB storage port requires identifiers and positive safe-integer tick budgets.");
  }

  let closed = false;
  let tail: Promise<StorageResult<unknown>> = Promise.resolve(succeeded(null));

  const schedule = <T>(operation: () => Promise<StorageResult<T>>): Promise<StorageResult<T>> => {
    const scheduled = tail.then(async () => {
      if (closed) return failed("The ZetaDB storage port is closed.");
      try {
        return await operation();
      } catch {
        return failed("The injected ZetaDB image port threw during a storage operation.");
      }
    });
    tail = scheduled;
    return scheduled;
  };

  const tick = async (
    deltas: Parameters<typeof runZetaDbNodeTick>[1]["deltas"],
  ): Promise<StorageResult<ZetaDbTickReadout>> => {
    const result = await runZetaDbNodeTick(options.imagePort, {
      nodeId: options.databaseNodeId,
      executorId: options.executorId,
      executorKind: "browser-tab",
      deltas,
      limits: options.limits,
    });
    return result.ok ? succeeded(result.value) : mapFeedback(result.feedback);
  };

  const port: ZetaStoragePort = {
    write: (record) =>
      schedule(async () => {
        if (!validRecord(record))
          return failed("A storage record must be addressed by the Merkle hash of its payload.");
        const result = await tick([
          {
            eventId: `storage/write/${record.key}`,
            rowKey: rowKey(record.key),
            payload: record.payload,
            weight: 1,
          },
        ]);
        return result.ok ? succeeded(record.key) : result;
      }),
    read: (key) =>
      schedule(async () => {
        const result = await tick([]);
        if (!result.ok) return result;
        const row = result.value.rows.find((candidate) => candidate.rowKey === rowKey(key));
        if (row === undefined) return succeeded(null);
        return recordFromRow(key, row.payload, row.weight);
      }),
    list: () =>
      schedule(async () => {
        const result = await tick([]);
        if (!result.ok) return result;
        const keys: string[] = [];
        for (const row of result.value.rows) {
          if (!row.rowKey.startsWith(STORAGE_ROW_PREFIX)) continue;
          const key = row.rowKey.slice(STORAGE_ROW_PREFIX.length);
          const decoded = recordFromRow(key, row.payload, row.weight);
          if (!decoded.ok) return decoded;
          keys.push(key);
        }
        return succeeded(keys);
      }),
    close: () => {
      if (closed) return succeeded(null);
      closed = true;
      const result = options.imagePort.close();
      return result.ok ? succeeded(null) : mapFeedback(result.feedback);
    },
  };
  return succeeded(port);
}
