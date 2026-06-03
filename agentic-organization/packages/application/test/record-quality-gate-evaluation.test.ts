import { deepEqual, equal, ok } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  AgenticAggregateType,
  AgenticEventType,
  BusinessRuleEvaluationStatus,
  CommandType,
  DiscussionAnchorType,
  DiscussionExpectedOutput,
  QualityGateKind,
  QualityGateOutcome,
  type QualityGateEvaluation,
  type DiscussionAnchor,
  WorkItemState,
  WorkItemType,
} from "../../domain/src/index.ts";
import {
  CommandErrorCode,
  CommandResultArtifactType,
  CommandResultStatus,
  createContentAddressedEvidenceArtifact,
  createContentAddressedEvidenceRef,
  type CommandResult,
} from "../src/index.ts";
import {
  recordQualityGateEvaluation,
  type RecordQualityGateEvaluationCommand,
} from "../src/handlers/record-quality-gate-evaluation.ts";
import type {
  CommandWorkAnchorWorkItem,
  DiscussionAnchorStateReaderPort,
  QualityGateEvaluationStateReaderPort,
  WorkAnchorStateReaderPort,
} from "../src/ports.ts";

const command: RecordQualityGateEvaluationCommand = {
  commandId: "cmd-quality-gate-001",
  type: CommandType.RecordQualityGateEvaluation,
  idempotencyKey: "idem-quality-gate-001",
  requestHash: "hash-quality-gate-001",
  correlationId: "corr-quality-gate-001",
  causationId: "cause-quality-gate-001",
  traceId: "trace-quality-gate-001",
  organizationId: "org-lfg",
  projectId: "project-agentic-org",
  actor: {
    agentId: "agent-business-reviewer-001",
    hatAssignmentId: "hat-assignment-business-reviewer-001",
  },
  teamId: "team-runtime",
  workItemId: "work-runtime-001",
  discussionAnchorId: "discussion-anchor-gate-001",
  gateKind: QualityGateKind.FinalBusinessValidation,
  outcome: QualityGateOutcome.Approved,
  summary: "The delivered feature satisfies the BRD and can proceed to release readiness.",
  evaluatedArtifactIds: [
    evidenceRef("brd", "brd-001"),
    evidenceRef("test-run", "qa-report-001"),
    evidenceRef("trace", "trace-report-001"),
  ],
  evidenceArtifacts: [
    evidenceArtifact("brd", "brd-001"),
    evidenceArtifact("test-run", "qa-report-001"),
    evidenceArtifact("trace", "trace-report-001"),
    evidenceArtifact("decision", "decision-record-001"),
  ],
  businessRuleResults: [
    {
      ruleId: "BRD-001",
      status: BusinessRuleEvaluationStatus.Satisfied,
      evidenceArtifactIds: [evidenceRef("test-run", "qa-report-001")],
      notes: "The implemented behavior matches the approved business rule.",
    },
    {
      ruleId: "BRD-002",
      status: BusinessRuleEvaluationStatus.ChangedByDecision,
      evidenceArtifactIds: [evidenceRef("decision", "decision-record-001")],
      notes: "The Product Owner accepted the changed behavior in a recorded decision.",
    },
  ],
};

