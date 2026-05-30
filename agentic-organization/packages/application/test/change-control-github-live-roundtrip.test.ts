/**
 * L1 — live GitHub PR round-trip, proven deterministically against a mock GitHub
 * REST router injected as `fetchImpl`. This exercises the REAL client+port code end
 * to end (the exact REST URLs, the Bearer auth header, the git-data branch+contents
 * flow, base64 content encoding, the reviews→decision mapping, and the squash merge)
 * — only the socket transport is mocked. The genuinely-external step (a real PR on
 * github.com approved by a real human) is the credential-gated L1-real proof.
 *
 * The mock models GitHub's state machine: a PR with no reviews reads as
 * REVIEW_REQUIRED → the port returns Pending; once an APPROVED review is injected
 * (the "human approves"), the port returns Approved; the merge PUT flips `merged`.
 */

import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { ExternalSystem, ReviewGateKind, type ChangeSet, type ReviewStage } from "../../domain/src/index.ts";
import { ExternalDecision, createGitHubHttpClient, createGitHubPrPort } from "../src/index.ts";

const EXTERNAL_STAGE: ReviewStage = {
  id: "external-code-review", ownerLabel: "code_reviewer",
  authority: { kind: "external", system: ExternalSystem.GitHub }, gate: ReviewGateKind.ExternalApproved,
  blocking: true, projectTo: ExternalSystem.GitHub,
};

const OWNER = "lucent";
const REPO = "agentic-org";
const TOKEN = "ghp_test_token";

/** A mock GitHub the real client talks to over a fetch-shaped contract. */
function mockGitHub() {
  const calls: { method: string; path: string; auth: string | null; body: unknown }[] = [];
  const state = { reviews: [] as { state: string }[], merged: false, prNumber: 4242 };
  const base = `https://api.github.com/repos/${OWNER}/${REPO}`;

  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    const path = url.replace(base, "");
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    const auth = (init?.headers as Record<string, string> | undefined)?.["authorization"] ?? null;
    calls.push({ method, path, auth, body });

    const json = (value: unknown, status = 200): Response => new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });

    if (method === "GET" && path === "/git/ref/heads/main") return json({ object: { sha: "base-sha-000" } });
    if (method === "POST" && path === "/git/refs") return json({ ref: body.ref }, 201);
    if (method === "PUT" && path.startsWith("/contents/")) return json({ commit: { sha: "file-sha" } }, 201);
    if (method === "POST" && path === "/pulls") return json({ number: state.prNumber, html_url: `https://github.com/${OWNER}/${REPO}/pull/${state.prNumber}` }, 201);
    if (method === "GET" && path === `/pulls/${state.prNumber}`) return json({ merged: state.merged });
    if (method === "GET" && path === `/pulls/${state.prNumber}/reviews`) return json(state.reviews);
    if (method === "POST" && path === `/issues/${state.prNumber}/comments`) return json({ id: 1 }, 201);
    if (method === "PUT" && path === `/pulls/${state.prNumber}/merge`) { state.merged = true; return json({ merged: true }); }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;

  return { fetchImpl, calls, approve: () => state.reviews.push({ state: "APPROVED" }), state };
}

function sampleChangeSet(): ChangeSet {
  return {
    changeSetId: "cs-live-1", organizationId: "org-lfg", workItemId: "work-1", proposerHatId: "code_author",
    title: "Add the thing", targetRef: "feat/the-thing", phase: "in_review", pipelineId: "github-gated",
    currentStageIndex: 0,
    artifacts: [
      { kind: "code_diff", path: "src/a.ts", diff: "export const a = 1;\n", language: "ts" },
      { kind: "schema_migration", migrationId: "0099", sql: "CREATE TABLE t (id INT)" }, // internal-only, NOT rendered to a file
    ],
    projections: [], revision: 2, openedAt: "2026-05-30T00:00:00Z", updatedAt: "2026-05-30T00:00:00Z",
  };
}

test("L1: real GitHub port projects → polls pending → (human approves) → polls approved → merges", async () => {
  const gh = mockGitHub();
  const client = createGitHubHttpClient({ token: TOKEN, owner: OWNER, repo: REPO, fetchImpl: gh.fetchImpl });
  const port = createGitHubPrPort({ client, nowMs: () => Date.parse("2026-05-30T00:00:00Z") });

  // project: opens a real PR (base ref → branch → contents → PR)
  const ref = await port.project(sampleChangeSet(), EXTERNAL_STAGE);
  equal(ref.system, ExternalSystem.GitHub);
  equal(ref.externalId, "4242");
  ok(ref.url.includes("/pull/4242"));

  // every call carried the Bearer token; only the Git-representable artifact became a file
  ok(gh.calls.every((c) => c.auth === `Bearer ${TOKEN}`), "all REST calls authenticated with the token");
  const contentsPuts = gh.calls.filter((c) => c.method === "PUT" && c.path.startsWith("/contents/"));
  equal(contentsPuts.length, 1, "only the code_diff is rendered to a file; the migration stays internal");
  equal(contentsPuts[0]!.path, "/contents/src%2Fa.ts");
  const created = gh.calls.find((c) => c.method === "POST" && c.path === "/pulls");
  ok(String((created!.body as { body: string }).body).includes("cs-live-1"), "PR body references the canonical ChangeSet");

  // poll BEFORE approval → Pending (no reviews yet)
  const before = await port.pull(ref);
  equal(before.decision, ExternalDecision.Pending);
  equal(before.merged, false);

  // a human approves on github.com
  gh.approve();

  // poll AFTER approval → Approved, then merge → merged
  const after = await port.pull(ref);
  equal(after.decision, ExternalDecision.Approved);

  await port.merge(ref);
  const merged = await port.pull(ref);
  equal(merged.merged, true);

  // the merge used squash
  const mergeCall = gh.calls.find((c) => c.method === "PUT" && c.path === `/pulls/4242/merge`);
  equal((mergeCall!.body as { merge_method: string }).merge_method, "squash");
});

test("L1: a failing REST call surfaces as a thrown error (not a silent pass)", async () => {
  const client = createGitHubHttpClient({
    token: TOKEN, owner: OWNER, repo: REPO,
    fetchImpl: (async () => new Response("boom", { status: 500 })) as typeof fetch,
  });
  const port = createGitHubPrPort({ client, nowMs: () => 0 });
  let threw = false;
  try {
    await port.project(sampleChangeSet(), EXTERNAL_STAGE);
  } catch (error) {
    threw = true;
    ok(String(error instanceof Error ? error.message : error).includes("github"));
  }
  ok(threw, "a 5xx from GitHub must throw, never silently succeed");
});
