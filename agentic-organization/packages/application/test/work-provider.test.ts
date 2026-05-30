import { equal, ok, deepEqual } from "node:assert/strict";
import { test } from "node:test";

import {
  WorkProviderKind,
  WorkProviderFamily,
  ProviderActionKind,
  GenericDecision,
  providerFamily,
  actionsForFamily,
  providerSupportsAction,
} from "../../domain/src/index.ts";
import { resolveWorkProvider, asChangeControlPort, type WorkProviderConfig } from "../src/index.ts";

const NOW = () => Date.parse("2026-05-30T00:00:00Z");

// ── the translation contract (pure) ──────────────────────────────────────────

test("GEN1: families + translation table — code-review merges, work-item transitions; neither crosses", () => {
  equal(providerFamily(WorkProviderKind.GitHub), WorkProviderFamily.CodeReview);
  equal(providerFamily(WorkProviderKind.GitLab), WorkProviderFamily.CodeReview);
  equal(providerFamily(WorkProviderKind.Jira), WorkProviderFamily.WorkItem);
  equal(providerFamily(WorkProviderKind.Linear), WorkProviderFamily.WorkItem);
  deepEqual([...actionsForFamily(WorkProviderFamily.CodeReview)], [ProviderActionKind.Comment, ProviderActionKind.Merge]);
  deepEqual([...actionsForFamily(WorkProviderFamily.WorkItem)], [ProviderActionKind.Comment, ProviderActionKind.Transition]);
  equal(providerSupportsAction(WorkProviderKind.GitHub, ProviderActionKind.Merge), true);
  equal(providerSupportsAction(WorkProviderKind.GitHub, ProviderActionKind.Transition), false);
  equal(providerSupportsAction(WorkProviderKind.Jira, ProviderActionKind.Transition), true);
  equal(providerSupportsAction(WorkProviderKind.Jira, ProviderActionKind.Merge), false);
});

// ── GitHub: the generic surface drives a real PR round-trip ───────────────────

function githubMock() {
  const calls: string[] = [];
  const state = { approved: false, merged: false };
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    calls.push(`${method} ${url.replace("https://api.github.com", "")}`);
    const json = (v: unknown, s = 200) => new Response(JSON.stringify(v), { status: s, headers: { "content-type": "application/json" } });
    if (url.endsWith("/git/ref/heads/main")) return json({ object: { sha: "base-sha" } });
    if (url.endsWith("/git/refs") && method === "POST") return json({}, 201);
    if (url.includes("/contents/") && method === "PUT") return json({}, 201);
    if (url.endsWith("/pulls") && method === "POST") return json({ number: 7, html_url: "https://github.com/o/r/pull/7" }, 201);
    if (url.endsWith("/pulls/7") && method === "GET") return json({ merged: state.merged });
    if (url.endsWith("/pulls/7/reviews")) return json(state.approved ? [{ state: "APPROVED" }] : []);
    if (url.endsWith("/issues/7/comments")) return json({}, 201);
    if (url.endsWith("/pulls/7/merge") && method === "PUT") { state.merged = true; return json({}); }
    return new Response("nf", { status: 404 });
  }) as typeof fetch;
  return { fetchImpl, calls, state };
}

test("GEN2: GitHub provider — project a PR, pull pending→approved, comment, merge (one generic surface)", async () => {
  const gh = githubMock();
  const cfg: WorkProviderConfig = { kind: WorkProviderKind.GitHub, token: "ght", owner: "o", repo: "r" };
  const p = resolveWorkProvider(cfg, { nowMs: NOW, fetchImpl: gh.fetchImpl });
  equal(p.family, WorkProviderFamily.CodeReview);

  const ref = await p.project({ workId: "cs-1", title: "Add endpoint", body: "from the org", targetRef: "feat/x", files: [{ path: "src/a.ts", content: "x" }] });
  equal(ref.kind, WorkProviderKind.GitHub);
  equal(ref.externalId, "7");

  const before = await p.pull(ref);
  equal(before.decision, GenericDecision.Pending);
  equal(before.closed, false);

  gh.state.approved = true;
  const after = await p.pull(ref);
  equal(after.decision, GenericDecision.Approved);

  await p.advance(ref, { kind: ProviderActionKind.Comment, body: "stage ok" });
  await p.advance(ref, { kind: ProviderActionKind.Merge });
  const merged = await p.pull(ref);
  equal(merged.closed, true, "the generic Merge action translated to a real PR merge");
  ok(gh.calls.includes("PUT /repos/o/r/pulls/7/merge"));
});

