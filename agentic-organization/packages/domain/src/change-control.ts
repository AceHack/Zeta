/**
 * Org-Native Change Control domain (ORG_NATIVE_CHANGE_CONTROL_DESIGN). The internal
 * review fabric that replaces Git PRs/MRs with an org-owned process. The `ChangeSet`
 * is the canonical reviewable unit; GitHub PR / GitLab MR / Jira card are optional
 * PROJECTIONS created on demand (the port layer, application/state-cockroach side).
 *
 * Five elegance invariants drive this:
 *  1. one canonical ChangeSet, many projections (compose, don't fork — like Hindsight)
 *  2. a review stage is an observe→decide org cycle (the keystone kernel at review scope)
 *  3. the external PR is just a stage whose authority lives outside the org
 *  4. the change payload is typed + Git-agnostic (a superset of what a PR can carry)
 *  5. clamp discipline holds (can't advance past an unsatisfied gate / fabricate approval)
 *
 * This module is pure domain: records + DUs + the legal-transition kernel. The
 * gate evaluation, authority decisions, port adapters, and storage live above.
 */

// ── lifecycle phase (House-DU, mirrors HatBinding / MemoryPhase) ─────────────

export const ChangeSetPhase = {
  Drafted: "drafted", // proposer assembling artifacts
  InReview: "in_review", // moving through the pipeline (cursor = currentStageIndex)
  ChangesRequested: "changes_requested", // a stage returned blocking findings
  Approved: "approved", // every blocking stage passed
  Applied: "applied", // change materialized into target (+ external merge) — TERMINAL
  Rejected: "rejected", // hard-rejected — TERMINAL
  Withdrawn: "withdrawn", // proposer pulled it — TERMINAL
} as const;
export type ChangeSetPhase = (typeof ChangeSetPhase)[keyof typeof ChangeSetPhase];

export const TerminalChangeSetPhases: ReadonlySet<ChangeSetPhase> = new Set([
  ChangeSetPhase.Applied,
  ChangeSetPhase.Rejected,
  ChangeSetPhase.Withdrawn,
]);

export function isTerminalChangeSet(phase: ChangeSetPhase): boolean {
  return TerminalChangeSetPhases.has(phase);
}

// ── the Git-agnostic change payload ─────────────────────────────────────────

export const ChangeArtifactKind = {
  CodeDiff: "code_diff",
  DocChange: "doc_change",
  ConfigChange: "config_change",
  SchemaMigration: "schema_migration",
  DecisionRecord: "decision_record",
  ArtifactRef: "artifact_ref",
} as const;
export type ChangeArtifactKind = (typeof ChangeArtifactKind)[keyof typeof ChangeArtifactKind];

export type ChangeArtifact =
  | { kind: typeof ChangeArtifactKind.CodeDiff; path: string; diff: string; language: string }
  | { kind: typeof ChangeArtifactKind.DocChange; path: string; before: string; after: string }
  | { kind: typeof ChangeArtifactKind.ConfigChange; key: string; before: string; after: string }
  | { kind: typeof ChangeArtifactKind.SchemaMigration; migrationId: string; sql: string }
  | { kind: typeof ChangeArtifactKind.DecisionRecord; decisionId: string; summary: string }
  | { kind: typeof ChangeArtifactKind.ArtifactRef; uri: string; contentType: string };

/** The systems a port can render an artifact into. Only `code_diff`/`doc_change`/ */
/** `config_change` are Git-representable; the rest stay internal, referenced from the PR. */
const GIT_REPRESENTABLE: ReadonlySet<ChangeArtifactKind> = new Set([
  ChangeArtifactKind.CodeDiff,
  ChangeArtifactKind.DocChange,
  ChangeArtifactKind.ConfigChange,
]);

export function isGitRepresentable(artifact: ChangeArtifact): boolean {
  return GIT_REPRESENTABLE.has(artifact.kind);
}

// ── external projection systems ─────────────────────────────────────────────

export const ExternalSystem = {
  GitHub: "github",
  GitLab: "gitlab",
  Jira: "jira",
  None: "none",
} as const;
export type ExternalSystem = (typeof ExternalSystem)[keyof typeof ExternalSystem];

export type ProjectionRef = {
  system: ExternalSystem;
  externalId: string; // PR number, MR iid, Jira key
  url: string;
  lastSyncedState: string;
  syncedAt: string;
};

// ── review pipeline (stages as DATA, not Git's opinion) ─────────────────────

/** WHO satisfies a stage — the keystone DU unifying internal/quorum/human/external. */
export type ReviewAuthority =
  | { kind: "hat"; hatId: string }
  | { kind: "quorum"; hatIds: readonly string[]; threshold: number }
  | { kind: "human"; role: string }
  | { kind: "external"; system: ExternalSystem };

