export type ZetaDbAdmissionResource = "retained-events" | "checkpoint-bytes";

export interface ZetaDbAdmissionProposal {
  readonly resource: ZetaDbAdmissionResource;
  readonly current: number;
  readonly candidate: number;
  readonly limit: number;
}

export interface ZetaDbAdmissionAccounting {
  readonly resource: ZetaDbAdmissionResource;
  readonly current: number;
  readonly candidate: number;
  readonly hardLimit: number;
  readonly effectiveLimit: number;
  readonly reserved: number;
}

export interface ZetaDbAdmissionReceipt extends ZetaDbAdmissionAccounting {
  readonly policyId: string;
}

export type ZetaDbAdmissionDecision =
  | { readonly action: "admit" }
  | {
      readonly action: "backpressure";
      readonly detail: string;
      readonly accounting?: ZetaDbAdmissionAccounting;
    };

/** Pure policy port. The node remains responsible for applying an admitted proposal. */
export interface ZetaDbAdmissionPolicyPort {
  /** Stable diagnostic identity; callers execute `decide` instead of branching on this value. */
  readonly id: string;
  decide(proposal: ZetaDbAdmissionProposal): ZetaDbAdmissionDecision;
}

export interface ZetaDbReservedCapacity {
  readonly retainedEvents: number;
  readonly checkpointBytes: number;
}

export interface ZetaDbAdmissionPolicyConfigurationFeedback {
  readonly code: "database-admission-policy-configuration-invalid";
  readonly detail: string;
}

export type ZetaDbAdmissionPolicyConfigurationResult =
  | { readonly ok: true; readonly value: ZetaDbAdmissionPolicyPort }
  | { readonly ok: false; readonly feedback: ZetaDbAdmissionPolicyConfigurationFeedback };

function accounting(proposal: ZetaDbAdmissionProposal, reserved: number): ZetaDbAdmissionAccounting {
  return {
    resource: proposal.resource,
    current: proposal.current,
    candidate: proposal.candidate,
    hardLimit: proposal.limit,
    effectiveLimit: proposal.limit - reserved,
    reserved,
  };
}

function backpressureDetail(value: ZetaDbAdmissionAccounting): string {
  const unit = value.resource === "retained-events" ? "entries" : "bytes";
  return `The reserved-capacity policy held ${String(value.reserved)} ${unit}; candidate ${String(value.candidate)} exceeds the effective limit ${String(value.effectiveLimit)} of ${String(value.hardLimit)}.`;
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isReservation(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/**
 * Hold deterministic headroom inside the caller's hard limits. The reservation may refuse
 * earlier than the kernel, but it never changes the hard entry or byte ceiling.
 */
export function createReservedCapacityAdmissionPolicy(
  configuration: ZetaDbReservedCapacity,
): ZetaDbAdmissionPolicyConfigurationResult {
  if (
    !isRecord(configuration) ||
    !isReservation(configuration.retainedEvents) ||
    !isReservation(configuration.checkpointBytes)
  ) {
    return {
      ok: false,
      feedback: {
        code: "database-admission-policy-configuration-invalid",
        detail: "Reserved database capacity requires non-negative safe-integer entry and byte amounts.",
      },
    };
  }

  const retainedEvents = configuration.retainedEvents;
  const checkpointBytes = configuration.checkpointBytes;
  return {
    ok: true,
    value: {
      id: "reserved-capacity",
      decide: (proposal) => {
        const configured = proposal.resource === "retained-events" ? retainedEvents : checkpointBytes;
        const reserved = Math.min(configured, proposal.limit);
        const value = accounting(proposal, reserved);
        return proposal.candidate <= value.effectiveLimit
          ? { action: "admit" }
          : { action: "backpressure", detail: backpressureDetail(value), accounting: value };
      },
    },
  };
}

/**
 * Preserve every admitted event. A proposal that would cross either finite bound is refused;
 * no retained event is displaced or erased to make room.
 */
export const noForgetBackpressureAdmissionPolicy: ZetaDbAdmissionPolicyPort = {
  id: "no-forget-backpressure",
  decide: (proposal) => {
    if (proposal.candidate <= proposal.limit) return { action: "admit" };
    const value = accounting(proposal, 0);
    return proposal.resource === "retained-events"
      ? {
          action: "backpressure",
          detail: `The retained event ledger reached its ${String(proposal.limit)}-entry no-forget budget.`,
          accounting: value,
        }
      : {
          action: "backpressure",
          detail: `The next database image needs ${String(proposal.candidate)} bytes; the no-forget checkpoint budget is ${String(proposal.limit)} bytes.`,
          accounting: value,
        };
  },
};