test("GEN2: GitHub provider REJECTS a Transition — the translation guard surfaces the family mismatch", async () => {
  const gh = githubMock();
  const p = resolveWorkProvider({ kind: WorkProviderKind.GitHub, token: "t", owner: "o", repo: "r" }, { nowMs: NOW, fetchImpl: gh.fetchImpl });
  const ref = await p.project({ workId: "cs", title: "t", body: "b" });
  let threw = false;
  try { await p.advance(ref, { kind: ProviderActionKind.Transition, toStatus: "Done" }); } catch (e) { threw = true; ok(String(e instanceof Error ? e.message : e).includes("does not support action 'transition'")); }
  ok(threw, "a code-review provider cannot transition a status");
});

// ── GitLab: the SAME generic surface, a real MR round-trip ────────────────────

function gitlabMock() {
  const calls: string[] = [];
  const state = { approved: false, merged: false };
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    calls.push(`${method} ${url.replace("https://gitlab.com/api/v4", "")}`);
    const json = (v: unknown, s = 200) => new Response(JSON.stringify(v), { status: s, headers: { "content-type": "application/json" } });
    if (url.includes("/repository/branches") && method === "POST") return json({}, 201);
    if (url.includes("/repository/files/") && method === "POST") return json({}, 201);
    if (url.endsWith("/merge_requests") && method === "POST") return json({ iid: 9, web_url: "https://gitlab.com/g/p/-/merge_requests/9" }, 201);
    if (url.endsWith("/merge_requests/9") && method === "GET") return json({ state: state.merged ? "merged" : "opened" });
    if (url.endsWith("/merge_requests/9/approvals")) return json({ approved: state.approved });
    if (url.endsWith("/merge_requests/9/notes")) return json({}, 201);
    if (url.endsWith("/merge_requests/9/merge") && method === "PUT") { state.merged = true; return json({}); }
    return new Response("nf", { status: 404 });
  }) as typeof fetch;
  return { fetchImpl, calls, state };
}

test("GEN2: GitLab provider — same generic surface, a real MR project→approve→merge", async () => {
  const gl = gitlabMock();
  const p = resolveWorkProvider({ kind: WorkProviderKind.GitLab, token: "glt", projectId: "g/p" }, { nowMs: NOW, fetchImpl: gl.fetchImpl });
  equal(p.family, WorkProviderFamily.CodeReview);
  const ref = await p.project({ workId: "cs-2", title: "MR", body: "b", targetRef: "feat/y", files: [{ path: "a.ts", content: "z" }] });
  equal(ref.kind, WorkProviderKind.GitLab);
  equal(ref.externalId, "9");
  equal((await p.pull(ref)).decision, GenericDecision.Pending);
  gl.state.approved = true;
  equal((await p.pull(ref)).decision, GenericDecision.Approved);
  await p.advance(ref, { kind: ProviderActionKind.Merge });
  equal((await p.pull(ref)).closed, true);
  ok(gl.calls.includes("PUT /projects/g%2Fp/merge_requests/9/merge"), "the generic Merge translated to a GitLab MR merge");
  ok(gl.calls.every((c) => !c.includes("glt")), "the token is never in a URL");
});

