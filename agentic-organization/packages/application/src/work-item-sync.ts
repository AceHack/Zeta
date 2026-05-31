/**
 * Work-item ↔ card sync (C3) — the SAME port shape as change control's external projection (CC5),
 * generalized from ChangeSets to work items and from PRs to Jira/Linear cards. A work item is the
 * canonical object; a card is a projection a human can use, kept in sync bidirectionally. The org's
 * internal work pipeline stays the source of truth; the card mirrors it (push) and surfaces external
 * status back in (pull). Live creds + a real instance are the credential-gated step (surfaced to the
 * operator); the wire behavior is proven deterministically against an injected fetch mock.
 */

export type CardRef = { system: string; cardKey: string; url: string; lastSyncedStatus: string; syncedAt: string };
export type CardState = { externalStatus: string; closed: boolean };

export type CardClient = {
  createCard: (args: { title: string; description: string; type: string }) => Promise<{ key: string; url: string }>;
  getCard: (key: string) => Promise<CardState>;
  transition: (key: string, toStatus: string) => Promise<void>;
  /** optional — mirror an org note onto the card (the transition is the load-bearing sync; a comment is advisory) */
  comment?: (key: string, body: string) => Promise<void>;
};

export type CreateCardHttpClientInput = {
  baseUrl: string; // e.g. https://your-org.atlassian.net/rest/api/3
  token: string;
  projectKey: string;
  fetchImpl?: typeof fetch;
};

/** A Jira/Linear-shaped REST client over native fetch (the credential-gated live adapter). */
export function createCardHttpClient(input: CreateCardHttpClientInput): CardClient {
  const doFetch = input.fetchImpl ?? fetch;
  const api = input.baseUrl.replace(/\/$/, "");
  const headers = { authorization: `Bearer ${input.token}`, accept: "application/json", "content-type": "application/json" };
  async function ok<T>(res: Response, op: string): Promise<T> {
    if (!res.ok) throw new Error(`card-sync ${op} failed: ${res.status} ${await res.text()}`);
    return (await res.json()) as T;
  }
  return {
    async createCard(args): Promise<{ key: string; url: string }> {
      const created = await ok<{ key: string; self: string }>(
        await doFetch(`${api}/issue`, { method: "POST", headers, body: JSON.stringify({ fields: { project: { key: input.projectKey }, summary: args.title, description: args.description, issuetype: { name: args.type } } }) }),
        "create-card",
      );
      return { key: created.key, url: `${api}/browse/${created.key}` };
    },
    async getCard(key): Promise<CardState> {
      const issue = await ok<{ fields: { status: { name: string }; resolution: unknown } }>(await doFetch(`${api}/issue/${key}`, { headers }), "get-card");
      return { externalStatus: issue.fields.status.name, closed: issue.fields.resolution !== null };
    },
    async transition(key, toStatus): Promise<void> {
      // a transition returns 204 No Content, so we can't reuse ok<T> (it parses JSON) — but a
      // non-2xx MUST throw, else push() reports success for a transition that never happened and
      // the card silently desyncs from the canonical work item (the invariant this module exists for)
      const res = await doFetch(`${api}/issue/${key}/transitions`, { method: "POST", headers, body: JSON.stringify({ transition: { name: toStatus } }) });
      if (!res.ok) throw new Error(`card-sync transition failed: ${res.status} ${await res.text()}`);
    },
    async comment(key, body): Promise<void> {
      const res = await doFetch(`${api}/issue/${key}/comment`, { method: "POST", headers, body: JSON.stringify({ body }) });
      if (!res.ok) throw new Error(`card-sync comment failed: ${res.status} ${await res.text()}`);
    },
  };
}

export type WorkItemSyncInput = { workItemId: string; title: string; description: string; type: string };

export type WorkItemSyncPort = {
  system: string;
  project: (work: WorkItemSyncInput) => Promise<CardRef>;
  pull: (ref: CardRef) => Promise<CardState>;
  push: (ref: CardRef, toStatus: string) => Promise<void>;
};

/** The work-item sync port — the same project/pull/push shape as the change-control port. */
export function createCardSyncPort(deps: { system: string; client: CardClient; nowMs: () => number }): WorkItemSyncPort {
  return {
    system: deps.system,
    async project(work): Promise<CardRef> {
      const card = await deps.client.createCard({ title: work.title, description: work.description, type: work.type });
      return { system: deps.system, cardKey: card.key, url: card.url, lastSyncedStatus: "open", syncedAt: new Date(deps.nowMs()).toISOString() };
    },
    async pull(ref): Promise<CardState> {
      return deps.client.getCard(ref.cardKey);
    },
    async push(ref, toStatus): Promise<void> {
      await deps.client.transition(ref.cardKey, toStatus);
    },
  };
}
