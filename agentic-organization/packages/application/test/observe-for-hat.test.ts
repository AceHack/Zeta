import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  HatLevel,
  OrgEventKind,
  WorkItemState,
  WorkItemType,
  WorkItemSource,
  WorkBatchState,
  type HatDefinition,
  type OrgEvent,
  type WorkBatch,
  type WorkItem,
} from "../../domain/src/index.ts";
import { buildHatDefinitions } from "../src/org-seed.ts";
import { rollUpBatchMetrics, aggregateMetrics } from "../../observability/src/index.ts";
import { observeForHat, authorityScopeOf, AuthorityScope, type OrgWorkState } from "../src/observe-for-hat.ts";

function wi(id: string, type: WorkItemType, state: WorkItemState, batchId: string): WorkItem {
  return {
    workItemId: id, organizationId: "org-lfg", workItemType: type, state, title: id, description: "d",
    projectId: "proj-1", initiativeId: "init-1", batchId, source: WorkItemSource.Internal,
    createdAt: "2026-05-30T00:00:00.000Z", createdBy: { agentId: "a", hatAssignmentId: "ha" },
  };
}
function batch(id: string, ownerHatId: string): WorkBatch {
  return {
    batchId: id, organizationId: "org-lfg", scopeKind: "initiative", scopeId: "init-1",
    ownerHatId, state: WorkBatchState.Active, capacityPlannedHats: 2,
    createdAt: "2026-05-30T00:00:00.000Z", updatedAt: "2026-05-30T00:00:00.000Z",
  };
}
function bounceBack(itemId: string): OrgEvent {
  return {
    id: `evt-${itemId}`, kind: OrgEventKind.WorkItemTransition, occurredAt: "2026-05-30T01:00:00.000Z",
    organizationId: "org-lfg", subjectId: itemId, fromState: WorkItemState.Review, toState: WorkItemState.InProgress,
    decision: "QA failed; rework", supervisorChain: [], evidenceRefs: [], correlationId: "c", causationId: "c", traceId: "t",
  };
}

test("batch metrics: completion %, open defects, and QA bounce-backs fold from items + events", () => {
  const items = [
    wi("a", WorkItemType.Task, WorkItemState.Done, "b1"),
    wi("c", WorkItemType.Task, WorkItemState.InProgress, "b1"),
    wi("d", WorkItemType.Defect, WorkItemState.Review, "b1"),
    wi("e", WorkItemType.Task, WorkItemState.Blocked, "b1"),
  ];
  const events = [bounceBack("d"), bounceBack("d")]; // the defect bounced twice
  const m = rollUpBatchMetrics({ batchId: "b1", items, events });
  equal(m.total, 4);
  equal(m.done, 1);
  equal(m.completionPct, 0.25);
  equal(m.blocked, 1);
  equal(m.inReview, 1);
  equal(m.openDefects, 1);
  equal(m.qaBounceBacks, 2);
  equal(m.movementScore, 0.75); // 1 - blocked/total
});

test("the QA gate term: passRate is neutral with no runs, drops with failures", () => {
  const base = { batchId: "b1", items: [wi("a", WorkItemType.Task, WorkItemState.Done, "b1")], events: [] };
  equal(rollUpBatchMetrics(base).passRate, 1);
  equal(rollUpBatchMetrics({ ...base, tests: { runs: 4, failures: 1, regressionsOpen: 1, defectsOpenedInTestSetup: 2 } }).passRate, 0.75);
});

test("aggregateMetrics rolls batch metrics up to a scope-level view (department/org)", () => {
  const m1 = rollUpBatchMetrics({ batchId: "b1", items: [wi("a", WorkItemType.Task, WorkItemState.Done, "b1")], events: [] });
  const m2 = rollUpBatchMetrics({ batchId: "b2", items: [wi("b", WorkItemType.Task, WorkItemState.Blocked, "b2")], events: [] });
  const scope = aggregateMetrics([m1, m2]);
  equal(scope.batchCount, 2);
  equal(scope.total, 2);
  equal(scope.done, 1);
  equal(scope.completionPct, 0.5);
  equal(scope.blocked, 1);
});

test("observeForHat is DIFFERENT per authority scope: exec sees all, IC sees only its own", () => {
  const hats = buildHatDefinitions();
  const byId = new Map<string, HatDefinition>(hats.map((h) => [h.id, h]));
  const lead = hats.find((h) => h.level === HatLevel.Lead)!;
  const ic = hats.find((h) => h.level === HatLevel.IndividualContributor)!;
  const ceo = byId.get("ceo")!;

  const batches = [batch("b-lead", lead.id), batch("b-other", "release_manager")];
  const itemsByBatch = new Map<string, readonly WorkItem[]>([
    ["b-lead", [wi("a", WorkItemType.Task, WorkItemState.Done, "b-lead")]],
    ["b-other", [wi("b", WorkItemType.Task, WorkItemState.InProgress, "b-other")]],
  ]);
  const state: OrgWorkState = { hats: byId, batches, itemsByBatch, events: [] };

  // exec: organization scope → sees ALL batches
  const ceoView = observeForHat(ceo, state);
  equal(ceoView.authorityScope, AuthorityScope.Organization);
  equal(ceoView.batches.length, 2);
  equal(ceoView.scopeRollup.total, 2); // org-wide rollup

  // the lead: team scope → sees its own batch (self in subtree)
  const leadView = observeForHat(lead, state);
  equal(leadView.authorityScope, AuthorityScope.Team);
  ok(leadView.batches.some((b) => b.batch.batchId === "b-lead"));
  ok(!leadView.batches.some((b) => b.batch.batchId === "b-other"));

  // an IC: individual scope → sees only batches it owns (none here)
  const icView = observeForHat(ic, state);
  equal(icView.authorityScope, AuthorityScope.Individual);
  equal(icView.batches.length, 0);
});

test("legal priority classes are clamped by level (IC strictly fewer than exec)", () => {
  const hats = buildHatDefinitions();
  const byId = new Map(hats.map((h) => [h.id, h]));
  const state: OrgWorkState = { hats: byId, batches: [], itemsByBatch: new Map(), events: [] };
  const ceo = observeForHat(byId.get("ceo")!, state);
  const ic = observeForHat(hats.find((h) => h.level === HatLevel.IndividualContributor)!, state);
  ok(ceo.legalPriorityClasses.length > ic.legalPriorityClasses.length);
});

test("authorityScopeOf maps every level", () => {
  equal(authorityScopeOf(HatLevel.ExecutiveBoard), AuthorityScope.Organization);
  equal(authorityScopeOf(HatLevel.Director), AuthorityScope.Department);
  equal(authorityScopeOf(HatLevel.Lead), AuthorityScope.Team);
  equal(authorityScopeOf(HatLevel.IndividualContributor), AuthorityScope.Individual);
});
