/**
 * E2 KIND proof: durable hat authority and non-forgeable evidence.
 *
 *   kubectl -n agentic-org port-forward svc/cockroach 26260:26257 &
 *   COCKROACH_DATABASE_URL=postgresql://root@localhost:26260/defaultdb?sslmode=disable \
 *     node --experimental-strip-types deploy/run-real-authority-evidence.ts
 */

import { randomUUID } from "node:crypto";
import { env } from "node:process";
import { Pool } from "pg";

import {
  BusinessRuleEvaluationStatus,
  ChangeArtifactKind,
  ChangeSetPhase,
  CommandType,
  DiscussionAnchorType,
  DiscussionExpectedOutput,
  HatAssignmentAuthorityState,
  OrgEventKind,
  ProjectStatus,
  QualityGateKind,
  QualityGateOutcome,
  ReactionPlanActionType,
  ReactionPlanReason,
  RequiredHat,
  ReviewGateKind,
  SupervisorChainLevel,
  WorkItemType,
  type ChangeSet,
  type ReviewPipeline,
} from "../packages/domain/src/index.ts";
import {
  PolicyDecisionStatus,
  createCommandAuthorizationPort,
  createPolicyDecisionObservationPort,
} from "../packages/policy/src/index.ts";
import {
  ActionClass,
} from "../packages/application/src/hat-guardrails.ts";
import {
  createCommandHandlerRegistry,
  createCommandPipeline,
  createContentAddressedEvidenceArtifact,
  createContentAddressedEvidenceRef,
  createCreateDiscussionAnchorHandler,
  createCreateWorkItemHandler,
  createHatAuthorityPort,
  createRecordQualityGateEvaluationHandler,
  openChangeSet,
  runReviewStage,
  buildHatDefinitions,
  type CommandResult,
  type CreateDiscussionAnchorCommand,
  type CreateWorkItemCommand,
  type RecordQualityGateEvaluationCommand,
  type ReviewKernelDeps,
} from "../packages/application/src/index.ts";
import {
  createCockroachChangeSetStore,
  createCockroachCoreStateMigrations,
  createCockroachDurableStateAdapters,
  createCockroachOrgEventStore,
  createCockroachSqlExecutor,
  splitSqlStatements,
} from "../packages/state-cockroach/src/index.ts";
import type { CockroachSqlClient } from "../packages/state-cockroach/src/cockroach-sql-executor.ts";
import { CommandResultStatus } from "../packages/application/src/command-result.ts";
import {
  ReactionPlanExecutionStatus,
  type ReactionPlanActionExecutorPort,
} from "../packages/runtime/src/index.ts";
import { composeOrganizationReactionPlanActionExecutor } from "../apps/workers/src/organization-executor-composition.ts";

const connectionString = env.COCKROACH_DATABASE_URL ?? "postgresql://root@localhost:26257/defaultdb?sslmode=disable";
const proofRunId = randomUUID().slice(0, 8);
const organizationId = `org-authority-evidence-${proofRunId}`;
const projectId = `project-authority-evidence-${proofRunId}`;
const teamId = `team-authority-evidence-${proofRunId}`;
const nowMs = Date.now();
const nowIso = new Date(nowMs).toISOString();

type ProofCommand = CreateWorkItemCommand | CreateDiscussionAnchorCommand | RecordQualityGateEvaluationCommand;

