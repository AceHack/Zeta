import { QualityGateKind, QualityGateOutcome, type QualityGateEvaluation } from "./records.ts";

export const CompanyWorkPolicyVersion = {
  DefaultV0: "company-work-os-v0",
} as const;

export type CompanyWorkPolicyVersion =
  (typeof CompanyWorkPolicyVersion)[keyof typeof CompanyWorkPolicyVersion];

export const CompanyWorkPolicyDecisionStatus = {
  Allowed: "allowed",
  Denied: "denied",
} as const;

export type CompanyWorkPolicyDecisionStatus =
  (typeof CompanyWorkPolicyDecisionStatus)[keyof typeof CompanyWorkPolicyDecisionStatus];

export const CompanyWorkPolicyDenialReason = {
  QualityGateHistoryUnavailable: "quality_gate_history_unavailable",
  RequiredPriorQualityGateIncomplete: "required_prior_quality_gate_incomplete",
} as const;

export type CompanyWorkPolicyDenialReason =
  (typeof CompanyWorkPolicyDenialReason)[keyof typeof CompanyWorkPolicyDenialReason];

export type CompanyWorkPolicyDecision =
  | {
      status: typeof CompanyWorkPolicyDecisionStatus.Allowed;
      policyVersion: CompanyWorkPolicyVersion;
    }
  | {
      status: typeof CompanyWorkPolicyDecisionStatus.Denied;
      policyVersion: CompanyWorkPolicyVersion;
      reason: CompanyWorkPolicyDenialReason;
      missingGateKinds: readonly QualityGateKind[];
    };

export type QualityGateSequencePolicy = {
  policyVersion: CompanyWorkPolicyVersion;
  orderedGateKinds: readonly QualityGateKind[];
  satisfyingOutcomes: readonly QualityGateOutcome[];
};

export type EvaluateQualityGateSequencePolicyInput = {
  gateKind: QualityGateKind;
  outcome: QualityGateOutcome;
  priorEvaluations?: readonly QualityGateEvaluation[] | undefined;
  policy?: QualityGateSequencePolicy | undefined;
};

export const DefaultCompanyQualityGateSequencePolicy: QualityGateSequencePolicy = {
  policyVersion: CompanyWorkPolicyVersion.DefaultV0,
  orderedGateKinds: [
    QualityGateKind.CustomerRfpReview,
    QualityGateKind.BrdApproval,
    QualityGateKind.ArchitectureApproval,
    QualityGateKind.ImplementationReview,
    QualityGateKind.RuntimeValidation,
    QualityGateKind.FinalBusinessValidation,
    QualityGateKind.ReleaseReadiness,
  ],
  satisfyingOutcomes: [QualityGateOutcome.Approved, QualityGateOutcome.Waived],
} as const;

export function evaluateQualityGateSequencePolicy(
  input: EvaluateQualityGateSequencePolicyInput,
): CompanyWorkPolicyDecision {
  const policy = input.policy ?? DefaultCompanyQualityGateSequencePolicy;

  if (input.outcome !== QualityGateOutcome.Approved) {
    return createAllowedPolicyDecision(policy);
  }

  const requiredGateKinds = listRequiredPriorGateKinds(input.gateKind, policy);

  if (requiredGateKinds.length === 0) {
    return createAllowedPolicyDecision(policy);
  }

  if (input.priorEvaluations === undefined) {
    return {
      status: CompanyWorkPolicyDecisionStatus.Denied,
      policyVersion: policy.policyVersion,
      reason: CompanyWorkPolicyDenialReason.QualityGateHistoryUnavailable,
      missingGateKinds: requiredGateKinds,
    };
  }

  const missingGateKinds = requiredGateKinds.filter(
    (gateKind) => !hasSatisfyingGateEvaluation(gateKind, input.priorEvaluations ?? [], policy),
  );

  if (missingGateKinds.length > 0) {
    return {
      status: CompanyWorkPolicyDecisionStatus.Denied,
      policyVersion: policy.policyVersion,
      reason: CompanyWorkPolicyDenialReason.RequiredPriorQualityGateIncomplete,
      missingGateKinds,
    };
  }

  return createAllowedPolicyDecision(policy);
}

function listRequiredPriorGateKinds(
  gateKind: QualityGateKind,
  policy: QualityGateSequencePolicy,
): readonly QualityGateKind[] {
  const gateIndex = policy.orderedGateKinds.indexOf(gateKind);

  return gateIndex <= 0 ? [] : policy.orderedGateKinds.slice(0, gateIndex);
}

function hasSatisfyingGateEvaluation(
  gateKind: QualityGateKind,
  evaluations: readonly QualityGateEvaluation[],
  policy: QualityGateSequencePolicy,
): boolean {
  return evaluations.some(
    (evaluation) =>
      evaluation.gateKind === gateKind && policy.satisfyingOutcomes.includes(evaluation.outcome),
  );
}

function createAllowedPolicyDecision(policy: QualityGateSequencePolicy): CompanyWorkPolicyDecision {
  return {
    status: CompanyWorkPolicyDecisionStatus.Allowed,
    policyVersion: policy.policyVersion,
  };
}
