import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { OrgEventKind, WorkItemState, WorkItemType, WorkItemSource, type OrgEvent } from "../../domain/src/index.ts";
import { normalizeIntake, createWorkItemFromIntake, triageIntake, type ExternalIntakeEvent, type IntakeDeps } from "../src/index.ts";

const raw = (over: Partial<ExternalIntakeEvent> = {}): ExternalIntakeEvent => ({
  source: "customer_portal", externalId: "TICKET-42", kind: "defect", title: "checkout 500s", body: "repro: add item, pay", projectId: "proj-1", ...over,
});

function deps(seen: Set<string>): { deps: IntakeDeps; events: OrgEvent[] } {
  const events: OrgEvent[] = [];
  let n = 0;
  return {
    events,
    deps: {
      organizationId: "org-lfg", initiativeId: "init-1", createdBy: { agentId: "intake-svc", hatAssignmentId: "ha" },
      createId: (p: string) => `${p}-${++n}`, nowIso: () => new Date(1_800_000_000_000 + n * 1000).toISOString(),
      existsByExternalRef: (ref: string) => seen.has(ref),
      appendEvent: async (e: OrgEvent) => void events.push(e),
    },
  };
}

test("normalize maps external kinds to work item types and rejects malformed payloads", () => {
  equal((normalizeIntake(raw({ kind: "defect" })) as { ok: true; value: { workItemType: WorkItemType } }).value.workItemType, WorkItemType.Defect);
  equal((normalizeIntake(raw({ kind: "service_request" })) as { ok: true; value: { workItemType: WorkItemType } }).value.workItemType, WorkItemType.ServiceRequest);
  equal((normalizeIntake(raw({ kind: "feature" })) as { ok: true; value: { workItemType: WorkItemType } }).value.workItemType, WorkItemType.Task);
  // missing fields → clean rejection, not a silent drop
  equal(normalizeIntake(raw({ title: "" })).ok, false);
  equal(normalizeIntake(raw({ projectId: "" })).ok, false);
  equal(normalizeIntake(raw({ externalId: "" })).ok, false);
});

test("the externalRef is the de-dup key (source:externalId)", () => {
  const n = normalizeIntake(raw());
  ok(n.ok);
  if (n.ok) equal(n.value.externalRef, "customer_portal:TICKET-42");
});

test("a customer defect becomes an external work item and emits intake_received", async () => {
  const n = normalizeIntake(raw());
  ok(n.ok);
  if (!n.ok) return;
  const { deps: d, events } = deps(new Set());
  const r = await createWorkItemFromIntake(n.value, d);
  ok(r.ok);
  if (!r.ok) return;
  equal(r.value.workItem.source, WorkItemSource.External);
  equal(r.value.workItem.externalRef, "customer_portal:TICKET-42");
  equal(r.value.workItem.workItemType, WorkItemType.Defect);
  equal(r.value.workItem.state, WorkItemState.Created);
  equal(events.filter((e) => e.kind === OrgEventKind.IntakeReceived).length, 1);
});

test("intake is idempotent — the same upstream report does not create a duplicate", async () => {
  const n = normalizeIntake(raw());
  ok(n.ok);
  if (!n.ok) return;
  const { deps: d } = deps(new Set(["customer_portal:TICKET-42"])); // already seen
  const r = await createWorkItemFromIntake(n.value, d);
  equal(r.ok, false);
  if (!r.ok) equal(r.feedback.reason, "duplicate");
});

test("triage advances the ingested item created → ready (into the backlog) with a transition trace", async () => {
  const n = normalizeIntake(raw());
  ok(n.ok);
  if (!n.ok) return;
  const { deps: d, events } = deps(new Set());
  const created = await createWorkItemFromIntake(n.value, d);
  ok(created.ok);
  if (!created.ok) return;
  const ready = await triageIntake(created.value.workItem, d);
  equal(ready.state, WorkItemState.Ready);
  // created→intake, intake→triage, triage→ready = 3 transitions
  equal(events.filter((e) => e.kind === OrgEventKind.WorkItemTransition).length, 3);
});
