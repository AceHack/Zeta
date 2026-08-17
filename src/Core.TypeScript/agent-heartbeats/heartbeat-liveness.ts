#!/usr/bin/env bun

/**
 * Watchdog for the agent-heartbeat lane: "has a heartbeat SUCCEEDED recently?"
 *
 * WHY THIS EXISTS AS A SEPARATE THING FROM THE CADENCE STEP.
 *
 * `agent-heartbeat.yml` already measures cadence — step "Measure cadence (declared vs actual)".
 * That step lives INSIDE the heartbeat job, downstream of "Accumulate unflushed heartbeat state
 * over current main", and carries no `if:`, so it inherits the default `success()` gate. On
 * 2026-08-16T23:05Z through 2026-08-17T00:49Z the accumulate step failed on every tick and the
 * cadence step was reported `skipped` on every one of them. The measurement built to catch
 * silent degradation is switched off by the degradation. It can only speak while the thing it
 * watches is healthy, which is the one condition under which nobody needs it.
 *
 * It also cannot see the other half of the problem. It reads `docs/observe-events/*.json` from
 * inside a run, so it only measures ticks that HAPPENED. GitHub drops scheduled slots under
 * load: over 2026-08-16T00:19Z..2026-08-17T00:49Z the lane fired 84 scheduled runs where an
 * every-15-minutes cron declares 100, with observed inter-run gaps of 12..43 minutes against a
 * declared 15 (p50 16, p90 27). When a slot is dropped there is no run, so there is nothing to run a
 * check inside. An outage that consists of runs NOT HAPPENING is invisible to anything that
 * only executes when a run happens.
 *
 * So the watchdog is deliberately OUTSIDE the lane: a separate workflow, on its own schedule,
 * asking the Actions API a question about the heartbeat rather than asking the heartbeat about
 * itself. It is level-triggered ("how old is the newest success?"), never edge-triggered
 * ("did a tick just land?"), because a level-triggered check still gives the right answer when
 * the watchdog's OWN cron slot is dropped — it just answers later. An edge-triggered one would
 * miss the edge and go quiet, reproducing the bug it exists to catch.
 *
 * The logic is a pure function over run records so it can be unit-tested against outage shapes
 * that are hard to stage in production — no runs at all, only failures, a clock skew, a run
 * still in progress. A monitor whose alarm path never executes in test is a monitor nobody has
 * ever seen work.
 */

/** One Actions run, narrowed to the fields the verdict depends on. */
export interface HeartbeatRunRecord {
  /** ISO-8601 run creation time, as returned by the Actions API `created_at`. */
  readonly created_at?: unknown;
  /** `queued` | `in_progress` | `completed`. */
  readonly status?: unknown;
  /** `success` | `failure` | `cancelled` | ... ; null while the run is not completed. */
  readonly conclusion?: unknown;
}

export interface LivenessVerdict {
  /** True only when a completed successful run exists and is younger than the threshold. */
  readonly alive: boolean;
  /** Human-readable one-liner naming what was measured and against what. */
  readonly summary: string;
  /** ISO timestamp of the newest successful run, when one was found. */
  readonly lastSuccessAt?: string;
  /** Age of that success in whole minutes, clamped at 0. Absent when there is no success. */
  readonly ageMinutes?: number;
  /** How many run records the verdict was computed over — 0 is itself an alarm condition. */
  readonly consideredRuns: number;
}

/**
 * Default alarm threshold, in minutes.
 *
 * Sized from measured behaviour, not from the declared cadence. The declared cron fires every
 * 15 minutes, but GitHub's jitter and dropped slots put the observed worst-case gap between
 * consecutive scheduled runs at 43 minutes over a 25-hour sample — with the lane perfectly
 * healthy. A threshold at or below that would fire on GitHub's normal behaviour, and an alarm
 * that cries wolf during healthy operation gets muted, which is a slower way of having no
 * alarm at all. 60 minutes is four consecutive missed slots: comfortably above the observed
 * noise floor, still far short of the multi-hour silence this is meant to prevent.
 */
export const DEFAULT_STALE_AFTER_MINUTES = 60;

const MS_PER_MINUTE = 60_000;

/**
 * Parse an API timestamp, returning undefined rather than a fallback on anything unparseable.
 *
 * Deliberately NOT defaulting to "now" on a bad value. A malformed timestamp read as the
 * current time makes a stale lane look fresh — the monitor would report health it did not
 * measure. Unparseable input must drop the record, so a corpus of bad records degrades toward
 * "no usable success found" (an alarm) instead of toward silence.
 */
function parseTimestamp(value: unknown): Date | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function isSuccessfulRun(run: HeartbeatRunRecord): boolean {
  // Both fields are checked. `conclusion === "success"` alone would be enough for the API as it
  // behaves today, but a queued or in-progress run carries `conclusion: null`, and reading a
  // not-yet-finished run as proof of life is exactly the optimism this file exists to refuse.
  return run.status === "completed" && run.conclusion === "success";
}

