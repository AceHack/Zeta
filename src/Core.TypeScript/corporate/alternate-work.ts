/**
 * alternate-work.ts — what a blocked agent does instead of idling, and what it may NOT do.
 *
 * ── THE DOC ──────────────────────────────────────────────────────────────────
 * `ANTI_STALL_PRIORITY_RUNTIME.md` §"Alternate Work Strategy":
 *
 *   > When work is blocked, the responsible TPM, Engineering Manager, or department manager should
 *   > keep agents productive by **assigning approved alternate work**.
 *
 * then eleven kinds it may be, and four guardrails. The guardrails are the module. Eleven kinds of
 * useful thing to do while waiting is a list anyone could write; what makes this a mechanism rather
 * than a suggestion is that three of the four guardrails are refusals, and the fourth is a decision
 * that must be MADE rather than defaulted.
 *
 * ── WHY "BLOCKED" IS THE DANGEROUS WORD ──────────────────────────────────────
 * A blocked agent has a genuine reason to be doing something other than what it was assigned, and
 * that is precisely the condition under which scope creep is invisible. "I was blocked, so I
 * refactored the module next door" is indistinguishable, at the commit, from work somebody asked
 * for. So the guardrails are not politeness:
 *
 *   1. tied to a work item          — untethered work is work nobody can review against anything
 *   2. does not bypass priority     — being blocked is not a licence to pick what you preferred
 *   3. does not silently expand scope — the widening must be REFUSED, not merely noticed later
 *   4. resumption is DECIDED        — when the blocker clears, a hat chooses; nothing defaults
 *
 * ── GUARDRAIL 2 IS THE ONE THAT LOOKS OPTIONAL AND IS NOT ────────────────────
 * "Must not bypass priority policy" reads like a warning until you ask what it prohibits. An agent
 * offered several alternates and given a lower-priority one has had the organization's ordering
 * quietly overridden in its favour — the ordering still exists, it just stopped deciding anything.
 * So `offerAlternateWork` refuses an offer when a HIGHER-priority candidate was available: the
 * alternate is chosen by the same policy as any other work, or it is not alternate work, it is a
 * preference.
 *
 * ── GUARDRAIL 4 REFUSES TO DEFAULT ───────────────────────────────────────────
 * The doc: *"When the original blocker clears, the owning TPM or manager decides whether to resume,
 * finish alternate work first, or reassign."* Either default is a decision made by whoever wrote
 * the code — auto-resume throws away half-finished alternate work, auto-continue leaves the
 * unblocked original sitting. So the clear produces a QUESTION addressed to a named hat, and
 * `applyResumption` refuses a choice from a hat without standing over it.
 */

import { ActionClass, preflightHatAction } from "./hat-guardrails";
import { type OrgChart, reportsUpTo } from "./org-chart";
import { outranksPriority, type PriorityClass } from "./prioritization";
import { gateOwners, type GateKind } from "./quality-gate";

/** The eleven things the doc says a blocked agent may usefully do. */
export const AlternateWorkKind = {
  IndependentSubtask: "independent_subtask",
  TestsOrHarness: "tests_or_harness",
  DocsOrProjectSkills: "docs_or_project_skills",
  QaCasePreparation: "qa_case_preparation",
  ArchitectureSpike: "architecture_spike",
  DiscoveryOrClarification: "discovery_or_clarification",
  AdjacentBacklogItem: "adjacent_backlog_item",
  TechDebtInApprovedScope: "tech_debt_in_approved_scope",
  ObservabilityGap: "observability_gap",
  CapabilityRequestDependency: "capability_request_dependency",
  /** Reviewing or QA-ing someone else's work — "if the active hat allows it". */
  ReviewOrQaOtherWork: "review_or_qa_other_work",
} as const;

export type AlternateWorkKind = (typeof AlternateWorkKind)[keyof typeof AlternateWorkKind];

/** One thing the agent could do instead. */
export interface AlternateCandidate {
  readonly kind: AlternateWorkKind;
  /**
   * The work item it belongs to.
   *
   * The doc's first guardrail, as a required field: alternate work not tied to an item is work
   * nobody can review against anything, and it is where an unrequested change enters looking
   * exactly like a requested one.
   */
  readonly workId: string;
  readonly priority: PriorityClass;
  /** The approved scope this sits inside — an initiative, a project, a component. */
  readonly scope: string;
  /** The gate being reviewed. Required for `review_or_qa_other_work`. */
  readonly gate?: GateKind;
}

