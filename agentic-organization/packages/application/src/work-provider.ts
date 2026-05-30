/**
 * Generic work-provider adapters (GEN1/GEN2) — the org calls the provider-agnostic
 * WorkProviderPort (project / pull / advance); the CONFIGURED provider translates each
 * call into its concrete REST/GraphQL shape. One surface, four providers, one translation
 * table. Adding a provider is adding a client + a tiny adapter, never a new call site.
 *
 *   code_review family (GitHub PR, GitLab MR): a ReviewClient (the existing GitHubClient
 *     shape — createPullRequest/getPullRequest/comment/merge). GitLab's client implements
 *     the same interface against GitLab's API, so the adapter is shared.
 *   work_item family (Jira, Linear card): a CardClient (createCard/getCard/transition,
 *     optional comment). Linear's client implements it against Linear's GraphQL.
 *
 * resolveWorkProvider(config) builds the LIVE client (native fetch) + the adapter from a
 * discriminated config; the token is only ever a request header, never logged. The kernel
 * keeps its ChangeControlPort collaborator unchanged — asChangeControlPort adapts a
 * code_review provider to it (open/closed: the kernel doesn't learn about providers).
 */

import {
  ExternalSystem,
  WorkProviderKind,
  WorkProviderFamily,
  ProviderActionKind,
  GenericDecision,
  assertProviderSupports,
  type ChangeSet,
  type ProjectionRef,
  type ReviewStage,
  type StageOutcome,
  type ProviderAction,
  type GenericWorkProjection,
  type GenericRef,
  type GenericExternalState,
} from "../../domain/src/index.ts";
import { ExternalDecision } from "./change-control-kernel.ts";
import type { ChangeControlPort, ExternalReviewState } from "./change-control-port.ts";
import { createGitHubHttpClient, gitHubFilesFor, type GitHubClient } from "./change-control-github.ts";
import { createCardHttpClient, type CardClient } from "./work-item-sync.ts";

// ── the one generic surface ──────────────────────────────────────────────────

export interface WorkProviderPort {
  kind: WorkProviderKind;
  family: WorkProviderFamily;
  project: (work: GenericWorkProjection) => Promise<GenericRef>;
  pull: (ref: GenericRef) => Promise<GenericExternalState>;
  advance: (ref: GenericRef, action: ProviderAction) => Promise<void>;
}

/** A code-review client is structurally the existing GitHubClient (GitLab implements the same). */
export type ReviewClient = GitHubClient;

// ── code_review adapter (GitHub PR, GitLab MR) ───────────────────────────────

export function createCodeReviewWorkProvider(deps: { kind: WorkProviderKind; client: ReviewClient; nowMs: () => number }): WorkProviderPort {
  const { kind, client } = deps;
  return {
    kind,
    family: WorkProviderFamily.CodeReview,
    async project(work): Promise<GenericRef> {
      const pr = await client.createPullRequest({
        title: work.title,
        head: work.targetRef ?? work.workId,
        base: "main",
        body: work.body,
        files: work.files ?? [],
      });
      return { kind, externalId: String(pr.number), url: pr.url, syncedStatus: "open", syncedAt: new Date(deps.nowMs()).toISOString() };
    },
    async pull(ref): Promise<GenericExternalState> {
      const pr = await client.getPullRequest(Number(ref.externalId));
      const decision =
        pr.reviewDecision === "APPROVED" ? GenericDecision.Approved : pr.reviewDecision === "CHANGES_REQUESTED" ? GenericDecision.ChangesRequested : GenericDecision.Pending;
      return { decision, closed: pr.merged, status: pr.reviewDecision ?? "pending", detail: `${kind} #${pr.number} ${pr.reviewDecision ?? "pending"}${pr.merged ? " (merged)" : ""}` };
    },
    async advance(ref, action): Promise<void> {
      assertProviderSupports(kind, action.kind); // a code-review provider cannot Transition
      switch (action.kind) {
        case ProviderActionKind.Comment:
          await client.comment(Number(ref.externalId), action.body);
          return;
        case ProviderActionKind.Merge:
          await client.merge(Number(ref.externalId));
          return;
        case ProviderActionKind.Transition:
          return; // unreachable — assertProviderSupports throws first
      }
    },
  };
}

// ── work_item adapter (Jira, Linear card) ────────────────────────────────────

