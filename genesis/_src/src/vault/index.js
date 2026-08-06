/* Project Genesis — vault entry point.
 *
 * Ties the three seams together and owns the ONE thing that must be decided
 * before any byte can be read: WHERE THE KEY COMES FROM.
 *
 * Two modes ship, and **zero-knowledge is the default**:
 *
 *   - "zk" (DEFAULT) — the key is derived in the browser from the user's
 *     passphrase (PBKDF2-SHA-256, per-vault random salt). No third party ever
 *     holds the key; the broker stays OAuth-only. A lost passphrase means an
 *     unrecoverable vault — that is the honest cost, stated up front.
 *   - "custodial" (OPT-IN) — the key is delivered by the broker Worker, which
 *     holds the team key as an encrypted Worker secret (sourced from 1Password).
 *     Recoverable, simpler UX; the trade is that the Worker becomes
 *     security-critical key infrastructure. Never the default.
 *
 * The mode is recorded per-vault in a PLAINTEXT `meta.json` (mode, KDF params,
 * salt, key id, and a `verifier` envelope). None of that is secret — the salt
 * and KDF parameters must be readable before the key exists, and the verifier
 * only proves a candidate key is the right one.
 */

import { VaultCrypto, CustodialKeyProvider, PassphraseKeyProvider } from "./crypto.js";

export { VaultCrypto, CustodialKeyProvider, PassphraseKeyProvider } from "./crypto.js";
export { GitHubVaultStorage, VaultStorageError } from "./storage.js";
export { DataTokenProvider } from "./dataToken.js";

export const VAULT_META_PATH = "meta.json";
export const MODE_ZK = "zk";
export const MODE_CUSTODIAL = "custodial";

/** Proves a candidate key is the vault's key without decrypting user data. */
const VERIFIER_PLAINTEXT = { genesis: "vault-v1" };

export class VaultLockedError extends Error {
  constructor(message = "wrong passphrase or key for this vault") {
    super(message);
    this.name = "VaultLockedError";
  }
}

/**
 * An unlocked vault: the storage interface, plus the metadata that describes
 * how it was locked. Data calls are delegated to the encrypted storage view.
 */
export class Vault {
  constructor({ storage, meta }) {
    this._storage = storage;
    this.meta = meta;
  }

  get mode() {
    return this.meta.mode;
  }

  get(path) {
    return this._storage.get(path);
  }
  put(path, value, opts) {
    return this._storage.put(path, value, opts);
  }
  remove(path, opts) {
    return this._storage.remove(path, opts);
  }
  async list(prefix = "") {
    const items = await this._storage.list(prefix);
    // meta.json is vault plumbing, not user data.
    return items.filter((it) => it.path !== VAULT_META_PATH);
  }
}

/** Read the plaintext vault metadata, or null if the vault is not initialized. */
export async function readVaultMeta(storage) {
  return storage.withCrypto(null).get(VAULT_META_PATH);
}

/**
 * Open a vault, initializing it on first use.
 *
 * @param {object} opts
 * @param {import("./storage.js").GitHubVaultStorage} opts.storage
 * @param {string}  [opts.passphrase]  required for zk mode
 * @param {() => Promise<Uint8Array>} [opts.fetchCustodialKey] required for custodial
 * @param {"zk"|"custodial"} [opts.mode] mode for a NEW vault (default "zk").
 *        Ignored for an existing vault — its recorded mode always wins.
 * @returns {Promise<Vault>}
 */
export async function openVault({ storage, passphrase, fetchCustodialKey, mode }) {
  if (!storage) throw new Error("openVault requires a storage");
  const plain = storage.withCrypto(null);
  const existing = await plain.get(VAULT_META_PATH);

  if (existing) return unlockExisting({ storage, plain, meta: existing, passphrase, fetchCustodialKey });
  return initialize({ storage, plain, passphrase, fetchCustodialKey, mode: mode || MODE_ZK });
}

