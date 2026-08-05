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
> is a separate, deliberate extension — see **[Data token (next step)](#data-token-next-step)**.

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

## Data token (next step)

This broker is **identity-only**. To let the browser read/write the user's own
GitHub repo (the "GitHub-as-a-database" feature), one of two extensions is
needed — a **deliberate** security decision, because it changes where the GitHub
token lives:

1. **Token-to-browser** (sparing backend use): the broker requests repo scope
   and returns a **short-lived GitHub token** to the browser, which calls
   `api.github.com` directly. Backend hit only at login + refresh. The token is
   in the browser (XSS-exposed, bounded by least-privilege scope + short expiry).
2. **Broker-proxied data** (most secure): the token **never** leaves the Worker;
   the browser asks the Worker, which performs the GitHub read/write. No token in
   the browser, but the Worker is invoked on every data operation.

This folder ships path **(0): identity only**. The data extension lands behind
the frontend `VaultStorage` interface once the path above is chosen — see
[`../_src/src/vault/README.md`](../_src/src/vault/README.md).