describe("record quality gate evaluation handler", () => {
  test("records final business validation against a gate-capable discussion anchor", async () => {
    const outcome = await recordQualityGateEvaluation(command, {
      now: () => "2026-05-29T15:00:00.000Z",
      createId: (prefix) => `${prefix}-001`,
      discussionAnchorStateReader: createDiscussionAnchorStateReader(createDiscussionAnchor()),
      qualityGateEvaluationStateReader: createQualityGateEvaluationStateReader(
        createSatisfiedPriorQualityGateChain(QualityGateKind.FinalBusinessValidation),
      ),
      workAnchorStateReader: createWorkAnchorStateReader([createWorkItem(command.workItemId)]),
    });
    const result = outcome.result as CommandResult;

    equal(result.status, CommandResultStatus.Accepted);
    ok(result.qualityGateEvaluation);
    deepEqual(result.artifacts, [
      {
        artifactType: CommandResultArtifactType.QualityGateEvaluation,
        artifactId: "quality-gate-evaluation-001",
        label: command.gateKind,
      },
    ]);
    deepEqual(result.emittedEvents, [
      {
        eventId: "evt-001",
        eventType: AgenticEventType.QualityGateEvaluated,
        aggregateId: "quality-gate-evaluation-001",
        aggregateType: AgenticAggregateType.QualityGateEvaluation,
      },
    ]);
    deepEqual(outcome.effects.qualityGateEvaluations, [
      {
        qualityGateEvaluationId: "quality-gate-evaluation-001",
        organizationId: command.organizationId,
        projectId: command.projectId,
        teamId: command.teamId,
        workItemId: command.workItemId,
        discussionAnchorId: command.discussionAnchorId,
        gateKind: command.gateKind,
        outcome: command.outcome,
        summary: command.summary,
        evaluatedArtifactIds: command.evaluatedArtifactIds,
        businessRuleResults: command.businessRuleResults,
        evaluatedAt: "2026-05-29T15:00:00.000Z",
        evaluatedBy: command.actor,
        metadata: {
          updatedAt: "2026-05-29T15:00:00.000Z",
          version: 1,
          correlationId: command.correlationId,
          causationId: command.causationId,
          traceId: command.traceId,
        },
      },
    ]);
    deepEqual(outcome.effects.docConsultOutcomeStamps, [
      {
        organizationId: command.organizationId,
        agentId: command.actor.agentId,
        hatAssignmentId: command.actor.hatAssignmentId,
        projectId: command.projectId,
        teamId: command.teamId,
        workItemId: command.workItemId,
        outcome: command.outcome,
        outcomeRef: "quality_gate:quality-gate-evaluation-001",
        outcomeRecordedAt: "2026-05-29T15:00:00.000Z",
      },
    ]);
    deepEqual(outcome.effects.outboxEvents[0]?.envelope.payload, {
      discussionAnchorId: command.discussionAnchorId,
      gateKind: command.gateKind,
      outcome: command.outcome,
      summary: command.summary,
      evaluatedArtifactIds: command.evaluatedArtifactIds,
      businessRuleResults: command.businessRuleResults,
    });
  });

  test("rejects final business approval when a business rule is not satisfied", async () => {
    const outcome = await recordQualityGateEvaluation(
      {
        ...command,
        businessRuleResults: [
          {
            ruleId: "BRD-003",
            status: BusinessRuleEvaluationStatus.NotSatisfied,
            evidenceArtifactIds: ["qa-report-002"],
            notes: "The required customer behavior is still missing.",
          },
        ],
      },
      {
        now: () => "2026-05-29T15:00:00.000Z",
        createId: (prefix) => `${prefix}-001`,
        discussionAnchorStateReader: createDiscussionAnchorStateReader(createDiscussionAnchor()),
        workAnchorStateReader: createWorkAnchorStateReader([createWorkItem(command.workItemId)]),
      },
    );

    equal(outcome.result.status, CommandResultStatus.Rejected);
    equal(outcome.result.error?.code, CommandErrorCode.ValidationFailed);
    equal(outcome.result.error?.message, "approved final business validation requires all business rules satisfied, not applicable, or changed by decision");
    equal(outcome.effects.qualityGateEvaluations.length, 0);
  });

  test("rejects quality gates when the related work item belongs to another team", async () => {
    const outcome = await recordQualityGateEvaluation(command, {
      now: () => "2026-05-29T15:00:00.000Z",
      createId: (prefix) => `${prefix}-001`,
      discussionAnchorStateReader: createDiscussionAnchorStateReader(createDiscussionAnchor()),
      qualityGateEvaluationStateReader: createQualityGateEvaluationStateReader(
        createSatisfiedPriorQualityGateChain(command.gateKind),
      ),
      workAnchorStateReader: createWorkAnchorStateReader([createTeamScopedWorkItem(command.workItemId, "team-other")]),
    });

    equal(outcome.result.status, CommandResultStatus.Rejected);
    equal(outcome.result.error?.code, CommandErrorCode.PreconditionFailed);
    equal(outcome.result.error?.message, "quality gate scope does not match the command scope");
    equal(outcome.effects.qualityGateEvaluations.length, 0);
  });

  test("rejects final business approval before prior company quality gates are satisfied", async () => {
    const outcome = await recordQualityGateEvaluation(command, {
      ...createDependencies(),
      qualityGateEvaluationStateReader: createQualityGateEvaluationStateReader([
        createQualityGateEvaluation(QualityGateKind.CustomerRfpReview),
        createQualityGateEvaluation(QualityGateKind.BrdApproval),
        createQualityGateEvaluation(QualityGateKind.ArchitectureApproval),
        createQualityGateEvaluation(QualityGateKind.ImplementationReview),
      ]),
    });

    equal(outcome.result.status, CommandResultStatus.Rejected);
    equal(outcome.result.error?.code, CommandErrorCode.PreconditionFailed);
    equal(outcome.result.error?.message, "quality gate company policy requires prior gates to be approved or waived");
    equal(outcome.effects.qualityGateEvaluations.length, 0);
  });

  test("rejects release readiness approval before final business validation is satisfied", async () => {
    const outcome = await recordQualityGateEvaluation(
      {
        ...command,
        gateKind: QualityGateKind.ReleaseReadiness,
        businessRuleResults: undefined,
      },
      {
        ...createDependencies(),
        qualityGateEvaluationStateReader: createQualityGateEvaluationStateReader([
          createQualityGateEvaluation(QualityGateKind.CustomerRfpReview),
          createQualityGateEvaluation(QualityGateKind.BrdApproval),
          createQualityGateEvaluation(QualityGateKind.ArchitectureApproval),
          createQualityGateEvaluation(QualityGateKind.ImplementationReview),
          createQualityGateEvaluation(QualityGateKind.RuntimeValidation),
        ]),
      },
    );

    equal(outcome.result.status, CommandResultStatus.Rejected);
    equal(outcome.result.error?.code, CommandErrorCode.PreconditionFailed);
    equal(outcome.result.error?.message, "quality gate company policy requires prior gates to be approved or waived");
    equal(outcome.effects.qualityGateEvaluations.length, 0);
  });

  test("records release readiness when the company quality gate chain is satisfied", async () => {
    const outcome = await recordQualityGateEvaluation(
      {
        ...command,
        gateKind: QualityGateKind.ReleaseReadiness,
        businessRuleResults: undefined,
      },
      {
        ...createDependencies(),
        qualityGateEvaluationStateReader: createQualityGateEvaluationStateReader([
          createQualityGateEvaluation(QualityGateKind.CustomerRfpReview),
          createQualityGateEvaluation(QualityGateKind.BrdApproval),
          createQualityGateEvaluation(QualityGateKind.ArchitectureApproval),
          createQualityGateEvaluation(QualityGateKind.ImplementationReview),
          createQualityGateEvaluation(QualityGateKind.RuntimeValidation),
          createQualityGateEvaluation(QualityGateKind.FinalBusinessValidation),
        ]),
      },
    );

    equal(outcome.result.status, CommandResultStatus.Accepted);
    equal(outcome.effects.qualityGateEvaluations[0]?.gateKind, QualityGateKind.ReleaseReadiness);
  });

  test("rejects quality gates without evaluated artifact evidence", async () => {
    const outcome = await recordQualityGateEvaluation(
      {
        ...command,
        gateKind: QualityGateKind.BrdApproval,
        evaluatedArtifactIds: [],
        businessRuleResults: undefined,
      },
      createDependencies(),
    );

    equal(outcome.result.status, CommandResultStatus.Rejected);
    equal(outcome.result.error?.code, CommandErrorCode.ValidationFailed);
    equal(outcome.result.error?.message, "quality gate evaluated artifact IDs are required");
    equal(outcome.effects.qualityGateEvaluations.length, 0);
  });

  test("rejects approved quality gates with forgeable plain evidence labels", async () => {
    const outcome = await recordQualityGateEvaluation(
      {
        ...command,
        evaluatedArtifactIds: ["brd-001", "qa-report-001", "trace-report-001"],
        businessRuleResults: [
          {
            ruleId: "BRD-001",
            status: BusinessRuleEvaluationStatus.Satisfied,
            evidenceArtifactIds: ["qa-report-001"],
            notes: "The implemented behavior matches the approved business rule.",
          },
        ],
      },
      createDependencies(),
    );

    equal(outcome.result.status, CommandResultStatus.Rejected);
    equal(outcome.result.error?.code, CommandErrorCode.ValidationFailed);
    equal(
      outcome.result.error?.message,
      "approved or waived quality gates require content-addressed evidence refs",
    );
    equal(outcome.effects.qualityGateEvaluations.length, 0);
  });

  test("rejects approved quality gates with forged content-addressed evidence refs", async () => {
    const forgedRef = `evidence:test-run:sha256:${"a".repeat(64)}`;
    const outcome = await recordQualityGateEvaluation(
      {
        ...command,
        evaluatedArtifactIds: [forgedRef],
        businessRuleResults: [
          {
            ruleId: "BRD-001",
            status: BusinessRuleEvaluationStatus.Satisfied,
            evidenceArtifactIds: [forgedRef],
            notes: "The implemented behavior matches the approved business rule.",
          },
        ],
        evidenceArtifacts: [evidenceArtifact("test-run", "qa-report-001")],
      },
      createDependencies(),
    );

    equal(outcome.result.status, CommandResultStatus.Rejected);
    equal(outcome.result.error?.code, CommandErrorCode.ValidationFailed);
    equal(
      outcome.result.error?.message,
      "approved or waived quality gates require content-addressed evidence refs",
    );
    equal(outcome.effects.qualityGateEvaluations.length, 0);
  });

  test("rejects malformed business rule evidence without throwing", async () => {
    const outcome = await recordQualityGateEvaluation(
      {
        ...command,
        businessRuleResults: [
          {
            ruleId: "BRD-004",
            status: BusinessRuleEvaluationStatus.Satisfied,
            notes: "Missing evidence should be a typed validation failure.",
          },
        ],
      } as unknown as RecordQualityGateEvaluationCommand,
      createDependencies(),
    );

    equal(outcome.result.status, CommandResultStatus.Rejected);
    equal(outcome.result.error?.code, CommandErrorCode.ValidationFailed);
    equal(outcome.result.error?.message, "quality gate business rule evidence artifact IDs must be string arrays");
    equal(outcome.effects.qualityGateEvaluations.length, 0);
  });

  test("rejects malformed business rule objects without throwing", async () => {
    const outcome = await recordQualityGateEvaluation(
      {
        ...command,
        businessRuleResults: [null],
      } as unknown as RecordQualityGateEvaluationCommand,
      createDependencies(),
    );

    equal(outcome.result.status, CommandResultStatus.Rejected);
    equal(outcome.result.error?.code, CommandErrorCode.ValidationFailed);
    equal(outcome.result.error?.message, "quality gate business rule results must be an array");
    equal(outcome.effects.qualityGateEvaluations.length, 0);
  });

  test("rejects quality gates without a gate-result discussion anchor", async () => {
    const outcome = await recordQualityGateEvaluation(command, {
      now: () => "2026-05-29T15:00:00.000Z",
      createId: (prefix) => `${prefix}-001`,
      discussionAnchorStateReader: createDiscussionAnchorStateReader({
        ...createDiscussionAnchor(),
        expectedOutputs: [DiscussionExpectedOutput.Decision],
      }),
      workAnchorStateReader: createWorkAnchorStateReader([createWorkItem(command.workItemId)]),
    });

    equal(outcome.result.status, CommandResultStatus.Rejected);
    equal(outcome.result.error?.code, CommandErrorCode.PreconditionFailed);
    equal(outcome.result.error?.message, "quality gate requires a discussion anchor expecting a gate result");
    equal(outcome.effects.qualityGateEvaluations.length, 0);
  });

  test("rejects quality gates when the anchored work item is missing", async () => {
    const outcome = await recordQualityGateEvaluation(command, {
      now: () => "2026-05-29T15:00:00.000Z",
      createId: (prefix) => `${prefix}-001`,
      discussionAnchorStateReader: createDiscussionAnchorStateReader(createDiscussionAnchor()),
      workAnchorStateReader: createWorkAnchorStateReader([]),
    });

    equal(outcome.result.status, CommandResultStatus.Rejected);
    equal(outcome.result.error?.code, CommandErrorCode.PreconditionFailed);
    equal(outcome.result.error?.message, "quality gate requires an existing related work item");
    equal(outcome.effects.qualityGateEvaluations.length, 0);
  });

  test("rejects quality gates when the work item reader returns a mismatched record", async () => {
    const outcome = await recordQualityGateEvaluation(command, {
      now: () => "2026-05-29T15:00:00.000Z",
      createId: (prefix) => `${prefix}-001`,
      discussionAnchorStateReader: createDiscussionAnchorStateReader(createDiscussionAnchor()),
      workAnchorStateReader: createMismatchedWorkAnchorStateReader(),
    });

    equal(outcome.result.status, CommandResultStatus.Rejected);
    equal(outcome.result.error?.code, CommandErrorCode.PreconditionFailed);
    equal(outcome.result.error?.message, "quality gate scope does not match the command scope");
    equal(outcome.effects.qualityGateEvaluations.length, 0);
  });
});