async function main(): Promise<void> {
  const pool = new Pool({ connectionString });
  try {
    const client: CockroachSqlClient = {
      query: async (sql, parameters) => ({ rows: (await pool.query(sql, parameters as unknown[])).rows }),
      transaction: async (operation) => operation(client),
    };
    const executor = createCockroachSqlExecutor({ client });

    for (const migration of createCockroachCoreStateMigrations()) {
      for (const statement of splitSqlStatements(migration.sql)) {
        await pool.query(statement);
      }
    }

    await seedHatAuthority(pool, {
      hatAssignmentId: "hat-assignment-tpm-proof",
      hatId: "senior_tpm",
      assignedAgentId: "agent-tpm-proof",
    });
    await seedHatAuthority(pool, {
      hatAssignmentId: "hat-assignment-release-proof",
      hatId: "release_operator",
      assignedAgentId: "agent-release-proof",
    });
    await seedHatAuthority(pool, {
      hatAssignmentId: "hat-assignment-reviewer-proof",
      hatId: "code_reviewer",
      assignedAgentId: "agent-reviewer-proof",
    });
    await seedHatAuthority(pool, {
      hatAssignmentId: "hat-assignment-reaction-engineering_manager",
      hatId: "engineering_manager",
      assignedAgentId: "agent-reaction-engineering_manager",
    });
    await seedProject(pool);

    const adapters = createCockroachDurableStateAdapters<CommandResult>({ executor });
    const policyObservationPort = createPolicyDecisionObservationPort({
      store: adapters.policyDecisionObservationStore,
    });
    const commandAuthorizationPort = createCommandAuthorizationPort({
      hatAuthorityPort: createHatAuthorityPort({
        hatAssignmentAuthorityReader: adapters.hatAssignmentAuthorityReader,
        hatDefinitions: buildHatDefinitions(),
        createId,
      }),
    });
    const pipeline = createCommandPipeline<ProofCommand>({
      stateStoreFactory: adapters.commandStateStoreFactory,
      commandAuthorizationPort,
      policyDecisionObservationPort: policyObservationPort,
      handlerRegistry: createCommandHandlerRegistry<ProofCommand, CommandResult>([
        createCreateWorkItemHandler(),
        createCreateDiscussionAnchorHandler(),
        createRecordQualityGateEvaluationHandler(),
      ]),
      discussionAnchorStateReader: adapters.discussionAnchorStateReader,
      qualityGateEvaluationStateReader: adapters.qualityGateEvaluationStateReader,
      workAnchorStateReader: adapters.workAnchorStateStore,
      now: () => nowIso,
      createId,
    });

    const deniedWriteCode = await pipeline.execute(createWorkCommand({
      suffix: "tpm-denied",
      actorAgentId: "agent-tpm-proof",
      hatAssignmentId: "hat-assignment-tpm-proof",
    }));
    const observedDenials = await adapters.policyDecisionObservationStore.findPolicyDecisionObservations({
      organizationId,
      projectId,
      agentId: "agent-tpm-proof",
      hatAssignmentId: "hat-assignment-tpm-proof",
      decisionStatus: PolicyDecisionStatus.Denied,
      limit: 10,
    });
    const allowedWriteCode = await pipeline.execute(createWorkCommand({
      suffix: "release-allowed",
      actorAgentId: "agent-release-proof",
      hatAssignmentId: "hat-assignment-release-proof",
    }));

    const plainContext = await prepareQualityGateContext(pipeline, "plain-evidence");
    const plainGate = await pipeline.execute(createQualityGateCommand({
      suffix: "plain-evidence",
      ...plainContext,
      evidenceRefs: ["plain-qa-report"],
    }));
    const evidenceArtifact = createContentAddressedEvidenceArtifact("qa-report", {
      organizationId,
      proofRunId,
      scenario: "approved-quality-gate",
    });
    const evidenceRef = evidenceArtifact.ref;
    const contentAddressedContext = await prepareQualityGateContext(pipeline, "content-addressed-evidence");
    const acceptedGate = await pipeline.execute(createQualityGateCommand({
      suffix: "content-addressed-evidence",
      ...contentAddressedContext,
      evidenceRefs: [evidenceRef],
      evidenceArtifacts: [evidenceArtifact],
    }));

    const stageEvidenceRef = createContentAddressedEvidenceRef("review-stage", {
      organizationId,
      proofRunId,
      stage: "implementation-review",
    });
    const changeProof = await proveReviewStageEvidence(executor, stageEvidenceRef);
    const workerCompositionProof = await proveWorkerComposition(executor);

    const ok =
      deniedWriteCode.status === CommandResultStatus.Rejected &&
      deniedWriteCode.error?.code === "policy_denied" &&
      observedDenials.length === 1 &&
      allowedWriteCode.status === CommandResultStatus.Accepted &&
      plainGate.status === CommandResultStatus.Rejected &&
      plainGate.error?.message === "approved or waived quality gates require content-addressed evidence refs" &&
      acceptedGate.status === CommandResultStatus.Accepted &&
      changeProof.persistedEvidenceRefs.includes(stageEvidenceRef) &&
      workerCompositionProof.status === ReactionPlanExecutionStatus.Succeeded;

    console.log(JSON.stringify({
      track: "E2 real authority + content-addressed evidence",
      organizationId,
      deniedWriteCode: {
        status: deniedWriteCode.status,
        reason: deniedWriteCode.policy?.reason,
        observedDenials: observedDenials.length,
      },
      allowedWriteCode: {
        status: allowedWriteCode.status,
        artifactId: allowedWriteCode.artifacts?.[0]?.artifactId,
      },
      qualityGateEvidence: {
        plainStatus: plainGate.status,
        plainError: plainGate.error?.message,
        contentAddressedStatus: acceptedGate.status,
        evidenceRef,
      },
      reviewStageEvidence: changeProof,
      workerCompositionProof,
      PROOF: ok ? "PASS" : "FAIL",
    }, null, 2));
    process.exitCode = ok ? 0 : 1;
  } finally {
    await pool.end();
  }
}

