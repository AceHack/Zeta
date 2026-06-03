import {
  ContextPackSourcePointerKind,
  type ContextPack,
  type ContextPackDrillTarget,
  type ContextPackDrillTargetGroup,
  type ContextPackItem,
  type ContextPackMemoryGovernanceExplanation,
  type ContextPackSourcePointer,
  type ContextPackSourcePointerKind as ContextPackSourcePointerKindType,
} from "./context-pack-contracts.ts";
export type { ContextPackDrillTarget, ContextPackDrillTargetGroup } from "./context-pack-contracts.ts";

const CONTEXT_PACK_DRILL_ROUTE_SEPARATOR = ":";

const CONTEXT_PACK_DRILL_LABEL_PREFIX: Readonly<Record<ContextPackSourcePointerKindType, string>> = {
  [ContextPackSourcePointerKind.DocUnit]: "Document",
  [ContextPackSourcePointerKind.GitBlob]: "Git blob",
  [ContextPackSourcePointerKind.GraphNode]: "Graph node",
  [ContextPackSourcePointerKind.GraphEdge]: "Graph edge",
  [ContextPackSourcePointerKind.HindsightMemory]: "Memory",
  [ContextPackSourcePointerKind.WorkItem]: "Work item",
  [ContextPackSourcePointerKind.Decision]: "Decision",
  [ContextPackSourcePointerKind.Discussion]: "Discussion",
  [ContextPackSourcePointerKind.InboxAnchor]: "Inbox anchor",
  [ContextPackSourcePointerKind.Meeting]: "Meeting",
  [ContextPackSourcePointerKind.QualityGate]: "Quality gate",
  [ContextPackSourcePointerKind.ScheduleBlock]: "Schedule block",
  [ContextPackSourcePointerKind.SupervisorSignal]: "Supervisor signal",
  [ContextPackSourcePointerKind.Trace]: "Trace",
  [ContextPackSourcePointerKind.Metric]: "Metric",
  [ContextPackSourcePointerKind.Log]: "Log",
  [ContextPackSourcePointerKind.Policy]: "Policy",
};

export function contextPackDrillTargetGroupsForPack(
  pack: ContextPack,
): readonly ContextPackDrillTargetGroup[] {
  return pack.items.flatMap((item) => {
    const targets = contextPackDrillTargetsForItem(item);
    if (targets.length === 0) return [];
    return [{
      itemId: item.id,
      itemKind: item.kind,
      itemTitle: item.title,
      targets,
    }];
  });
}

export function contextPackDrillTargetsForItem(item: ContextPackItem): readonly ContextPackDrillTarget[] {
  const seen = new Set<string>();
  return (item.sourcePointers ?? [])
    .map(contextPackDrillTargetForSourcePointer)
    .filter((target) => {
      if (seen.has(target.routeRef)) return false;
      seen.add(target.routeRef);
      return true;
    });
}

function contextPackDrillTargetForSourcePointer(pointer: ContextPackSourcePointer): ContextPackDrillTarget {
  const targetId = contextPackDrillTargetIdFor(pointer);
  return {
    targetKind: pointer.kind,
    targetId,
    routeRef: contextPackDrillRouteRefFor(pointer),
    label: `${CONTEXT_PACK_DRILL_LABEL_PREFIX[pointer.kind]} ${targetId}`,
    sourcePointer: cloneContextPackSourcePointer(pointer),
    ...(pointer.kind === ContextPackSourcePointerKind.HindsightMemory && pointer.governance !== undefined
      ? { governance: cloneMemoryGovernanceExplanation(pointer.governance) }
      : {}),
  };
}

