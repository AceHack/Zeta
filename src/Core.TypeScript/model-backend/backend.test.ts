import { describe, expect, test } from "bun:test";
import { openAiCompatBackend, manusBackend, type HttpTransport, type CompletionOutcome } from "./backend.ts";

// THE STANDARDS-BASED ModelBackend PORT (shadow*, Aaron 2026-07-03: "make this standards-based for
// talking to different models via REST … start with just Manus"). Targets the chat-completions shape,
// not a vendor. The transport is INJECTED (noninterference §13) so every test runs with NO network and
// NO SECRET — a fake transport returns canned bytes. Proofs:
//   1. REQUEST IS SHAPED CORRECTLY: the adapter POSTs to /v1/chat/completions with the Bearer key and a
//      {model, messages} body (the standard shape any OpenAI-compatible backend / SDK drop-in expects).
//   2. A 200 OPENAI RESPONSE PARSES to choices[0].message.content.
//   3. NON-200 → clean error (never throws); malformed body → clean error.
//   4. A TRANSPORT THROW → clean error (never throws upward).
//   5. THE MANUS PRESET points at api.manus.ai — the first adapter, same port.

/// A fake transport that records the last call and returns a canned response — no socket, no key leak.
function fakeTransport(response: { status: number; body: string } | (() => Promise<never>)) {
  const calls: { url: string; headers: Record<string, string>; body: string }[] = [];
  const respond = () => (typeof response === "function" ? response() : Promise.resolve(response));
  const transport: HttpTransport = {
    post(url, headers, body) {
      calls.push({ url, headers: { ...headers }, body });
      return respond();
    },
    get(url, headers) {
      calls.push({ url, headers: { ...headers }, body: "" });
      return respond();
    },
  };
  return { transport, calls };
}

const okResponse = { status: 200, body: JSON.stringify({ choices: [{ message: { role: "assistant", content: "the Casimir gap maps to the soft-lane confining potential" } }] }) };

describe("openAiCompatBackend — the standards-based port", () => {
  test("REQUEST SHAPE: POSTs to /v1/chat/completions with Bearer auth and a {model, messages} body", async () => {
    const { transport, calls } = fakeTransport(okResponse);
    const backend = openAiCompatBackend({ baseUrl: "https://example.test/", apiKey: "SECRET-KEY", model: "m-1" }, transport);
    await backend.complete({ messages: [{ role: "user", content: "hi" }] });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://example.test/v1/chat/completions"); // trailing slash normalized
    expect(calls[0]!.headers.Authorization).toBe("Bearer SECRET-KEY");
    expect(calls[0]!.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(calls[0]!.body)).toEqual({ model: "m-1", messages: [{ role: "user", content: "hi" }] });
  });

  test("200 RESPONSE parses to choices[0].message.content", async () => {
    const { transport } = fakeTransport(okResponse);
    const backend = openAiCompatBackend({ baseUrl: "https://x.test", apiKey: "k", model: "m-1" }, transport);
    const out: CompletionOutcome = await backend.complete({ messages: [{ role: "user", content: "map it" }] });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.result.content).toContain("Casimir");
      expect(out.result.model).toBe("m-1");
    }
  });

  test("per-request model overrides the backend default", async () => {
    const { transport, calls } = fakeTransport(okResponse);
    const backend = openAiCompatBackend({ baseUrl: "https://x.test", apiKey: "k", model: "default" }, transport);
    await backend.complete({ messages: [{ role: "user", content: "hi" }], model: "override" });
    const sent = JSON.parse(calls[0]!.body) as { model: string };
    expect(sent.model).toBe("override");
  });

  test("NON-200 → clean error (never throws)", async () => {
    const { transport } = fakeTransport({ status: 401, body: "unauthorized" });
    const backend = openAiCompatBackend({ baseUrl: "https://x.test", apiKey: "bad", model: "m" }, transport);
    const out = await backend.complete({ messages: [{ role: "user", content: "hi" }] });
    expect(out).toEqual({ ok: false, error: "http 401: unauthorized" });
  });

  test("malformed body → clean error", async () => {
    const { transport } = fakeTransport({ status: 200, body: "not json{" });
    const backend = openAiCompatBackend({ baseUrl: "https://x.test", apiKey: "k", model: "m" }, transport);
    const out = await backend.complete({ messages: [{ role: "user", content: "hi" }] });
    expect(out).toEqual({ ok: false, error: "malformed response: not JSON" });
  });

  test("a transport throw → clean error (never throws upward)", async () => {
    const { transport } = fakeTransport(() => Promise.reject(new Error("connection refused")));
    const backend = openAiCompatBackend({ baseUrl: "https://x.test", apiKey: "k", model: "m" }, transport);
    const out = await backend.complete({ messages: [{ role: "user", content: "hi" }] });
    expect(out).toEqual({ ok: false, error: "transport error: connection refused" });
  });
});

describe("manusBackend — the first adapter (same port)", () => {
  test("points at api.manus.ai with the injected key", async () => {
    const { transport, calls } = fakeTransport(okResponse);
    const backend = manusBackend("MANUS-KEY", "manus-1.6", transport);
    await backend.complete({ messages: [{ role: "user", content: "summon Lumen" }] });
    expect(calls[0]!.url).toBe("https://api.manus.ai/v1/chat/completions");
    expect(calls[0]!.headers.Authorization).toBe("Bearer MANUS-KEY");
  });
});
