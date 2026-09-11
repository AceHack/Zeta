/**
 * requirement-maturity.ts — how well understood a requirement is, tracked SEPARATELY from how far
 * along the work is.
 *
 * ── THE DOC ──────────────────────────────────────────────────────────────────
 * `AMBIGUOUS_REQUIREMENT_LIFECYCLE.md` §"Requirement Maturity States":
 *
 *   > The Work OS should track requirement maturity **separately from implementation status**.
 *   > […] The requirement maturity state should GATE the normal work item state. A customer-facing
 *   > or ambiguous feature should not move to `ready` unless it has reached `implementation_ready`
 *   > or has an explicit approved no-discovery/no-BRD decision.
 *
 * Two axes, not one. `WorkState` already answers *how far has this got*; nothing answered *do we
 * know what it is*. Without the second axis the two collapse, and the collapse always runs one way:
 * work that is moving looks understood, because movement is the only thing being measured.
 *
 * ── THE GATE IS THE MODULE ───────────────────────────────────────────────────
 * A maturity ladder that records progress and stops nothing is a status field. What makes this a
 * mechanism is `readinessOf` — an ambiguous or customer-facing item is REFUSED `ready` until it is
 * `implementation_ready`, and the only way past is an explicit waiver approved by a hat with
 * standing.
 *
 * A waiver removes the CAUSE, not a step. Ambiguity is what makes discovery necessary, so waiving
 * discovery answers the ambiguity and the item stands where an unambiguous one always stood. The
 * first draft gated the whole ladder instead, which made a signed waiver unable to unblock
 * anything — a GATE THAT CANNOT OPEN, the mirror of a check that cannot fail and just as useless.
 * Caught by two tests written from the doc's sentence rather than from the code.
 *
 * The waiver is the interesting half, because it is where the gate would otherwise be quietly
 * defeated. A boolean `skipDiscovery` on the item would be set by whoever was in a hurry. So a
 * waiver names WHO approved it and WHY, and the who is checked against the same roster that owns
 * the corresponding blocker — `blocker-taxonomy.ts`'s owners of `requirements_unclear` and
 * `missing_brd_signoff`. Skipping discovery is a decision by the hat that would otherwise have
 * DONE the discovery, which is the only party positioned to know it is safe to skip.
 *
 * ── SKIPPING IS PERMITTED, SILENTLY SKIPPING IS NOT ──────────────────────────
 * The doc gives one linear chain, and taken literally every internal one-line fix would need an
 * interview. That is not what it says: discovery and BRD are named as what AMBIGUOUS OR
 * CUSTOMER-FACING work needs. So the required subset is DERIVED from the requirement's own profile,
 * and advancing may skip a state the profile does not require while a required one refuses.
 */

import { BlockerKind, ownersFor } from "./blocker-taxonomy";
import type { OrgChart } from "./org-chart";

/** The doc's fourteen, in its own order. Index IS the rank. */
export const MATURITY_ORDER = [
  "raw_intake",
  "classified",
  "ambiguity_scored",
  "discovery_required",
  "interview_planned",
  "interview_in_progress",
  "source_evidence_captured",
  "requirements_drafted",
  "workflow_modeled",
  "acceptance_criteria_drafted",
  "brd_review",
  "product_signoff",
  "architecture_ready",
  "implementation_ready",
] as const;

export type RequirementMaturity = (typeof MATURITY_ORDER)[number];

/** Where this state sits in the chain. `-1` for a string that is not one of the fourteen. */
export function maturityRank(state: RequirementMaturity): number {
  return MATURITY_ORDER.indexOf(state);
}

export function isMaturity(value: string): value is RequirementMaturity {
  return (MATURITY_ORDER as readonly string[]).includes(value);
}

/** The doc's ten ambiguity signals. Each is a FACT about the request, not a judgement of it. */
export const AmbiguityFactor = {
  UnclearCustomer: "unclear_user_or_customer",
  UnclearBehavior: "unclear_expected_behavior",
  MissingCurrentStateEvidence: "missing_current_state_evidence",
  UnknownSuccessMetric: "unknown_success_metric",
  UndefinedAcceptanceCriteria: "undefined_acceptance_criteria",
  MultipleInterpretations: "multiple_plausible_interpretations",
  CrossProjectScope: "cross_project_or_cross_repo_scope",
  SecurityOrDataImpact: "security_credential_data_or_workflow_impact",
  MissingBusinessOwner: "missing_business_owner",
  HighCostOrRisk: "high_cost_or_delivery_risk",
} as const;

export type AmbiguityFactor = (typeof AmbiguityFactor)[keyof typeof AmbiguityFactor];

