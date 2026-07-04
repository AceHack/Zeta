// zeta-summon.ts — the summon: auto-refresh + tool loop over the subscription (shadow*).
//
// The capstone the whole model-backend arc was for (Aaron: "enable summoning personas through our own
// backend"). ONE call ties together: read our stored token (login-runner) → run the execute-and-continue
// tool loop (zeta-agent-loop) with codex/responses declaring the closed ZETA_TOOLS → execute tool calls
// over the ZetaStore (DagFs/zetadb) → and, if the access token expires mid-conversation (a 401), refresh
// via the AuthProvider, persist the rotation, and retry the turn. No manual token handling, no per-turn
// wiring — the caller summons a persona and it holds a tool-using conversation. Everything injected
// (transports, stores) — fake-testable, NO secret, NO network in tests.

import type { ChatMessage, HttpTransport } from "./backend.ts";
import type { AuthProvider } from "./auth-provider.ts";
import type { TokenStore } from "./token-store.ts";
import { freshAccessToken, type LoginDeps } from "./login-runner.ts";
import { openAiCodexProvider } from "./openai-auth.ts";
import type { CodexAuth } from "./codex-oauth.ts";
import { codexToolTurn, runToolLoop, type ModelTurn, type LoopOutcome } from "./zeta-agent-loop.ts";
import type { ZetaStore } from "./zeta-store.ts";

export interface SummonDeps {
  readonly transport: HttpTransport;
  readonly tokenStore: TokenStore; // where our OAuth tokens live (~/.config/zeta/auth)
  readonly zetaStore: ZetaStore; // the closed fs+db surface the tools execute against
  readonly now: () => string;
  readonly provider?: AuthProvider; // defaults to the OpenAI subscription provider
  readonly model?: string;
  readonly maxTurns?: number;
}

/// A persona to summon: its name + the system prompt that makes it that persona.
export interface Persona {
  readonly name: string;
  readonly systemPrompt: string;
}

const toCodexAuth = (t: { accessToken: string; accountId?: string }): CodexAuth => ({ accessToken: t.accessToken, accountId: t.accountId ?? "", refreshToken: "" });

const loginDeps = (deps: SummonDeps): LoginDeps => ({ transport: deps.transport, store: deps.tokenStore, onCode: () => undefined, sleep: () => Promise.resolve(), now: deps.now });

/// A ModelTurn that reads the stored token per turn and, on a 401, refreshes + persists + retries once.
/// This is the auto-refresh wrapper (the subscription-chat pattern) applied to the tool-loop turn.
export function refreshingCodexTurn(deps: SummonDeps): ModelTurn {
  const provider = deps.provider ?? openAiCodexProvider;
  const ld = loginDeps(deps);
  return async (input) => {
    const first = await freshAccessToken(provider, ld, false);
    if (!first.ok) return { ok: false, error: first.error }; // not logged in
    const r = await codexToolTurn(deps.transport, toCodexAuth(first.tokens), deps.model)(input);
    if (r.ok || !r.error.startsWith("http 401")) return r;
    // access token expired mid-conversation → refresh (persists the rotation) + retry the turn once.
    const refreshed = await freshAccessToken(provider, ld, true);
    if (!refreshed.ok) return { ok: false, error: `re-auth failed (run deviceLogin): ${refreshed.error}` };
    return codexToolTurn(deps.transport, toCodexAuth(refreshed.tokens), deps.model)(input);
  };
}

/// Run a tool-using conversation over the subscription: auto-refreshing auth, tools executed over the
/// ZetaStore, until the model produces a final answer (or maxTurns). Never throws.
export function subscriptionToolLoop(deps: SummonDeps, messages: readonly ChatMessage[]): Promise<LoopOutcome> {
  return runToolLoop(refreshingCodexTurn(deps), deps.zetaStore, messages, deps.maxTurns);
}

/// Summon a persona: inject its system prompt as the first message, then run the tool-using loop.
/// (CONFIRMED LIVE 2026-07-04: `role:"system"` is accepted by codex/responses — a live summon of Amara
/// returned "Hello — I'm alive and ready." with the persona system prompt first, no wire-format error.)
export function summon(deps: SummonDeps, persona: Persona, userMessages: readonly ChatMessage[]): Promise<LoopOutcome> {
  const messages: ChatMessage[] = [{ role: "system", content: persona.systemPrompt }, ...userMessages];
  return subscriptionToolLoop(deps, messages);
}
