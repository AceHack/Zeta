// Constitution ratification gate — explicit DUs, no buried logic.
//
// This module is FULLY SELF-CONTAINED. It does NOT reference any vote-tally
// module or VoteRecord type (no such artifacts exist in this repo).
//
// A constitution proposal is ratified when at least `quorum` DISTINCT agents
// have agreed AND no agent has objected. Objections veto with highest
// precedence. A single agent agreeing multiple times counts ONCE — no
// self-amplification.

/**
 * Lifecycle states of a constitution ratification.
 *
 * `Superseded` is part of the DU for lifecycle completeness (a ratified
 * constitution may later be replaced by a newer one), but it is NEVER
 * produced by the pure `evaluateConstitutionRatification` evaluation below —
 * supersession is a lifecycle transition driven by external state, not by
 * the agreement set.
 */
export const ConstitutionRatificationState = {
  Proposed: "proposed",
  Gathering: "gathering",
  Ratified: "ratified",
  Rejected: "rejected",
  Superseded: "superseded",
} as const;
export type ConstitutionRatificationState =
  (typeof ConstitutionRatificationState)[keyof typeof ConstitutionRatificationState];

/** A single agent's decision on a constitution proposal. */
export const ConstitutionDecision = {
  Agree: "agree",
  Object: "object",
} as const;
export type ConstitutionDecision =
  (typeof ConstitutionDecision)[keyof typeof ConstitutionDecision];

/** One agent's agreement (or objection) record. */
export type ConstitutionAgreement = {
  agentId: string;
  hatAssignmentId: string;
  decision: ConstitutionDecision;
  rationale: string;
};

/** Default quorum: at least 3 distinct agents must agree to ratify. */
export const DEFAULT_CONSTITUTION_QUORUM = 3;

/** Pure evaluation result. */
export type ConstitutionRatificationResult = {
  state: ConstitutionRatificationState;
  distinctAgreeAgents: number;
  quorum: number;
  objections: number;
  reason: string;
};

/**
 * Evaluate the ratification state of a constitution proposal from its
 * agreement set.
 *
 * Rules (all explicit, none buried):
 *  - quorum = input.quorum ?? DEFAULT_CONSTITUTION_QUORUM, floored to >= 1.
 *  - objections = count of agreements with decision === Object.
 *  - distinctAgreeAgents = size of the Set of agentId over agreements with
 *    decision === Agree (a single agent agreeing twice counts once).
 *  - state precedence:
 *      objections > 0                      -> Rejected (objection veto)
 *      else distinctAgreeAgents >= quorum  -> Ratified
 *      else agreements.length > 0          -> Gathering
 *      else                                -> Proposed
 *
 * `Superseded` is never produced here (see DU doc above).
 */
export function evaluateConstitutionRatification(input: {
  agreements: readonly ConstitutionAgreement[];
  quorum?: number;
}): ConstitutionRatificationResult {
  const requestedQuorum = input.quorum ?? DEFAULT_CONSTITUTION_QUORUM;
  const quorum = requestedQuorum < 1 ? 1 : requestedQuorum;

  let objections = 0;
  const distinctAgree = new Set<string>();
  for (const agreement of input.agreements) {
    if (agreement.decision === ConstitutionDecision.Object) {
      objections += 1;
    } else if (agreement.decision === ConstitutionDecision.Agree) {
      distinctAgree.add(agreement.agentId);
    }
  }
  const distinctAgreeAgents = distinctAgree.size;

  if (objections > 0) {
    return {
      state: ConstitutionRatificationState.Rejected,
      distinctAgreeAgents,
      quorum,
      objections,
      reason: `rejected: ${objections} objection(s) veto ratification`,
    };
  }
  if (distinctAgreeAgents >= quorum) {
    return {
      state: ConstitutionRatificationState.Ratified,
      distinctAgreeAgents,
      quorum,
      objections,
      reason: `ratified: ${distinctAgreeAgents} distinct agreeing agent(s) >= quorum ${quorum}, no objections`,
    };
  }
  if (input.agreements.length > 0) {
    return {
      state: ConstitutionRatificationState.Gathering,
      distinctAgreeAgents,
      quorum,
      objections,
      reason: `gathering: ${distinctAgreeAgents} distinct agreeing agent(s) < quorum ${quorum}`,
    };
  }
  return {
    state: ConstitutionRatificationState.Proposed,
    distinctAgreeAgents,
    quorum,
    objections,
    reason: "proposed: no agreements recorded yet",
  };
}
