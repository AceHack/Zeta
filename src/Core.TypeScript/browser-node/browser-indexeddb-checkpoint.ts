export const BROWSER_CHECKPOINT_RECORD_SCHEMA = "zeta.browser-checkpoint-record.v1" as const;

export interface BrowserCheckpointRecord {
  readonly schema: typeof BROWSER_CHECKPOINT_RECORD_SCHEMA;
  readonly nodeId: string;
  readonly revision: number;
  readonly payload: Uint8Array;
}

export interface BrowserCheckpointFeedback {
  readonly severity: "backpressure" | "heat";
  readonly code:
    | "checkpoint-configuration-invalid"
    | "checkpoint-record-invalid"
    | "checkpoint-revision-conflict"
    | "checkpoint-store-closed"
    | "indexed-db-unavailable"
    | "indexed-db-blocked"
    | "indexed-db-open-failed"
    | "indexed-db-read-failed"
    | "indexed-db-write-failed"
    | "indexed-db-delete-failed"
    | "indexed-db-close-failed";
  readonly detail: string;
}

export type BrowserCheckpointResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly feedback: BrowserCheckpointFeedback };

export interface BrowserCheckpointPort {
  load(nodeId: string): Promise<BrowserCheckpointResult<BrowserCheckpointRecord | null>>;
  save(record: BrowserCheckpointRecord): Promise<BrowserCheckpointResult<BrowserCheckpointRecord>>;
  remove(nodeId: string, throughRevision: number): Promise<BrowserCheckpointResult<boolean>>;
  close(): BrowserCheckpointResult<null>;
}

export interface NativeIndexedDbCheckpointOptions {
  readonly databaseName: string;
  readonly storeName: string;
}

interface NativeRequest {
  readonly result: unknown;
  readonly error: unknown;
  onsuccess: (() => void) | null;
  onerror: (() => void) | null;
}

interface NativeOpenRequest extends NativeRequest {
  onupgradeneeded: (() => void) | null;
  onblocked: (() => void) | null;
}

interface NativeObjectStore {
  get(key: string): NativeRequest;
  put(value: BrowserCheckpointRecord): NativeRequest;
  delete(key: string): NativeRequest;
}

interface NativeTransaction {
  readonly error: unknown;
  oncomplete: (() => void) | null;
  onerror: (() => void) | null;
  onabort: (() => void) | null;
  objectStore(name: string): NativeObjectStore;
  abort(): void;
}

interface NativeDatabase {
  readonly objectStoreNames: { contains(name: string): boolean };
  onversionchange: (() => void) | null;
  createObjectStore(name: string, options: { readonly keyPath: string }): unknown;
  transaction(name: string, mode: "readonly" | "readwrite"): NativeTransaction;
  close(): void;
}

function succeeded<T>(value: T): BrowserCheckpointResult<T> {
  return { ok: true, value };
}

