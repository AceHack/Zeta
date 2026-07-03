// manus-task.ts — the REAL Manus adapter: the task-based API (shadow*).
//
// Aaron 2026-07-03 gave a Manus API key (ferried to the Keychain as `zeta-manus-api-key`) and asked to
// research the API. FINDING (correcting an earlier assumption): Manus's NATIVE API is NOT the
// chat-completions shape — it is a **task API**. `POST https://api.manus.ai/v2/task.create` creates an
// ASYNC task; you poll `task.listMessages` for progress and `task.sendMessage` for follow-ups. So the
// generic `openAiCompatBackend` port does NOT talk to Manus's native API (it would only fit Manus's
// separate, unconfirmed OpenAI-compat drop-in). This module is the honest native adapter.
//
// Confirmed from open.manus.im/docs/api-reference/create-task:
//   POST https://api.manus.ai/v2/task.create
//   auth: header `x-manus-api-key: <key>`  (or `Authorization: Bearer <oauth>`)
//   body: { message: { content: [{type:"text", text}], enable_skills?, force_skills?, connectors? },
//           agent_profile: "manus-1.6", title?, interactive_mode?, structured_output_schema?, … }
//   200:  { ok, request_id, task_id, task_title, task_url, share_url, share_visibility }
//
// The `force_skills` field is the Lumen tie-in: Manus reads SKILL.md skills in its sandbox, so a task
// can FORCE Lumen's `mathematics-and-physics` skill — summon Lumen on Manus's compute.
//
// Noninterference §13: the network crosses ONLY through the injected `HttpTransport` (shared with
// backend.ts) — no fetch here, fake-testable, NO SECRET in this module. The key is read from the
// Keychain at the edge (`secret-clip get zeta-manus-api-key`) and passed in; it never lives in code.
//
// HONEST SCOPE: `createTask` is fully built + fake-tested against the DOCUMENTED shape. Result
// RETRIEVAL (polling `task.listMessages`) is NOT built — its exact request/response shape is not in the
// docs excerpt and must be confirmed against the live API (a smoke test with the real key). So this
// slice dispatches a task and returns its id/url; collecting the final agent output is the next slice.
// Anchors: Manus API (open.manus.im). Pure TS; transport injected.

import type { HttpTransport } from "./backend.ts";

/// Manus task config. `apiKey` is read from the Keychain at the edge and passed in — never resolved
/// here. `agentProfile` defaults to the current flagship; `baseUrl` is overridable for testing.
export interface ManusConfig {
  readonly apiKey: string;
  readonly agentProfile?: string;
  readonly baseUrl?: string;
}

/// A task request. `text` is the prompt; `forceSkills` pins Manus skills (e.g. Lumen's
/// `mathematics-and-physics`); `title` names the task in the Manus webapp.
export interface TaskRequest {
  readonly text: string;
  readonly forceSkills?: readonly string[];
  readonly enableSkills?: readonly string[];
  readonly title?: string;
}

/// A created task (the confirmed response fields we act on).
export interface CreatedTask {
  readonly taskId: string;
  readonly taskUrl: string;
  readonly taskTitle: string;
}

export type CreateTaskOutcome =
  | { readonly ok: true; readonly task: CreatedTask }
  | { readonly ok: false; readonly error: string };