export function createWorkItemWorkProvider(deps: { kind: WorkProviderKind; client: CardClient; nowMs: () => number }): WorkProviderPort {
  const { kind, client } = deps;
  return {
    kind,
    family: WorkProviderFamily.WorkItem,
    async project(work): Promise<GenericRef> {
      const card = await client.createCard({ title: work.title, description: work.body, type: work.cardType ?? "Task" });
      return { kind, externalId: card.key, url: card.url, syncedStatus: "open", syncedAt: new Date(deps.nowMs()).toISOString() };
    },
    async pull(ref): Promise<GenericExternalState> {
      const card = await client.getCard(ref.externalId);
      // a card has no approve/changes axis — open is Pending, resolved/closed is "done" (Approved)
      return { decision: card.closed ? GenericDecision.Approved : GenericDecision.Pending, closed: card.closed, status: card.externalStatus, detail: `${kind} ${ref.externalId} ${card.externalStatus}${card.closed ? " (closed)" : ""}` };
    },
    async advance(ref, action): Promise<void> {
      assertProviderSupports(kind, action.kind); // a work-item provider cannot Merge
      switch (action.kind) {
        case ProviderActionKind.Transition:
          await client.transition(ref.externalId, action.toStatus);
          return;
        case ProviderActionKind.Comment:
          if (client.comment !== undefined) await client.comment(ref.externalId, action.body);
          return; // a client without a comment endpoint: the transition is the load-bearing sync
        case ProviderActionKind.Merge:
          return; // unreachable — assertProviderSupports throws first
      }
    },
  };
}

// ── GitLab MR client (REST v4) — implements the ReviewClient interface ────────

export type CreateGitLabHttpClientInput = {
  baseUrl?: string; // default https://gitlab.com/api/v4
  token: string;
  projectId: string; // url-encoded "group/project" or numeric id
  baseBranch?: string; // default main
  fetchImpl?: typeof fetch;
};

function toBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function createGitLabHttpClient(input: CreateGitLabHttpClientInput): ReviewClient {
  const doFetch = input.fetchImpl ?? fetch;
  const api = (input.baseUrl ?? "https://gitlab.com/api/v4").replace(/\/$/, "");
  const project = `${api}/projects/${encodeURIComponent(input.projectId)}`;
  const baseBranch = input.baseBranch ?? "main";
  const headers = { "private-token": input.token, "content-type": "application/json" }; // GitLab PAT header; never logged
  async function ok<T>(res: Response, op: string): Promise<T> {
    if (!res.ok) throw new Error(`gitlab ${op} failed: ${res.status} ${await res.text()}`);
    return (await res.json()) as T;
  }
  /** Throw on a non-2xx with no JSON to parse (branch-create / file-commit). Never swallow a partial. */
  async function okVoid(res: Response, op: string): Promise<void> {
    if (!res.ok) throw new Error(`gitlab ${op} failed: ${res.status} ${await res.text()}`);
  }
  return {
    async createPullRequest(args): Promise<{ number: number; url: string }> {
      // branch off base → commit files → open MR (the GitLab equivalent of the GitHub git-data flow).
      // Branch-create tolerates 409 (the branch already exists — idempotent re-projection); any other
      // non-2xx throws. File commits MUST succeed, else the MR would open against an empty/stale branch
      // and report success with no diff (a silent partial projection). The MR-create is already checked.
      const branchRes = await doFetch(`${project}/repository/branches?branch=${encodeURIComponent(args.head)}&ref=${encodeURIComponent(baseBranch)}`, { method: "POST", headers });
      if (!branchRes.ok && branchRes.status !== 409) throw new Error(`gitlab create-branch failed: ${branchRes.status} ${await branchRes.text()}`);
      for (const f of args.files) {
        await okVoid(await doFetch(`${project}/repository/files/${encodeURIComponent(f.path)}`, { method: "POST", headers, body: JSON.stringify({ branch: args.head, content: toBase64(f.content), encoding: "base64", commit_message: `change: ${f.path}` }) }), "commit-file");
      }
      const mr = await ok<{ iid: number; web_url: string }>(await doFetch(`${project}/merge_requests`, { method: "POST", headers, body: JSON.stringify({ source_branch: args.head, target_branch: args.base, title: args.title, description: args.body }) }), "create-mr");
      return { number: mr.iid, url: mr.web_url };
    },
    async getPullRequest(number): Promise<{ number: number; reviewDecision: "APPROVED" | "CHANGES_REQUESTED" | "REVIEW_REQUIRED" | null; merged: boolean }> {
      // GitLab's /approvals has no "changes requested" axis (unlike GitHub reviews), so a GitLab MR
      // surfaces only APPROVED or REVIEW_REQUIRED. This fails SAFE — an MR never reads as approved
      // until it actually is; a reviewer requesting changes reads as REVIEW_REQUIRED (→ Pending), so
      // the change-control gate stalls rather than mis-advancing. (An explicit-bounce signal would
      // require querying unresolved discussions / blocking_discussions_resolved.)
      const mr = await ok<{ state: string }>(await doFetch(`${project}/merge_requests/${number}`, { headers }), "get-mr");
      const approvals = await ok<{ approved: boolean }>(await doFetch(`${project}/merge_requests/${number}/approvals`, { headers }), "get-approvals");
      return { number, reviewDecision: approvals.approved ? "APPROVED" : "REVIEW_REQUIRED", merged: mr.state === "merged" };
    },
    async comment(number, body): Promise<void> {
      await doFetch(`${project}/merge_requests/${number}/notes`, { method: "POST", headers, body: JSON.stringify({ body }) });
    },
    async merge(number): Promise<void> {
      await doFetch(`${project}/merge_requests/${number}/merge`, { method: "PUT", headers, body: JSON.stringify({ squash: true }) });
    },
  };
}