async function proveWorkerComposition(
  executor: ReturnType<typeof createCockroachSqlExecutor>,
): Promise<{ status: ReactionPlanExecutionStatus }> {
  const organizationExecutor = composeOrganizationReactionPlanActionExecutor({
    cockroachExecutor: executor,
    agentExecutor: createSucceededAgentExecutor(),
    createId,
    now: () => nowIso,
  });
  const result = await organizationExecutor.executeReactionPlanAction(
    {
      actionType: ReactionPlanActionType.CreateSupervisorTriage,
      triggerEventId: `evt-worker-composition-${proofRunId}`,
      organizationId,
      projectId,
      teamId,
      workItemId: `work-worker-composition-${proofRunId}`,
      supervisorSignalId: `supervisor-signal-${proofRunId}`,
      targetLevel: SupervisorChainLevel.Manager,
      requiredHat: RequiredHat.EngineeringManager,
      reason: ReactionPlanReason.SupervisorSignalNeedsTriage,
    },
    {
      reactionPlanId: `reaction-plan-${proofRunId}`,
      claimId: `reaction-claim-${proofRunId}`,
      actionIdempotencyKey: `reaction-plan-${proofRunId}:create_supervisor_triage`,
      claimExpiresAt: new Date(nowMs + 300_000).toISOString(),
    },
  );

  return { status: result.status };
}

function createSucceededAgentExecutor(): ReactionPlanActionExecutorPort {
  return {
    executeReactionPlanAction: async () => ({
      status: ReactionPlanExecutionStatus.Succeeded,
      result: {
        message: "agent ran",
        createdWorkItemIds: [],
        createdDiscussionAnchorIds: [],
      },
    }),
  };
}

async function seedHatAuthority(
  pool: Pool,
  input: { hatAssignmentId: string; hatId: string; assignedAgentId: string },
): Promise<void> {
  await pool.query(
    `
      UPSERT INTO agentic_org_hat_assignment_authorities (
        hat_assignment_id,
        hat_id,
        organization_id,
        project_id,
        team_id,
        assigned_agent_id,
        state,
        updated_at,
        version,
        correlation_id,
        causation_id,
        trace_id
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1, $9, $9, $9)
    `,
    [
      input.hatAssignmentId,
      input.hatId,
      organizationId,
      projectId,
      teamId,
      input.assignedAgentId,
      HatAssignmentAuthorityState.Active,
      nowIso,
      `trace-${proofRunId}`,
    ],
  );
}

async function seedProject(pool: Pool): Promise<void> {
  await pool.query(
    `
      INSERT INTO agentic_org_projects (
        project_id,
        organization_id,
        name,
        status,
        created_at,
        updated_at,
        version,
        created_by_agent_id,
        created_by_hat_assignment_id,
        correlation_id,
        causation_id,
        trace_id
      )
      VALUES ($1, $2, $3, $4, $5, $5, 1, $6, $7, $8, $8, $8)
      ON CONFLICT (project_id) DO NOTHING
    `,
    [
      projectId,
      organizationId,
      "E2 authority evidence proof project",
      ProjectStatus.Active,
      nowIso,
      "agent-release-proof",
      "hat-assignment-release-proof",
      `trace-${proofRunId}`,
    ],
  );
}

