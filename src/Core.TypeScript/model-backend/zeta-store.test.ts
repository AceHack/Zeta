import { describe, expect, test } from "bun:test";
import { inMemoryZetaStore, executeToolCall, toFunctionCallOutput } from "./zeta-store.ts";
import type { ToolCall } from "./tool-calls.ts";

// SLICE 3 — the DagFs/zetadb execution binding (shadow*, Aaron 2026-07-04). A parsed ToolCall executes
// over the CLOSED surface against a ZetaStore. Proofs:
//   1. fs round-trip: fs_link then fs_resolve returns the content; content-addressed.
//   2. editLocal is a COW fork (one path); editEverywhere follows all paths at the shared node.
//   3. db: db_append returns an event id; db_query "log"/"count" folds the Z-set; retract removes it.
//   4. the call IS an IR node: executing a tool call records a tool_call event in the log.
//   5. closure at execution: an off-surface name (bash_run) is REFUSED, not run.
//   6. bad args → clean error; toFunctionCallOutput wraps result/error for feed-back.

const call = (name: string, args: Record<string, unknown>, callId = "call_1"): ToolCall => ({ name, callId, arguments: args });

describe("fs execution (DagFs)", () => {
  test("fs_link then fs_resolve round-trips the content", async () => {
    const s = inMemoryZetaStore();
    const linked = await executeToolCall(s, call("fs_link", { path: "a.txt", content: "hello" }));
    expect(linked.ok).toBe(true);
    const resolved = await executeToolCall(s, call("fs_resolve", { path: "a.txt" }));
    expect(resolved).toEqual({ ok: true, callId: "call_1", output: "hello" });
  });

  test("resolve of a missing path → null (not an error)", async () => {
    const s = inMemoryZetaStore();
    expect(await executeToolCall(s, call("fs_resolve", { path: "nope" }))).toEqual({ ok: true, callId: "call_1", output: null });
  });

  test("editLocal is a COW fork; editEverywhere follows all paths sharing the node", async () => {
    const s = inMemoryZetaStore();
    await s.link("x", "shared");
    await s.link("y", "shared"); // x and y share the same content address
    await executeToolCall(s, call("fs_editEverywhere", { path: "x", content: "new" }));
    expect(await s.resolve("x")).toBe("new");
    expect(await s.resolve("y")).toBe("new"); // followed (shared-object edit)

    await s.link("p", "same");
    await s.link("q", "same");
    await executeToolCall(s, call("fs_editLocal", { path: "p", content: "forked" }));
    expect(await s.resolve("p")).toBe("forked");
    expect(await s.resolve("q")).toBe("same"); // COW — only p changed
  });

  test("fs_unlink removes the link", async () => {
    const s = inMemoryZetaStore();
    await s.link("a", "v");
    expect(await executeToolCall(s, call("fs_unlink", { path: "a" }))).toEqual({ ok: true, callId: "call_1", output: { unlinked: "a" } });
    expect(await s.resolve("a")).toBeNull();
  });
});

describe("db execution (zetadb — Z-set log)", () => {
  test("db_append returns an event id; db_query folds the log; retract removes it", async () => {
    const s = inMemoryZetaStore();
    const appended = await executeToolCall(s, call("db_append", { event: { kind: "grant", who: "alice" } }));
    expect(appended.ok).toBe(true);
    const eventId = appended.ok ? (appended.output as { eventId: string }).eventId : "";
    expect(eventId.length).toBeGreaterThan(0);

    // the "grant" event is present in the fold (alongside the tool_call events)
    const q1 = await executeToolCall(s, call("db_query", { view: "log" }));
    expect(q1.ok).toBe(true);
    const events1 = q1.ok ? (q1.output as Record<string, unknown>[]) : [];
    expect(events1.some((e) => e.kind === "grant" && e.who === "alice")).toBe(true);

    // retract the grant (Z-set −1) → it leaves the net-present fold
    await s.retract(eventId);
    const q2 = await executeToolCall(s, call("db_query", { view: "log" }));
    const events2 = q2.ok ? (q2.output as Record<string, unknown>[]) : [];
    expect(events2.some((e) => e.kind === "grant")).toBe(false); // retracted
  });
});

describe("the call IS an IR node + closure at execution", () => {
  test("executing a tool call records a tool_call event in the log", async () => {
    const s = inMemoryZetaStore();
    await executeToolCall(s, call("fs_link", { path: "a", content: "b" }, "call_42"));
    const log = (await s.query("log")) as Record<string, unknown>[];
    expect(log.some((e) => e.kind === "tool_call" && e.name === "fs_link" && e.callId === "call_42")).toBe(true);
  });

  test("an off-surface tool is REFUSED, not run (closure holds at dispatch)", async () => {
    const s = inMemoryZetaStore();
    const r = await executeToolCall(s, call("bash_run", { cmd: "rm -rf /" }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain("off-surface tool refused");
    // nothing was recorded — the call never reached the store
    expect((await s.query("count")) as number).toBe(0);
  });

  test("bad args → clean error; toFunctionCallOutput wraps result and error", async () => {
    const s = inMemoryZetaStore();
    const bad = await executeToolCall(s, call("fs_link", { path: "a" })); // missing content
    expect(bad.ok).toBe(false);
    const badOut = toFunctionCallOutput(bad);
    expect(badOut.type).toBe("function_call_output");
    expect(badOut.call_id).toBe("call_1");
    expect(badOut.output).toContain("required");

    const good = await executeToolCall(s, call("fs_resolve", { path: "nope" }, "call_9"));
    expect(toFunctionCallOutput(good)).toEqual({ type: "function_call_output", call_id: "call_9", output: "null" });
  });
});
