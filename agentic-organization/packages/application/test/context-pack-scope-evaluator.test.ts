import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import {
  DocScopeKind,
  GraphNodeKind,
  graphNodeId,
} from "../../domain/src/index.ts";
import {
  asZetaIdDecimal,
  buildHatDefinitions,
  ContextPackCurationStageKind,
  ContextPackFreshness,
  ContextPackItemKind,
  ContextPackOmissionReason,
  ContextPackSourcePointerKind,
  activeGraphRootNodeIdsForSnapshot,
  contextPackMatchesSnapshot,
  contextPackWithItemProvenanceOmissions,
  RunLifecyclePhase,
  RunScope,
  type AgentObserveSnapshot,
  type ContextPack,
  type ContextPackItem,
  type HierarchyReadout,
} from "../src/index.ts";

const observedAt = "2026-06-02T12:00:00.000Z";

test("contextPackMatchesSnapshot rejects packs outside the active hat and work scope", () => {
  const snapshot = agentSnapshot();
  equal(contextPackMatchesSnapshot(pack(snapshot), snapshot), true);
  equal(contextPackMatchesSnapshot(pack(snapshot, { projectId: "project-other" }), snapshot), false);
  equal(contextPackMatchesSnapshot(pack(snapshot, { hatId: "cto" }), snapshot), false);
});

test("contextPackWithItemProvenanceOmissions flags wrong-scope document pointers", () => {
  const snapshot = agentSnapshot();
  const evaluated = contextPackWithItemProvenanceOmissions(
    pack(snapshot, {
      items: [item({
        id: "doc:foreign-brd",
        sourcePointers: [{
          kind: ContextPackSourcePointerKind.DocUnit,
          docUnitId: "foreign-brd",
          organizationId: "org-lfg",
          scopeKind: DocScopeKind.Project,
          scopeId: "project-other",
          contentRef: "doc:foreign-brd",
          contentHash: "hash-foreign-brd",
          sourceId: "main",
          version: 1,
        }],
      })],
    }),
    snapshot,
    hierarchy(),
  );

  equal(evaluated.omittedItemsWithReason[0]?.reason, ContextPackOmissionReason.OutOfScope);
  equal(evaluated.items.some((candidate) => candidate.id === "doc:foreign-brd"), false);
  ok(evaluated.lifecycleBlockers.some((blocker) => blocker.includes("item provenance is outside active scope")));
});

test("contextPackWithItemProvenanceOmissions allows graph edges grounded through active traversal roots", () => {
  const snapshot = agentSnapshot();
  const activeProjectNodeId = graphNodeId("org-lfg", GraphNodeKind.Project, "project-billing");
  const foreignNodeId = graphNodeId("org-lfg", GraphNodeKind.Project, "project-other");
  const evaluated = contextPackWithItemProvenanceOmissions(
    pack(snapshot, {
      items: [item({
        id: "graph:edge",
        kind: ContextPackItemKind.GraphNeighborhood,
        citationRefs: [`graph:${activeProjectNodeId}`],
        sourcePointers: [
          { kind: ContextPackSourcePointerKind.GraphNode, nodeId: activeProjectNodeId },
          {
            kind: ContextPackSourcePointerKind.GraphEdge,
            edgeId: "active-to-foreign",
            fromNodeId: activeProjectNodeId,
            toNodeId: foreignNodeId,
          },
        ],
      })],
    }),
    snapshot,
    hierarchy(),
  );

  equal(evaluated.omittedItemsWithReason.length, 0);
});

test("contextPackWithItemProvenanceOmissions keeps meeting provenance scoped by schedule assignment", () => {
  const snapshot = agentSnapshot();
  const evaluated = contextPackWithItemProvenanceOmissions(
    pack(snapshot, {
      items: [item({
        id: "meeting:billing-review",
        kind: ContextPackItemKind.Meeting,
        sourcePointers: [
          {
            kind: ContextPackSourcePointerKind.Meeting,
            meetingId: "schedule:schedule-billing-review",
            workScheduleBlockId: "schedule-billing-review",
            discussionAnchorId: "discussion-billing-review",
          },
          {
            kind: ContextPackSourcePointerKind.ScheduleBlock,
            workScheduleBlockId: "schedule-billing-review",
            assignedHatAssignmentId: snapshot.hatAssignmentId,
            assignedAgentId: snapshot.agentId,
          },
          { kind: ContextPackSourcePointerKind.WorkItem, workItemId: "work-billing-blocker" },
        ],
      })],
    }),
    snapshot,
    hierarchy(),
  );

  equal(evaluated.omittedItemsWithReason.length, 0);
});

