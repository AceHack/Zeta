import {
  DocScopeKind,
  GraphNodeKind,
  graphNodeId,
} from "../../domain/src/index.ts";
import {
  type AgentObserveSnapshot,
  type HierarchyReadout,
} from "./observe.ts";
import { RunScope } from "./run-scope.ts";
import {
  ContextPackOmissionReason,
  ContextPackSourcePointerKind,
  type ContextPack,
  type ContextPackItem,
  type ContextPackOmittedItem,
  type ContextPackSourcePointer,
} from "./context-pack-contracts.ts";

export const CONTEXT_PACK_ITEM_PROVENANCE_OUT_OF_SCOPE_MESSAGE =
  "context pack item provenance is outside active scope";

export function contextPackWithItemProvenanceOmissions(
  pack: ContextPack,
  snapshot: AgentObserveSnapshot,
  hierarchy: HierarchyReadout,
): ContextPack {
  const provenanceOmissions = contextPackItemProvenanceOmissions(pack, snapshot, hierarchy);
  if (provenanceOmissions.length === 0) return pack;
  const omittedItemIds = new Set(provenanceOmissions.flatMap((omission) =>
    omission.nodeId === undefined ? [] : [omission.nodeId]
  ));
  const omissionMessages = provenanceOmissions.map((omission) => omission.message);
  return {
    ...pack,
    items: pack.items.filter((item) => !omittedItemIds.has(item.id)),
    omittedItemsWithReason: [...pack.omittedItemsWithReason, ...provenanceOmissions],
    lifecycleBlockers: uniqueStrings([...pack.lifecycleBlockers, ...omissionMessages]),
  };
}

export function contextPackItemProvenanceOmissions(
  pack: ContextPack,
  snapshot: AgentObserveSnapshot,
  hierarchy: HierarchyReadout,
): readonly ContextPackOmittedItem[] {
  return pack.items.flatMap((item) =>
    contextPackItemHasOutsideActiveScopePointer(item, snapshot, hierarchy)
      ? [{
          nodeId: item.id,
          reason: ContextPackOmissionReason.OutOfScope,
          message: `${CONTEXT_PACK_ITEM_PROVENANCE_OUT_OF_SCOPE_MESSAGE}: ${item.id}`,
        }]
      : []
  );
}

export function contextPackItemHasOutsideActiveScopePointer(
  item: ContextPackItem,
  snapshot: AgentObserveSnapshot,
  hierarchy: HierarchyReadout,
): boolean {
  return (item.sourcePointers ?? []).some((pointer) =>
    contextPackSourcePointerIsOutsideActiveScope(pointer, item, snapshot, hierarchy)
  );
}

export function contextPackSourcePointerIsOutsideActiveScope(
  pointer: ContextPackSourcePointer,
  item: ContextPackItem,
  snapshot: AgentObserveSnapshot,
  hierarchy: HierarchyReadout,
): boolean {
  switch (pointer.kind) {
    case ContextPackSourcePointerKind.DocUnit:
      return !docUnitSourcePointerMatchesActiveScope(pointer, snapshot, hierarchy);
    case ContextPackSourcePointerKind.GraphNode:
      return !graphNodeSourcePointerMatchesActiveScope(pointer, item, snapshot, hierarchy);
    case ContextPackSourcePointerKind.GraphEdge:
      return !graphEdgeSourcePointerMatchesActiveScope(pointer, item, snapshot, hierarchy);
    case ContextPackSourcePointerKind.HindsightMemory:
      return !hindsightMemorySourcePointerMatchesActiveScope(pointer, snapshot);
    case ContextPackSourcePointerKind.WorkItem:
      return !workItemSourcePointerMatchesActiveScope(pointer, snapshot, hierarchy);
    case ContextPackSourcePointerKind.InboxAnchor:
      return !inboxAnchorSourcePointerMatchesActiveScope(pointer, snapshot);
    case ContextPackSourcePointerKind.ScheduleBlock:
      return !scheduleBlockSourcePointerMatchesActiveScope(pointer, snapshot);
    case ContextPackSourcePointerKind.SupervisorSignal:
      return !supervisorSignalSourcePointerMatchesActiveScope(pointer, snapshot);
    case ContextPackSourcePointerKind.GitBlob:
    case ContextPackSourcePointerKind.Decision:
    case ContextPackSourcePointerKind.Discussion:
    case ContextPackSourcePointerKind.Meeting:
    case ContextPackSourcePointerKind.QualityGate:
    case ContextPackSourcePointerKind.Trace:
    case ContextPackSourcePointerKind.Metric:
    case ContextPackSourcePointerKind.Log:
    case ContextPackSourcePointerKind.Policy:
      return !contextPackItemHasScopedReplayAnchor(item, snapshot, hierarchy);
    default:
      return true;
  }
}

