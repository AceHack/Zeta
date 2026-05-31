import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { HatBindingPhase, OrgEventKind, type HatBinding, type OrgEvent } from "../../domain/src/index.ts";
import { RecordingTelemetry } from "../../observability/src/index.ts";
import { createCockroachOrgEventStore } from "../src/cockroach-org-event-store.ts";
import { createCockroachHatBindingStore } from "../src/cockroach-hat-binding-store.ts";
import type { CockroachGenericSqlExecutor } from "../src/cockroach-sql-executor.ts";

/** An in-memory fake of the SQL executor: records INSERT/UPSERT rows, answers SELECTs. */
function fakeExecutor(): {
  executor: CockroachGenericSqlExecutor;
  orgEvents: Record<string, unknown>[];
  statements: { name: string; sql: string; parameters: readonly unknown[] }[];
} {
  const orgEvents: Record<string, unknown>[] = [];
  const bindings = new Map<string, Record<string, unknown>>();
  const statements: { name: string; sql: string; parameters: readonly unknown[] }[] = [];

  const execute = async <Row = Record<string, unknown>>(s: { name: string; sql: string; parameters: readonly unknown[] }): Promise<{ rows: readonly Row[] }> => {
    statements.push(s);
    const p = s.parameters;
    if (s.name === "append_org_event") {
      orgEvents.push({
        org_event_id: p[0], kind: p[1], organization_id: p[2], actor_hat_id: p[3], actor_agent_id: p[4], department_id: p[5],
        subject_id: p[6], from_state: p[7], to_state: p[8], transition_context: p[9], decision: p[10], supervisor_chain: p[11], evidence_refs: p[12],
        correlation_id: p[13], causation_id: p[14], trace_id: p[15], occurred_at: p[16],
      });
      return { rows: [] };
    }
    if (s.name === "list_org_events_by_org") {
      return { rows: orgEvents.filter((e) => e.organization_id === p[0]) as Row[] };
    }
    if (s.name === "list_org_events_by_subject") {
      return { rows: orgEvents.filter((e) => e.subject_id === p[0]) as Row[] };
    }
    if (s.name === "upsert_hat_binding") {
      bindings.set(String(p[0]), {
        binding_id: p[0], hat_id: p[1], organization_id: p[2], wearer_agent_id: p[3], phase: p[4],
        bound_at: p[5], warmup_ends_at: p[6], expires_at: p[7], activated_at: p[8], ended_at: p[9], cooldown_until: p[10], reason: p[11],
      });
      return { rows: [] };
    }
    if (s.name === "list_active_hat_bindings") {
      const nonTerminal = new Set<string>([HatBindingPhase.Pending, HatBindingPhase.Warmup, HatBindingPhase.Active, HatBindingPhase.Probation]);
      return { rows: [...bindings.values()].filter((b) => b.organization_id === p[0] && nonTerminal.has(String(b.phase))) as Row[] };
    }
    if (s.name === "list_all_hat_bindings") {
      return { rows: [...bindings.values()].filter((b) => b.organization_id === p[0]) as Row[] };
    }
    return { rows: [] };
  };

  return { executor: { execute, executeTransaction: async (op) => op({ execute }) } as CockroachGenericSqlExecutor, orgEvents, statements };
}

function sampleEvent(): OrgEvent {
  return {
    id: "evt-1", kind: OrgEventKind.PriorityDecision, occurredAt: "2026-05-30T09:00:00.000Z", organizationId: "org-1",
    actorHatId: "engineering_director", departmentId: "engineering", subjectId: "wi-1", toState: "high",
    transitionContext: { kind: "document_lifecycle", loadBearing: false },
    decision: "director set wi-1 to high", supervisorChain: ["executive_board_member", "cto", "engineering_director"],
    evidenceRefs: ["evidence-A"], correlationId: "c", causationId: "c", traceId: "t",
  };
}

test("org events round-trip with JSONB supervisor chain + evidence preserved", async () => {
  const { executor } = fakeExecutor();
  const store = createCockroachOrgEventStore({ executor });
  await store.append(sampleEvent());

  const byOrg = await store.listByOrganization("org-1", 10);
  equal(byOrg.length, 1);
  equal(byOrg[0]?.actorHatId, "engineering_director");
  equal(byOrg[0]?.decision, "director set wi-1 to high");
  equal(byOrg[0]?.transitionContext?.kind, "document_lifecycle");
  if (byOrg[0]?.transitionContext?.kind === "document_lifecycle") {
    equal(byOrg[0].transitionContext.loadBearing, false);
  }
  // supervisor chain (JSONB) survives the round trip
  equal(byOrg[0]?.supervisorChain.join(","), "executive_board_member,cto,engineering_director");
  equal(byOrg[0]?.evidenceRefs[0], "evidence-A");

  const bySubject = await store.listBySubject("wi-1", 10);
  equal(bySubject.length, 1);
});

