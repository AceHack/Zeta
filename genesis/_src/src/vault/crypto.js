/* Project Genesis — vault crypto seam.
 *
 * The vault is stored in an UNTRUSTED datastore (a GitHub repo — possibly
 * public). So every value is encrypted in the browser BEFORE it is written and
 * decrypted AFTER it is read — the datastore only ever sees ciphertext.
 *
 * Primitive: AES-GCM-256 via WebCrypto (`crypto.subtle`) — authenticated
 * encryption (confidentiality + integrity in one pass), a fresh random 96-bit
 * IV per message (NEVER reused under a key — IV reuse breaks GCM), and the IV
 * stored alongside the ciphertext (it is not secret).
 *
 * Key management is a SEAM, not a hardcode (noninterference: the key enters
 * ONLY through the injected provider — no ambient/global key):
 *   - CustodialKeyProvider  — the key is supplied by a custody backend the host
 *                             wires in (1Password "for now"). The custody token
 *                             is NEVER embedded in this client; the host injects
 *                             an async `fetchRawKey()` that returns 32 bytes
 *                             (typically proxied through the broker — see notes).
 *   - PassphraseKeyProvider — the zero-knowledge end-game: the key is DERIVED in
 *                             the browser from a user passphrase (PBKDF2-SHA-256,
 *                             per-vault random salt). Custody never sees a key.
 *
 * Both providers expose the same `getKey()` -> CryptoKey, so VaultCrypto and
 * everything above it are unchanged when custody is swapped for zero-knowledge.
 */

const ALGO = "AES-GCM";
const KEY_BITS = 256;
const IV_BYTES = 12; // 96-bit nonce — the GCM-recommended size
const KDF_ITERATIONS = 210_000; // OWASP 2023 PBKDF2-SHA256 floor
const SALT_BYTES = 16;

const subtle = () => {
  const c = (typeof globalThis !== "undefined" && globalThis.crypto) || null;
  if (!c || !c.subtle) {
    throw new Error("WebCrypto (crypto.subtle) is unavailable in this environment");
  }
  return c;
};

function assertRawKey(bytes) {
  if (!(bytes instanceof Uint8Array) || bytes.length !== 32) {
    throw new Error("raw vault key must be exactly 32 bytes (AES-256)");
  }
  return bytes;
}

/* ---- Key providers (the injected seam) -------------------------------- */

/**
 * Custodial key: the raw 32-byte key is supplied by the host via an injected
 * async `fetchRawKey()`. The host is responsible for sourcing it WITHOUT
 * leaking a custody secret into the browser (e.g. the broker proxies the
 * 1Password read and returns the key over an authenticated channel). The key
 * is imported as a non-extractable CryptoKey and cached for the session.
 */
export class CustodialKeyProvider {
  constructor({ fetchRawKey }) {
    if (typeof fetchRawKey !== "function") {
      throw new Error("CustodialKeyProvider requires a fetchRawKey() function");
    }
    this._fetchRawKey = fetchRawKey;
    this._key = null;
  }

  async getKey() {
    if (this._key) return this._key;
    const raw = assertRawKey(await this._fetchRawKey());
    this._key = await subtle().subtle.importKey("raw", raw, { name: ALGO }, false, [
      "encrypt",
      "decrypt",
    ]);
    // Best-effort wipe of the transient raw bytes.
    raw.fill(0);
    return this._key;
  }

  forget() {
    this._key = null;
  }
}

/**
 * Zero-knowledge key: derived in the browser from a user passphrase via
 * PBKDF2-SHA-256 with a per-vault random salt. The custody backend never sees
 * the key or the passphrase. Persist `saltB64` with the vault (it is not
 * secret); the same passphrase + salt reproduces the key.
 */
export class PassphraseKeyProvider {
  /** @param {{ passphrase: string, saltB64?: string, iterations?: number }} opts */
  constructor({ passphrase, saltB64, iterations }) {
    if (!passphrase) throw new Error("PassphraseKeyProvider requires a passphrase");
    this._passphrase = passphrase;
    this._iterations = iterations || KDF_ITERATIONS;
    this._salt = saltB64 ? b64ToBytes(saltB64) : randomBytes(SALT_BYTES);
    this._key = null;
  }

  /** Base64 salt to persist alongside the vault so the key can be re-derived. */
  get saltB64() {
    return bytesToB64(this._salt);
  }

  async getKey() {
    if (this._key) return this._key;
    const s = subtle().subtle;
    const baseKey = await s.importKey(
      "raw",
      new TextEncoder().encode(this._passphrase),
      { name: "PBKDF2" },
      false,
      ["deriveKey"]
    );
    this._key = await s.deriveKey(
      { name: "PBKDF2", salt: this._salt, iterations: this._iterations, hash: "SHA-256" },
      baseKey,
      { name: ALGO, length: KEY_BITS },
      false,
      ["encrypt", "decrypt"]
    );
    return this._key;
  }

  forget() {
    this._key = null;
    this._passphrase = "";
  }
}

/* ---- VaultCrypto ------------------------------------------------------- */

/**
 * Authenticated encryption over a key provider. Output envelope is JSON-safe
 * and self-describing so a reader needs only the key (not out-of-band params):
 *   { v: 1, alg: "AES-GCM", iv: <b64>, ct: <b64> }
 */
export class VaultCrypto {
  /** @param {{ getKey: () => Promise<CryptoKey> }} keyProvider */
  constructor(keyProvider) {
    if (!keyProvider || typeof keyProvider.getKey !== "function") {
      throw new Error("VaultCrypto requires a key provider with getKey()");
    }
    this._provider = keyProvider;
  }

  /** Encrypt a JS value (JSON-serialized) -> envelope object. */
  async encryptJson(value) {
    const plaintext = new TextEncoder().encode(JSON.stringify(value));
    return this.encryptBytes(plaintext);
  }

  /** Decrypt an envelope -> JS value (JSON-parsed). */
  async decryptJson(envelope) {
    const bytes = await this.decryptBytes(envelope);
    return JSON.parse(new TextDecoder().decode(bytes));
  }

  /** Encrypt raw bytes -> envelope object. A fresh IV is generated per call. */
  async encryptBytes(plaintext) {
    const key = await this._provider.getKey();
    const iv = randomBytes(IV_BYTES);
    const ct = await subtle().subtle.encrypt({ name: ALGO, iv }, key, plaintext);
    return { v: 1, alg: ALGO, iv: bytesToB64(iv), ct: bytesToB64(new Uint8Array(ct)) };
  }

  /** Decrypt an envelope -> raw bytes. Throws on tamper (GCM auth failure). */
  async decryptBytes(envelope) {
    if (!envelope || envelope.alg !== ALGO || !envelope.iv || !envelope.ct) {
      throw new Error("not a valid vault envelope");
    }
    const key = await this._provider.getKey();
    const iv = b64ToBytes(envelope.iv);
    const ct = b64ToBytes(envelope.ct);
    const pt = await subtle().subtle.decrypt({ name: ALGO, iv }, key, ct);
    return new Uint8Array(pt);
  }
}

/* ---- byte helpers ------------------------------------------------------ */

function randomBytes(n) {
  const out = new Uint8Array(n);
  subtle().getRandomValues(out);
  return out;
}

export function bytesToB64(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