/** WHAT must be true for a stage to pass. */
export const ReviewGateKind = {
  ArtifactsPresent: "artifacts_present",
  TestsGreen: "tests_green",
  NoBlockingFindings: "no_blocking_findings",
  QuorumAgreed: "quorum_agreed",
  ExternalApproved: "external_approved",
} as const;
export type ReviewGateKind = (typeof ReviewGateKind)[keyof typeof ReviewGateKind];

export type ReviewStage = {
  id: string; // "internal-code-review" | "internal-qa" | "security" | "external-code-review" | "human-qa-signoff"
  ownerLabel: string; // human-readable owner ("code_reviewer", "qa_reviewer", …)
  authority: ReviewAuthority;
  gate: ReviewGateKind;
  blocking: boolean; // must pass to advance vs advisory
  projectTo?: ExternalSystem; // if set, materialize an external PR/MR/card for this stage
};

export type ReviewPipeline = {
  pipelineId: string;
  organizationId: string;
  stages: readonly ReviewStage[];
};

// ── the canonical ChangeSet ─────────────────────────────────────────────────

export type ChangeSet = {
  changeSetId: string; // content-addressed: uuidv5(org:workItem:targetRef:revision)
  organizationId: string;
  workItemId: string; // the work this change advances (the join to the Work OS)
  proposerHatId: string;
  title: string;
  targetRef: string; // a branch name, a doc id, a service… — what it changes against
  phase: ChangeSetPhase;
  pipelineId: string;
  currentStageIndex: number; // cursor within the pipeline while in_review
  artifacts: readonly ChangeArtifact[];
  projections: readonly ProjectionRef[];
  revision: number; // bumps on each changes-requested → resubmit
  openedAt: string;
  updatedAt: string;
};

// ── the legal-transition kernel (the determinism half) ──────────────────────

const P = ChangeSetPhase;

export function moreStagesRemain(cs: ChangeSet, pipeline: ReviewPipeline): boolean {
  return cs.currentStageIndex < pipeline.stages.length - 1;
}

export function currentStage(cs: ChangeSet, pipeline: ReviewPipeline): ReviewStage | undefined {
  return pipeline.stages[cs.currentStageIndex];
}

/** Legal next phases for a ChangeSet — the chooser picks within this; the kernel clamps. */
export function legalChangeSetTransitions(
  cs: ChangeSet,
  pipeline: ReviewPipeline,
): readonly ChangeSetPhase[] {
  switch (cs.phase) {
    case P.Drafted:
      return [P.InReview, P.Withdrawn];
    case P.InReview:
      return moreStagesRemain(cs, pipeline)
        ? [P.InReview, P.ChangesRequested, P.Rejected, P.Withdrawn] // advance | bounce | kill
        : [P.Approved, P.ChangesRequested, P.Rejected, P.Withdrawn]; // last stage → approve
    case P.ChangesRequested:
      return [P.InReview, P.Withdrawn]; // proposer revises + resubmits
    case P.Approved:
      return [P.Applied, P.ChangesRequested, P.Withdrawn]; // release queue may bounce a red stack
    default:
      return []; // terminal
  }
}

export function isLegalChangeSetTransition(
  cs: ChangeSet,
  pipeline: ReviewPipeline,
  to: ChangeSetPhase,
): boolean {
  return legalChangeSetTransitions(cs, pipeline).includes(to);
}

// ── per-stage outcomes (the review-cycle decision space) ────────────────────

export const StageOutcome = {
  Approve: "approve",
  RequestChanges: "request_changes",
  Reject: "reject",
} as const;
export type StageOutcome = (typeof StageOutcome)[keyof typeof StageOutcome];

/**
 * The legal outcomes for a stage given its gate evaluation. THE CLAMP: an
 * unsatisfiable gate can NEVER be approved — only bounced or rejected. A blocking
 * stage may reject; an advisory stage may not.
 */
export function legalStageOutcomes(stage: ReviewStage, gateSatisfiable: boolean): readonly StageOutcome[] {
  if (!gateSatisfiable) return [StageOutcome.RequestChanges, StageOutcome.Reject];
  return stage.blocking
    ? [StageOutcome.Approve, StageOutcome.RequestChanges, StageOutcome.Reject]
    : [StageOutcome.Approve, StageOutcome.RequestChanges];
}

export function isLegalStageOutcome(stage: ReviewStage, gateSatisfiable: boolean, outcome: StageOutcome): boolean {
  return legalStageOutcomes(stage, gateSatisfiable).includes(outcome);
}
