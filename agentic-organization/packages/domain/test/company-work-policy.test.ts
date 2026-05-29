import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  CompanyWorkPolicyDecisionStatus,
  CompanyWorkPolicyDenialReason,
  QualityGateKind,
  QualityGateOutcome,
  evaluateQualityGateSequencePolicy,
  type QualityGateEvaluation,
} from "../src/index.ts";

describe("company Work OS policy", () => {
  test("allows the first quality gate approval without prior gate evidence", () => {
    const decision = evaluateQualityGateSequencePolicy({
      gateKind: QualityGateKind.CustomerRfpReview,
      outcome: QualityGateOutcome.Approved,
    });

    equal(decision.status, CompanyWorkPolicyDecisionStatus.Allowed);
  });

  test("requires prior company quality gates before approving later gates", () => {
    const decision = evaluateQualityGateSequencePolicy({
      gateKind: QualityGateKind.ReleaseReadiness,
      outcome: QualityGateOutcome.Approved,
      priorEvaluations: [
        createQualityGateEvaluation(QualityGateKind.CustomerRfpReview, QualityGateOutcome.Approved),
        createQualityGateEvaluation(QualityGateKind.BrdApproval, QualityGateOutcome.Approved),
        createQualityGateEvaluation(QualityGateKind.ArchitectureApproval, QualityGateOutcome.Approved),
        createQualityGateEvaluation(QualityGateKind.ImplementationReview, QualityGateOutcome.Approved),
        createQualityGateEvaluation(QualityGateKind.RuntimeValidation, QualityGateOutcome.Approved),
      ],
    });

    equal(decision.status, CompanyWorkPolicyDecisionStatus.Denied);
    if (decision.status === CompanyWorkPolicyDecisionStatus.Denied) {
      equal(decision.reason, CompanyWorkPolicyDenialReason.RequiredPriorQualityGateIncomplete);
      deepEqual(decision.missingGateKinds, [QualityGateKind.FinalBusinessValidation]);
    }
  });

  test("treats approved and waived prior gates as satisfying the company sequence", () => {
    const decision = evaluateQualityGateSequencePolicy({
      gateKind: QualityGateKind.FinalBusinessValidation,
      outcome: QualityGateOutcome.Approved,
      priorEvaluations: [
        createQualityGateEvaluation(QualityGateKind.CustomerRfpReview, QualityGateOutcome.Approved),
        createQualityGateEvaluation(QualityGateKind.BrdApproval, QualityGateOutcome.Waived),
        createQualityGateEvaluation(QualityGateKind.ArchitectureApproval, QualityGateOutcome.Approved),
        createQualityGateEvaluation(QualityGateKind.ImplementationReview, QualityGateOutcome.Approved),
        createQualityGateEvaluation(QualityGateKind.RuntimeValidation, QualityGateOutcome.Approved),
      ],
    });

    equal(decision.status, CompanyWorkPolicyDecisionStatus.Allowed);
  });

  test("allows changes-requested evidence to be recorded without prior gate completion", () => {
    const decision = evaluateQualityGateSequencePolicy({
      gateKind: QualityGateKind.ReleaseReadiness,
      outcome: QualityGateOutcome.ChangesRequested,
    });

    equal(decision.status, CompanyWorkPolicyDecisionStatus.Allowed);
  });
});

function createQualityGateEvaluation(
  gateKind: QualityGateKind,
  outcome: QualityGateOutcome,
): QualityGateEvaluation {
  return {
    qualityGateEvaluationId: `quality-gate-evaluation-${gateKind}`,
    organizationId: "org-lfg",
    projectId: "project-agentic-org",
    workItemId: "work-runtime-001",
    discussionAnchorId: "discussion-anchor-gate-001",
    gateKind,
    outcome,
    summary: `${gateKind} ${outcome}.`,
    evaluatedArtifactIds: [`artifact-${gateKind}`],
    businessRuleResults: [],
    evaluatedAt: "2026-05-29T14:45:00.000Z",
    evaluatedBy: {
      agentId: "agent-business-reviewer-001",
      hatAssignmentId: "hat-assignment-business-reviewer-001",
    },
    metadata: {
      updatedAt: "2026-05-29T14:45:00.000Z",
      version: 1,
      correlationId: "corr-quality-gate-001",
      causationId: "cause-quality-gate-001",
      traceId: "trace-quality-gate-001",
    },
  };
}
