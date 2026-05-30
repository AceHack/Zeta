/**
 * Generic work-provider model (GEN1) — the org calls ONE provider-agnostic surface
 * (project / pull / advance); the CONFIGURED provider supplies the translated action
 * that runs underneath. Adding GitHub / GitLab / Jira / Linear is adding a translation,
 * not a new call site.
 *
 * Two families share the one surface:
 *   code_review (GitHub PR, GitLab MR) — projects code as a branch + review; advanced by
 *                                        a comment or a merge; its decision is pulled IN.
 *   work_item   (Jira, Linear card)    — projects a card; advanced by a status transition
 *                                        or a comment; its status is pulled IN.
 *
 * This module is PURE: the kinds, the families, the action DU, and the translation
 * contract (which actions a family supports). The HTTP adapters live in the application
 * layer; they consume these types so the contract is one source of truth.
 */

// ── which provider, which family ─────────────────────────────────────────────

export const WorkProviderKind = {
  GitHub: "github",
  GitLab: "gitlab",
  Jira: "jira",
  Linear: "linear",
} as const;
export type WorkProviderKind = (typeof WorkProviderKind)[keyof typeof WorkProviderKind];

export const WorkProviderFamily = {
  CodeReview: "code_review",
  WorkItem: "work_item",
} as const;
export type WorkProviderFamily = (typeof WorkProviderFamily)[keyof typeof WorkProviderFamily];

/** github/gitlab are code-review; jira/linear are work-item. Total over the DU. */
export function providerFamily(kind: WorkProviderKind): WorkProviderFamily {
  switch (kind) {
    case WorkProviderKind.GitHub:
    case WorkProviderKind.GitLab:
      return WorkProviderFamily.CodeReview;
    case WorkProviderKind.Jira:
    case WorkProviderKind.Linear:
      return WorkProviderFamily.WorkItem;
  }
}

// ── the translated outbound action ───────────────────────────────────────────

export const ProviderActionKind = {
  Comment: "comment",
  Merge: "merge",
  Transition: "transition",
} as const;
export type ProviderActionKind = (typeof ProviderActionKind)[keyof typeof ProviderActionKind];

/**
 * What the org pushes OUTWARD onto a projection. (Approval is an INBOUND decision a human
 * makes on the provider; the org pulls it in via GenericExternalState, it does not push it.)
 */
export type ProviderAction =
  | { kind: typeof ProviderActionKind.Comment; body: string }
  | { kind: typeof ProviderActionKind.Merge }
  | { kind: typeof ProviderActionKind.Transition; toStatus: string };

/** The translation contract: which outbound actions each family can take. */
export function actionsForFamily(family: WorkProviderFamily): readonly ProviderActionKind[] {
  switch (family) {
    case WorkProviderFamily.CodeReview:
      return [ProviderActionKind.Comment, ProviderActionKind.Merge]; // a PR/MR is commented + merged
    case WorkProviderFamily.WorkItem:
      return [ProviderActionKind.Comment, ProviderActionKind.Transition]; // a card is commented + transitioned
  }
}

export function providerSupportsAction(kind: WorkProviderKind, action: ProviderActionKind): boolean {
  return actionsForFamily(providerFamily(kind)).includes(action);
}

/** Structural guard — a card provider cannot Merge, a PR provider cannot Transition. Surfaced, not silent. */
export function assertProviderSupports(kind: WorkProviderKind, action: ProviderActionKind): void {
  if (!providerSupportsAction(kind, action)) {
    throw new Error(`work-provider '${kind}' (${providerFamily(kind)}) does not support action '${action}'`);
  }
}

// ── the generic data carried across the surface ──────────────────────────────

export type GenericWorkProjection = {
  /** the canonical org object's id (a ChangeSet id or a work-item id) */
  workId: string;
  title: string;
  body: string;
  /** code_review only — the branch/ref to open the PR/MR from, and the files to render */
  targetRef?: string;
  files?: readonly { path: string; content: string }[];
  /** work_item only — the card issue type (e.g. "Task") */
  cardType?: string;
};

export type GenericRef = {
  kind: WorkProviderKind;
  externalId: string;
  url: string;
  syncedStatus: string;
  syncedAt: string;
};

/** The org's normalized read of a projection — a code-review decision AND a card status, unified. */
export const GenericDecision = {
  Approved: "approved",
  ChangesRequested: "changes_requested",
  Pending: "pending",
} as const;
export type GenericDecision = (typeof GenericDecision)[keyof typeof GenericDecision];

export type GenericExternalState = {
  decision: GenericDecision;
  /** merged (PR/MR) OR resolved/closed (card) — the "this is done externally" bit, unified */
  closed: boolean;
  status: string;
  detail: string;
};