export const AlternateRefusal = {
  /** Not tied to a work item. */
  Untied: "untied",
  /** Outside every scope the organization approved for this agent. */
  OutsideApprovedScope: "outside_approved_scope",
  /** A higher-priority candidate was available — the ordering stopped deciding. */
  BypassesPriority: "bypasses_priority",
  /** The agent's hat cannot do this kind of work. */
  HatCannotPerform: "hat_cannot_perform",
  /** Nobody with standing over this agent approved it. */
  ApproverLacksAuthority: "approver_lacks_authority",
  /** No candidate at all. Idling is then the honest answer, and it is reported as one. */
  NothingAvailable: "nothing_available",
  UnknownHat: "unknown_hat",
} as const;

export type AlternateRefusal = (typeof AlternateRefusal)[keyof typeof AlternateRefusal];

export interface AlternateAssignment {
  readonly agentHatId: string;
  /** The work that is blocked and waiting — never dropped, only paused. */
  readonly blockedWorkId: string;
  readonly candidate: AlternateCandidate;
  readonly approvedByHatId: string;
  readonly atMs: number;
  readonly audit: string;
}

export type AlternateVerdict =
  | { readonly ok: true; readonly assignment: AlternateAssignment }
  | { readonly ok: false; readonly refusal: AlternateRefusal; readonly reason: string };

export interface AlternateInput {
  readonly agentHatId: string;
  readonly blockedWorkId: string;
  /** The priority of the work that is blocked. An alternate may not outrank it. */
  readonly blockedPriority: PriorityClass;
  readonly candidates: readonly AlternateCandidate[];
  /** The one being proposed, by index into `candidates`. */
  readonly chosenIndex: number;
  /** Scopes the organization has already approved for this agent. */
  readonly approvedScopes: readonly string[];
  readonly approvedByHatId: string;
  readonly atMs: number;
}

/**
 * May this agent do this instead, and on whose authority.
 *
 * Checks run in a fixed order so a call refused for several reasons always names the same one.
 */
export function offerAlternateWork(chart: OrgChart, input: AlternateInput): AlternateVerdict {
  if (input.candidates.length === 0) {
    return {
      ok: false,
      refusal: AlternateRefusal.NothingAvailable,
      // Reported rather than papered over. An organization with nothing approved for a blocked
      // agent has a real gap, and manufacturing busywork to hide it is worse than the idle hour.
      reason: `nothing approved is available for '${input.agentHatId}' while '${input.blockedWorkId}' is blocked`,
    };
  }
  const chosen = input.candidates[input.chosenIndex];
  if (chosen === undefined) {
    return {
      ok: false,
      refusal: AlternateRefusal.NothingAvailable,
      reason: `no candidate at index ${String(input.chosenIndex)}`,
    };
  }

  if (chart.byId.get(input.agentHatId) === undefined) {
    return { ok: false, refusal: AlternateRefusal.UnknownHat, reason: `unknown hat '${input.agentHatId}'` };
  }
  const approver = chart.byId.get(input.approvedByHatId);
  if (approver === undefined) {
    return { ok: false, refusal: AlternateRefusal.UnknownHat, reason: `unknown hat '${input.approvedByHatId}'` };
  }

  if (chosen.workId.trim() === "") {
    return {
      ok: false,
      refusal: AlternateRefusal.Untied,
      reason: `alternate work of kind '${chosen.kind}' names no work item`,
    };
  }

  if (!input.approvedScopes.includes(chosen.scope)) {
    return {
      ok: false,
      refusal: AlternateRefusal.OutsideApprovedScope,
      reason: `'${chosen.scope}' is not among the approved scopes (${input.approvedScopes.join(", ") || "none"})`,
    };
  }

  // GUARDRAIL 2. Only candidates the agent could actually have been given are compared: one that
  // is out of scope or beyond the hat is not an alternative that was passed over.
  const comparable = input.candidates.filter(
    (c) => input.approvedScopes.includes(c.scope) && canPerform(chart, input.agentHatId, c).ok,
  );
  const passedOver = comparable.find((c) => outranksPriority(c.priority, chosen.priority));
  if (passedOver !== undefined) {
    return {
      ok: false,
      refusal: AlternateRefusal.BypassesPriority,
      reason: `'${passedOver.workId}' is ${passedOver.priority} and was available; '${chosen.workId}' is ${chosen.priority}`,
    };
  }
  // An alternate outranking the BLOCKED work is a promotion the agent gave itself by being stuck.
  if (outranksPriority(chosen.priority, input.blockedPriority)) {
    return {
      ok: false,
      refusal: AlternateRefusal.BypassesPriority,
      reason: `'${chosen.workId}' is ${chosen.priority}, above the blocked '${input.blockedWorkId}' at ${input.blockedPriority}`,
    };
  }

  const able = canPerform(chart, input.agentHatId, chosen);
  if (!able.ok) return { ok: false, refusal: AlternateRefusal.HatCannotPerform, reason: able.reason };

  // The doc names the responsible TPM, Engineering Manager, or department manager — in this chart,
  // a hat the agent reports up to. Self-approval is what the whole guardrail set exists to prevent.
  if (input.approvedByHatId === input.agentHatId || !reportsUpTo(chart, input.agentHatId, input.approvedByHatId)) {
    return {
      ok: false,
      refusal: AlternateRefusal.ApproverLacksAuthority,
      reason: `'${input.approvedByHatId}' does not supervise '${input.agentHatId}'`,
    };
  }

  return {
    ok: true,
    assignment: {
      agentHatId: input.agentHatId,
      blockedWorkId: input.blockedWorkId,
      candidate: chosen,
      approvedByHatId: input.approvedByHatId,
      atMs: input.atMs,
      audit: `${input.approvedByHatId} approved ${chosen.kind} on ${chosen.workId} (${chosen.priority}, scope ${chosen.scope}) for ${input.agentHatId} while ${input.blockedWorkId} is blocked, at ${String(input.atMs)}`,
    },
  };
}