async function initialize({ storage, plain, passphrase, fetchCustodialKey, mode }) {
  let provider;
  let meta;

  if (mode === MODE_ZK) {
    if (!passphrase) throw new Error("zero-knowledge vault requires a passphrase");
    provider = new PassphraseKeyProvider({ passphrase });
    meta = {
      v: 1,
      mode: MODE_ZK,
      kdf: { name: "PBKDF2", hash: "SHA-256", iterations: 210000, saltB64: provider.saltB64 },
    };
  } else if (mode === MODE_CUSTODIAL) {
    if (typeof fetchCustodialKey !== "function") {
      throw new Error("custodial vault requires fetchCustodialKey()");
    }
    provider = new CustodialKeyProvider({ fetchRawKey: fetchCustodialKey });
    meta = { v: 1, mode: MODE_CUSTODIAL };
  } else {
    throw new Error(`unknown vault mode '${mode}'`);
  }

  const crypto = new VaultCrypto(provider);
  meta.verifier = await crypto.encryptJson(VERIFIER_PLAINTEXT);
  meta.createdAt = new Date().toISOString();
  await plain.put(VAULT_META_PATH, meta, { message: "vault: initialize" });

  return new Vault({ storage: storage.withCrypto(crypto), meta });
}

async function unlockExisting({ storage, plain, meta, passphrase, fetchCustodialKey }) {
  let provider;
  if (meta.mode === MODE_ZK) {
    if (!passphrase) throw new Error("this vault is zero-knowledge — a passphrase is required");
    const kdf = meta.kdf || {};
    provider = new PassphraseKeyProvider({
      passphrase,
      saltB64: kdf.saltB64,
      iterations: kdf.iterations,
    });
  } else if (meta.mode === MODE_CUSTODIAL) {
    if (typeof fetchCustodialKey !== "function") {
      throw new Error("this vault is custodial — fetchCustodialKey() is required");
    }
    provider = new CustodialKeyProvider({ fetchRawKey: fetchCustodialKey });
  } else {
    throw new Error(`unknown vault mode '${meta.mode}'`);
  }

  const crypto = new VaultCrypto(provider);
  // Verify BEFORE handing back a vault, so a wrong passphrase fails loudly here
  // instead of surfacing as a confusing decrypt error on the first read.
  if (meta.verifier) {
    let round;
    try {
      round = await crypto.decryptJson(meta.verifier);
    } catch {
      throw new VaultLockedError();
    }
    if (!round || round.genesis !== VERIFIER_PLAINTEXT.genesis) throw new VaultLockedError();
  }

  void plain; // meta already read; the encrypted view is what callers use
  return new Vault({ storage: storage.withCrypto(crypto), meta });
}

/**
 * Custodial key source: ask the broker Worker for the team key, authenticated
 * with the identity JWT. Only used in custodial mode (opt-in); in the default
 * zero-knowledge mode the broker is never asked for a key at all.
 *
 * @param {{ authBase: string, getIdentityToken: () => (string|null), fetchImpl?: typeof fetch }} opts
 * @returns {() => Promise<Uint8Array>} a fetchRawKey() for CustodialKeyProvider
 */
export function brokerKeyFetcher({ authBase, getIdentityToken, fetchImpl }) {
  const base = String(authBase || "").replace(/\/+$/, "");
  const doFetch = fetchImpl || ((...a) => fetch(...a));
  return async () => {
    const token = getIdentityToken && getIdentityToken();
    if (!token) throw new Error("custodial key requires a signed-in identity");
    const res = await doFetch(base + "/vault/key", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 401 || res.status === 403) throw new Error("not authorized for the custodial key");
    if (res.status === 404) throw new Error("this broker has no custodial key configured");
    if (!res.ok) throw new Error(`custodial key fetch failed (${res.status})`);
    const body = await res.json();
    if (!body || !body.keyB64) throw new Error("malformed custodial key response");
    const bin = atob(body.keyB64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    if (out.length !== 32) throw new Error("custodial key must be 32 bytes");
    return out;
  };
}
