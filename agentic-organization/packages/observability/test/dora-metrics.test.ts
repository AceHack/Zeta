import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  ChangeArtifactKind,
  ChangeSetPhase,
  OrgEventKind,
  WorkItemSource,
  WorkItemState,
  WorkItemType,
  type ChangeSet,
  type OrgEvent,
  type WorkItem,
} from "../../domain/src/index.ts";
import {
  RecordingTelemetry,
  rollUpDoraMetrics,
  rollUpDoraMetricsByInitiative,
  rollUpDoraMetricsByProject,
  recordDoraMetricsTelemetry,
} from "../src/index.ts";

describe("internal DORA metrics", () => {
  test("counts applied internal change sets as deployments and derives lead time", () => {
    const metrics = rollUpDoraMetrics({
      scope: { kind: "initiative", organizationId: "org-1", projectId: "project-a", initiativeId: "init-a" },
      workItems: [workItem("work-a", "project-a", "init-a"), workItem("work-b", "project-a", "init-a")],
      changeSets: [
        changeSet("cs-a", "work-a", "2026-05-31T00:00:00.000Z"),
        changeSet("cs-b", "work-b", "2026-05-31T12:00:00.000Z"),
      ],
      events: [
        changeEvent(OrgEventKind.ChangeSetOpened, "cs-a", "2026-05-31T00:00:00.000Z"),
        changeEvent(OrgEventKind.ChangeSetApplied, "cs-a", "2026-05-31T02:00:00.000Z"),
        changeEvent(OrgEventKind.ChangeSetOpened, "cs-b", "2026-05-31T12:00:00.000Z"),
        changeEvent(OrgEventKind.ChangeSetApplied, "cs-b", "2026-06-01T12:00:00.000Z"),
      ],
      window: { start: "2026-05-31T00:00:00.000Z", end: "2026-06-02T00:00:00.000Z" },
    });

    equal(metrics.deploymentCount, 2);
    equal(metrics.deploymentFrequencyPerDay, 1);
    equal(metrics.leadTimeForChanges.count, 2);
    equal(metrics.leadTimeForChanges.averageMs, 13 * 60 * 60 * 1000);
    equal(metrics.changeFailureCount, 0);
    equal(metrics.changeFailureRate, 0);
  });

  test("treats internal changes_requested by QA, code review, user, or business as change failures", () => {
    const metrics = rollUpDoraMetrics({
      scope: { kind: "initiative", organizationId: "org-1", projectId: "project-a", initiativeId: "init-a" },
      workItems: [workItem("work-a", "project-a", "init-a"), workItem("work-b", "project-a", "init-a")],
      changeSets: [
        changeSet("cs-a", "work-a", "2026-05-31T00:00:00.000Z"),
        changeSet("cs-b", "work-b", "2026-05-31T06:00:00.000Z"),
      ],
      events: [
        changeEvent(OrgEventKind.ChangeSetOpened, "cs-a", "2026-05-31T00:00:00.000Z"),
        changeEvent(OrgEventKind.ChangesRequested, "cs-a", "2026-05-31T01:00:00.000Z", "qa_verifier"),
        changeEvent(OrgEventKind.ChangeSetApplied, "cs-a", "2026-05-31T03:00:00.000Z"),
        changeEvent(OrgEventKind.ChangeSetOpened, "cs-b", "2026-05-31T06:00:00.000Z"),
        changeEvent(OrgEventKind.ChangesRequested, "cs-b", "2026-05-31T07:00:00.000Z", "code_reviewer"),
        changeEvent(OrgEventKind.ChangesRequested, "cs-b", "2026-05-31T08:00:00.000Z", "business_validator"),
        changeEvent(OrgEventKind.ChangeSetApplied, "cs-b", "2026-05-31T12:00:00.000Z"),
      ],
      window: { start: "2026-05-31T00:00:00.000Z", end: "2026-06-01T00:00:00.000Z" },
    });

    equal(metrics.deploymentCount, 2);
    equal(metrics.changeFailureCount, 2);
    equal(metrics.changeFailureRate, 1);
    equal(metrics.meanTimeToRestore.count, 2);
    equal(metrics.meanTimeToRestore.averageMs, (2 * 60 * 60 * 1000 + 5 * 60 * 60 * 1000) / 2);
  });

  test("groups DORA KPIs by project and by initiative through the work-item join", () => {
    const workItems = [
      workItem("work-a", "project-a", "init-a"),
      workItem("work-b", "project-a", "init-b"),
      workItem("work-c", "project-b", "init-c"),
    ];
    const changeSets = [
      changeSet("cs-a", "work-a", "2026-05-31T00:00:00.000Z"),
      changeSet("cs-b", "work-b", "2026-05-31T00:00:00.000Z"),
      changeSet("cs-c", "work-c", "2026-05-31T00:00:00.000Z"),
    ];
    const events = [
      changeEvent(OrgEventKind.ChangeSetApplied, "cs-a", "2026-05-31T01:00:00.000Z"),
      changeEvent(OrgEventKind.ChangeSetApplied, "cs-b", "2026-05-31T02:00:00.000Z"),
      changeEvent(OrgEventKind.ChangeSetApplied, "cs-c", "2026-05-31T03:00:00.000Z"),
    ];
    const window = { start: "2026-05-31T00:00:00.000Z", end: "2026-06-01T00:00:00.000Z" };

    deepEqual(
      rollUpDoraMetricsByProject({ organizationId: "org-1", workItems, changeSets, events, window }).map((m) => ({
        projectId: m.scope.projectId,
        deployments: m.deploymentCount,
      })),
      [
        { projectId: "project-a", deployments: 2 },
        { projectId: "project-b", deployments: 1 },
      ],
    );
    deepEqual(
      rollUpDoraMetricsByInitiative({ organizationId: "org-1", workItems, changeSets, events, window }).map((m) => ({
        initiativeId: m.scope.initiativeId,
        deployments: m.deploymentCount,
      })),
      [
        { initiativeId: "init-a", deployments: 1 },
        { initiativeId: "init-b", deployments: 1 },
        { initiativeId: "init-c", deployments: 1 },
      ],
    );
  });

  test("emits DORA KPIs through the telemetry port with project and initiative labels", () => {
    const telemetry = new RecordingTelemetry();

    recordDoraMetricsTelemetry(telemetry, {
      scope: { kind: "initiative", organizationId: "org-1", projectId: "project-a", initiativeId: "init-a" },
      deploymentCount: 3,
      deploymentFrequencyPerDay: 1.5,
      leadTimeForChanges: { count: 3, averageMs: 2000 },
      changeFailureCount: 1,
      changeFailureRate: 1 / 3,
      meanTimeToRestore: { count: 1, averageMs: 5000 },
    });

    deepEqual(telemetry.metrics.map((metric) => metric.name), [
      "org_dora_deployments_total",
      "org_dora_deployment_frequency_per_day",
      "org_dora_lead_time_ms",
      "org_dora_change_failure_ratio",
      "org_dora_mttr_ms",
    ]);
    deepEqual(telemetry.metrics[0]!.attributes, {
      "agentic.organization.id": "org-1",
      "agentic.project.id": "project-a",
      "agentic.initiative.id": "init-a",
      "agentic.dora.scope": "initiative",
    });
  });
});

