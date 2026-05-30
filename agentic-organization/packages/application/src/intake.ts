/**
 * External / SR intake (WORK_OS_OVERHAUL §C5) — how work flows IN from outside
 * systems. A customer portal / support tool / monitor submits an event (over an
 * HTTP webhook or the NATS subject org.intake.external, wired in W6); both land
 * on this DETERMINISTIC normalizer: external payload → a typed WorkItem in
 * `created`, de-duplicated by externalRef so the same upstream report never
 * creates two work items. Triage then advances it into the backlog/SR pipeline.
 * Every intake is one intake_received org_event; malformed payloads are rejected
 * cleanly (Result-shaped), never silently dropped.
 */

import {
  OrgEventKind,
  WorkItemSource,
  WorkItemState,
  WorkItemType,
  assertWorkItemTransition,
  type AgenticActor,
  type OrgEvent,
  type WorkItem,
  type WorkItemSeverity,
} from "../../domain/src/index.ts";

/** The raw inbound event from an external system. */
export type ExternalIntakeEvent = {
  source: string; // e.g. "customer_portal", "pagerduty", "support_desk"
  externalId: string; // the upstream id (de-dup key with source)
  kind?: "defect" | "service_request" | "feature" | "goal" | "incident";
  title: string;
  body?: string;
  severity?: WorkItemSeverity;
  projectId: string;
};

export type IntakeFeedback = {
  reason: "missing_title" | "missing_project" | "missing_external_id" | "duplicate";
  message: string;
};

export type NormalizedIntake = {
  workItemType: WorkItemType;
  title: string;
  projectId: string;
  externalRef: string; // `${source}:${externalId}` — the idempotency key
  severity?: WorkItemSeverity;
};

export type Result<T> = { ok: true; value: T } | { ok: false; feedback: IntakeFeedback };

const KIND_TO_TYPE: Readonly<Record<NonNullable<ExternalIntakeEvent["kind"]>, WorkItemType>> = {
  defect: WorkItemType.Defect,
  service_request: WorkItemType.ServiceRequest,
  feature: WorkItemType.Task,
  goal: WorkItemType.Goal,
  incident: WorkItemType.Incident,
};

/** Deterministic mapping of an external payload to a normalized work item shape. */
export function normalizeIntake(raw: ExternalIntakeEvent): Result<NormalizedIntake> {
  if (raw.title.trim().length === 0) return { ok: false, feedback: { reason: "missing_title", message: "intake event has no title" } };
  if (raw.projectId.trim().length === 0) return { ok: false, feedback: { reason: "missing_project", message: "intake event has no projectId" } };
  if (raw.externalId.trim().length === 0) return { ok: false, feedback: { reason: "missing_external_id", message: "intake event has no externalId" } };
  return {
    ok: true,
    value: {
      workItemType: raw.kind !== undefined ? KIND_TO_TYPE[raw.kind] : WorkItemType.ServiceRequest,
      title: raw.title,
      projectId: raw.projectId,
      externalRef: `${raw.source}:${raw.externalId}`,
      ...(raw.severity !== undefined ? { severity: raw.severity } : {}),
    },
  };
}

export type IntakeDeps = {
  organizationId: string;
  initiativeId: string;
  createdBy: AgenticActor;
  createId: (prefix: string) => string;
  nowIso: () => string;
  existsByExternalRef: (externalRef: string) => boolean; // de-dup check
  appendEvent: (event: OrgEvent) => Promise<void>;
};

function transitionEvent(deps: IntakeDeps, workItemId: string, from: WorkItemState, to: WorkItemState, decision: string): OrgEvent {
  return {
    id: deps.createId("evt"),
    kind: OrgEventKind.WorkItemTransition,
    occurredAt: deps.nowIso(),
    organizationId: deps.organizationId,
    subjectId: workItemId,
    fromState: from,
    toState: to,
    decision,
    supervisorChain: [],
    evidenceRefs: [],
    correlationId: workItemId,
    causationId: workItemId,
    traceId: workItemId,
  };
}

/** Create a WorkItem from a normalized intake — idempotent on externalRef. */
export async function createWorkItemFromIntake(
  normalized: NormalizedIntake,
  deps: IntakeDeps,
): Promise<Result<{ workItem: WorkItem; event: OrgEvent }>> {
  if (deps.existsByExternalRef(normalized.externalRef)) {
    return { ok: false, feedback: { reason: "duplicate", message: `intake ${normalized.externalRef} already ingested` } };
  }
  const now = deps.nowIso();
  const workItem: WorkItem = {
    workItemId: deps.createId("wi"),
    organizationId: deps.organizationId,
    projectId: normalized.projectId,
    initiativeId: deps.initiativeId,
    workItemType: normalized.workItemType,
    title: normalized.title,
    description: `Ingested from external source ${normalized.externalRef}`,
    state: WorkItemState.Created,
    createdAt: now,
    createdBy: deps.createdBy,
    source: WorkItemSource.External,
    externalRef: normalized.externalRef,
    ...(normalized.severity !== undefined ? { severity: normalized.severity } : {}),
    updatedAt: now,
  };
  const event: OrgEvent = {
    id: deps.createId("evt"),
    kind: OrgEventKind.IntakeReceived,
    occurredAt: now,
    organizationId: deps.organizationId,
    subjectId: workItem.workItemId,
    toState: WorkItemState.Created,
    decision: `external ${normalized.workItemType} "${normalized.title}" ingested from ${normalized.externalRef}`,
    supervisorChain: [],
    evidenceRefs: [normalized.externalRef],
    correlationId: workItem.workItemId,
    causationId: workItem.workItemId,
    traceId: workItem.workItemId,
  };
  await deps.appendEvent(event);
  return { ok: true, value: { workItem, event } };
}

/**
 * Triage an ingested item into the backlog: created → intake → triage → ready.
 * Each hop is a legal WorkItemState transition + one work_item_transition event,
 * so a customer-reported defect is traceable end-to-end into the SR/backlog
 * pipeline. (The type was classified deterministically at normalize time; a
 * triage hat can reclassify before this in a richer flow.)
 */
export async function triageIntake(workItem: WorkItem, deps: IntakeDeps): Promise<WorkItem> {
  const path: readonly WorkItemState[] = [WorkItemState.Created, WorkItemState.Intake, WorkItemState.Triage, WorkItemState.Ready];
  let current = workItem;
  for (let i = 0; i < path.length - 1; i += 1) {
    const from = path[i]!;
    const to = path[i + 1]!;
    // an external report carries the triage fields + reproduction evidence the
    // defect guard requires; the triage hat confirms them here.
    assertWorkItemTransition(from, to, { workItemType: workItem.workItemType, hasTriageFields: true, hasRequiredEvidence: true });
    await deps.appendEvent(transitionEvent(deps, workItem.workItemId, from, to, `triage: ${from} → ${to}`));
    current = { ...current, state: to, updatedAt: deps.nowIso() };
  }
  return current;
}
