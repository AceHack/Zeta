/**
 * blocker-taxonomy.ts — a blocker routes by WHAT IT IS, not by who noticed it.
 *
 * ── THE DOC'S OWN SENTENCE ───────────────────────────────────────────────────
 * `ANTI_STALL_PRIORITY_RUNTIME.md` §"Blocker Taxonomy" opens with the criticism this module
 * answers:
 *
 *   > **Blockers need typed routing. A generic `blocked` state is too weak.**
 *
 * and then gives fifteen types, each with its owner hats and its resolution path.
 *
 * The register had the generic state. `request_information` sent a `ReportBlocker` that routed to
 * the reporter's SUPERVISOR, so an agent blocked on a credential scope and an agent blocked on a
 * missing architecture both landed on the same manager — one of whom could not act on either. The
 * supervisor then has to re-route by hand, which is the triage the taxonomy exists to skip.
 *
 * ── ROUTING IS STILL DERIVED, FROM A DIFFERENT RELATION ──────────────────────
 * Same discipline as `scope_holder` for reviews: the reporter names WHAT is blocking it and the
 * organization decides who that reaches. An agent cannot choose its own answerer, and it also
 * cannot be sent to someone who has no standing to resolve the thing it is stuck on.
 *
 * ── OWNERS ARE ORDERED, AND FILTERED BY THE CHART ────────────────────────────
 * The doc lists two or three owner hats per type, most-specific first, and this keeps that order:
 * a credential problem goes to a security engineer before a security director, because escalating
 * before asking wastes the more senior hat. Hats absent from the chart are skipped rather than
 * assumed — an organization without a `security_engineer` routes to whoever it does have, and one
 * with none of a type's owners REFUSES rather than falling back to the supervisor, because a
 * blocker delivered to someone who cannot act on it is one that sits in a queue.
 */

import type { OrgChart, OrgHat } from "./org-chart";

/** The fifteen types the doc names, in its own order. */
export const BlockerKind = {
  RequirementsUnclear: "requirements_unclear",
  CustomerUnavailable: "customer_unavailable",
  MissingBrdSignoff: "missing_brd_signoff",
  ArchitectureMissing: "architecture_missing",
  SecurityBlocked: "security_blocked",
  HatSupplyExhausted: "hat_supply_exhausted",
  ReviewerUnavailable: "reviewer_unavailable",
  QaUnavailable: "qa_unavailable",
  EnvironmentIssue: "environment_issue",
  PipelineFailure: "pipeline_failure",
  DependencyIncomplete: "dependency_incomplete",
  BudgetExceeded: "budget_exceeded",
  ContextMissing: "context_missing",
  CapabilityMissing: "capability_missing",
  ReleaseBlocked: "release_blocked",
} as const;

export type BlockerKind = (typeof BlockerKind)[keyof typeof BlockerKind];

export interface BlockerPolicy {
  readonly kind: BlockerKind;
  /**
   * Hats that can resolve it, MOST SPECIFIC FIRST.
   *
   * Order is load-bearing: a credential problem goes to a security engineer before a security
   * director, because escalating before asking spends the more senior hat's attention on
   * something the first one could have answered.
   */
  readonly ownerHatIds: readonly string[];
  /** What resolving it looks like — the doc's own resolution path, carried as the ask's message. */
  readonly resolutionPath: string;
}

/**
 * The table, keyed so a missing type is a compile error.
 *
 * Hat ids are this chart's names for the doc's roles — its "Requirement Clarifier / Product Owner"
 * is `product_manager` and `product_director` here. The mapping is DATA rather than logic
 * precisely so a different organization can supply different owners without touching the routing.
 */
