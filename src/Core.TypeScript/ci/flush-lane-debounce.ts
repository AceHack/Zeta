#!/usr/bin/env bun
/**
 * flush-lane-debounce.ts — decide whether a telemetry flush lane may push this tick.
 *
 * THE MEASURED PROBLEM (2026-08-27). `drift-sweep.yml` fires on every push to `main`. Main was
 * measured at 68 merges in ~6h — one every ~5.3 minutes. `gate` on `heartbeat/drift-sweep` was
 * measured at ~16 minutes (median of 13 successful runs). Arrival rate over service rate is
 * therefore ≈3: every tick pushed the lane branch, restarting `gate` on the open flush PR and
 * CANCELLING the run already in flight. Measured on that branch: **39 cancelled against 40
 * success**, with every cancellation showing an inter-push gap of 6–11 min and every success 13+.
 *
 * That is queueing saturation, not flakiness. Past ρ ≥ 1 a queue does not get slower, it stops
 * draining — so the flush PR could not land while main stayed busy, and it grew while it waited.
 *
 * The `on: push` trigger was added 2026-08-10 to make the tick faster. It did make MEASUREMENT
 * faster; it also pushed arrival past service, which made LANDING slower without bound. Both are
 * true and only the first was intended.
 *
 * WHY THIS LIVES IN A MODULE AND NOT IN THE WORKFLOW. `gate.yml` states the rule this follows:
 * *logic in a `run:` block is logic no test can reach*. A debounce that silently decides wrong is
 * indistinguishable from a healthy quiet lane, which is the failure class this repo is built
 * against — so the decision is a pure function with falsifiers, and the workflow only pipes bytes.
 *
 * WHY "IS THE PREVIOUS TICK STILL IN GATE" AND NOT "WAS THE LAST PUSH < N MINUTES AGO". A time
 * window needs N calibrated against gate's duration and rots the moment gate gets faster or
 * slower. This asks the question directly, so it self-tunes and it targets the actual mechanism
 * (supersession) rather than a proxy for it.
 *
 * NOTHING IS LOST BY SKIPPING. A tick that never lands never existed: numbering is `max existing
 * + 1` derived from the ledger, and the lane's `prepare` step unions whatever is still parked on
 * the branch. The next eligible run computes a fresh tick from current state. The cron heartbeat
 * is what guarantees liveness even if every event-driven tick in a busy hour is skipped.
 *
 * IT FAILS OPEN, ON PURPOSE. A stuck or unreadable gate run must never starve the lane
 * permanently. A run older than `maxInflightMinutes` is treated as not-in-flight, and any
 * unreadable input proceeds. The cost of a wrongly-skipped tick is a delayed measurement; the cost
 * of a wrongly-starved lane is silence that looks like health — and the second is the worse
 * failure here.
 */

/** Statuses GitHub reports for a run that has not finished. */
const IN_FLIGHT: ReadonlySet<string> = new Set(["in_progress", "queued", "waiting", "requested", "pending"]);

export interface PriorRun {
  /** GitHub run status, or `null` when no run could be read. */
  readonly status: string | null;
  /** ISO-8601 start time, or `null` when absent/unreadable. */
  readonly startedAt: string | null;
}

export interface DebounceDecision {
  readonly shouldRun: boolean;
  /** Human-readable, and printed into the job summary — a skip must never be silent. */
  readonly reason: string;
}

/**
 * Decide, purely.
 *
 * `now` is injected rather than read from the clock so the decision is replayable and the tests
 * drive real boundaries instead of sleeping (§13 noninterference). Note this is a LOCAL scheduling
 * decision — rate control — which is exactly the use `local-time-never-enters-the-shared-fold`
 * permits; no wall-clock value here reaches the ledger or any shared conclusion.
 */
export function decide(prior: PriorRun, now: Date, maxInflightMinutes: number): DebounceDecision {
  if (prior.status === null) {
    return { shouldRun: true, reason: "no previous gate run readable for the lane — proceeding (fail open)" };
  }
  if (!IN_FLIGHT.has(prior.status)) {
    return { shouldRun: true, reason: `previous gate run is '${prior.status}' (not in flight) — proceeding` };
  }
  if (prior.startedAt === null) {
    return { shouldRun: true, reason: "previous run is in flight but has no start time — proceeding (fail open)" };
  }
  const started = Date.parse(prior.startedAt);
  if (Number.isNaN(started)) {
    return { shouldRun: true, reason: `could not parse start time '${prior.startedAt}' — proceeding (fail open)` };
  }
  const ageMin = Math.floor((now.getTime() - started) / 60000);
  if (ageMin >= maxInflightMinutes) {
    return {
      shouldRun: true,
      reason: `previous gate run is '${prior.status}' but ${ageMin}m old (>= ${maxInflightMinutes}m) — treating as stuck, proceeding`,
    };
  }
  // A negative age means the run started "after" now — clock skew between GitHub and the runner.
  // Treated as in-flight rather than proceeding, because skew is not evidence the run finished.
  return {
    shouldRun: false,
    reason:
      `previous tick's gate is '${prior.status}' and ${ageMin}m old — SKIPPING this tick to avoid superseding it. ` +
      "The cron heartbeat guarantees the lane still ticks; nothing is lost, because a tick that never lands never existed.",
  };
}

/** Parse the two fields this needs out of the Actions API's run object. */
export function parsePriorRun(json: string): PriorRun {
  try {
    const v: unknown = JSON.parse(json);
    if (v === null || typeof v !== "object") return { status: null, startedAt: null };
    const o = v as Record<string, unknown>;
    const status = typeof o["status"] === "string" ? o["status"] : null;
    const startedAt = typeof o["run_started_at"] === "string" ? o["run_started_at"] : null;
    return { status, startedAt };
  } catch {
    // Unreadable input is an absent run, which fails open. It is NOT an error: the lane must tick
    // when the observability it depends on is broken, or a monitoring outage becomes a lane outage.
    return { status: null, startedAt: null };
  }
}

if (import.meta.main) {
  const argv = process.argv.slice(2);
  const at = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const maxRaw = at("--max-inflight-minutes") ?? "45";
  const max = Number.parseInt(maxRaw, 10);
  if (!Number.isInteger(max) || max <= 0) {
    console.log(`--max-inflight-minutes '${maxRaw}' is not a positive integer`);
    process.exit(2);
  }
  const body = await Bun.stdin.text();
  const d = decide(parsePriorRun(body), new Date(), max);
  console.log(d.reason);
  console.log(`should_run=${String(d.shouldRun)}`);
}