function workItem(workItemId: string, projectId: string, initiativeId: string): WorkItem {
  return {
    workItemId,
    organizationId: "org-1",
    projectId,
    initiativeId,
    workItemType: WorkItemType.Task,
    title: workItemId,
    description: "delivery work",
    state: WorkItemState.Done,
    source: WorkItemSource.Internal,
    createdAt: "2026-05-31T00:00:00.000Z",
    createdBy: { agentId: "agent-1", hatAssignmentId: "hat-1" },
  };
}

function changeSet(changeSetId: string, workItemId: string, openedAt: string): ChangeSet {
  return {
    changeSetId,
    organizationId: "org-1",
    workItemId,
    proposerHatId: "backend_implementer",
    title: changeSetId,
    targetRef: `branch/${changeSetId}`,
    phase: ChangeSetPhase.Applied,
    pipelineId: "internal-only",
    currentStageIndex: 0,
    artifacts: [{ kind: ChangeArtifactKind.CodeDiff, path: "src/app.ts", diff: "+1", language: "ts" }],
    projections: [],
    revision: 1,
    openedAt,
    updatedAt: openedAt,
  };
}

function changeEvent(
  kind: OrgEventKind,
  subjectId: string,
  occurredAt: string,
  actorHatId = "release_manager",
): OrgEvent {
  return {
    id: `${kind}-${subjectId}-${occurredAt}`,
    kind,
    occurredAt,
    organizationId: "org-1",
    actorHatId,
    subjectId,
    decision: `${kind} ${subjectId}`,
    supervisorChain: [],
    evidenceRefs: [],
    correlationId: subjectId,
    causationId: subjectId,
    traceId: subjectId,
  };
}
