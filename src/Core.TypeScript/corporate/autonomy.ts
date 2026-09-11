/**
 * autonomy.ts — run the organization until it settles, and say WHY it stopped.
 *
 * ── WHAT WAS MISSING ─────────────────────────────────────────────────────────
 * One invocation was one cycle. `run-agent.ts --resume` carried state between invocations, so a
 * human running it repeatedly was the loop. Autonomous completion needs the loop to exist in the
 * program, and the whole difficulty is that a loop which cannot stop is worse than no loop: it
 * burns a budget producing nothing and reports success by never admitting it finished.
 *
 * ── FOUR WAYS TO STOP, AND ONLY ONE OF THEM IS SUCCESS ───────────────────────
 *
 *   delivered      the goal is done. The only good ending.
 *   halted         an escalation stopped a task. The organization decided, and deciding to stop is
 *                  a real outcome — not a failure to try.
 *   no_progress    a cycle changed nothing measurable. The most important one: an organization
 *                  that keeps running and keeps producing the same state is not working, and the
 *                  loop that cannot see that is the one that spins forever.
 *   bound_reached  the cycle limit. A backstop, not a plan: reaching it means the other three
 *                  failed to fire, which is itself worth reporting.
 *
 * Every stop reason is REPORTED rather than collapsed into a boolean. "It stopped" and "it
 * finished" are the two sentences a driver must never confuse, and a caller that only learns
 * `delivered: false` cannot tell a blocked run from a budget that ran out.
 *
 * ── PROGRESS IS MEASURED, NOT ASSUMED ────────────────────────────────────────
 * `progressOf` reduces a cycle to the numbers that must move for work to be happening: gates
 * crossed, work items done, changes landed. Two consecutive cycles with the same signature means
 * the organization is re-deciding the same things — which is exactly what a deterministic runtime
 * does when its inputs have not changed, so the detector is not a heuristic here, it is the honest
 * reading of a pure function called twice.
 */

import type { Cascade } from "./goal-cascade";
import type { OrgRuntimeDeps, OrgRuntimeReport } from "./org-runtime";

export const StopReason = {
  Delivered: "delivered",
  Halted: "halted",
  NoProgress: "no_progress",
  BoundReached: "bound_reached",
} as const;

export type StopReason = (typeof StopReason)[keyof typeof StopReason];

/**
 * The numbers that must move for a cycle to have done anything.
 *
 * Deliberately coarse. A finer signature — every event id, say — would differ between cycles for
 * reasons that are not progress (a new timestamp, a fresh id) and the detector would never fire,
 * which is the failure mode that matters: a no-progress check that cannot detect no progress.
 */
export interface Progress {
  readonly gatesPassed: number;
  readonly workItemsDone: number;
  readonly changesLanded: number;
  readonly delivered: boolean;
}

export function progressOf(report: OrgRuntimeReport): Progress {
  return {
    gatesPassed: report.gateEvaluations.length,
    workItemsDone: report.cascade.nodes.filter((n) => n.state === "done").length,
    changesLanded: report.changesLanded.length,
    delivered: report.delivered,
  };
}

export function sameProgress(a: Progress, b: Progress): boolean {
  return (
    a.gatesPassed === b.gatesPassed &&
    a.workItemsDone === b.workItemsDone &&
    a.changesLanded === b.changesLanded &&
    a.delivered === b.delivered
  );
}

export interface AutonomyOptions {
  /**
   * The most cycles to run. REQUIRED, with no default.
   *
   * A defaulted bound is a bound nobody chose, and this is the one number standing between an
   * autonomous loop and an unbounded one — so the caller states it.
   */
  readonly maxCycles: number;
  /** Advances the clock between cycles, so a run is not frozen at one instant. */
  readonly nextNowMs?: (cycle: number, prev: number) => number;
  /** Called after each cycle, for a caller that wants to watch. Never decides anything. */
  readonly onCycle?: (cycle: number, report: OrgRuntimeReport) => void;
}

export interface AutonomyResult {
  readonly cycles: number;
  readonly stoppedBecause: StopReason;
  /** The last cycle's report — the state the organization settled in. */
  readonly last: OrgRuntimeReport;
  readonly reports: readonly OrgRuntimeReport[];
  /** One line a human can read without opening the reports. */
  readonly summary: string;
}

export type RunCycle = (deps: OrgRuntimeDeps) => Promise<OrgRuntimeReport>;

