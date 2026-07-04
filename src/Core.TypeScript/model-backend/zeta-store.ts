// zeta-store.ts — slice 3: bind a parsed ToolCall to its DagFs/zetadb op over the closed surface (shadow*).
//
// Aaron 2026-07-04: "build slice 3 — the DagFs/zetadb execution binding." The tool surface is closed
// (fs + db, zeta-tools.ts); this EXECUTES a parsed ToolCall (tool-calls.ts) against a ZetaStore. The
// Zeta way, made operational:
//   - fs ops are edits to a content-addressed DagFs tree (resolve/link/editLocal/editEverywhere/unlink).
//   - db ops are appends/queries over an append-only Z-SET event log; a view is a fold; retraction (−1)
//     is first-class — a wrong call is RETRACTED, not patched.
//   - EVERY executed tool call is itself appended to the log as an event (the call IS an IR node — db
//     is the IR). So the store's history contains the calls that shaped it: replayable, retractable.
// The binding closes at execution too: an off-surface name (not fs_*/db_*) is refused, not run — the
// closure invariant (zeta-tools.isClosedSurface) holds at the door AND at the dispatch.
//
// The in-memory ZetaStore is the DST-friendly default + the test double; a real DagFs/zetadb backend is
// the same interface with a different substrate. contentHash (ace/store.ts) is the shared addressing.

import { contentHash } from "../ace/store.ts";
import { domainOf } from "./zeta-tools.ts";
import type { ToolCall } from "./tool-calls.ts";
import { functionCallOutput, type FunctionCallOutput } from "./tool-calls.ts";

const addr = (content: string): string => contentHash(new TextEncoder().encode(content));

/// The closed capability surface, executable. fs = DagFs (content-addressed tree); db = zetadb
/// (append-only Z-set log). Methods are async — a real backend does I/O; the in-memory impl resolves
/// immediately (DoP=1 deterministic).
export interface ZetaStore {
  // fs — DagFs
  resolve(path: string): Promise<string | null>;
  link(path: string, content: string): Promise<string>; // returns the content address
  editLocal(path: string, content: string): Promise<string>; // COW fork — only this path
  editEverywhere(path: string, content: string): Promise<string>; // shared edit — all paths at the old node follow
  unlink(path: string): Promise<void>;
  // db — zetadb
  append(event: Readonly<Record<string, unknown>>): Promise<string>; // returns the event id (content address)
  query(view: string, args?: Readonly<Record<string, unknown>>): Promise<unknown>; // a named fold over the log
  retract(eventId: string): Promise<void>; // Z-set −1: un-assert a prior event
}

/// An in-memory ZetaStore: a content-addressed tree (path → address, address → content) + an
/// append-only weighted log (Z-set: weight may go negative; retract appends −1). Views are folds.
export function inMemoryZetaStore(): ZetaStore {
  const nodes = new Map<string, string>(); // address → content
  const links = new Map<string, string>(); // path → address
  const log: { id: string; event: Readonly<Record<string, unknown>>; weight: number }[] = [];

  const put = (content: string): string => {
    const h = addr(content);
    nodes.set(h, content);
    return h;
  };

  return {
    resolve: (path) => {
      const a = links.get(path);
      return Promise.resolve(a === undefined ? null : (nodes.get(a) ?? null));
    },
    link: (path, content) => {
      const h = put(content);
      links.set(path, h);
      return Promise.resolve(h);
    },
    editLocal: (path, content) => {
      const h = put(content);
      links.set(path, h); // repoint ONLY this path (COW fork)
      return Promise.resolve(h);
    },
    editEverywhere: (path, content) => {
      const old = links.get(path);
      const h = put(content);
      if (old !== undefined) {
        for (const [p, a] of links) if (a === old) links.set(p, h); // every path at the old node follows
      } else {
        links.set(path, h);
      }
      return Promise.resolve(h);
    },
    unlink: (path) => {
      links.delete(path); // the node stays in `nodes` (may be shared; GC is separate)
      return Promise.resolve();
    },
    append: (event) => {
      const id = addr(JSON.stringify(event));
      log.push({ id, event, weight: 1 });
      return Promise.resolve(id);
    },
    retract: (eventId) => {
      const found = log.find((e) => e.id === eventId);
      if (found) log.push({ id: eventId, event: found.event, weight: -1 }); // Z-set −1
      return Promise.resolve();
    },
    query: (view) => {
      // minimal named folds — the shape (views = folds over the log), not a full engine. `args` is
      // accepted by the interface for real views; these two folds ignore it.
      if (view === "log") return Promise.resolve(netEvents(log));
      if (view === "count") return Promise.resolve(netEvents(log).length);
      return Promise.resolve({ error: `unknown view: ${view}` });
    },
  };
}

