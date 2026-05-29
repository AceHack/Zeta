import { deepEqual } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  BusinessRuleEvaluationStatus,
  QualityGateKind,
  QualityGateOutcome,
} from "../../domain/src/index.ts";
import {
  CockroachQualityGateEvaluationStateReaderStatement,
  createCockroachQualityGateEvaluationStateReader,
  type CockroachQualityGateEvaluationSqlExecutor,
  type CockroachQualityGateEvaluationSqlStatement,
} from "../src/index.ts";

describe("cockroach quality gate evaluation state reader", () => {
  test("reads quality gate evaluations behind the generic company policy evidence port", async () => {
    const executor = createRecordingExecutor();
    const reader = createCockroachQualityGateEvaluationStateReader({ executor });

    const evaluations = await reader.listQualityGateEvaluationsForWorkItem({
      organizationId: "org-lfg",
      projectId: "project-agentic-org",
      teamId: "team-runtime",
      workItemId: "work-runtime-001",
    });

    deepEqual(executor.statements.map((statement) => statement.name), [
      CockroachQualityGateEvaluationStateReaderStatement.ListQualityGateEvaluationsForWorkItem,
    ]);
    deepEqual(executor.statements[0]?.parameters, [
      "org-lfg",
      "project-agentic-org",
      "work-runtime-001",
      "team-runtime",
    ]);
    deepEqual(evaluations, [
      {
        qualityGateEvaluationId: "quality-gate-evaluation-001",
        organizationId: "org-lfg",
        projectId: "project-agentic-org",
        teamId: "team-runtime",
        workItemId: "work-runtime-001",
        discussionAnchorId: "discussion-anchor-gate-001",
        gateKind: QualityGateKind.FinalBusinessValidation,
        outcome: QualityGateOutcome.Approved,
        summary: "Final business validation approved.",
        evaluatedArtifactIds: ["brd-001", "qa-report-001"],
        businessRuleResults: [
          {
            ruleId: "BRD-001",
            status: BusinessRuleEvaluationStatus.Satisfied,
            evidenceArtifactIds: ["qa-report-001"],
            notes: "The implementation satisfies the rule.",
          },
        ],
        evaluatedAt: "2026-05-29T15:00:00.000Z",
        evaluatedBy: {
          agentId: "agent-business-reviewer-001",
          hatAssignmentId: "hat-assignment-business-reviewer-001",
        },
        metadata: {
          updatedAt: "2026-05-29T15:00:00.000Z",
          version: 1,
          correlationId: "corr-quality-gate-001",
          causationId: "cause-quality-gate-001",
          traceId: "trace-quality-gate-001",
        },
      },
    ]);
  });

  test("drops malformed durable rows instead of granting policy evidence", async () => {
    const executor = createRecordingExecutor({
      gateKind: "fake_gate",
      outcome: "rubber_stamped",
    });
    const reader = createCockroachQualityGateEvaluationStateReader({ executor });

    deepEqual(
      await reader.listQualityGateEvaluationsForWorkItem({
        organizationId: "org-lfg",
        projectId: "project-agentic-org",
        workItemId: "work-runtime-001",
      }),
      [],
    );
  });
});

function createRecordingExecutor(
  input: {
    gateKind?: unknown;
    outcome?: unknown;
  } = {},
): CockroachQualityGateEvaluationSqlExecutor & {
  statements: CockroachQualityGateEvaluationSqlStatement[];
} {
  const statements: CockroachQualityGateEvaluationSqlStatement[] = [];

  return {
    statements,
    execute: async <Row = Record<string, unknown>>(statement: CockroachQualityGateEvaluationSqlStatement) => {
      statements.push(statement);

      return {
        rows: [
          {
            quality_gate_evaluation_id: "quality-gate-evaluation-001",
            organization_id: "org-lfg",
            project_id: "project-agentic-org",
            team_id: "team-runtime",
            work_item_id: "work-runtime-001",
            discussion_anchor_id: "discussion-anchor-gate-001",
            gate_kind: input.gateKind ?? QualityGateKind.FinalBusinessValidation,
            outcome: input.outcome ?? QualityGateOutcome.Approved,
            summary: "Final business validation approved.",
            evaluated_artifact_ids: ["brd-001", "qa-report-001"],
            business_rule_results: [
              {
                ruleId: "BRD-001",
                status: BusinessRuleEvaluationStatus.Satisfied,
                evidenceArtifactIds: ["qa-report-001"],
                notes: "The implementation satisfies the rule.",
              },
            ],
            evaluated_by_agent_id: "agent-business-reviewer-001",
            evaluated_by_hat_assignment_id: "hat-assignment-business-reviewer-001",
            evaluated_at: new Date("2026-05-29T15:00:00.000Z"),
            updated_at: new Date("2026-05-29T15:00:00.000Z"),
            version: "1",
            correlation_id: "corr-quality-gate-001",
            causation_id: "cause-quality-gate-001",
            trace_id: "trace-quality-gate-001",
          },
        ] as readonly unknown[] as readonly Row[],
      };
    },
  };
}
