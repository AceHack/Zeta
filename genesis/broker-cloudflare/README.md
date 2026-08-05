# Genesis OAuth broker — Cloudflare Worker (free, zero-host)

A **free, zero-host** OAuth identity broker for Project Genesis, deployable to
your **own** Cloudflare account in a few minutes. It is a **drop-in replacement**
for the [`auth-backend/`](../_src/auth-backend) .NET broker — it implements the
**same HTTP contract**, so the Genesis frontend works unchanged: you only point
`auth-config.js` at this Worker's URL.

## Why this exists

A static GitHub Pages site **cannot** safely do the OAuth `code → token`
exchange, because that step needs the OAuth **client secret**, and anything
shipped to the browser is public. This Worker holds the secret (as a Cloudflare
**encrypted secret**, never in source), does the exchange server-to-server,
reads your **public** identity, mints a short-lived **HS256 identity JWT**, and
**discards the provider access token**. The provider token never reaches the
browser.

> **Identity only.** Like the .NET broker, this returns *who you are*, not a
> GitHub API token. Using GitHub as a **data store** ("GitHub-as-a-database")
> is a separate, deliberate extension — see **[Data token (next step)](#data-token--github-as-a-database-optional)**.

## What you need

- A free Cloudflare account (no credit card required for the Workers free tier).
- A **GitHub OAuth App** (yours). Optionally a GitLab OAuth App.

## Setup (≈5 minutes)

### 1. Register a GitHub OAuth App

GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**.

- **Homepage URL:** your Genesis site, e.g. `https://your-username.github.io/Zeta/genesis/`
- **Authorization callback URL:** *leave a placeholder for now*; you'll set it to
  `https://genesis-auth.<your-subdomain>.workers.dev/auth/github/callback` after step 3.

Copy the **Client ID** and generate a **Client secret**.

### 2. Install Wrangler & clone this folder

```bash
npm install -g wrangler   # or: npm i -D wrangler
cd genesis/broker-cloudflare
npm install
wrangler login
```

### 3. Edit `wrangler.toml`

Set `ALLOWED_FRONTEND_ORIGINS` to your Pages URL. **Recommended (tightest):**
use the full URL incl. path, e.g. `https://your-username.github.io/Zeta/genesis/`
— then only that exact origin+path can receive the identity token. (An origin-only
entry also works but allows any path on that origin.) Leave `SELF_BASE_URL` as a
placeholder for now.

### 4. Set secrets (encrypted; never in source)

```bash
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put JWT_SECRET          # 32+ random bytes; e.g. `openssl rand -base64 48`
# optional GitLab:
# wrangler secret put GITLAB_CLIENT_ID
# wrangler secret put GITLAB_CLIENT_SECRET
```

### 5. Deploy

```bash
wrangler deploy
```
Wrangler prints your Worker URL, e.g. `https://genesis-auth.<sub>.workers.dev`.

### 6. Close the loop

- Put that URL in `wrangler.toml` → `SELF_BASE_URL`, then `wrangler deploy` again
  (so `redirect_uri` matches exactly).
- In your **GitHub OAuth App**, set the **Authorization callback URL** to
  `https://genesis-auth.<sub>.workers.dev/auth/github/callback`.
- In the deployed site's `genesis/auth-config.js`, set
  `base: "https://genesis-auth.<sub>.workers.dev"`.

Done. The "Sign in with GitHub" button now works, hosted on **your** free Worker.

## Verify

```bash
curl https://genesis-auth.<sub>.workers.dev/healthz
# {"status":"ok","providers":["github"]}
```

## Security notes

- **Secrets** live only as Wrangler-encrypted secrets, never in `wrangler.toml`
  or git. `.dev.vars` (local only) is git-ignored.
- **CSRF:** the `state` value is stored in a first-party `HttpOnly; Secure;
  SameSite=Lax` cookie on the Worker's own host and compared in constant time.
- **Open-redirect / code-leak:** the post-login `redirect` is validated against
  `ALLOWED_FRONTEND_ORIGINS`, **sanitized to origin+path** (attacker-controlled
  query/fragment are dropped), and — when an allowlist entry includes a path —
  required to match that **exact origin+path**. Anything else is rejected.
- **No replay window:** the `state` cookies are cleared on **every** callback
  outcome (success or failure), not just success.
- **JWT alg pinned:** the identity-JWT verifier requires `alg: "HS256"` and
  rejects any other algorithm (no `none`/alg-confusion surface).
- **No token in the browser:** the provider access token is used to read public
  identity and then discarded; only a short-lived signed identity JWT is returned.
- Errors return generic messages; tokens/secrets are never logged or echoed.

## Data token — GitHub-as-a-database (optional)

The endpoints above are **identity-only**. To also let the browser read/write
the user's **own** vault repo (the "GitHub-as-a-database" feature), this Worker
implements a **data token** flow — **Path A**: a short-lived GitHub token is
cached in the browser and the Worker is hit only at authorization and ~8h
refresh. It is **opt-in**: leave the data secrets unset and only identity runs.

**How it stays safe:**

- The data token is a **GitHub App user-to-server token** — short-lived (~8h),
  least-privilege (`Contents: write` on the single vault repo), held **in memory
  only** in the browser (see [`../_src/src/vault/dataToken.js`](../_src/src/vault/dataToken.js)).
- The long-lived **refresh token never reaches the browser**: it lives in
  **Workers KV** (binding `SESSIONS`), keyed by an **opaque session handle** the
  browser holds. `/auth/data/refresh` mints a fresh access token and **rotates**
  the (single-use) refresh token in KV.

**Extra endpoints:** `GET /auth/github/data/login`, `GET /auth/github/data/callback`,
`POST /auth/data/refresh`.

**Setup (in addition to the identity steps):**

1. Register a **GitHub App** (not an OAuth App): repository permission
   **Contents: Read and write** (+ Metadata), **user-to-server token expiration
   ON**, callback URL `https://genesis-auth.<sub>.workers.dev/auth/github/data/callback`.
   Copy its **Client ID** + generate a **Client secret**. Each user **installs**
   the App on their vault repo (a one-time click).
2. Create the KV namespace and paste its id into `wrangler.toml`:
   ```bash
   wrangler kv namespace create SESSIONS
   ```
   Then uncomment the `[[kv_namespaces]]` block.
3. Set the data secrets:
   ```bash
   wrangler secret put GITHUB_DATA_CLIENT_ID
   wrangler secret put GITHUB_DATA_CLIENT_SECRET
   ```
4. `wrangler deploy`. Verify: `curl .../healthz` reports `"data":true`.

Offline-tested (`node test/data-flow.test.mjs`): login redirect + state cookie,
callback stores refresh in KV (never in the redirect) + hands back an opaque
handle, refresh reuse / rotation / 401 / 400, CSRF bad-state, CORS preflight,
and 404-when-unconfigured — **19/19**.

> **Encryption key custody is a separate decision** (custodial-via-Worker vs
> zero-knowledge passphrase) — see [`../_src/src/vault/README.md`](../_src/src/vault/README.md).
> The data token controls repo *write access*; the vault's *encryption* is
> orthogonal and the frontend ships both key providers.
