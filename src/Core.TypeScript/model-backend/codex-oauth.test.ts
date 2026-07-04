import { describe, expect, test } from "bun:test";
import type { HttpTransport } from "./backend.ts";
import { readCodexAuth, respond } from "./codex-oauth.ts";

// THE CHATGPT-SUBSCRIPTION BACKEND — account login, NO API key (shadow*, Aaron 2026-07-03: "I'm trying
// to avoid API keys … personal usage, if they get pissy we stop"). The subscription OAuth token calls
// chatgpt.com/backend-api/responses (the Responses API), read from ~/.codex/auth.json. All tests run
// against a FAKE transport + canned auth JSON — no network, no real token. Proofs:
//   1. TOKEN READ: readCodexAuth parses ~/.codex/auth.json → access_token + account_id (no JWT decode).
//   2. REQUEST SHAPE: POST backend-api/responses with Bearer <access_token> + chatgpt-account-id header
//      + a Responses body (input=messages) — NO api key, NO Platform-API path.
//   3. RESPONSE PARSE: output_text (and the output[].content[].text fallback) → the assistant text.
//   4. ERRORS ARE CLEAN: bad auth file, non-200, malformed body, transport throw → verdict, never throws.

const authJson = JSON.stringify({ auth_mode: "chatgpt", tokens: { id_token: "idt", access_token: "ACCESS-TOKEN", refresh_token: "REFRESH", account_id: "acct-123" } });

/// Read the canned auth or fail the test setup (avoids non-null assertions).
function auth() {
  const a = readCodexAuth(authJson);
  if (a === null) throw new Error("test setup: authJson failed to parse");
  return a;
}

function fakeTransport(response: { status: number; body: string } | (() => Promise<never>)) {
  const calls: { url: string; headers: Record<string, string>; body: string }[] = [];
  const respond2 = () => (typeof response === "function" ? response() : Promise.resolve(response));
  const transport: HttpTransport = {
    post(url, headers, body) {
      calls.push({ url, headers: { ...headers }, body });
      return respond2();
    },
    get(url, headers) {
      calls.push({ url, headers: { ...headers }, body: "" });
      return respond2();
    },
  };
  return { transport, calls };
}

describe("codex-oauth — the ChatGPT-subscription backend", () => {
  test("TOKEN READ: readCodexAuth pulls access_token + account_id from ~/.codex/auth.json", () => {
    const auth = readCodexAuth(authJson);
    expect(auth).not.toBeNull();
    expect(auth?.accessToken).toBe("ACCESS-TOKEN");
    expect(auth?.accountId).toBe("acct-123");
    expect(auth?.refreshToken).toBe("REFRESH");
  });

  test("a malformed / non-chatgpt auth file → null (never throws)", () => {
    expect(readCodexAuth("not json{")).toBeNull();
    expect(readCodexAuth(JSON.stringify({ tokens: {} }))).toBeNull(); // no access_token/account_id
    expect(readCodexAuth(JSON.stringify({ auth_mode: "apikey", OPENAI_API_KEY: "sk-x" }))).toBeNull();
  });

  test("REQUEST SHAPE: POST backend-api/responses, Bearer token + chatgpt-account-id, NO api key", async () => {
    const a = auth();
    const okBody = JSON.stringify({ output_text: "the Casimir gap is a boundary condition" });
    const { transport, calls } = fakeTransport({ status: 200, body: okBody });
    await respond(a, transport, [{ role: "user", content: "map it" }], "gpt-5.2");
    expect(calls[0].url).toBe("https://chatgpt.com/backend-api/responses");
    expect(calls[0].headers.Authorization).toBe("Bearer ACCESS-TOKEN");
    expect(calls[0].headers["chatgpt-account-id"]).toBe("acct-123");
    const sent = JSON.parse(calls[0].body) as { model: string; input: unknown; stream: boolean };
    expect(sent.model).toBe("gpt-5.2");
    expect(sent.input).toEqual([{ role: "user", content: "map it" }]);
  });

  test("RESPONSE PARSE: output_text (and the output[].content[].text fallback)", async () => {
    const a = auth();
    const { transport: t1 } = fakeTransport({ status: 200, body: JSON.stringify({ output_text: "pong" }) });
    expect(await respond(a, t1, [{ role: "user", content: "hi" }], "m")).toEqual({ ok: true, content: "pong" });
    const nested = JSON.stringify({ output: [{ type: "message", role: "assistant", content: [{ type: "output_text", text: "nested pong" }] }] });
    const { transport: t2 } = fakeTransport({ status: 200, body: nested });
    expect(await respond(a, t2, [{ role: "user", content: "hi" }], "m")).toEqual({ ok: true, content: "nested pong" });
  });

  test("ERRORS ARE CLEAN: non-200, malformed, transport throw → verdict, never throws", async () => {
    const a = auth();
    const { transport: t1 } = fakeTransport({ status: 401, body: "unauthorized" });
    expect(await respond(a, t1, [{ role: "user", content: "hi" }], "m")).toEqual({ ok: false, error: "http 401: unauthorized" });
    const { transport: t2 } = fakeTransport({ status: 200, body: "not json{" });
    expect(await respond(a, t2, [{ role: "user", content: "hi" }], "m")).toEqual({ ok: false, error: "malformed response: not JSON" });
    const { transport: t3 } = fakeTransport(() => Promise.reject(new Error("offline")));
    expect(await respond(a, t3, [{ role: "user", content: "hi" }], "m")).toEqual({ ok: false, error: "transport error: offline" });
  });
});
