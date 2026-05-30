import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import type { DecisionRecord, DiscussionAnchor } from "../../domain/src/index.ts";
import {
  GraphEdgeKind,
  GraphNodeKind,
  decisionsForWorkItem,
  neighborsByEdge,
  projectOrganizationGraph,
} from "../src/graph-projection.ts";

function anchor(id: string, workItemId: string): DiscussionAnchor {
  return {
    discussionAnchorId: id,
    organizationId: "org",
    projectId: "proj",
    workItemId,
    discussionAnchorType: "work_item",
    title: "t",
    purpose: "p",
    expectedOutputs: [],
    createdAt: "2026-05-29T00:00:00.000Z",
    createdBy: { agentId: "a", hatAssignmentId: "h" },
    metadata: { updatedAt: "2026-05-29T00:00:00.000Z", version: 1, correlationId: "c", causationId: "z", traceId: "t" },
  } as DiscussionAnchor;
}

function decision(id: string, anchorId: string, workItemId: string, followUps: string[] = []): DecisionRecord {
  return {
    decisionRecordId: id,
    organizationId: "org",
    projectId: "proj",
    workItemId,
    discussionAnchorId: anchorId,
    title: "t",
    decision: "do it",
    rationale: "because",
    alternativesConsidered: [],
    followUpWorkItemIds: followUps,
    decidedAt: "2026-05-29T00:00:00.000Z",
    decidedBy: { agentId: "a", hatAssignmentId: "h" },
    metadata: { updatedAt: "2026-05-29T00:00:00.000Z", version: 1, correlationId: "c", causationId: "z", traceId: "t" },
  } as DecisionRecord;
}

test("projects nodes and the three edge kinds", () => {
  const graph = projectOrganizationGraph({
    workItemIds: ["w1"],
    discussionAnchors: [anchor("a1", "w1")],
    decisions: [decision("d1", "a1", "w1", ["w2"])],
  });
  // nodes: w1, a1, d1, w2
  equal(graph.nodes.length, 4);
  equal(graph.nodes.some((n) => n.kind === GraphNodeKind.Decision && n.id === "d1"), true);
  // edges: anchored_to (a1->w1), decided_in (d1->a1), follows_up (d1->w2)
  equal(graph.edges.filter((e) => e.kind === GraphEdgeKind.AnchoredTo).length, 1);
  equal(graph.edges.filter((e) => e.kind === GraphEdgeKind.DecidedIn).length, 1);
  equal(graph.edges.filter((e) => e.kind === GraphEdgeKind.FollowsUp).length, 1);
});

test("nodes are deduped by (kind,id)", () => {
  const graph = projectOrganizationGraph({
    workItemIds: ["w1"],
    discussionAnchors: [anchor("a1", "w1"), anchor("a2", "w1")],
    decisions: [],
  });
  // w1 appears once despite two anchors pointing at it
  equal(graph.nodes.filter((n) => n.kind === GraphNodeKind.WorkItem && n.id === "w1").length, 1);
});

test("decisionsForWorkItem walks anchor then decision edges (the North Star query)", () => {
  const graph = projectOrganizationGraph({
    workItemIds: ["w1"],
    discussionAnchors: [anchor("a1", "w1"), anchor("a2", "w1")],
    decisions: [decision("d1", "a1", "w1"), decision("d2", "a2", "w1"), decision("d3", "a1", "w1")],
  });
  const decisions = [...decisionsForWorkItem(graph, "w1")].sort();
  deepEqual(decisions, ["d1", "d2", "d3"]);
});

test("decisionsForWorkItem returns empty for an unrelated work item", () => {
  const graph = projectOrganizationGraph({
    workItemIds: ["w1", "w9"],
    discussionAnchors: [anchor("a1", "w1")],
    decisions: [decision("d1", "a1", "w1")],
  });
  deepEqual(decisionsForWorkItem(graph, "w9"), []);
});

test("neighborsByEdge returns follow-up work items of a decision", () => {
  const graph = projectOrganizationGraph({
    workItemIds: ["w1"],
    discussionAnchors: [anchor("a1", "w1")],
    decisions: [decision("d1", "a1", "w1", ["w2", "w3"])],
  });
  deepEqual([...neighborsByEdge(graph, "d1", GraphEdgeKind.FollowsUp)].sort(), ["w2", "w3"]);
});
