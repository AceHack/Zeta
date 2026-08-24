export type ZetaDbAdmissionResource = "retained-events" | "checkpoint-bytes";

export interface ZetaDbAdmissionProposal {
  readonly resource: ZetaDbAdmissionResource;
  readonly current: number;
  readonly candidate: number;
  readonly limit: number;
}

export type ZetaDbAdmissionDecision =
  | { readonly action: "admit" }
  | {
      readonly action: "backpressure";
      readonly detail: string;
    };

/** Pure policy port. The node remains responsible for applying an admitted proposal. */
export interface ZetaDbAdmissionPolicyPort {
  /** Stable diagnostic identity; callers execute `decide` instead of branching on this value. */
  readonly id: string;
  decide(proposal: ZetaDbAdmissionProposal): ZetaDbAdmissionDecision;
}

/**
 * Preserve every admitted event. A proposal that would cross either finite bound is refused;
 * no retained event is displaced or erased to make room.
 */
export const noForgetBackpressureAdmissionPolicy: ZetaDbAdmissionPolicyPort = {
  id: "no-forget-backpressure",
  decide: (proposal) => {
    if (proposal.candidate <= proposal.limit) return { action: "admit" };
    return proposal.resource === "retained-events"
      ? {
          action: "backpressure",
          detail: `The retained event ledger reached its ${String(proposal.limit)}-entry no-forget budget.`,
        }
      : {
          action: "backpressure",
          detail: `The next database image needs ${String(proposal.candidate)} bytes; the no-forget checkpoint budget is ${String(proposal.limit)} bytes.`,
        };
  },
};