/**
 * Decide whether the heartbeat lane is alive, given the recent runs and the current time.
 *
 * Pure: no network, no clock, no filesystem. `now` is injected so the outage cases are
 * reachable from tests.
 */
export function assessHeartbeatLiveness(
  runs: readonly HeartbeatRunRecord[],
  now: Date,
  staleAfterMinutes: number = DEFAULT_STALE_AFTER_MINUTES,
): LivenessVerdict {
  const considered = runs.length;

  // AN EMPTY RESULT IS AN ALARM, NOT A PASS. This is the case that turns a watchdog into
  // decoration: a bad filter, a renamed workflow, a token that lost `actions: read`, or an API
  // hiccup all return zero rows, and "no rows" read as "nothing wrong" means the monitor
  // reports healthy hardest at the moment it has stopped being able to see anything.
  if (considered === 0) {
    return {
      alive: false,
      summary:
        "no agent-heartbeat runs were returned at all — the lane is either stopped or the watchdog cannot see it; both need a human",
      consideredRuns: 0,
    };
  }

  const successTimes = runs
    .filter(isSuccessfulRun)
    .map((run) => parseTimestamp(run.created_at))
    .filter((at): at is Date => at !== undefined);

  if (successTimes.length === 0) {
    return {
      alive: false,
      summary: `no SUCCESSFUL agent-heartbeat run among the ${considered} most recent runs — the lane is firing but every tick is failing`,
      consideredRuns: considered,
    };
  }

  // Newest by TIMESTAMP, not by list position. The Actions API returns newest-first today, but
  // ordering is an API convenience and not a guarantee; sorting on the value actually being
  // measured is correct under any ordering.
  const newest = successTimes.reduce((a, b) => (a.getTime() >= b.getTime() ? a : b));

  // CLAMPED AT ZERO. A run timestamped in the future — runner clock skew, or a record whose
  // time is not what its position implies — otherwise yields a NEGATIVE age, which sails under
  // any threshold and silences the alarm permanently. Clamping makes skew read as "very
  // recent" (loud-failure-free but bounded) instead of "infinitely recent".
  const ageMinutes = Math.max(0, Math.floor((now.getTime() - newest.getTime()) / MS_PER_MINUTE));
  const lastSuccessAt = newest.toISOString();
  const alive = ageMinutes < staleAfterMinutes;

  return {
    alive,
    summary: alive
      ? `last successful agent-heartbeat was ${ageMinutes}min ago (threshold ${staleAfterMinutes}min)`
      : `NO SUCCESSFUL agent-heartbeat IN ${ageMinutes} MINUTES — last success ${lastSuccessAt}, threshold ${staleAfterMinutes}min`,
    lastSuccessAt,
    ageMinutes,
    consideredRuns: considered,
  };
}

/**
 * Extract run records from the Actions API payload, accepting either the full object
 * (`{ workflow_runs: [...] }`) or a bare array, which is what `--jq '.workflow_runs'` yields.
 *
 * Anything else throws. A shape this does not recognise must not silently become an empty
 * array: empty is a specific finding ("the lane is stopped") and must not be manufactured by a
 * parser giving up.
 */
export function extractRuns(payload: unknown): readonly HeartbeatRunRecord[] {
  if (Array.isArray(payload)) return payload as readonly HeartbeatRunRecord[];
  if (
    payload !== null &&
    typeof payload === "object" &&
    Array.isArray((payload as { workflow_runs?: unknown }).workflow_runs)
  ) {
    return (payload as { workflow_runs: readonly HeartbeatRunRecord[] }).workflow_runs;
  }
  throw new Error("unrecognised Actions API payload: expected an array of runs or an object with `workflow_runs`");
}

/**
 * CLI: `bun heartbeat-liveness.ts <runs.json> [staleAfterMinutes]`.
 *
 * Exits 1 when the lane is not alive. The non-zero exit IS the alarm surface — the calling
 * workflow turns red — so this must never be softened into a warning.
 */
async function main(argv: readonly string[]): Promise<number> {
  const [pathArg, thresholdArg] = argv;
  if (pathArg === undefined) {
    console.error("usage: heartbeat-liveness.ts <runs.json> [staleAfterMinutes]");
    return 2;
  }

  const staleAfterMinutes = thresholdArg === undefined ? DEFAULT_STALE_AFTER_MINUTES : Number(thresholdArg);
  if (!Number.isFinite(staleAfterMinutes) || staleAfterMinutes <= 0) {
    console.error(`invalid staleAfterMinutes: ${String(thresholdArg)}`);
    return 2;
  }

  const raw = await Bun.file(pathArg).text();
  const verdict = assessHeartbeatLiveness(extractRuns(JSON.parse(raw)), new Date(), staleAfterMinutes);

  console.log(`[heartbeat-liveness] ${verdict.summary}`);
  console.log(`[heartbeat-liveness] runs considered: ${verdict.consideredRuns}`);
  if (!verdict.alive) {
    // `::error::` so the annotation lands on the run summary, not just in the log body.
    console.log(`::error::[heartbeat-liveness] ${verdict.summary}`);
    return 1;
  }
  return 0;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