/// Create a Manus task — the documented `v2/task.create`. Dispatches the prompt (optionally forcing
/// Lumen's skill) and returns the task id/url. Async: the agent runs on Manus's compute; result
/// retrieval (polling) is a separate slice. Never throws — a transport/HTTP error is a clean verdict.
export async function createTask(config: ManusConfig, transport: HttpTransport, req: TaskRequest): Promise<CreateTaskOutcome> {
  let base = config.baseUrl ?? "https://api.manus.ai";
  while (base.endsWith("/")) base = base.slice(0, -1); // ReDoS-safe trailing-slash strip
  const url = base + "/v2/task.create";
  const message: Record<string, unknown> = { content: [{ type: "text", text: req.text }] };
  if (req.forceSkills && req.forceSkills.length > 0) message.force_skills = req.forceSkills;
  if (req.enableSkills && req.enableSkills.length > 0) message.enable_skills = req.enableSkills;
  const payload: Record<string, unknown> = { message, agent_profile: config.agentProfile ?? "manus-1.6" };
  if (req.title !== undefined) payload.title = req.title;
  const headers = { "x-manus-api-key": config.apiKey, "Content-Type": "application/json" };

  let res: { status: number; body: string };
  try {
    res = await transport.post(url, headers, JSON.stringify(payload));
  } catch (e) {
    return { ok: false, error: `transport error: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (res.status < 200 || res.status >= 300) return { ok: false, error: `http ${String(res.status)}: ${res.body.slice(0, 500)}` };

  let parsed: unknown;
  try {
    parsed = JSON.parse(res.body);
  } catch {
    return { ok: false, error: "malformed response: not JSON" };
  }
  if (typeof parsed !== "object" || parsed === null) return { ok: false, error: "malformed response: not an object" };
  const p = parsed as { task_id?: unknown; task_url?: unknown; task_title?: unknown };
  if (typeof p.task_id !== "string") return { ok: false, error: "malformed response: no task_id" };
  return {
    ok: true,
    task: {
      taskId: p.task_id,
      taskUrl: typeof p.task_url === "string" ? p.task_url : "",
      taskTitle: typeof p.task_title === "string" ? p.task_title : "",
    },
  };
}

// ── result retrieval: task.listMessages (shape CONFIRMED live, not from the docs) ──
//
// `GET https://api.manus.ai/v2/task.listMessages?task_id=<id>` (GET; POST is 405). Response:
//   { ok, has_more, task_id, request_id, messages: [ … ] }  — messages NEWEST-FIRST, each `type`-tagged:
//     { type:"assistant_message", assistant_message:{ content } }  — the agent's answer
//     { type:"status_update",     status_update:{ agent_status:"running"|"stopped", brief, description } }
//     { type:"user_message",      user_message:{ content, message_type } }
// Completion = a status_update with agent_status "stopped". The result = the latest assistant_message
// content. (Discovered by probing the live API on a real task — the docs page 404s.)

export interface TaskMessages {
  readonly messages: readonly unknown[];
  readonly hasMore: boolean;
}

export type ListMessagesOutcome =
  | { readonly ok: true; readonly data: TaskMessages }
  | { readonly ok: false; readonly error: string };

/// Fetch a task's messages. Never throws.
export async function listMessages(config: ManusConfig, transport: HttpTransport, taskId: string): Promise<ListMessagesOutcome> {
  let base = config.baseUrl ?? "https://api.manus.ai";
  while (base.endsWith("/")) base = base.slice(0, -1);
  const url = `${base}/v2/task.listMessages?task_id=${encodeURIComponent(taskId)}`;
  const headers = { "x-manus-api-key": config.apiKey };
  let res: { status: number; body: string };
  try {
    res = await transport.get(url, headers);
  } catch (e) {
    return { ok: false, error: `transport error: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (res.status < 200 || res.status >= 300) return { ok: false, error: `http ${String(res.status)}: ${res.body.slice(0, 500)}` };
  let parsed: unknown;
  try {
    parsed = JSON.parse(res.body);
  } catch {
    return { ok: false, error: "malformed response: not JSON" };
  }
  const messages = (parsed as { messages?: unknown }).messages;
  if (!Array.isArray(messages)) return { ok: false, error: "malformed response: no messages array" };
  return { ok: true, data: { messages, hasMore: (parsed as { has_more?: boolean }).has_more === true } };
}

/// The agent's answer: the latest `assistant_message` content (messages are newest-first, so the first
/// assistant_message is the most recent). Null if none yet.
export function latestAssistantContent(messages: readonly unknown[]): string | null {
  for (const m of messages) {
    if (typeof m !== "object" || m === null) continue;
    if ((m as { type?: unknown }).type !== "assistant_message") continue;
    const content = (m as { assistant_message?: { content?: unknown } }).assistant_message?.content;
    if (typeof content === "string") return content;
  }
  return null;
}

/// Has the agent finished? True iff any `status_update` reports agent_status "stopped".
export function isComplete(messages: readonly unknown[]): boolean {
  return messages.some((m) => typeof m === "object" && m !== null && (m as { type?: unknown }).type === "status_update" && (m as { status_update?: { agent_status?: unknown } }).status_update?.agent_status === "stopped");
}