test("GEN2: GitLab — a failed file-commit throws (no silent partial MR), a 409 branch is tolerated", async () => {
  // branch already exists (409) → tolerated; but the file commit 403s → must throw, not open an empty MR
  let mrCreated = false;
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.includes("/repository/branches") && method === "POST") return new Response("branch exists", { status: 409 });
    if (url.includes("/repository/files/") && method === "POST") return new Response("forbidden", { status: 403 });
    if (url.endsWith("/merge_requests") && method === "POST") { mrCreated = true; return new Response(JSON.stringify({ iid: 1, web_url: "x" }), { status: 201, headers: { "content-type": "application/json" } }); }
    return new Response("nf", { status: 404 });
  }) as typeof fetch;
  const p = resolveWorkProvider({ kind: WorkProviderKind.GitLab, token: "t", projectId: "g/p" }, { nowMs: NOW, fetchImpl });
  let threw = false;
  try { await p.project({ workId: "cs", title: "t", body: "b", targetRef: "feat/x", files: [{ path: "a.ts", content: "z" }] }); } catch (e) { threw = true; ok(String(e instanceof Error ? e.message : e).includes("commit-file failed")); }
  ok(threw, "a failed file-commit surfaces, never a silent partial");
  equal(mrCreated, false, "the MR is NOT opened when its files failed to commit");
});

// ── Jira: work-item family round-trip via the generic surface ─────────────────

function jiraMock() {
  const state = { status: "To Do", resolution: null as unknown };
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    const path = url.replace("https://acme.atlassian.net/rest/api/3", "");
    const json = (v: unknown, s = 200) => new Response(JSON.stringify(v), { status: s, headers: { "content-type": "application/json" } });
    if (method === "POST" && path === "/issue") return json({ key: "ENG-1", self: "x" }, 201);
    if (method === "GET" && path === "/issue/ENG-1") return json({ fields: { status: { name: state.status }, resolution: state.resolution } });
    if (method === "POST" && path === "/issue/ENG-1/transitions") { state.status = "Done"; state.resolution = { name: "Done" }; return new Response(null, { status: 204 }); }
    if (method === "POST" && path === "/issue/ENG-1/comment") return json({}, 201);
    return new Response("nf", { status: 404 });
  }) as typeof fetch;
  return { fetchImpl, state };
}

test("GEN2: Jira provider — generic project→pull→transition→comment over a card", async () => {
  const jira = jiraMock();
  const p = resolveWorkProvider({ kind: WorkProviderKind.Jira, token: "jt", baseUrl: "https://acme.atlassian.net/rest/api/3", projectKey: "ENG" }, { nowMs: NOW, fetchImpl: jira.fetchImpl });
  equal(p.family, WorkProviderFamily.WorkItem);
  const ref = await p.project({ workId: "w-1", title: "Task", body: "do it", cardType: "Task" });
  equal(ref.externalId, "ENG-1");
  const before = await p.pull(ref);
  equal(before.decision, GenericDecision.Pending);
  equal(before.status, "To Do");
  await p.advance(ref, { kind: ProviderActionKind.Comment, body: "org note" }); // real Jira comment
  await p.advance(ref, { kind: ProviderActionKind.Transition, toStatus: "Done" });
  const after = await p.pull(ref);
  equal(after.closed, true, "the generic Transition translated to a Jira transition");
  equal(after.decision, GenericDecision.Approved);
});

test("GEN2: Jira provider REJECTS a Merge — work-item providers do not merge", async () => {
  const jira = jiraMock();
  const p = resolveWorkProvider({ kind: WorkProviderKind.Jira, token: "t", baseUrl: "https://acme.atlassian.net/rest/api/3", projectKey: "ENG" }, { nowMs: NOW, fetchImpl: jira.fetchImpl });
  const ref = await p.project({ workId: "w", title: "t", body: "b" });
  let threw = false;
  try { await p.advance(ref, { kind: ProviderActionKind.Merge }); } catch (e) { threw = true; ok(String(e instanceof Error ? e.message : e).includes("does not support action 'merge'")); }
  ok(threw);
});

// ── Linear: GraphQL work-item family via the generic surface ──────────────────

