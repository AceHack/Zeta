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
const DEFAULT_MODEL = "gpt-5.5"; // CONFIRMED LIVE: the model Codex sends; gpt-5.2 etc. are rejected for a ChatGPT account.

/// The request recipe CONFIRMED LIVE against chatgpt.com/backend-api/codex/responses (a real "pong"):
///   POST /codex/responses  headers: Authorization, chatgpt-account-id, originator:"codex_cli_rs",
///     OpenAI-Beta:"responses=experimental", Accept:"text/event-stream"
///   body: { model:"gpt-5.5", input:[{role,content}], stream:TRUE, store:FALSE }  ← both required
///   response: an SSE stream of Responses events; the answer = concatenated response.output_text.delta.
const requestHeaders = (auth: CodexAuth) => ({
  Authorization: `Bearer ${auth.accessToken}`,
  "chatgpt-account-id": auth.accountId,
  originator: "codex_cli_rs",
  "OpenAI-Beta": "responses=experimental",
  "Content-Type": "application/json",
  Accept: "text/event-stream",
});

const requestBody = (messages: readonly ChatMessage[], model: string) =>
  JSON.stringify({ model, input: messages, stream: true, store: false }); // stream:true + store:false are both required

/// Extract the delta text from ONE SSE data-payload line (the text after `data:`), or null if the line
/// is not a `response.output_text.delta` (a control event, [DONE], comment, or non-JSON). Pure.
export function deltaOfSseLine(line: string): string | null {
  const trimmed = line.startsWith("data:") ? line.slice(5).trim() : line.trim();
  if (trimmed === "" || trimmed === "[DONE]") return null;
  try {
    const ev = JSON.parse(trimmed) as { type?: unknown; delta?: unknown };
    return ev.type === "response.output_text.delta" && typeof ev.delta === "string" ? ev.delta : null;
  } catch {
    return null;
  }
}

/// Assemble the assistant text from a buffered SSE body: concatenate every `response.output_text.delta`.
/// Pure + testable — the real transport buffers the stream, this extracts the answer.
export function assembleSse(sse: string): string {
  let out = "";
  for (const line of sse.split("\n")) {
    if (!line.startsWith("data:")) continue;
    const data = line.slice(5).trim();
    if (data === "[DONE]" || data === "") continue;
    try {
      const ev = JSON.parse(data) as { type?: unknown; delta?: unknown };
      if (ev.type === "response.output_text.delta" && typeof ev.delta === "string") out += ev.delta;
    } catch {
      // non-JSON SSE line (comment / keep-alive) — skip
    }
  }
  return out;
}

/// A streamed error: the caller sees `{ error }` as the first (and only) yield instead of deltas.
export type StreamDelta = { readonly delta: string } | { readonly error: string };

/// **The token-by-token streaming primitive — the IChatCompleter shape.** Yields each
/// `response.output_text.delta` as it arrives from the ChatGPT backend `codex/responses`. Uses the
/// transport's streaming door (`postStream`) when present — true token-by-token; falls back to the
/// buffered `post` (one yield of the whole answer) when not. THIS is the fundamental operation; the
/// non-streaming `respond` below is a special case (collect the stream). Never throws — a transport /
/// HTTP error is yielded as `{ error }`.
export function respondStream(auth: CodexAuth, transport: HttpTransport, messages: readonly ChatMessage[], model: string = DEFAULT_MODEL): AsyncGenerator<StreamDelta> {
  const url = `${BACKEND_BASE}/codex/responses`;
  const headers = requestHeaders(auth);
  const body = requestBody(messages, model);
  return transport.postStream ? streamLive(transport, url, headers, body) : streamBuffered(transport, url, headers, body);
}

const asError = (e: unknown): StreamDelta => ({ error: `transport error: ${e instanceof Error ? e.message : String(e)}` });

/// The true token-by-token path (postStream present): yield each delta as its SSE line arrives.
async function* streamLive(transport: HttpTransport, url: string, headers: Readonly<Record<string, string>>, body: string): AsyncGenerator<StreamDelta> {
  if (!transport.postStream) return; // guaranteed by the caller; re-guarded so we call it BOUND (not extracted)
  let res;
  try {
    res = await transport.postStream(url, headers, body);
  } catch (e) {
    yield asError(e);
    return;
  }
  if (res.status < 200 || res.status >= 300) {
    let errText = "";
    for await (const line of res.lines) errText += line;
    yield { error: `http ${String(res.status)}: ${errText.slice(0, 500)}` };
    return;
  }
  for await (const line of res.lines) {
    const d = deltaOfSseLine(line);
    if (d !== null) yield { delta: d };
  }
}

/// The buffered fallback (no postStream): one yield of the whole assembled answer — the non-streaming
/// special case of the streaming primitive.
async function* streamBuffered(transport: HttpTransport, url: string, headers: Readonly<Record<string, string>>, body: string): AsyncGenerator<StreamDelta> {
  let res: { status: number; body: string };
  try {
    res = await transport.post(url, headers, body);
  } catch (e) {
    yield asError(e);
    return;
  }
  if (res.status < 200 || res.status >= 300) {
    yield { error: `http ${String(res.status)}: ${res.body.slice(0, 500)}` };
    return;
  }
  const whole = assembleSse(res.body);
  if (whole !== "") yield { delta: whole };
}

/// Call `codex/responses` and return the WHOLE answer — the non-streaming view, defined as *collect the
/// stream*: one is a special case of the other. Never throws.
export async function respond(auth: CodexAuth, transport: HttpTransport, messages: readonly ChatMessage[], model: string = DEFAULT_MODEL): Promise<ResponsesOutcome> {
  let content = "";
  for await (const d of respondStream(auth, transport, messages, model)) {
    if ("error" in d) return { ok: false, error: d.error };
    content += d.delta;
  }
  if (content === "") return { ok: false, error: "no output_text deltas in the SSE stream" };
  return { ok: true, content };
}