function createDiscussionAnchorStateReader(
  discussionAnchor: DiscussionAnchor | undefined,
): DiscussionAnchorStateReaderPort {
  return {
    findDiscussionAnchor: async () => discussionAnchor,
  };
}

function createWorkAnchorStateReader(workItems: readonly CommandWorkAnchorWorkItem[]): WorkAnchorStateReaderPort {
  return {
    findProject: async () => undefined,
    findInitiative: async () => undefined,
    findWorkItem: async (workItemId) => workItems.find((workItem) => workItem.workItemId === workItemId),
  };
}

function createQualityGateEvaluationStateReader(
  qualityGateEvaluations: readonly QualityGateEvaluation[],
): QualityGateEvaluationStateReaderPort {
  return {
    listQualityGateEvaluationsForWorkItem: async () => qualityGateEvaluations,
  };
}

function createDiscussionAnchor(): DiscussionAnchor {
  return {
    discussionAnchorId: command.discussionAnchorId,
    organizationId: command.organizationId,
    projectId: command.projectId,
    ...(command.teamId === undefined ? {} : { teamId: command.teamId }),
    workItemId: command.workItemId,
    discussionAnchorType: DiscussionAnchorType.WorkItem,
    title: "Final business validation",
    purpose: "Evaluate delivered behavior against the BRD before release.",
    expectedOutputs: [DiscussionExpectedOutput.GateResult],
    createdAt: "2026-05-29T14:30:00.000Z",
    createdBy: command.actor,
    metadata: {
      updatedAt: "2026-05-29T14:30:00.000Z",
      version: 1,
      correlationId: command.correlationId,
      causationId: command.causationId,
      traceId: command.traceId,
    },
  };
}

