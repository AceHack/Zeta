import {
  AgenticAggregateType,
  AgenticEventType,
  BusinessRuleEvaluationStatus,
  CommandType,
  CompanyWorkPolicyDecisionStatus,
  DiscussionAnchorType,
  DiscussionExpectedOutput,
  QualityGateKind,
  QualityGateOutcome,
  createAgenticEventEnvelope,
  evaluateQualityGateSequencePolicy,
  isBusinessRuleEvaluationStatus,
  isQualityGateKind,
  isQualityGateOutcome,
  type BusinessRuleEvaluation,
  type DiscussionAnchor,
  type QualityGateEvaluation,
} from "../../../domain/src/index.ts";
import type { CommandHandler, CommandHandlerOutcome } from "../command-handler-registry.ts";
import type { PipelineCommand } from "../command-contract.ts";
import {
  CommandErrorCode,
  CommandResultArtifactType,
  CommandResultStatus,
  type CommandResult,
} from "../command-result.ts";
import {
  allEvidenceRefsContentAddressed,
  verifiedContentAddressedEvidenceRefs,
  type ContentAddressedEvidenceArtifact,
} from "../content-addressed-evidence.ts";
import { contextPackDocConsultOutcomeStampForQualityGate } from "../context-pack-doc-consult-ledger.ts";
import type {
  Clock,
  CommandEffects,
  CommandWorkAnchorWorkItem,
  DiscussionAnchorStateReaderPort,
  IdGenerator,
  QualityGateEvaluationStateReaderPort,
  WorkAnchorStateReaderPort,
} from "../ports.ts";

export const RecordQualityGateEvaluationIdPrefix = {
  Audit: "audit",
  Event: "evt",
  Outbox: "outbox",
  QualityGateEvaluation: "quality-gate-evaluation",
} as const;

export type RecordQualityGateEvaluationIdPrefix =
  (typeof RecordQualityGateEvaluationIdPrefix)[keyof typeof RecordQualityGateEvaluationIdPrefix];

export const QualityGateEvaluationValidationErrorMessage = {
  ApprovedFinalBusinessRulesIncomplete:
    "approved final business validation requires all business rules satisfied, not applicable, or changed by decision",
  BusinessRuleEvidenceInvalid: "quality gate business rule evidence artifact IDs must be string arrays",
  BusinessRuleNotesRequired: "quality gate business rule notes are required",
  BusinessRuleResultsInvalid: "quality gate business rule results must be an array",
  BusinessRuleResultsRequired: "final business validation requires business rule evaluations",
  BusinessRuleStatusInvalid: "quality gate business rule status is invalid",
  ContentAddressedEvidenceRequired: "approved or waived quality gates require content-addressed evidence refs",
  BusinessRuleIdRequired: "quality gate business rule ID is required",
  EvaluatedArtifactsInvalid: "quality gate evaluated artifact IDs must be string arrays",
  EvaluatedArtifactsRequired: "quality gate evaluated artifact IDs are required",
  GateKindInvalid: "quality gate kind is invalid",
  MissingAnchor: "quality gate requires an existing discussion anchor",
  MissingAnchorReader: "quality gate requires discussion anchor validation",
  MissingQualityGatePolicyEvidenceReader: "quality gate company policy requires quality gate history validation",
  MissingRelatedWorkItem: "quality gate requires an existing related work item",
  MissingWorkAnchorReader: "quality gate requires work anchor validation",
  OutcomeInvalid: "quality gate outcome is invalid",
  PriorQualityGateIncomplete: "quality gate company policy requires prior gates to be approved or waived",
  ScopeMismatch: "quality gate scope does not match the command scope",
  SummaryRequired: "quality gate summary is required",
  UnsupportedAnchorType: "quality gate V0 only supports work-item discussion anchors",
  AnchorWithoutGateResultOutput: "quality gate requires a discussion anchor expecting a gate result",
} as const;

export type QualityGateEvaluationValidationErrorMessage =
  (typeof QualityGateEvaluationValidationErrorMessage)[keyof typeof QualityGateEvaluationValidationErrorMessage];

export type RecordQualityGateEvaluationCommand = PipelineCommand & {
  type: typeof CommandType.RecordQualityGateEvaluation;
  teamId?: string;
  workItemId: string;
  discussionAnchorId: string;
  gateKind: QualityGateKind;
  outcome: QualityGateOutcome;
  summary: string;
  evaluatedArtifactIds?: readonly string[] | undefined;
  businessRuleResults?: readonly BusinessRuleEvaluation[] | undefined;
  evidenceArtifacts?: readonly ContentAddressedEvidenceArtifact[] | undefined;
};

