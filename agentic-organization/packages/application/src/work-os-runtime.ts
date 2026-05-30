/**
 * runWorkOsCycle — the LIVING work loop (WORK_OS_OVERHAUL §F/W6). Ties every
 * overhaul layer into one observable run:
 *
 *   external defect intake → triage into the backlog → work batch →
 *   develop → QA catches a REGRESSION → defect → QA bounce-backs →
 *   CHURN detected → escalation pulls in MORE AGENTS (RMO supply-expand) and
 *   brings in an ARCHITECT to change approach → re-test GREEN → released,
 *   with the work-batch metrics rolling up to the executive scope.
 *
 * Determinism drives the legal moves; the org_event trace makes the whole living
 * loop crystal-clear. Every transition is one org_event.
 */

import {
  HatLevel,
  OrgEventKind,
  TestRunOutcome,
  WorkBatchState,
  WorkItemState,
  WorkItemType,
  type HatDefinition,
  type OrgEvent,
  type TestRun,
  type WorkBatch,
  type WorkItem,
} from "../../domain/src/index.ts";
import { createWorkItemFromIntake, normalizeIntake, triageIntake, type IntakeDeps } from "./intake.ts";
import { createDeterministicExecutor, deriveTestCasesFromBrd, runQaCycle } from "./qa.ts";
import { bounceBackCount, decideEscalation, detectChurn, EscalationAction, EscalationTrigger } from "./escalation.ts";
import { decideHatSupply, type HatSupplyVote } from "./rmo.ts";
import { firstLegalChooser } from "./org-decision.ts";
import { observeForHat, type OrgWorkState } from "./observe-for-hat.ts";
import { type ScopeMetrics, type TestSummary } from "../../observability/src/work-batch-metrics.ts";

export type WorkOsCycleDeps = {
  organizationId: string;
  projectId: string;
  initiativeId: string;
  initiativeBranch: string;
  hats: readonly HatDefinition[];
  baseTimeMs: number;
  createId: (prefix: string) => string;
  appendEvent: (event: OrgEvent) => Promise<void>;
};

export type WorkOsCycleReport = {
  intakeWorkItemId: string;
  workItemType: WorkItemType;
  finalState: WorkItemState;
  bounceBacks: number;
  churnDetected: boolean;
  regressionsCaught: number;
  escalations: readonly EscalationAction[];
  agentsAddedViaRmo: number;
  architectBroughtIn: boolean;
  totalEvents: number;
  eventsByKind: Record<string, number>;
  execScopeRollup: ScopeMetrics;
};

const CHURN_TARGET = 3;

