import {
  OrgEventKind,
  type ChangeSet,
  type OrgEvent,
  type WorkItem,
} from "../../domain/src/index.ts";
import {
  TelemetryMetricKind,
  type TelemetryAttributes,
  type TelemetryPort,
} from "./telemetry-port.ts";

export type DoraScopeKind = "project" | "initiative" | "batch";

export type DoraScope = {
  kind: DoraScopeKind;
  organizationId: string;
  projectId?: string;
  initiativeId?: string;
  batchId?: string;
};

export type DoraTimeWindow = {
  start: string;
  end: string;
};

export type DoraDurationMetric = {
  count: number;
  averageMs: number;
};

export type DoraMetrics = {
  scope: DoraScope;
  deploymentCount: number;
  deploymentFrequencyPerDay: number;
  leadTimeForChanges: DoraDurationMetric;
  changeFailureCount: number;
  changeFailureRate: number;
  meanTimeToRestore: DoraDurationMetric;
};

export type RollUpDoraMetricsInput = {
  scope: DoraScope;
  workItems: readonly WorkItem[];
  changeSets: readonly ChangeSet[];
  events: readonly OrgEvent[];
  window?: DoraTimeWindow;
};

export type RollUpDoraMetricsByScopeInput = {
  organizationId: string;
  workItems: readonly WorkItem[];
  changeSets: readonly ChangeSet[];
  events: readonly OrgEvent[];
  window?: DoraTimeWindow;
};

const MsPerDay = 24 * 60 * 60 * 1000;

export const EmptyDoraMetrics: DoraMetrics = {
  scope: { kind: "project", organizationId: "" },
  deploymentCount: 0,
  deploymentFrequencyPerDay: 0,
  leadTimeForChanges: { count: 0, averageMs: 0 },
  changeFailureCount: 0,
  changeFailureRate: 0,
  meanTimeToRestore: { count: 0, averageMs: 0 },
};

export function rollUpDoraMetrics(input: RollUpDoraMetricsInput): DoraMetrics {
  const workItemsById = new Map(input.workItems.map((item) => [item.workItemId, item]));
  const inScopeChangeSets = input.changeSets.filter(
    (changeSet) =>
      changeSet.organizationId === input.scope.organizationId &&
      workItemsById.has(changeSet.workItemId) &&
      changeSetMatchesScope(changeSet, workItemsById.get(changeSet.workItemId)!, input.scope),
  );
  const changeSetIds = new Set(inScopeChangeSets.map((changeSet) => changeSet.changeSetId));
  const eventsByChangeSetId = groupEventsByChangeSetId(input.events, changeSetIds, input.scope.organizationId);
  const deployedChangeSets = inScopeChangeSets
    .map((changeSet) => {
      const events = eventsByChangeSetId.get(changeSet.changeSetId) ?? [];
      const appliedAt = firstEventTime(events, OrgEventKind.ChangeSetApplied);
      if (appliedAt === undefined || !isInWindow(appliedAt, input.window)) {
        return undefined;
      }
      return { changeSet, appliedAt, events };
    })
    .filter(isDefined);

  const leadTimes = deployedChangeSets
    .map(({ changeSet, appliedAt, events }) => {
      const openedAt = firstEventTime(events, OrgEventKind.ChangeSetOpened) ?? Date.parse(changeSet.openedAt);
      return durationMs(openedAt, appliedAt);
    })
    .filter(isDefined);
  const failedDeployments = deployedChangeSets.filter(({ events }) =>
    events.some((event) => event.kind === OrgEventKind.ChangesRequested),
  );
  const restoreTimes = failedDeployments
    .map(({ appliedAt, events }) => {
      const failedAt = firstEventTime(events, OrgEventKind.ChangesRequested);
      return failedAt === undefined ? undefined : durationMs(failedAt, appliedAt);
    })
    .filter(isDefined);
  const deploymentCount = deployedChangeSets.length;

  return {
    scope: input.scope,
    deploymentCount,
    deploymentFrequencyPerDay: deploymentFrequencyPerDay(deploymentCount, input.window),
    leadTimeForChanges: averageDuration(leadTimes),
    changeFailureCount: failedDeployments.length,
    changeFailureRate: deploymentCount === 0 ? 0 : failedDeployments.length / deploymentCount,
    meanTimeToRestore: averageDuration(restoreTimes),
  };
}

