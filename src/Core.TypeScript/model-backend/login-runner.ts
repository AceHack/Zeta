// login-runner.ts — drive an AuthProvider flow to completion and persist to OUR store (shadow*).
//
// Aaron 2026-07-03: "build our own device-login flow." This is the executor: it runs the hexagonal
// AuthProvider's device-code flow (start → show the URL+code → poll until authorized), stores the
// tokens in OUR TokenStore, and — separately — keeps a session alive via `freshAccessToken` (refresh
// when stale, persist the rotation). Everything is injected (transport, store, a `sleep`, an `onCode`
// callback) so the whole runner is deterministic + fake-testable with NO network, NO real login, NO
// secret. The single human step (approve the code in a browser) happens through `onCode`.

import type { AuthProvider, OAuthTokens } from "./auth-provider.ts";
import type { HttpTransport } from "./backend.ts";
import type { StoreFs, TokenStore } from "./token-store.ts";

export interface LoginDeps {
  readonly transport: HttpTransport;
  readonly store: TokenStore;
  /// Called once with the verification URL + code the human approves (print it / open a browser).
  readonly onCode: (verificationUri: string, userCode: string) => void;
  /// Injected delay between polls (ms) — the test double resolves instantly; the real one waits.
  readonly sleep: (ms: number) => Promise<void>;
  readonly now: () => string;
  /// Safety cap on poll attempts (default 180 ≈ 15 min at 5 s).
  readonly maxPolls?: number;
}

export type LoginOutcome = { readonly ok: true; readonly tokens: OAuthTokens } | { readonly ok: false; readonly error: string };

/// Run a provider's DEVICE-CODE login to completion, persisting the tokens to the store. The human
/// approves the code (surfaced via `onCode`) while this polls. Never throws.
export async function deviceLogin(provider: AuthProvider, deps: LoginDeps): Promise<LoginOutcome> {
  const started = await provider.startDeviceFlow(deps.transport);
  if (!started.ok) return { ok: false, error: `device start: ${started.error}` };
  const start = started.value;
  deps.onCode(start.verificationUri, start.userCode); // the one human step

  const maxPolls = deps.maxPolls ?? 180;
  const intervalMs = Math.max(1, start.intervalSec) * 1000;
  for (let i = 0; i < maxPolls; i++) {
    const poll = await provider.pollDevice(deps.transport, start);
    if (!poll.ok) return { ok: false, error: `device poll: ${poll.error}` };
    if ("tokens" in poll) {
      await deps.store.save({ provider: provider.name, tokens: poll.tokens, lastRefresh: deps.now() });
      return { ok: true, tokens: poll.tokens };
    }
    await deps.sleep(intervalMs); // still pending
  }
  return { ok: false, error: "device login timed out (not approved in time)" };
}

/// Return a usable access token for `provider`, refreshing + persisting if the caller signals the
/// stored one is stale/rejected (`forceRefresh`, e.g. after a 401). Reads from OUR store, never Codex's.
/// This is what a model backend calls at the edge to stay logged in without re-approval.
export async function freshAccessToken(provider: AuthProvider, deps: LoginDeps, forceRefresh = false): Promise<LoginOutcome> {
  const stored = await deps.store.load(provider.name);
  if (!stored) return { ok: false, error: "not logged in (no stored tokens — run deviceLogin)" };
  if (!forceRefresh) return { ok: true, tokens: stored.tokens };
  const refreshed = await provider.refresh(deps.transport, stored.tokens.refreshToken);
  if (!refreshed.ok) return { ok: false, error: `refresh failed (session may have ended — re-login): ${refreshed.error}` };
  // preserve account_id across refresh if the refresh response omits it
  const merged: OAuthTokens = { ...refreshed.value, accountId: refreshed.value.accountId ?? stored.tokens.accountId };
  await deps.store.save({ provider: provider.name, tokens: merged, lastRefresh: deps.now() });
  return { ok: true, tokens: merged };
}

/// The default path Zeta stores its tokens under (per-provider file lives here). Distinct from
/// ~/.codex — this is OURS, so a dead Codex session can't touch it.
export function defaultStoreDir(home: string): string {
  let base = home;
  while (base.endsWith("/")) base = base.slice(0, -1); // strip trailing slashes (no backtracking regex)
  return `${base}/.config/zeta/auth`;
}

// re-export the fs port type so a caller wiring the real fs has one import site.
export type { StoreFs };