export async function runWorkOsCycle(deps: WorkOsCycleDeps): Promise<WorkOsCycleReport> {
  const byId = new Map(deps.hats.map((h) => [h.id, h]));
  const iso = (ms: number): string => new Date(ms).toISOString();
  let tick = 0;
  const nextIso = (): string => iso(deps.baseTimeMs + tick++ * 1000);

  const eventsByKind: Record<string, number> = {};
  const allEvents: OrgEvent[] = [];
  const emit = async (e: OrgEvent): Promise<void> => {
    allEvents.push(e);
    eventsByKind[e.kind] = (eventsByKind[e.kind] ?? 0) + 1;
    await deps.appendEvent(e);
  };
  const simpleTransition = async (workItemId: string, from: WorkItemState, to: WorkItemState, actorHatId: string, decision: string): Promise<void> => {
    await emit({
      id: deps.createId("evt"), kind: OrgEventKind.WorkItemTransition, occurredAt: nextIso(), organizationId: deps.organizationId,
      actorHatId, subjectId: workItemId, fromState: from, toState: to, decision, supervisorChain: [], evidenceRefs: [],
      correlationId: workItemId, causationId: workItemId, traceId: workItemId,
    });
  };

  const intakeDeps: IntakeDeps = {
    organizationId: deps.organizationId, initiativeId: deps.initiativeId,
    createdBy: { agentId: "intake-svc", hatAssignmentId: "ha-intake" },
    createId: deps.createId, nowIso: nextIso, existsByExternalRef: () => false, appendEvent: emit,
  };

  // ── 1. External customer defect flows IN → triaged into the backlog ──
  const norm = normalizeIntake({ source: "customer_portal", externalId: "TICKET-501", kind: "defect", title: "checkout returns 500 on coupon", projectId: deps.projectId, severity: "sev2" });
  if (!norm.ok) throw new Error(`intake normalize failed: ${norm.feedback.reason}`);
  const created = await createWorkItemFromIntake(norm.value, intakeDeps);
  if (!created.ok) throw new Error(`intake create failed: ${created.feedback.reason}`);
  let item: WorkItem = await triageIntake(created.value.workItem, intakeDeps); // → ready

  // ── 2. Work batch (the work group leads/directors prioritize over) ──
  const emanager = deps.hats.find((h) => h.level === HatLevel.Manager && h.id === "engineering_manager") ?? deps.hats.find((h) => h.level === HatLevel.Manager)!;
  const batch: WorkBatch = {
    batchId: deps.createId("batch"), organizationId: deps.organizationId, scopeKind: "initiative", scopeId: deps.initiativeId,
    ownerHatId: emanager.id, state: WorkBatchState.Active, capacityPlannedHats: 2, createdAt: nextIso(), updatedAt: nextIso(),
  };
  item = { ...item, batchId: batch.batchId };
  for (const [from, to] of [[WorkBatchState.Created, WorkBatchState.Scoped], [WorkBatchState.Scoped, WorkBatchState.CapacityPlanned], [WorkBatchState.CapacityPlanned, WorkBatchState.Scheduled], [WorkBatchState.Scheduled, WorkBatchState.Active]] as const) {
    await emit({ id: deps.createId("evt"), kind: OrgEventKind.WorkBatchTransition, occurredAt: nextIso(), organizationId: deps.organizationId, actorHatId: emanager.id, subjectId: batch.batchId, fromState: from, toState: to, decision: `batch ${from} → ${to}`, supervisorChain: [], evidenceRefs: [], correlationId: batch.batchId, causationId: batch.batchId, traceId: batch.batchId });
  }

  // ── 3. Develop: ready → in_progress → review (owner hats act) ──
  const owners = ["backend_implementer", "code_reviewer"].filter((id) => byId.has(id));
  await simpleTransition(item.workItemId, WorkItemState.Ready, WorkItemState.InProgress, emanager.id, "assigned + development started");
  item = { ...item, state: WorkItemState.InProgress };
  await simpleTransition(item.workItemId, WorkItemState.InProgress, WorkItemState.Review, "backend_implementer", "fix implemented; into review/QA");
  item = { ...item, state: WorkItemState.Review };

  // ── 4. QA standing dept: a regression is caught; the fix keeps bouncing back ──
  const cases = deriveTestCasesFromBrd(
    { brdId: "brd-coupon", projectId: deps.projectId, initiativeId: deps.initiativeId, suiteId: "suite-coupon", authoredByHatId: "qa_verifier", acceptanceCriteria: ["coupon applies discount", "checkout succeeds with coupon"] },
    { organizationId: deps.organizationId, createId: deps.createId, nowIso: nextIso },
  );
  // one case had passed before → a failing run now is a regression
  const priorRuns: TestRun[] = [{ testRunId: deps.createId("run"), testCaseId: cases[1]!.testCaseId, suiteId: "suite-coupon", organizationId: deps.organizationId, initiativeBranch: deps.initiativeBranch, executorHatId: "browser_automation_qa", agentId: "agent-qa", mode: "browser_automation", outcome: TestRunOutcome.Passed, evidence: [], startedAt: iso(deps.baseTimeMs - 86_400_000), finishedAt: iso(deps.baseTimeMs - 86_400_000) }];
  const failPlan = new Map([[cases[0]!.testCaseId, TestRunOutcome.Failed], [cases[1]!.testCaseId, TestRunOutcome.Failed]]);

  let regressionsCaught = 0;
  let accumulatedRuns: TestRun[] = [...priorRuns];
  let testSummary: TestSummary = { runs: 0, failures: 0, regressionsOpen: 0, defectsOpenedInTestSetup: 0 };
  for (let round = 0; round < CHURN_TARGET; round += 1) {
    const qa = await runQaCycle({
      organizationId: deps.organizationId, initiativeBranch: deps.initiativeBranch,
      workItemIdByTestCase: new Map(cases.map((c) => [c.testCaseId, item.workItemId])),
      cases, priorRuns: accumulatedRuns, executor: createDeterministicExecutor(failPlan),
      qaHatId: "qa_verifier", qaAgentId: "agent-qa", createId: deps.createId, nowIso: nextIso, appendEvent: emit,
      openDefect: async () => ({ defectId: deps.createId("def") }),
    });
    regressionsCaught += qa.regressions.length;
    accumulatedRuns = [...accumulatedRuns, ...qa.runs];
    testSummary = qa.summary;
    // QA failed → bounce back to development (the churn signal)
    await simpleTransition(item.workItemId, WorkItemState.Review, WorkItemState.InProgress, "qa_verifier", `QA round ${round + 1} failed → rework (bounce-back)`);
    await simpleTransition(item.workItemId, WorkItemState.InProgress, WorkItemState.Review, "backend_implementer", "re-attempt fix; back to QA");
  }

  // ── 5. CHURN detected → escalation: bring on more agents + an architect re-approach ──
  const churn = detectChurn(item.workItemId, allEvents, CHURN_TARGET);
  const escalations: EscalationAction[] = [];
  let agentsAddedViaRmo = 0;
  let architectBroughtIn = false;
  if (churn) {
    await emit({ id: deps.createId("evt"), kind: OrgEventKind.ChurnDetected, occurredAt: nextIso(), organizationId: deps.organizationId, actorHatId: emanager.id, subjectId: item.workItemId, decision: `churn: ${bounceBackCount(item.workItemId, allEvents)} QA bounce-backs — escalating`, supervisorChain: [], evidenceRefs: [], correlationId: item.workItemId, causationId: item.workItemId, traceId: item.workItemId });

    const escCtx = { organizationId: deps.organizationId, createEventId: () => deps.createId("evt"), nowIso: nextIso, supervisorChain: ["ceo", emanager.id], correlationId: item.workItemId, causationId: item.workItemId, traceId: item.workItemId };

    // (a) add agents → RMO supply-expand
    const addAgents = decideEscalation({ trigger: EscalationTrigger.RepeatedQaBounceBack, workItemId: item.workItemId, ownerHatIds: owners, deciderHat: emanager, chooser: firstLegalChooser() }, escCtx);
    if (addAgents.outcome === "escalated") {
      escalations.push(addAgents.action);
      await emit(addAgents.event);
      if (addAgents.change.kind === "expand_supply") {
        for (const hatId of addAgents.change.ownerHatIds) {
          const votes: HatSupplyVote[] = ["engineering_director", "cfo", "cost_controller"].map((v) => ({ voterHatId: v, approve: true, proposedTarget: 2 }));
          const supply = decideHatSupply({ hatId, hatName: byId.get(hatId)?.name ?? hatId, requiredCount: 2, currentCount: 1, votes }, { ...escCtx, supervisorChain: ["ceo", "cfo"] });
          await emit(supply.event);
          agentsAddedViaRmo += Math.max(0, supply.decision.targetCount - 1);
        }
      }
    }

    // (b) bring in architect → change the approach (reopen architecture gate)
    const bringArchitect = decideEscalation({ trigger: EscalationTrigger.RepeatedQaBounceBack, workItemId: item.workItemId, ownerHatIds: owners, deciderHat: emanager, chooser: () => ({ index: 1, reason: "the approach is failing QA repeatedly; bring in an architect" }) }, escCtx);
    if (bringArchitect.outcome === "escalated" && bringArchitect.change.kind === "new_approach") {
      escalations.push(bringArchitect.action);
      architectBroughtIn = true;
      await emit(bringArchitect.event);
      await emit({ id: deps.createId("evt"), kind: OrgEventKind.HatAssignment, occurredAt: nextIso(), organizationId: deps.organizationId, actorHatId: emanager.id, subjectId: bringArchitect.change.architectHatId, decision: `architect assigned to re-approach ${item.workItemId}`, supervisorChain: ["ceo", emanager.id], evidenceRefs: [], correlationId: item.workItemId, causationId: item.workItemId, traceId: item.workItemId });
      await emit({ id: deps.createId("evt"), kind: OrgEventKind.QualityGateEvaluation, occurredAt: nextIso(), organizationId: deps.organizationId, actorHatId: "architect", subjectId: item.workItemId, fromState: bringArchitect.change.reopenGate, toState: "reopened", decision: `architecture gate reopened — new approach for ${item.workItemId}`, supervisorChain: ["ceo", "engineering_director", "architect"], evidenceRefs: [], correlationId: item.workItemId, causationId: item.workItemId, traceId: item.workItemId });
    }
  }

  // ── 6. New approach + more agents → re-test GREEN → released ──
  const greenQa = await runQaCycle({
    organizationId: deps.organizationId, initiativeBranch: deps.initiativeBranch,
    workItemIdByTestCase: new Map(cases.map((c) => [c.testCaseId, item.workItemId])),
    cases, priorRuns: accumulatedRuns, executor: createDeterministicExecutor(new Map()), // empty plan → all Passed
    qaHatId: "qa_verifier", qaAgentId: "agent-qa", createId: deps.createId, nowIso: nextIso, appendEvent: emit,
    openDefect: async () => ({ defectId: deps.createId("def") }),
  });
  testSummary = { runs: greenQa.summary.runs, failures: greenQa.summary.failures, regressionsOpen: greenQa.summary.regressionsOpen, defectsOpenedInTestSetup: testSummary.defectsOpenedInTestSetup };
  await simpleTransition(item.workItemId, WorkItemState.Review, WorkItemState.Done, "release_manager", "QA green after architect re-approach → released to main");
  item = { ...item, state: WorkItemState.Done };

  // ── 7. Metrics roll up to the executive scope (exec sees the whole org) ──
  const state: OrgWorkState = {
    hats: byId, batches: [batch],
    itemsByBatch: new Map([[batch.batchId, [item]]]),
    events: allEvents,
    testsByBatch: new Map([[batch.batchId, testSummary]]),
  };
  const ceo = byId.get("ceo") ?? deps.hats.find((h) => h.level === HatLevel.CSuite)!;
  const execReadout = observeForHat(ceo, state);

  return {
    intakeWorkItemId: item.workItemId,
    workItemType: item.workItemType,
    finalState: item.state,
    bounceBacks: bounceBackCount(item.workItemId, allEvents),
    churnDetected: churn,
    regressionsCaught,
    escalations,
    agentsAddedViaRmo,
    architectBroughtIn,
    totalEvents: allEvents.length,
    eventsByKind,
    execScopeRollup: execReadout.scopeRollup,
  };
}
