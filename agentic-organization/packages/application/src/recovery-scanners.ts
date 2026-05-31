import { createHash } from "node:crypto";

import {
  OrgEventKind,
  ReactionPlanStatus,
  ScheduleBlockState,
  type OrgEvent,
} from "../../domain/src/index.ts";

export const RecoveryScannerKind = {
  StaleReactionPlanScan: "stale-reaction-plan-scan",
  StrandedScheduleScan: "stranded-schedule-scan",
  AbandonedRunBindingScan: "abandoned-run-binding-scan",
  DeadLetterClassifier: "dead-letter-classifier",
} as const;

export type RecoveryScannerKind = (typeof RecoveryScannerKind)[keyof typeof RecoveryScannerKind];

export const RecoveryIncidentKind = {
  ExpiredReactionPlanClaim: "expired-reaction-plan-claim",
  StalePlannedReactionPlan: "stale-planned-reaction-plan",
  StrandedScheduleBlock: "stranded-schedule-block",
  AbandonedRunBinding: "abandoned-run-binding",
  DeadLetteredReactionPlan: "dead-lettered-reaction-plan",
} as const;

export type RecoveryIncidentKind = (typeof RecoveryIncidentKind)[keyof typeof RecoveryIncidentKind];

export const DeadLetterClassification = {
  PoisonPayload: "poison-payload",
  RetryExhausted: "retry-exhausted",
  UnknownTerminalFailure: "unknown-terminal-failure",
} as const;

export type DeadLetterClassification =
  (typeof DeadLetterClassification)[keyof typeof DeadLetterClassification];

export type ReactionPlanRecoveryCandidate = {
  reactionPlanId: string;
  organizationId: string;
  status: ReactionPlanStatus;
  createdAt: string;
  claimedAt?: string;
  claimExpiresAt?: string;
  nextAttemptAt?: string;
  attemptCount?: number;
};

export type ScheduleBlockRecoveryCandidate = {
  workScheduleBlockId: string;
  organizationId: string;
  workItemId: string;
  assignedAgentId: string;
  assignedHatAssignmentId: string;
  state: ScheduleBlockState;
  startsAt: string;
  endsAt: string;
};

export type RunBindingRecoveryCandidate = {
  runId: string;
  workItemId: string;
  agentId: string;
  sessionId: string;
  hatAssignmentId: string;
  promptFlowRunId: string;
  state: string;
  lastHeartbeatMs: number;
};

export type DeadLetterRecoveryCandidate = {
  deadLetterId: string;
  organizationId: string;
  createdAt: string;
  failedAt: string;
  failureMessage: string;
  retryable: boolean;
  attemptCount: number;
};

export type RecoveryIncident = {
  scanner: RecoveryScannerKind;
  kind: RecoveryIncidentKind;
  subjectId: string;
  organizationId?: string;
  ageMs?: number;
  classification?: DeadLetterClassification;
  decision: string;
  evidenceRefs: readonly string[];
};

export type RecoveryScanReport = {
  scanner: RecoveryScannerKind;
  scanned: number;
  incidents: readonly RecoveryIncident[];
};

export function scanStaleReactionPlans(input: {
  nowMs: number;
  staleAfterMs: number;
  reactionPlans: readonly ReactionPlanRecoveryCandidate[];
}): RecoveryScanReport {
  const incidents: RecoveryIncident[] = [];

  for (const plan of input.reactionPlans) {
    if (plan.status === ReactionPlanStatus.Claimed && isPastOrAt(plan.claimExpiresAt, input.nowMs)) {
      incidents.push({
        scanner: RecoveryScannerKind.StaleReactionPlanScan,
        kind: RecoveryIncidentKind.ExpiredReactionPlanClaim,
        subjectId: plan.reactionPlanId,
        organizationId: plan.organizationId,
        ageMs: input.nowMs - Date.parse(plan.claimExpiresAt!),
        decision: "expired reaction-plan claim is eligible for executor reclaim",
        evidenceRefs: [`reaction_plan:${plan.reactionPlanId}`, `claim_expires_at:${plan.claimExpiresAt}`],
      });
      continue;
    }

    if (
      plan.status === ReactionPlanStatus.Planned &&
      Date.parse(plan.createdAt) <= input.nowMs - input.staleAfterMs &&
      (plan.nextAttemptAt === undefined || Date.parse(plan.nextAttemptAt) <= input.nowMs)
    ) {
      incidents.push({
        scanner: RecoveryScannerKind.StaleReactionPlanScan,
        kind: RecoveryIncidentKind.StalePlannedReactionPlan,
        subjectId: plan.reactionPlanId,
        organizationId: plan.organizationId,
        ageMs: input.nowMs - Date.parse(plan.createdAt),
        decision: "planned reaction plan is stale and ready for the executor lane",
        evidenceRefs: [`reaction_plan:${plan.reactionPlanId}`, `created_at:${plan.createdAt}`],
      });
    }
  }

  return { scanner: RecoveryScannerKind.StaleReactionPlanScan, scanned: input.reactionPlans.length, incidents };
}