function contextPackDrillTargetIdFor(pointer: ContextPackSourcePointer): string {
  switch (pointer.kind) {
    case ContextPackSourcePointerKind.DocUnit:
      return pointer.docUnitId;
    case ContextPackSourcePointerKind.GitBlob:
      return pointer.path;
    case ContextPackSourcePointerKind.GraphNode:
      return pointer.nodeId;
    case ContextPackSourcePointerKind.GraphEdge:
      return pointer.edgeId;
    case ContextPackSourcePointerKind.HindsightMemory:
      return pointer.memoryId;
    case ContextPackSourcePointerKind.WorkItem:
      return pointer.workItemId;
    case ContextPackSourcePointerKind.Decision:
      return pointer.decisionId;
    case ContextPackSourcePointerKind.Discussion:
      return pointer.discussionId;
    case ContextPackSourcePointerKind.InboxAnchor:
      return pointer.inboxAnchorId;
    case ContextPackSourcePointerKind.Meeting:
      return pointer.meetingId;
    case ContextPackSourcePointerKind.QualityGate:
      return pointer.qualityGateEvaluationId;
    case ContextPackSourcePointerKind.ScheduleBlock:
      return pointer.workScheduleBlockId;
    case ContextPackSourcePointerKind.SupervisorSignal:
      return pointer.supervisorSignalId;
    case ContextPackSourcePointerKind.Trace:
      return pointer.traceId;
    case ContextPackSourcePointerKind.Metric:
      return pointer.seriesId ?? pointer.query;
    case ContextPackSourcePointerKind.Log:
      return pointer.logRef;
    case ContextPackSourcePointerKind.Policy:
      return pointer.policyId;
  }
}

function contextPackDrillRouteRefFor(pointer: ContextPackSourcePointer): string {
  switch (pointer.kind) {
    case ContextPackSourcePointerKind.DocUnit:
      return drillRouteRef(pointer.kind, pointer.docUnitId, `v${pointer.version}`);
    case ContextPackSourcePointerKind.GitBlob:
      return drillRouteRef(pointer.kind, pointer.path, pointer.commitSha ?? "", pointer.blobSha ?? "");
    case ContextPackSourcePointerKind.GraphNode:
      return drillRouteRef(pointer.kind, pointer.nodeId);
    case ContextPackSourcePointerKind.GraphEdge:
      return drillRouteRef(pointer.kind, pointer.edgeId);
    case ContextPackSourcePointerKind.HindsightMemory:
      return drillRouteRef(pointer.kind, pointer.providerId, pointer.memoryId);
    case ContextPackSourcePointerKind.WorkItem:
      return drillRouteRef(pointer.kind, pointer.workItemId);
    case ContextPackSourcePointerKind.Decision:
      return drillRouteRef(pointer.kind, pointer.decisionId);
    case ContextPackSourcePointerKind.Discussion:
      return drillRouteRef(pointer.kind, pointer.discussionId);
    case ContextPackSourcePointerKind.InboxAnchor:
      return drillRouteRef(pointer.kind, pointer.inboxAnchorId);
    case ContextPackSourcePointerKind.Meeting:
      return drillRouteRef(pointer.kind, pointer.meetingId);
    case ContextPackSourcePointerKind.QualityGate:
      return drillRouteRef(pointer.kind, pointer.qualityGateEvaluationId);
    case ContextPackSourcePointerKind.ScheduleBlock:
      return drillRouteRef(pointer.kind, pointer.workScheduleBlockId);
    case ContextPackSourcePointerKind.SupervisorSignal:
      return drillRouteRef(pointer.kind, pointer.supervisorSignalId);
    case ContextPackSourcePointerKind.Trace:
      return drillRouteRef(pointer.kind, pointer.traceId);
    case ContextPackSourcePointerKind.Metric:
      return drillRouteRef(pointer.kind, pointer.source, pointer.seriesId ?? pointer.query);
    case ContextPackSourcePointerKind.Log:
      return drillRouteRef(pointer.kind, pointer.source, pointer.logRef);
    case ContextPackSourcePointerKind.Policy:
      return drillRouteRef(pointer.kind, pointer.policyId, pointer.version ?? "");
  }
}

function drillRouteRef(kind: ContextPackSourcePointerKindType, ...parts: readonly string[]): string {
  return [kind, ...parts.filter((part) => part.length > 0)].join(CONTEXT_PACK_DRILL_ROUTE_SEPARATOR);
}

function cloneContextPackSourcePointer(pointer: ContextPackSourcePointer): ContextPackSourcePointer {
  if (pointer.kind !== ContextPackSourcePointerKind.HindsightMemory || pointer.governance === undefined) {
    return { ...pointer };
  }
  return {
    ...pointer,
    governance: cloneMemoryGovernanceExplanation(pointer.governance),
  };
}

function cloneMemoryGovernanceExplanation(
  governance: ContextPackMemoryGovernanceExplanation,
): ContextPackMemoryGovernanceExplanation {
  return {
    ...governance,
    outcome: { ...governance.outcome },
    utility: { ...governance.utility },
  };
}
