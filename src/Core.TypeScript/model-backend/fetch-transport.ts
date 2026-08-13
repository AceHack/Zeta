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

export function fetchTransport(fetchImpl: typeof fetch = fetch, timeoutMs: number = 900_000): HttpTransport {
  return {
    async post(url, headers, body) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetchImpl(url, { method: "POST", headers: { ...headers }, body, signal: ctrl.signal });
        return { status: res.status, body: await res.text() };
      } finally {
        clearTimeout(timer);
      }
    },
    async get(url, headers) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetchImpl(url, { method: "GET", headers: { ...headers }, signal: ctrl.signal });
        return { status: res.status, body: await res.text() };
      } finally {
        clearTimeout(timer);
      }
    },
    async postStream(url, headers, body): Promise<StreamResponse> {
      // For streams, we bound the *initial connection*, but the stream itself might stay open.
      // We pass the signal so if the request hangs before headers, it aborts.
      // We do not clear the timer if the stream takes longer, but we might want to let the consumer handle stream aborts.
      // For now, bounding the fetch promise resolves the immediate unbounded-hang issue.
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        const res = await fetchImpl(url, { method: "POST", headers: { ...headers }, body, signal: ctrl.signal });
        // NOTE: we clear the connection-establishment timer, but the stream is now alive.
        clearTimeout(timer);
        return { status: res.status, lines: toLines(readerChunks(res.body?.getReader())) };
      } catch (e) {
        clearTimeout(timer);
        throw e;
      }
    },
  };
}