/**
 * How many factors must hold before a requirement counts as ambiguous.
 *
 * TWO, not one. Almost every real request is missing something — a success metric, a named owner —
 * and a threshold of one would route the entire backlog through discovery, which is the same
 * failure as routing none of it: the score stops discriminating and everyone learns to ignore it.
 */
export const AMBIGUITY_THRESHOLD = 2;

/** What the organization knows about the request itself. */
export interface RequirementProfile {
  readonly requirementId: string;
  /** Whether a customer or an internal customer is on the other end of this. */
  readonly customerFacing: boolean;
  /** The factors OBSERVED, not a number somebody chose. */
  readonly factors: readonly AmbiguityFactor[];
}

/** The score IS the count of observed factors — no weighting nobody could justify. */
export function ambiguityScore(profile: RequirementProfile): number {
  return new Set(profile.factors).size;
}

export function isAmbiguous(profile: RequirementProfile): boolean {
  return ambiguityScore(profile) >= AMBIGUITY_THRESHOLD;
}

/** Discovery states — what an ambiguous request must go through. */
const DISCOVERY_STATES: readonly RequirementMaturity[] = [
  "discovery_required",
  "interview_planned",
  "interview_in_progress",
  "source_evidence_captured",
];

/** Business-signoff states — what customer-facing work must go through. */
const SIGNOFF_STATES: readonly RequirementMaturity[] = ["brd_review", "product_signoff"];

/**
 * The states THIS requirement must actually pass through.
 *
 * The first four and the last four are unconditional: classifying a request, scoring it, drafting
 * requirements, modelling the workflow, writing acceptance criteria and being architecturally ready
 * are not things ambiguity excuses. Discovery is required by ambiguity; business signoff by being
 * customer-facing.
 */
export function requiredStates(profile: RequirementProfile): readonly RequirementMaturity[] {
  const optional = new Set<string>();
  if (!isAmbiguous(profile)) for (const s of DISCOVERY_STATES) optional.add(s);
  if (!profile.customerFacing) for (const s of SIGNOFF_STATES) optional.add(s);
  return MATURITY_ORDER.filter((s) => !optional.has(s));
}

export const MaturityRefusal = {
  /** Maturity does not go backwards; a requirement that got less understood is a new one. */
  Backward: "backward",
  /** Already there. */
  NoMovement: "no_movement",
  /** A state this requirement's own profile requires was jumped over. */
  SkippedRequiredState: "skipped_required_state",
} as const;

export type MaturityRefusal = (typeof MaturityRefusal)[keyof typeof MaturityRefusal];

export type AdvanceResult =
  | { readonly ok: true; readonly state: RequirementMaturity; readonly skipped: readonly RequirementMaturity[] }
  | { readonly ok: false; readonly refusal: MaturityRefusal; readonly reason: string };

/**
 * Move a requirement forward.
 *
 * Skipping a state the profile does not require is permitted AND REPORTED — the `skipped` list is
 * what makes it a decision somebody can see rather than a gap in a history. Skipping a required one
 * refuses, which is the whole point of deriving the requirement set instead of trusting a caller.
 */
export function advanceMaturity(
  from: RequirementMaturity,
  to: RequirementMaturity,
  profile: RequirementProfile,
): AdvanceResult {
  const a = maturityRank(from);
  const b = maturityRank(to);
  if (b < a) {
    return { ok: false, refusal: MaturityRefusal.Backward, reason: `'${to}' is behind '${from}'` };
  }
  if (b === a) {
    return { ok: false, refusal: MaturityRefusal.NoMovement, reason: `already at '${from}'` };
  }
  const required = new Set<string>(requiredStates(profile));
  const jumped = MATURITY_ORDER.slice(a + 1, b);
  const missed = jumped.filter((s) => required.has(s));
  if (missed.length > 0) {
    return {
      ok: false,
      refusal: MaturityRefusal.SkippedRequiredState,
      reason: `'${profile.requirementId}' must pass through ${missed.join(", ")}`,
    };
  }
  return { ok: true, state: to, skipped: jumped };
}

/** The two things a waiver can excuse — the doc's "no-discovery/no-BRD decision". */
export const WaiverKind = {
  NoDiscovery: "no_discovery",
  NoBrd: "no_brd",
} as const;

export type WaiverKind = (typeof WaiverKind)[keyof typeof WaiverKind];

export interface Waiver {
  readonly kind: WaiverKind;
  readonly approvedByHatId: string;
  /** Why it is safe to skip. An empty one is refused — a waiver with no reason is a checkbox. */
  readonly reason: string;
}