export function docUnitSourcePointerMatchesActiveScope(
  pointer: Extract<ContextPackSourcePointer, { kind: typeof ContextPackSourcePointerKind.DocUnit }>,
  snapshot: AgentObserveSnapshot,
  hierarchy: HierarchyReadout,
): boolean {
  if (pointer.organizationId !== undefined && !optionalContextPackValueMatches(pointer.organizationId, snapshot.organizationId)) {
    return false;
  }
  if (pointer.scopeKind === undefined || pointer.scopeId === undefined) return false;
  switch (pointer.scopeKind) {
    case DocScopeKind.Organization:
      return pointer.scopeId === snapshot.organizationId;
    case DocScopeKind.Department:
      return activeDepartmentIdsForSnapshot(snapshot, hierarchy).includes(pointer.scopeId);
    case DocScopeKind.Project:
      return pointer.scopeId === snapshot.projectId;
    case DocScopeKind.Team:
      return pointer.scopeId === snapshot.teamId;
    case DocScopeKind.Service:
      return false;
  }
}

export function activeDepartmentIdsForSnapshot(
  snapshot: AgentObserveSnapshot,
  hierarchy: HierarchyReadout,
): readonly string[] {
  return uniqueStrings(
    [
      snapshot.hat.departmentId,
      ...snapshot.hat.documentationScopes,
      ...hierarchy.projects
        .filter((project) => project.projectId === snapshot.projectId)
        .map((project) => project.departmentId),
    ],
  );
}

export function graphNodeSourcePointerMatchesActiveScope(
  pointer: Extract<ContextPackSourcePointer, { kind: typeof ContextPackSourcePointerKind.GraphNode }>,
  item: ContextPackItem,
  snapshot: AgentObserveSnapshot,
  hierarchy: HierarchyReadout,
): boolean {
  return (
    activeGraphNodeIdsForSnapshot(snapshot, hierarchy).has(pointer.nodeId) ||
    activeRawGraphNodeIdsForSnapshot(snapshot, hierarchy).has(pointer.nodeId) && contextPackItemHasActiveRawGraphCitation(item, snapshot, hierarchy) ||
    contextPackItemHasActiveDocCitation(item, snapshot, hierarchy) ||
    contextPackItemHasActiveWorkItemPointer(item, snapshot, hierarchy)
  );
}

export function graphEdgeSourcePointerMatchesActiveScope(
  pointer: Extract<ContextPackSourcePointer, { kind: typeof ContextPackSourcePointerKind.GraphEdge }>,
  item: ContextPackItem,
  snapshot: AgentObserveSnapshot,
  hierarchy: HierarchyReadout,
): boolean {
  const activeCanonicalNodeIds = activeGraphNodeIdsForSnapshot(snapshot, hierarchy);
  const activeRawNodeIds = activeRawGraphNodeIdsForSnapshot(snapshot, hierarchy);
  const canonicalFromActive = activeCanonicalNodeIds.has(pointer.fromNodeId);
  const canonicalToActive = activeCanonicalNodeIds.has(pointer.toNodeId);
  const rawFromActive = activeRawNodeIds.has(pointer.fromNodeId) && contextPackItemHasActiveRawGraphCitation(item, snapshot, hierarchy);
  const rawToActive = activeRawNodeIds.has(pointer.toNodeId) && contextPackItemHasActiveRawGraphCitation(item, snapshot, hierarchy);
  return (
    (canonicalFromActive && canonicalToActive) ||
    (rawFromActive && rawToActive) ||
    contextPackItemHasActiveGraphTraversalRoot(item, pointer, snapshot, hierarchy)
  );
}

export function contextPackItemHasActiveGraphTraversalRoot(
  item: ContextPackItem,
  edge: Extract<ContextPackSourcePointer, { kind: typeof ContextPackSourcePointerKind.GraphEdge }>,
  snapshot: AgentObserveSnapshot,
  hierarchy: HierarchyReadout,
): boolean {
  return (item.sourcePointers ?? []).some((pointer) =>
    pointer.kind === ContextPackSourcePointerKind.GraphNode &&
    (pointer.nodeId === edge.fromNodeId || pointer.nodeId === edge.toNodeId) &&
    graphNodeSourcePointerMatchesActiveScope(pointer, item, snapshot, hierarchy)
  );
}

export function contextPackItemHasActiveDocCitation(
  item: ContextPackItem,
  snapshot: AgentObserveSnapshot,
  hierarchy: HierarchyReadout,
): boolean {
  return (item.sourcePointers ?? []).some((pointer) =>
    pointer.kind === ContextPackSourcePointerKind.DocUnit &&
    docUnitSourcePointerMatchesActiveScope(pointer, snapshot, hierarchy)
  );
}