// ── Linear card client (GraphQL) — implements the CardClient interface ────────

export type CreateLinearHttpClientInput = {
  baseUrl?: string; // default https://api.linear.app/graphql
  token: string;
  teamId: string;
  fetchImpl?: typeof fetch;
};

export function createLinearHttpClient(input: CreateLinearHttpClientInput): Required<CardClient> {
  const doFetch = input.fetchImpl ?? fetch;
  const api = (input.baseUrl ?? "https://api.linear.app/graphql").replace(/\/$/, "");
  const headers = { authorization: input.token, "content-type": "application/json" }; // Linear PAT: raw token, no Bearer; never logged
  async function gql<T>(query: string, variables: Record<string, unknown>, op: string): Promise<T> {
    const res = await doFetch(api, { method: "POST", headers, body: JSON.stringify({ query, variables }) });
    if (!res.ok) throw new Error(`linear ${op} failed: ${res.status} ${await res.text()}`);
    const body = (await res.json()) as { data?: T; errors?: { message: string }[] };
    if (body.errors !== undefined && body.errors.length > 0) throw new Error(`linear ${op} failed: ${body.errors.map((e) => e.message).join("; ")}`);
    return body.data as T;
  }
  return {
    async createCard(args): Promise<{ key: string; url: string }> {
      const d = await gql<{ issueCreate: { issue: { id: string; identifier: string; url: string } } }>(
        "mutation($title:String!,$description:String,$teamId:String!){issueCreate(input:{title:$title,description:$description,teamId:$teamId}){issue{id identifier url}}}",
        { title: args.title, description: args.description, teamId: input.teamId },
        "create-card",
      );
      return { key: d.issueCreate.issue.id, url: d.issueCreate.issue.url };
    },
    async getCard(key): Promise<{ externalStatus: string; closed: boolean }> {
      const d = await gql<{ issue: { state: { name: string; type: string } } }>("query($id:String!){issue(id:$id){state{name type}}}", { id: key }, "get-card");
      return { externalStatus: d.issue.state.name, closed: d.issue.state.type === "completed" || d.issue.state.type === "canceled" };
    },
    async transition(key, toStatus): Promise<void> {
      // resolve the target workflow state by name, then move the issue to it
      const states = await gql<{ workflowStates: { nodes: { id: string; name: string }[] } }>("query($teamId:ID){workflowStates(filter:{team:{id:{eq:$teamId}}}){nodes{id name}}}", { teamId: input.teamId }, "list-states");
      const target = states.workflowStates.nodes.find((s) => s.name.toLowerCase() === toStatus.toLowerCase());
      if (target === undefined) throw new Error(`linear transition failed: no workflow state named '${toStatus}'`);
      await gql<{ issueUpdate: { success: boolean } }>("mutation($id:String!,$stateId:String!){issueUpdate(id:$id,input:{stateId:$stateId}){success}}", { id: key, stateId: target.id }, "transition");
    },
    async comment(key, body): Promise<void> {
      await gql<{ commentCreate: { success: boolean } }>("mutation($issueId:String!,$body:String!){commentCreate(input:{issueId:$issueId,body:$body}){success}}", { issueId: key, body }, "comment");
    },
  };
}

// ── config-driven resolution ─────────────────────────────────────────────────

export type WorkProviderConfig =
  | { kind: typeof WorkProviderKind.GitHub; token: string; owner: string; repo: string; baseUrl?: string; baseBranch?: string }
  | { kind: typeof WorkProviderKind.GitLab; token: string; projectId: string; baseUrl?: string; baseBranch?: string }
  | { kind: typeof WorkProviderKind.Jira; token: string; baseUrl: string; projectKey: string }
  | { kind: typeof WorkProviderKind.Linear; token: string; teamId: string; baseUrl?: string };