/**
 * Hats that may sign a waiver of this kind.
 *
 * Read out of `blocker-taxonomy.ts` rather than restated: waiving discovery is a decision by the
 * hat that would otherwise have DONE the discovery, which is the same hat the organization routes
 * an unclear requirement to. One roster, so the two cannot drift apart.
 */
export function waiverApprovers(chart: OrgChart, kind: WaiverKind): readonly string[] {
  const blocker = kind === WaiverKind.NoDiscovery ? BlockerKind.RequirementsUnclear : BlockerKind.MissingBrdSignoff;
  return ownersFor(chart, blocker).map((h) => h.id);
}

export const ReadinessRefusal = {
  /** Not mature enough, and nothing waives the gap. */
  Immature: "immature",
  /** A waiver was offered by a hat that cannot sign one. */
  WaiverUnauthorized: "waiver_unauthorized",
  /** A waiver with no stated reason. */
  WaiverUnexplained: "waiver_unexplained",
  /** A waiver that does not cover what is actually missing. */
  WaiverDoesNotCover: "waiver_does_not_cover",
} as const;

export type ReadinessRefusal = (typeof ReadinessRefusal)[keyof typeof ReadinessRefusal];

export type ReadinessResult =
  | { readonly ok: true; readonly via: "implementation_ready" | "not_gated" | "waiver" }
  | { readonly ok: false; readonly refusal: ReadinessRefusal; readonly reason: string };

/**
 * May this requirement's work item move to `ready`?
 *
 * The gate the doc asks for, and it is conditional on exactly two properties:
 *
 *   > A **customer-facing or ambiguous** feature should not move to `ready` unless it has reached
 *   > `implementation_ready` or has an explicit approved no-discovery/no-BRD decision.
 *
 * So a waiver removes the CAUSE, not a step. Ambiguity is what makes discovery necessary; waiving
 * discovery answers the ambiguity, and the item is then in the position an unambiguous one was
 * always in. That is a narrower rule than gating the whole ladder — the first draft here did that,
 * and it made a signed waiver unable to unblock anything, which is a gate that cannot open. The
 * mirror of a check that cannot fail, and just as useless.
 *
 * What it deliberately does NOT gate: work that is neither ambiguous nor customer-facing, at any
 * maturity. Inventing a stricter rule would stall the ordinary internal task the organization
 * exists to get through, and it would look like rigour while doing it.
 */
export function readinessOf(
  chart: OrgChart,
  profile: RequirementProfile,
  maturity: RequirementMaturity,
  waivers: readonly Waiver[] = [],
): ReadinessResult {
  if (maturity === "implementation_ready") return { ok: true, via: "implementation_ready" };

  const causes: WaiverKind[] = [];
  if (isAmbiguous(profile)) causes.push(WaiverKind.NoDiscovery);
  if (profile.customerFacing) causes.push(WaiverKind.NoBrd);
  if (causes.length === 0) return { ok: true, via: "not_gated" };

  // EVERY waiver is validated, including ones covering nothing here. A malformed waiver in the set
  // is a defect wherever it points, and skipping the check for irrelevant ones means the same
  // signature passes unexamined until the day it matters.
  for (const w of waivers) {
    if (w.reason.trim() === "") {
      return {
        ok: false,
        refusal: ReadinessRefusal.WaiverUnexplained,
        reason: `a '${w.kind}' waiver states no reason`,
      };
    }
    if (!waiverApprovers(chart, w.kind).includes(w.approvedByHatId)) {
      return {
        ok: false,
        refusal: ReadinessRefusal.WaiverUnauthorized,
        reason: `'${w.approvedByHatId}' may not waive '${w.kind}'`,
      };
    }
  }

  const waived = new Set<string>(waivers.map((w) => w.kind));
  // EVERY cause must be covered. A no-discovery waiver on a customer-facing item still leaves the
  // BRD decision unmade, and accepting one approval for both is how a signature comes to stand for
  // a decision nobody took.
  const uncovered = causes.filter((c) => !waived.has(c));
  if (uncovered.length > 0) {
    return {
      ok: false,
      refusal: waivers.length === 0 ? ReadinessRefusal.Immature : ReadinessRefusal.WaiverDoesNotCover,
      reason: `'${profile.requirementId}' is ${uncovered.map(describeCause).join(" and ")}, and has not reached implementation_ready`,
    };
  }
  return { ok: true, via: "waiver" };
}

function describeCause(kind: WaiverKind): string {
  return kind === WaiverKind.NoDiscovery ? "ambiguous with no discovery waived" : "customer-facing with no BRD waived";
}
