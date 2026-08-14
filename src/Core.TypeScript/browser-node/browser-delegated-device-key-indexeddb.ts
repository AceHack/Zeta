import type { BrowserDelegatedDeviceProposalResult } from "./browser-delegated-device-proposal-signer";
import type { BrowserProposalDeviceKeyStore, BrowserStoredProposalDeviceKey } from "./browser-delegated-device-key";

export const BROWSER_PROPOSAL_DEVICE_DATABASE = "zeta-proposal-device-v1" as const;
export const BROWSER_PROPOSAL_DEVICE_STORE = "proposal-device-keys" as const;

function failed<T>(
  detail: string,
  severity: "backpressure" | "heat" = "heat",
): BrowserDelegatedDeviceProposalResult<T> {
  return { ok: false, feedback: { severity, code: "device-proposal-key-unavailable", detail } };
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function method(value: unknown, name: string): ((...arguments_: readonly unknown[]) => unknown) | null {
  if (!isRecord(value)) return null;
  try {
    const candidate = Reflect.get(value, name);
    return typeof candidate === "function" ? (candidate as (...arguments_: readonly unknown[]) => unknown) : null;
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

/** Persist a non-exportable CryptoKey by IndexedDB structured clone. */
export function openNativeIndexedDbProposalDeviceKeyStore(
  root: unknown,
  options: { readonly databaseName?: string; readonly storeName?: string } = {},
): Promise<BrowserDelegatedDeviceProposalResult<BrowserProposalDeviceKeyStore>> {
  const databaseName = options.databaseName ?? BROWSER_PROPOSAL_DEVICE_DATABASE;
  const storeName = options.storeName ?? BROWSER_PROPOSAL_DEVICE_STORE;
  if (databaseName.length === 0 || storeName.length === 0) {
    return Promise.resolve(failed("IndexedDB device-key database and store names must be non-empty."));
  }
  if (root === null || (typeof root !== "object" && typeof root !== "function")) {
    return Promise.resolve(failed("This runtime does not expose IndexedDB.", "backpressure"));
  }
  let factory: unknown;
  try {
    factory = Reflect.get(root, "indexedDB");
  } catch {
    return Promise.resolve(failed("This runtime blocked access to IndexedDB."));
  }
  const open = method(factory, "open");
  if (open === null) return Promise.resolve(failed("This runtime does not expose IndexedDB.", "backpressure"));

  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = Reflect.apply(open, factory, [databaseName, 1]) as IDBOpenDBRequest;
    } catch (error) {
      resolve(failed(`IndexedDB device-key open threw: ${String(error)}`));
      return;
    }

    let settled = false;
    let upgradeError: string | null = null;
    const finish = (result: BrowserDelegatedDeviceProposalResult<BrowserProposalDeviceKeyStore>): void => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    request.onblocked = () => {
      finish(failed("Another browser context blocked the device-key database upgrade.", "backpressure"));
    };
    request.onerror = () => {
      finish(failed(`IndexedDB failed to open the device-key database: ${errorDetail(request.error)}`));
    };
    request.onupgradeneeded = () => {
      try {
        if (!request.result.objectStoreNames.contains(storeName)) {
          request.result.createObjectStore(storeName, { keyPath: "name" });
        }
      } catch (error) {
        upgradeError = `IndexedDB failed to create the device-key store: ${String(error)}`;
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      if (settled) {
        database.close();
        return;
      }
      if (upgradeError !== null || !database.objectStoreNames.contains(storeName)) {
        database.close();
        finish(failed(upgradeError ?? "IndexedDB did not create the device-key store."));
        return;
      }
      database.onversionchange = () => database.close();

      const load = (): Promise<BrowserDelegatedDeviceProposalResult<BrowserStoredProposalDeviceKey | null>> =>
        new Promise((loadResolve) => {
          let transaction: IDBTransaction;
          let get: IDBRequest<unknown>;
          try {
            transaction = database.transaction(storeName, "readonly");
            get = transaction.objectStore(storeName).get("active");
          } catch (error) {
            loadResolve(failed(`IndexedDB could not read the retained device key: ${String(error)}`));
            return;
          }
          let value: BrowserStoredProposalDeviceKey | null = null;
          get.onsuccess = () => {
            value = get.result === undefined ? null : (get.result as BrowserStoredProposalDeviceKey);
          };
          transaction.oncomplete = () => loadResolve({ ok: true, value });
          transaction.onerror = () =>
            loadResolve(failed(`IndexedDB device-key read failed: ${errorDetail(transaction.error)}`));
          transaction.onabort = transaction.onerror;
        });

      const retain = (
        candidate: BrowserStoredProposalDeviceKey,
      ): Promise<BrowserDelegatedDeviceProposalResult<BrowserStoredProposalDeviceKey>> =>
        new Promise((retainResolve) => {
          let transaction: IDBTransaction;
          let store: IDBObjectStore;
          let get: IDBRequest<unknown>;
          try {
            transaction = database.transaction(storeName, "readwrite");
            store = transaction.objectStore(storeName);
            get = store.get("active");
          } catch (error) {
            retainResolve(failed(`IndexedDB could not retain the device key: ${String(error)}`));
            return;
          }
          let retained = candidate;
          get.onsuccess = () => {
            if (get.result !== undefined) {
              retained = get.result as BrowserStoredProposalDeviceKey;
              return;
            }
            try {
              store.put(candidate);
            } catch {
              transaction.abort();
            }
          };
          transaction.oncomplete = () => retainResolve({ ok: true, value: retained });
          transaction.onerror = () =>
            retainResolve(failed(`IndexedDB device-key write failed: ${errorDetail(transaction.error)}`));
          transaction.onabort = transaction.onerror;
        });

      finish({ ok: true, value: { load, retain } });
    };
  });
}
