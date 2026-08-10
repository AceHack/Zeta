import type {
  ZetaDbDelta,
  ZetaDbFeedback,
  ZetaDbResult,
  ZetaDbTickLimits,
  ZetaDbTickReadout,
  ZetaDbTickRequest,
} from "../zetadb/zeta-db-node";
import type { BrowserDatabaseInvalidation } from "./browser-tab-coordinator";

export interface BrowserZetaDbTabFeedback {
  readonly severity: "backpressure" | "heat";
  readonly code:
    | "database-tab-configuration-invalid"
    | "database-tab-executor-threw"
    | "database-tab-observer-failed"
    | "database-tab-publish-failed"
    | "database-tab-stopped";
  readonly detail: string;
}

export type BrowserZetaDbTabResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly feedback: ZetaDbFeedback | BrowserZetaDbTabFeedback };

export type BrowserZetaDbTabExecutor = (request: ZetaDbTickRequest) => Promise<ZetaDbResult<ZetaDbTickReadout>>;

export type BrowserZetaDbTabEdgeResult =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly feedback: { readonly severity: "backpressure" | "heat"; readonly code: string; readonly detail: string };
    };

export interface BrowserZetaDbTabRuntimeOptions {
  readonly databaseNodeId: string;
  readonly executorId: string;
  readonly limits: ZetaDbTickLimits;
  readonly execute: BrowserZetaDbTabExecutor;
  readonly observe: (readout: ZetaDbTickReadout) => BrowserZetaDbTabEdgeResult;
  readonly publishInvalidation: (databaseNodeId: string, revision: number) => BrowserZetaDbTabEdgeResult;
}

export interface BrowserZetaDbTabRuntime {
  tick(deltas: readonly ZetaDbDelta[]): Promise<BrowserZetaDbTabResult<ZetaDbTickReadout>>;
  compareAndSwap(
    expectedRevision: number,
    deltas: readonly ZetaDbDelta[],
  ): Promise<BrowserZetaDbTabResult<ZetaDbTickReadout>>;
  receiveInvalidation(invalidation: BrowserDatabaseInvalidation): BrowserZetaDbTabResult<null>;
  drainInvalidations(): Promise<BrowserZetaDbTabResult<ZetaDbTickReadout | null>>;
  stop(): BrowserZetaDbTabResult<null>;
}

function succeeded<T>(value: T): BrowserZetaDbTabResult<T> {
  return { ok: true, value };
}

function failed(
  code: BrowserZetaDbTabFeedback["code"],
  detail: string,
  severity: BrowserZetaDbTabFeedback["severity"] = "heat",
): BrowserZetaDbTabResult<never> {
  return { ok: false, feedback: { severity, code, detail } };
}

function isIdentifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 1024;
}