export function contextPackItemHasActiveWorkItemPointer(
  item: ContextPackItem,
  snapshot: AgentObserveSnapshot,
  hierarchy: HierarchyReadout,
): boolean {
  return (item.sourcePointers ?? []).some((pointer) =>
    pointer.kind === ContextPackSourcePointerKind.WorkItem &&
    workItemSourcePointerMatchesActiveScope(pointer, snapshot, hierarchy)
  );
}

export function contextPackItemHasActiveRawGraphCitation(
  item: ContextPackItem,
  snapshot: AgentObserveSnapshot,
  hierarchy: HierarchyReadout,
): boolean {
  const activeRefs = activeGraphCitationRefsForSnapshot(snapshot, hierarchy);
  return (item.citationRefs ?? []).some((ref) => activeRefs.has(ref));
}

export function contextPackItemHasScopedReplayAnchor(
  item: ContextPackItem,
  snapshot: AgentObserveSnapshot,
  hierarchy: HierarchyReadout,
): boolean {
  return (item.sourcePointers ?? []).some((pointer) => {
    switch (pointer.kind) {
      case ContextPackSourcePointerKind.DocUnit:
        return docUnitSourcePointerMatchesActiveScope(pointer, snapshot, hierarchy);
      case ContextPackSourcePointerKind.GraphNode:
        return graphNodeSourcePointerMatchesActiveScope(pointer, item, snapshot, hierarchy);
      case ContextPackSourcePointerKind.GraphEdge:
        return graphEdgeSourcePointerMatchesActiveScope(pointer, item, snapshot, hierarchy);
      case ContextPackSourcePointerKind.HindsightMemory:
        return hindsightMemorySourcePointerMatchesActiveScope(pointer, snapshot);
      case ContextPackSourcePointerKind.WorkItem:
        return workItemSourcePointerMatchesActiveScope(pointer, snapshot, hierarchy);
      case ContextPackSourcePointerKind.ScheduleBlock:
        return scheduleBlockSourcePointerMatchesActiveScope(pointer, snapshot);
      case ContextPackSourcePointerKind.SupervisorSignal:
        return supervisorSignalSourcePointerMatchesActiveScope(pointer, snapshot);
      default:
        return false;
    }
  });
}

export function activeGraphNodeIdsForSnapshot(
  snapshot: AgentObserveSnapshot,
  hierarchy: HierarchyReadout,
): ReadonlySet<string> {
  if (snapshot.organizationId === undefined) return new Set();
  const organizationId = snapshot.organizationId;
  const nodeIds = [
    graphNodeId(organizationId, GraphNodeKind.Organization, organizationId),
    graphNodeId(organizationId, GraphNodeKind.Hat, snapshot.hat.id),
    ...(snapshot.projectId === undefined ? [] : [graphNodeId(organizationId, GraphNodeKind.Project, snapshot.projectId)]),
    ...(snapshot.teamId === undefined ? [] : [graphNodeId(organizationId, GraphNodeKind.Team, snapshot.teamId)]),
    ...(snapshot.workItemId === undefined ? [] : [graphNodeId(organizationId, GraphNodeKind.WorkItem, snapshot.workItemId)]),
    ...hierarchy.initiatives.map((initiative) => graphNodeId(organizationId, GraphNodeKind.Initiative, initiative.initiativeId)),
    ...hierarchy.priorityItems
      .filter((item) => item.scope === RunScope.WorkItem)
      .map((item) => graphNodeId(organizationId, GraphNodeKind.WorkItem, item.itemId)),
  ];
  return new Set(nodeIds);
}

export function activeRawGraphNodeIdsForSnapshot(
  snapshot: AgentObserveSnapshot,
  hierarchy: HierarchyReadout,
): ReadonlySet<string> {
  return new Set([
    snapshot.organizationId,
    snapshot.hat.id,
    snapshot.projectId,
    snapshot.teamId,
    snapshot.workItemId,
    ...hierarchy.initiatives.map((initiative) => initiative.initiativeId),
    ...hierarchy.priorityItems
      .filter((item) => item.scope === RunScope.WorkItem)
      .map((item) => item.itemId),
  ].filter((value): value is string => value !== undefined && value.length > 0));
}

export function activeGraphRootNodeIdsForSnapshot(
  snapshot: AgentObserveSnapshot,
  hierarchy: HierarchyReadout,
): ReadonlySet<string> {
  return new Set([
    ...activeRawGraphNodeIdsForSnapshot(snapshot, hierarchy),
    ...activeGraphNodeIdsForSnapshot(snapshot, hierarchy),
  ]);
}