export type RecordQualityGateEvaluationDependencies = Clock &
  IdGenerator & {
    discussionAnchorStateReader?: DiscussionAnchorStateReaderPort | undefined;
    qualityGateEvaluationStateReader?: QualityGateEvaluationStateReaderPort | undefined;
    workAnchorStateReader?: WorkAnchorStateReaderPort | undefined;
  };

export function createRecordQualityGateEvaluationHandler(): CommandHandler<
  RecordQualityGateEvaluationCommand,
  CommandResult
> {
  return {
    commandType: CommandType.RecordQualityGateEvaluation,
    execute: recordQualityGateEvaluation,
  };
}

export async function recordQualityGateEvaluation(
  command: RecordQualityGateEvaluationCommand,
  dependencies: RecordQualityGateEvaluationDependencies,
): Promise<CommandHandlerOutcome<CommandResult>> {
  const validationError = validateCommand(command);

  if (validationError !== undefined) {
    return createRejectedValidationOutcome(command, validationError);
  }

  const anchorValidationError = await validateDiscussionAnchor(command, dependencies);

  if (anchorValidationError !== undefined) {
    return createRejectedPreconditionOutcome(command, anchorValidationError);
  }

  const workItemValidationError = await validateRelatedWorkItem(command, dependencies);

  if (workItemValidationError !== undefined) {
    return createRejectedPreconditionOutcome(command, workItemValidationError);
  }

  const companyPolicyValidationError = await validateCompanyQualityGatePolicy(command, dependencies);

  if (companyPolicyValidationError !== undefined) {
    return createRejectedPreconditionOutcome(command, companyPolicyValidationError);
  }

  const occurredAt = dependencies.now();
  const qualityGateEvaluation = createQualityGateEvaluation(
    command,
    dependencies.createId(RecordQualityGateEvaluationIdPrefix.QualityGateEvaluation),
    occurredAt,
  );
  const auditEventId = dependencies.createId(RecordQualityGateEvaluationIdPrefix.Audit);
  const envelope = createAgenticEventEnvelope({
    eventId: dependencies.createId(RecordQualityGateEvaluationIdPrefix.Event),
    eventType: AgenticEventType.QualityGateEvaluated,
    occurredAt,
    actor: command.actor,
    scope: {
      organizationId: command.organizationId,
      projectId: command.projectId,
      ...createOptionalTeamScope(command),
      workItemId: command.workItemId,
    },
    aggregate: {
      aggregateId: qualityGateEvaluation.qualityGateEvaluationId,
      aggregateType: AgenticAggregateType.QualityGateEvaluation,
      aggregateVersion: qualityGateEvaluation.metadata.version,
    },
    trace: {
      commandId: command.commandId,
      correlationId: command.correlationId,
      causationId: command.causationId,
      traceId: command.traceId,
      idempotencyKey: command.idempotencyKey,
    },
    payload: {
      discussionAnchorId: command.discussionAnchorId,
      gateKind: command.gateKind,
      outcome: command.outcome,
      summary: command.summary,
      evaluatedArtifactIds: createStringList(command.evaluatedArtifactIds),
      businessRuleResults: createBusinessRuleResults(command.businessRuleResults),
    },
  });

  return {
    result: {
      commandId: command.commandId,
      status: CommandResultStatus.Accepted,
      artifacts: [
        {
          artifactType: CommandResultArtifactType.QualityGateEvaluation,
          artifactId: qualityGateEvaluation.qualityGateEvaluationId,
          label: qualityGateEvaluation.gateKind,
        },
      ],
      emittedEvents: [
        {
          eventId: envelope.eventId,
          eventType: envelope.eventType,
          aggregateId: envelope.aggregate.aggregateId,
          aggregateType: envelope.aggregate.aggregateType,
        },
      ],
      auditEventIds: [auditEventId],
      qualityGateEvaluation,
      idempotency: {
        replayed: false,
      },
    },
    effects: {
      supervisorSignals: [],
      discussionAnchors: [],
      decisionRecords: [],
      qualityGateEvaluations: [qualityGateEvaluation],
      workScheduleBlocks: [],
      docConsultOutcomeStamps: [contextPackDocConsultOutcomeStampForQualityGate(qualityGateEvaluation)],
      auditEvents: [
        {
          auditEventId,
          eventName: AgenticEventType.QualityGateEvaluated,
          aggregateId: qualityGateEvaluation.qualityGateEvaluationId,
          actor: command.actor,
          occurredAt,
        },
      ],
      outboxEvents: [
        {
          outboxEventId: dependencies.createId(RecordQualityGateEvaluationIdPrefix.Outbox),
          envelope,
        },
      ],
      workAnchors: createEmptyWorkAnchorCommandEffects(),
    },
  };
}

