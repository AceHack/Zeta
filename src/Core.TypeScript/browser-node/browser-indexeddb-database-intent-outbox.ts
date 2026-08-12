import {
  browserDatabaseIntentFailed,
  browserDatabaseIntentReadout,
  copyBrowserDatabaseIntent,
  copyBrowserDatabaseIntentLedger,
  decideBrowserDatabaseIntentBegin,
  decideBrowserDatabaseIntentEnqueue,
  decideBrowserDatabaseIntentRefusal,
  decideBrowserDatabaseIntentSettlement,
  emptyBrowserDatabaseIntentLedger,
  validateBrowserDatabaseIntentLedger,
  validateBrowserDatabaseIntentLimits,
  type BrowserDatabaseIntentDraft,
  type BrowserDatabaseIntentFeedback,
  type BrowserDatabaseIntentLedger,
  type BrowserDatabaseIntentLimits,
  type BrowserDatabaseIntentOutboxPort,
  type BrowserDatabaseIntentReadout,
  type BrowserDatabaseIntentRecord,
  type BrowserDatabaseIntentRefusal,
  type BrowserDatabaseIntentResult,
} from "./browser-database-intent-outbox";
import type { ZetaDbTickReadout } from "../zetadb/zeta-db-node";

export interface NativeIndexedDbDatabaseIntentOutboxOptions {
  readonly databaseName: string;
  readonly storeName: string;
  readonly limits: BrowserDatabaseIntentLimits;
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
  put(value: BrowserDatabaseIntentLedger): NativeRequest;
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

type UnknownMethod = (...arguments_: readonly unknown[]) => unknown;

interface LedgerMutation<T> {
  readonly ledger: BrowserDatabaseIntentLedger;
  readonly value: T;
}

interface NativeTransactionScope {
  readonly transaction: NativeTransaction;
  readonly store: NativeObjectStore;
}

function succeeded<T>(value: T): BrowserDatabaseIntentResult<T> {
  return { ok: true, value };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function method(value: unknown, name: string): UnknownMethod | null {
  if (!isRecord(value)) return null;
  try {
    const candidate = Reflect.get(value, name);
    return typeof candidate === "function" ? (candidate as UnknownMethod) : null;
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
  return !isRecord(value) || method(value, "objectStore") === null || method(value, "abort") === null
    ? null
    : (value as unknown as NativeTransaction);
}

function asObjectStore(value: unknown): NativeObjectStore | null {
  return !isRecord(value) || method(value, "get") === null || method(value, "put") === null
    ? null
    : (value as unknown as NativeObjectStore);
}

function asRequest(value: unknown): NativeRequest | null {
  return isRecord(value) ? (value as unknown as NativeRequest) : null;
}

function abortQuietly(transaction: NativeTransaction): void {
  try {
    transaction.abort();
  } catch {
    // The typed operation failure remains primary.
  }
}

function closeQuietly(database: NativeDatabase): void {
  try {
    database.close();
  } catch {
    // The typed open failure remains primary.
  }
}

function createPromiseSettlement<T>(resolve: (result: T) => void): {
  readonly finish: (result: T) => void;
  readonly isSettled: () => boolean;
} {
  let settled = false;
  return {
    finish: (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    },
    isSettled: () => settled,
  };
}

class NativeIndexedDbDatabaseIntentOutbox implements BrowserDatabaseIntentOutboxPort {
  private closed = false;
  private readonly database: NativeDatabase;
  private readonly storeName: string;
  private readonly limits: BrowserDatabaseIntentLimits;

  public constructor(database: NativeDatabase, storeName: string, limits: BrowserDatabaseIntentLimits) {
    this.database = database;
    this.storeName = storeName;
    this.limits = limits;
  }

  private beginTransaction(
    mode: "readonly" | "readwrite",
    code: "intent-read-failed" | "intent-write-failed",
  ): BrowserDatabaseIntentResult<NativeTransactionScope> {
    if (this.closed) {
      return browserDatabaseIntentFailed("intent-store-closed", "The IndexedDB intent outbox is closed.");
    }
    try {
      const transaction = asTransaction(this.database.transaction(this.storeName, mode));
      if (transaction === null) {
        return browserDatabaseIntentFailed(code, "IndexedDB returned an invalid intent transaction.");
      }
      const store = asObjectStore(transaction.objectStore(this.storeName));
      return store === null
        ? browserDatabaseIntentFailed(code, "IndexedDB returned an invalid intent object store.")
        : succeeded({ transaction, store });
    } catch (error) {
      return browserDatabaseIntentFailed(code, `IndexedDB failed to start an intent transaction: ${String(error)}`);
    }
  }

  public read(databaseNodeId: string): Promise<BrowserDatabaseIntentResult<BrowserDatabaseIntentReadout>> {
    const empty = emptyBrowserDatabaseIntentLedger(databaseNodeId);
    if (!empty.ok) return Promise.resolve(empty);
    const started = this.beginTransaction("readonly", "intent-read-failed");
    if (!started.ok) return Promise.resolve(started);
    const { transaction, store } = started.value;

    return new Promise((resolve) => {
      let ledger = empty.value;
      const { finish } = createPromiseSettlement(resolve);
      let request: NativeRequest;
      try {
        const candidate = asRequest(store.get(databaseNodeId));
        if (candidate === null) {
          finish(
            browserDatabaseIntentFailed("intent-read-failed", "IndexedDB returned an invalid intent read request."),
          );
          abortQuietly(transaction);
          return;
        }
        request = candidate;
      } catch (error) {
        finish(browserDatabaseIntentFailed("intent-read-failed", `IndexedDB intent read threw: ${String(error)}`));
        abortQuietly(transaction);
        return;
      }

      request.onsuccess = () => {
        if (request.result === undefined) return;
        const decoded = validateBrowserDatabaseIntentLedger(request.result);
        if (!decoded.ok) {
          finish(decoded);
          abortQuietly(transaction);
          return;
        }
        ledger = decoded.value;
      };
      request.onerror = () => {
        finish(
          browserDatabaseIntentFailed(
            "intent-read-failed",
            `IndexedDB intent read failed: ${errorDetail(request.error)}`,
          ),
        );
      };
      transaction.oncomplete = () => {
        finish(browserDatabaseIntentReadout(ledger, this.limits));
      };
      transaction.onerror = () => {
        finish(
          browserDatabaseIntentFailed(
            "intent-read-failed",
            `IndexedDB intent transaction failed: ${errorDetail(transaction.error)}`,
          ),
        );
      };
      transaction.onabort = transaction.onerror;
    });
  }

  private mutate<T>(
    databaseNodeId: string,
    decide: (existing: unknown) => BrowserDatabaseIntentResult<LedgerMutation<T>>,
  ): Promise<BrowserDatabaseIntentResult<T>> {
    const started = this.beginTransaction("readwrite", "intent-write-failed");
    if (!started.ok) return Promise.resolve(started);
    const { transaction, store } = started.value;

    return new Promise((resolve) => {
      let hasValue = false;
      let value: T;
      const { finish } = createPromiseSettlement(resolve);
      let request: NativeRequest;
      try {
        const candidate = asRequest(store.get(databaseNodeId));
        if (candidate === null) {
          finish(
            browserDatabaseIntentFailed(
              "intent-write-failed",
              "IndexedDB returned an invalid intent comparison request.",
            ),
          );
          abortQuietly(transaction);
          return;
        }
        request = candidate;
      } catch (error) {
        finish(
          browserDatabaseIntentFailed("intent-write-failed", `IndexedDB intent comparison threw: ${String(error)}`),
        );
        abortQuietly(transaction);
        return;
      }

      request.onsuccess = () => {
        const decision = decide(request.result === undefined ? null : request.result);
        if (!decision.ok) {
          finish(decision);
          abortQuietly(transaction);
          return;
        }
        hasValue = true;
        value = decision.value.value;
        let write: NativeRequest;
        try {
          const candidate = asRequest(store.put(copyBrowserDatabaseIntentLedger(decision.value.ledger)));
          if (candidate === null) {
            finish(
              browserDatabaseIntentFailed("intent-write-failed", "IndexedDB returned an invalid intent write request."),
            );
            abortQuietly(transaction);
            return;
          }
          write = candidate;
        } catch (error) {
          finish(browserDatabaseIntentFailed("intent-write-failed", `IndexedDB intent write threw: ${String(error)}`));
          abortQuietly(transaction);
          return;
        }
        write.onerror = () => {
          finish(
            browserDatabaseIntentFailed(
              "intent-write-failed",
              `IndexedDB intent write failed: ${errorDetail(write.error)}`,
            ),
          );
        };
      };
      request.onerror = () => {
        finish(
          browserDatabaseIntentFailed(
            "intent-write-failed",
            `IndexedDB intent comparison failed: ${errorDetail(request.error)}`,
          ),
        );
      };
      transaction.oncomplete = () => {
        finish(
          hasValue
            ? succeeded(value)
            : browserDatabaseIntentFailed("intent-write-failed", "IndexedDB committed without an intent result."),
        );
      };
      transaction.onerror = () => {
        finish(
          browserDatabaseIntentFailed(
            "intent-write-failed",
            `IndexedDB intent transaction failed: ${errorDetail(transaction.error)}`,
          ),
        );
      };
      transaction.onabort = transaction.onerror;
    });
  }

  private readoutDecision(
    ledger: BrowserDatabaseIntentLedger,
  ): BrowserDatabaseIntentResult<LedgerMutation<BrowserDatabaseIntentReadout>> {
    const readout = browserDatabaseIntentReadout(ledger, this.limits);
    return readout.ok ? succeeded({ ledger, value: readout.value }) : readout;
  }

  public enqueue(draft: BrowserDatabaseIntentDraft): Promise<BrowserDatabaseIntentResult<BrowserDatabaseIntentRecord>> {
    return this.mutate(draft.databaseNodeId, (existing) => {
      const decision = decideBrowserDatabaseIntentEnqueue(existing, draft, this.limits);
      return decision.ok
        ? succeeded({ ledger: decision.value.ledger, value: copyBrowserDatabaseIntent(decision.value.value) })
        : decision;
    });
  }

  public begin(
    databaseNodeId: string,
    intentId: string,
    sequence: number,
  ): Promise<BrowserDatabaseIntentResult<BrowserDatabaseIntentRecord>> {
    return this.mutate(databaseNodeId, (existing) => {
      const decision = decideBrowserDatabaseIntentBegin(existing, databaseNodeId, intentId, sequence, this.limits);
      return decision.ok
        ? succeeded({ ledger: decision.value.ledger, value: copyBrowserDatabaseIntent(decision.value.value) })
        : decision;
    });
  }

  public settle(
    databaseNodeId: string,
    intentId: string,
    sequence: number,
    tick: ZetaDbTickReadout,
  ): Promise<BrowserDatabaseIntentResult<BrowserDatabaseIntentReadout>> {
    return this.mutate(databaseNodeId, (existing) => {
      const decision = decideBrowserDatabaseIntentSettlement(
        existing,
        databaseNodeId,
        intentId,
        sequence,
        tick,
        this.limits,
      );
      return decision.ok ? this.readoutDecision(decision.value.ledger) : decision;
    });
  }

  public refuse(
    databaseNodeId: string,
    intentId: string,
    sequence: number,
    refusal: BrowserDatabaseIntentRefusal,
  ): Promise<BrowserDatabaseIntentResult<BrowserDatabaseIntentReadout>> {
    return this.mutate(databaseNodeId, (existing) => {
      const decision = decideBrowserDatabaseIntentRefusal(existing, databaseNodeId, intentId, sequence, refusal);
      return decision.ok ? this.readoutDecision(decision.value) : decision;
    });
  }

  public close(): BrowserDatabaseIntentResult<null> {
    if (this.closed) return succeeded(null);
    try {
      this.database.close();
      this.closed = true;
      return succeeded(null);
    } catch (error) {
      return browserDatabaseIntentFailed(
        "intent-close-failed",
        `IndexedDB intent outbox close failed: ${String(error)}`,
      );
    }
  }
}

function createObjectStore(request: NativeOpenRequest, storeName: string): BrowserDatabaseIntentFeedback | null {
  const database = asDatabase(request.result);
  if (database === null) {
    return browserDatabaseIntentFailed(
      "intent-write-failed",
      "IndexedDB returned an invalid database while creating the intent store.",
    ).feedback;
  }
  try {
    if (!database.objectStoreNames.contains(storeName)) {
      database.createObjectStore(storeName, { keyPath: "databaseNodeId" });
    }
    return null;
  } catch (error) {
    return browserDatabaseIntentFailed(
      "intent-write-failed",
      `IndexedDB failed to create the intent store: ${String(error)}`,
    ).feedback;
  }
}

function inspectOpenedDatabase(
  request: NativeOpenRequest,
  storeName: string,
): BrowserDatabaseIntentResult<NativeDatabase> {
  const database = asDatabase(request.result);
  if (database === null) {
    return browserDatabaseIntentFailed("intent-read-failed", "IndexedDB returned an invalid intent database.");
  }
  try {
    if (!database.objectStoreNames.contains(storeName)) {
      closeQuietly(database);
      return browserDatabaseIntentFailed("intent-read-failed", "The IndexedDB intent store was not created.");
    }
    return succeeded(database);
  } catch (error) {
    closeQuietly(database);
    return browserDatabaseIntentFailed(
      "intent-read-failed",
      `IndexedDB intent-store inspection failed: ${String(error)}`,
    );
  }
}

function configureVersionChange(
  database: NativeDatabase,
  outbox: NativeIndexedDbDatabaseIntentOutbox,
): BrowserDatabaseIntentResult<BrowserDatabaseIntentOutboxPort> {
  try {
    database.onversionchange = () => {
      outbox.close();
    };
    return succeeded(outbox);
  } catch (error) {
    closeQuietly(database);
    return browserDatabaseIntentFailed(
      "intent-read-failed",
      `IndexedDB intent version-change wiring failed: ${String(error)}`,
    );
  }
}

/** Open the native durable adapter without exposing IndexedDB to the outbox contract. */
export function openNativeIndexedDbDatabaseIntentOutbox(
  root: unknown,
  options: NativeIndexedDbDatabaseIntentOutboxOptions,
): Promise<BrowserDatabaseIntentResult<BrowserDatabaseIntentOutboxPort>> {
  const limits = validateBrowserDatabaseIntentLimits(options.limits);
  if (!isIdentifier(options.databaseName) || !isIdentifier(options.storeName) || !limits.ok) {
    return Promise.resolve(
      browserDatabaseIntentFailed(
        "intent-configuration-invalid",
        "IndexedDB intent storage requires database and store names plus positive safe-integer budgets.",
      ),
    );
  }
  if (root === null || (typeof root !== "object" && typeof root !== "function")) {
    return Promise.resolve(
      browserDatabaseIntentFailed("intent-read-failed", "This runtime does not expose IndexedDB.", "backpressure"),
    );
  }

  let factory: unknown;
  try {
    factory = Reflect.get(root, "indexedDB");
  } catch {
    return Promise.resolve(browserDatabaseIntentFailed("intent-read-failed", "This runtime blocked IndexedDB access."));
  }
  const open = method(factory, "open");
  if (open === null) {
    return Promise.resolve(
      browserDatabaseIntentFailed("intent-read-failed", "This runtime does not expose IndexedDB.", "backpressure"),
    );
  }

  return new Promise((resolve) => {
    let request: NativeOpenRequest;
    try {
      request = Reflect.apply(open, factory, [options.databaseName, 1]) as NativeOpenRequest;
    } catch (error) {
      resolve(browserDatabaseIntentFailed("intent-read-failed", `IndexedDB outbox open threw: ${String(error)}`));
      return;
    }

    let upgradeFailure: BrowserDatabaseIntentFeedback | null = null;
    const settlement = createPromiseSettlement(resolve);
    const { finish } = settlement;

    request.onblocked = () => {
      finish(
        browserDatabaseIntentFailed(
          "intent-read-failed",
          "IndexedDB could not open the intent outbox because another connection blocked its schema version.",
          "backpressure",
        ),
      );
    };
    request.onerror = () => {
      finish(
        browserDatabaseIntentFailed(
          "intent-read-failed",
          `IndexedDB failed to open the intent outbox: ${errorDetail(request.error)}`,
        ),
      );
    };
    request.onupgradeneeded = () => {
      upgradeFailure = createObjectStore(request, options.storeName);
    };
    request.onsuccess = () => {
      const opened = inspectOpenedDatabase(request, options.storeName);
      if (!opened.ok) {
        finish(opened);
        return;
      }
      if (settlement.isSettled()) {
        closeQuietly(opened.value);
        return;
      }
      if (upgradeFailure !== null) {
        closeQuietly(opened.value);
        finish({ ok: false, feedback: upgradeFailure });
        return;
      }
      const outbox = new NativeIndexedDbDatabaseIntentOutbox(opened.value, options.storeName, limits.value);
      finish(configureVersionChange(opened.value, outbox));
    };
  });
}