/**
 * Run cycles until the organization settles.
 *
 * `run` is injected rather than imported so a caller can drive a different runtime — and so this
 * module's own tests can settle it deterministically without standing up an organization.
 *
 * THE ORDER OF THE STOP CHECKS IS LOAD-BEARING. Delivery is checked first because a cycle that
 * delivered has finished even if it also halted a task; `halted` before `no_progress` because an
 * escalation is a DECISION and reporting it as "nothing happened" would lose who decided what.
 */
export async function runUntilSettled(
  deps: OrgRuntimeDeps,
  options: AutonomyOptions,
  run: RunCycle,
): Promise<AutonomyResult> {
  if (options.maxCycles < 1) {
    throw new Error("maxCycles must be at least 1; a loop that cannot run once is not a loop");
  }

  const reports: OrgRuntimeReport[] = [];
  let previous: Progress | undefined;
  let nowMs = deps.nowMs;

  /**
   * The work as the LAST CYCLE left it.
   *
   * ── THE DEFECT THIS CLOSES ───────────────────────────────────────────────
   * `deps.priorCascade` is read from the store once, before this loop starts, so every cycle here
   * saw the same empty history and accepted the same intake again — minting a whole new goal,
   * initiative, project and pair of leaves each time round. MEASURED: one run of five cycles left
   * five parallel cascades for one request in the log, and questions raised by cycle one were
   * addressed to work cycle two had already replaced.
   *
   * A loop whose iterations cannot see each other is not a loop; it is the same first cycle run
   * repeatedly. Carrying the cascade forward is what makes the second cycle a CONTINUATION.
   */
  let carried: Cascade | undefined = deps.priorCascade;

  /**
   * What has LANDED, accumulated across cycles.
   *
   * The same defect the paragraph above describes, one field over: `deps.alreadyLanded` is folded
   * from the store once, before this loop, so cycle 2 cannot see what cycle 1 merged. Left that
   * way, an item merged in cycle 1 comes back in cycle 2 as done-with-no-commit and the run refuses
   * to deliver work it just shipped. A loop whose iterations cannot see each other is not a loop.
   *
   * Stays `undefined` when the caller supplied nothing, so "not measured" survives the loop rather
   * than becoming an empty set that reads as "nothing has ever landed".
   */
  let landed: Set<string> | undefined =
    deps.alreadyLanded === undefined ? undefined : new Set(deps.alreadyLanded);

  for (let cycle = 1; cycle <= options.maxCycles; cycle += 1) {
    const report = await run({
      ...deps,
      nowMs,
      ...(carried === undefined ? {} : { priorCascade: carried }),
      ...(landed === undefined ? {} : { alreadyLanded: landed }),
    });
    carried = report.cascade;
    if (landed !== undefined) for (const id of report.changesLanded) landed.add(id);
    reports.push(report);
    options.onCycle?.(cycle, report);

    const progress = progressOf(report);

    if (report.delivered) {
      return settled(cycle, StopReason.Delivered, reports, `delivered after ${String(cycle)} cycle(s)`);
    }
    if (report.halted.length > 0) {
      const first = report.halted[0];
      return settled(
        cycle,
        StopReason.Halted,
        reports,
        `stopped after ${String(cycle)} cycle(s): ${first?.byHatId ?? "someone"} escalated ` +
          `'${first?.taskId ?? "a task"}' → ${first?.action ?? "an action"}`,
      );
    }
    if (previous !== undefined && sameProgress(previous, progress)) {
      return settled(
        cycle,
        StopReason.NoProgress,
        reports,
        `stopped after ${String(cycle)} cycle(s): the cycle changed nothing ` +
          `(${String(progress.gatesPassed)} gate verdict(s), ${String(progress.workItemsDone)} item(s) done, ` +
          `${String(progress.changesLanded)} change(s) landed — same as the cycle before)`,
      );
    }

    previous = progress;
    nowMs = options.nextNowMs?.(cycle, nowMs) ?? nowMs;
  }

  return settled(
    options.maxCycles,
    StopReason.BoundReached,
    reports,
    `stopped at the bound of ${String(options.maxCycles)} cycle(s) without delivering — ` +
      `neither delivery, an escalation, nor a stalled cycle fired first`,
  );
}

function settled(
  cycles: number,
  stoppedBecause: StopReason,
  reports: readonly OrgRuntimeReport[],
  summary: string,
): AutonomyResult {
  const last = reports[reports.length - 1];
  if (last === undefined) throw new Error("settled with no cycles; the loop must run at least once");
  return { cycles, stoppedBecause, last, reports, summary };
}
