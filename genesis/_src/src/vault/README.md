# Genesis vault layer — GitHub-as-a-database, encrypted in the browser

This folder is the **data layer** for Project Genesis: it lets the static
GitHub Pages SPA read and write a user's data with **no backend of our own**,
by using a GitHub repo as the datastore and encrypting every value in the
browser before it is stored.

Three small, composable seams:

| File | Seam | Responsibility |
|------|------|----------------|
| `crypto.js` | `VaultCrypto` + key providers | AES-GCM-256 authenticated encryption; the key enters only through an injected provider |
| `storage.js` | `VaultStorage` (`GitHubVaultStorage`) | backend-agnostic get/put/list/remove; GitHub Contents API is the first backend |
| `dataToken.js` | `DataTokenProvider` | obtains/refreshes the short-lived GitHub data token (in memory only) |

```
app  ──>  VaultStorage  ──(encrypt)──>  VaultCrypto  ──>  ciphertext
                │                            ▲
                │ getToken()                 │ getKey()
                ▼                            │
        DataTokenProvider            KeyProvider (custodial | passphrase)
                │
                ▼
        api.github.com (Contents API)  ◀─ holds only ciphertext envelopes
```

## Architecture (Path A — "token cached in the browser")

The backend (a free Cloudflare Worker — see [`../../../broker-cloudflare`](../../../broker-cloudflare))
is hit **only at login and token refresh**. Between refreshes the browser talks
to `api.github.com` directly with a short-lived data token. This is the design
the maintainer chose: *"the backend is never needed except when the cookie
expires."*

Each user stores their vault in **their own** GitHub repo (public + encrypted,
or private if they pay GitHub). The datastore only ever sees ciphertext.

## What deep research validated (with sources)

A Beacon-grade validation pass (2026-06-21) checked the design against primary
sources. Verdicts:

1. **Data token = GitHub App *user-to-server* token — ✅.** It is the only
   primitive that is both **least-privilege** and **expiring**: scope it to
   `Contents: write` (+ `Metadata`), pin it to the single vault repo via
   `repository_id`, opt **in** to token expiration (8h access / 6-month
   single-use refresh). Classic OAuth tokens are non-expiring and coarse
   (`repo` = all repos); fine-grained PATs cannot be minted programmatically.
   The user must **install the App** on their vault repo (a one-time click); a
   user-to-server token only has permissions *both* the user and the app hold.
   <https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/refreshing-user-access-tokens> ·
   <https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app>

2. **Refresh-token storage — ⚠️ use Cloudflare KV, not a cross-site cookie.**
   A Worker-domain (`*.workers.dev`) cookie is third-party to the Pages site
   (`*.github.io`); Safari ITP blocks third-party cookies outright and Chrome's
   status is "user choice" — unreliable either way
   (<https://webkit.org/blog/10218/full-third-party-cookie-blocking-and-more/>).
   So the long-lived refresh token lives **server-side in Workers KV**, keyed by
   an **opaque session handle** the browser holds; the browser never sees the
   refresh token. KV free tier (100k reads / 1k writes per day) covers a
   personal vault (<https://developers.cloudflare.com/kv/platform/limits/>).
   `dataToken.js` implements exactly this handle→refresh shape.

3. **Browser crypto — ✅ AES-GCM-256 via WebCrypto.** Authenticated encryption
   is mandatory (OWASP Cryptographic Storage Cheat Sheet); a **fresh random
   12-byte IV per message** (never reused under a key — NIST SP 800-38D §8.3),
   stored beside the ciphertext; the key imported **non-extractable**. The KDF
   **salt is persisted in cleartext** beside the vault (salt is not secret, but
   losing it makes the vault unrecoverable). Rotation = decrypt-all +
   re-encrypt-all under a new key with fresh IVs (envelope carries `v` for
   versioning). `crypto.js` does all of this.
   <https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html> ·
   <https://nvlpubs.nist.gov/nistpubs/legacy/sp/nistspecialpublication800-38d.pdf>

4. **1Password from the browser with no embedded secret — ❌ impossible.**
   Every 1Password programmatic path (Connect, Service Accounts, SDKs) needs a
   long-lived **server-side** credential; the service-account token *is* key
   material and must never reach browser JS
   (<https://developer.1password.com/docs/service-accounts/security/>). So
   **custodial key delivery must go through the Worker** (1Password token as a
   Worker secret; Worker fetches the team key and returns it to the
   authenticated browser). This expands the Worker's role beyond pure OAuth —
   **the one decision the human must make** (see below).

5. **GitHub as a datastore — ✅ for a low-write personal vault.** Limits: 5,000
   req/hr primary, **500 content-writes/hr** secondary (the real ceiling), 100 MB
   write cap, 1 MB fast-read threshold. A stale `sha` is **rejected** (optimistic
   concurrency, 409/422), so `put()` re-reads and retries. Named property:
   **git history is permanent** — encrypted content persists in history, so a key
   compromise exposes all past ciphertext (no forward secrecy).
   <https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api>

## The open decision (trust model — human's call)

Because of finding #4, the **custodial "for now"** path forces the Worker to
become a key-delivery mediator. Two coherent choices:

- **(A) Custodial via Worker.** 1Password Service-Account token is a Worker
  secret; the Worker delivers the team key to authenticated browsers. Simplest
  UX, recoverable vaults — but the Worker becomes security-critical key
  infrastructure and a Worker compromise leaks the team key.
- **(B) Zero-knowledge now.** Skip custody; derive the key in-browser from a
  user passphrase (Argon2id/PBKDF2). Worker stays OAuth-only; no third party
  ever holds the key — at the cost of passphrase UX and *unrecoverable vault on
  lost passphrase*.

`crypto.js` already ships **both** providers (`CustodialKeyProvider`,
`PassphraseKeyProvider`), so the code is ready for either; only the wiring +
broker role differ. This choice is deliberately left to the maintainer.

## Status

- ✅ `crypto.js`, `storage.js`, `dataToken.js` implemented; 15/15 offline tests
  pass (real WebCrypto, faked `fetch`).
- ⏳ Broker data endpoints (`/auth/{provider}/data/login`, `/data/callback`,
  `/auth/data/refresh` + KV) — pending the trust-model decision and a registered
  GitHub App.
- ⏳ Frontend wiring into `Genesis.jsx` (vault-backed rooms) — after the broker
  endpoints land.
