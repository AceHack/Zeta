// zeta-agent-loop.ts — slice 4: the execute-and-continue loop (shadow*).
//
// Aaron 2026-07-04 "lets do it". Closes the tool-call chain: the model calls a tool → we EXECUTE it
// over the ZetaStore (DagFs/zetadb, slice 3) → feed the result back → the model continues → until it
// produces a final answer (no more tool calls). The loop is PURE over an injected `ModelTurn` (one
// model round-trip) + a `ZetaStore`, so it is fully deterministic + fake-testable with NO network.
// `codexToolTurn` is the real adapter: one codex/responses call declaring the CLOSED ZETA_TOOLS,
// parsing text + tool calls off the confirmed-live SSE.
//
// The Responses conversation protocol for tools (confirmed live): the follow-up request's `input`
// carries the assistant's own `function_call` items PLUS a `function_call_output` per call. So the
// loop accumulates input: user message → (function_call + function_call_output)* → final text.

import type { ChatMessage, HttpTransport } from "./backend.ts";
import { assembleSse } from "./codex-oauth.ts";
import type { CodexAuth } from "./codex-oauth.ts";
import { toolCallsFromSse, type ToolCall, type FunctionCallOutput } from "./tool-calls.ts";
import { ZETA_TOOLS } from "./zeta-tools.ts";
import { executeToolCall, toFunctionCallOutput, type ZetaStore } from "./zeta-store.ts";

/// The assistant's `function_call` item echoed back into `input` on the follow-up turn.
export interface FunctionCallItem {
  readonly type: "function_call";
  readonly call_id: string;
  readonly name: string;
  readonly arguments: string; // the JSON string, as the API represents it
}

/// One item in the Responses `input`: a chat message, an echoed function call, or a tool result.
export type InputItem = ChatMessage | FunctionCallItem | FunctionCallOutput;

/// One model round-trip: given the conversation so far, the assistant's text + any tool calls it wants.
export type ModelTurn = (input: readonly InputItem[]) => Promise<{ readonly ok: true; readonly text: string; readonly calls: readonly ToolCall[] } | { readonly ok: false; readonly error: string }>;

export type LoopOutcome = { readonly ok: true; readonly content: string; readonly turns: number } | { readonly ok: false; readonly error: string };

/// Run the execute-and-continue loop. Each turn: ask the model; if it wants tools, execute each over the
/// store, echo the function_call + append the function_call_output, and continue; else return its text.
/// Never throws. Bounded by `maxTurns` (default 8) so a tool-thrashing model can't loop forever.
export async function runToolLoop(turn: ModelTurn, store: ZetaStore, messages: readonly ChatMessage[], maxTurns = 8): Promise<LoopOutcome> {
  const input: InputItem[] = [...messages];
  for (let i = 1; i <= maxTurns; i++) {
    const t = await turn(input);
    if (!t.ok) return { ok: false, error: t.error };
    if (t.calls.length === 0) return { ok: true, content: t.text, turns: i };
    for (const c of t.calls) {
      input.push({ type: "function_call", call_id: c.callId, name: c.name, arguments: JSON.stringify(c.arguments) });
      const result = await executeToolCall(store, c); // over the CLOSED surface — off-surface is refused
      input.push(toFunctionCallOutput(result));
    }
  }
  return { ok: false, error: `tool loop exceeded ${String(maxTurns)} turns (model kept calling tools)` };
}

const BACKEND = "https://chatgpt.com/backend-api/codex/responses";
const DEFAULT_MODEL = "gpt-5.5";

/// The real model turn: one codex/responses call declaring the closed ZETA_TOOLS. Returns the assistant
/// text + parsed tool calls. Confirmed-live shapes (originator/beta headers, stream:true store:false,
/// tools[] with underscore names). Auth is passed in (the caller resolves + refreshes it via the store).
export function codexToolTurn(transport: HttpTransport, auth: CodexAuth, model: string = DEFAULT_MODEL): ModelTurn {
  const headers = {
    Authorization: `Bearer ${auth.accessToken}`,
    "chatgpt-account-id": auth.accountId,
    originator: "codex_cli_rs",
    "OpenAI-Beta": "responses=experimental",
    "Content-Type": "application/json",
    Accept: "text/event-stream",
  };
  return async (input) => {
    const body = JSON.stringify({ model, input, tools: ZETA_TOOLS, tool_choice: "auto", stream: true, store: false });
    let res: { status: number; body: string };
    try {
      res = await transport.post(BACKEND, headers, body);
    } catch (e) {
      return { ok: false, error: `transport error: ${e instanceof Error ? e.message : String(e)}` };
    }
    if (res.status < 200 || res.status >= 300) return { ok: false, error: `http ${String(res.status)}: ${res.body.slice(0, 500)}` };
    return { ok: true, text: assembleSse(res.body), calls: toolCallsFromSse(res.body) };
  };
}
