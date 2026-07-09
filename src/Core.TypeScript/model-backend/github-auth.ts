// github-auth.ts — the GitHub AuthProvider: device-code flow (+ honest browser-flow stance) (shadow*).
//
// Second implementation of the hexagonal `AuthProvider` port (auth-provider.ts), after
// openai-auth.ts. Aaron 2026-07-08: "we have openai token wired into our agent harness — we should
// wire in github credentials too." Same port, same runner (login-runner.ts), same store
// (token-store.ts, one file per provider under ~/.config/zeta/auth) — GitHub is just one more
// provider behind THE interface.
//
// Endpoints (RFC 8628 device flow — CONFIRMED LIVE 2026-07-08, Otto cowork cell, pushed
// PRs #9549–#9551 with a token minted through exactly this flow):
//   device start : POST https://github.com/login/device/code          (form) client_id, scope
//   device poll  : POST https://github.com/login/oauth/access_token   (form) client_id, device_code,
//                  grant_type=urn:ietf:params:oauth:grant-type:device_code
//   pending      : 200 with { error: "authorization_pending" } (NOT an http error — GitHub answers
//                  200 for both pending and success; `slow_down` also = keep polling)
//   client_id    : Iv1-shaped GitHub App ids AND classic OAuth app ids both work; default below is
//                  the public gh-CLI client id (178c6fc778ccc68e1d6a) every harness reuses.
//
// HONEST SCOPE / provider asymmetries vs OpenAI:
//   - Classic OAuth-app device tokens (gh client id) DO NOT expire and GitHub returns NO
//     refresh_token → we store refreshToken:"" and `refresh` reports re-login (a revoked token
//     cannot be refreshed, only re-approved). GitHub-App client ids with token expiration DO
//     return refresh_token + the standard refresh grant — the parser keeps it when present, and
//     `refresh` works for those.
//   - PKCE BROWSER flow: GitHub's authorize endpoint accepts the PKCE params, but the token
//     exchange for OAuth apps requires the client_secret (GitHub does not do secretless PKCE
//     exchange for OAuth apps). authorizeUrl builds the URL; exchangeCode degrades cleanly with
//     the reason + points at the device flow. Noninterference §13: transport injected, no secret.

import type { HttpTransport } from "./backend.ts";
import type { AuthProvider, AuthResult, DeviceFlowStart, OAuthTokens, PkceChallenge, PollResult } from "./auth-provider.ts";

const GH_BASE = "https://github.com";
/// The public gh-CLI client id (same reuse pattern as the Codex client id in openai-auth.ts).
export const GH_CLI_CLIENT_ID = "178c6fc778ccc68e1d6a";
/// Default scope: repo (contents + PRs). Override via makeGithubProvider for least-privilege ids.
export const DEFAULT_SCOPE = "repo";
const DEVICE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";

const formHeaders = { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json", "User-Agent": "zeta-auth/1.0" };

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function coerceInterval(raw: unknown): number {
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") return Number(raw) || 5;
  return 5;
}

/// Pull tokens out of a GitHub access_token response. refresh_token only exists for GitHub-App
/// client ids with expiration enabled; classic OAuth-app tokens don't rotate → empty string.
function tokensOf(parsed: unknown): OAuthTokens | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const p = parsed as { access_token?: unknown; refresh_token?: unknown };
  if (typeof p.access_token !== "string") return null;
  return { accessToken: p.access_token, refreshToken: typeof p.refresh_token === "string" ? p.refresh_token : "" };
}

