import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  QualityGateKind,
  QualityGateOutcome,
  type QualityGateEvaluation,
} from "../../domain/src/index.ts";
import { createInMemoryQualityGateEvaluationStateReader } from "../src/index.ts";

describe("in-memory quality gate evaluation state reader", () => {
  test("returns quality gate evaluations for a scoped work item in durable order", async () => {
    const reader = createInMemoryQualityGateEvaluationStateReader({
      getQualityGateEvaluations: () => [
        createQualityGateEvaluation({
          qualityGateEvaluationId: "quality-gate-evaluation-002",
          gateKind: QualityGateKind.BrdApproval,
          evaluatedAt: "2026-05-29T15:00:00.000Z",
        }),
        createQualityGateEvaluation({
          qualityGateEvaluationId: "quality-gate-evaluation-other-work",
          workItemId: "work-other-001",
          gateKind: QualityGateKind.CustomerRfpReview,
          evaluatedAt: "2026-05-29T14:00:00.000Z",
        }),
        createQualityGateEvaluation({
          qualityGateEvaluationId: "quality-gate-evaluation-001",
          gateKind: QualityGateKind.CustomerRfpReview,
          evaluatedAt: "2026-05-29T14:00:00.000Z",
        }),
      ],
    });

    const evaluations = await reader.listQualityGateEvaluationsForWorkItem({
      organizationId: "org-lfg",
      projectId: "project-agentic-org",
      teamId: "team-runtime",
      workItemId: "work-runtime-001",
    });

    deepEqual(
      evaluations.map((evaluation) => evaluation.qualityGateEvaluationId),
      ["quality-gate-evaluation-001", "quality-gate-evaluation-002"],
    );
  });

  test("returns cloned evaluations so callers cannot mutate stored state", async () => {
    const sourceEvaluation = createQualityGateEvaluation({
      gateKind: QualityGateKind.CustomerRfpReview,
    });
    const reader = createInMemoryQualityGateEvaluationStateReader({
      getQualityGateEvaluations: () => [sourceEvaluation],
    });

    const evaluations = await reader.listQualityGateEvaluationsForWorkItem({
      organizationId: "org-lfg",
      projectId: "project-agentic-org",
      workItemId: "work-runtime-001",
    });
    (evaluations[0]?.evaluatedArtifactIds as string[]).push("mutated-artifact");

    equal(sourceEvaluation.evaluatedArtifactIds.includes("mutated-artifact"), false);
  });
});

function createQualityGateEvaluation(
  input: Partial<QualityGateEvaluation> & Pick<QualityGateEvaluation, "gateKind">,
): QualityGateEvaluation {
  return {
    qualityGateEvaluationId: input.qualityGateEvaluationId ?? `quality-gate-evaluation-${input.gateKind}`,
    organizationId: input.organizationId ?? "org-lfg",
    projectId: input.projectId ?? "project-agentic-org",
    teamId: input.teamId ?? "team-runtime",
    workItemId: input.workItemId ?? "work-runtime-001",
    discussionAnchorId: input.discussionAnchorId ?? "discussion-anchor-gate-001",
    gateKind: input.gateKind,
    outcome: input.outcome ?? QualityGateOutcome.Approved,
    summary: input.summary ?? `${input.gateKind} approved.`,
    evaluatedArtifactIds: input.evaluatedArtifactIds ?? [`artifact-${input.gateKind}`],
    businessRuleResults: input.businessRuleResults ?? [],
    evaluatedAt: input.evaluatedAt ?? "2026-05-29T14:45:00.000Z",
    evaluatedBy: input.evaluatedBy ?? {
      agentId: "agent-business-reviewer-001",
      hatAssignmentId: "hat-assignment-business-reviewer-001",
    },
    metadata: input.metadata ?? {
      updatedAt: "2026-05-29T14:45:00.000Z",
      version: 1,
      correlationId: "corr-quality-gate-001",
      causationId: "cause-quality-gate-001",
      traceId: "trace-quality-gate-001",
    },
  };
}
