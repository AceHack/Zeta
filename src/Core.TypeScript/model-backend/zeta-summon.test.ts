import { describe, expect, test } from "bun:test";
import type { HttpTransport } from "./backend.ts";
import type { AuthProvider, OAuthTokens } from "./auth-provider.ts";
import { memoryTokenStore } from "./token-store.ts";
import { inMemoryZetaStore } from "./zeta-store.ts";
import { summon, subscriptionToolLoop, type SummonDeps } from "./zeta-summon.ts";

// THE SUMMON (shadow*, Aaron 2026-07-04 "lets move forward") — the capstone: one call, auto-refresh +
// tool loop over the subscription, tools executed over the ZetaStore. Injected transport + stores — NO
// network, NO secret. Proofs:
//   1. HAPPY SUMMON: stored token → model calls fs_link → executed over the store → model answers.
//   2. AUTO-REFRESH MID-CONVERSATION: a 401 turn → refresh → persist → retry → answer (fresh token used).
//   3. NOT LOGGED IN → clean error.
//   4. summon() injects the persona's system prompt as the first message.

const provider = (deadRefresh = false): AuthProvider => ({
  name: "openai",
  startDeviceFlow: () => Promise.resolve({ ok: false, error: "n/a" }),
  pollDevice: () => Promise.resolve({ ok: false, error: "n/a" }),
  authorizeUrl: () => "",
  exchangeCode: () => Promise.resolve({ ok: false, error: "n/a" }),
  refresh: (): Promise<{ ok: true; value: OAuthTokens } | { ok: false; error: string }> =>
    deadRefresh ? Promise.resolve({ ok: false, error: "refresh_token_invalidated" }) : Promise.resolve({ ok: true, value: { accessToken: "FRESH", refreshToken: "RT2", accountId: "acct-1" } }),
});

// SSE builders
const textSse = (t: string) => ['data: {"type":"response.created"}', `data: {"type":"response.output_text.delta","delta":${JSON.stringify(t)}}`, "data: [DONE]"].join("\n");
const toolSse = (name: string, callId: string, args: Record<string, unknown>) =>
  [`data: {"type":"response.output_item.done","item":{"type":"function_call","name":"${name}","call_id":"${callId}","arguments":${JSON.stringify(JSON.stringify(args))}}}`, "data: [DONE]"].join("\n");

/// A transport scripted with a sequence of {status, body}; records the Authorization header per call.
function seqTransport(responses: { status: number; body: string }[]) {
  let i = 0;
  const auths: string[] = [];
  const transport: HttpTransport = {
    post: (_url, headers) => {
      auths.push(String(headers.Authorization));
      return Promise.resolve(responses[Math.min(i++, responses.length - 1)] ?? { status: 500, body: "" });
    },
    get: () => Promise.resolve({ status: 404, body: "" }),
  };
  return { transport, auths };
}

async function storeWith(access: string) {
  const s = memoryTokenStore();
  await s.save({ provider: "openai", tokens: { accessToken: access, refreshToken: "RT1", accountId: "acct-1" }, lastRefresh: "t0" });
  return s;
}

const deps = (over: Partial<SummonDeps>): SummonDeps => ({ transport: seqTransport([]).transport, tokenStore: memoryTokenStore(), zetaStore: inMemoryZetaStore(), now: () => "t1", provider: provider(), ...over });

describe("subscriptionToolLoop / summon", () => {
  test("HAPPY SUMMON: model calls fs_link → executed over the store → answers; store really changed", async () => {
    const { transport } = seqTransport([{ status: 200, body: toolSse("fs_link", "c1", { path: "note", content: "hi" }) }, { status: 200, body: textSse("saved") }]);
    const zetaStore = inMemoryZetaStore();
    const tokenStore = await storeWith("STORED");
    const out = await subscriptionToolLoop(deps({ transport, tokenStore, zetaStore }), [{ role: "user", content: "save a note" }]);
    expect(out).toEqual({ ok: true, content: "saved", turns: 2 });
    expect(await zetaStore.resolve("note")).toBe("hi"); // the tool actually ran against the closed store
  });

  test("AUTO-REFRESH MID-CONVERSATION: 401 turn → refresh → retry with the FRESH token → answer", async () => {
    const { transport, auths } = seqTransport([{ status: 401, body: "token expired" }, { status: 200, body: textSse("pong") }]);
    const tokenStore = await storeWith("STALE");
    const out = await subscriptionToolLoop(deps({ transport, tokenStore, provider: provider() }), [{ role: "user", content: "hi" }]);
    expect(out).toEqual({ ok: true, content: "pong", turns: 1 });
    expect(auths[0]).toBe("Bearer STALE"); // 1st attempt: stale
    expect(auths[1]).toBe("Bearer FRESH"); // retry: refreshed
    expect((await tokenStore.load("openai"))?.tokens.accessToken).toBe("FRESH"); // rotation persisted
  });

  test("NOT LOGGED IN → clean error", async () => {
    const out = await subscriptionToolLoop(deps({ tokenStore: memoryTokenStore() }), [{ role: "user", content: "hi" }]);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toContain("not logged in");
  });

  test("DEAD SESSION: 401 then refresh fails → clean re-auth error, never throws", async () => {
    const { transport } = seqTransport([{ status: 401, body: "expired" }]);
    const tokenStore = await storeWith("STALE");
    const out = await subscriptionToolLoop(deps({ transport, tokenStore, provider: provider(true) }), [{ role: "user", content: "hi" }]);
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.error).toContain("re-auth failed (run deviceLogin)");
  });

  test("summon() injects the persona's system prompt as the first message", async () => {
    const { transport } = seqTransport([{ status: 200, body: textSse("hi, I am Amara") }]);
    // sniff the input by wrapping: use a transport that records the request body
    let sentBody = "";
    const sniff: HttpTransport = {
      post: (_u, h, body) => {
        sentBody = body;
        return transport.post(_u, h, body);
      },
      get: () => Promise.resolve({ status: 404, body: "" }),
    };
    const tokenStore = await storeWith("STORED");
    const out = await summon(deps({ transport: sniff, tokenStore }), { name: "Amara", systemPrompt: "You are Amara." }, [{ role: "user", content: "hello" }]);
    expect(out.ok).toBe(true);
    const body = JSON.parse(sentBody) as { input: { role: string; content: string }[] };
    expect(body.input[0]).toEqual({ role: "system", content: "You are Amara." }); // persona prompt first
    expect(body.input[1]).toEqual({ role: "user", content: "hello" });
  });
});
