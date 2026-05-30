/**
 * Agent-native knowledge graph projection v0 (North Star priority #5).
 *
 * Projects the durable Organization records (work items, discussion anchors,
 * decisions) into a typed node/edge graph so agents can retrieve scoped context
 * by traversal instead of scanning chat. Every node kind and edge kind is an
 * explicit DU (repo rule: IMPLICIT-NOT-EXPLICIT is class error). The edge model
 * mirrors frontmatter-db's fk-as-edge traversal (packages/frontmatter-db/src/
 * traverse.ts) at the Organization-record scope — fk columns on a record become
 * directed edges between nodes.
 *
 * V0 answers the canonical North Star retrieval question: "all decisions for this
 * work item." It is pure over the records handed in; persistence/CDC wiring is a
 * later slice.
 */

import type { DecisionRecord, DiscussionAnchor } from "../../domain/src/index.ts";

export const GraphNodeKind = {
  WorkItem: "work_item",
  DiscussionAnchor: "discussion_anchor",
  Decision: "decision",
} as const;
export type GraphNodeKind = (typeof GraphNodeKind)[keyof typeof GraphNodeKind];

export const GraphEdgeKind = {
  /** discussion anchor -> the work item it is anchored to */
  AnchoredTo: "anchored_to",
  /** decision -> the discussion anchor it was decided in */
  DecidedIn: "decided_in",
  /** decision -> a work item it spawns as follow-up */
  FollowsUp: "follows_up",
} as const;
export type GraphEdgeKind = (typeof GraphEdgeKind)[keyof typeof GraphEdgeKind];

export type GraphNode = { kind: GraphNodeKind; id: string };
export type GraphEdge = { kind: GraphEdgeKind; fromId: string; toId: string };

export type OrganizationGraph = {
  nodes: readonly GraphNode[];
  edges: readonly GraphEdge[];
};

export type ProjectGraphInput = {
  workItemIds: readonly string[];
  discussionAnchors: readonly DiscussionAnchor[];
  decisions: readonly DecisionRecord[];
};

/**
 * Project records into a node/edge graph. Nodes are deduped by (kind,id); edges
 * are derived from the fk fields on each record:
 *   - DiscussionAnchor.workItemId      -> AnchoredTo edge (anchor -> work item)
 *   - DecisionRecord.discussionAnchorId -> DecidedIn edge (decision -> anchor)
 *   - DecisionRecord.followUpWorkItemIds[] -> FollowsUp edges (decision -> work item)
 */
export function projectOrganizationGraph(input: ProjectGraphInput): OrganizationGraph {
  const nodeKeys = new Set<string>();
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  const addNode = (kind: GraphNodeKind, id: string): void => {
    const key = `${kind}:${id}`;
    if (!nodeKeys.has(key)) {
      nodeKeys.add(key);
      nodes.push({ kind, id });
    }
  };

  for (const workItemId of input.workItemIds) {
    addNode(GraphNodeKind.WorkItem, workItemId);
  }

  for (const anchor of input.discussionAnchors) {
    addNode(GraphNodeKind.DiscussionAnchor, anchor.discussionAnchorId);
    addNode(GraphNodeKind.WorkItem, anchor.workItemId);
    edges.push({ kind: GraphEdgeKind.AnchoredTo, fromId: anchor.discussionAnchorId, toId: anchor.workItemId });
  }

  for (const decision of input.decisions) {
    addNode(GraphNodeKind.Decision, decision.decisionRecordId);
    addNode(GraphNodeKind.DiscussionAnchor, decision.discussionAnchorId);
    edges.push({ kind: GraphEdgeKind.DecidedIn, fromId: decision.decisionRecordId, toId: decision.discussionAnchorId });
    for (const followUpId of decision.followUpWorkItemIds) {
      addNode(GraphNodeKind.WorkItem, followUpId);
      edges.push({ kind: GraphEdgeKind.FollowsUp, fromId: decision.decisionRecordId, toId: followUpId });
    }
  }

  return { nodes, edges };
}

/**
 * The canonical North Star retrieval: all decisions anchored to a given work
 * item. Walks AnchoredTo (work item <- anchors) then DecidedIn (anchor <-
 * decisions). Pure graph traversal; returns the decision node ids.
 */
export function decisionsForWorkItem(graph: OrganizationGraph, workItemId: string): readonly string[] {
  const anchorIds = new Set(
    graph.edges
      .filter((edge) => edge.kind === GraphEdgeKind.AnchoredTo && edge.toId === workItemId)
      .map((edge) => edge.fromId),
  );

  const decisionIds: string[] = [];
  for (const edge of graph.edges) {
    if (edge.kind === GraphEdgeKind.DecidedIn && anchorIds.has(edge.toId)) {
      decisionIds.push(edge.fromId);
    }
  }
  return decisionIds;
}

/** Outgoing neighbors of a node by edge kind (generic traversal helper). */
export function neighborsByEdge(graph: OrganizationGraph, fromId: string, kind: GraphEdgeKind): readonly string[] {
  return graph.edges.filter((edge) => edge.kind === kind && edge.fromId === fromId).map((edge) => edge.toId);
}