function createDependencies() {
  return {
    now: () => "2026-05-29T15:00:00.000Z",
    createId: (prefix: string) => `${prefix}-001`,
    discussionAnchorStateReader: createDiscussionAnchorStateReader(createDiscussionAnchor()),
    qualityGateEvaluationStateReader: createQualityGateEvaluationStateReader(
      createSatisfiedPriorQualityGateChain(command.gateKind),
    ),
    workAnchorStateReader: createWorkAnchorStateReader([createWorkItem(command.workItemId)]),
  };
}

function createMismatchedWorkAnchorStateReader(): WorkAnchorStateReaderPort {
  return {
    findProject: async () => undefined,
    findInitiative: async () => undefined,
    findWorkItem: async () => createWorkItem("work-other-001"),
  };
}

function createWorkItem(workItemId: string): CommandWorkAnchorWorkItem {
  return {
    workItemId,
    organizationId: command.organizationId,
    projectId: command.projectId,
    teamId: command.teamId,
    workItemType: WorkItemType.Task,
    title: "Business quality gate feature",
    description: "Feature used by quality gate tests.",
    state: WorkItemState.Review,
    createdAt: "2026-05-29T14:00:00.000Z",
    createdBy: command.actor,
    metadata: {
      updatedAt: "2026-05-29T14:00:00.000Z",
      version: 1,
      correlationId: command.correlationId,
      causationId: command.causationId,
      traceId: command.traceId,
    },
  } as CommandWorkAnchorWorkItem;
}