async function validateCompanyQualityGatePolicy(
  command: RecordQualityGateEvaluationCommand,
  dependencies: RecordQualityGateEvaluationDependencies,
): Promise<QualityGateEvaluationValidationErrorMessage | undefined> {
  const preliminaryPolicyDecision = evaluateQualityGateSequencePolicy({
    gateKind: command.gateKind,
    outcome: command.outcome,
  });

  if (preliminaryPolicyDecision.status === CompanyWorkPolicyDecisionStatus.Allowed) {
    return undefined;
  }

  if (dependencies.qualityGateEvaluationStateReader === undefined) {
    return QualityGateEvaluationValidationErrorMessage.MissingQualityGatePolicyEvidenceReader;
  }

  const priorEvaluations = await dependencies.qualityGateEvaluationStateReader.listQualityGateEvaluationsForWorkItem({
    organizationId: command.organizationId,
    projectId: command.projectId,
    teamId: command.teamId,
    workItemId: command.workItemId,
  });

  const policyDecision = evaluateQualityGateSequencePolicy({
    gateKind: command.gateKind,
    outcome: command.outcome,
    priorEvaluations,
  });

  return policyDecision.status === CompanyWorkPolicyDecisionStatus.Allowed
    ? undefined
    : QualityGateEvaluationValidationErrorMessage.PriorQualityGateIncomplete;
}

async function validateDiscussionAnchor(
  command: RecordQualityGateEvaluationCommand,
  dependencies: RecordQualityGateEvaluationDependencies,
): Promise<QualityGateEvaluationValidationErrorMessage | undefined> {
  if (dependencies.discussionAnchorStateReader === undefined) {
    return QualityGateEvaluationValidationErrorMessage.MissingAnchorReader;
  }

  const discussionAnchor = await dependencies.discussionAnchorStateReader.findDiscussionAnchor(
    command.discussionAnchorId,
  );

  if (discussionAnchor === undefined) {
    return QualityGateEvaluationValidationErrorMessage.MissingAnchor;
  }

  if (!hasMatchingDiscussionAnchorScope(command, discussionAnchor)) {
    return QualityGateEvaluationValidationErrorMessage.ScopeMismatch;
  }

  if (discussionAnchor.discussionAnchorType !== DiscussionAnchorType.WorkItem) {
    return QualityGateEvaluationValidationErrorMessage.UnsupportedAnchorType;
  }

  if (!discussionAnchor.expectedOutputs.includes(DiscussionExpectedOutput.GateResult)) {
    return QualityGateEvaluationValidationErrorMessage.AnchorWithoutGateResultOutput;
  }

  return undefined;
}

async function validateRelatedWorkItem(
  command: RecordQualityGateEvaluationCommand,
  dependencies: RecordQualityGateEvaluationDependencies,
): Promise<QualityGateEvaluationValidationErrorMessage | undefined> {
  if (dependencies.workAnchorStateReader === undefined) {
    return QualityGateEvaluationValidationErrorMessage.MissingWorkAnchorReader;
  }

  const relatedWorkItem = await dependencies.workAnchorStateReader.findWorkItem(command.workItemId);

  if (relatedWorkItem === undefined) {
    return QualityGateEvaluationValidationErrorMessage.MissingRelatedWorkItem;
  }

  if (!hasMatchingWorkItemScope(command, relatedWorkItem)) {
    return QualityGateEvaluationValidationErrorMessage.ScopeMismatch;
  }

  return undefined;
}

