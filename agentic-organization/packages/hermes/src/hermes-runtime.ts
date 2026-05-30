/**
 * Hermes runtime port + in-process simulated adapter.
 *
 * launch_hermes_run (V0_EXECUTABLE_CONTRACT step 10) binds an Organization work
 * item, agent, session, hat assignment, and prompt-flow run to the Hermes/OZ
 * runtime. V0 explicitly permits a SIMULATED adapter ("even if the runtime
 * adapter is still simulated"). This is the AUTONOMOUS DATA PLANE the keep-alive
 * control plane watches: a run emits heartbeats (which keep-alive checks for
 * staleness) and terminates Completed or Failed.
 *
 * The port is the seam a real bubblewrapped-k3s-session adapter implements later;
 * the in-process fake makes the V0 vertical slice runnable end to end. Every run
 * state is an explicit DU; operations return Result-as-DU (never throw for an
 * expected condition like an unknown or terminal run).
 */

export const HermesRunState = {
  Running: "running",
  Completed: "completed",
  Failed: "failed",
} as const;
export type HermesRunState = (typeof HermesRunState)[keyof typeof HermesRunState];

/** The Organization facts bound to a Hermes run (V0 step 10). */
export type HermesRunBinding = {
  workItemId: string;
  agentId: string;
  sessionId: string;
  hatAssignmentId: string;
  promptFlowRunId: string;
};

export type HermesRunOutcome = {
  summary: string;
  evidenceRefs: readonly string[];
};

export type HermesRun = {
  runId: string;
  binding: HermesRunBinding;
  state: HermesRunState;
  lastHeartbeatMs: number;
  outcome?: HermesRunOutcome;
  failureReason?: string;
};

export const HermesRuntimeFeedbackReason = {
  UnknownRun: "unknown_run",
  RunNotRunning: "run_not_running",
} as const;
export type HermesRuntimeFeedbackReason =
  (typeof HermesRuntimeFeedbackReason)[keyof typeof HermesRuntimeFeedbackReason];

export type HermesRunResult =
  | { outcome: "ok"; run: HermesRun }
  | { outcome: "feedback"; feedback: { reason: HermesRuntimeFeedbackReason; message: string } };

export interface HermesRuntime {
  launchRun(binding: HermesRunBinding): Promise<HermesRunResult>;
  getRun(runId: string): Promise<HermesRun | undefined>;
  heartbeat(runId: string): Promise<HermesRunResult>;
  completeRun(runId: string, outcome: HermesRunOutcome): Promise<HermesRunResult>;
  failRun(runId: string, reason: string): Promise<HermesRunResult>;
}

export type HermesRuntimeDeps = {
  clock: { now: () => number };
  idGenerator: { nextRunId: () => string };
};

function defaultDeps(): HermesRuntimeDeps {
  let counter = 0;
  return {
    clock: { now: () => Date.now() },
    idGenerator: { nextRunId: () => `hermes-run-${++counter}` },
  };
}

/**
 * An in-process simulated Hermes runtime. Holds runs in a Map; deterministic
 * when given a deterministic clock + id generator. Real adapters (k3s session +
 * bubblewrap sandbox) implement the same HermesRuntime port.
 */
export function createInProcessHermesRuntime(deps: HermesRuntimeDeps = defaultDeps()): HermesRuntime {
  const runs = new Map<string, HermesRun>();

  function feedback(reason: HermesRuntimeFeedbackReason, message: string): HermesRunResult {
    return { outcome: "feedback", feedback: { reason, message } };
  }

  /**
   * Deep snapshot of a run so callers cannot mutate the authoritative record via
   * the nested `binding`/`outcome` references (a shallow `{...run}` would leak
   * them). Returns a fully detached copy.
   */
  function snapshotRun(run: HermesRun): HermesRun {
    const copy: HermesRun = {
      runId: run.runId,
      binding: { ...run.binding },
      state: run.state,
      lastHeartbeatMs: run.lastHeartbeatMs,
    };
    if (run.outcome !== undefined) {
      copy.outcome = { summary: run.outcome.summary, evidenceRefs: [...run.outcome.evidenceRefs] };
    }
    if (run.failureReason !== undefined) {
      copy.failureReason = run.failureReason;
    }
    return copy;
  }

  // Explicit tagged result so narrowing is on a dedicated `ok` discriminant,
  // never the `outcome` field name (which HermesRun itself carries).
  type RunningCheck = { ok: true; run: HermesRun } | { ok: false; result: HermesRunResult };

  function requireRunning(runId: string): RunningCheck {
    const run = runs.get(runId);
    if (run === undefined) {
      return { ok: false, result: feedback(HermesRuntimeFeedbackReason.UnknownRun, `no hermes run '${runId}'`) };
    }
    if (run.state !== HermesRunState.Running) {
      return {
        ok: false,
        result: feedback(HermesRuntimeFeedbackReason.RunNotRunning, `hermes run '${runId}' is ${run.state}, not running`),
      };
    }
    return { ok: true, run };
  }

  return {
    async launchRun(binding: HermesRunBinding): Promise<HermesRunResult> {
      const run: HermesRun = {
        runId: deps.idGenerator.nextRunId(),
        binding,
        state: HermesRunState.Running,
        lastHeartbeatMs: deps.clock.now(),
      };
      runs.set(run.runId, run);
      return { outcome: "ok", run: snapshotRun(run) };
    },

    async getRun(runId: string): Promise<HermesRun | undefined> {
      const run = runs.get(runId);
      return run === undefined ? undefined : snapshotRun(run);
    },

    async heartbeat(runId: string): Promise<HermesRunResult> {
      const check = requireRunning(runId);
      if (!check.ok) {
        return check.result;
      }
      check.run.lastHeartbeatMs = deps.clock.now();
      return { outcome: "ok", run: snapshotRun(check.run) };
    },

    async completeRun(runId: string, outcome: HermesRunOutcome): Promise<HermesRunResult> {
      const check = requireRunning(runId);
      if (!check.ok) {
        return check.result;
      }
      check.run.state = HermesRunState.Completed;
      check.run.outcome = { summary: outcome.summary, evidenceRefs: [...outcome.evidenceRefs] };
      return { outcome: "ok", run: snapshotRun(check.run) };
    },

    async failRun(runId: string, reason: string): Promise<HermesRunResult> {
      const check = requireRunning(runId);
      if (!check.ok) {
        return check.result;
      }
      check.run.state = HermesRunState.Failed;
      check.run.failureReason = reason;
      return { outcome: "ok", run: snapshotRun(check.run) };
    },
  };
}