export const BLOCKER_POLICY: Readonly<Record<BlockerKind, BlockerPolicy>> = {
  [BlockerKind.RequirementsUnclear]: {
    kind: BlockerKind.RequirementsUnclear,
    ownerHatIds: ["product_manager", "product_director"],
    resolutionPath: "open a clarification thread, interview the customer, revise the acceptance criteria",
  },
  [BlockerKind.CustomerUnavailable]: {
    kind: BlockerKind.CustomerUnavailable,
    ownerHatIds: ["product_manager", "tpm", "product_director"],
    resolutionPath: "schedule a follow-up, send an async questionnaire, or proceed on an approved assumption",
  },
  [BlockerKind.MissingBrdSignoff]: {
    kind: BlockerKind.MissingBrdSignoff,
    ownerHatIds: ["product_director", "product_manager"],
    resolutionPath: "route to the BRD review queue and the product signoff gate",
  },
  [BlockerKind.ArchitectureMissing]: {
    kind: BlockerKind.ArchitectureMissing,
    ownerHatIds: ["solution_architect", "architecture_director", "chief_architect"],
    resolutionPath: "create a design task, run an architecture meeting, approve or reject the design",
  },
  [BlockerKind.SecurityBlocked]: {
    kind: BlockerKind.SecurityBlocked,
    ownerHatIds: ["security_engineer", "security_director"],
    resolutionPath: "security review, credential scope decision, or a policy change",
  },
  [BlockerKind.HatSupplyExhausted]: {
    kind: BlockerKind.HatSupplyExhausted,
    // The RMO first: this is the hat that can actually allocate, and asking a manager for supply
    // it does not hold is asking someone who must forward it.
    ownerHatIds: ["rmo_office", "engineering_manager", "tpm"],
    resolutionPath: "reprioritize, release lower-priority hats, or request more supply",
  },
  [BlockerKind.ReviewerUnavailable]: {
    kind: BlockerKind.ReviewerUnavailable,
    ownerHatIds: ["engineering_manager", "engineering_director"],
    resolutionPath: "reassign the reviewer, escalate queue saturation, or provision more reviewer hats",
  },
  [BlockerKind.QaUnavailable]: {
    kind: BlockerKind.QaUnavailable,
    ownerHatIds: ["qa_manager", "qa_director"],
    resolutionPath: "reprioritize the QA queue, assign a regression verifier, or schedule a QA run",
  },
  [BlockerKind.EnvironmentIssue]: {
    kind: BlockerKind.EnvironmentIssue,
    ownerHatIds: ["sre", "operations_director"],
    resolutionPath: "open an operations task or incident, plan self-healing, rerun or rebind the session",
  },
  [BlockerKind.PipelineFailure]: {
    kind: BlockerKind.PipelineFailure,
    ownerHatIds: ["tech_lead", "engineering_manager"],
    resolutionPath: "classify the failure, route it to its owner, and raise a defect or infra task",
  },
  [BlockerKind.DependencyIncomplete]: {
    kind: BlockerKind.DependencyIncomplete,
    ownerHatIds: ["tpm", "senior_tpm", "engineering_manager"],
    resolutionPath: "re-sequence, split the work, parallelize what is unaffected, or escalate the dependency",
  },
  [BlockerKind.BudgetExceeded]: {
    kind: BlockerKind.BudgetExceeded,
    ownerHatIds: ["cfo", "program_director", "executive_board_member"],
    resolutionPath: "pause lower-value work, adjust the budget, shrink scope, or approve an exception",
  },
  [BlockerKind.ContextMissing]: {
    kind: BlockerKind.ContextMissing,
    ownerHatIds: ["engineering_manager", "tech_lead"],
    resolutionPath: "attach the context, or raise a memory-adaptation or project-skill request",
  },
  [BlockerKind.CapabilityMissing]: {
    kind: BlockerKind.CapabilityMissing,
    ownerHatIds: ["hat_approval_steward", "chief_architect", "security_director"],
    resolutionPath: "create a capability request, route its approvals, and assign the implementation",
  },
  [BlockerKind.ReleaseBlocked]: {
    kind: BlockerKind.ReleaseBlocked,
    ownerHatIds: ["senior_tpm", "tpm", "qa_director"],
    resolutionPath: "identify the missing evidence or gate and route it to the responsible hat",
  },
};

/** Every owner of this blocker type that this chart actually has, in policy order. */
export function ownersFor(chart: OrgChart, kind: BlockerKind): readonly OrgHat[] {
  const out: OrgHat[] = [];
  for (const id of BLOCKER_POLICY[kind].ownerHatIds) {
    const hat = chart.byId.get(id);
    // ABSENT HATS ARE SKIPPED, not assumed. An organization without a `security_engineer` routes
    // to whoever it does have, and inventing the hat would produce a target nobody can be.
    if (hat !== undefined) out.push(hat);
  }
  return out;
}

/**
 * Who this blocker goes to.
 *
 * The first owner this chart has, excluding the reporter — a hat cannot be routed its own blocker,
 * which would be a no-op reporting success. `undefined` when no owner exists here, and the caller
 * REFUSES rather than falling back to the supervisor: the fallback is what the taxonomy replaces,
 * and silently reinstating it would leave a credential problem sitting with a manager who cannot
 * act on it while everyone believes it was routed.
 */
export function routeBlocker(chart: OrgChart, kind: BlockerKind, fromHatId: string): OrgHat | undefined {
  return ownersFor(chart, kind).find((h) => h.id !== fromHatId);
}

/** Whether a string is one of the fifteen — so an unknown type is caught rather than coerced. */
export function isBlockerKind(value: string): value is BlockerKind {
  return Object.prototype.hasOwnProperty.call(BLOCKER_POLICY, value);
}

/** The resolution path, for the message the owner receives. */
export function resolutionFor(kind: BlockerKind): string {
  return BLOCKER_POLICY[kind].resolutionPath;
}
