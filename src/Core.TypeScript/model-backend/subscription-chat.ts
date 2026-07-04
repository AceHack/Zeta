// subscription-chat.ts — the usable backend: read OUR store → call → auto-refresh on 401 (shadow*).
//
// Aaron 2026-07-03: "eventually this is how you'll all talk to each other over Reticulum; push forward
// with your suggestions." This is the glue that makes the account-login subscription backend usable
// end-to-end: it reads the token from OUR store (~/.config/zeta/auth), calls the ChatGPT backend
// (codex/responses, streaming SSE, confirmed live → "pong"), and — if the access token has expired
// (a 401) — REFRESHES via the AuthProvider, persists the rotation, and retries once. No manual token
// handling; the caller just sends messages. Everything injected (transport, store) — fake-testable,
// NO secret in code (the token is read from the store at the edge).
//
// This is the per-agent "speak to a model" primitive that the Reticulum agent-to-agent layer will sit
// on: same messages-in → answer-out shape, one provider today (OpenAI subscription), many later.

import type { ChatMessage, HttpTransport } from "./backend.ts";
import type { AuthProvider } from "./auth-provider.ts";
import type { TokenStore } from "./token-store.ts";
import { freshAccessToken, type LoginDeps } from "./login-runner.ts";
import { respond, type CodexAuth, type ResponsesOutcome } from "./codex-oauth.ts";
import { openAiCodexProvider } from "./openai-auth.ts";

/// Minimal deps: the network + the store. (onCode/sleep are only used by the interactive device login,
/// not by refresh, so they are no-ops here.)
export interface ChatDeps {
  readonly transport: HttpTransport;
  readonly store: TokenStore;
  readonly now: () => string;
  readonly provider?: AuthProvider; // defaults to the OpenAI subscription provider
  readonly model?: string;
}

function loginDeps(deps: ChatDeps): LoginDeps {
  return { transport: deps.transport, store: deps.store, onCode: () => undefined, sleep: () => Promise.resolve(), now: deps.now };
}

function toCodexAuth(tokens: { accessToken: string; accountId?: string }): CodexAuth {
  return { accessToken: tokens.accessToken, accountId: tokens.accountId ?? "", refreshToken: "" };
}

/// Send `messages` to the subscription-backed model, reading + refreshing OUR token automatically.
/// On a 401 (expired access token) it refreshes via the provider, persists, and retries ONCE. Never
/// throws. If there is no stored session, or the refresh fails (dead session), returns a clean error
/// telling the caller to run `deviceLogin`.
export async function chat(deps: ChatDeps, messages: readonly ChatMessage[]): Promise<ResponsesOutcome> {
  const provider = deps.provider ?? openAiCodexProvider;
  const ld = loginDeps(deps);

  const first = await freshAccessToken(provider, ld, false);
  if (!first.ok) return { ok: false, error: first.error }; // not logged in

  let out = await respond(toCodexAuth(first.tokens), deps.transport, messages, deps.model);
  if (out.ok) return out;
  if (!out.error.startsWith("http 401")) return out; // a non-auth failure — surface as-is

  // access token expired → refresh (persists the rotation) + retry once.
  const refreshed = await freshAccessToken(provider, ld, true);
  if (!refreshed.ok) return { ok: false, error: `re-auth failed (run deviceLogin): ${refreshed.error}` };
  out = await respond(toCodexAuth(refreshed.tokens), deps.transport, messages, deps.model);
  return out;
}
