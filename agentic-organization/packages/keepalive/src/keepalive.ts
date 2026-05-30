/**
 * Deterministic keep-alive engine — the operator's #1 tenet.
 *
 * "Enough determinism to drive the organization to stay alive and drive the
 * agents to stay alive, with sufficient autonomy from the agents themselves."
 *
 * This is the DETERMINISTIC CONTROL PLANE. evaluateKeepAlive is a pure function
 * over a snapshot of liveness facts. It guarantees motion: every tick emits a
 * heartbeat (the org keeps proving it is alive), deterministically detects a
 * flatlining org, stale agents, and expired leases, and converts each into an
 * explicit keep-alive action. It NEVER decides WHAT work to do — that is the
 * autonomous data plane (Hermes agents selecting legal options via observe.ts).
 * It only guarantees the org and its agents keep moving and that a silent agent
 * is detected and its work re-routed.
 *
 * Pure + port-free: no clock, no I/O. The host calls it on a cadence with a
 * fresh snapshot and applies the returned actions through the command pipeline.
 * Every distinct liveness state and action is an explicit DU (repo rule:
 * IMPLICIT-NOT-EXPLICIT is class error).
 */

export const OrgLiveness = {
  /** control-plane heartbeat is within its deadline */
  Alive: "alive",
  /** control-plane heartbeat is past its deadline — the org stopped proving life */
  Flatlining: "flatlining",
} as const;
export type OrgLiveness = (typeof OrgLiveness)[keyof typeof OrgLiveness];

export const AgentLiveness = {
  Alive: "alive",
  Stale: "stale",
} as const;
export type AgentLiveness = (typeof AgentLiveness)[keyof typeof AgentLiveness];

/** One agent session's heartbeat fact. */
export type AgentHeartbeat = {
  agentId: string;
  hatAssignmentId: string;
  workItemId: string;
  /** ms since the agent last proved liveness */
  heartbeatAgeMs: number;
  /** max ms before the agent is considered stale */
  deadlineMs: number;
};

/** A runtime lease guarding a resource with a fencing token. */
export type RuntimeLease = {
  leaseId: string;
  resource: string;
  holderAgentId: string;
  /** epoch ms at which the lease expires */
  expiresAtMs: number;
  fencingToken: number;
};

/** The liveness snapshot the host loads and hands to the pure evaluator. */
export type KeepAliveSnapshot = {
  /** current epoch ms */
  nowMs: number;
  /** ms since the control-plane last ticked */
  orgHeartbeatAgeMs: number;
  /** max ms before the org is considered flatlining */
  orgHeartbeatDeadlineMs: number;
  agents: readonly AgentHeartbeat[];
  leases: readonly RuntimeLease[];
};

/** The deterministic actions keep-alive emits to guarantee motion. */
export const KeepAliveActionKind = {
  /** always emitted — the org keeps proving it is alive */
  EmitHeartbeat: "emit_heartbeat",
  /** the org control-plane went silent — raise a self-heal alert */
  RaiseOrgStallAlert: "raise_org_stall_alert",
  /** a stale agent's work is flagged for reassignment (agent-decidable follow-up) */
  ReassignStaleWork: "reassign_stale_work",
  /** an expired lease is reaped, freeing the resource */
  ReapLease: "reap_lease",
} as const;
export type KeepAliveActionKind = (typeof KeepAliveActionKind)[keyof typeof KeepAliveActionKind];

export type KeepAliveAction =
  | { kind: typeof KeepAliveActionKind.EmitHeartbeat; ageMs: number }
  | { kind: typeof KeepAliveActionKind.RaiseOrgStallAlert; ageMs: number; deadlineMs: number }
  | { kind: typeof KeepAliveActionKind.ReassignStaleWork; staleAgentId: string; hatAssignmentId: string; workItemId: string; heartbeatAgeMs: number }
  | { kind: typeof KeepAliveActionKind.ReapLease; leaseId: string; resource: string; holderAgentId: string; fencingToken: number };

export type AgentLivenessResult = {
  agentId: string;
  liveness: AgentLiveness;
};

export type KeepAliveResult = {
  orgLiveness: OrgLiveness;
  agentLiveness: readonly AgentLivenessResult[];
  actions: readonly KeepAliveAction[];
};

/**
 * Evaluate liveness deterministically and emit the keep-alive actions.
 * Order of actions is stable: heartbeat first, then org alert, then per-agent
 * reassignments (in input order), then lease reaps (in input order).
 *
 * Boundary policy (pinned by tests): heartbeat age uses strict `>` — an entity
 * exactly AT its deadline is still Alive (it proved liveness right at the edge).
 * Lease expiry uses `<=` — a lease whose expiry is exactly now IS expired and is
 * reaped. These two boundaries differ on purpose: "age past deadline" is a
 * strict-greater event, "expired at or after now" is at-or-after.
 */
export function evaluateKeepAlive(snapshot: KeepAliveSnapshot): KeepAliveResult {
  const actions: KeepAliveAction[] = [];

  // 1. always tick — motion is guaranteed even when idle
  actions.push({ kind: KeepAliveActionKind.EmitHeartbeat, ageMs: snapshot.orgHeartbeatAgeMs });

  // 2. org liveness
  const orgLiveness =
    snapshot.orgHeartbeatAgeMs > snapshot.orgHeartbeatDeadlineMs ? OrgLiveness.Flatlining : OrgLiveness.Alive;
  if (orgLiveness === OrgLiveness.Flatlining) {
    actions.push({
      kind: KeepAliveActionKind.RaiseOrgStallAlert,
      ageMs: snapshot.orgHeartbeatAgeMs,
      deadlineMs: snapshot.orgHeartbeatDeadlineMs,
    });
  }

  // 3. per-agent liveness — stale agents get a reassignment action each (no collapse)
  const agentLiveness: AgentLivenessResult[] = [];
  for (const agent of snapshot.agents) {
    const stale = agent.heartbeatAgeMs > agent.deadlineMs;
    agentLiveness.push({ agentId: agent.agentId, liveness: stale ? AgentLiveness.Stale : AgentLiveness.Alive });
    if (stale) {
      actions.push({
        kind: KeepAliveActionKind.ReassignStaleWork,
        staleAgentId: agent.agentId,
        hatAssignmentId: agent.hatAssignmentId,
        workItemId: agent.workItemId,
        heartbeatAgeMs: agent.heartbeatAgeMs,
      });
    }
  }

  // 4. expired leases are reaped
  for (const lease of snapshot.leases) {
    if (lease.expiresAtMs <= snapshot.nowMs) {
      actions.push({
        kind: KeepAliveActionKind.ReapLease,
        leaseId: lease.leaseId,
        resource: lease.resource,
        holderAgentId: lease.holderAgentId,
        fencingToken: lease.fencingToken,
      });
    }
  }

  return { orgLiveness, agentLiveness, actions };
}
