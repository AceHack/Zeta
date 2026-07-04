// openai-auth.ts — the OpenAI/ChatGPT AuthProvider: device-code + PKCE browser flows (shadow*).
//
// The first implementation of the hexagonal `AuthProvider` port (auth-provider.ts). Aaron 2026-07-03:
// own our login end-to-end instead of depending on Codex's ~/.codex/auth.json session (which just
// died — token + refresh both invalidated after an enhanced-security upgrade). This does what the
// harnesses do — the SAME OAuth flows, reusing the public Codex client_id — but as OUR provider.
//
// Endpoints (confirmed from openai/codex device_code_auth.rs + the opencode plugins):
//   device usercode : POST https://auth.openai.com/deviceauth/usercode   { client_id }
//   device poll     : POST https://auth.openai.com/deviceauth/token      { device_auth_id, user_code }
//   authorize (PKCE): GET  https://auth.openai.com/oauth/authorize?response_type=code&client_id&…
//   token exchange  : POST https://auth.openai.com/oauth/token           (form) grant_type=authorization_code
//   refresh         : POST https://auth.openai.com/oauth/token           (form) grant_type=refresh_token
//   client_id       : app_EMoamEEZ73f0CkXaXp7hrann   (the public Codex client id every harness reuses)
//
// HONEST SCOPE: the HTTP shapes are built + fake-tested to the documented forms. The exact
// deviceauth/usercode + deviceauth/token RESPONSE fields (verification URL, the pending-vs-done signal)
// need a live confirm (Aaron approves a real login) — same discipline as the Manus/Codex probes; the
// parsers extract the known fields and degrade cleanly. Noninterference §13: transport injected.

import type { HttpTransport } from "./backend.ts";
import type { AuthProvider, AuthResult, DeviceFlowStart, OAuthTokens, PkceChallenge, PollResult } from "./auth-provider.ts";

const AUTH_BASE = "https://auth.openai.com";
// the deviceauth endpoints live under /api/accounts (confirmed live — a 405 HTML page at the bare
// /deviceauth path revealed the real host is API_BASE = AUTH_BASE + /api/accounts).
const API_BASE = `${AUTH_BASE}/api/accounts`;
const CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann";
// where the user enters the device code (auth.openai.com/codex/device), NOT the settings page.
const DEFAULT_VERIFICATION_URI = "https://auth.openai.com/codex/device";
// the redirect_uri the device-flow code was minted against (must match on exchange).
const DEVICE_REDIRECT_URI = "https://auth.openai.com/deviceauth/callback";

const jsonHeaders = { "Content-Type": "application/json", "User-Agent": "zeta-auth/1.0" };
const formHeaders = { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "zeta-auth/1.0" };

/// Coerce a poll interval (number or numeric string) to seconds; default 5.
function coerceInterval(raw: unknown): number {
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") return Number(raw) || 5;
  return 5;
}

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

/// The chatgpt account id lives in the id_token JWT under the `https://api.openai.com/auth` claim
/// (`chatgpt_account_id`). Decode the middle segment; return undefined if anything is off (never throws).
function accountIdFromIdToken(idToken: unknown): string | undefined {
  if (typeof idToken !== "string") return undefined;
  const seg = idToken.split(".")[1];
  if (!seg) return undefined;
  try {
    const claims = JSON.parse(Buffer.from(seg, "base64").toString("utf8")) as Record<string, unknown>;
    const auth = claims["https://api.openai.com/auth"] as { chatgpt_account_id?: unknown } | undefined;
    return typeof auth?.chatgpt_account_id === "string" ? auth.chatgpt_account_id : undefined;
  } catch {
    return undefined;
  }
}

/// Pull { access_token, refresh_token, account_id } out of an OAuth token response. `account_id` comes
/// from the top-level field if present, else the id_token JWT claim (CONFIRMED LIVE: it's in id_token).
function tokensOf(parsed: unknown): OAuthTokens | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const p = parsed as { access_token?: unknown; refresh_token?: unknown; account_id?: unknown; id_token?: unknown };
  if (typeof p.access_token !== "string" || typeof p.refresh_token !== "string") return null;
  const accountId = typeof p.account_id === "string" ? p.account_id : accountIdFromIdToken(p.id_token);
  return { accessToken: p.access_token, refreshToken: p.refresh_token, accountId };
}

