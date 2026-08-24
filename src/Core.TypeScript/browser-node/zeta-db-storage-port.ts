import {
  runConvergentZetaDbNodeTick,
  type ZetaDbConvergencePolicy,
  type ZetaDbFeedback,
  type ZetaDbImagePort,
  type ZetaDbTickLimits,
  type ZetaDbTickReadout,
} from "../zetadb/zeta-db-node";
import { noForgetBackpressureAdmissionPolicy, type ZetaDbAdmissionPolicyPort } from "../zetadb/admission-policy";
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
  readonly convergencePolicy: ZetaDbConvergencePolicy;
  readonly admissionPolicy?: ZetaDbAdmissionPolicyPort;
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

function validConvergencePolicy(policy: unknown): policy is ZetaDbConvergencePolicy {
  if (policy === null || typeof policy !== "object") return false;
  const maxAttempts = (policy as Readonly<Record<string, unknown>>).maxAttempts;
  return typeof maxAttempts === "number" && Number.isSafeInteger(maxAttempts) && maxAttempts > 0;
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
  if (
    !isIdentifier(options.databaseNodeId) ||
    !isIdentifier(options.executorId) ||
    !validLimits(options.limits) ||
    !validConvergencePolicy(options.convergencePolicy)
  ) {
    return failed("A ZetaDB storage port requires identifiers and positive safe-integer tick and convergence budgets.");
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

  /**
   * Run one database tick and refuse anything the kernel did not COMPLETELY admit.
   *
   * `requireComplete: true` is load-bearing, not decoration. Without it the kernel
   * signals a bound admission budget the way it is designed to — `ok: true` with
   * `admission: "backpressured"`, `accepted: 0`, and typed `database-capacity-exhausted`
   * feedback — and this adapter used to collapse that readout with
   * `result.ok ? succeeded(...) : ...`, reporting a write that never reached the durable
   * image. A content-addressed `write` then returned the key of a record nothing stored,
   * and the next `read` missed. The kernel did its job; the adapter dropped the signal.
   *
   * Note what this deliberately does NOT do: refuse on `accepted === 0`. A re-write of an
   * already-stored record is a DUPLICATE — `duplicates: 1, accepted: 0`, admission
   * "complete" — and it must keep succeeding, because a content-addressed write is
   * idempotent by construction (§12). "Nothing was accepted" and "nothing could be
   * accepted" are different facts; only the second is a failure.
   */
  const tick = async (
    deltas: Parameters<typeof runConvergentZetaDbNodeTick>[1]["deltas"],
  ): Promise<StorageResult<ZetaDbTickReadout>> => {
    const result = await runConvergentZetaDbNodeTick(
      options.imagePort,
      {
        nodeId: options.databaseNodeId,
        executorId: options.executorId,
        executorKind: "browser-tab",
        requireComplete: true,
        deltas,
        limits: options.limits,
      },
      options.convergencePolicy,
      options.admissionPolicy ?? noForgetBackpressureAdmissionPolicy,
    );
    if (!result.ok) return mapFeedback(result.feedback);
    // Belt-and-braces: `requireComplete` makes a backpressured readout unreachable today,
    // so a readout that still carries feedback means the kernel grew a signal this
    // adapter has never seen. Refuse it rather than report success over it — dropping an
    // unrecognized signal is the whole defect this method exists to close.
    const carried = result.value.feedback[0];
    if (carried !== undefined) return mapFeedback(carried);
    if (result.value.admission !== "complete") {
      return failed(
        `The database tick reported admission "${result.value.admission}" without feedback; refusing to report success.`,
        "backpressure",
      );
    }
    return succeeded(result.value);
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