/** Build the LIVE provider (native fetch by default; tests inject fetchImpl). The single seam config flows through. */
export function resolveWorkProvider(config: WorkProviderConfig, deps: { nowMs: () => number; fetchImpl?: typeof fetch }): WorkProviderPort {
  const fetchPart = deps.fetchImpl ? { fetchImpl: deps.fetchImpl } : {};
  switch (config.kind) {
    case WorkProviderKind.GitHub: {
      const client = createGitHubHttpClient({ token: config.token, owner: config.owner, repo: config.repo, ...(config.baseUrl !== undefined ? { baseUrl: config.baseUrl } : {}), ...(config.baseBranch !== undefined ? { baseBranch: config.baseBranch } : {}), ...fetchPart });
      return createCodeReviewWorkProvider({ kind: config.kind, client, nowMs: deps.nowMs });
    }
    case WorkProviderKind.GitLab: {
      const client = createGitLabHttpClient({ token: config.token, projectId: config.projectId, ...(config.baseUrl !== undefined ? { baseUrl: config.baseUrl } : {}), ...(config.baseBranch !== undefined ? { baseBranch: config.baseBranch } : {}), ...fetchPart });
      return createCodeReviewWorkProvider({ kind: config.kind, client, nowMs: deps.nowMs });
    }
    case WorkProviderKind.Jira: {
      const client = createCardHttpClient({ token: config.token, baseUrl: config.baseUrl, projectKey: config.projectKey, ...fetchPart });
      return createWorkItemWorkProvider({ kind: config.kind, client, nowMs: deps.nowMs });
    }
    case WorkProviderKind.Linear: {
      const client = createLinearHttpClient({ token: config.token, teamId: config.teamId, ...(config.baseUrl !== undefined ? { baseUrl: config.baseUrl } : {}), ...fetchPart });
      return createWorkItemWorkProvider({ kind: config.kind, client, nowMs: deps.nowMs });
    }
  }
}

// ── adapt a code_review provider to the kernel's ChangeControlPort (open/closed) ─

const KIND_TO_EXTERNAL_SYSTEM: Readonly<Record<typeof WorkProviderKind.GitHub | typeof WorkProviderKind.GitLab, ExternalSystem>> = {
  [WorkProviderKind.GitHub]: ExternalSystem.GitHub,
  [WorkProviderKind.GitLab]: ExternalSystem.GitLab,
};

function genericRefFromProjection(provider: WorkProviderPort, ref: ProjectionRef): GenericRef {
  return { kind: provider.kind, externalId: ref.externalId, url: ref.url, syncedStatus: ref.lastSyncedState, syncedAt: ref.syncedAt };
}

/**
 * Adapt a code_review WorkProvider to the kernel's ChangeControlPort so a configured
 * github/gitlab provider drives the change-control external stage WITHOUT the kernel
 * knowing providers exist. Work-item providers are not PRs — they are not adapted here.
 */
export function asChangeControlPort(provider: WorkProviderPort): ChangeControlPort {
  if (provider.family !== WorkProviderFamily.CodeReview) {
    throw new Error(`asChangeControlPort: only code_review providers are ChangeControlPorts (got ${provider.kind}/${provider.family})`);
  }
  const system = KIND_TO_EXTERNAL_SYSTEM[provider.kind as typeof WorkProviderKind.GitHub | typeof WorkProviderKind.GitLab];
  return {
    system,
    async project(cs: ChangeSet): Promise<ProjectionRef> {
      const ref = await provider.project({ workId: cs.changeSetId, title: cs.title, body: `Org ChangeSet ${cs.changeSetId} (work ${cs.workItemId}).`, targetRef: cs.targetRef, files: gitHubFilesFor(cs) });
      return { system, externalId: ref.externalId, url: ref.url, lastSyncedState: ref.syncedStatus, syncedAt: ref.syncedAt };
    },
    async pull(ref: ProjectionRef): Promise<ExternalReviewState> {
      const state = await provider.pull(genericRefFromProjection(provider, ref));
      const decision = state.decision === GenericDecision.Approved ? ExternalDecision.Approved : state.decision === GenericDecision.ChangesRequested ? ExternalDecision.ChangesRequested : ExternalDecision.Pending;
      return { decision, merged: state.closed, detail: state.detail };
    },
    async push(ref: ProjectionRef, stage: ReviewStage, outcome: StageOutcome): Promise<void> {
      await provider.advance(genericRefFromProjection(provider, ref), { kind: ProviderActionKind.Comment, body: `Org review stage \`${stage.id}\` → ${outcome}` });
    },
    async merge(ref: ProjectionRef): Promise<void> {
      await provider.advance(genericRefFromProjection(provider, ref), { kind: ProviderActionKind.Merge });
    },
  };
}
