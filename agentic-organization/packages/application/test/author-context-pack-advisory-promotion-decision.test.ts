import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import { CommandType } from "../../domain/src/index.ts";
import {
  AuthorContextPackAdvisoryPromotionDecisionValidationErrorMessage,
  CommandErrorCode,
  CommandResultArtifactType,
  CommandResultStatus,
  ContextPackAdvisoryPromotionDecisionStatus,
  ContextPackCurationProfileId,
  ContextPackItemKind,
  DEFAULT_CONTEXT_PACK_ADVISORY_PROMOTION_POLICY_VERSION,
  authorContextPackAdvisoryPromotionDecision,
  type AuthorContextPackAdvisoryPromotionDecisionCommand,
  type CommandResult,
} from "../src/index.ts";

const AdvisoryPromotionDecisionTestId = {
  AgentDirector: "agent-director-001",
  Audit: "audit-001",
  Causation: "cause-advisory-promotion-001",
  Command: "cmd-advisory-promotion-001",
  Correlation: "corr-advisory-promotion-001",
  Decision: "context-pack-advisory-promotion-decision-001",
  HatDirector: "engineering_director",
  HatAssignmentDirector: "99",
  Idempotency: "idem-advisory-promotion-001",
  Project: "project-billing",
  RequestHash: "hash-advisory-promotion-001",
  Team: "team-platform",
  Trace: "trace-advisory-promotion-001",
  WorkItem: "work-billing",
} as const;

const AdvisoryPromotionDecisionTestTime = {
  DecidedAt: "2026-06-03T18:00:00.000Z",
} as const;

const command: AuthorContextPackAdvisoryPromotionDecisionCommand = {
  commandId: AdvisoryPromotionDecisionTestId.Command,
  type: CommandType.AuthorContextPackAdvisoryPromotionDecision,
  idempotencyKey: AdvisoryPromotionDecisionTestId.Idempotency,
  requestHash: AdvisoryPromotionDecisionTestId.RequestHash,
  correlationId: AdvisoryPromotionDecisionTestId.Correlation,
  causationId: AdvisoryPromotionDecisionTestId.Causation,
  traceId: AdvisoryPromotionDecisionTestId.Trace,
  organizationId: "org-lfg",
  projectId: AdvisoryPromotionDecisionTestId.Project,
  teamId: AdvisoryPromotionDecisionTestId.Team,
  workItemId: AdvisoryPromotionDecisionTestId.WorkItem,
  actor: {
    agentId: AdvisoryPromotionDecisionTestId.AgentDirector,
    hatAssignmentId: AdvisoryPromotionDecisionTestId.HatAssignmentDirector,
  },
  hatId: AdvisoryPromotionDecisionTestId.HatDirector,
  hatAssignmentId: AdvisoryPromotionDecisionTestId.HatAssignmentDirector,
  curationProfileId: ContextPackCurationProfileId.ManagementBlocker,
  status: ContextPackAdvisoryPromotionDecisionStatus.Approved,
  lifecycleBlocker: "ownership gap blocks execution",
  fingerprint: {
    itemKind: ContextPackItemKind.SynthesisGapHypothesis,
    summaryHash: "summary-hash-owner-gap",
    citationRefs: ["context_requirement:owner", "doc:billing-brd"],
    sourcePointerKeys: ["doc_unit:billing-brd:1"],
  },
  evidenceRefs: ["doc:billing-brd", "context_requirement:owner"],
};

describe("author context-pack advisory-promotion decision handler", () => {
  test("emits an audited advisory-promotion decision effect for the target scope and fingerprint", async () => {
    const outcome = await authorContextPackAdvisoryPromotionDecision(command, {
      now: () => AdvisoryPromotionDecisionTestTime.DecidedAt,
      createId: (prefix) => `${prefix}-001`,
    });
    const result = outcome.result as CommandResult;

    equal(result.status, CommandResultStatus.Accepted);
    equal(result.contextPackAdvisoryPromotionDecision?.decisionId, AdvisoryPromotionDecisionTestId.Decision);
    equal(
      result.contextPackAdvisoryPromotionDecision?.decisionKey,
      "org-lfg:engineering_director:99:project-billing:team-platform:work-billing:management_blocker:" +
        "synthesis_gap_hypothesis:summary-hash-owner-gap",
    );
    equal(result.contextPackAdvisoryPromotionDecision?.policyVersion, DEFAULT_CONTEXT_PACK_ADVISORY_PROMOTION_POLICY_VERSION);
    equal(result.contextPackAdvisoryPromotionDecision?.audit.decidedByAgentId, AdvisoryPromotionDecisionTestId.AgentDirector);
    equal(result.contextPackAdvisoryPromotionDecision?.audit.decidedAt, AdvisoryPromotionDecisionTestTime.DecidedAt);
    deepEqual(outcome.effects.contextPackAdvisoryPromotionDecisions, [
      result.contextPackAdvisoryPromotionDecision,
    ]);
    deepEqual(result.artifacts, [{
      artifactType: CommandResultArtifactType.ContextPackAdvisoryPromotionDecision,
      artifactId: AdvisoryPromotionDecisionTestId.Decision,
      label: "ownership gap blocks execution",
    }]);
  });

  test("rejects revoked decisions with empty lifecycle blockers before emitting effects", async () => {
    const outcome = await authorContextPackAdvisoryPromotionDecision({
      ...command,
      status: ContextPackAdvisoryPromotionDecisionStatus.Revoked,
      lifecycleBlocker: " ",
    }, {
      now: () => AdvisoryPromotionDecisionTestTime.DecidedAt,
      createId: (prefix) => `${prefix}-001`,
    });
    const result = outcome.result as CommandResult;

    equal(result.status, CommandResultStatus.Rejected);
    equal(result.error?.code, CommandErrorCode.ValidationFailed);
    equal(
      result.error?.message,
      AuthorContextPackAdvisoryPromotionDecisionValidationErrorMessage.LifecycleBlockerRequired,
    );
    deepEqual(outcome.effects.contextPackAdvisoryPromotionDecisions, []);
  });

  test("rejects unsupported advisory item kinds before emitting effects", async () => {
    const outcome = await authorContextPackAdvisoryPromotionDecision({
      ...command,
      fingerprint: {
        ...command.fingerprint,
        itemKind: ContextPackItemKind.Policy,
      },
    }, {
      now: () => AdvisoryPromotionDecisionTestTime.DecidedAt,
      createId: (prefix) => `${prefix}-001`,
    });
    const result = outcome.result as CommandResult;

    equal(result.status, CommandResultStatus.Rejected);
    equal(result.error?.code, CommandErrorCode.ValidationFailed);
    equal(
      result.error?.message,
      AuthorContextPackAdvisoryPromotionDecisionValidationErrorMessage.FingerprintItemKindInvalid,
    );
    deepEqual(outcome.effects.contextPackAdvisoryPromotionDecisions, []);
  });
});
