# Project Genesis — OAuth identity broker (.NET)

A tiny self-hosted ASP.NET Core service that lets the static Genesis site
(`https://lucent-financial-group.github.io/Zeta/genesis/`) offer **Sign in with
GitHub** and **Sign in with GitLab** — *identity only*.

It exists because a static site can't safely do OAuth: the code→token exchange
needs a **client secret**, which must never ship in the browser bundle. This
service holds the secrets, does the exchange server-to-server, reads the user's
public identity, and hands the frontend a short-lived signed token. **The
provider access token never leaves this service.**

## Flow (no CORS / no third-party cookies)

```
browser → GET  /auth/{provider}/login?redirect=<frontend-url>
        ← 302  to provider (sets first-party SameSite=Lax state cookie)
provider→ GET  /auth/{provider}/callback?code=…&state=…
        ← 302  to <frontend-url>#token=<identity-jwt>
browser → frontend decodes the JWT for display
```

Providers: `github`, `gitlab` (gitlab.com or self-managed via `GitLab:BaseUrl`).

## 1. Register the OAuth apps

**GitHub** — Settings → Developer settings → *OAuth Apps* → New OAuth App
(https://github.com/settings/developers). For an org app use the org's settings.

- Homepage URL: `https://lucent-financial-group.github.io/Zeta/genesis/`
- **Authorization callback URL:** `https://YOUR-BACKEND/auth/github/callback`
- Copy the **Client ID** and generate a **Client secret**.

**GitLab** — User Settings → *Applications* (https://gitlab.com/-/profile/applications),
or a Group/Instance application.

- **Redirect URI:** `https://YOUR-BACKEND/auth/gitlab/callback`
- Scopes: **`read_user`** only. Confidential: **Yes** (we use the secret).
- Copy the **Application ID** (client id) and **Secret**.

`YOUR-BACKEND` is this service's public HTTPS URL (it must be reachable by the
browser and match `SelfBaseUrl` below).

## 2. Configure (environment variables)

All config maps to env vars by replacing `:` with `__`. Never commit real secrets.

| Variable | Example | Notes |
|---|---|---|
| `SelfBaseUrl` | `https://genesis-auth.example.com` | Public URL of THIS service, no trailing slash. |
| `AllowedFrontendOrigins` | `https://lucent-financial-group.github.io` | Comma-separated allowlist for the post-login redirect. |
| `Jwt__Secret` | (32+ random bytes) | HS256 signing key. Generate: `openssl rand -base64 48`. |
| `Jwt__TtlMinutes` | `30` | Identity-token lifetime. |
| `GitHub__ClientId` / `GitHub__ClientSecret` | … | From step 1. |
| `GitLab__ClientId` / `GitLab__ClientSecret` | … | From step 1. |
| `GitLab__BaseUrl` | `https://gitlab.com` | Override for self-managed GitLab. |

## 3. Run

```bash
# Local
dotnet run

# Container
docker build -t genesis-auth .
docker run -p 8080:8080 \
  -e SelfBaseUrl=https://genesis-auth.example.com \
  -e AllowedFrontendOrigins=https://lucent-financial-group.github.io \
  -e Jwt__Secret="$(openssl rand -base64 48)" \
  -e GitHub__ClientId=… -e GitHub__ClientSecret=… \
  -e GitLab__ClientId=… -e GitLab__ClientSecret=… \
  genesis-auth
```

Health check: `GET /healthz` → `{"status":"ok","providers":["github","gitlab"]}`.

## 4. Point the frontend at it

Edit the deployed `genesis/auth-config.js` (no rebuild needed) and set:

```js
window.__GENESIS_AUTH__ = { base: "https://genesis-auth.example.com", providers: ["github","gitlab"] };
```

That's it — the sign-in widget goes live.

## Notes / scope

- **Identity only.** Scopes requested: `read:user` (GitHub), `read_user` (GitLab).
  No repo access. To extend later, widen the scope and add endpoints; the
  provider token would then need secure server-side storage.
- The frontend only **decodes** the identity token for display. For any real
  authorization decision, verify it server-side via `GET /auth/me`
  (`Authorization: Bearer <token>`), which checks the HS256 signature + expiry.
- CSRF is handled with a first-party, short-lived `SameSite=Lax` state cookie on
  the backend domain (set and read on the same domain, so it survives the
  provider round-trip without third-party-cookie issues).
- This project is intentionally **not** part of `Zeta.sln` and is **not** built
  by Zeta CI. It carries its own empty `Directory.Build.props` so it doesn't
  inherit the monorepo's strict analyzer profile. Build/deploy it independently.