function linearMock() {
  const state = { stateType: "unstarted", stateName: "Todo" };
  const fetchImpl = (async (_input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { query: string; variables: Record<string, unknown> };
    const q = body.query;
    const json = (data: unknown) => new Response(JSON.stringify({ data }), { status: 200, headers: { "content-type": "application/json" } });
    if (q.includes("issueCreate")) return json({ issueCreate: { issue: { id: "LIN-1", identifier: "ENG-1", url: "https://linear.app/x/issue/ENG-1" } } });
    if (q.includes("workflowStates")) return json({ workflowStates: { nodes: [{ id: "s-done", name: "Done" }, { id: "s-todo", name: "Todo" }] } });
    if (q.includes("issueUpdate")) { state.stateType = "completed"; state.stateName = "Done"; return json({ issueUpdate: { success: true } }); }
    if (q.includes("commentCreate")) return json({ commentCreate: { success: true } });
    if (q.includes("issue(")) return json({ issue: { state: { name: state.stateName, type: state.stateType } } });
    return new Response(JSON.stringify({ errors: [{ message: "unknown op" }] }), { status: 200 });
  }) as typeof fetch;
  return { fetchImpl, state };
}

test("GEN2: Linear provider — GraphQL project→pull→transition over the SAME generic surface", async () => {
  const linear = linearMock();
  const p = resolveWorkProvider({ kind: WorkProviderKind.Linear, token: "lin_t", teamId: "team-1" }, { nowMs: NOW, fetchImpl: linear.fetchImpl });
  equal(p.family, WorkProviderFamily.WorkItem);
  const ref = await p.project({ workId: "w-2", title: "Issue", body: "desc" });
  equal(ref.kind, WorkProviderKind.Linear);
  equal(ref.externalId, "LIN-1");
  equal((await p.pull(ref)).decision, GenericDecision.Pending);
  await p.advance(ref, { kind: ProviderActionKind.Transition, toStatus: "Done" }); // resolves state by name → issueUpdate
  const after = await p.pull(ref);
  equal(after.closed, true, "Linear's completed state maps to closed");
  equal(after.decision, GenericDecision.Approved);
});

// ── asChangeControlPort: a generic code-review provider drives the kernel port ─

test("GEN2: asChangeControlPort adapts a code-review provider to the kernel's ChangeControlPort", async () => {
  const gh = githubMock();
  const provider = resolveWorkProvider({ kind: WorkProviderKind.GitHub, token: "t", owner: "o", repo: "r" }, { nowMs: NOW, fetchImpl: gh.fetchImpl });
  const ccPort = asChangeControlPort(provider);
  equal(ccPort.system, "github");
  // the adapter reads only changeSetId/workItemId/title/targetRef/artifacts; a partial is fine through unknown
  const cs = { changeSetId: "cs-9", workItemId: "w-9", title: "Change", targetRef: "feat/z", pipelineId: "internal-only", phase: "review", artifacts: [{ kind: "code_diff", path: "src/x.ts", diff: "+1" }] } as unknown as Parameters<typeof ccPort.project>[0];
  const stage = { id: "external-code-review" } as Parameters<typeof ccPort.push>[1];
  const ref = await ccPort.project(cs, stage);
  equal(ref.system, "github");
  equal(ref.externalId, "7");
  equal((await ccPort.pull(ref)).decision, "pending");
  gh.state.approved = true;
  equal((await ccPort.pull(ref)).decision, "approved");
  await ccPort.push(ref, stage, "approved" as Parameters<typeof ccPort.push>[2]);
  await ccPort.merge(ref);
  ok(gh.calls.includes("PUT /repos/o/r/pulls/7/merge"), "merge flowed through the generic provider");
});

test("GEN2: asChangeControlPort REFUSES a work-item provider (cards are not PRs)", () => {
  const jira = jiraMock();
  const provider = resolveWorkProvider({ kind: WorkProviderKind.Jira, token: "t", baseUrl: "https://acme.atlassian.net/rest/api/3", projectKey: "ENG" }, { nowMs: NOW, fetchImpl: jira.fetchImpl });
  let threw = false;
  try { asChangeControlPort(provider); } catch (e) { threw = true; ok(String(e instanceof Error ? e.message : e).includes("only code_review providers")); }
  ok(threw);
});
