import { describe, expect, test } from "bun:test";
import type { HttpTransport } from "./backend.ts";
import { inMemoryZetaStore } from "./zeta-store.ts";
import type { ToolCall } from "./tool-calls.ts";
import { runToolLoop, codexToolTurn, type ModelTurn, type InputItem } from "./zeta-agent-loop.ts";

// SLICE 4 — the execute-and-continue loop (shadow*, Aaron 2026-07-04 "lets do it"). The loop is pure
// over an injected ModelTurn + ZetaStore. Proofs:
//   1. HAPPY LOOP: model calls a tool → executed over the store → result fed back → model answers.
//   2. the store REALLY changed (the tool ran): fs_link then the follow-up sees it.
//   3. feed-back shape: the follow-up input carries function_call + function_call_output for the call.
//   4. NO tools → returns text in one turn.
//   5. maxTurns guard: a model that always calls tools → bounded error, never infinite.
//   6. codexToolTurn: declares ZETA_TOOLS + parses text/calls off a codex/responses SSE (fake transport).

const call = (name: string, args: Record<string, unknown>, callId: string): ToolCall => ({ name, callId, arguments: args });

describe("runToolLoop", () => {
  test("model calls a tool → executed → result fed back → model answers; store really changed", async () => {
    const store = inMemoryZetaStore();
    const seenInputs: InputItem[][] = [];
    let turnNo = 0;
    const turn: ModelTurn = (input) => {
      seenInputs.push([...input]);
      turnNo += 1;
      if (turnNo === 1) return Promise.resolve({ ok: true, text: "", calls: [call("fs_link", { path: "note", content: "hi" }, "c1")] });
      return Promise.resolve({ ok: true, text: "done", calls: [] }); // 2nd turn: final answer
    };
    const out = await runToolLoop(turn, store, [{ role: "user", content: "save a note" }]);
    expect(out).toEqual({ ok: true, content: "done", turns: 2 });
    expect(await store.resolve("note")).toBe("hi"); // the tool actually ran against the store

    // the 2nd turn's input carries the function_call + its output
    const secondInput = seenInputs[1];
    expect(secondInput!.some((i) => "type" in i && i.type === "function_call" && i.call_id === "c1")).toBe(true);
    expect(secondInput!.some((i) => "type" in i && i.type === "function_call_output" && i.call_id === "c1")).toBe(true);
  });

  test("no tools → returns the text in one turn", async () => {
    const turn: ModelTurn = () => Promise.resolve({ ok: true, text: "pong", calls: [] });
    expect(await runToolLoop(turn, inMemoryZetaStore(), [{ role: "user", content: "ping" }])).toEqual({ ok: true, content: "pong", turns: 1 });
  });

  test("a model that always calls tools is bounded by maxTurns (never infinite)", async () => {
    const turn: ModelTurn = () => Promise.resolve({ ok: true, text: "", calls: [call("db_append", { event: { x: 1 } }, "c")] });
    const out = await runToolLoop(turn, inMemoryZetaStore(), [{ role: "user", content: "go" }], 3);
    expect(out).toEqual({ ok: false, error: "tool loop exceeded 3 turns (model kept calling tools)" });
  });

  test("a failed model turn → clean error, loop stops", async () => {
    const turn: ModelTurn = () => Promise.resolve({ ok: false, error: "http 401: expired" });
    expect(await runToolLoop(turn, inMemoryZetaStore(), [{ role: "user", content: "x" }])).toEqual({ ok: false, error: "http 401: expired" });
  });

  test("off-surface tool call is refused during the loop but does not crash it", async () => {
    let n = 0;
    const turn: ModelTurn = () => {
      n += 1;
      if (n === 1) return Promise.resolve({ ok: true, text: "", calls: [call("bash_run", { cmd: "rm -rf /" }, "evil")] });
      return Promise.resolve({ ok: true, text: "refused, moving on", calls: [] });
    };
    const out = await runToolLoop(turn, inMemoryZetaStore(), [{ role: "user", content: "x" }]);
    expect(out.ok).toBe(true); // the loop survived; the refusal was fed back as the tool output
  });
});

describe("codexToolTurn", () => {
  const sseWith = (lines: string[]) => lines.join("\n");
  function fakeTransport(body: string): HttpTransport {
    return { post: () => Promise.resolve({ status: 200, body }), get: () => Promise.resolve({ status: 404, body: "" }) };
  }

  test("declares ZETA_TOOLS + parses text and tool calls off the SSE", async () => {
    // a tool-call turn
    const toolSse = sseWith(['data: {"type":"response.output_item.done","item":{"type":"function_call","name":"fs_resolve","call_id":"call_1","arguments":"{\\"path\\":\\"README.md\\"}"}}', "data: [DONE]"]);
    const calls: { body: string }[] = [];
    const t: HttpTransport = {
      post: (_u, _h, body) => {
        calls.push({ body });
        return Promise.resolve({ status: 200, body: toolSse });
      },
      get: () => Promise.resolve({ status: 404, body: "" }),
    };
    const turn = codexToolTurn(t, { accessToken: "AT", accountId: "acct", refreshToken: "" });
    const r = await turn([{ role: "user", content: "read it" }]);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.calls).toEqual([{ name: "fs_resolve", callId: "call_1", arguments: { path: "README.md" } }]);
    // the request declared the closed tools + the required stream/store flags
    const sent = JSON.parse(calls[0]!.body) as { tools: { name: string }[]; stream: boolean; store: boolean; tool_choice: string };
    expect(sent.tools.map((x) => x.name)).toContain("fs_resolve");
    expect(sent.stream).toBe(true);
    expect(sent.store).toBe(false);
    expect(sent.tool_choice).toBe("auto");
  });

  test("a text turn → text, no calls; a non-200 → clean error", async () => {
    const textTurn = codexToolTurn(fakeTransport(sseWith(['data: {"type":"response.output_text.delta","delta":"pong"}', "data: [DONE]"])), { accessToken: "AT", accountId: "acct", refreshToken: "" });
    expect(await textTurn([{ role: "user", content: "hi" }])).toEqual({ ok: true, text: "pong", calls: [] });
    const errTurn = codexToolTurn(fakeTransport("nope"), { accessToken: "AT", accountId: "acct", refreshToken: "" });
    // status 200 by fakeTransport but body isn't SSE → text empty, no calls (not an error path here); force non-200:
    const err500 = codexToolTurn({ post: () => Promise.resolve({ status: 500, body: "boom" }), get: () => Promise.resolve({ status: 404, body: "" }) }, { accessToken: "AT", accountId: "acct", refreshToken: "" });
    expect(await err500([{ role: "user", content: "hi" }])).toEqual({ ok: false, error: "http 500: boom" });
    expect((await errTurn([{ role: "user", content: "hi" }])).ok).toBe(true); // non-SSE 200 → empty text, still ok
  });
});
