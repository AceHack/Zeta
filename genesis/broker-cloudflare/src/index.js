/**
 * Project Genesis — OAuth identity broker as a Cloudflare Worker.
 *
 * A FREE, ZERO-HOST, drop-in replacement for the .NET `auth-backend/` broker.
 * It implements the SAME HTTP contract, so the frontend (`src/auth.js` +
 * `public/auth-config.js`) works UNCHANGED — a fork-owner only points
 * `window.__GENESIS_AUTH__.base` at this Worker's URL.
 *
 * Why a broker exists at all: a static GitHub Pages site cannot perform the
 * OAuth code->token exchange, because that step needs the client SECRET and
 * anything shipped to the browser is public. This Worker holds the secrets
 * (Cloudflare encrypted secrets — never in source), performs the exchange
 * server-to-server, reads the user's PUBLIC identity, mints a short-lived
 * HS256 identity JWT, and DISCARDS the provider access token. The provider
 * token never reaches the browser. (Identity-only — same security stance as
 * the .NET broker. The "GitHub-as-a-database" data token is a separate,
 * deliberate extension; see broker-cloudflare/README.md.)
 *
 * Contract (top-level redirects + URL fragment; no CORS / no 3rd-party cookies):
 *   GET /healthz
 *   GET /auth/{provider}/login?redirect=<frontend-url>
 *   GET /auth/{provider}/callback?code=...&state=...
 *   GET /auth/me            (CORS; verifies an identity JWT via Authorization: Bearer)
 *
 * Required secrets  (set with `wrangler secret put <NAME>`):
 *   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET
 *   GITLAB_CLIENT_ID, GITLAB_CLIENT_SECRET     (optional; omit to disable gitlab)
 *   JWT_SECRET                                  (32+ random bytes; signs identity JWTs)
 * Required vars  (wrangler.toml [vars], or secrets):
 *   SELF_BASE_URL              this Worker's public URL, no trailing slash
 *   ALLOWED_FRONTEND_ORIGINS   comma-separated allowlist of frontend origins
 * Optional vars:
 *   JWT_ISSUER (default "genesis-auth"), JWT_TTL_MINUTES (default "30"),
 *   GITLAB_BASE_URL (default "https://gitlab.com")
 */

const STATE_COOKIE_MAX_AGE = 600; // 10 minutes for the login round-trip

export default {
  /**
   * @param {Request} request
   * @param {Record<string, string>} env
   */
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    try {
      if (pathname === "/healthz") {
        return json({ status: "ok", providers: enabledProviders(env) });
      }

      // GET /auth/me — verify an identity JWT (CORS-enabled).
      if (pathname === "/auth/me") {
        if (request.method === "OPTIONS") {
          return new Response(null, { status: 204, headers: corsHeaders() });
        }
        const auth = request.headers.get("Authorization") || "";
        const token = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length) : null;
        const claims = token ? await verifyHs256(token, env.JWT_SECRET) : null;
        if (!claims) return new Response("Unauthorized", { status: 401, headers: corsHeaders() });
        return new Response(JSON.stringify(claims), {
          status: 200,
          headers: { "content-type": "application/json", ...corsHeaders() },
        });
      }

      const login = pathname.match(/^\/auth\/([^/]+)\/login$/);
      if (login) return handleLogin(decodeURIComponent(login[1]), url, env);

      const callback = pathname.match(/^\/auth\/([^/]+)\/callback$/);
      if (callback) return handleCallback(decodeURIComponent(callback[1]), request, url, env);

      return json({ error: "not found" }, 404);
    } catch (err) {
      // Never leak secrets/tokens in errors. Generic message only.
      return json({ error: "internal error" }, 500);
    }
  },
};

// ---------------------------------------------------------------------------
// Step 1+2: kick off the OAuth dance.
// ---------------------------------------------------------------------------
function handleLogin(provider, url, env) {
  const p = providerConfig(provider, env);
  if (!p) return json({ error: `unknown provider '${provider}'` }, 404);

  const allowed = allowedOrigins(env);
  const finalRedirect = resolveRedirect(url.searchParams.get("redirect"), allowed);
  if (!finalRedirect) return json({ error: "redirect not in ALLOWED_FRONTEND_ORIGINS" }, 400);

  const state = b64url(crypto.getRandomValues(new Uint8Array(32)));
  const selfBase = requireVar(env, "SELF_BASE_URL").replace(/\/+$/, "");

  const authorize = appendQuery(p.authorizeUrl, {
    client_id: p.clientId,
    redirect_uri: `${selfBase}/auth/${encodeURIComponent(provider)}/callback`,
    scope: p.scope,
    state,
    response_type: "code",
    allow_signup: "true",
  });

  const cookieOpts = `Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${STATE_COOKIE_MAX_AGE}`;
  const headers = new Headers({ Location: authorize });
  // First-party cookies on THIS Worker's host; survive the top-level provider round-trip.
  headers.append("Set-Cookie", `gx_state_${provider}=${state}; ${cookieOpts}`);
  headers.append("Set-Cookie", `gx_redir_${provider}=${encodeURIComponent(finalRedirect)}; ${cookieOpts}`);
  return new Response(null, { status: 302, headers });
}

