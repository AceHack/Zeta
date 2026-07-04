import { describe, expect, test } from "bun:test";
import { toLines, fetchTransport } from "./fetch-transport.ts";

// THE REAL TRANSPORT (shadow*, Aaron 2026-07-04: back to the model-backend thread). The edge adapter
// that touches the network. The reassembly logic (toLines) is pure + tested here; the fetch wiring is
// tested with an injected fake fetch (no real socket). Proofs:
//   1. toLines: chunk boundaries splitting a line mid-way are reassembled; the trailing line flushes.
//   2. toLines: multi-byte UTF-8 split across chunks decodes correctly (TextDecoder stream mode).
//   3. post/get: status + body pass through the injected fetch.
//   4. postStream: the response body reader is turned into an SSE line stream.

async function* chunksOf(...cs: (string | Uint8Array)[]) {
  for (const c of cs) {
    await Promise.resolve();
    yield c;
  }
}
async function collect(gen: AsyncIterable<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const x of gen) out.push(x);
  return out;
}

describe("toLines — SSE line reassembly", () => {
  test("a line split across chunk boundaries is reassembled", async () => {
    const lines = await collect(toLines(chunksOf("data: {\"del", 'ta":"po"}\ndata: {"delta":"ng"}\n')));
    expect(lines).toEqual(['data: {"delta":"po"}', 'data: {"delta":"ng"}']);
  });

  test("the final unterminated line is flushed at end", async () => {
    expect(await collect(toLines(chunksOf("a\nb\nc")))).toEqual(["a", "b", "c"]);
  });

  test("multi-byte UTF-8 split across chunks decodes correctly", async () => {
    // "μ" (U+03BC) is 0xCE 0xBC — split the two bytes across chunks.
    const lines = await collect(toLines(chunksOf(new Uint8Array([0xce]), new Uint8Array([0xbc]), "x\n")));
    expect(lines).toEqual(["μx"]);
  });

  test("empty stream yields nothing", async () => {
    expect(await collect(toLines(chunksOf()))).toEqual([]);
  });
});

describe("fetchTransport over an injected fake fetch", () => {
  const fakeFetch = (status: number, body: string): typeof fetch =>
    (() => Promise.resolve(new Response(body, { status }))) as unknown as typeof fetch;

  test("post returns status + body", async () => {
    const t = fetchTransport(fakeFetch(200, "hello"));
    expect(await t.post("https://x", {}, "b")).toEqual({ status: 200, body: "hello" });
  });

  test("get returns status + body", async () => {
    const t = fetchTransport(fakeFetch(404, "nope"));
    expect(await t.get("https://x", {})).toEqual({ status: 404, body: "nope" });
  });

  test("postStream turns the body into an SSE line stream", async () => {
    const t = fetchTransport(fakeFetch(200, 'data: {"delta":"po"}\ndata: {"delta":"ng"}\n'));
    if (!t.postStream) throw new Error("fetchTransport must provide postStream");
    const res = await t.postStream("https://x", {}, "b");
    expect(res.status).toBe(200);
    expect(await collect(res.lines)).toEqual(['data: {"delta":"po"}', 'data: {"delta":"ng"}']);
  });
});
