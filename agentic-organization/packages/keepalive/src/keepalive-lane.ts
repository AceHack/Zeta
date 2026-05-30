/**
 * Keep-alive lane — the SchedulerWorker shape that turns the pure keep-alive
 * engine into a self-driving control-plane loop.
 *
 * The host calls runOnce() on a cadence (e.g. every few seconds). Each tick:
 *   1. loads a fresh liveness snapshot (from Cockroach via the source port)
 *   2. evaluates it deterministically (evaluateKeepAlive)
 *   3. applies each emitted action through the sink (which routes them through
 *      the command pipeline — heartbeat event, org-stall alert, stale-work
 *      reassignment signal, lease reap)
 *
 * Crucially, NOTHING here throws on a transient failure: a source or sink error
 * is captured as a lane failure and the loop keeps ticking next cadence. The
 * org's heartbeat must not die because one apply failed — that is the whole
 * point of "drive the organization to stay alive". Mirrors the worker-host
 * lane-failure discipline (packages/workers/src/worker-host.ts).
 */

import { OrgLiveness, evaluateKeepAlive, type KeepAliveAction, type KeepAliveSnapshot } from "./keepalive.ts";

export interface KeepAliveSnapshotSource {
  loadSnapshot(): Promise<KeepAliveSnapshot>;
}

export interface KeepAliveActionSink {
  applyAction(action: KeepAliveAction): Promise<void>;
}

export const KeepAliveLaneStatus = {
  /** the tick ran and the org is alive */
  Ticked: "ticked",
  /** the tick ran but something is degraded (org flatlining or an apply failed) */
  Degraded: "degraded",
} as const;
export type KeepAliveLaneStatus = (typeof KeepAliveLaneStatus)[keyof typeof KeepAliveLaneStatus];

export type KeepAliveLaneFailure = { message: string };

export type KeepAliveLaneResult = {
  status: KeepAliveLaneStatus;
  appliedCount: number;
  failures: readonly KeepAliveLaneFailure[];
};

export type KeepAliveLane = {
  runOnce: () => Promise<KeepAliveLaneResult>;
};

export type CreateKeepAliveLaneInput = {
  source: KeepAliveSnapshotSource;
  sink: KeepAliveActionSink;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createKeepAliveLane(input: CreateKeepAliveLaneInput): KeepAliveLane {
  return {
    runOnce: async (): Promise<KeepAliveLaneResult> => {
      const failures: KeepAliveLaneFailure[] = [];

      let snapshot: KeepAliveSnapshot;
      try {
        snapshot = await input.source.loadSnapshot();
      } catch (error) {
        // could not even read liveness — degraded, but the loop survives
        return { status: KeepAliveLaneStatus.Degraded, appliedCount: 0, failures: [{ message: errorMessage(error) }] };
      }

      const evaluation = evaluateKeepAlive(snapshot);

      let appliedCount = 0;
      for (const action of evaluation.actions) {
        try {
          await input.sink.applyAction(action);
          appliedCount += 1;
        } catch (error) {
          failures.push({ message: errorMessage(error) });
        }
      }

      const degraded = failures.length > 0 || evaluation.orgLiveness === OrgLiveness.Flatlining;
      return {
        status: degraded ? KeepAliveLaneStatus.Degraded : KeepAliveLaneStatus.Ticked,
        appliedCount,
        failures,
      };
    },
  };
}