// ---------------------------------------------------------------------------
// Step 3+4+5: handle the provider callback.
// ---------------------------------------------------------------------------
async function handleCallback(provider, request, url, env) {
  const p = providerConfig(provider, env);
  if (!p) return json({ error: `unknown provider '${provider}'` }, 404);

  // Always clear the state cookies on ANY callback outcome (no replay window).
  const clearHeaders = () => {
    const h = new Headers({ "content-type": "application/json" });
    h.append("Set-Cookie", `gx_state_${provider}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
    h.append("Set-Cookie", `gx_redir_${provider}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
    return h;
  };
  const fail = (obj, status) => new Response(JSON.stringify(obj), { status, headers: clearHeaders() });

  const error = url.searchParams.get("error");
  if (error) return fail({ error: `provider returned: ${error}` }, 400);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return fail({ error: "missing code/state" }, 400);

  const cookies = parseCookies(request.headers.get("Cookie") || "");
  const expectedState = cookies[`gx_state_${provider}`];
  const finalRedirectRaw = cookies[`gx_redir_${provider}`];
  const finalRedirect = finalRedirectRaw ? decodeURIComponent(finalRedirectRaw) : null;

  // CSRF: state from the provider must match our first-party cookie (constant-time).
  if (!expectedState || !timingSafeEqual(expectedState, state)) {
    return fail({ error: "invalid state" }, 400);
  }
  const safeRedirect = finalRedirect ? resolveRedirect(finalRedirect, allowedOrigins(env)) : null;
  if (!safeRedirect) {
    return fail({ error: "invalid redirect" }, 400);
  }

  const selfBase = requireVar(env, "SELF_BASE_URL").replace(/\/+$/, "");

  // Exchange the authorization code for an access token (server-to-server).
  const tokenResp = await fetch(p.tokenUrl, {
    method: "POST",
    headers: { Accept: "application/json", "content-type": "application/x-www-form-urlencoded", "User-Agent": "genesis-broker/1.0" },
    body: new URLSearchParams({
      client_id: p.clientId,
      client_secret: p.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: `${selfBase}/auth/${encodeURIComponent(provider)}/callback`,
    }),
  });
  if (!tokenResp.ok) return fail({ error: "token exchange failed" }, 400);
  const tokenBody = await tokenResp.json().catch(() => null);
  const accessToken = tokenBody && tokenBody.access_token;
  if (!accessToken) return fail({ error: "no access_token in response" }, 400);

  // Fetch the user's PUBLIC identity. (The access token is used here and then discarded.)
  const userResp = await fetch(p.userInfoUrl, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json", "User-Agent": "genesis-broker/1.0" },
  });
  if (!userResp.ok) return fail({ error: "userinfo failed" }, 400);
  const user = await userResp.json().catch(() => ({}));

  const id = user.id != null ? String(user.id) : "";
  const userlogin = user.login || user.username || "";
  const name = user.name || userlogin;
  const avatar = user.avatar_url || "";

  // Mint our own short-lived identity token. The provider token is discarded here.
  const ttl = parseInt(optVar(env, "JWT_TTL_MINUTES", "30"), 10) || 30;
  const nowSec = Math.floor(Date.now() / 1000);
  const claims = {
    iss: optVar(env, "JWT_ISSUER", "genesis-auth"),
    sub: `${provider}:${id}`,
    provider,
    login: userlogin,
    name,
    picture: avatar,
    iat: nowSec,
    exp: nowSec + ttl * 60,
  };
  const jwt = await mintHs256(claims, env.JWT_SECRET);

  // Hand the JWT back via the URL fragment (state cookies cleared below).
  const sep = safeRedirect.includes("#") ? "&" : "#";
  const headers = new Headers({ Location: `${safeRedirect}${sep}token=${encodeURIComponent(jwt)}` });
  headers.append("Set-Cookie", `gx_state_${provider}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  headers.append("Set-Cookie", `gx_redir_${provider}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
  return new Response(null, { status: 302, headers });
}

// ---------------------------------------------------------------------------
// Providers / config
// ---------------------------------------------------------------------------
function providerConfig(provider, env) {
  if (provider === "github") {
    if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET) return null;
    return {
      clientId: env.GITHUB_CLIENT_ID,
      clientSecret: env.GITHUB_CLIENT_SECRET,
      authorizeUrl: "https://github.com/login/oauth/authorize",
      tokenUrl: "https://github.com/login/oauth/access_token",
      userInfoUrl: "https://api.github.com/user",
      scope: "read:user",
    };
  }
  if (provider === "gitlab") {
    if (!env.GITLAB_CLIENT_ID || !env.GITLAB_CLIENT_SECRET) return null;
    const base = optVar(env, "GITLAB_BASE_URL", "https://gitlab.com").replace(/\/+$/, "");
    return {
      clientId: env.GITLAB_CLIENT_ID,
      clientSecret: env.GITLAB_CLIENT_SECRET,
      authorizeUrl: `${base}/oauth/authorize`,
      tokenUrl: `${base}/oauth/token`,
      userInfoUrl: `${base}/api/v4/user`,
      scope: "read_user",
    };
  }
  return null;
}

