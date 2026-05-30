import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { ExternalSystem, type ChangeSet, type ReviewStage } from "../../domain/src/index.ts";
import {
  ExternalDecision,
  createGitHubPrPort,
  gitHubFilesFor,
  createJiraCardPort,
  type GitHubClient,
  type GitHubPullRequestState,
  type JiraClient,
} from "../src/index.ts";

function changeSet(over: Partial<ChangeSet> = {}): ChangeSet {
  return {
    changeSetId: "cs-1", organizationId: "org-lfg", workItemId: "JIRA-42", proposerHatId: "h",
    title: "Add coupon flow", targetRef: "feat/coupon", phase: "in_review", pipelineId: "pl", currentStageIndex: 0,
    artifacts: [
      { kind: "code_diff", path: "src/coupon.ts", diff: "export const c = 1;", language: "ts" },
      { kind: "doc_change", path: "docs/coupon.md", before: "old", after: "new" },
      { kind: "schema_migration", migrationId: "m1", sql: "CREATE TABLE coupons (…);" }, // NOT git-representable
    ],
    projections: [], revision: 1, openedAt: "2026-05-30T00:00:00Z", updatedAt: "2026-05-30T00:00:00Z", ...over,
  };
}
const extStage: ReviewStage = { id: "external", ownerLabel: "x", authority: { kind: "external", system: ExternalSystem.GitHub }, gate: "external_approved", blocking: true };

// ── GitHub ───────────────────────────────────────────────────────────────────

function fakeGitHub(): { client: GitHubClient; created: { files: number; body: string }[]; comments: string[]; merged: number[]; state: GitHubPullRequestState } {
  const created: { files: number; body: string }[] = [];
  const comments: string[] = [];
  const merged: number[] = [];
  const state: GitHubPullRequestState = { number: 128, reviewDecision: "REVIEW_REQUIRED", merged: false };
  const client: GitHubClient = {
    async createPullRequest(args) { created.push({ files: args.files.length, body: args.body }); return { number: 128, url: "https://github.test/pr/128" }; },
    async getPullRequest() { return state; },
    async comment(_n, body) { comments.push(body); },
    async merge(n) { merged.push(n); state.merged = true; },
  };
  return { client, created, comments, merged, state };
}

test("gitHubFilesFor renders ONLY git-representable artifacts (schema migration excluded)", () => {
  const files = gitHubFilesFor(changeSet());
  equal(files.length, 2); // code_diff + doc_change; schema_migration stays internal
  deepEqual(files.map((f) => f.path).sort(), ["docs/coupon.md", "src/coupon.ts"]);
});

test("GitHub port: project creates a PR carrying the git files; the schema migration is noted in the body", async () => {
  const f = fakeGitHub();
  const port = createGitHubPrPort({ client: f.client, nowMs: () => 1000 });
  const ref = await port.project(changeSet(), extStage);
  equal(ref.system, ExternalSystem.GitHub);
  equal(ref.externalId, "128");
  equal(f.created[0]!.files, 2);
  ok(f.created[0]!.body.includes("Internal-only artifacts"), "non-git artifacts referenced from the PR body");
});

test("GitHub port: pull maps PR review state INTO the kernel's ExternalDecision", async () => {
  const f = fakeGitHub();
  const port = createGitHubPrPort({ client: f.client, nowMs: () => 0 });
  const ref = await port.project(changeSet(), extStage);
  equal((await port.pull(ref)).decision, ExternalDecision.Pending);
  f.state.reviewDecision = "APPROVED"; // a human approves the PR
  equal((await port.pull(ref)).decision, ExternalDecision.Approved);
  f.state.reviewDecision = "CHANGES_REQUESTED";
  equal((await port.pull(ref)).decision, ExternalDecision.ChangesRequested);
});

test("GitHub port: push mirrors the internal decision as a PR comment; merge merges the PR", async () => {
  const f = fakeGitHub();
  const port = createGitHubPrPort({ client: f.client, nowMs: () => 0 });
  const ref = await port.project(changeSet(), extStage);
  await port.push(ref, extStage, "approve");
  ok(f.comments[0]!.includes("approve"));
  await port.merge(ref);
  deepEqual(f.merged, [128]);
});

// ── Jira ───────────────────────────────────────────────────────────────────

function fakeJira(): { client: JiraClient; status: { value: string }; transitions: string[]; comments: string[] } {
  const status = { value: "To Do" };
  const transitions: string[] = [];
  const comments: string[] = [];
  const client: JiraClient = {
    async transition(_k, name) { transitions.push(name); status.value = name; },
    async comment(_k, body) { comments.push(body); },
    async getStatus() { return status.value; },
  };
  return { client, status, transitions, comments };
}

const jiraStatus = { reviewStatus: "In Review", approvedStatus: "QA Approved", changesStatus: "In Progress", doneStatus: "Done" };

test("Jira port: project transitions the card to In Review + comments", async () => {
  const f = fakeJira();
  const port = createJiraCardPort({ client: f.client, statusMap: jiraStatus, issueKeyFor: (cs) => cs.workItemId, nowMs: () => 0 });
  const ref = await port.project(changeSet(), extStage);
  equal(ref.externalId, "JIRA-42");
  deepEqual(f.transitions, ["In Review"]);
  ok(f.comments.length === 1);
});

test("Jira port: pull maps the card status INTO an ExternalDecision; merge transitions to Done", async () => {
  const f = fakeJira();
  const port = createJiraCardPort({ client: f.client, statusMap: jiraStatus, issueKeyFor: (cs) => cs.workItemId, nowMs: () => 0 });
  const ref = await port.project(changeSet(), extStage);
  equal((await port.pull(ref)).decision, ExternalDecision.Pending); // "In Review"
  f.status.value = "QA Approved";
  equal((await port.pull(ref)).decision, ExternalDecision.Approved);
  await port.merge(ref);
  equal(f.status.value, "Done");
  ok((await port.pull(ref)).merged);
});
