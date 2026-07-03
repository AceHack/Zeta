import { describe, expect, test } from "bun:test";
import type { HttpTransport } from "./backend.ts";
import { createTask, listMessages, latestAssistantContent, isComplete } from "./manus-task.ts";

// THE REAL MANUS ADAPTER — the task API (shadow*, Aaron 2026-07-03 gave the key + "research their
// API"). Native Manus is task-based (v2/task.create → poll), NOT chat-completions. All tests run
// against a FAKE transport — no network, NO SECRET (the key never touches this module). Proofs:
//   1. REQUEST SHAPE: POST v2/task.create with the x-manus-api-key header, the message.content body,
//      agent_profile, and force_skills (the Lumen skill tie-in).
//   2. RESPONSE PARSE: a documented 200 { task_id, task_url, task_title } → CreatedTask.
//   3. ERRORS ARE CLEAN: non-200, malformed body, transport throw → verdict, never throws upward.

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

const okBody = JSON.stringify({ ok: true, request_id: "r1", task_id: "task_abc", task_title: "Casimir↔soft-lane", task_url: "https://manus.im/app/task_abc", share_visibility: "private" });

describe("Manus task adapter — createTask", () => {
  test("REQUEST SHAPE: POST v2/task.create with x-manus-api-key + message.content + force_skills", async () => {
    const { transport, calls } = fakeTransport({ status: 200, body: okBody });
    await createTask({ apiKey: "MANUS-KEY" }, transport, { text: "map the Casimir gap to the soft lane", forceSkills: ["mathematics-and-physics"], title: "Lumen summon" });
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://api.manus.ai/v2/task.create");
    expect(calls[0].headers["x-manus-api-key"]).toBe("MANUS-KEY");
    expect(calls[0].headers.Authorization).toBeUndefined(); // Manus uses x-manus-api-key, not Bearer
    const sent = JSON.parse(calls[0].body) as { message: { content: { type: string; text: string }[]; force_skills?: string[] }; agent_profile: string; title?: string };
    expect(sent.message.content[0]).toEqual({ type: "text", text: "map the Casimir gap to the soft lane" });
    expect(sent.message.force_skills).toEqual(["mathematics-and-physics"]); // Lumen's skill, forced
    expect(sent.agent_profile).toBe("manus-1.6");
    expect(sent.title).toBe("Lumen summon");
  });

  test("RESPONSE PARSE: a documented 200 yields the task id/url/title", async () => {
    const { transport } = fakeTransport({ status: 200, body: okBody });
    const out = await createTask({ apiKey: "k" }, transport, { text: "hi" });
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.task.taskId).toBe("task_abc");
      expect(out.task.taskUrl).toBe("https://manus.im/app/task_abc");
      expect(out.task.taskTitle).toBe("Casimir↔soft-lane");
    }
  });

  test("NON-200 → clean error (never throws)", async () => {
    const { transport } = fakeTransport({ status: 401, body: "invalid api key" });
    const out = await createTask({ apiKey: "bad" }, transport, { text: "hi" });
    expect(out).toEqual({ ok: false, error: "http 401: invalid api key" });
  });

  test("malformed body / missing task_id → clean error", async () => {
    const { transport: t1 } = fakeTransport({ status: 200, body: "not json{" });
    expect(await createTask({ apiKey: "k" }, t1, { text: "hi" })).toEqual({ ok: false, error: "malformed response: not JSON" });
    const { transport: t2 } = fakeTransport({ status: 200, body: JSON.stringify({ ok: true }) });
    expect(await createTask({ apiKey: "k" }, t2, { text: "hi" })).toEqual({ ok: false, error: "malformed response: no task_id" });
  });

  test("a transport throw → clean error (never throws upward)", async () => {
    const { transport } = fakeTransport(() => Promise.reject(new Error("dns failure")));
    const out = await createTask({ apiKey: "k" }, transport, { text: "hi" });
    expect(out).toEqual({ ok: false, error: "transport error: dns failure" });
  });
});

// The REAL listMessages response shape — captured live from task e8ZYTRDZGqhy6oYaGwy3mW (the smoke
// test; Manus actually replied "pong"). The docs page 404s, so this canned body IS the source of truth.
const liveMessagesBody = JSON.stringify({
  ok: true,
  has_more: false,
  task_id: "e8ZYTRDZGqhy6oYaGwy3mW",
  request_id: "r",
  messages: [
    { id: "a", type: "status_update", status_update: { agent_status: "stopped", brief: "Manus finished working", description: "done" }, timestamp: "3" },
    { id: "b", type: "assistant_message", assistant_message: { content: "pong" }, timestamp: "2" },
    { id: "c", type: "status_update", status_update: { agent_status: "running", brief: "Manus is running" }, timestamp: "1" },
    { id: "d", type: "user_message", user_message: { content: "…smoke test…", message_type: "text" }, timestamp: "0" },
  ],
});

describe("Manus task adapter — listMessages (result retrieval)", () => {
  test("REQUEST SHAPE: GET v2/task.listMessages?task_id with x-manus-api-key", async () => {
    const { transport, calls } = fakeTransport({ status: 200, body: liveMessagesBody });
    await listMessages({ apiKey: "K" }, transport, "task_abc");
    expect(calls[0].url).toBe("https://api.manus.ai/v2/task.listMessages?task_id=task_abc");
    expect(calls[0].headers["x-manus-api-key"]).toBe("K");
  });

  test("PARSES the live shape; latestAssistantContent = the agent answer; isComplete = true on 'stopped'", async () => {
    const { transport } = fakeTransport({ status: 200, body: liveMessagesBody });
    const out = await listMessages({ apiKey: "k" }, transport, "t");
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(latestAssistantContent(out.data.messages)).toBe("pong"); // the real round-trip answer
      expect(isComplete(out.data.messages)).toBe(true); // 'stopped' → done
    }
  });

  test("isComplete is false while only 'running'; no answer yet → null", () => {
    const running = [
      { type: "status_update", status_update: { agent_status: "running" } },
      { type: "user_message", user_message: { content: "hi" } },
    ];
    expect(isComplete(running)).toBe(false);
    expect(latestAssistantContent(running)).toBeNull();
  });

  test("non-200 / missing messages → clean error (never throws)", async () => {
    const { transport: t1 } = fakeTransport({ status: 404, body: "nope" });
    expect(await listMessages({ apiKey: "k" }, t1, "t")).toEqual({ ok: false, error: "http 404: nope" });
    const { transport: t2 } = fakeTransport({ status: 200, body: JSON.stringify({ ok: true }) });
    expect(await listMessages({ apiKey: "k" }, t2, "t")).toEqual({ ok: false, error: "malformed response: no messages array" });
  });
});