function failed(
  code: BrowserCheckpointFeedback["code"],
  detail: string,
  severity: BrowserCheckpointFeedback["severity"] = "heat",
): { readonly ok: false; readonly feedback: BrowserCheckpointFeedback } {
  return { ok: false, feedback: { severity, code, detail } };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function method(value: unknown, name: string): ((...args: readonly unknown[]) => unknown) | null {
  if (!isRecord(value)) return null;
  try {
    const candidate = Reflect.get(value, name);
    return typeof candidate === "function" ? (candidate as (...args: readonly unknown[]) => unknown) : null;
  } catch {
    return null;
  }
}

function errorDetail(value: unknown): string {
  if (!isRecord(value)) return "No IndexedDB error detail was available.";
  const name = Reflect.get(value, "name");
  const message = Reflect.get(value, "message");
  if (typeof name === "string" && typeof message === "string") return `${name}: ${message}`;
  if (typeof message === "string") return message;
  if (typeof name === "string") return name;
  return "No IndexedDB error detail was available.";
}

function copyRecord(record: BrowserCheckpointRecord): BrowserCheckpointRecord {
  return { ...record, payload: new Uint8Array(record.payload) };
}

function samePayload(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  for (let index = 0; index < left.byteLength; index += 1) {
    if (left[index] !== right[index]) return false;
  }
  return true;
}

export function validateBrowserCheckpointRecord(value: unknown): BrowserCheckpointResult<BrowserCheckpointRecord> {
  if (
    !isRecord(value) ||
    value.schema !== BROWSER_CHECKPOINT_RECORD_SCHEMA ||
    !isIdentifier(value.nodeId) ||
    !isRevision(value.revision) ||
    !(value.payload instanceof Uint8Array)
  ) {
    return failed(
      "checkpoint-record-invalid",
      "A browser checkpoint must carry the current schema, a node identifier, a non-negative safe revision, and bytes.",
    );
  }
  return succeeded(
    copyRecord({
      schema: BROWSER_CHECKPOINT_RECORD_SCHEMA,
      nodeId: value.nodeId,
      revision: value.revision,
      payload: value.payload,
    }),
  );
}

function asDatabase(value: unknown): NativeDatabase | null {
  if (
    !isRecord(value) ||
    !isRecord(value.objectStoreNames) ||
    method(value.objectStoreNames, "contains") === null ||
    method(value, "createObjectStore") === null ||
    method(value, "transaction") === null ||
    method(value, "close") === null
  ) {
    return null;
  }
  return value as unknown as NativeDatabase;
}

function asTransaction(value: unknown): NativeTransaction | null {
  if (!isRecord(value) || method(value, "objectStore") === null || method(value, "abort") === null) return null;
  return value as unknown as NativeTransaction;
}

function asObjectStore(value: unknown): NativeObjectStore | null {
  if (
    !isRecord(value) ||
    method(value, "get") === null ||
    method(value, "put") === null ||
    method(value, "delete") === null
  ) {
    return null;
  }
  return value as unknown as NativeObjectStore;
}

function asRequest(value: unknown): NativeRequest | null {
  return isRecord(value) ? (value as unknown as NativeRequest) : null;
}

function abortQuietly(transaction: NativeTransaction): void {
  try {
    transaction.abort();
  } catch {
    // The typed operation failure remains the primary result.
  }
}

/** Open a native IndexedDB adapter without importing DOM types into callers. */
export function openNativeIndexedDbCheckpointPort(
  root: unknown,
  options: NativeIndexedDbCheckpointOptions,
): Promise<BrowserCheckpointResult<BrowserCheckpointPort>> {
  if (!isIdentifier(options.databaseName) || !isIdentifier(options.storeName)) {
    return Promise.resolve(
      failed("checkpoint-configuration-invalid", "IndexedDB database and store names must be non-empty strings."),
    );
  }
  if (root === null || (typeof root !== "object" && typeof root !== "function")) {
    return Promise.resolve(
      failed("indexed-db-unavailable", "This runtime does not expose IndexedDB.", "backpressure"),
    );
  }

  let factoryValue: unknown;
  try {
    factoryValue = Reflect.get(root, "indexedDB");
  } catch {
    return Promise.resolve(failed("indexed-db-unavailable", "This runtime blocked access to IndexedDB."));
  }
  const open = method(factoryValue, "open");
  if (open === null) {
    return Promise.resolve(
      failed("indexed-db-unavailable", "This runtime does not expose IndexedDB.", "backpressure"),
    );
  }

  return new Promise((resolve) => {
    let request: NativeOpenRequest;
    try {
      request = Reflect.apply(open, factoryValue, [options.databaseName, 1]) as NativeOpenRequest;
    } catch (error) {
      resolve(failed("indexed-db-open-failed", `IndexedDB open threw: ${String(error)}`));
      return;
    }

    let settled = false;
    let upgradeFailure: BrowserCheckpointFeedback | null = null;
    const finish = (result: BrowserCheckpointResult<BrowserCheckpointPort>): void => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    request.onblocked = () => {
      finish(
        failed(
          "indexed-db-blocked",
          "IndexedDB could not open the checkpoint database because another connection blocked its schema version.",
          "backpressure",
        ),
      );
    };
    request.onerror = () => {
      finish(failed("indexed-db-open-failed", `IndexedDB failed to open: ${errorDetail(request.error)}`));
    };
    request.onupgradeneeded = () => {
      const database = asDatabase(request.result);
      if (database === null) {
        upgradeFailure = failed(
          "indexed-db-open-failed",
          "IndexedDB returned an invalid database while creating the checkpoint store.",
        ).feedback;
        return;
      }
      try {
        if (!database.objectStoreNames.contains(options.storeName)) {
          database.createObjectStore(options.storeName, { keyPath: "nodeId" });
        }
      } catch (error) {
        upgradeFailure = failed(
          "indexed-db-open-failed",
          `IndexedDB failed to create the checkpoint store: ${String(error)}`,
        ).feedback;
      }
    };
    request.onsuccess = () => {
      const database = asDatabase(request.result);
      if (database === null) {
        finish(failed("indexed-db-open-failed", "IndexedDB returned an invalid checkpoint database."));
        return;
      }
      if (settled) {
        try {
          database.close();
        } catch {
          // The earlier blocked result remains primary.
        }
        return;
      }
      if (upgradeFailure !== null) {
        try {
          database.close();
        } catch {
          // The upgrade failure remains primary.
        }
        finish({ ok: false, feedback: upgradeFailure });
        return;
      }
      try {
        if (!database.objectStoreNames.contains(options.storeName)) {
          database.close();
          finish(failed("indexed-db-open-failed", "The checkpoint object store was not created."));
          return;
        }
      } catch (error) {
        finish(failed("indexed-db-open-failed", `IndexedDB store inspection failed: ${String(error)}`));
        return;
      }

      let closed = false;
      try {
        database.onversionchange = () => {
          try {
            database.close();
          } finally {
            closed = true;
          }
        };
      } catch (error) {
        try {
          database.close();
        } catch {
          // The version-change configuration failure remains primary.
        }
        finish(failed("indexed-db-open-failed", `IndexedDB version-change wiring failed: ${String(error)}`));
        return;
      }
      const begin = (
        mode: "readonly" | "readwrite",
        code: "indexed-db-read-failed" | "indexed-db-write-failed" | "indexed-db-delete-failed",
      ): BrowserCheckpointResult<{ readonly transaction: NativeTransaction; readonly store: NativeObjectStore }> => {
        if (closed) return failed("checkpoint-store-closed", "The IndexedDB checkpoint port is already closed.");
        try {
          const transaction = asTransaction(database.transaction(options.storeName, mode));
          if (transaction === null) return failed(code, "IndexedDB returned an invalid checkpoint transaction.");
          const store = asObjectStore(transaction.objectStore(options.storeName));
          return store === null
            ? failed(code, "IndexedDB returned an invalid checkpoint object store.")
            : succeeded({ transaction, store });
        } catch (error) {
          return failed(code, `IndexedDB failed to start a checkpoint transaction: ${String(error)}`);
        }
      };

      const load = (nodeId: string): Promise<BrowserCheckpointResult<BrowserCheckpointRecord | null>> => {
        if (!isIdentifier(nodeId)) {
          return Promise.resolve(failed("checkpoint-record-invalid", "A checkpoint node identifier must be non-empty."));
        }
        const started = begin("readonly", "indexed-db-read-failed");
        if (!started.ok) return Promise.resolve(started);
        const { transaction, store } = started.value;

        return new Promise((resolveLoad) => {
          let loaded: BrowserCheckpointRecord | null = null;
          let operationSettled = false;
          const finishLoad = (result: BrowserCheckpointResult<BrowserCheckpointRecord | null>): void => {
            if (operationSettled) return;
            operationSettled = true;
            resolveLoad(result);
          };
          let getRequest: NativeRequest | null = null;
          try {
            getRequest = asRequest(store.get(nodeId));
          } catch (error) {
            finishLoad(failed("indexed-db-read-failed", `IndexedDB checkpoint read threw: ${String(error)}`));
            abortQuietly(transaction);
            return;
          }
          if (getRequest === null) {
            finishLoad(failed("indexed-db-read-failed", "IndexedDB returned an invalid checkpoint read request."));
            abortQuietly(transaction);
            return;
          }
          getRequest.onsuccess = () => {
            if (getRequest?.result === undefined) return;
            const decoded = validateBrowserCheckpointRecord(getRequest.result);
            if (!decoded.ok) {
              finishLoad(decoded);
              abortQuietly(transaction);
              return;
            }
            loaded = decoded.value;
          };
          getRequest.onerror = () => {
            finishLoad(
              failed("indexed-db-read-failed", `IndexedDB checkpoint read failed: ${errorDetail(getRequest?.error)}`),
            );
          };
          transaction.oncomplete = () => finishLoad(succeeded(loaded));
          transaction.onerror = () =>
            finishLoad(
              failed("indexed-db-read-failed", `IndexedDB checkpoint transaction failed: ${errorDetail(transaction.error)}`),
            );
          transaction.onabort = transaction.onerror;
        });
      };

      const save = (value: BrowserCheckpointRecord): Promise<BrowserCheckpointResult<BrowserCheckpointRecord>> => {
        const candidate = validateBrowserCheckpointRecord(value);
        if (!candidate.ok) return Promise.resolve(candidate);
        const started = begin("readwrite", "indexed-db-write-failed");
        if (!started.ok) return Promise.resolve(started);
        const { transaction, store } = started.value;

        return new Promise((resolveSave) => {
          let operationSettled = false;
          const finishSave = (result: BrowserCheckpointResult<BrowserCheckpointRecord>): void => {
            if (operationSettled) return;
            operationSettled = true;
            resolveSave(result);
          };
          let getRequest: NativeRequest | null = null;
          try {
            getRequest = asRequest(store.get(candidate.value.nodeId));
          } catch (error) {
            finishSave(failed("indexed-db-write-failed", `IndexedDB checkpoint comparison threw: ${String(error)}`));
            abortQuietly(transaction);
            return;
          }
          if (getRequest === null) {
            finishSave(failed("indexed-db-write-failed", "IndexedDB returned an invalid checkpoint comparison request."));
            abortQuietly(transaction);
            return;
          }
          getRequest.onsuccess = () => {
            let existing: BrowserCheckpointRecord | null = null;
            if (getRequest?.result !== undefined) {
              const decoded = validateBrowserCheckpointRecord(getRequest.result);
              if (!decoded.ok) {
                finishSave(decoded);
                abortQuietly(transaction);
                return;
              }
              existing = decoded.value;
            }
            if (existing !== null && candidate.value.revision < existing.revision) {
              finishSave(
                failed(
                  "checkpoint-revision-conflict",
                  `Checkpoint revision ${String(candidate.value.revision)} is older than stored revision ${String(existing.revision)}.`,
                  "backpressure",
                ),
              );
              abortQuietly(transaction);
              return;
            }
            if (existing !== null && candidate.value.revision === existing.revision) {
              if (!samePayload(candidate.value.payload, existing.payload)) {
                finishSave(
                  failed(
                    "checkpoint-revision-conflict",
                    `Checkpoint revision ${String(candidate.value.revision)} already names different bytes.`,
                    "backpressure",
                  ),
                );
                abortQuietly(transaction);
              }
              return;
            }
            let putRequest: NativeRequest | null = null;
            try {
              putRequest = asRequest(store.put(copyRecord(candidate.value)));
            } catch (error) {
              finishSave(failed("indexed-db-write-failed", `IndexedDB checkpoint write threw: ${String(error)}`));
              abortQuietly(transaction);
              return;
            }
            if (putRequest === null) {
              finishSave(failed("indexed-db-write-failed", "IndexedDB returned an invalid checkpoint write request."));
              abortQuietly(transaction);
              return;
            }
            putRequest.onerror = () =>
              finishSave(
                failed("indexed-db-write-failed", `IndexedDB checkpoint write failed: ${errorDetail(putRequest?.error)}`),
              );
          };
          getRequest.onerror = () =>
            finishSave(
              failed("indexed-db-write-failed", `IndexedDB checkpoint comparison failed: ${errorDetail(getRequest?.error)}`),
            );
          transaction.oncomplete = () => finishSave(succeeded(copyRecord(candidate.value)));
          transaction.onerror = () =>
            finishSave(
              failed("indexed-db-write-failed", `IndexedDB checkpoint transaction failed: ${errorDetail(transaction.error)}`),
            );
          transaction.onabort = transaction.onerror;
        });
      };

      const remove = (nodeId: string, throughRevision: number): Promise<BrowserCheckpointResult<boolean>> => {
        if (!isIdentifier(nodeId) || !isRevision(throughRevision)) {
          return Promise.resolve(
            failed("checkpoint-record-invalid", "Checkpoint removal requires a node identifier and safe revision."),
          );
        }
        const started = begin("readwrite", "indexed-db-delete-failed");
        if (!started.ok) return Promise.resolve(started);
        const { transaction, store } = started.value;

        return new Promise((resolveRemove) => {
          let removed = false;
          let operationSettled = false;
          const finishRemove = (result: BrowserCheckpointResult<boolean>): void => {
            if (operationSettled) return;
            operationSettled = true;
            resolveRemove(result);
          };
          let getRequest: NativeRequest | null = null;
          try {
            getRequest = asRequest(store.get(nodeId));
          } catch (error) {
            finishRemove(failed("indexed-db-delete-failed", `IndexedDB checkpoint lookup threw: ${String(error)}`));
            abortQuietly(transaction);
            return;
          }
          if (getRequest === null) {
            finishRemove(failed("indexed-db-delete-failed", "IndexedDB returned an invalid checkpoint lookup request."));
            abortQuietly(transaction);
            return;
          }
          getRequest.onsuccess = () => {
            if (getRequest?.result === undefined) return;
            const decoded = validateBrowserCheckpointRecord(getRequest.result);
            if (!decoded.ok) {
              finishRemove(decoded);
              abortQuietly(transaction);
              return;
            }
            if (decoded.value.revision > throughRevision) {
              finishRemove(
                failed(
                  "checkpoint-revision-conflict",
                  `Stored checkpoint revision ${String(decoded.value.revision)} is newer than removal revision ${String(throughRevision)}.`,
                  "backpressure",
                ),
              );
              abortQuietly(transaction);
              return;
            }
            let deleteRequest: NativeRequest | null = null;
            try {
              deleteRequest = asRequest(store.delete(nodeId));
            } catch (error) {
              finishRemove(failed("indexed-db-delete-failed", `IndexedDB checkpoint delete threw: ${String(error)}`));
              abortQuietly(transaction);
              return;
            }
            if (deleteRequest === null) {
              finishRemove(failed("indexed-db-delete-failed", "IndexedDB returned an invalid checkpoint delete request."));
              abortQuietly(transaction);
              return;
            }
            removed = true;
            deleteRequest.onerror = () =>
              finishRemove(
                failed("indexed-db-delete-failed", `IndexedDB checkpoint delete failed: ${errorDetail(deleteRequest?.error)}`),
              );
          };
          getRequest.onerror = () =>
            finishRemove(
              failed("indexed-db-delete-failed", `IndexedDB checkpoint lookup failed: ${errorDetail(getRequest?.error)}`),
            );
          transaction.oncomplete = () => finishRemove(succeeded(removed));
          transaction.onerror = () =>
            finishRemove(
              failed("indexed-db-delete-failed", `IndexedDB checkpoint transaction failed: ${errorDetail(transaction.error)}`),
            );
          transaction.onabort = transaction.onerror;
        });
      };

      finish(
        succeeded({
          load,
          save,
          remove,
          close: () => {
            if (closed) return succeeded(null);
            try {
              database.close();
              closed = true;
              return succeeded(null);
            } catch (error) {
              return failed("indexed-db-close-failed", `IndexedDB checkpoint close failed: ${String(error)}`);
            }
          },
        }),
      );
    };
  });
}