test("org events preserve reputation observation transition context for durable replay", async () => {
  const { executor } = fakeExecutor();
  const store = createCockroachOrgEventStore({ executor });
  await store.append({
    id: "evt-reputation-1",
    kind: OrgEventKind.ReputationOutcomeObserved,
    occurredAt: "2026-05-31T12:00:00.000Z",
    organizationId: "org-1",
    actorHatId: "backend_implementer",
    actorAgentId: "agent-1",
    subjectId: "agent-1:backend_implementer:code_change:quality",
    transitionContext: {
      kind: "reputation_observation",
      agentId: "agent-1",
      hatId: "backend_implementer",
      workType: "code_change",
      outcomeClass: "quality",
      observedAt: "2026-05-31T12:00:00.000Z",
      signal: { kind: "binary", success: true },
      evidenceRef: "evidence:agent-1:quality-pass",
    },
    decision: "reputation outcome observed",
    supervisorChain: ["rmo_office", "backend_implementer"],
    evidenceRefs: ["reputation:quality:success", "evidence:agent-1:quality-pass"],
    correlationId: "corr-1",
    causationId: "cause-1",
    traceId: "trace-1",
  });

  const byOrg = await store.listByOrganization("org-1", 10);
  equal(byOrg[0]?.transitionContext?.kind, "reputation_observation");
  if (byOrg[0]?.transitionContext?.kind === "reputation_observation") {
    equal(byOrg[0].transitionContext.signal.kind, "binary");
    equal(byOrg[0].transitionContext.evidenceRef, "evidence:agent-1:quality-pass");
  }
});

test("the SQL casts the JSONB columns (no string-into-JSONB error)", async () => {
  const { executor, statements } = fakeExecutor();
  const store = createCockroachOrgEventStore({ executor });
  await store.append(sampleEvent());
  const insert = statements.find((s) => s.name === "append_org_event")!;
  ok(insert.sql.includes("$10::JSONB"));
  ok(insert.sql.includes("$12::JSONB"));
  ok(insert.sql.includes("$13::JSONB"));
});

test("malformed persisted org_event transition context is ignored", async () => {
  const { executor, orgEvents } = fakeExecutor();
  orgEvents.push({
    org_event_id: "evt-malformed",
    kind: OrgEventKind.DocLifecycleTransition,
    organization_id: "org-1",
    actor_hat_id: null,
    actor_agent_id: null,
    department_id: null,
    subject_id: "doc-1",
    from_state: "draft",
    to_state: "active",
    transition_context: { kind: "document_lifecycle" },
    decision: "malformed persisted context",
    supervisor_chain: "[]",
    evidence_refs: "[]",
    correlation_id: "c",
    causation_id: "c",
    trace_id: "t",
    occurred_at: "2026-05-30T09:00:00.000Z",
  });

  const store = createCockroachOrgEventStore({ executor });
  const byOrg = await store.listByOrganization("org-1", 10);
  equal(byOrg.length, 1);
  equal(byOrg[0]?.transitionContext, undefined);
});

test("append projects org_event evidence into telemetry", async () => {
  const { executor } = fakeExecutor();
  const telemetry = new RecordingTelemetry();
  const store = createCockroachOrgEventStore({ executor, telemetry });

  await store.append(sampleEvent());

  equal(telemetry.spans.length, 1);
  equal(telemetry.spans[0]?.name, "org.org_event.append");
  equal(telemetry.spans[0]?.attributes["agentic.org_event.id"], "evt-1");
  equal(telemetry.logs[0]?.attributes?.["agentic.org_event.id"], "evt-1");
  equal(telemetry.metrics[0]?.name, "org_events_total");
});

test("org_event append runs the fail-closed side-effect guard before SQL or telemetry", async () => {
  const { executor, orgEvents } = fakeExecutor();
  const telemetry = new RecordingTelemetry();
  const store = createCockroachOrgEventStore({
    executor,
    telemetry,
    beforeAppend: async () => {
      throw new Error("control-plane denied org_event append");
    },
  });

  await store.append(sampleEvent()).then(
    () => {
      throw new Error("expected append guard to reject");
    },
    (error: unknown) =>
      equal(error instanceof Error ? error.message : String(error), "control-plane denied org_event append"),
  );

  equal(orgEvents.length, 0);
  equal(telemetry.spans.length, 0);
});

test("hat bindings upsert and list-active excludes terminal phases", async () => {
  const { executor } = fakeExecutor();
  const store = createCockroachHatBindingStore({ executor });
  const base: HatBinding = {
    id: "b-1", hatId: "backend_implementer", organizationId: "org-1", wearerAgentId: "agent-A",
    phase: HatBindingPhase.Active, boundAt: "2026-05-30T09:00:00.000Z", warmupEndsAt: "2026-05-30T09:00:05.000Z", expiresAt: "2026-05-30T09:02:00.000Z",
  };
  await store.upsert(base);
  await store.upsert({ ...base, id: "b-2", phase: HatBindingPhase.Expired, endedAt: "2026-05-30T09:02:00.000Z", cooldownUntil: "2026-05-30T09:02:20.000Z" });

  const active = await store.listActive("org-1");
  equal(active.length, 1); // expired excluded
  equal(active[0]?.id, "b-1");

  const all = await store.listAll("org-1");
  equal(all.length, 2);
  // the cooldown timestamp survives on the expired binding
  ok(all.find((b) => b.id === "b-2")?.cooldownUntil !== undefined);
});

test("upsert transitions a binding's phase in place", async () => {
  const { executor } = fakeExecutor();
  const store = createCockroachHatBindingStore({ executor });
  const b: HatBinding = {
    id: "b-1", hatId: "ceo", organizationId: "org-1", wearerAgentId: "agent-A",
    phase: HatBindingPhase.Warmup, boundAt: "2026-05-30T09:00:00.000Z", warmupEndsAt: "2026-05-30T09:00:15.000Z", expiresAt: "2026-05-30T09:06:00.000Z",
  };
  await store.upsert(b);
  await store.upsert({ ...b, phase: HatBindingPhase.Active, activatedAt: "2026-05-30T09:00:15.000Z" });
  const all = await store.listAll("org-1");
  equal(all.length, 1); // same binding, updated in place
  equal(all[0]?.phase, HatBindingPhase.Active);
});
