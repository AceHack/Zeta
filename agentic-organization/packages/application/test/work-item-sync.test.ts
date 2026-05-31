import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { createCardHttpClient, createCardSyncPort } from "../src/index.ts";

const BASE = "https://acme.atlassian.net/rest/api/3";
const TOKEN = "jira_test_token";

/** A mock Jira the real client talks to over a fetch-shaped contract. */
function mockJira() {
  const calls: { method: string; path: string; auth: string | null }[] = [];
  const state = { status: "To Do", resolution: null as unknown };
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    const path = url.replace(BASE, "");
    calls.push({ method, path, auth: (init?.headers as Record<string, string> | undefined)?.["authorization"] ?? null });
    const json = (v: unknown, s = 200) => new Response(JSON.stringify(v), { status: s, headers: { "content-type": "application/json" } });
    if (method === "POST" && path === "/issue") return json({ key: "ENG-42", self: `${BASE}/issue/ENG-42` }, 201);
    if (method === "GET" && path === "/issue/ENG-42") return json({ fields: { status: { name: state.status }, resolution: state.resolution } });
    if (method === "POST" && path === "/issue/ENG-42/transitions") { state.status = "Done"; state.resolution = { name: "Done" }; return new Response(null, { status: 204 }); }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;
  return { fetchImpl, calls, state };
}

test("C3: a work item projects to a real Jira card, polls status, and pushes a transition (same port shape as CC)", async () => {
  const jira = mockJira();
  const client = createCardHttpClient({ baseUrl: BASE, token: TOKEN, projectKey: "ENG", fetchImpl: jira.fetchImpl });
  const port = createCardSyncPort({ system: "jira", client, nowMs: () => Date.parse("2026-05-30T00:00:00Z") });

  // project: work item → real card
  const ref = await port.project({ workItemId: "w-1", title: "Add charges endpoint", description: "from the org backlog", type: "Task" });
  equal(ref.system, "jira");
  equal(ref.cardKey, "ENG-42");
  ok(ref.url.includes("ENG-42"));
  ok(jira.calls.every((c) => c.auth === `Bearer ${TOKEN}`), "every REST call is authenticated");

  // pull: the card is open
  const before = await port.pull(ref);
  equal(before.externalStatus, "To Do");
  equal(before.closed, false);

  // push a transition → the card closes
  await port.push(ref, "Done");
  const after = await port.pull(ref);
  equal(after.externalStatus, "Done");
  equal(after.closed, true, "the bidirectional sync moved the external card");
});

test("C3: a 5xx from the card system throws (never a silent partial sync)", async () => {
  const client = createCardHttpClient({ baseUrl: BASE, token: TOKEN, projectKey: "ENG", fetchImpl: (async () => new Response("boom", { status: 500 })) as typeof fetch });
  const port = createCardSyncPort({ system: "jira", client, nowMs: () => 0 });
  let threw = false;
  try { await port.project({ workItemId: "w", title: "t", description: "d", type: "Task" }); } catch (e) { threw = true; ok(String(e instanceof Error ? e.message : e).includes("card-sync")); }
  ok(threw);
});

test("C3: a FAILED transition (4xx — e.g. bad transition name) throws, so push() never reports a desync as success", async () => {
  // regression: transition returns 204 on success but a non-2xx (400 invalid transition, 403, 5xx)
  // must throw — else the card silently desyncs from the canonical work item.
  const client = createCardHttpClient({
    baseUrl: BASE, token: TOKEN, projectKey: "ENG",
    fetchImpl: (async (input: string | URL | Request): Promise<Response> => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith("/transitions")) return new Response("no such transition", { status: 400 });
      return new Response(JSON.stringify({ key: "ENG-9", self: `${BASE}/issue/ENG-9` }), { status: 201, headers: { "content-type": "application/json" } });
    }) as typeof fetch,
  });
  const port = createCardSyncPort({ system: "jira", client, nowMs: () => 0 });
  const ref = await port.project({ workItemId: "w", title: "t", description: "d", type: "Task" });
  let threw = false;
  try { await port.push(ref, "Done"); } catch (e) { threw = true; ok(String(e instanceof Error ? e.message : e).includes("card-sync transition failed")); }
  ok(threw, "a failed transition surfaces as an error, not a false success");
});
