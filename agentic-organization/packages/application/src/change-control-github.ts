/**
 * GitHub PR port (CC5) — projects ONE review stage of a canonical ChangeSet onto a
 * real GitHub pull request and reconciles the external review decision back IN. The
 * ChangeSet stays the source of truth; the PR is a view a human can use. Renders only
 * the Git-representable artifacts (code/doc/config) as files on a branch; schema
 * migrations / decision records / artifact refs stay internal, referenced from the
 * PR body.
 *
 * createGitHubHttpClient drives the live REST API over native fetch; the client is an
 * interface so tests inject a fake and the worker injects the real one (the same
 * compose-don't-fork seam as the Hindsight HTTP client).
 */

import {
  ExternalSystem,
  isGitRepresentable,
  type ChangeArtifact,
  type ChangeSet,
  type ProjectionRef,
  type ReviewStage,
  type StageOutcome,
} from "../../domain/src/index.ts";
import { ExternalDecision } from "./change-control-kernel.ts";
import type { ChangeControlPort, ExternalReviewState } from "./change-control-port.ts";

export type GitHubFileChange = { path: string; content: string };

export type GitHubPullRequestState = {
  number: number;
  reviewDecision: "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null;
  merged: boolean;
};

export type GitHubClient = {
  createPullRequest: (args: { title: string; head: string; base: string; body: string; files: readonly GitHubFileChange[] }) => Promise<{ number: number; url: string }>;
  getPullRequest: (number: number) => Promise<GitHubPullRequestState>;
  comment: (number: number, body: string) => Promise<void>;
  merge: (number: number) => Promise<void>;
};

// ── live REST client (native fetch) ─────────────────────────────────────────

export type CreateGitHubHttpClientInput = {
  baseUrl?: string; // default https://api.github.com
  token: string;
  owner: string;
  repo: string;
  baseBranch?: string; // default main
  fetchImpl?: typeof fetch;
};

/** UTF-8 → base64 without node Buffer (GitHub contents API requires base64). */
function toBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function createGitHubHttpClient(input: CreateGitHubHttpClientInput): GitHubClient {
  const doFetch = input.fetchImpl ?? fetch;
  const api = (input.baseUrl ?? "https://api.github.com").replace(/\/$/, "");
  const repo = `${api}/repos/${input.owner}/${input.repo}`;
  const baseBranch = input.baseBranch ?? "main";
  const headers = { authorization: `Bearer ${input.token}`, accept: "application/vnd.github+json", "content-type": "application/json" };

  async function ok<T>(res: Response, op: string): Promise<T> {
    if (!res.ok) throw new Error(`github ${op} failed: ${res.status} ${await res.text()}`);
    return (await res.json()) as T;
  }

  return {
    async createPullRequest(args): Promise<{ number: number; url: string }> {
      // base sha → branch → files → PR (real REST git-data flow)
      const baseRef = await ok<{ object: { sha: string } }>(await doFetch(`${repo}/git/ref/heads/${baseBranch}`, { headers }), "get-base-ref");
      await doFetch(`${repo}/git/refs`, { method: "POST", headers, body: JSON.stringify({ ref: `refs/heads/${args.head}`, sha: baseRef.object.sha }) });
      for (const f of args.files) {
        await doFetch(`${repo}/contents/${encodeURIComponent(f.path)}`, { method: "PUT", headers, body: JSON.stringify({ message: `change: ${f.path}`, content: toBase64(f.content), branch: args.head }) });
      }
      const pr = await ok<{ number: number; html_url: string }>(await doFetch(`${repo}/pulls`, { method: "POST", headers, body: JSON.stringify({ title: args.title, head: args.head, base: args.base, body: args.body }) }), "create-pr");
      return { number: pr.number, url: pr.html_url };
    },
    async getPullRequest(number): Promise<GitHubPullRequestState> {
      const pr = await ok<{ merged: boolean }>(await doFetch(`${repo}/pulls/${number}`, { headers }), "get-pr");
      const reviews = await ok<{ state: string }[]>(await doFetch(`${repo}/pulls/${number}/reviews`, { headers }), "get-reviews");
      const decision = reviews.some((r) => r.state === "CHANGES_REQUESTED")
        ? "CHANGES_REQUESTED"
        : reviews.some((r) => r.state === "APPROVED")
          ? "APPROVED"
          : "REVIEW_REQUIRED";
      return { number, reviewDecision: decision, merged: pr.merged };
    },
    async comment(number, body): Promise<void> {
      await doFetch(`${repo}/issues/${number}/comments`, { method: "POST", headers, body: JSON.stringify({ body }) });
    },
    async merge(number): Promise<void> {
      await doFetch(`${repo}/pulls/${number}/merge`, { method: "PUT", headers, body: JSON.stringify({ merge_method: "squash" }) });
    },
  };
}

// ── per-artifact rendering ───────────────────────────────────────────────────

function renderArtifact(a: ChangeArtifact): GitHubFileChange | null {
  switch (a.kind) {
    case "code_diff":
      return { path: a.path, content: a.diff };
    case "doc_change":
      return { path: a.path, content: a.after };
    case "config_change":
      return { path: `config/${a.key}`, content: a.after };
    default:
      return null; // not Git-representable
  }
}

export function gitHubFilesFor(cs: ChangeSet): readonly GitHubFileChange[] {
  const files: GitHubFileChange[] = [];
  for (const a of cs.artifacts) {
    if (!isGitRepresentable(a)) continue;
    const f = renderArtifact(a);
    if (f !== null) files.push(f);
  }
  return files;
}

function prBody(cs: ChangeSet): string {
  const internal = cs.artifacts.filter((a) => !isGitRepresentable(a));
  const internalNote = internal.length === 0 ? "" : `\n\n_Internal-only artifacts (review of record is the org's ChangeSet ${cs.changeSetId}):_\n` + internal.map((a) => `- ${a.kind}`).join("\n");
  return `Org ChangeSet ${cs.changeSetId} (work ${cs.workItemId}).${internalNote}`;
}

// ── the port ─────────────────────────────────────────────────────────────────

export function createGitHubPrPort(deps: { client: GitHubClient; nowMs: () => number }): ChangeControlPort {
  return {
    system: ExternalSystem.GitHub,
    async project(cs: ChangeSet): Promise<ProjectionRef> {
      const pr = await deps.client.createPullRequest({
        title: cs.title,
        head: cs.targetRef,
        base: "main",
        body: prBody(cs),
        files: gitHubFilesFor(cs),
      });
      return { system: ExternalSystem.GitHub, externalId: String(pr.number), url: pr.url, lastSyncedState: "open", syncedAt: new Date(deps.nowMs()).toISOString() };
    },
    async pull(ref: ProjectionRef): Promise<ExternalReviewState> {
      const pr = await deps.client.getPullRequest(Number(ref.externalId));
      const decision = pr.reviewDecision === "APPROVED" ? ExternalDecision.Approved : pr.reviewDecision === "CHANGES_REQUESTED" ? ExternalDecision.ChangesRequested : ExternalDecision.Pending;
      return { decision, merged: pr.merged, detail: `github PR #${pr.number} ${pr.reviewDecision ?? "pending"}` };
    },
    async push(ref: ProjectionRef, stage: ReviewStage, outcome: StageOutcome): Promise<void> {
      await deps.client.comment(Number(ref.externalId), `Org review stage \`${stage.id}\` → ${outcome}`);
    },
    async merge(ref: ProjectionRef): Promise<void> {
      await deps.client.merge(Number(ref.externalId));
    },
  };
}
