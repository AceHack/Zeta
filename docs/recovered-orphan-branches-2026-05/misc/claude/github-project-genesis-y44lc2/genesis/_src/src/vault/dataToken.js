/* Project Genesis — GitHub data-token provider (Path A: token cached in browser).
 *
 * The data token is what lets the browser call api.github.com directly to
 * read/write the user's own vault repo. Security stance:
 *
 *   - The data token is SHORT-LIVED (GitHub App user-to-server tokens expire in
 *     ~8h) and LEAST-PRIVILEGE (scoped to the user's single vault repo,
 *     Contents:write only). It is held IN MEMORY ONLY — never localStorage /
 *     sessionStorage / cookies — so it dies with the tab and is not persisted
 *     where stored-XSS could replay it across sessions.
 *
 *   - The long-lived REFRESH token never enters the browser. Instead the
 *     data-authorization callback hands back an OPAQUE SESSION HANDLE; the
 *     broker maps handle -> refresh token server-side (Cloudflare KV) and, on
 *     refresh, mints a new short-lived access token. So the backend is hit only
 *     at initial authorization and at ~8h refresh — "sparing", per the design.
 *
 * This object is backend-shaped but transport-agnostic: it POSTs the session
 * handle to `${authBase}/auth/data/refresh` and expects
 *   { token: "<gh-token>", expires_in: <seconds>, owner, repo }.
 */

const DEFAULT_SKEW_SECONDS = 120; // refresh this long before actual expiry
const SESSION_KEY = "genesis.data.session"; // opaque handle (NOT the token)

export class DataTokenProvider {
  /**
   * @param {object} opts
   * @param {string}  opts.authBase   broker base URL (no trailing slash)
   * @param {number} [opts.skewSeconds]
   * @param {typeof fetch} [opts.fetchImpl]
   */
  constructor({ authBase, skewSeconds = DEFAULT_SKEW_SECONDS, fetchImpl } = {}) {
    this.authBase = String(authBase || "").replace(/\/+$/, "");
    this.skewSeconds = skewSeconds;
    this._fetch = fetchImpl || ((...a) => fetch(...a));
    this._token = null; // in-memory only
    this._expiresAt = 0; // epoch seconds
    this._owner = null;
    this._repo = null;
    this._inflight = null;
  }

  /** True once a data session has been authorized (handle present). */
  isAuthorized() {
    return Boolean(readSessionHandle());
  }

  /** The user's vault repo coordinates, once known (after first token fetch). */
  get repoCoords() {
    return this._owner && this._repo ? { owner: this._owner, repo: this._repo } : null;
  }

  /** Redirect to the broker to authorize data access (GitHub App consent). */
  beginAuthorization(provider = "github") {
    if (!this.authBase) throw new Error("DataTokenProvider has no authBase");
    const redirect = window.location.origin + window.location.pathname;
    window.location.href =
      this.authBase +
      "/auth/" +
      encodeURIComponent(provider) +
      "/data/login?redirect=" +
      encodeURIComponent(redirect);
  }

  /**
   * On return from the data-authorization callback, capture the opaque session
   * handle from the URL fragment (#data_session=...) and strip it from the URL.
   * Returns true if a handle was captured.
   */
  captureSessionFromUrl() {
    const hash = (typeof window !== "undefined" && window.location.hash) || "";
    const m = hash.match(/[#&]data_session=([^&]+)/);
    if (!m) return false;
    const handle = decodeURIComponent(m[1]);
    try {
      // The handle is opaque (not a credential by itself — the refresh token it
      // maps to lives only in the broker's KV). Session-scoped storage is fine.
      sessionStorage.setItem(SESSION_KEY, handle);
    } catch {
      /* ignore */
    }
    // Remove the handle from the address bar / history.
    const cleaned = (window.location.hash || "").replace(/[#&]data_session=[^&]+/, "");
    history.replaceState(
      null,
      "",
      window.location.pathname + window.location.search + (cleaned && cleaned !== "#" ? cleaned : "")
    );
    return true;
  }

  /** Forget the in-memory token and the session handle (logout). */
  forget() {
    this._token = null;
    this._expiresAt = 0;
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }

  /** Yield a valid data token, refreshing through the broker if needed. */
  async getToken() {
    const now = Math.floor(Date.now() / 1000);
    if (this._token && now < this._expiresAt - this.skewSeconds) return this._token;
    if (this._inflight) return this._inflight;
    this._inflight = this._refresh().finally(() => {
      this._inflight = null;
    });
    return this._inflight;
  }

  async _refresh() {
    const handle = readSessionHandle();
    if (!handle) throw new Error("no data session — call beginAuthorization() first");
    const res = await this._fetch(this.authBase + "/auth/data/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ session: handle }),
    });
    if (res.status === 401) {
      this.forget();
      throw new Error("data session expired — re-authorization required");
    }
    if (!res.ok) throw new Error(`data token refresh failed (${res.status})`);
    const body = await res.json();
    if (!body || !body.token) throw new Error("malformed data-token response");
    this._token = body.token;
    this._expiresAt = Math.floor(Date.now() / 1000) + (Number(body.expires_in) || 3600);
    if (body.owner) this._owner = body.owner;
    if (body.repo) this._repo = body.repo;
    return this._token;
  }
}

function readSessionHandle() {
  try {
    return sessionStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}
