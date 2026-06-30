/* Project Genesis — vault storage seam.
 *
 * `VaultStorage` is the backend-agnostic interface the app codes against:
 * GitHub is the FIRST backend (free-first), but the same interface will back
 * other stores later, so nothing above this line knows it is talking to GitHub.
 *
 *   get(path)            -> value | null
 *   put(path, value)     -> { sha }          (upsert; idempotent by path+sha)
 *   list(prefix)         -> [{ path, sha }]
 *   remove(path)         -> void
 *
 * Values are arbitrary JSON. When a `crypto` (VaultCrypto) is supplied, the
 * value is encrypted in the browser BEFORE it is written and decrypted AFTER it
 * is read — the datastore only ever holds ciphertext envelopes. Without a
 * `crypto`, values are stored as plaintext JSON (dev / non-sensitive only).
 *
 * GitHubVaultStorage uses the Contents API:
 *   - reads/writes a per-user repo (the user's own vault repo) on a branch,
 *   - PUT requires the current blob `sha` to overwrite (optimistic
 *     concurrency — a stale sha is rejected with 409/422; put() retries),
 *   - content is base64; we read-before-write to fetch the sha,
 *   - 404 on read == "not found" (returns null), not an error.
 *
 * Auth: a short-lived GitHub data token (see ./dataToken.js) passed in per call
 * via an injected `getToken()` so the token is never captured in this object and
 * always reflects the latest refresh.
 */

const GITHUB_API = "https://api.github.com";

/** Thrown for non-404 datastore failures so callers can distinguish them. */
export class VaultStorageError extends Error {
  constructor(message, { status, path } = {}) {
    super(message);
    this.name = "VaultStorageError";
    this.status = status;
    this.path = path;
  }
}

export class GitHubVaultStorage {
  /**
   * @param {object} opts
   * @param {string}   opts.owner     repo owner (the user's login)
   * @param {string}   opts.repo      vault repo name (e.g. "genesis-vault")
   * @param {string}  [opts.branch]   default "main"
   * @param {string}  [opts.prefix]   key prefix inside the repo, e.g. "vault/"
   * @param {() => Promise<string>} opts.getToken  yields a fresh data token
   * @param {import("./crypto.js").VaultCrypto} [opts.crypto] encrypt-at-rest
   * @param {typeof fetch} [opts.fetchImpl] injectable for tests (DST)
   */
  constructor({ owner, repo, branch = "main", prefix = "vault/", getToken, crypto, fetchImpl }) {
    if (!owner || !repo) throw new Error("GitHubVaultStorage requires owner and repo");
    if (typeof getToken !== "function") throw new Error("GitHubVaultStorage requires getToken()");
    this.owner = owner;
    this.repo = repo;
    this.branch = branch;
    this.prefix = prefix;
    this._getToken = getToken;
    this._crypto = crypto || null;
    this._fetch = fetchImpl || ((...a) => fetch(...a));
  }

  _contentsUrl(path) {
    return `${GITHUB_API}/repos/${enc(this.owner)}/${enc(this.repo)}/contents/${encPath(
      this._full(path)
    )}`;
  }

  _full(path) {
    const clean = String(path).replace(/^\/+/, "");
    return this.prefix ? this.prefix.replace(/\/+$/, "") + "/" + clean : clean;
  }

  async _headers() {
    const token = await this._getToken();
    if (!token) throw new VaultStorageError("no data token available", { status: 401 });
    return {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  /** Fetch the raw blob + sha for a path, or null if it does not exist. */
  async _readRaw(path) {
    const url = `${this._contentsUrl(path)}?ref=${enc(this.branch)}`;
    const res = await this._fetch(url, { headers: await this._headers() });
    if (res.status === 404) return null;
    if (!res.ok) {
      throw new VaultStorageError(`read failed (${res.status})`, { status: res.status, path });
    }
    const body = await res.json();
    // contents API returns base64 with embedded newlines.
    const json = decodeB64Utf8(String(body.content || "").replace(/\n/g, ""));
    return { sha: body.sha, raw: json };
  }

  async get(path) {
    const found = await this._readRaw(path);
    if (!found) return null;
    const stored = JSON.parse(found.raw);
    if (this._crypto) return this._crypto.decryptJson(stored);
    return stored;
  }

  async put(path, value, { message } = {}) {
    const payload = this._crypto ? await this._crypto.encryptJson(value) : value;
    const contentB64 = encodeB64Utf8(JSON.stringify(payload));
    // Optimistic concurrency: the Contents API rejects a stale `sha` with
    // 409/422. So we read-before-write to fetch the current sha and, on a
    // conflict, re-read the latest sha and retry a bounded number of times
    // (last-writer-detect, not silent last-writer-wins).
    let lastStatus = 0;
    for (let attempt = 0; attempt < 3; attempt++) {
      const existing = await this._readRaw(path);
      const body = {
        message: message || `vault: update ${this._full(path)}`,
        content: contentB64,
        branch: this.branch,
      };
      if (existing) body.sha = existing.sha;
      const res = await this._fetch(this._contentsUrl(path), {
        method: "PUT",
        headers: { ...(await this._headers()), "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const out = await res.json();
        return { sha: out.content && out.content.sha };
      }
      lastStatus = res.status;
      if (res.status !== 409 && res.status !== 422) break; // non-conflict: fail fast
    }
    throw new VaultStorageError(`write failed (${lastStatus})`, { status: lastStatus, path });
  }

  async list(prefix = "") {
    const url = `${this._contentsUrl(prefix)}?ref=${enc(this.branch)}`;
    const res = await this._fetch(url, { headers: await this._headers() });
    if (res.status === 404) return [];
    if (!res.ok) {
      throw new VaultStorageError(`list failed (${res.status})`, { status: res.status, path: prefix });
    }
    const items = await res.json();
    if (!Array.isArray(items)) return []; // a file, not a directory
    const base = this.prefix.replace(/\/+$/, "") + "/";
    return items
      .filter((it) => it.type === "file")
      .map((it) => ({ path: stripPrefix(it.path, base), sha: it.sha }));
  }

  async remove(path, { message } = {}) {
    const existing = await this._readRaw(path);
    if (!existing) return; // already gone — idempotent
    const res = await this._fetch(this._contentsUrl(path), {
      method: "DELETE",
      headers: { ...(await this._headers()), "content-type": "application/json" },
      body: JSON.stringify({
        message: message || `vault: remove ${this._full(path)}`,
        sha: existing.sha,
        branch: this.branch,
      }),
    });
    if (!res.ok && res.status !== 404) {
      throw new VaultStorageError(`delete failed (${res.status})`, { status: res.status, path });
    }
  }
}

/* ---- helpers ----------------------------------------------------------- */

const enc = (s) => encodeURIComponent(String(s));
const encPath = (s) => String(s).split("/").map(encodeURIComponent).join("/");

function stripPrefix(p, base) {
  return p.startsWith(base) ? p.slice(base.length) : p;
}

// UTF-8-safe base64 (btoa/atob are latin1-only).
function encodeB64Utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}
function decodeB64Utf8(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}
