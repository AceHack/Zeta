// codex-oauth.ts — the ChatGPT-subscription backend: account login, NO API key (shadow*).
//
// Aaron 2026-07-03: "most people won't go through the trouble of API keys, so I'm trying to avoid it …
// yes we can go that route, this is for my personal usage just as they say; if they ever get pissy we
// can always stop." He has a ChatGPT account (subscription), NOT a Platform API account — the two are
// separate systems (the Platform-API billing/usage errors are irrelevant; we never touch it).
//
// The mechanism (reverse-engineered from the open-source `numman-ali/opencode-openai-codex-auth`, the
// same recipe OpenCode / Codex use): the ChatGPT subscription's OAuth/device token calls the ChatGPT
// BACKEND — not the api-key `/v1/chat/completions` path. Confirmed constants + our local token file:
//   endpoint: POST https://chatgpt.com/backend-api/responses   (the OpenAI RESPONSES API shape)
//   auth:     Authorization: Bearer <access_token>  +  header  chatgpt-account-id: <account_id>
//   token:    ~/.codex/auth.json → { auth_mode:"chatgpt", tokens:{ id_token, access_token,
//             refresh_token, account_id } }   (account_id already extracted — no JWT decode needed)
//
// HONEST BOUNDARY (Aaron accepted it): `chatgpt.com/backend-api` is NOT an official public API — it is
// the ChatGPT app's own backend. Personal-use, tolerated, widely used, but ToS-GREY: it can change or
// be restricted, and it spends the subscription. For personal use on one's own subscription it is the
// established route; multi-user/production would need real Platform API keys. Revocable by design.
//
// Noninterference §13: the network + the filesystem (the token) cross ONLY through injected ports —
// `HttpTransport` and a `readAuthFile` thunk — so this is fake-testable with NO real token and NO
// socket. The token is read at the edge, never embedded, never logged.
//
// SCOPE: this slice reads the token and does a NON-streaming `responses` call (proves auth + endpoint +
// Responses shape). Streaming (SSE `response.output_text.delta` → the IChatCompleter token-by-token
// interface) + token refresh (grant_type=refresh_token) are the next slices. Live confirmation of the
// exact Responses output field waits on a live call (like the Manus listMessages probe). Anchors:
// OpenAI Responses API; numman-ali/opencode-openai-codex-auth (the recipe). Built on backend.ts.

import type { ChatMessage, HttpTransport } from "./backend.ts";

/// The ChatGPT-subscription credentials read from ~/.codex/auth.json.
export interface CodexAuth {
  readonly accessToken: string;
  readonly accountId: string;
  readonly refreshToken: string;
}

/// Parse ~/.codex/auth.json content into the subscription credentials, or null if it isn't a valid
/// chatgpt-mode auth file. Pure over the file CONTENT (the caller reads the file at the edge).
export function readCodexAuth(fileContent: string): CodexAuth | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(fileContent);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const tokens = (parsed as { tokens?: unknown }).tokens;
  if (typeof tokens !== "object" || tokens === null) return null;
  const t = tokens as { access_token?: unknown; account_id?: unknown; refresh_token?: unknown };
  if (typeof t.access_token !== "string" || typeof t.account_id !== "string") return null;
  return {
    accessToken: t.access_token,
    accountId: t.account_id,
    refreshToken: typeof t.refresh_token === "string" ? t.refresh_token : "",
  };
}

export type ResponsesOutcome =
  | { readonly ok: true; readonly content: string }
  | { readonly ok: false; readonly error: string };

const BACKEND_BASE = "https://chatgpt.com/backend-api";

/// Extract the assistant text from a (non-streaming) Responses payload. The Responses API exposes a
/// convenience `output_text`; failing that, walk `output[].content[]` for an `output_text` item.
function extractResponsesText(parsed: unknown): string | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const direct = (parsed as { output_text?: unknown }).output_text;
  if (typeof direct === "string") return direct;
  const output = (parsed as { output?: unknown }).output;
  if (!Array.isArray(output)) return null;
  for (const item of output) {
    if (typeof item !== "object" || item === null) continue;
    const content = (item as { content?: unknown }).content;
    if (!Array.isArray(content)) continue;
    for (const c of content) {
      if (typeof c === "object" && c !== null && typeof (c as { text?: unknown }).text === "string") {
        return (c as { text: string }).text;
      }
    }
  }
  return null;
}

/// Call the ChatGPT backend Responses API with the subscription token — no API key. Non-streaming.
/// Never throws: a filesystem/transport/HTTP error is a clean verdict.
export async function respond(auth: CodexAuth, transport: HttpTransport, messages: readonly ChatMessage[], model: string): Promise<ResponsesOutcome> {
  const url = `${BACKEND_BASE}/responses`;
  const headers = {
    Authorization: `Bearer ${auth.accessToken}`,
    "chatgpt-account-id": auth.accountId,
    "Content-Type": "application/json",
  };
  const body = JSON.stringify({ model, input: messages, stream: false });
  let res: { status: number; body: string };
  try {
    res = await transport.post(url, headers, body);
  } catch (e) {
    return { ok: false, error: `transport error: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (res.status < 200 || res.status >= 300) return { ok: false, error: `http ${String(res.status)}: ${res.body.slice(0, 500)}` };
  let parsed: unknown;
  try {
    parsed = JSON.parse(res.body);
  } catch {
    return { ok: false, error: "malformed response: not JSON" };
  }
  const text = extractResponsesText(parsed);
  if (text === null) return { ok: false, error: "malformed response: no output text (confirm the live Responses shape)" };
  return { ok: true, content: text };
}
