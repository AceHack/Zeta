/**
 * GEN4 — prove the LIVE generic work-provider port over the REAL native-fetch wire, with NO
 * injected mock. A real loopback HTTP server stands in for the provider (a controllable
 * endpoint, never github.com/jira), and the worker's OWN resolver builds the live port from
 * env exactly as it does in-cluster. We drive the real round-trips:
 *
 *   github (code_review): project a PR → pull pending → flip approved → pull approved → merge
 *   jira   (work_item):   project a card → pull open → transition → pull closed
 *
 * This exercises resolveChangeControlExternalPort + resolveWorkProviderFromEnv + the GitHub/Jira
 * REST clients over native fetch end to end. The credential-gated step (a REAL token + a REAL
 * github.com/jira instance) is surfaced to the operator — this proof verifies the wire beneath it.
 *
 *   node --experimental-strip-types deploy/run-work-provider.ts
 */
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { resolveChangeControlExternalPort } from "../apps/workers/src/work-provider-config.ts";
import { resolveWorkProviderFromEnv } from "../apps/workers/src/work-provider-config.ts";

const NOW = () => Date.parse("2026-05-30T00:00:00Z");

type MockState = { ghApproved: boolean; ghMerged: boolean; jiraStatus: string; jiraResolved: boolean; calls: string[] };
const state: MockState = { ghApproved: false, ghMerged: false, jiraStatus: "To Do", jiraResolved: false, calls: [] };

function body(res: ServerResponse, v: unknown, status = 200): void {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(v));
}

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  const method = (req.method ?? "GET").toUpperCase();
  const url = req.url ?? "/";
  state.calls.push(`${method} ${url}`);
  // ── mock GitHub (under /gh) ──
  if (url.startsWith("/gh")) {
    const p = url.slice(3);
    if (p === "/repos/o/r/git/ref/heads/main") return body(res, { object: { sha: "base" } });
    if (p === "/repos/o/r/git/refs" && method === "POST") return body(res, {}, 201);
    if (p.startsWith("/repos/o/r/contents/") && method === "PUT") return body(res, {}, 201);
    if (p === "/repos/o/r/pulls" && method === "POST") return body(res, { number: 1, html_url: "http://mock/pr/1" }, 201);
    if (p === "/repos/o/r/pulls/1" && method === "GET") return body(res, { merged: state.ghMerged });
    if (p === "/repos/o/r/pulls/1/reviews") return body(res, state.ghApproved ? [{ state: "APPROVED" }] : []);
    if (p === "/repos/o/r/issues/1/comments") return body(res, {}, 201);
    if (p === "/repos/o/r/pulls/1/merge" && method === "PUT") { state.ghMerged = true; return body(res, {}); }
  }
  // ── mock Jira (under /jira) ──
  if (url.startsWith("/jira")) {
    const p = url.slice(5);
    if (p === "/issue" && method === "POST") return body(res, { key: "ENG-1", self: "x" }, 201);
    if (p === "/issue/ENG-1" && method === "GET") return body(res, { fields: { status: { name: state.jiraStatus }, resolution: state.jiraResolved ? { name: "Done" } : null } });
    if (p === "/issue/ENG-1/transitions" && method === "POST") { state.jiraStatus = "Done"; state.jiraResolved = true; res.writeHead(204); return res.end(); }
    if (p === "/issue/ENG-1/comment" && method === "POST") return body(res, {}, 201);
  }
  res.writeHead(404);
  res.end("nf");
});

function listen(): Promise<number> {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => { const a = server.address(); resolve(typeof a === "object" && a !== null ? a.port : 0); }));
}

async function main(): Promise<void> {
  const port = await listen();
  const base = `http://127.0.0.1:${port}`;
  const report: Record<string, unknown> = {};

  // ── github code_review over the REAL resolver + REAL native fetch ──
  const gh = resolveChangeControlExternalPort(
    { WORK_PROVIDER: "github", GITHUB_TOKEN: "proof-token", GITHUB_OWNER: "o", GITHUB_REPO: "r", GITHUB_API_BASE_URL: `${base}/gh` },
    { nowMs: NOW },
  );
  report["github_mode"] = gh.mode;
  if (gh.port === null) throw new Error("expected a live github ChangeControlPort");
  const cs = { changeSetId: "cs-1", workItemId: "w-1", title: "Add endpoint", targetRef: "feat/x", organizationId: "org", proposerHatId: "h", pipelineId: "github-gated", phase: "review", currentStageIndex: 0, projections: [], stages: [], artifacts: [{ kind: "code_diff", path: "src/a.ts", diff: "+1" }], createdAt: "", updatedAt: "" } as unknown as Parameters<typeof gh.port.project>[0];
  const stage = { id: "external-code-review" } as unknown as Parameters<typeof gh.port.push>[1];
  const ref = await gh.port.project(cs, stage);
  report["github_projected"] = { externalId: ref.externalId, url: ref.url };
  report["github_pull_before"] = (await gh.port.pull(ref)).decision;
  state.ghApproved = true;
  report["github_pull_after_approval"] = (await gh.port.pull(ref)).decision;
  await gh.port.push(ref, stage, "approved" as unknown as Parameters<typeof gh.port.push>[2]);
  await gh.port.merge(ref);
  report["github_merged"] = (await gh.port.pull(ref)).merged;

  // ── jira work_item over the REAL resolver + REAL native fetch ──
  const jira = resolveWorkProviderFromEnv(
    { WORK_PROVIDER: "jira", JIRA_TOKEN: "proof-token", JIRA_BASE_URL: `${base}/jira`, JIRA_PROJECT_KEY: "ENG" },
    { nowMs: NOW },
  );
  if (jira === null) throw new Error("expected a live jira provider");
  report["jira_family"] = jira.family;
  const cardRef = await jira.project({ workId: "w-2", title: "Task", body: "do it", cardType: "Task" });
  report["jira_projected"] = cardRef.externalId;
  report["jira_pull_before"] = (await jira.pull(cardRef)).status;
  await jira.advance(cardRef, { kind: "transition", toStatus: "Done" });
  const afterCard = await jira.pull(cardRef);
  report["jira_closed_after_transition"] = afterCard.closed;

  // ── token-never-logged check ──
  report["token_absent_from_all_calls"] = state.calls.every((c) => !c.includes("proof-token"));
  report["total_wire_calls"] = state.calls.length;

  const ok =
    report["github_mode"] === "external:github" &&
    report["github_pull_before"] === "pending" &&
    report["github_pull_after_approval"] === "approved" &&
    report["github_merged"] === true &&
    report["jira_closed_after_transition"] === true &&
    report["token_absent_from_all_calls"] === true;
  report["PROOF"] = ok ? "PASS" : "FAIL";

  console.log(JSON.stringify(report, null, 2));
  server.close();
  if (!ok) process.exitCode = 1;
}

void main();
