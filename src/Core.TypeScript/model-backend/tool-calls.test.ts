import { describe, expect, test } from "bun:test";
import { parseToolCallLine, toolCallsFromSse, functionCallOutput } from "./tool-calls.ts";

// TOOL-CALL PARSE + RESULT (shadow*, slice 2, CONFIRMED LIVE). The SSE lines below are the ACTUAL
// events captured from codex/responses with a ZETA_TOOLS declaration (the model called fs_resolve
// {path:"README.md"}). Proofs:
//   1. parse output_item.done (function_call) → { name, callId, arguments } — the single-event parse.
//   2. non-function events (text deltas, arguments.delta, created) → null.
//   3. malformed arguments → empty args, never throws.
//   4. toolCallsFromSse extracts every completed call from a buffered stream.
//   5. functionCallOutput builds the feed-back item (stringifies non-strings), referencing call_id.

// verbatim from the live probe (2026-07-04):
const OUTPUT_ITEM_DONE = 'data: {"type":"response.output_item.done","item":{"id":"fc_0700bc","type":"function_call","status":"completed","arguments":"{\\"path\\":\\"README.md\\"}","call_id":"call_nzIJYMItMxuWv54ill7wQJL5","name":"fs_resolve"},"output_index":0,"sequence_number":10}';
const OUTPUT_ITEM_ADDED = 'data: {"type":"response.output_item.added","item":{"id":"fc_0700bc","type":"function_call","status":"in_progress","arguments":"","call_id":"call_nzIJYM","name":"fs_resolve"},"output_index":0,"sequence_number":2}';
const ARGS_DELTA = 'data: {"type":"response.function_call_arguments.delta","delta":"{\\"","item_id":"fc_0700bc"}';
const TEXT_DELTA = 'data: {"type":"response.output_text.delta","delta":"pong"}';

describe("parseToolCallLine — confirmed live shape", () => {
  test("output_item.done (function_call) → { name, callId, arguments }", () => {
    expect(parseToolCallLine(OUTPUT_ITEM_DONE)).toEqual({ name: "fs_resolve", callId: "call_nzIJYMItMxuWv54ill7wQJL5", arguments: { path: "README.md" } });
  });

  test("non-completed / non-function events → null (added, args.delta, text, created, [DONE])", () => {
    expect(parseToolCallLine(OUTPUT_ITEM_ADDED)).toBeNull(); // in_progress item is not the completed one
    expect(parseToolCallLine(ARGS_DELTA)).toBeNull();
    expect(parseToolCallLine(TEXT_DELTA)).toBeNull();
    expect(parseToolCallLine('data: {"type":"response.created"}')).toBeNull();
    expect(parseToolCallLine("data: [DONE]")).toBeNull();
    expect(parseToolCallLine("data: not json{")).toBeNull();
  });

  test("malformed arguments → empty args, never throws", () => {
    const line = 'data: {"type":"response.output_item.done","item":{"type":"function_call","name":"db_query","call_id":"call_x","arguments":"{bad json"}}';
    expect(parseToolCallLine(line)).toEqual({ name: "db_query", callId: "call_x", arguments: {} });
  });

  test("empty arguments string → empty args", () => {
    const line = 'data: {"type":"response.output_item.done","item":{"type":"function_call","name":"fs_unlink","call_id":"call_y","arguments":""}}';
    expect(parseToolCallLine(line)).toEqual({ name: "fs_unlink", callId: "call_y", arguments: {} });
  });
});

describe("toolCallsFromSse", () => {
  test("extracts every completed tool call from a buffered stream", () => {
    const sse = [
      'data: {"type":"response.created"}',
      OUTPUT_ITEM_ADDED,
      ARGS_DELTA,
      OUTPUT_ITEM_DONE,
      'data: {"type":"response.completed"}',
      "data: [DONE]",
    ].join("\n");
    const calls = toolCallsFromSse(sse);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toEqual({ name: "fs_resolve", callId: "call_nzIJYMItMxuWv54ill7wQJL5", arguments: { path: "README.md" } });
  });
});

describe("functionCallOutput — the feed-back item", () => {
  test("references call_id; stringifies non-string output", () => {
    expect(functionCallOutput("call_1", "file contents")).toEqual({ type: "function_call_output", call_id: "call_1", output: "file contents" });
    expect(functionCallOutput("call_2", { nodeId: "abc", ok: true })).toEqual({ type: "function_call_output", call_id: "call_2", output: '{"nodeId":"abc","ok":true}' });
  });
});
