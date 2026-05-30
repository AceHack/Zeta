import { equal, ok } from "node:assert/strict";
import { test } from "node:test";

import { HatBindingPhase, OrgEventKind, type HatBinding, type OrgEvent } from "../../domain/src/index.ts";
import { createCockroachOrgEventStore } from "../src/cockroach-org-event-store.ts";
import { createCockroachHatBindingStore } from "../src/cockroach-hat-binding-store.ts";
import type { CockroachGenericSqlExecutor } from "../src/cockroach-sql-executor.ts";

/** An in-memory fake of the SQL executor: records INSERT/UPSERT rows, answers SELECTs. */
function fakeExecutor(): { executor: CockroachGenericSqlExecutor; statements: { name: string; sql: string; parameters: readonly unknown[] }[] } {
  const orgEvents: Record<string, unknown>[] = [];
  const bindings = new Map<string, Record<string, unknown>>();
  const statements: { name: string; sql: string; parameters: readonly unknown[] }[] = [];

  const execute = async <Row = Record<string, unknown>>(s: { name: string; sql: string; parameters: readonly unknown[] }): Promise<{ rows: readonly Row[] }> => {
    statements.push(s);
    const p = s.parameters;
    if (s.name === "append_org_event") {
      orgEvents.push({
        org_event_id: p[0], kind: p[1], organization_id: p[2], actor_hat_id: p[3], actor_agent_id: p[4], department_id: p[5],
        subject_id: p[6], from_state: p[7], to_state: p[8], decision: p[9], supervisor_chain: p[10], evidence_refs: p[11],
        correlation_id: p[12], causation_id: p[13], trace_id: p[14], occurred_at: p[15],
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

  return { executor: { execute, executeTransaction: async (op) => op({ execute }) } as CockroachGenericSqlExecutor, statements };
}

function sampleEvent(): OrgEvent {
  return {
    id: "evt-1", kind: OrgEventKind.PriorityDecision, occurredAt: "2026-05-30T09:00:00.000Z", organizationId: "org-1",
    actorHatId: "engineering_director", departmentId: "engineering", subjectId: "wi-1", toState: "high",
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
  // supervisor chain (JSONB) survives the round trip
  equal(byOrg[0]?.supervisorChain.join(","), "executive_board_member,cto,engineering_director");
  equal(byOrg[0]?.evidenceRefs[0], "evidence-A");

  const bySubject = await store.listBySubject("wi-1", 10);
  equal(bySubject.length, 1);
});

test("the SQL casts the JSONB columns (no string-into-JSONB error)", async () => {
  const { executor, statements } = fakeExecutor();
  const store = createCockroachOrgEventStore({ executor });
  await store.append(sampleEvent());
  const insert = statements.find((s) => s.name === "append_org_event")!;
  ok(insert.sql.includes("$11::JSONB"));
  ok(insert.sql.includes("$12::JSONB"));
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