function enabledProviders(env) {
  const out = [];
  if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) out.push("github");
  if (env.GITLAB_CLIENT_ID && env.GITLAB_CLIENT_SECRET) out.push("gitlab");
  return out;
}

function allowedOrigins(env) {
  return requireVar(env, "ALLOWED_FRONTEND_ORIGINS")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function requireVar(env, key) {
  const v = env[key];
  if (!v || !String(v).length) throw new Error(`missing config ${key}`);
  return String(v);
}
function optVar(env, key, fallback) {
  const v = env[key];
  return v && String(v).length ? String(v) : fallback;
}

/**
 * Validate a post-login redirect and return a SANITIZED URL (origin + path only;
 * attacker-controlled query/fragment are dropped — we append our own #token).
 * Allowlist entries may be an exact ORIGIN (any path on it allowed) OR a full
 * URL including a path (then origin+path must match EXACTLY — tightest; use this).
 */
function resolveRedirect(requested, allowed) {
  if (!requested || !requested.trim()) {
    return allowed.length ? sanitizeAllowEntry(allowed[0]) : null;
  }
  let uri;
  try {
    uri = new URL(requested);
  } catch {
    return null;
  }
  if (uri.protocol !== "https:" && uri.protocol !== "http:") return null;
  const origin = `${uri.protocol}//${uri.host}`.toLowerCase();
  const reqPath = uri.pathname || "/"; // no query, no fragment, no userinfo
  for (const entry of allowed) {
    let a;
    try {
      a = new URL(entry);
    } catch {
      continue;
    }
    if (`${a.protocol}//${a.host}`.toLowerCase() !== origin) continue;
    if (a.pathname && a.pathname !== "/") {
      // Entry has a path => require exact origin+path match.
      if (a.pathname.replace(/\/+$/, "") === reqPath.replace(/\/+$/, "")) return `${origin}${reqPath}`;
      continue;
    }
    // Entry is origin-only => allow any path on that origin (less strict).
    return `${origin}${reqPath}`;
  }
  return null;
}

function sanitizeAllowEntry(entry) {
  try {
    const a = new URL(entry);
    return `${a.protocol}//${a.host}`.toLowerCase() + (a.pathname || "/");
  } catch {
    return null;
  }
}

function appendQuery(urlStr, params) {
  const u = new URL(urlStr);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  return u.toString();
}

function parseCookies(header) {
  const out = {};
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k) out[k] = v;
  }
  return out;
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Authorization",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });
}

// ---- base64url ----
function b64url(bytes) {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function b64urlStr(str) {
  return b64url(new TextEncoder().encode(str));
}
function b64urlDecodeToString(s) {
  s = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = (4 - (s.length % 4)) % 4;
  const bin = atob(s + "=".repeat(pad));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// ---- HS256 JWT ----
async function hmacKey(secret) {
  if (!secret || !String(secret).length) throw new Error("missing JWT_SECRET");
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}
async function hmacSignB64url(input, secret) {
  const key = await hmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input));
  return b64url(new Uint8Array(sig));
}
async function mintHs256(claims, secret) {
  const header = b64urlStr(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = b64urlStr(JSON.stringify(claims));
  const signingInput = `${header}.${payload}`;
  const sig = await hmacSignB64url(signingInput, secret);
  return `${signingInput}.${sig}`;
}
async function verifyHs256(token, secret) {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  let header;
  try {
    header = JSON.parse(b64urlDecodeToString(parts[0]));
  } catch {
    return null;
  }
  if (!header || header.alg !== "HS256") return null; // pin alg; reject none/RS256/etc
  const expected = await hmacSignB64url(`${parts[0]}.${parts[1]}`, secret);
  if (!timingSafeEqual(expected, parts[2])) return null;
  let claims;
  try {
    claims = JSON.parse(b64urlDecodeToString(parts[1]));
  } catch {
    return null;
  }
  const exp = Number(claims.exp) || 0;
  if (Math.floor(Date.now() / 1000) >= exp) return null;
  return claims;
}

/** Constant-time string comparison (avoids leaking match length via timing). */
function timingSafeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
