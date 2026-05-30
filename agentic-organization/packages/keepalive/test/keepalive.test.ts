import { deepEqual, equal } from "node:assert/strict";
import { test } from "node:test";
import {
  AgentLiveness,
  KeepAliveActionKind,
  OrgLiveness,
  evaluateKeepAlive,
  type AgentHeartbeat,
  type KeepAliveSnapshot,
  type RuntimeLease,
} from "../src/keepalive.ts";

// fixed "now" in epoch ms for deterministic freshness math
const NOW = 1_000_000;

function snapshot(overrides: Partial<KeepAliveSnapshot> = {}): KeepAliveSnapshot {
  return {
    nowMs: NOW,
    orgHeartbeatAgeMs: 0,
    orgHeartbeatDeadlineMs: 30_000,
    agents: [],
    leases: [],
    ...overrides,
  };
}

function agent(id: string, ageMs: number): AgentHeartbeat {
  return { agentId: id, hatAssignmentId: `${id}-hat`, workItemId: `wi-${id}`, heartbeatAgeMs: ageMs, deadlineMs: 60_000 };
}

function lease(id: string, expiresInMs: number): RuntimeLease {
  return { leaseId: id, resource: `res-${id}`, holderAgentId: "a", expiresAtMs: NOW + expiresInMs, fencingToken: 1 };
}

test("org is alive when the control-plane heartbeat is within its deadline", () => {
  const result = evaluateKeepAlive(snapshot({ orgHeartbeatAgeMs: 10_000, orgHeartbeatDeadlineMs: 30_000 }));
  equal(result.orgLiveness, OrgLiveness.Alive);
  // a heartbeat tick is ALWAYS emitted — the org must keep proving it is alive
  equal(result.actions.some((a) => a.kind === KeepAliveActionKind.EmitHeartbeat), true);
});

test("org is flatlining when the heartbeat is past its deadline (deterministic detection)", () => {
  const result = evaluateKeepAlive(snapshot({ orgHeartbeatAgeMs: 45_000, orgHeartbeatDeadlineMs: 30_000 }));
  equal(result.orgLiveness, OrgLiveness.Flatlining);
  // a flatlining org raises a deterministic self-heal action
  equal(result.actions.some((a) => a.kind === KeepAliveActionKind.RaiseOrgStallAlert), true);
});

test("a fresh agent is alive and produces no nudge", () => {
  const result = evaluateKeepAlive(snapshot({ agents: [agent("a1", 5_000)] }));
  const a1 = result.agentLiveness.find((x) => x.agentId === "a1");
  equal(a1?.liveness, AgentLiveness.Alive);
  equal(result.actions.some((a) => a.kind === KeepAliveActionKind.ReassignStaleWork), false);
});

test("a stale agent is detected deterministically and its work is flagged for reassignment", () => {
  const result = evaluateKeepAlive(snapshot({ agents: [agent("a2", 90_000)] }));
  const a2 = result.agentLiveness.find((x) => x.agentId === "a2");
  equal(a2?.liveness, AgentLiveness.Stale);
  // determinism guarantees the detection; the action converts it to agent-decidable work
  const reassign = result.actions.find((a) => a.kind === KeepAliveActionKind.ReassignStaleWork);
  equal(reassign?.kind, KeepAliveActionKind.ReassignStaleWork);
  if (reassign?.kind !== KeepAliveActionKind.ReassignStaleWork) return;
  equal(reassign.workItemId, "wi-a2");
  equal(reassign.staleAgentId, "a2");
});

test("expired leases are reaped (frees the resource for a live holder)", () => {
  const result = evaluateKeepAlive(snapshot({ leases: [lease("l1", -1_000), lease("l2", 10_000)] }));
  const reaped = result.actions.filter((a) => a.kind === KeepAliveActionKind.ReapLease);
  equal(reaped.length, 1);
  if (reaped[0]?.kind !== KeepAliveActionKind.ReapLease) return;
  equal(reaped[0].leaseId, "l1");
});

test("a quiet but live org with no agents still ticks (keep-alive never silently stops)", () => {
  const result = evaluateKeepAlive(snapshot());
  equal(result.orgLiveness, OrgLiveness.Alive);
  // even idle, the heartbeat tick is emitted — motion is guaranteed
  deepEqual(
    result.actions.map((a) => a.kind),
    [KeepAliveActionKind.EmitHeartbeat],
  );
});

test("multiple stale agents each get their own reassignment action (no collapse)", () => {
  const result = evaluateKeepAlive(snapshot({ agents: [agent("a3", 90_000), agent("a4", 120_000), agent("a5", 1_000)] }));
  const reassigns = result.actions.filter((a) => a.kind === KeepAliveActionKind.ReassignStaleWork);
  equal(reassigns.length, 2);
});

test("BOUNDARY: an entity exactly AT its deadline is still alive (> not >=)", () => {
  // org at exactly deadline -> Alive
  const org = evaluateKeepAlive(snapshot({ orgHeartbeatAgeMs: 30_000, orgHeartbeatDeadlineMs: 30_000 }));
  equal(org.orgLiveness, OrgLiveness.Alive);
  // agent at exactly deadline -> Alive
  const ag = evaluateKeepAlive(snapshot({ agents: [{ agentId: "b1", hatAssignmentId: "b1-hat", workItemId: "wi-b1", heartbeatAgeMs: 60_000, deadlineMs: 60_000 }] }));
  equal(ag.agentLiveness.find((x) => x.agentId === "b1")?.liveness, AgentLiveness.Alive);
});

test("BOUNDARY: a lease expiring exactly now is reaped (<= not <)", () => {
  const result = evaluateKeepAlive(snapshot({ leases: [lease("l0", 0)] }));
  const reaped = result.actions.filter((a) => a.kind === KeepAliveActionKind.ReapLease);
  equal(reaped.length, 1);
});
