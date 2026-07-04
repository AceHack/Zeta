// fetch-transport.ts — the ONE real HttpTransport: the edge adapter that touches the network (shadow*).
//
// Everything else in model-backend is fake-tested (injected HttpTransport, no socket). This is the
// single place the real network is crossed — noninterference §13: the membrane. A `fetchTransport`
// wraps `fetch` for post/get and, crucially, `postStream` — reading the response body reader and
// yielding SSE text lines AS THEY ARRIVE, so respondStream streams token-by-token over the wire (the
// codex/responses endpoint that returned "pong" live). The line-reassembly (`toLines`) is a PURE,
// testable generator; the fetch wiring around it is thin glue.

import type { HttpTransport, StreamResponse } from "./backend.ts";

/// Reassemble a stream of arbitrary text/byte chunks into complete lines (split on "\n"). A chunk may
/// end mid-line, so a partial line is buffered until its newline arrives; the final unterminated line
/// (if any) is yielded at end. Pure + deterministic — the logic worth testing (fetch itself is glue).
export async function* toLines(chunks: AsyncIterable<Uint8Array | string>): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = "";
  for await (const chunk of chunks) {
    buffer += typeof chunk === "string" ? chunk : decoder.decode(chunk, { stream: true });
    const parts = buffer.split("\n");
    buffer = parts.pop() ?? ""; // last part is the (possibly partial) trailing line
    for (const line of parts) yield line;
  }
  buffer += decoder.decode(); // flush any multi-byte remainder
  if (buffer !== "") yield buffer;
}

/// Wrap a ReadableStream reader as an async iterable of chunks (so `toLines` can consume it). A missing
/// reader (no response body) yields nothing.
async function* readerChunks(reader: ReadableStreamDefaultReader<Uint8Array> | undefined): AsyncGenerator<Uint8Array> {
  if (!reader) return;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) return;
      yield value;
    }
  } finally {
    reader.releaseLock();
  }
}

/// The real transport over `fetch`. `fetchImpl` is injectable (defaults to global fetch) so the wiring
/// itself stays testable and the module has no hard global dependency.
export function fetchTransport(fetchImpl: typeof fetch = fetch): HttpTransport {
  return {
    async post(url, headers, body) {
      const res = await fetchImpl(url, { method: "POST", headers: { ...headers }, body });
      return { status: res.status, body: await res.text() };
    },
    async get(url, headers) {
      const res = await fetchImpl(url, { method: "GET", headers: { ...headers } });
      return { status: res.status, body: await res.text() };
    },
    async postStream(url, headers, body): Promise<StreamResponse> {
      const res = await fetchImpl(url, { method: "POST", headers: { ...headers }, body });
      return { status: res.status, lines: toLines(readerChunks(res.body?.getReader())) };
    },
  };
}