/// Build a GitHub provider for a given client id + scope (defaults: the gh-CLI public id, repo scope).
export function makeGithubProvider(clientId: string = GH_CLI_CLIENT_ID, scope: string = DEFAULT_SCOPE): AuthProvider {
  return {
    name: "github",

    async startDeviceFlow(transport: HttpTransport): Promise<AuthResult<DeviceFlowStart>> {
      let res: { status: number; body: string };
      try {
        res = await transport.post(`${GH_BASE}/login/device/code`, formHeaders, new URLSearchParams({ client_id: clientId, scope }).toString());
      } catch (e) {
        return { ok: false, error: `transport error: ${e instanceof Error ? e.message : String(e)}` };
      }
      if (res.status < 200 || res.status >= 300) return { ok: false, error: `http ${String(res.status)}: ${res.body.slice(0, 300)}` };
      const p = parseJson(res.body) as { device_code?: unknown; user_code?: unknown; verification_uri?: unknown; interval?: unknown } | null;
      if (!p || typeof p.device_code !== "string" || typeof p.user_code !== "string") return { ok: false, error: "malformed device/code response" };
      return {
        ok: true,
        value: {
          deviceAuthId: p.device_code,
          userCode: p.user_code,
          verificationUri: typeof p.verification_uri === "string" ? p.verification_uri : `${GH_BASE}/login/device`,
          intervalSec: coerceInterval(p.interval),
        },
      };
    },

    async pollDevice(transport: HttpTransport, start: DeviceFlowStart): Promise<PollResult> {
      let res: { status: number; body: string };
      try {
        res = await transport.post(
          `${GH_BASE}/login/oauth/access_token`,
          formHeaders,
          new URLSearchParams({ client_id: clientId, device_code: start.deviceAuthId, grant_type: DEVICE_GRANT }).toString(),
        );
      } catch (e) {
        return { ok: false, error: `transport error: ${e instanceof Error ? e.message : String(e)}` };
      }
      if (res.status < 200 || res.status >= 300) return { ok: false, error: `http ${String(res.status)}: ${res.body.slice(0, 300)}` };
      // GitHub answers 200 for pending AND success — the discriminator is the body (confirmed live).
      const p = parseJson(res.body) as { error?: unknown; access_token?: unknown } | null;
      if (!p) return { ok: false, error: "malformed access_token response (not JSON)" };
      if (p.error === "authorization_pending" || p.error === "slow_down") return { ok: true, pending: true };
      if (typeof p.error === "string") return { ok: false, error: `github: ${p.error}` }; // expired_token / access_denied / …
      const tokens = tokensOf(p);
      if (!tokens) return { ok: false, error: "malformed access_token response (no access_token)" };
      return { ok: true, tokens };
    },

    authorizeUrl(pkce: PkceChallenge, redirectUri: string, state: string): string {
      const q = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        scope,
        state,
        response_type: "code",
        code_challenge: pkce.challenge,
        code_challenge_method: pkce.method,
      });
      return `${GH_BASE}/login/oauth/authorize?${q.toString()}`;
    },

    async exchangeCode(_transport: HttpTransport, _code: string, _verifier: string, _redirectUri: string): Promise<AuthResult<OAuthTokens>> {
      // Honest stance: GitHub's token exchange for OAuth apps requires the client_secret — there is
      // no secretless PKCE exchange (unlike OpenAI). Keeping secrets out of the harness is the
      // point of the port, so the browser flow is intentionally unimplemented; the device flow
      // covers every cell (headless included) without a secret.
      return { ok: false, error: "github browser flow needs a client_secret (no secretless PKCE exchange) — use the device flow" };
    },

    async refresh(transport: HttpTransport, refreshToken: string): Promise<AuthResult<OAuthTokens>> {
      if (refreshToken === "") {
        // Classic OAuth-app device tokens don't rotate: nothing to refresh. A 401 at the edge means
        // the token was revoked/expired by policy — the fix is a fresh deviceLogin approval.
        return { ok: false, error: "github classic OAuth tokens do not refresh — re-run device login" };
      }
      let res: { status: number; body: string };
      try {
        res = await transport.post(
          `${GH_BASE}/login/oauth/access_token`,
          formHeaders,
          new URLSearchParams({ client_id: clientId, refresh_token: refreshToken, grant_type: "refresh_token" }).toString(),
        );
      } catch (e) {
        return { ok: false, error: `transport error: ${e instanceof Error ? e.message : String(e)}` };
      }
      if (res.status < 200 || res.status >= 300) return { ok: false, error: `http ${String(res.status)}: ${res.body.slice(0, 300)}` };
      const p = parseJson(res.body) as { error?: unknown } | null;
      if (p && typeof p.error === "string") return { ok: false, error: `github: ${p.error}` };
      const tokens = tokensOf(p);
      if (!tokens) return { ok: false, error: "malformed refresh response (no access_token)" };
      return { ok: true, value: tokens };
    },
  };
}

/// The default GitHub provider (gh-CLI public client id, repo scope) — mirror of openAiCodexProvider.
export const githubDeviceProvider: AuthProvider = makeGithubProvider();
