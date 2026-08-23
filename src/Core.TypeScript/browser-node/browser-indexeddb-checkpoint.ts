import {
  browserCheckpointFailed,
  browserCheckpointSucceeded,
  copyBrowserCheckpointRecord,
  decideBrowserCheckpointRemoval,
  decideBrowserCheckpointSave,
  validateBrowserCheckpointRecord,
  type BrowserCheckpointPort,
  type BrowserCheckpointRecord,
  type BrowserCheckpointResult,
} from "./browser-checkpoint-port";
import { monotoneLastWriterWinsRevisionPolicy, type RevisionPolicyPort } from "../persistence/revision-policy";

export interface NativeIndexedDbCheckpointFeedback {
  readonly severity: "backpressure" | "heat";
  readonly code:
    | "indexed-db-configuration-invalid"
    | "indexed-db-unavailable"
    | "indexed-db-blocked"
    | "indexed-db-open-failed";
  readonly detail: string;
}

export type NativeIndexedDbCheckpointResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly feedback: NativeIndexedDbCheckpointFeedback };

export interface NativeIndexedDbCheckpointOptions {
  readonly databaseName: string;
  readonly storeName: string;
  /** Defaults to monotone LWW so existing browser checkpoint behavior is unchanged. */
  readonly revisionPolicy?: RevisionPolicyPort;
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

function nativeFailed(
  code: NativeIndexedDbCheckpointFeedback["code"],
  detail: string,
  severity: NativeIndexedDbCheckpointFeedback["severity"] = "heat",
): { readonly ok: false; readonly feedback: NativeIndexedDbCheckpointFeedback } {
  return { ok: false, feedback: { severity, code, detail } };
}

function nativeSucceeded<T>(value: T): NativeIndexedDbCheckpointResult<T> {
  return { ok: true, value };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
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
): Promise<NativeIndexedDbCheckpointResult<BrowserCheckpointPort>> {
  if (!isIdentifier(options.databaseName) || !isIdentifier(options.storeName)) {
    return Promise.resolve(
      nativeFailed("indexed-db-configuration-invalid", "IndexedDB database and store names must be non-empty strings."),
    );
  }
  if (root === null || (typeof root !== "object" && typeof root !== "function")) {
    return Promise.resolve(
      nativeFailed("indexed-db-unavailable", "This runtime does not expose IndexedDB.", "backpressure"),
    );
  }

  let factoryValue: unknown;
  try {
    factoryValue = Reflect.get(root, "indexedDB");
  } catch {
    return Promise.resolve(nativeFailed("indexed-db-unavailable", "This runtime blocked access to IndexedDB."));
  }
  const open = method(factoryValue, "open");
  if (open === null) {
    return Promise.resolve(
      nativeFailed("indexed-db-unavailable", "This runtime does not expose IndexedDB.", "backpressure"),
    );
  }

  return new Promise((resolve) => {
    let request: NativeOpenRequest;
    try {
      request = Reflect.apply(open, factoryValue, [options.databaseName, 1]) as NativeOpenRequest;
    } catch (error) {
      resolve(nativeFailed("indexed-db-open-failed", `IndexedDB open threw: ${String(error)}`));
      return;
    }

    let settled = false;
    let upgradeFailure: NativeIndexedDbCheckpointFeedback | null = null;
    const finish = (result: NativeIndexedDbCheckpointResult<BrowserCheckpointPort>): void => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    request.onblocked = () => {
      finish(
        nativeFailed(
          "indexed-db-blocked",
          "IndexedDB could not open the checkpoint database because another connection blocked its schema version.",
          "backpressure",
        ),
      );
    };
    request.onerror = () => {
      finish(nativeFailed("indexed-db-open-failed", `IndexedDB failed to open: ${errorDetail(request.error)}`));
    };
    request.onupgradeneeded = () => {
      const database = asDatabase(request.result);
      if (database === null) {
        upgradeFailure = nativeFailed(
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
        upgradeFailure = nativeFailed(
          "indexed-db-open-failed",
          `IndexedDB failed to create the checkpoint store: ${String(error)}`,
        ).feedback;
      }
    };
    request.onsuccess = () => {
      const database = asDatabase(request.result);
      if (database === null) {
        finish(nativeFailed("indexed-db-open-failed", "IndexedDB returned an invalid checkpoint database."));
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
          finish(nativeFailed("indexed-db-open-failed", "The checkpoint object store was not created."));
          return;
        }
      } catch (error) {
        finish(nativeFailed("indexed-db-open-failed", `IndexedDB store inspection failed: ${String(error)}`));
        return;
      }

      let closed = false;
      const revisionPolicy = options.revisionPolicy ?? monotoneLastWriterWinsRevisionPolicy;
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
        finish(nativeFailed("indexed-db-open-failed", `IndexedDB version-change wiring failed: ${String(error)}`));
        return;
      }
      const begin = (
        mode: "readonly" | "readwrite",
        code: "checkpoint-read-failed" | "checkpoint-write-failed" | "checkpoint-delete-failed",
      ): BrowserCheckpointResult<{ readonly transaction: NativeTransaction; readonly store: NativeObjectStore }> => {
        if (closed)
          return browserCheckpointFailed("checkpoint-store-closed", "The IndexedDB checkpoint port is already closed.");
        try {
          const transaction = asTransaction(database.transaction(options.storeName, mode));
          if (transaction === null)
            return browserCheckpointFailed(code, "IndexedDB returned an invalid checkpoint transaction.");
          const store = asObjectStore(transaction.objectStore(options.storeName));
          return store === null
            ? browserCheckpointFailed(code, "IndexedDB returned an invalid checkpoint object store.")
            : browserCheckpointSucceeded({ transaction, store });
        } catch (error) {
          return browserCheckpointFailed(code, `IndexedDB failed to start a checkpoint transaction: ${String(error)}`);
        }
      };

      const load = (nodeId: string): Promise<BrowserCheckpointResult<BrowserCheckpointRecord | null>> => {
        if (!isIdentifier(nodeId)) {
          return Promise.resolve(
            browserCheckpointFailed("checkpoint-record-invalid", "A checkpoint node identifier must be non-empty."),
          );
        }
        const started = begin("readonly", "checkpoint-read-failed");
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
            finishLoad(
              browserCheckpointFailed("checkpoint-read-failed", `IndexedDB checkpoint read threw: ${String(error)}`),
            );
            abortQuietly(transaction);
            return;
          }
          if (getRequest === null) {
            finishLoad(
              browserCheckpointFailed(
                "checkpoint-read-failed",
                "IndexedDB returned an invalid checkpoint read request.",
              ),
            );
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
              browserCheckpointFailed(
                "checkpoint-read-failed",
                `IndexedDB checkpoint read failed: ${errorDetail(getRequest?.error)}`,
              ),
            );
          };
          transaction.oncomplete = () => finishLoad(browserCheckpointSucceeded(loaded));
          transaction.onerror = () =>
            finishLoad(
              browserCheckpointFailed(
                "checkpoint-read-failed",
                `IndexedDB checkpoint transaction failed: ${errorDetail(transaction.error)}`,
              ),
            );
          transaction.onabort = transaction.onerror;
        });
      };

      const save = (value: BrowserCheckpointRecord): Promise<BrowserCheckpointResult<BrowserCheckpointRecord>> => {
        const candidate = validateBrowserCheckpointRecord(value);
        if (!candidate.ok) return Promise.resolve(candidate);
        const started = begin("readwrite", "checkpoint-write-failed");
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
            finishSave(
              browserCheckpointFailed(
                "checkpoint-write-failed",
                `IndexedDB checkpoint comparison threw: ${String(error)}`,
              ),
            );
            abortQuietly(transaction);
            return;
          }
          if (getRequest === null) {
            finishSave(
              browserCheckpointFailed(
                "checkpoint-write-failed",
                "IndexedDB returned an invalid checkpoint comparison request.",
              ),
            );
            abortQuietly(transaction);
            return;
          }
          getRequest.onsuccess = () => {
            const decision = decideBrowserCheckpointSave(
              getRequest?.result === undefined ? null : getRequest.result,
              candidate.value,
              revisionPolicy,
            );
            if (!decision.ok) {
              finishSave(decision);
              abortQuietly(transaction);
              return;
            }
            if (decision.value.action === "idempotent") {
              return;
            }
            let putRequest: NativeRequest | null = null;
            try {
              putRequest = asRequest(store.put(copyBrowserCheckpointRecord(decision.value.record)));
            } catch (error) {
              finishSave(
                browserCheckpointFailed(
                  "checkpoint-write-failed",
                  `IndexedDB checkpoint write threw: ${String(error)}`,
                ),
              );
              abortQuietly(transaction);
              return;
            }
            if (putRequest === null) {
              finishSave(
                browserCheckpointFailed(
                  "checkpoint-write-failed",
                  "IndexedDB returned an invalid checkpoint write request.",
                ),
              );
              abortQuietly(transaction);
              return;
            }
            putRequest.onerror = () =>
              finishSave(
                browserCheckpointFailed(
                  "checkpoint-write-failed",
                  `IndexedDB checkpoint write failed: ${errorDetail(putRequest?.error)}`,
                ),
              );
          };
          getRequest.onerror = () =>
            finishSave(
              browserCheckpointFailed(
                "checkpoint-write-failed",
                `IndexedDB checkpoint comparison failed: ${errorDetail(getRequest?.error)}`,
              ),
            );
          transaction.oncomplete = () =>
            finishSave(browserCheckpointSucceeded(copyBrowserCheckpointRecord(candidate.value)));
          transaction.onerror = () =>
            finishSave(
              browserCheckpointFailed(
                "checkpoint-write-failed",
                `IndexedDB checkpoint transaction failed: ${errorDetail(transaction.error)}`,
              ),
            );
          transaction.onabort = transaction.onerror;
        });
      };

      const remove = (nodeId: string, throughRevision: number): Promise<BrowserCheckpointResult<boolean>> => {
        const removalInput = decideBrowserCheckpointRemoval(null, nodeId, throughRevision);
        if (!removalInput.ok) return Promise.resolve(removalInput);
        const started = begin("readwrite", "checkpoint-delete-failed");
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
            finishRemove(
              browserCheckpointFailed(
                "checkpoint-delete-failed",
                `IndexedDB checkpoint lookup threw: ${String(error)}`,
              ),
            );
            abortQuietly(transaction);
            return;
          }
          if (getRequest === null) {
            finishRemove(
              browserCheckpointFailed(
                "checkpoint-delete-failed",
                "IndexedDB returned an invalid checkpoint lookup request.",
              ),
            );
            abortQuietly(transaction);
            return;
          }
          getRequest.onsuccess = () => {
            const decision = decideBrowserCheckpointRemoval(
              getRequest?.result === undefined ? null : getRequest.result,
              nodeId,
              throughRevision,
            );
            if (!decision.ok) {
              finishRemove(decision);
              abortQuietly(transaction);
              return;
            }
            if (decision.value.action === "missing") return;
            let deleteRequest: NativeRequest | null = null;
            try {
              deleteRequest = asRequest(store.delete(nodeId));
            } catch (error) {
              finishRemove(
                browserCheckpointFailed(
                  "checkpoint-delete-failed",
                  `IndexedDB checkpoint delete threw: ${String(error)}`,
                ),
              );
              abortQuietly(transaction);
              return;
            }
            if (deleteRequest === null) {
              finishRemove(
                browserCheckpointFailed(
                  "checkpoint-delete-failed",
                  "IndexedDB returned an invalid checkpoint delete request.",
                ),
              );
              abortQuietly(transaction);
              return;
            }
            removed = true;
            deleteRequest.onerror = () =>
              finishRemove(
                browserCheckpointFailed(
                  "checkpoint-delete-failed",
                  `IndexedDB checkpoint delete failed: ${errorDetail(deleteRequest?.error)}`,
                ),
              );
          };
          getRequest.onerror = () =>
            finishRemove(
              browserCheckpointFailed(
                "checkpoint-delete-failed",
                `IndexedDB checkpoint lookup failed: ${errorDetail(getRequest?.error)}`,
              ),
            );
          transaction.oncomplete = () => finishRemove(browserCheckpointSucceeded(removed));
          transaction.onerror = () =>
            finishRemove(
              browserCheckpointFailed(
                "checkpoint-delete-failed",
                `IndexedDB checkpoint transaction failed: ${errorDetail(transaction.error)}`,
              ),
            );
          transaction.onabort = transaction.onerror;
        });
      };

      finish(
        nativeSucceeded({
          revisionPolicy,
          load,
          save,
          remove,
          close: () => {
            if (closed) return browserCheckpointSucceeded(null);
            try {
              database.close();
              closed = true;
              return browserCheckpointSucceeded(null);
            } catch (error) {
              return browserCheckpointFailed(
                "checkpoint-close-failed",
                `IndexedDB checkpoint close failed: ${String(error)}`,
              );
            }
          },
        }),
      );
    };
  });
}