export function rollUpDoraMetricsByProject(input: RollUpDoraMetricsByScopeInput): readonly DoraMetrics[] {
  return Array.from(groupWorkItems(input.workItems, (item) => item.projectId).entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([projectId, workItems]) =>
      rollUpDoraMetrics({
        scope: { kind: "project", organizationId: input.organizationId, projectId },
        workItems,
        changeSets: input.changeSets,
        events: input.events,
        ...(input.window !== undefined ? { window: input.window } : {}),
      }),
    );
}

export function rollUpDoraMetricsByInitiative(input: RollUpDoraMetricsByScopeInput): readonly DoraMetrics[] {
  return Array.from(groupWorkItems(input.workItems, (item) => item.initiativeId).entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([initiativeId, workItems]) => {
      const projectId = workItems[0]?.projectId;
      return rollUpDoraMetrics({
        scope: {
          kind: "initiative",
          organizationId: input.organizationId,
          ...(projectId !== undefined ? { projectId } : {}),
          initiativeId,
        },
        workItems,
        changeSets: input.changeSets,
        events: input.events,
        ...(input.window !== undefined ? { window: input.window } : {}),
      });
    });
}

export function aggregateDoraMetrics(list: readonly DoraMetrics[]): DoraMetrics {
  if (list.length === 0) {
    return EmptyDoraMetrics;
  }
  const deploymentCount = sum(list, (metrics) => metrics.deploymentCount);
  const changeFailureCount = sum(list, (metrics) => metrics.changeFailureCount);
  return {
    scope: list[0]!.scope,
    deploymentCount,
    deploymentFrequencyPerDay: sum(list, (metrics) => metrics.deploymentFrequencyPerDay),
    leadTimeForChanges: weightedAverageDuration(list.map((metrics) => metrics.leadTimeForChanges)),
    changeFailureCount,
    changeFailureRate: deploymentCount === 0 ? 0 : changeFailureCount / deploymentCount,
    meanTimeToRestore: weightedAverageDuration(list.map((metrics) => metrics.meanTimeToRestore)),
  };
}

export function recordDoraMetricsTelemetry(telemetry: TelemetryPort, metrics: DoraMetrics): void {
  const attributes = doraTelemetryAttributes(metrics.scope);
  telemetry.recordMetric({
    kind: TelemetryMetricKind.Counter,
    name: "org_dora_deployments_total",
    value: metrics.deploymentCount,
    attributes,
  });
  telemetry.recordMetric({
    kind: TelemetryMetricKind.Gauge,
    name: "org_dora_deployment_frequency_per_day",
    value: metrics.deploymentFrequencyPerDay,
    attributes,
  });
  telemetry.recordMetric({
    kind: TelemetryMetricKind.Histogram,
    name: "org_dora_lead_time_ms",
    value: metrics.leadTimeForChanges.averageMs,
    attributes: { ...attributes, "agentic.dora.sample_count": metrics.leadTimeForChanges.count },
  });
  telemetry.recordMetric({
    kind: TelemetryMetricKind.Gauge,
    name: "org_dora_change_failure_ratio",
    value: metrics.changeFailureRate,
    attributes: { ...attributes, "agentic.dora.failure_count": metrics.changeFailureCount },
  });
  telemetry.recordMetric({
    kind: TelemetryMetricKind.Histogram,
    name: "org_dora_mttr_ms",
    value: metrics.meanTimeToRestore.averageMs,
    attributes: { ...attributes, "agentic.dora.sample_count": metrics.meanTimeToRestore.count },
  });
}