function createWorkCommand(input: {
  suffix: string;
  actorAgentId: string;
  hatAssignmentId: string;
}): CreateWorkItemCommand {
  return {
    commandId: `cmd-work-${input.suffix}-${proofRunId}`,
    type: CommandType.CreateWorkItem,
    idempotencyKey: `idem-work-${input.suffix}-${proofRunId}`,
    requestHash: `hash-work-${input.suffix}-${proofRunId}`,
    correlationId: `corr-work-${input.suffix}-${proofRunId}`,
    causationId: `cause-work-${input.suffix}-${proofRunId}`,
    traceId: `trace-work-${input.suffix}-${proofRunId}`,
    organizationId,
    projectId,
    actor: {
      agentId: input.actorAgentId,
      hatAssignmentId: input.hatAssignmentId,
    },
    policyContext: {
      scope: { teamId },
      toolType: ActionClass.WriteCode,
    },
    workItemType: WorkItemType.Task,
    title: `E2 write-code authority proof ${input.suffix}`,
    description: "Proof command used to verify durable hat authority over write_code.",
  };
}

function createQualityGateCommand(input: {
  suffix: string;
  workItemId: string;
  discussionAnchorId: string;
  evidenceRefs: readonly string[];
  evidenceArtifacts?: RecordQualityGateEvaluationCommand["evidenceArtifacts"];
}): RecordQualityGateEvaluationCommand {
  return {
    commandId: `cmd-quality-gate-${input.suffix}-${proofRunId}`,
    type: CommandType.RecordQualityGateEvaluation,
    idempotencyKey: `idem-quality-gate-${input.suffix}-${proofRunId}`,
    requestHash: `hash-quality-gate-${input.suffix}-${proofRunId}`,
    correlationId: `corr-quality-gate-${input.suffix}-${proofRunId}`,
    causationId: `cause-quality-gate-${input.suffix}-${proofRunId}`,
    traceId: `trace-quality-gate-${input.suffix}-${proofRunId}`,
    organizationId,
    projectId,
    teamId,
    actor: {
      agentId: "agent-reviewer-proof",
      hatAssignmentId: "hat-assignment-reviewer-proof",
    },
    policyContext: {
      scope: {
        teamId,
        workItemId: input.workItemId,
      },
      toolType: ActionClass.ApproveReview,
    },
    workItemId: input.workItemId,
    discussionAnchorId: input.discussionAnchorId,
    gateKind: QualityGateKind.CustomerRfpReview,
    outcome: QualityGateOutcome.Approved,
    summary: "The gate is approved only when evidence is content-addressed.",
    evaluatedArtifactIds: input.evidenceRefs,
    evidenceArtifacts: input.evidenceArtifacts,
    businessRuleResults: [
      {
        ruleId: "E2-BR-1",
        status: BusinessRuleEvaluationStatus.Satisfied,
        evidenceArtifactIds: input.evidenceRefs,
        notes: "Content-addressed evidence proves the evaluated artifact identity.",
      },
    ],
  };
}

async function prepareQualityGateContext(
  pipeline: ReturnType<typeof createCommandPipeline<ProofCommand>>,
  suffix: string,
): Promise<{ workItemId: string; discussionAnchorId: string }> {
  const workItem = await pipeline.execute(createWorkCommand({
    suffix: `quality-context-${suffix}`,
    actorAgentId: "agent-release-proof",
    hatAssignmentId: "hat-assignment-release-proof",
  }));
  if (workItem.status !== CommandResultStatus.Accepted || workItem.artifacts?.[0]?.artifactId === undefined) {
    throw new Error(`failed to seed quality-gate work item: ${workItem.error?.message ?? workItem.status}`);
  }

  const workItemId = workItem.artifacts[0].artifactId;
  const anchor = await pipeline.execute(createDiscussionAnchorCommand({ suffix, workItemId }));
  if (anchor.status !== CommandResultStatus.Accepted || anchor.artifacts?.[0]?.artifactId === undefined) {
    throw new Error(`failed to seed quality-gate discussion anchor: ${anchor.error?.message ?? anchor.status}`);
  }

  return {
    workItemId,
    discussionAnchorId: anchor.artifacts[0].artifactId,
  };
}