export function scanStrandedScheduleBlocks(input: {
  nowMs: number;
  graceMs: number;
  scheduleBlocks: readonly ScheduleBlockRecoveryCandidate[];
}): RecoveryScanReport {
  const incidents = input.scheduleBlocks
    .filter((block) => isCapacityHoldingScheduleBlockState(block.state))
    .filter((block) => Date.parse(block.endsAt) < input.nowMs - input.graceMs)
    .map((block): RecoveryIncident => ({
      scanner: RecoveryScannerKind.StrandedScheduleScan,
      kind: RecoveryIncidentKind.StrandedScheduleBlock,
      subjectId: block.workScheduleBlockId,
      organizationId: block.organizationId,
      ageMs: input.nowMs - Date.parse(block.endsAt),
      decision: "schedule block still holds capacity after its window ended",
      evidenceRefs: [
        `schedule_block:${block.workScheduleBlockId}`,
        `work_item:${block.workItemId}`,
        `agent:${block.assignedAgentId}`,
        `hat_assignment:${block.assignedHatAssignmentId}`,
      ],
    }));

  return { scanner: RecoveryScannerKind.StrandedScheduleScan, scanned: input.scheduleBlocks.length, incidents };
}

export function scanAbandonedRunBindings(input: {
  nowMs: number;
  heartbeatDeadlineMs: number;
  runs: readonly RunBindingRecoveryCandidate[];
}): RecoveryScanReport {
  const incidents = input.runs
    .filter((run) => run.state === "running")
    .filter((run) => input.nowMs - run.lastHeartbeatMs > input.heartbeatDeadlineMs)
    .map((run): RecoveryIncident => ({
      scanner: RecoveryScannerKind.AbandonedRunBindingScan,
      kind: RecoveryIncidentKind.AbandonedRunBinding,
      subjectId: run.runId,
      ageMs: input.nowMs - run.lastHeartbeatMs,
      decision: "Hermes run binding is running without a fresh heartbeat",
      evidenceRefs: [
        `hermes_run:${run.runId}`,
        `work_item:${run.workItemId}`,
        `agent:${run.agentId}`,
        `hat_assignment:${run.hatAssignmentId}`,
      ],
    }));

  return { scanner: RecoveryScannerKind.AbandonedRunBindingScan, scanned: input.runs.length, incidents };
}

export function classifyDeadLetters(input: {
  deadLetters: readonly DeadLetterRecoveryCandidate[];
}): RecoveryScanReport {
  const incidents = input.deadLetters.map((deadLetter): RecoveryIncident => {
    const classification = classifyDeadLetter(deadLetter);

    return {
      scanner: RecoveryScannerKind.DeadLetterClassifier,
      kind: RecoveryIncidentKind.DeadLetteredReactionPlan,
      subjectId: deadLetter.deadLetterId,
      organizationId: deadLetter.organizationId,
      classification,
      decision: `dead-lettered reaction plan classified as ${classification}`,
      evidenceRefs: [
        `reaction_plan:${deadLetter.deadLetterId}`,
        `failed_at:${deadLetter.failedAt}`,
        `failure_message_sha256:${sha256Hex(deadLetter.failureMessage)}`,
      ],
    };
  });

  return { scanner: RecoveryScannerKind.DeadLetterClassifier, scanned: input.deadLetters.length, incidents };
}

export function recoveryIncidentToOrgEvent(input: {
  incident: RecoveryIncident;
  id: string;
  occurredAt: string;
  organizationId: string;
  correlationId: string;
  traceId: string;
}): OrgEvent {
  return {
    id: input.id,
    kind: OrgEventKind.RecoveryIncidentDetected,
    occurredAt: input.occurredAt,
    organizationId: input.incident.organizationId ?? input.organizationId,
    subjectId: input.incident.subjectId,
    decision: input.incident.decision,
    supervisorChain: ["executive_board", "runtime_governance"],
    evidenceRefs: [
      `scanner:${input.incident.scanner}`,
      `incident:${input.incident.kind}`,
      ...(input.incident.classification !== undefined ? [`classification:${input.incident.classification}`] : []),
      ...input.incident.evidenceRefs,
    ],
    correlationId: input.correlationId,
    causationId: input.id,
    traceId: input.traceId,
  };
}

export function recoveryScanCompletedToOrgEvent(input: {
  report: RecoveryScanReport;
  id: string;
  occurredAt: string;
  organizationId: string;
  correlationId: string;
  traceId: string;
}): OrgEvent {
  return {
    id: input.id,
    kind: OrgEventKind.RecoveryScanCompleted,
    occurredAt: input.occurredAt,
    organizationId: input.organizationId,
    subjectId: input.report.scanner,
    decision: `${input.report.scanner} scanned ${input.report.scanned} candidates and found ${input.report.incidents.length} incidents`,
    supervisorChain: ["executive_board", "runtime_governance"],
    evidenceRefs: [`scanner:${input.report.scanner}`, `scanned:${input.report.scanned}`, `incidents:${input.report.incidents.length}`],
    correlationId: input.correlationId,
    causationId: input.id,
    traceId: input.traceId,
  };
}

function classifyDeadLetter(deadLetter: DeadLetterRecoveryCandidate): DeadLetterClassification {
  if (!deadLetter.retryable) {
    return DeadLetterClassification.PoisonPayload;
  }

  if (deadLetter.attemptCount > 1) {
    return DeadLetterClassification.RetryExhausted;
  }

  return DeadLetterClassification.UnknownTerminalFailure;
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isPastOrAt(value: string | undefined, nowMs: number): value is string {
  return value !== undefined && Date.parse(value) <= nowMs;
}

function isCapacityHoldingScheduleBlockState(state: ScheduleBlockState): boolean {
  return state === ScheduleBlockState.Active || state === ScheduleBlockState.Scheduled;
}