function isRevision(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function validLimits(limits: ZetaDbTickLimits): boolean {
  return (
    Number.isSafeInteger(limits.maxDeltas) &&
    limits.maxDeltas > 0 &&
    Number.isSafeInteger(limits.maxEntries) &&
    limits.maxEntries > 0 &&
    Number.isSafeInteger(limits.maxCheckpointBytes) &&
    limits.maxCheckpointBytes > 0
  );
}

function edgeFailure(
  code: "database-tab-observer-failed" | "database-tab-publish-failed",
  edge: Extract<BrowserZetaDbTabEdgeResult, { readonly ok: false }>,
): BrowserZetaDbTabResult<never> {
  return failed(code, `${edge.feedback.code}: ${edge.feedback.detail}`, edge.feedback.severity);
}

/**
 * Serialize this tab's writes and peer-triggered rereads over one finite tick executor.
 * Messages carry only revision evidence; persisted database bytes remain authoritative.
 */
export function startBrowserZetaDbTabRuntime(
  options: BrowserZetaDbTabRuntimeOptions,
): BrowserZetaDbTabResult<BrowserZetaDbTabRuntime> {
  if (!isIdentifier(options.databaseNodeId) || !isIdentifier(options.executorId) || !validLimits(options.limits)) {
    return failed(
      "database-tab-configuration-invalid",
      "A browser database tab runtime requires identifiers and positive safe-integer tick budgets.",
    );
  }

  let stopped = false;
  let latestRevision: number | null = null;
  let lastTick: ZetaDbTickReadout | null = null;
  let tail: Promise<BrowserZetaDbTabResult<ZetaDbTickReadout | null>> = Promise.resolve(succeeded(null));

  const executeTick = async (
    deltas: readonly ZetaDbDelta[],
    publishAcceptedWrites: boolean,
    requestedRevision: number | null,
    expectedRevision: number | null,
  ): Promise<BrowserZetaDbTabResult<ZetaDbTickReadout | null>> => {
    if (stopped) return failed("database-tab-stopped", "The browser database tab runtime has already stopped.");
    if (requestedRevision !== null && latestRevision !== null && requestedRevision <= latestRevision) {
      return succeeded(lastTick);
    }

    let executed: ZetaDbResult<ZetaDbTickReadout>;
    try {
      const request: ZetaDbTickRequest = {
        nodeId: options.databaseNodeId,
        executorId: options.executorId,
        executorKind: "browser-tab",
        deltas,
        limits: options.limits,
        ...(expectedRevision === null ? {} : { expectedRevision }),
        ...(expectedRevision === null ? {} : { requireComplete: true }),
      };
      executed = await options.execute(request);
    } catch {
      return failed(
        "database-tab-executor-threw",
        "The injected browser database executor threw during a finite tick.",
      );
    }
    if (!executed.ok) return executed;

    const tick = executed.value;
    latestRevision = tick.revision;
    lastTick = tick;

    let publishFailure: BrowserZetaDbTabResult<never> | null = null;
    if (publishAcceptedWrites && tick.accepted > 0) {
      try {
        const published = options.publishInvalidation(options.databaseNodeId, tick.revision);
        if (!published.ok) publishFailure = edgeFailure("database-tab-publish-failed", published);
      } catch {
        publishFailure = failed(
          "database-tab-publish-failed",
          "The injected database invalidation publisher threw after a committed tick.",
        );
      }
    }

    try {
      const observed = options.observe(tick);
      if (!observed.ok) return edgeFailure("database-tab-observer-failed", observed);
    } catch {
      return failed(
        "database-tab-observer-failed",
        "The injected browser database observer threw after a finite tick.",
      );
    }
    return publishFailure ?? succeeded(tick);
  };

  const schedule = (
    deltas: readonly ZetaDbDelta[],
    publishAcceptedWrites: boolean,
    requestedRevision: number | null,
    expectedRevision: number | null,
  ): Promise<BrowserZetaDbTabResult<ZetaDbTickReadout | null>> => {
    const scheduled = tail
      .then(() => executeTick(deltas, publishAcceptedWrites, requestedRevision, expectedRevision))
      .catch(() => failed("database-tab-executor-threw", "The browser database tick queue rejected unexpectedly."));
    tail = scheduled;
    return scheduled;
  };

  return succeeded({
    tick: async (deltas) => {
      const result = await schedule(deltas, true, null, null);
      if (!result.ok) return result;
      return result.value === null
        ? failed("database-tab-executor-threw", "The browser database executor returned no tick readout.")
        : succeeded(result.value);
    },
    compareAndSwap: async (expectedRevision, deltas) => {
      if (!isRevision(expectedRevision)) {
        return failed(
          "database-tab-configuration-invalid",
          "A compare-and-swap tick requires a non-negative safe-integer expected revision.",
        );
      }
      const result = await schedule(deltas, true, null, expectedRevision);
      if (!result.ok) return result;
      return result.value === null
        ? failed("database-tab-executor-threw", "The browser database executor returned no tick readout.")
        : succeeded(result.value);
    },
    receiveInvalidation: (invalidation) => {
      if (stopped) return failed("database-tab-stopped", "The browser database tab runtime has already stopped.");
      if (
        !isIdentifier(invalidation.sourceTabId) ||
        !isIdentifier(invalidation.databaseNodeId) ||
        !isRevision(invalidation.revision)
      ) {
        return failed(
          "database-tab-configuration-invalid",
          "A database invalidation carried invalid revision evidence.",
        );
      }
      if (invalidation.databaseNodeId !== options.databaseNodeId) return succeeded(null);
      void schedule([], false, invalidation.revision, null);
      return succeeded(null);
    },
    drainInvalidations: () => tail,
    stop: () => {
      if (stopped) return succeeded(null);
      stopped = true;
      return succeeded(null);
    },
  });
}