function createDiscussionAnchorCommand(input: {
  suffix: string;
  workItemId: string;
}): CreateDiscussionAnchorCommand {
  return {
    commandId: `cmd-discussion-anchor-${input.suffix}-${proofRunId}`,
    type: CommandType.CreateDiscussionAnchor,
    idempotencyKey: `idem-discussion-anchor-${input.suffix}-${proofRunId}`,
    requestHash: `hash-discussion-anchor-${input.suffix}-${proofRunId}`,
    correlationId: `corr-discussion-anchor-${input.suffix}-${proofRunId}`,
    causationId: `cause-discussion-anchor-${input.suffix}-${proofRunId}`,
    traceId: `trace-discussion-anchor-${input.suffix}-${proofRunId}`,
    organizationId,
    projectId,
    teamId,
    actor: {
      agentId: "agent-reviewer-proof",
      hatAssignmentId: "hat-assignment-reviewer-proof",
    },
    policyContext: {
      scope: {
        teamId,
        workItemId: input.workItemId,
      },
      toolType: ActionClass.WriteDoc,
    },
    workItemId: input.workItemId,
    discussionAnchorType: DiscussionAnchorType.WorkItem,
    title: `E2 quality-gate anchor ${input.suffix}`,
    purpose: "Bind quality-gate proof evidence to a durable work item.",
    expectedOutputs: [DiscussionExpectedOutput.GateResult],
  };
}

async function proveReviewStageEvidence(
  executor: ReturnType<typeof createCockroachSqlExecutor>,
  stageEvidenceRef: string,
): Promise<{
  changeSetId: string;
  finalPhase: ChangeSetPhase;
  persistedEvidenceRefs: readonly string[];
}> {
  const changeSetStore = createCockroachChangeSetStore({ executor });
  const orgEventStore = createCockroachOrgEventStore({ executor });
  const pipeline: ReviewPipeline = {
    pipelineId: `pipeline-e2-${proofRunId}`,
    organizationId,
    stages: [
      {
        id: "implementation-review",
        ownerLabel: "code_reviewer",
        authority: { kind: "hat", hatId: "code_reviewer" },
        gate: ReviewGateKind.NoBlockingFindings,
        blocking: true,
      },
    ],
  };
  const initial = changeSet();
  const deps: ReviewKernelDeps = {
    organizationId,
    now: nowMs,
    createId,
    blockingFindings: () => 0,
    stageEvidenceRefs: () => [stageEvidenceRef],
  };
  const opened = openChangeSet(initial, deps);
  await changeSetStore.upsert(opened.changeSet);
  for (const event of opened.events) await orgEventStore.append(event);

  const reviewed = runReviewStage(opened.changeSet, pipeline, deps);
  await changeSetStore.upsert(reviewed.changeSet);
  for (const event of reviewed.events) await orgEventStore.append(event);

  const events = await orgEventStore.listByOrganization(organizationId, 100);
  const stageEvent = events.find((event) =>
    (event.kind === OrgEventKind.StageApproved || event.kind === OrgEventKind.ChangeSetApproved) &&
    event.subjectId === initial.changeSetId &&
    event.evidenceRefs.includes(stageEvidenceRef)
  );

  return {
    changeSetId: initial.changeSetId,
    finalPhase: reviewed.changeSet.phase,
    persistedEvidenceRefs: stageEvent?.evidenceRefs ?? [],
  };
}

function changeSet(): ChangeSet {
  return {
    changeSetId: `cs-e2-${proofRunId}`,
    organizationId,
    workItemId: `work-e2-change-${proofRunId}`,
    proposerHatId: "release_operator",
    title: "E2 stage evidence proof",
    targetRef: `refs/heads/e2-${proofRunId}`,
    phase: ChangeSetPhase.Drafted,
    pipelineId: `pipeline-e2-${proofRunId}`,
    currentStageIndex: 0,
    artifacts: [
      {
        kind: ChangeArtifactKind.CodeDiff,
        path: "src/e2-proof.ts",
        diff: "+proof",
        language: "typescript",
      },
    ],
    projections: [],
    revision: 1,
    openedAt: nowIso,
    updatedAt: nowIso,
  };
}

function createId(prefix: string): string {
  return `${prefix}-${proofRunId}-${randomUUID()}`;
}

await main();
