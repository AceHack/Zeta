import { CommandType } from "../../../domain/src/index.ts";
import type { AuditEvent } from "../../../domain/src/index.ts";
import type { CommandHandler, CommandHandlerOutcome } from "../command-handler-registry.ts";
import type { PipelineCommand } from "../command-contract.ts";
import {
  CommandErrorCode,
  CommandResultArtifactType,
  CommandResultStatus,
  type CommandResult,
} from "../command-result.ts";
import {
  ContextPackAdvisoryPromotionDecisionStatus,
  DEFAULT_CONTEXT_PACK_ADVISORY_PROMOTION_POLICY_VERSION,
  contextPackAdvisoryPromotionDecisionKeyFor,
} from "../context-pack-advisory-promotion-policy.ts";
import type {
  Clock,
  CommandEffects,
  IdGenerator,
} from "../ports.ts";
import type {
  ContextPackAdvisoryPromotionDecisionWriteInput,
  ContextPackAdvisoryPromotionFingerprint,
} from "../context-pack-advisory-promotion-policy.ts";
import { ContextPackItemKind } from "../context-pack-contracts.ts";

export const AuthorContextPackAdvisoryPromotionDecisionIdPrefix = {
  Audit: "audit",
  Decision: "context-pack-advisory-promotion-decision",
} as const;

export type AuthorContextPackAdvisoryPromotionDecisionIdPrefix =
  (typeof AuthorContextPackAdvisoryPromotionDecisionIdPrefix)[keyof typeof AuthorContextPackAdvisoryPromotionDecisionIdPrefix];

export const ContextPackAdvisoryPromotionDecisionAuditEventName = {
  Authored: "context_pack.advisory_promotion_decision.authored",
} as const;

export type ContextPackAdvisoryPromotionDecisionAuditEventName =
  (typeof ContextPackAdvisoryPromotionDecisionAuditEventName)[keyof typeof ContextPackAdvisoryPromotionDecisionAuditEventName];

export const AuthorContextPackAdvisoryPromotionDecisionValidationErrorMessage = {
  EvidenceRefsRequired: "context-pack advisory-promotion decision evidence refs are required",
  FingerprintCitationRefsInvalid: "context-pack advisory-promotion decision fingerprint citation refs are invalid",
  FingerprintItemKindInvalid: "context-pack advisory-promotion decision fingerprint item kind is invalid",
  FingerprintSourcePointerKeysInvalid: "context-pack advisory-promotion decision fingerprint source pointer keys are invalid",
  FingerprintSummaryHashRequired: "context-pack advisory-promotion decision fingerprint summary hash is required",
  HatAssignmentRequired: "context-pack advisory-promotion decision hat assignment is required",
  HatRequired: "context-pack advisory-promotion decision hat is required",
  LifecycleBlockerRequired: "context-pack advisory-promotion decision lifecycle blocker is required",
  StatusInvalid: "context-pack advisory-promotion decision status is invalid",
} as const;

export type AuthorContextPackAdvisoryPromotionDecisionValidationErrorMessage =
  (typeof AuthorContextPackAdvisoryPromotionDecisionValidationErrorMessage)[keyof typeof AuthorContextPackAdvisoryPromotionDecisionValidationErrorMessage];

export type AuthorContextPackAdvisoryPromotionDecisionCommand = PipelineCommand & {
  type: typeof CommandType.AuthorContextPackAdvisoryPromotionDecision;
  teamId?: string | undefined;
  workItemId?: string | undefined;
  hatId: string;
  hatAssignmentId: string;
  curationProfileId?: string | undefined;
  status: ContextPackAdvisoryPromotionDecisionStatus;
  lifecycleBlocker: string;
  fingerprint: ContextPackAdvisoryPromotionFingerprint;
  evidenceRefs: readonly string[];
};

export type AuthorContextPackAdvisoryPromotionDecisionDependencies = Clock & IdGenerator;

export function createAuthorContextPackAdvisoryPromotionDecisionHandler(): CommandHandler<
  AuthorContextPackAdvisoryPromotionDecisionCommand,
  CommandResult
> {
  return {
    commandType: CommandType.AuthorContextPackAdvisoryPromotionDecision,
    execute: authorContextPackAdvisoryPromotionDecision,
  };
}