export function activeGraphCitationRefsForSnapshot(
  snapshot: AgentObserveSnapshot,
  hierarchy: HierarchyReadout,
): ReadonlySet<string> {
  return new Set([
    ...(snapshot.organizationId === undefined ? [] : [`organization:${snapshot.organizationId}`]),
    `hat:${snapshot.hat.id}`,
    ...(snapshot.projectId === undefined ? [] : [`project:${snapshot.projectId}`]),
    ...(snapshot.teamId === undefined ? [] : [`team:${snapshot.teamId}`]),
    ...(snapshot.workItemId === undefined ? [] : [`work:${snapshot.workItemId}`]),
    ...hierarchy.initiatives.map((initiative) => `initiative:${initiative.initiativeId}`),
    ...hierarchy.priorityItems
      .filter((item) => item.scope === RunScope.WorkItem)
      .map((item) => `work:${item.itemId}`),
  ]);
}

export function hindsightMemorySourcePointerMatchesActiveScope(
  pointer: Extract<ContextPackSourcePointer, { kind: typeof ContextPackSourcePointerKind.HindsightMemory }>,
  snapshot: AgentObserveSnapshot,
): boolean {
  if (pointer.recallAgentId !== undefined || pointer.recallHatAssignmentId !== undefined || pointer.recallProjectId !== undefined || pointer.recallWorkItemId !== undefined) {
    return (
      optionalContextPackValueMatches(pointer.recallAgentId, snapshot.agentId) &&
      optionalContextPackValueMatches(pointer.recallHatAssignmentId, snapshot.hatAssignmentId) &&
      optionalContextPackValueMatches(pointer.recallProjectId, snapshot.projectId) &&
      optionalContextPackValueMatches(pointer.recallWorkItemId, snapshot.workItemId) &&
      optionalContextPackValueMatches(pointer.creatingProjectId, snapshot.projectId)
    );
  }
  return (
    optionalContextPackValueMatches(pointer.creatingProjectId, snapshot.projectId) &&
    optionalContextPackValueMatches(pointer.creatingWorkItemId, snapshot.workItemId)
  );
}

export function workItemSourcePointerMatchesActiveScope(
  pointer: Extract<ContextPackSourcePointer, { kind: typeof ContextPackSourcePointerKind.WorkItem }>,
  snapshot: AgentObserveSnapshot,
  hierarchy: HierarchyReadout,
): boolean {
  if (snapshot.workItemId !== undefined) return pointer.workItemId === snapshot.workItemId;
  return hierarchy.priorityItems.some((item) =>
    item.scope === RunScope.WorkItem && item.itemId === pointer.workItemId
  );
}

export function scheduleBlockSourcePointerMatchesActiveScope(
  pointer: Extract<ContextPackSourcePointer, { kind: typeof ContextPackSourcePointerKind.ScheduleBlock }>,
  snapshot: AgentObserveSnapshot,
): boolean {
  return (
    pointer.assignedHatAssignmentId === snapshot.hatAssignmentId &&
    optionalContextPackValueMatches(pointer.assignedAgentId, snapshot.agentId)
  );
}

export function inboxAnchorSourcePointerMatchesActiveScope(
  pointer: Extract<ContextPackSourcePointer, { kind: typeof ContextPackSourcePointerKind.InboxAnchor }>,
  snapshot: AgentObserveSnapshot,
): boolean {
  return (
    pointer.targetHatAssignmentId === snapshot.hatAssignmentId &&
    optionalContextPackValueMatches(pointer.targetAgentId, snapshot.agentId)
  );
}

export function supervisorSignalSourcePointerMatchesActiveScope(
  pointer: Extract<ContextPackSourcePointer, { kind: typeof ContextPackSourcePointerKind.SupervisorSignal }>,
  snapshot: AgentObserveSnapshot,
): boolean {
  return pointer.targetHatAssignmentId === snapshot.hatAssignmentId;
}

export function contextPackMatchesSnapshot(pack: ContextPack, snapshot: AgentObserveSnapshot): boolean {
  return (
    pack.runId === snapshot.runId &&
    pack.scope === snapshot.scope &&
    pack.hatAssignmentId === snapshot.hatAssignmentId &&
    pack.hatId === snapshot.hat.id &&
    optionalContextPackValueMatches(pack.agentId, snapshot.agentId) &&
    optionalContextPackValueMatches(pack.organizationId, snapshot.organizationId) &&
    optionalContextPackValueMatches(pack.projectId, snapshot.projectId) &&
    optionalContextPackValueMatches(pack.teamId, snapshot.teamId) &&
    optionalContextPackValueMatches(pack.workItemId, snapshot.workItemId)
  );
}

export function optionalContextPackValueMatches(packValue: string | undefined, snapshotValue: string | undefined): boolean {
  return snapshotValue === undefined ? packValue === undefined : packValue === snapshotValue;
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}