test("contextPackWithItemProvenanceOmissions rejects meeting provenance without a scoped replay anchor", () => {
  const snapshot = agentSnapshot();
  const evaluated = contextPackWithItemProvenanceOmissions(
    pack(snapshot, {
      items: [item({
        id: "meeting:unscoped-review",
        kind: ContextPackItemKind.Meeting,
        sourcePointers: [{
          kind: ContextPackSourcePointerKind.Meeting,
          meetingId: "schedule:schedule-unscoped-review",
          workScheduleBlockId: "schedule-unscoped-review",
        }],
      })],
    }),
    snapshot,
    hierarchy(),
  );

  equal(evaluated.items.some((candidate) => candidate.id === "meeting:unscoped-review"), false);
  equal(evaluated.omittedItemsWithReason[0]?.reason, ContextPackOmissionReason.OutOfScope);
});

test("activeGraphRootNodeIdsForSnapshot exposes canonical and raw graph roots for builder grounding", () => {
  const snapshot = agentSnapshot();
  const roots = activeGraphRootNodeIdsForSnapshot(snapshot, hierarchy());

  ok(roots.has(graphNodeId("org-lfg", GraphNodeKind.Project, "project-billing")));
  ok(roots.has(graphNodeId("org-lfg", GraphNodeKind.WorkItem, "work-billing-blocker")));
  ok(roots.has(graphNodeId("org-lfg", GraphNodeKind.Initiative, "initiative-billing")));
  ok(roots.has("project-billing"));
  ok(roots.has("work-billing-blocker"));
  ok(roots.has("initiative-billing"));
});

function agentSnapshot(overrides: Partial<AgentObserveSnapshot> = {}): AgentObserveSnapshot {
  const hat = buildHatDefinitions().find((candidate) => candidate.id === "engineering_director")!;
  return {
    runId: asZetaIdDecimal("42"),
    scope: RunScope.WorkItem,
    phase: RunLifecyclePhase.Observing,
    trace: { correlationId: "corr", causationId: "cause", traceId: "trace" },
    hasGateApproval: false,
    hasEvidence: false,
    hatAssignmentId: asZetaIdDecimal("99"),
    hat,
    agentId: "agent-addison",
    organizationId: "org-lfg",
    projectId: "project-billing",
    teamId: "team-platform",
    workItemId: "work-billing-blocker",
    ...overrides,
  };
}

function hierarchy(): HierarchyReadout {
  return {
    level: agentSnapshot().hat.level,
    projects: [{
      projectId: "project-billing",
      organizationId: "org-lfg",
      departmentId: "engineering",
      name: "Billing",
      status: "active",
      trajectory: [],
      metrics: [],
    }],
    initiatives: [{
      initiativeId: "initiative-billing",
      projectId: "project-billing",
      organizationId: "org-lfg",
      title: "Billing recovery",
      status: "active",
      metrics: [],
    }],
    metrics: [],
    policyViolations: [],
    priorityScope: "current_work_item",
    priorityItems: [{
      itemId: "work-billing-blocker",
      kind: "work_item",
      label: "Fix billing blocker",
      scope: RunScope.WorkItem,
      metrics: [],
      rationale: "active blocker",
    }],
    scopedMetrics: [],
    actions: [],
    vetoedActions: [],
  };
}

function pack(snapshot: AgentObserveSnapshot, overrides: Partial<ContextPack> = {}): ContextPack {
  return {
    id: "ctx-test",
    runId: snapshot.runId,
    scope: snapshot.scope,
    hatAssignmentId: snapshot.hatAssignmentId,
    hatId: snapshot.hat.id,
    generatedAt: observedAt,
    freshnessDeadline: "2026-06-02T13:00:00.000Z",
    sourceGraphVersion: "graph:v1",
    policyVersion: "policy:v1",
    tokenBudget: 2048,
    items: [item()],
    omittedItemsWithReason: [],
    contradictions: [],
    staleInputs: [],
    lifecycleBlockers: [],
    curationTrace: [
      { stage: ContextPackCurationStageKind.DeterministicScope, summary: "scope", evidenceRefs: [] },
      { stage: ContextPackCurationStageKind.RequiredConsult, summary: "consult", evidenceRefs: [] },
      { stage: ContextPackCurationStageKind.GapReview, summary: "gap", evidenceRefs: [] },
    ],
    agentId: snapshot.agentId,
    organizationId: snapshot.organizationId,
    projectId: snapshot.projectId,
    teamId: snapshot.teamId,
    workItemId: snapshot.workItemId,
    ...overrides,
  };
}

function item(overrides: Partial<ContextPackItem> = {}): ContextPackItem {
  return {
    id: "work:billing-blocker",
    kind: ContextPackItemKind.WorkItem,
    title: "Billing blocker",
    summary: "The active work item.",
    sourceRef: "work:billing-blocker",
    required: true,
    freshness: ContextPackFreshness.Current,
    confidence: 1,
    reasons: ["active-work"],
    sourcePointers: [{ kind: ContextPackSourcePointerKind.WorkItem, workItemId: "work-billing-blocker" }],
    ...overrides,
  };
}
