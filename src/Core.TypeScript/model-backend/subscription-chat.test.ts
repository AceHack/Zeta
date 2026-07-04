import { describe, expect, test } from "bun:test";
import type { HttpTransport } from "./backend.ts";
import type { AuthProvider, OAuthTokens } from "./auth-provider.ts";
import { memoryTokenStore } from "./token-store.ts";
import { chat, type ChatDeps } from "./subscription-chat.ts";

// THE USABLE SUBSCRIPTION BACKEND — read our store → call → auto-refresh on 401 (shadow*, Aaron
// 2026-07-03: "this is how you'll talk over Reticulum; push forward"). Injected transport + store —
// NO network, NO secret. Proofs:
//   1. HAPPY PATH: a stored token → codex/responses SSE → assembled answer.
//   2. AUTO-REFRESH: a 401 first call → provider.refresh → persist rotation → retry → answer.
//   3. NOT LOGGED IN → clean error (run deviceLogin).
//   4. DEAD SESSION: 401 then refresh fails → clean "re-auth failed" error, never throws.

const sse = (text: string) => ['data: {"type":"response.created"}', `data: {"type":"response.output_text.delta","delta":${JSON.stringify(text)}}`, "data: [DONE]"].join("\n");

/// A provider whose refresh rotates the token (or fails if `deadRefresh`).
function provider(deadRefresh = false): AuthProvider {
  const base: AuthProvider = {
    name: "openai",
    startDeviceFlow: () => Promise.resolve({ ok: false, error: "n/a" }),
    pollDevice: () => Promise.resolve({ ok: false, error: "n/a" }),
    authorizeUrl: () => "",
    exchangeCode: () => Promise.resolve({ ok: false, error: "n/a" }),
    refresh: (): Promise<{ ok: true; value: OAuthTokens } | { ok: false; error: string }> =>
      deadRefresh ? Promise.resolve({ ok: false, error: "refresh_token_invalidated" }) : Promise.resolve({ ok: true, value: { accessToken: "FRESH", refreshToken: "RT2", accountId: "acct-1" } }),
  };
  return base;
}

/// A transport scripted with a sequence of responses.
function seqTransport(responses: { status: number; body: string }[]) {
  let i = 0;
  const calls: { url: string; headers: Record<string, string> }[] = [];
  const t: HttpTransport = {
    post: (url, headers) => {
      calls.push({ url, headers: { ...headers } });
      return Promise.resolve(responses[Math.min(i++, responses.length - 1)]!);
    },
    get: () => Promise.resolve({ status: 404, body: "" }),
  };
  return { transport: t, calls };
}

async function storeWith(access: string) {
  const store = memoryTokenStore();
  await store.save({ provider: "openai", tokens: { accessToken: access, refreshToken: "RT1", accountId: "acct-1" }, lastRefresh: "t0" });
  return store;
}

const deps = (over: Partial<ChatDeps>): ChatDeps => ({ transport: seqTransport([]).transport, store: memoryTokenStore(), now: () => "t1", ...over });

describe("subscription chat", () => {
  test("HAPPY PATH: stored token → codex/responses → assembled answer", async () => {
    const { transport, calls } = seqTransport([{ status: 200, body: sse("pong") }]);
    const store = await storeWith("STORED");
    const out = await chat(deps({ transport, store, provider: provider() }), [{ role: "user", content: "ping" }]);
    expect(out).toEqual({ ok: true, content: "pong" });
    expect(calls[0]!.headers.Authorization).toBe("Bearer STORED"); // used the stored token
  });

  test("AUTO-REFRESH: 401 → refresh → persist → retry → answer (used the FRESH token)", async () => {
    const { transport, calls } = seqTransport([{ status: 401, body: "token expired" }, { status: 200, body: sse("pong") }]);
    const store = await storeWith("STALE");
    const out = await chat(deps({ transport, store, provider: provider() }), [{ role: "user", content: "ping" }]);
    expect(out).toEqual({ ok: true, content: "pong" });
    expect(calls[0]!.headers.Authorization).toBe("Bearer STALE"); // 1st: stale
    expect(calls[1]!.headers.Authorization).toBe("Bearer FRESH"); // 2nd: refreshed
    expect((await store.load("openai"))?.tokens.accessToken).toBe("FRESH"); // rotation persisted
  });

  test("NOT LOGGED IN → clean error", async () => {
    const out = await chat(deps({ store: memoryTokenStore(), provider: provider() }), [{ role: "user", content: "hi" }]);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toContain("not logged in");
  });

  test("DEAD SESSION: 401 then refresh fails → clean re-auth error, never throws", async () => {
    const { transport } = seqTransport([{ status: 401, body: "expired" }]);
    const store = await storeWith("STALE");
    const out = await chat(deps({ transport, store, provider: provider(true) }), [{ role: "user", content: "hi" }]);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toContain("re-auth failed (run deviceLogin)");
  });

  test("NON-AUTH failure is surfaced as-is (not retried)", async () => {
    const { transport, calls } = seqTransport([{ status: 500, body: "server error" }]);
    const store = await storeWith("STORED");
    const out = await chat(deps({ transport, store, provider: provider() }), [{ role: "user", content: "hi" }]);
    expect(out.ok).toBe(false);
    expect(calls).toHaveLength(1); // no refresh/retry on a non-401
  });
});