function validateCommand(
  command: RecordQualityGateEvaluationCommand,
): QualityGateEvaluationValidationErrorMessage | undefined {
  if (!isQualityGateKind(command.gateKind)) {
    return QualityGateEvaluationValidationErrorMessage.GateKindInvalid;
  }

  if (!isQualityGateOutcome(command.outcome)) {
    return QualityGateEvaluationValidationErrorMessage.OutcomeInvalid;
  }

  if (isBlank(command.summary)) {
    return QualityGateEvaluationValidationErrorMessage.SummaryRequired;
  }

  if (command.evaluatedArtifactIds === undefined || command.evaluatedArtifactIds.length === 0) {
    return QualityGateEvaluationValidationErrorMessage.EvaluatedArtifactsRequired;
  }

  if (!isStringList(command.evaluatedArtifactIds)) {
    return QualityGateEvaluationValidationErrorMessage.EvaluatedArtifactsInvalid;
  }

  const businessRuleValidationError = validateBusinessRuleResults(command);

  if (businessRuleValidationError !== undefined) {
    return businessRuleValidationError;
  }

  if (requiresContentAddressedEvidence(command) && !hasOnlyContentAddressedEvidence(command)) {
    return QualityGateEvaluationValidationErrorMessage.ContentAddressedEvidenceRequired;
  }

  return undefined;
}

function validateBusinessRuleResults(
  command: RecordQualityGateEvaluationCommand,
): QualityGateEvaluationValidationErrorMessage | undefined {
  if (command.businessRuleResults !== undefined && !Array.isArray(command.businessRuleResults)) {
    return QualityGateEvaluationValidationErrorMessage.BusinessRuleResultsInvalid;
  }

  const businessRuleResults = command.businessRuleResults ?? [];

  if (command.gateKind === QualityGateKind.FinalBusinessValidation && businessRuleResults.length === 0) {
    return QualityGateEvaluationValidationErrorMessage.BusinessRuleResultsRequired;
  }

  for (const businessRuleResult of businessRuleResults) {
    if (!isRecord(businessRuleResult)) {
      return QualityGateEvaluationValidationErrorMessage.BusinessRuleResultsInvalid;
    }

    if (isBlank(businessRuleResult.ruleId)) {
      return QualityGateEvaluationValidationErrorMessage.BusinessRuleIdRequired;
    }

    if (!isBusinessRuleEvaluationStatus(businessRuleResult.status)) {
      return QualityGateEvaluationValidationErrorMessage.BusinessRuleStatusInvalid;
    }

    if (!isStringList(businessRuleResult.evidenceArtifactIds)) {
      return QualityGateEvaluationValidationErrorMessage.BusinessRuleEvidenceInvalid;
    }

    if (isBlank(businessRuleResult.notes)) {
      return QualityGateEvaluationValidationErrorMessage.BusinessRuleNotesRequired;
    }
  }

  if (
    command.gateKind === QualityGateKind.FinalBusinessValidation &&
    command.outcome === QualityGateOutcome.Approved &&
    businessRuleResults.some(isUnresolvedBusinessRuleResult)
  ) {
    return QualityGateEvaluationValidationErrorMessage.ApprovedFinalBusinessRulesIncomplete;
  }

  return undefined;
}

function isUnresolvedBusinessRuleResult(result: BusinessRuleEvaluation): boolean {
  return (
    result.status === BusinessRuleEvaluationStatus.NotSatisfied ||
    result.status === BusinessRuleEvaluationStatus.PartiallySatisfied
  );
}

function requiresContentAddressedEvidence(command: RecordQualityGateEvaluationCommand): boolean {
  return command.outcome === QualityGateOutcome.Approved || command.outcome === QualityGateOutcome.Waived;
}

function hasOnlyContentAddressedEvidence(command: RecordQualityGateEvaluationCommand): boolean {
  const businessRuleEvidenceRefs = (command.businessRuleResults ?? []).flatMap((result) => [
    ...result.evidenceArtifactIds,
  ]);
  const verifiedRefs = verifiedContentAddressedEvidenceRefs(command.evidenceArtifacts);
  const requiredRefs = [...createStringList(command.evaluatedArtifactIds), ...businessRuleEvidenceRefs];

  return (
    allEvidenceRefsContentAddressed(createStringList(command.evaluatedArtifactIds)) &&
    (businessRuleEvidenceRefs.length === 0 || allEvidenceRefsContentAddressed(businessRuleEvidenceRefs)) &&
    requiredRefs.every((ref) => verifiedRefs.has(ref))
  );
}

function createQualityGateEvaluation(
  command: RecordQualityGateEvaluationCommand,
  qualityGateEvaluationId: string,
  occurredAt: string,
): QualityGateEvaluation {
  return {
    qualityGateEvaluationId,
    organizationId: command.organizationId,
    projectId: command.projectId,
    ...createOptionalTeamScope(command),
    workItemId: command.workItemId,
    discussionAnchorId: command.discussionAnchorId,
    gateKind: command.gateKind,
    outcome: command.outcome,
    summary: command.summary,
    evaluatedArtifactIds: createStringList(command.evaluatedArtifactIds),
    businessRuleResults: createBusinessRuleResults(command.businessRuleResults),
    evaluatedAt: occurredAt,
    evaluatedBy: command.actor,
    metadata: {
      updatedAt: occurredAt,
      version: 1,
      correlationId: command.correlationId,
      causationId: command.causationId,
      traceId: command.traceId,
    },
  };
}

