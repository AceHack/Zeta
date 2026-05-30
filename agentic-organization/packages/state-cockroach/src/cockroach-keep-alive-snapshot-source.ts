/**
 * Cockroach-backed keep-alive snapshot source.
 *
 * Loads the org's liveness facts into the pure engine's KeepAliveSnapshot:
 *   - org heartbeat age (control-plane store; DB-clock)
 *   - agent heartbeats (agent-liveness store; DB-clock) — stale agents drive
 *     deterministic reassignment signals
 *   - org-heartbeat deadline (config); clock (for lease expiry)
 *
 * leases[] remains empty until runtime resource leases are persisted; the engine
 * handles an empty lease set. ORG liveness and AGENT liveness — both halves of
 * tenet #1 — are real here.
 */

import type { KeepAliveSnapshot, KeepAliveSnapshotSource } from "../../keepalive/src/index.ts";
import type { CockroachControlPlaneStateStore } from "./cockroach-control-plane-state-store.ts";

export type KeepAliveClock = {
  /** current epoch ms */
  now: () => number;
};

export type CreateCockroachKeepAliveSnapshotSourceInput = {
  store: CockroachControlPlaneStateStore;
  organizationId: string;
  orgHeartbeatDeadlineMs: number;
  clock: KeepAliveClock;
};

export function createCockroachKeepAliveSnapshotSource(
  input: CreateCockroachKeepAliveSnapshotSourceInput,
): KeepAliveSnapshotSource {
  return {
    loadSnapshot: async (): Promise<KeepAliveSnapshot> => {
      const ageMs = await input.store.readOrgHeartbeatAgeMs(input.organizationId);
      const agents = await input.store.readAgentHeartbeats(input.organizationId);

      return {
        nowMs: input.clock.now(),
        // a never-ticked org is age 0 (just born, alive) — the first tick's
        // EmitHeartbeat action will register the row
        orgHeartbeatAgeMs: ageMs ?? 0,
        orgHeartbeatDeadlineMs: input.orgHeartbeatDeadlineMs,
        agents,
        leases: [],
      };
    },
  };
}
