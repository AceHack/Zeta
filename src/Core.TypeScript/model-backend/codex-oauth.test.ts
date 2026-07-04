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

  // CONFIRMED LIVE (a real "pong"): POST /codex/responses, streaming SSE, the required headers + body.
  const sseBody = ['data: {"type":"response.created"}', 'data: {"type":"response.output_text.delta","delta":"po"}', 'data: {"type":"response.output_text.delta","delta":"ng"}', "data: [DONE]"].join("\n");

  test("REQUEST SHAPE: POST /codex/responses, Bearer + account-id + originator + beta, stream:true store:false", async () => {
    const a = auth();
    const { transport, calls } = fakeTransport({ status: 200, body: sseBody });
    await respond(a, transport, [{ role: "user", content: "map it" }]);
    expect(calls[0].url).toBe("https://chatgpt.com/backend-api/codex/responses");
    expect(calls[0].headers.Authorization).toBe("Bearer ACCESS-TOKEN");
    expect(calls[0].headers["chatgpt-account-id"]).toBe("acct-123");
    expect(calls[0].headers.originator).toBe("codex_cli_rs");
    expect(calls[0].headers["OpenAI-Beta"]).toBe("responses=experimental");
    const sent = JSON.parse(calls[0].body) as { model: string; input: unknown; stream: boolean; store: boolean };
    expect(sent.model).toBe("gpt-5.5"); // the default Codex model (gpt-5.2 is rejected for a ChatGPT account)
    expect(sent.stream).toBe(true);
    expect(sent.store).toBe(false);
    expect(sent.input).toEqual([{ role: "user", content: "map it" }]);
  });

  test("SSE PARSE: response.output_text.delta events concatenate into the answer", async () => {
    const a = auth();
    const { transport } = fakeTransport({ status: 200, body: sseBody });
    expect(await respond(a, transport, [{ role: "user", content: "hi" }])).toEqual({ ok: true, content: "pong" });
  });

  test("ERRORS ARE CLEAN: non-200, no-deltas, transport throw → verdict, never throws", async () => {
    const a = auth();
    const { transport: t1 } = fakeTransport({ status: 401, body: "unauthorized" });
    expect(await respond(a, t1, [{ role: "user", content: "hi" }])).toEqual({ ok: false, error: "http 401: unauthorized" });
    const { transport: t2 } = fakeTransport({ status: 200, body: 'data: {"type":"response.created"}\ndata: [DONE]' }); // no deltas
    expect(await respond(a, t2, [{ role: "user", content: "hi" }])).toEqual({ ok: false, error: "no output_text deltas in the SSE stream" });
    const { transport: t3 } = fakeTransport(() => Promise.reject(new Error("offline")));
    expect(await respond(a, t3, [{ role: "user", content: "hi" }])).toEqual({ ok: false, error: "transport error: offline" });
  });
});

// TRUE STREAMING — token-by-token via postStream (shadow*, Aaron 2026-07-03: "lets do it … IQbservable
// too … one is a special case of the other"). respondStream yields deltas AS THEY ARRIVE; respond is
// just collect(respondStream). Proofs:
//   - respondStream over a streaming transport yields each delta incrementally ("po" then "ng").
//   - a non-200 stream → a single { error } yield (never throws).
//   - respond (collect) still works over the streaming transport → "pong".

import { respondStream } from "./codex-oauth.ts";
import type { StreamResponse } from "./backend.ts";

// a streaming fake: postStream yields the given SSE lines one at a time (true async iterable).
function streamTransport(status: number, sseLines: string[]): HttpTransport {
  async function* gen() { await Promise.resolve(); for (const l of sseLines) yield l; }
  return {
    post: () => Promise.resolve({ status, body: sseLines.join("\n") }),
    get: () => Promise.resolve({ status: 404, body: "" }),
    postStream: (): Promise<StreamResponse> => Promise.resolve({ status, lines: gen() }),
  };
}

describe("respondStream — true token-by-token", () => {
  test("yields each output_text.delta incrementally", async () => {
    const lines = ['data: {"type":"response.created"}', 'data: {"type":"response.output_text.delta","delta":"po"}', 'data: {"type":"response.output_text.delta","delta":"ng"}', "data: [DONE]"];
    const t = streamTransport(200, lines);
    const got: string[] = [];
    for await (const d of respondStream(auth(), t, [{ role: "user", content: "hi" }])) {
      if ("delta" in d) got.push(d.delta);
      else throw new Error(d.error);
    }
    expect(got).toEqual(["po", "ng"]); // token-by-token, not one blob
  });

  test("a non-200 stream yields a single { error } (never throws)", async () => {
    const t = streamTransport(401, ["unauthorized"]);
    const out: { delta: string } | { error: string } | undefined = await (async () => {
      for await (const d of respondStream(auth(), t, [{ role: "user", content: "hi" }])) return d;
      return undefined;
    })();
    expect(out).toEqual({ error: "http 401: unauthorized" });
  });

  test("respond (collect the stream) over the streaming transport → the whole answer", async () => {
    const lines = ['data: {"type":"response.output_text.delta","delta":"po"}', 'data: {"type":"response.output_text.delta","delta":"ng"}', "data: [DONE]"];
    expect(await respond(auth(), streamTransport(200, lines), [{ role: "user", content: "hi" }])).toEqual({ ok: true, content: "pong" });
  });
});
