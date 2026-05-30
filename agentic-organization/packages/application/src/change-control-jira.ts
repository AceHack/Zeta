/**
 * Jira card port (CC5) — projects a review stage onto a Jira issue: transition the
 * card to the review status + post the change summary, and reconcile the external
 * decision back IN by reading the issue's status. The org's ChangeSet is canonical;
 * Jira shows the coarse `In Review → Done` view while the org runs its fine pipeline.
 *
 * Status→decision mapping is configurable (different Jira projects name statuses
 * differently): reviewStatus while open, approvedStatus → Approved, changesStatus →
 * ChangesRequested.
 */

import {
  ExternalSystem,
  type ChangeSet,
  type ProjectionRef,
  type ReviewStage,
  type StageOutcome,
} from "../../domain/src/index.ts";
import { ExternalDecision } from "./change-control-kernel.ts";
import type { ChangeControlPort, ExternalReviewState } from "./change-control-port.ts";

export type JiraClient = {
  transition: (issueKey: string, statusName: string) => Promise<void>;
  comment: (issueKey: string, body: string) => Promise<void>;
  getStatus: (issueKey: string) => Promise<string>;
};

export type JiraStatusMap = {
  reviewStatus: string; // e.g. "In Review"
  approvedStatus: string; // e.g. "QA Approved"
  changesStatus: string; // e.g. "In Progress"
  doneStatus: string; // e.g. "Done"
};

// ── live REST client (native fetch, Jira Cloud v3) ──────────────────────────

export type CreateJiraHttpClientInput = {
  baseUrl: string; // https://your-domain.atlassian.net
  email: string;
  token: string;
  fetchImpl?: typeof fetch;
};

export function createJiraHttpClient(input: CreateJiraHttpClientInput): JiraClient {
  const doFetch = input.fetchImpl ?? fetch;
  const api = `${input.baseUrl.replace(/\/$/, "")}/rest/api/3`;
  const auth = `Basic ${b64(`${input.email}:${input.token}`)}`;
  const headers = { authorization: auth, accept: "application/json", "content-type": "application/json" };

  async function fail(res: Response, op: string): Promise<void> {
    if (!res.ok) throw new Error(`jira ${op} failed: ${res.status} ${await res.text()}`);
  }

  return {
    async transition(issueKey, statusName): Promise<void> {
      const list = await doFetch(`${api}/issue/${issueKey}/transitions`, { headers });
      await fail(list, "list-transitions");
      const body = (await list.json()) as { transitions: { id: string; to: { name: string } }[] };
      const t = body.transitions.find((x) => x.to.name === statusName);
      if (t === undefined) return; // status not reachable; no-op
      await fail(await doFetch(`${api}/issue/${issueKey}/transitions`, { method: "POST", headers, body: JSON.stringify({ transition: { id: t.id } }) }), "transition");
    },
    async comment(issueKey, body): Promise<void> {
      await fail(await doFetch(`${api}/issue/${issueKey}/comment`, { method: "POST", headers, body: JSON.stringify({ body: { type: "doc", version: 1, content: [{ type: "paragraph", content: [{ type: "text", text: body }] }] } }) }), "comment");
    },
    async getStatus(issueKey): Promise<string> {
      const res = await doFetch(`${api}/issue/${issueKey}?fields=status`, { headers });
      await fail(res, "get-status");
      const data = (await res.json()) as { fields: { status: { name: string } } };
      return data.fields.status.name;
    },
  };
}

function b64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (const x of bytes) bin += String.fromCharCode(x);
  return btoa(bin);
}

// ── the port ─────────────────────────────────────────────────────────────────

export function createJiraCardPort(deps: { client: JiraClient; statusMap: JiraStatusMap; issueKeyFor: (cs: ChangeSet) => string; nowMs: () => number }): ChangeControlPort {
  return {
    system: ExternalSystem.Jira,
    async project(cs: ChangeSet): Promise<ProjectionRef> {
      const key = deps.issueKeyFor(cs);
      await deps.client.transition(key, deps.statusMap.reviewStatus);
      await deps.client.comment(key, `Org ChangeSet ${cs.changeSetId} entered review (${cs.artifacts.length} artifact(s)).`);
      return { system: ExternalSystem.Jira, externalId: key, url: `${key}`, lastSyncedState: deps.statusMap.reviewStatus, syncedAt: new Date(deps.nowMs()).toISOString() };
    },
    async pull(ref: ProjectionRef): Promise<ExternalReviewState> {
      const status = await deps.client.getStatus(ref.externalId);
      const decision =
        status === deps.statusMap.approvedStatus ? ExternalDecision.Approved
        : status === deps.statusMap.changesStatus ? ExternalDecision.ChangesRequested
        : ExternalDecision.Pending;
      return { decision, merged: status === deps.statusMap.doneStatus, detail: `jira ${ref.externalId} ${status}` };
    },
    async push(ref: ProjectionRef, stage: ReviewStage, outcome: StageOutcome): Promise<void> {
      await deps.client.comment(ref.externalId, `Org review stage ${stage.id} → ${outcome}`);
    },
    async merge(ref: ProjectionRef): Promise<void> {
      await deps.client.transition(ref.externalId, deps.statusMap.doneStatus);
    },
  };
}