function hasMatchingDiscussionAnchorScope(
  command: RecordQualityGateEvaluationCommand,
  discussionAnchor: DiscussionAnchor,
): boolean {
  return (
    discussionAnchor.discussionAnchorId === command.discussionAnchorId &&
    discussionAnchor.organizationId === command.organizationId &&
    discussionAnchor.projectId === command.projectId &&
    discussionAnchor.workItemId === command.workItemId &&
    discussionAnchor.teamId === command.teamId
  );
}

function hasMatchingWorkItemScope(
  command: RecordQualityGateEvaluationCommand,
  workItem: CommandWorkAnchorWorkItem,
): boolean {
  return (
    workItem.workItemId === command.workItemId &&
    workItem.organizationId === command.organizationId &&
    workItem.projectId === command.projectId &&
    hasCompatibleOptionalWorkItemTeamScope(command, workItem)
  );
}

function hasCompatibleOptionalWorkItemTeamScope(
  command: Pick<RecordQualityGateEvaluationCommand, "teamId">,
  workItem: CommandWorkAnchorWorkItem,
): boolean {
  const teamId = readOptionalWorkItemTeamId(workItem);
  return teamId === undefined || teamId === command.teamId;
}

function readOptionalWorkItemTeamId(workItem: CommandWorkAnchorWorkItem): string | undefined {
  if (!("teamId" in workItem)) {
    return undefined;
  }

  const value = (workItem as { teamId?: unknown }).teamId;
  return typeof value === "string" ? value : undefined;
}

function createRejectedValidationOutcome(
  command: RecordQualityGateEvaluationCommand,
  message: QualityGateEvaluationValidationErrorMessage,
): CommandHandlerOutcome<CommandResult> {
  return createRejectedOutcome(command, CommandErrorCode.ValidationFailed, message);
}

function createRejectedPreconditionOutcome(
  command: RecordQualityGateEvaluationCommand,
  message: QualityGateEvaluationValidationErrorMessage,
): CommandHandlerOutcome<CommandResult> {
  return createRejectedOutcome(command, CommandErrorCode.PreconditionFailed, message);
}

function createRejectedOutcome(
  command: RecordQualityGateEvaluationCommand,
  code: CommandErrorCode,
  message: QualityGateEvaluationValidationErrorMessage,
): CommandHandlerOutcome<CommandResult> {
  return {
    result: {
      commandId: command.commandId,
      status: CommandResultStatus.Rejected,
      idempotency: {
        replayed: false,
      },
      error: {
        code,
        message,
      },
    },
    effects: createEmptyCommandEffects(),
  };
}

function createEmptyCommandEffects(): CommandEffects {
  return {
    supervisorSignals: [],
    discussionAnchors: [],
    decisionRecords: [],
    qualityGateEvaluations: [],
    workScheduleBlocks: [],
    auditEvents: [],
    outboxEvents: [],
    workAnchors: createEmptyWorkAnchorCommandEffects(),
  };
}

function createEmptyWorkAnchorCommandEffects(): NonNullable<CommandEffects["workAnchors"]> {
  return {
    projects: [],
    initiatives: [],
    workItems: [],
    workAnchorTargets: [],
    workItemTransitions: [],
  };
}

function createOptionalTeamScope(command: Pick<RecordQualityGateEvaluationCommand, "teamId">): { teamId?: string } {
  return command.teamId === undefined ? {} : { teamId: command.teamId };
}

function createStringList(value: readonly string[] | undefined): readonly string[] {
  return value === undefined ? [] : [...value];
}

function createBusinessRuleResults(
  value: readonly BusinessRuleEvaluation[] | undefined,
): readonly BusinessRuleEvaluation[] {
  return value === undefined
    ? []
    : value.map((result) => ({
        ...result,
        evidenceArtifactIds: [...result.evidenceArtifactIds],
      }));
}

function isStringList(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every(isNonBlankString);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && !isBlank(value);
}

function isBlank(value: unknown): boolean {
  return typeof value !== "string" || value.trim().length === 0;
}