function changeSetMatchesScope(changeSet: ChangeSet, workItem: WorkItem, scope: DoraScope): boolean {
  if (scope.projectId !== undefined && workItem.projectId !== scope.projectId) {
    return false;
  }
  if (scope.initiativeId !== undefined && workItem.initiativeId !== scope.initiativeId) {
    return false;
  }
  if (scope.batchId !== undefined && workItem.batchId !== scope.batchId) {
    return false;
  }
  return changeSet.workItemId === workItem.workItemId;
}

function groupEventsByChangeSetId(
  events: readonly OrgEvent[],
  changeSetIds: ReadonlySet<string>,
  organizationId: string,
): ReadonlyMap<string, readonly OrgEvent[]> {
  const byId = new Map<string, OrgEvent[]>();
  for (const event of events) {
    if (event.organizationId !== organizationId || !changeSetIds.has(event.subjectId)) {
      continue;
    }
    const existing = byId.get(event.subjectId) ?? [];
    existing.push(event);
    byId.set(event.subjectId, existing);
  }
  for (const [changeSetId, groupedEvents] of byId) {
    groupedEvents.sort((left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt));
    byId.set(changeSetId, groupedEvents);
  }
  return byId;
}

function firstEventTime(events: readonly OrgEvent[], kind: OrgEventKind): number | undefined {
  const event = events.find((candidate) => candidate.kind === kind);
  if (event === undefined) {
    return undefined;
  }
  const time = Date.parse(event.occurredAt);
  return Number.isFinite(time) ? time : undefined;
}

function isInWindow(timeMs: number, window: DoraTimeWindow | undefined): boolean {
  if (window === undefined) {
    return true;
  }
  return timeMs >= Date.parse(window.start) && timeMs < Date.parse(window.end);
}

function durationMs(startMs: number, endMs: number): number | undefined {
  const duration = endMs - startMs;
  return Number.isFinite(duration) && duration >= 0 ? duration : undefined;
}

function deploymentFrequencyPerDay(deploymentCount: number, window: DoraTimeWindow | undefined): number {
  if (window === undefined) {
    return deploymentCount;
  }
  const durationDays = (Date.parse(window.end) - Date.parse(window.start)) / MsPerDay;
  return durationDays <= 0 ? 0 : deploymentCount / durationDays;
}

function averageDuration(values: readonly number[]): DoraDurationMetric {
  return { count: values.length, averageMs: values.length === 0 ? 0 : sumNumbers(values) / values.length };
}

function weightedAverageDuration(values: readonly DoraDurationMetric[]): DoraDurationMetric {
  const count = sum(values, (value) => value.count);
  if (count === 0) {
    return { count: 0, averageMs: 0 };
  }
  return {
    count,
    averageMs: sum(values, (value) => value.averageMs * value.count) / count,
  };
}

function groupWorkItems(
  workItems: readonly WorkItem[],
  groupId: (workItem: WorkItem) => string | undefined,
): ReadonlyMap<string, readonly WorkItem[]> {
  const groups = new Map<string, WorkItem[]>();
  for (const item of workItems) {
    const id = groupId(item);
    if (id === undefined) {
      continue;
    }
    const existing = groups.get(id) ?? [];
    existing.push(item);
    groups.set(id, existing);
  }
  return groups;
}

function doraTelemetryAttributes(scope: DoraScope): TelemetryAttributes {
  return {
    "agentic.organization.id": scope.organizationId,
    "agentic.dora.scope": scope.kind,
    ...(scope.projectId !== undefined ? { "agentic.project.id": scope.projectId } : {}),
    ...(scope.initiativeId !== undefined ? { "agentic.initiative.id": scope.initiativeId } : {}),
    ...(scope.batchId !== undefined ? { "agentic.batch.id": scope.batchId } : {}),
  };
}

function sum<T>(values: readonly T[], pick: (value: T) => number): number {
  return values.reduce((total, value) => total + pick(value), 0);
}

function sumNumbers(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}