export async function authorContextPackAdvisoryPromotionDecision(
  command: AuthorContextPackAdvisoryPromotionDecisionCommand,
  dependencies: AuthorContextPackAdvisoryPromotionDecisionDependencies,
): Promise<CommandHandlerOutcome<CommandResult>> {
  const validationError = validateCommand(command);
  if (validationError !== undefined) {
    return createRejectedValidationOutcome(command, validationError);
  }

  const decidedAt = dependencies.now();
  const decision = createDecision(command, dependencies, decidedAt);
  const auditEvent = createAuditEvent(command, dependencies, decision, decidedAt);

  return {
    result: {
      commandId: command.commandId,
      status: CommandResultStatus.Accepted,
      artifacts: [{
        artifactType: CommandResultArtifactType.ContextPackAdvisoryPromotionDecision,
        artifactId: decision.decisionId,
        label: decision.lifecycleBlocker,
      }],
      auditEventIds: [auditEvent.auditEventId],
      contextPackAdvisoryPromotionDecision: decision,
      idempotency: {
        replayed: false,
      },
    },
    effects: {
      supervisorSignals: [],
      discussionAnchors: [],
      decisionRecords: [],
      qualityGateEvaluations: [],
      workScheduleBlocks: [],
      contextPackInboxAnchors: [],
      contextPackInboxAnchorStatusTransitions: [],
      contextPackAdvisoryPromotionDecisions: [decision],
      auditEvents: [auditEvent],
      outboxEvents: [],
      workAnchors: createEmptyWorkAnchorCommandEffects(),
    },
  };
}

function createDecision(
  command: AuthorContextPackAdvisoryPromotionDecisionCommand,
  dependencies: IdGenerator,
  decidedAt: string,
): ContextPackAdvisoryPromotionDecisionWriteInput {
  const fingerprint = normalizeFingerprint(command.fingerprint);
  return {
    decisionId: dependencies.createId(AuthorContextPackAdvisoryPromotionDecisionIdPrefix.Decision),
    decisionKey: contextPackAdvisoryPromotionDecisionKeyFor({
      organizationId: command.organizationId,
      hatId: command.hatId,
      hatAssignmentId: command.hatAssignmentId,
      projectId: command.projectId,
      teamId: command.teamId,
      workItemId: command.workItemId,
      curationProfileId: command.curationProfileId,
      fingerprint,
    }),
    organizationId: command.organizationId,
    status: command.status,
    policyVersion: DEFAULT_CONTEXT_PACK_ADVISORY_PROMOTION_POLICY_VERSION,
    lifecycleBlocker: command.lifecycleBlocker.trim(),
    fingerprint,
    evidenceRefs: normalizeStringList(command.evidenceRefs),
    hatId: command.hatId,
    hatAssignmentId: command.hatAssignmentId,
    projectId: command.projectId,
    ...optionalValue("teamId", command.teamId),
    ...optionalValue("workItemId", command.workItemId),
    ...optionalValue("curationProfileId", command.curationProfileId),
    audit: {
      decidedByHatId: command.hatId,
      decidedByHatAssignmentId: command.actor.hatAssignmentId,
      decidedByAgentId: command.actor.agentId,
      decidedAt,
      traceId: command.traceId,
      correlationId: command.correlationId,
      causationId: command.causationId,
    },
  };
}

function createAuditEvent(
  command: AuthorContextPackAdvisoryPromotionDecisionCommand,
  dependencies: IdGenerator,
  decision: ContextPackAdvisoryPromotionDecisionWriteInput,
  occurredAt: string,
): AuditEvent {
  return {
    auditEventId: dependencies.createId(AuthorContextPackAdvisoryPromotionDecisionIdPrefix.Audit),
    eventName: ContextPackAdvisoryPromotionDecisionAuditEventName.Authored,
    aggregateId: decision.decisionId,
    actor: command.actor,
    occurredAt,
  };
}

