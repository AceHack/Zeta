// tool-calls.ts — parse the model's tool calls off the codex/responses stream; build the result to
// feed back (shadow*). Slice 2 of tool-calls-the-zeta-way, CONFIRMED LIVE (a real fs_resolve call).
//
// The event shape, captured live from chatgpt.com/backend-api/codex/responses with a ZETA_TOOLS
// declaration + tool_choice:"required" (the model called fs_resolve {path:"README.md"}):
//   response.output_item.added   item:{ type:"function_call", name, call_id, arguments:"" , id }  ← name+call_id early
//   response.function_call_arguments.delta   { delta:"{\"", item_id }   ← args stream in
//   response.function_call_arguments.done    { arguments:"{...}", item_id }
//   response.output_item.done    item:{ type:"function_call", name, call_id, arguments:"{...}", status:"completed" }  ← everything, one event
// So `output_item.done` with item.type==="function_call" is the clean single-event parse: name +
// call_id + the COMPLETE arguments JSON string, together. This module parses that + builds the
// function_call_output to feed the result back. Pure + fake-testable against the captured shape.

/// A parsed tool call the model wants executed: which tool (`name`, closed to fs_*/db_*), the
/// correlation id to answer on (`callId`), and the decoded arguments object.
export interface ToolCall {
  readonly name: string;
  readonly callId: string;
  readonly arguments: Readonly<Record<string, unknown>>;
}

/// Parse ONE SSE data-payload line into a ToolCall, or null if the line is not a completed
/// function_call item. Uses `response.output_item.done` (the single event carrying name+call_id+args).
export function parseToolCallLine(line: string): ToolCall | null {
  const trimmed = line.startsWith("data:") ? line.slice(5).trim() : line.trim();
  if (trimmed === "" || trimmed === "[DONE]") return null;
  let ev: unknown;
  try {
    ev = JSON.parse(trimmed);
  } catch {
    return null;
  }
  if (typeof ev !== "object" || ev === null) return null;
  const e = ev as { type?: unknown; item?: unknown };
  if (e.type !== "response.output_item.done") return null;
  const item = e.item as { type?: unknown; name?: unknown; call_id?: unknown; arguments?: unknown } | undefined;
  if (!item) return null;
  if (item.type !== "function_call" || typeof item.name !== "string" || typeof item.call_id !== "string") return null;
  let args: Record<string, unknown> = {};
  if (typeof item.arguments === "string" && item.arguments !== "") {
    try {
      const parsed = JSON.parse(item.arguments) as unknown;
      if (typeof parsed === "object" && parsed !== null) args = parsed as Record<string, unknown>;
    } catch {
      // malformed arguments — surface an empty object rather than throw; the executor validates.
    }
  }
  return { name: item.name, callId: item.call_id, arguments: args };
}

/// Extract every completed tool call from a buffered SSE body (the buffered view; the streaming view
/// pulls the same events off `respondStream`'s lines as they arrive).
export function toolCallsFromSse(sse: string): ToolCall[] {
  const calls: ToolCall[] = [];
  for (const line of sse.split("\n")) {
    const c = parseToolCallLine(line);
    if (c !== null) calls.push(c);
  }
  return calls;
}

/// The result item fed back to the model for a tool call — a `function_call_output` referencing the
/// `call_id`. `output` is stringified (the API expects a string). This is appended to `input` on the
/// follow-up request; in the Zeta way the output is the resolved DagFs content / the zetadb view / the
/// new event id from executing the call against the closed surface.
export interface FunctionCallOutput {
  readonly type: "function_call_output";
  readonly call_id: string;
  readonly output: string;
}

export function functionCallOutput(callId: string, output: unknown): FunctionCallOutput {
  return { type: "function_call_output", call_id: callId, output: typeof output === "string" ? output : JSON.stringify(output) };
}