/// Fold the Z-set log to net-present events (sum weights per id; keep those with net weight > 0).
function netEvents(log: readonly { id: string; event: Readonly<Record<string, unknown>>; weight: number }[]): Readonly<Record<string, unknown>>[] {
  const net = new Map<string, { event: Readonly<Record<string, unknown>>; weight: number }>();
  for (const e of log) {
    const cur = net.get(e.id);
    net.set(e.id, { event: e.event, weight: (cur?.weight ?? 0) + e.weight });
  }
  return [...net.values()].filter((v) => v.weight > 0).map((v) => v.event);
}

export type ToolExecResult = { readonly ok: true; readonly callId: string; readonly output: unknown } | { readonly ok: false; readonly callId: string; readonly error: string };

const asStr = (v: unknown): string | null => (typeof v === "string" ? v : null);
type Args = Readonly<Record<string, unknown>>;
const okOf = (callId: string, output: unknown): ToolExecResult => ({ ok: true, callId, output });
const errOf = (callId: string, error: string): ToolExecResult => ({ ok: false, callId, error });

/// The fs (DagFs) dispatch — bound store-method calls (no extraction).
async function execFs(store: ZetaStore, name: string, callId: string, a: Args): Promise<ToolExecResult> {
  if (name === "fs_resolve") {
    const path = asStr(a.path);
    return path === null ? errOf(callId, "fs_resolve: 'path' (string) required") : okOf(callId, await store.resolve(path));
  }
  if (name === "fs_unlink") {
    const path = asStr(a.path);
    if (path === null) return errOf(callId, "fs_unlink: 'path' (string) required");
    await store.unlink(path);
    return okOf(callId, { unlinked: path });
  }
  if (name === "fs_link" || name === "fs_editLocal" || name === "fs_editEverywhere") {
    const path = asStr(a.path);
    const content = asStr(a.content);
    if (path === null || content === null) return errOf(callId, `${name}: 'path' and 'content' (strings) required`);
    let address: string;
    if (name === "fs_link") address = await store.link(path, content);
    else if (name === "fs_editLocal") address = await store.editLocal(path, content);
    else address = await store.editEverywhere(path, content);
    return okOf(callId, { address });
  }
  return errOf(callId, `unknown tool: ${name}`); // fs_ prefix but not a known op
}

/// The db (zetadb) dispatch.
async function execDb(store: ZetaStore, name: string, callId: string, a: Args): Promise<ToolExecResult> {
  if (name === "db_append") {
    const event = a.event;
    if (typeof event !== "object" || event === null) return errOf(callId, "db_append: 'event' (object) required");
    return okOf(callId, { eventId: await store.append(event as Record<string, unknown>) });
  }
  if (name === "db_query") {
    const view = asStr(a.view);
    if (view === null) return errOf(callId, "db_query: 'view' (string) required");
    const args = typeof a.args === "object" && a.args !== null ? (a.args as Record<string, unknown>) : undefined;
    return okOf(callId, await store.query(view, args));
  }
  return errOf(callId, `unknown tool: ${name}`); // db_ prefix but not a known op
}

/// Execute one parsed ToolCall against the store, over the CLOSED surface. Dispatches by domain; an
/// off-surface name (not fs_*/db_*) is refused (the closure holds at dispatch). Records the call itself
/// as a `tool_call` event (the call IS an IR node). Never throws — a bad call is a clean error result;
/// a genuinely wrong-but-applied call can be retracted later via its logged event id.
export async function executeToolCall(store: ZetaStore, call: ToolCall): Promise<ToolExecResult> {
  const domain = domainOf(call.name);
  if (domain === null) return errOf(call.callId, `off-surface tool refused: ${call.name} (only fs_*/db_* are permitted)`);
  try {
    // the call is an IR node — record it before applying (so the history contains what shaped the store).
    await store.append({ kind: "tool_call", name: call.name, callId: call.callId, arguments: call.arguments });
    return domain === "fs" ? await execFs(store, call.name, call.callId, call.arguments) : await execDb(store, call.name, call.callId, call.arguments);
  } catch (e) {
    return errOf(call.callId, `execution error: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/// Turn an execution result into the `function_call_output` fed back to the model.
export function toFunctionCallOutput(result: ToolExecResult): FunctionCallOutput {
  return functionCallOutput(result.callId, result.ok ? result.output : { error: result.error });
}