function validateCommand(
  command: AuthorContextPackAdvisoryPromotionDecisionCommand,
): AuthorContextPackAdvisoryPromotionDecisionValidationErrorMessage | undefined {
  if (isBlank(command.hatId)) {
    return AuthorContextPackAdvisoryPromotionDecisionValidationErrorMessage.HatRequired;
  }

  if (isBlank(command.hatAssignmentId)) {
    return AuthorContextPackAdvisoryPromotionDecisionValidationErrorMessage.HatAssignmentRequired;
  }

  if (!isContextPackAdvisoryPromotionDecisionStatus(command.status)) {
    return AuthorContextPackAdvisoryPromotionDecisionValidationErrorMessage.StatusInvalid;
  }

  if (isBlank(command.lifecycleBlocker)) {
    return AuthorContextPackAdvisoryPromotionDecisionValidationErrorMessage.LifecycleBlockerRequired;
  }

  return validateFingerprint(command.fingerprint) ?? validateEvidenceRefs(command.evidenceRefs);
}

function validateFingerprint(
  fingerprint: ContextPackAdvisoryPromotionFingerprint,
): AuthorContextPackAdvisoryPromotionDecisionValidationErrorMessage | undefined {
  if (fingerprint.itemKind !== ContextPackItemKind.SynthesisGapHypothesis) {
    return AuthorContextPackAdvisoryPromotionDecisionValidationErrorMessage.FingerprintItemKindInvalid;
  }

  if (isBlank(fingerprint.summaryHash)) {
    return AuthorContextPackAdvisoryPromotionDecisionValidationErrorMessage.FingerprintSummaryHashRequired;
  }

  if (!isStringList(fingerprint.citationRefs)) {
    return AuthorContextPackAdvisoryPromotionDecisionValidationErrorMessage.FingerprintCitationRefsInvalid;
  }

  if (!isStringList(fingerprint.sourcePointerKeys)) {
    return AuthorContextPackAdvisoryPromotionDecisionValidationErrorMessage.FingerprintSourcePointerKeysInvalid;
  }

  return undefined;
}

function validateEvidenceRefs(
  evidenceRefs: readonly string[],
): AuthorContextPackAdvisoryPromotionDecisionValidationErrorMessage | undefined {
  return isStringList(evidenceRefs) && evidenceRefs.length > 0
    ? undefined
    : AuthorContextPackAdvisoryPromotionDecisionValidationErrorMessage.EvidenceRefsRequired;
}

function normalizeFingerprint(
  fingerprint: ContextPackAdvisoryPromotionFingerprint,
): ContextPackAdvisoryPromotionFingerprint {
  return {
    itemKind: fingerprint.itemKind,
    summaryHash: fingerprint.summaryHash.trim(),
    citationRefs: [...normalizeStringList(fingerprint.citationRefs)].sort(),
    sourcePointerKeys: [...normalizeStringList(fingerprint.sourcePointerKeys)].sort(),
  };
}

function normalizeStringList(values: readonly string[]): readonly string[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))];
}

function isContextPackAdvisoryPromotionDecisionStatus(
  value: unknown,
): value is ContextPackAdvisoryPromotionDecisionStatus {
  return Object.values(ContextPackAdvisoryPromotionDecisionStatus).includes(
    value as ContextPackAdvisoryPromotionDecisionStatus,
  );
}

function isStringList(value: unknown): value is readonly string[] {
  return Array.isArray(value) &&
    value.every((entry) => typeof entry === "string" && entry.trim().length > 0);
}

function createRejectedValidationOutcome(
  command: AuthorContextPackAdvisoryPromotionDecisionCommand,
  message: AuthorContextPackAdvisoryPromotionDecisionValidationErrorMessage,
): CommandHandlerOutcome<CommandResult> {
  return createRejectedOutcome(command, CommandErrorCode.ValidationFailed, message);
}

function createRejectedOutcome(
  command: AuthorContextPackAdvisoryPromotionDecisionCommand,
  code: CommandErrorCode,
  message: AuthorContextPackAdvisoryPromotionDecisionValidationErrorMessage,
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
    contextPackInboxAnchors: [],
    contextPackInboxAnchorStatusTransitions: [],
    contextPackAdvisoryPromotionDecisions: [],
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

function optionalValue<Key extends string>(
  key: Key,
  value: string | undefined,
): { [Property in Key]?: string } {
  return value === undefined ? {} : { [key]: value } as { [Property in Key]?: string };
}

function isBlank(value: unknown): boolean {
  return typeof value !== "string" || value.trim().length === 0;
}
