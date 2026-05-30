/**
 * Cockroach-backed keep-alive action sink.
 *
 * Routes each deterministic engine action to durable control-plane state:
 *   - EmitHeartbeat       -> tick the org heartbeat row (the org proves life)
 *   - RaiseOrgStallAlert  -> append an org-stall alert
 *   - ReassignStaleWork   -> append a stale-work-reassignment alert
 *   - ReapLease           -> append a lease-reap alert
 *
 * The switch is exhaustive over KeepAliveActionKind (repo rule: IMPLICIT-NOT-
 * EXPLICIT is a class error). An unhandled kind is a programmer error and
 * throws — it can only happen if a new action kind is added without updating
 * this sink, and the compiler's `never` check catches that at build time.
 */

import { KeepAliveActionKind, type KeepAliveAction } from "../../keepalive/src/index.ts";
import {
  ControlPlaneAlertKind,
  type CockroachControlPlaneStateStore,
} from "./cockroach-control-plane-state-store.ts";

export type KeepAliveActionSink = {
  applyAction: (action: KeepAliveAction) => Promise<void>;
};

export type CreateCockroachKeepAliveActionSinkInput = {
  store: CockroachControlPlaneStateStore;
  organizationId: string;
  /** mint a unique id for each appended alert (production: crypto.randomUUID). */
  generateAlertId: () => string;
};

export function createCockroachKeepAliveActionSink(
  input: CreateCockroachKeepAliveActionSinkInput,
): KeepAliveActionSink {
  return {
    applyAction: async (action: KeepAliveAction): Promise<void> => {
      switch (action.kind) {
        case KeepAliveActionKind.EmitHeartbeat:
          await input.store.tickOrgHeartbeat(input.organizationId);
          return;
        case KeepAliveActionKind.RaiseOrgStallAlert:
          await input.store.appendAlert({
            alertId: input.generateAlertId(),
            organizationId: input.organizationId,
            kind: ControlPlaneAlertKind.OrgStall,
            detail: { ageMs: action.ageMs, deadlineMs: action.deadlineMs },
          });
          return;
        case KeepAliveActionKind.ReassignStaleWork:
          await input.store.appendAlert({
            alertId: input.generateAlertId(),
            organizationId: input.organizationId,
            kind: ControlPlaneAlertKind.StaleWorkReassignment,
            detail: {
              staleAgentId: action.staleAgentId,
              hatAssignmentId: action.hatAssignmentId,
              workItemId: action.workItemId,
              heartbeatAgeMs: action.heartbeatAgeMs,
            },
          });
          return;
        case KeepAliveActionKind.ReapLease:
          await input.store.appendAlert({
            alertId: input.generateAlertId(),
            organizationId: input.organizationId,
            kind: ControlPlaneAlertKind.LeaseReap,
            detail: {
              leaseId: action.leaseId,
              resource: action.resource,
              holderAgentId: action.holderAgentId,
              fencingToken: action.fencingToken,
            },
          });
          return;
        default: {
          // compile-time exhaustiveness: if a new action kind is added without a
          // case above, `action` is no longer `never` here and this line errors.
          const unhandled: never = action;
          throw new Error(`unhandled keep-alive action kind: ${(unhandled as { kind: string }).kind}`);
        }
      }
    },
  };
}