export const openAiCodexProvider: AuthProvider = {
  name: "openai",

  async startDeviceFlow(transport: HttpTransport): Promise<AuthResult<DeviceFlowStart>> {
    let res: { status: number; body: string };
    try {
      res = await transport.post(`${API_BASE}/deviceauth/usercode`, jsonHeaders, JSON.stringify({ client_id: CLIENT_ID }));
    } catch (e) {
      return { ok: false, error: `transport error: ${e instanceof Error ? e.message : String(e)}` };
    }
    if (res.status < 200 || res.status >= 300) return { ok: false, error: `http ${String(res.status)}: ${res.body.slice(0, 300)}` };
    const p = parseJson(res.body) as { device_auth_id?: unknown; user_code?: unknown; interval?: unknown; verification_uri?: unknown } | null;
    if (!p || typeof p.device_auth_id !== "string" || typeof p.user_code !== "string") return { ok: false, error: "malformed usercode response (confirm live shape)" };
    const intervalSec = coerceInterval(p.interval);
    return {
      ok: true,
      value: {
        deviceAuthId: p.device_auth_id,
        userCode: p.user_code,
        verificationUri: typeof p.verification_uri === "string" ? p.verification_uri : DEFAULT_VERIFICATION_URI,
        intervalSec,
      },
    };
  },

  async pollDevice(transport: HttpTransport, start: DeviceFlowStart): Promise<PollResult> {
    let res: { status: number; body: string };
    try {
      res = await transport.post(`${API_BASE}/deviceauth/token`, jsonHeaders, JSON.stringify({ device_auth_id: start.deviceAuthId, user_code: start.userCode }));
    } catch (e) {
      return { ok: false, error: `transport error: ${e instanceof Error ? e.message : String(e)}` };
    }
    // 403 / 404 = not authorized yet (keep polling) — the pending signal.
    if (res.status === 403 || res.status === 404) return { ok: true, pending: true };
    if (res.status < 200 || res.status >= 300) return { ok: false, error: `http ${String(res.status)}: ${res.body.slice(0, 300)}` };
    // CONFIRMED LIVE: a 200 is NOT tokens — it's { status:"success", authorization_code, code_verifier }
    // (the device flow's PKCE is server-generated). Exchange the code for tokens (grant_type=authorization_code).
    const p = parseJson(res.body) as { status?: unknown; authorization_code?: unknown; code_verifier?: unknown } | null;
    if (!p) return { ok: false, error: "malformed device token response (not JSON)" };
    if (p.status !== "success" || typeof p.authorization_code !== "string" || typeof p.code_verifier !== "string") {
      return { ok: false, error: "malformed device token response (expected status/authorization_code/code_verifier)" };
    }
    const exchanged = await this.exchangeCode(transport, p.authorization_code, p.code_verifier, DEVICE_REDIRECT_URI);
    if (!exchanged.ok) return { ok: false, error: `code exchange: ${exchanged.error}` };
    return { ok: true, tokens: exchanged.value };
  },

  authorizeUrl(pkce: PkceChallenge, redirectUri: string, state: string): string {
    const q = new URLSearchParams({
      response_type: "code",
      client_id: CLIENT_ID,
      redirect_uri: redirectUri,
      code_challenge: pkce.challenge,
      code_challenge_method: pkce.method,
      state,
    });
    return `${AUTH_BASE}/oauth/authorize?${q.toString()}`;
  },

  async exchangeCode(transport: HttpTransport, code: string, verifier: string, redirectUri: string): Promise<AuthResult<OAuthTokens>> {
    const body = new URLSearchParams({ grant_type: "authorization_code", code, client_id: CLIENT_ID, code_verifier: verifier, redirect_uri: redirectUri }).toString();
    return tokenPost(transport, body);
  },

  async refresh(transport: HttpTransport, refreshToken: string): Promise<AuthResult<OAuthTokens>> {
    const body = new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: CLIENT_ID }).toString();
    return tokenPost(transport, body);
  },
};

/// Shared POST to /oauth/token (form-encoded) → tokens.
async function tokenPost(transport: HttpTransport, body: string): Promise<AuthResult<OAuthTokens>> {
  let res: { status: number; body: string };
  try {
    res = await transport.post(`${AUTH_BASE}/oauth/token`, formHeaders, body);
  } catch (e) {
    return { ok: false, error: `transport error: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (res.status < 200 || res.status >= 300) return { ok: false, error: `http ${String(res.status)}: ${res.body.slice(0, 300)}` };
  const tokens = tokensOf(parseJson(res.body));
  if (!tokens) return { ok: false, error: "malformed token response" };
  return { ok: true, value: tokens };
}