function createTeamScopedWorkItem(workItemId: string, teamId: string): CommandWorkAnchorWorkItem {
  return {
    ...createWorkItem(workItemId),
    teamId,
  } as CommandWorkAnchorWorkItem & { teamId: string };
}

function createQualityGateEvaluation(gateKind: QualityGateKind): QualityGateEvaluation {
  return {
    qualityGateEvaluationId: `quality-gate-evaluation-${gateKind}`,
    organizationId: command.organizationId,
    projectId: command.projectId,
    ...(command.teamId === undefined ? {} : { teamId: command.teamId }),
    workItemId: command.workItemId,
    discussionAnchorId: command.discussionAnchorId,
    gateKind,
    outcome: QualityGateOutcome.Approved,
    summary: `${gateKind} approved.`,
    evaluatedArtifactIds: [`artifact-${gateKind}`],
    businessRuleResults: [],
    evaluatedAt: "2026-05-29T14:45:00.000Z",
    evaluatedBy: command.actor,
    metadata: {
      updatedAt: "2026-05-29T14:45:00.000Z",
      version: 1,
      correlationId: command.correlationId,
      causationId: command.causationId,
      traceId: command.traceId,
    },
  };
}

function createSatisfiedPriorQualityGateChain(gateKind: QualityGateKind): readonly QualityGateEvaluation[] {
  const orderedGateKinds = [
    QualityGateKind.CustomerRfpReview,
    QualityGateKind.BrdApproval,
    QualityGateKind.ArchitectureApproval,
    QualityGateKind.ImplementationReview,
    QualityGateKind.RuntimeValidation,
    QualityGateKind.FinalBusinessValidation,
    QualityGateKind.ReleaseReadiness,
  ];
  const gateIndex = orderedGateKinds.indexOf(gateKind);

  return gateIndex <= 0 ? [] : orderedGateKinds.slice(0, gateIndex).map(createQualityGateEvaluation);
}

function evidenceRef(kind: string, id: string): string {
  return createContentAddressedEvidenceRef(kind, { id });
}

function evidenceArtifact(kind: string, id: string) {
  return createContentAddressedEvidenceArtifact(kind, { id });
}
