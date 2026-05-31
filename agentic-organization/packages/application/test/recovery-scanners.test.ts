import { deepEqual, equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { ReactionPlanStatus, ScheduleBlockState } from "../../domain/src/index.ts";
import {
  DeadLetterClassification,
  RecoveryIncidentKind,
  RecoveryScannerKind,
  classifyDeadLetters,
  scanAbandonedRunBindings,
  scanStaleReactionPlans,
  scanStrandedScheduleBlocks,
} from "../src/recovery-scanners.ts";

const NOW_MS = Date.parse("2026-05-30T12:00:00.000Z");
const OLD = "2026-05-30T11:00:00.000Z";
const RECENT = "2026-05-30T11:59:30.000Z";

test("stale reaction-plan scan detects expired claims and old planned work without mutating rows", () => {
  const rows = [
    {
      reactionPlanId: "rp-expired-claim",
      organizationId: "org-lfg",
      status: ReactionPlanStatus.Claimed,
      createdAt: OLD,
      claimExpiresAt: "2026-05-30T11:59:00.000Z",
      attemptCount: 1,
    },
    {
      reactionPlanId: "rp-old-planned",
      organizationId: "org-lfg",
      status: ReactionPlanStatus.Planned,
      createdAt: OLD,
      attemptCount: 0,
    },
    {
      reactionPlanId: "rp-recent",
      organizationId: "org-lfg",
      status: ReactionPlanStatus.Planned,
      createdAt: RECENT,
      attemptCount: 0,
    },
  ];

  const report = scanStaleReactionPlans({
    nowMs: NOW_MS,
    staleAfterMs: 10 * 60 * 1000,
    reactionPlans: rows,
  });

  equal(report.scanner, RecoveryScannerKind.StaleReactionPlanScan);
  deepEqual(report.incidents.map((incident) => incident.subjectId), ["rp-expired-claim", "rp-old-planned"]);
  deepEqual(report.incidents.map((incident) => incident.kind), [
    RecoveryIncidentKind.ExpiredReactionPlanClaim,
    RecoveryIncidentKind.StalePlannedReactionPlan,
  ]);
  equal(rows[0]?.status, ReactionPlanStatus.Claimed, "scan is recovery-observability only");
});

test("stranded schedule scan detects capacity-holding blocks that ended before the grace window", () => {
  const report = scanStrandedScheduleBlocks({
    nowMs: NOW_MS,
    graceMs: 5 * 60 * 1000,
    scheduleBlocks: [
      {
        workScheduleBlockId: "sched-stranded",
        organizationId: "org-lfg",
        workItemId: "work-1",
        assignedAgentId: "agent-1",
        assignedHatAssignmentId: "hat-1",
        state: ScheduleBlockState.Active,
        startsAt: "2026-05-30T10:00:00.000Z",
        endsAt: "2026-05-30T11:00:00.000Z",
      },
      {
        workScheduleBlockId: "sched-open",
        organizationId: "org-lfg",
        workItemId: "work-2",
        assignedAgentId: "agent-2",
        assignedHatAssignmentId: "hat-2",
        state: ScheduleBlockState.Scheduled,
        startsAt: "2026-05-30T11:55:00.000Z",
        endsAt: "2026-05-30T12:10:00.000Z",
      },
    ],
  });

  equal(report.scanner, RecoveryScannerKind.StrandedScheduleScan);
  deepEqual(report.incidents.map((incident) => incident.subjectId), ["sched-stranded"]);
  equal(report.incidents[0]?.kind, RecoveryIncidentKind.StrandedScheduleBlock);
});

test("abandoned run-binding scan detects running Hermes bindings whose heartbeat is past deadline", () => {
  const report = scanAbandonedRunBindings({
    nowMs: NOW_MS,
    heartbeatDeadlineMs: 60_000,
    runs: [
      {
        runId: "run-abandoned",
        workItemId: "work-1",
        agentId: "agent-1",
        sessionId: "session-1",
        hatAssignmentId: "hat-1",
        promptFlowRunId: "prompt-1",
        state: "running",
        lastHeartbeatMs: NOW_MS - 61_000,
      },
      {
        runId: "run-fresh",
        workItemId: "work-2",
        agentId: "agent-2",
        sessionId: "session-2",
        hatAssignmentId: "hat-2",
        promptFlowRunId: "prompt-2",
        state: "running",
        lastHeartbeatMs: NOW_MS - 60_000,
      },
    ],
  });

  equal(report.scanner, RecoveryScannerKind.AbandonedRunBindingScan);
  deepEqual(report.incidents.map((incident) => incident.subjectId), ["run-abandoned"]);
  equal(report.incidents[0]?.kind, RecoveryIncidentKind.AbandonedRunBinding);
});

test("dead-letter classifier separates poison rows from exhausted retry failures", () => {
  const report = classifyDeadLetters({
    deadLetters: [
      {
        deadLetterId: "rp-poison",
        organizationId: "org-lfg",
        createdAt: OLD,
        failedAt: "2026-05-30T11:30:00.000Z",
        failureMessage: "invalid durable reaction plan action",
        retryable: false,
        attemptCount: 1,
      },
      {
        deadLetterId: "rp-exhausted",
        organizationId: "org-lfg",
        createdAt: OLD,
        failedAt: "2026-05-30T11:45:00.000Z",
        failureMessage: "sandbox unavailable",
        retryable: true,
        attemptCount: 5,
      },
    ],
  });

  equal(report.scanner, RecoveryScannerKind.DeadLetterClassifier);
  deepEqual(report.incidents.map((incident) => incident.subjectId), ["rp-poison", "rp-exhausted"]);
  deepEqual(report.incidents.map((incident) => incident.classification), [
    DeadLetterClassification.PoisonPayload,
    DeadLetterClassification.RetryExhausted,
  ]);
});

test("dead-letter classifier hashes failure text instead of persisting raw messages", () => {
  const secretLikeMessage = "provider failed with Authorization: Bearer sk-test-secret and payload <inject>";

  const report = classifyDeadLetters({
    deadLetters: [
      {
        deadLetterId: "rp-secret",
        organizationId: "org-lfg",
        createdAt: OLD,
        failedAt: "2026-05-30T11:30:00.000Z",
        failureMessage: secretLikeMessage,
        retryable: false,
        attemptCount: 1,
      },
    ],
  });

  const refs = report.incidents[0]?.evidenceRefs ?? [];
  ok(refs.some((ref) => /^failure_message_sha256:[a-f0-9]{64}$/.test(ref)));
  ok(refs.every((ref) => !ref.includes("sk-test-secret")));
  ok(refs.every((ref) => !ref.includes("<inject>")));
});
