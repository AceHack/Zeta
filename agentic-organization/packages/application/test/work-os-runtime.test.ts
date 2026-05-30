import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { OrgEventKind, WorkItemState, WorkItemType, type OrgEvent } from "../../domain/src/index.ts";
import { buildHatDefinitions, runWorkOsCycle, EscalationAction } from "../src/index.ts";

function run() {
  const events: OrgEvent[] = [];
  let n = 0;
  return {
    events,
    promise: runWorkOsCycle({
      organizationId: "org-lfg", projectId: "proj-checkout", initiativeId: "init-coupon", initiativeBranch: "feat/coupon",
      hats: buildHatDefinitions(), baseTimeMs: Date.parse("2026-05-30T10:00:00.000Z"),
      createId: (p: string) => `${p}-${++n}`, appendEvent: async (e: OrgEvent) => void events.push(e),
    }),
  };
}

test("the living loop runs end-to-end: intake → QA regression → churn → escalation → released", async () => {
  const { promise } = run();
  const report = await promise;

  // an external customer DEFECT was ingested and driven to release
  equal(report.workItemType, WorkItemType.Defect);
  equal(report.finalState, WorkItemState.Done); // released

  // QA caught a regression and the fix bounced back until churn fired
  ok(report.regressionsCaught >= 1, "a regression should be caught");
  equal(report.bounceBacks, 3);
  equal(report.churnDetected, true);

  // escalation pulled in MORE AGENTS (RMO expand) AND an ARCHITECT re-approach
  ok(report.escalations.includes(EscalationAction.AddAgents));
  ok(report.escalations.includes(EscalationAction.BringInArchitect));
  ok(report.agentsAddedViaRmo >= 1, "RMO should have expanded supply");
  equal(report.architectBroughtIn, true);
});

test("every living-loop transition is traced (the loop is crystal-clear)", async () => {
  const { promise } = run();
  const report = await promise;
  const k = report.eventsByKind;
  for (const required of [
    OrgEventKind.IntakeReceived,
    OrgEventKind.WorkItemTransition,
    OrgEventKind.WorkBatchTransition,
    OrgEventKind.TestRunRecorded,
    OrgEventKind.RegressionDetected,
    OrgEventKind.DefectOpened,
    OrgEventKind.ChurnDetected,
    OrgEventKind.EscalationDecision,
    OrgEventKind.HatSupplyDecision,
    OrgEventKind.QualityGateEvaluation,
  ]) {
    ok((k[required] ?? 0) >= 1, `missing trace for ${required}`);
  }
  ok(report.totalEvents >= 25);
});

test("the executive scope sees the rolled-up metrics", async () => {
  const { promise } = run();
  const report = await promise;
  equal(report.execScopeRollup.batchCount, 1);
  equal(report.execScopeRollup.total, 1);
  ok(report.execScopeRollup.qaBounceBacks >= 3); // the churn is visible at exec scope
});
