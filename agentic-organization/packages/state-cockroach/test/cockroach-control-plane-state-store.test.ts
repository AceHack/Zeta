import { deepEqual, equal } from "node:assert/strict";
import { describe, test } from "node:test";

import {
  ControlPlaneAlertKind,
  ControlPlaneFlagKind,
  ControlPlaneRateLimitKind,
  ControlPlaneScopeKind,
  createCockroachControlPlaneStateStore,
  type CockroachAnySqlStatement,
  type CockroachGenericSqlExecutor,
} from "../src/index.ts";

describe("cockroach control-plane state store (the org's durable proof of life)", () => {
  test("reads the org heartbeat age in milliseconds", async () => {
    const executor = createRecordingSqlExecutor([{ age_ms: 1500 }]);
    const store = createCockroachControlPlaneStateStore({ executor });

    const ageMs = await store.readOrgHeartbeatAgeMs("org-1");

    equal(ageMs, 1500);
    equal(executor.statements[0]?.parameters[0], "org-1");
    equal(executor.statements[0]?.sql.includes("agentic_org_control_plane_heartbeat"), true);
  });

  test("returns undefined when the org has never ticked (no heartbeat row yet)", async () => {
    const executor = createRecordingSqlExecutor([]);
    const store = createCockroachControlPlaneStateStore({ executor });

    const ageMs = await store.readOrgHeartbeatAgeMs("org-1");

    equal(ageMs, undefined);
  });

  test("ticks the org heartbeat with an UPSERT that advances last_tick_at and version", async () => {
    const executor = createRecordingSqlExecutor([]);
    const store = createCockroachControlPlaneStateStore({ executor });

    await store.tickOrgHeartbeat("org-1");

    const statement = executor.statements[0];
    equal(statement?.parameters[0], "org-1");
    equal(statement?.sql.includes("INSERT INTO agentic_org_control_plane_heartbeat"), true);
    equal(statement?.sql.includes("ON CONFLICT (organization_id) DO UPDATE"), true);
    equal(statement?.sql.includes("last_tick_at = now()"), true);
    equal(statement?.sql.includes("version = agentic_org_control_plane_heartbeat.version + 1"), true);
  });

  test("appends a control-plane alert as an immutable row with JSON detail", async () => {
    const executor = createRecordingSqlExecutor([]);
    const store = createCockroachControlPlaneStateStore({ executor });

    await store.appendAlert({
      alertId: "alert-1",
      organizationId: "org-1",
      kind: ControlPlaneAlertKind.OrgStall,
      detail: { ageMs: 9000, deadlineMs: 5000 },
    });

    const statement = executor.statements[0];
    equal(statement?.sql.includes("INSERT INTO agentic_org_control_plane_alerts"), true);
    deepEqual(statement?.parameters, [
      "alert-1",
      "org-1",
      ControlPlaneAlertKind.OrgStall,
      JSON.stringify({ ageMs: 9000, deadlineMs: 5000 }),
    ]);
  });

  test("records an agent heartbeat with an UPSERT that advances last_heartbeat_at and version", async () => {
    const executor = createRecordingSqlExecutor([]);
    const store = createCockroachControlPlaneStateStore({ executor });

    await store.recordAgentHeartbeat({
      organizationId: "org-1",
      agentId: "agent-7",
      hatAssignmentId: "hat-3",
      workItemId: "work-9",
      deadlineMs: 8000,
    });

    const statement = executor.statements[0];
    equal(statement?.sql.includes("INSERT INTO agentic_org_agent_heartbeat"), true);
    equal(statement?.sql.includes("ON CONFLICT (organization_id, agent_id) DO UPDATE"), true);
    equal(statement?.sql.includes("last_heartbeat_at = now()"), true);
    equal(statement?.sql.includes("version = agentic_org_agent_heartbeat.version + 1"), true);
    deepEqual(statement?.parameters, ["org-1", "agent-7", "hat-3", "work-9", 8000]);
  });

  test("reads agent heartbeats with DB-clock age, mapped to the engine's shape", async () => {
    const executor = createRecordingSqlExecutor([
      { agent_id: "agent-7", hat_assignment_id: "hat-3", work_item_id: "work-9", age_ms: 1200, deadline_ms: 8000 },
      { agent_id: "agent-8", hat_assignment_id: "hat-4", work_item_id: "work-10", age_ms: 9999, deadline_ms: 8000 },
    ]);
    const store = createCockroachControlPlaneStateStore({ executor });

    const agents = await store.readAgentHeartbeats("org-1");

    equal(executor.statements[0]?.parameters[0], "org-1");
    equal(executor.statements[0]?.sql.includes("agentic_org_agent_heartbeat"), true);
    deepEqual(agents, [
      { agentId: "agent-7", hatAssignmentId: "hat-3", workItemId: "work-9", heartbeatAgeMs: 1200, deadlineMs: 8000 },
      { agentId: "agent-8", hatAssignmentId: "hat-4", workItemId: "work-10", heartbeatAgeMs: 9999, deadlineMs: 8000 },
    ]);
  });

  test("upserts a control-plane flag with a flattened scope and optional expiry", async () => {
    const executor = createRecordingSqlExecutor([]);
    const store = createCockroachControlPlaneStateStore({ executor });

    await store.upsertFlag({
      controlPlaneFlagId: "flag-1",
      organizationId: "org-1",
      scope: { kind: ControlPlaneScopeKind.Tenant, tenantId: "tenant-1" },
      flag: ControlPlaneFlagKind.Freeze,
      reason: "tenant freeze drill",
      setByHatId: "incident_commander",
      setAt: "2026-05-31T20:00:00.000Z",
      expiresAt: "2026-05-31T21:00:00.000Z",
    });

    const statement = executor.statements[0];
    equal(statement?.sql.includes("INSERT INTO agentic_org_control_plane_flags"), true);
    equal(statement?.sql.includes("ON CONFLICT (organization_id, control_plane_flag_id) DO UPDATE"), true);
    deepEqual(statement?.parameters, [
      "flag-1",
      "org-1",
      ControlPlaneScopeKind.Tenant,
      "tenant-1",
      ControlPlaneFlagKind.Freeze,
      "tenant freeze drill",
      "incident_commander",
      "2026-05-31T20:00:00.000Z",
      "2026-05-31T21:00:00.000Z",
    ]);
  });

  test("lists active control-plane flags and rehydrates typed scopes", async () => {
    const executor = createRecordingSqlExecutor([
      {
        control_plane_flag_id: "flag-estop",
        organization_id: "org-1",
        scope_kind: ControlPlaneScopeKind.Organization,
        scope_id: null,
        flag: ControlPlaneFlagKind.Estop,
        reason: "operator estop",
        set_by_hat_id: "incident_commander",
        set_at: new Date("2026-05-31T20:00:00.000Z"),
        expires_at: null,
      },
      {
        control_plane_flag_id: "flag-provider",
        organization_id: "org-1",
        scope_kind: ControlPlaneScopeKind.Provider,
        scope_id: "github",
        flag: ControlPlaneFlagKind.ProviderFreeze,
        reason: "github incident",
        set_by_hat_id: "incident_commander",
        set_at: "2026-05-31T20:01:00.000Z",
        expires_at: "2026-05-31T21:01:00.000Z",
      },
    ]);
    const store = createCockroachControlPlaneStateStore({ executor });

    const flags = await store.listActiveFlags("org-1", "2026-05-31T20:30:00.000Z");

    equal(executor.statements[0]?.sql.includes("expires_at IS NULL OR expires_at > $2"), true);
    deepEqual(executor.statements[0]?.parameters, ["org-1", "2026-05-31T20:30:00.000Z"]);
    deepEqual(flags, [
      {
        controlPlaneFlagId: "flag-estop",
        organizationId: "org-1",
        scope: { kind: ControlPlaneScopeKind.Organization },
        flag: ControlPlaneFlagKind.Estop,
        reason: "operator estop",
        setByHatId: "incident_commander",
        setAt: "2026-05-31T20:00:00.000Z",
      },
      {
        controlPlaneFlagId: "flag-provider",
        organizationId: "org-1",
        scope: { kind: ControlPlaneScopeKind.Provider, providerId: "github" },
        flag: ControlPlaneFlagKind.ProviderFreeze,
        reason: "github incident",
        setByHatId: "incident_commander",
        setAt: "2026-05-31T20:01:00.000Z",
        expiresAt: "2026-05-31T21:01:00.000Z",
      },
    ]);
  });

  test("rejects malformed persisted control-plane flag enums instead of widening them", async () => {
    const executor = createRecordingSqlExecutor([
      {
        control_plane_flag_id: "flag-bad",
        organization_id: "org-1",
        scope_kind: "bad_scope",
        scope_id: "github",
        flag: ControlPlaneFlagKind.ProviderFreeze,
        reason: "bad persisted row",
        set_by_hat_id: "incident_commander",
        set_at: "2026-05-31T20:00:00.000Z",
        expires_at: null,
      },
    ]);
    const store = createCockroachControlPlaneStateStore({ executor });

    await store.listActiveFlags("org-1", "2026-05-31T20:30:00.000Z").then(
      () => { throw new Error("expected malformed persisted flag to reject"); },
      (error: unknown) =>
        equal(error instanceof Error ? error.message : String(error), "unknown control-plane flag scope_kind 'bad_scope'"),
    );
  });

  test("upserts a control-plane rate limit with windowed scope and usage counts", async () => {
    const executor = createRecordingSqlExecutor([]);
    const store = createCockroachControlPlaneStateStore({ executor });

    await store.upsertRateLimit({
      rateLimitId: "rate-limit-1",
      organizationId: "org-1",
      scope: { kind: ControlPlaneScopeKind.Tenant, tenantId: "tenant-1" },
      kind: ControlPlaneRateLimitKind.ExternalProviderCalls,
      window: {
        startedAt: "2026-05-31T20:00:00.000Z",
        endsAt: "2026-05-31T21:00:00.000Z",
      },
      limit: 100,
      used: 42,
      requested: 3,
    });

    const statement = executor.statements[0];
    equal(statement?.sql.includes("INSERT INTO agentic_org_control_plane_rate_limits"), true);
    equal(statement?.sql.includes("ON CONFLICT (organization_id, control_plane_rate_limit_id) DO UPDATE"), true);
    deepEqual(statement?.parameters, [
      "rate-limit-1",
      "org-1",
      ControlPlaneScopeKind.Tenant,
      "tenant-1",
      ControlPlaneRateLimitKind.ExternalProviderCalls,
      "2026-05-31T20:00:00.000Z",
      "2026-05-31T21:00:00.000Z",
      100,
      42,
      3,
    ]);
  });

  test("lists active control-plane rate limits and rehydrates typed windows", async () => {
    const executor = createRecordingSqlExecutor([
      {
        control_plane_rate_limit_id: "rate-limit-tools",
        organization_id: "org-1",
        scope_kind: ControlPlaneScopeKind.Organization,
        scope_id: null,
        kind: ControlPlaneRateLimitKind.Tools,
        window_started_at: new Date("2026-05-31T20:00:00.000Z"),
        window_ends_at: new Date("2026-05-31T21:00:00.000Z"),
        limit_count: 100,
        used_count: 10,
        requested_count: null,
      },
      {
        control_plane_rate_limit_id: "rate-limit-model",
        organization_id: "org-1",
        scope_kind: ControlPlaneScopeKind.Tenant,
        scope_id: "tenant-1",
        kind: ControlPlaneRateLimitKind.ModelCalls,
        window_started_at: "2026-05-31T20:15:00.000Z",
        window_ends_at: "2026-05-31T20:45:00.000Z",
        limit_count: "20",
        used_count: "19",
        requested_count: "2",
      },
    ]);
    const store = createCockroachControlPlaneStateStore({ executor });

    const limits = await store.listActiveRateLimits("org-1", "2026-05-31T20:30:00.000Z");

    equal(executor.statements[0]?.sql.includes("window_started_at <= $2"), true);
    equal(executor.statements[0]?.sql.includes("window_ends_at > $2"), true);
    deepEqual(executor.statements[0]?.parameters, ["org-1", "2026-05-31T20:30:00.000Z"]);
    deepEqual(limits, [
      {
        rateLimitId: "rate-limit-tools",
        organizationId: "org-1",
        scope: { kind: ControlPlaneScopeKind.Organization },
        kind: ControlPlaneRateLimitKind.Tools,
        window: {
          startedAt: "2026-05-31T20:00:00.000Z",
          endsAt: "2026-05-31T21:00:00.000Z",
        },
        limit: 100,
        used: 10,
      },
      {
        rateLimitId: "rate-limit-model",
        organizationId: "org-1",
        scope: { kind: ControlPlaneScopeKind.Tenant, tenantId: "tenant-1" },
        kind: ControlPlaneRateLimitKind.ModelCalls,
        window: {
          startedAt: "2026-05-31T20:15:00.000Z",
          endsAt: "2026-05-31T20:45:00.000Z",
        },
        limit: 20,
        used: 19,
        requested: 2,
      },
    ]);
  });
});

function createRecordingSqlExecutor(rows: readonly Record<string, unknown>[]): CockroachGenericSqlExecutor & {
  statements: CockroachAnySqlStatement[];
} {
  const statements: CockroachAnySqlStatement[] = [];

  return {
    statements,
    execute: async <Row = Record<string, unknown>>(statement: CockroachAnySqlStatement) => {
      statements.push(statement);
      return { rows: rows as readonly Row[] };
    },
    executeTransaction: async (operation) =>
      await operation({
        execute: async <Row = Record<string, unknown>>(statement: CockroachAnySqlStatement) => {
          statements.push(statement);
          return { rows: rows as readonly Row[] };
        },
      }),
  };
}