/**
 * Can this hat do this kind of alternate work at all?
 *
 * `review_or_qa_other_work` is the doc's own conditional — *"if the active hat allows it"* — so it
 * is checked against the gate's approval scope rather than assumed. Every other kind is execution,
 * which is an individual contributor's.
 */
function canPerform(
  chart: OrgChart,
  hatId: string,
  candidate: AlternateCandidate,
): { readonly ok: true } | { readonly ok: false; readonly reason: string } {
  if (candidate.kind !== AlternateWorkKind.ReviewOrQaOtherWork) {
    return preflightHatAction(chart, { hatId, action: ActionClass.ImplementWork });
  }
  if (candidate.gate === undefined) {
    return { ok: false, reason: `'${candidate.kind}' names no gate, so the hat's standing cannot be checked` };
  }
  return gateOwners(chart, candidate.gate).some((h) => h.id === hatId)
    ? { ok: true }
    : { ok: false, reason: `'${hatId}' does not hold the approval scope for '${candidate.gate}'` };
}

/** The three things a manager may decide when the blocker clears. */
export const Resumption = {
  /** Drop back to the original work now. */
  ResumeOriginal: "resume_original",
  /** Let the alternate finish first. */
  FinishAlternateFirst: "finish_alternate_first",
  /** Give the original to someone else. */
  ReassignOriginal: "reassign_original",
} as const;

export type Resumption = (typeof Resumption)[keyof typeof Resumption];

export interface ResumptionQuestion {
  readonly blockedWorkId: string;
  readonly alternateWorkId: string;
  readonly agentHatId: string;
  /** Who must answer. The approver of the alternate, which is a hat with standing over this agent. */
  readonly deciderHatId: string;
  readonly options: readonly Resumption[];
}

/**
 * The blocker cleared — so a hat has a decision to make.
 *
 * Deliberately NOT a resumption. Auto-resuming discards half-finished alternate work; auto-
 * continuing leaves the newly-unblocked original sitting. Both are decisions, and whichever one the
 * code picked would be a decision made by whoever wrote the code rather than by the hat the doc
 * puts it with.
 */
export function onBlockerCleared(assignment: AlternateAssignment): ResumptionQuestion {
  return {
    blockedWorkId: assignment.blockedWorkId,
    alternateWorkId: assignment.candidate.workId,
    agentHatId: assignment.agentHatId,
    deciderHatId: assignment.approvedByHatId,
    options: Object.values(Resumption),
  };
}

export type ResumptionResult =
  | { readonly ok: true; readonly choice: Resumption; readonly audit: string }
  | { readonly ok: false; readonly reason: string };

/** Record an answer — refused from anyone but the hat the question was addressed to. */
export function applyResumption(
  question: ResumptionQuestion,
  choice: Resumption,
  decidedByHatId: string,
): ResumptionResult {
  if (decidedByHatId !== question.deciderHatId) {
    return { ok: false, reason: `'${decidedByHatId}' was not asked; '${question.deciderHatId}' decides this` };
  }
  return {
    ok: true,
    choice,
    audit: `${decidedByHatId} chose ${choice} for ${question.agentHatId}: ${question.blockedWorkId} unblocked while on ${question.alternateWorkId}`,
  };
}
