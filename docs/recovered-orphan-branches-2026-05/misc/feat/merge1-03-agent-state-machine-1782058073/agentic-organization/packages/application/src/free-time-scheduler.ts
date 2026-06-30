// free-time-scheduler.ts — Merge1 §03: budget-aware free-time transitions.
//
// Implemented from the §03 spec sketch (no donor file in this repo's slice).
// When the agent is in FreeTime, the scheduler decides whether to keep resting,
// return to Idle, or force a Paused state because the room budget is exhausted.
// Composes with the room budget (maxSteps / maxWallClockMs): a free agent that
// runs out of budget is paused rather than left spinning.
//
// MP-5 (freedom-always-in-menu): the scheduler never forces work — it only ever
// continues free time, returns to a neutral Idle, or pauses on exhaustion.

import type { AgentState } from "./agent-state-machine.ts";
import type { RoomBudget } from "./room.ts";

export interface FreeTimeTransitionSchedulerInput {
  readonly state: AgentState;
  readonly roomBudget: RoomBudget;
  readonly stepsRemaining: number;
  readonly wallClockRemainingMs: number;
}

export type FreeTimeTransitionDecision =
  | { readonly outcome: "continue_free_time" }
  | { readonly outcome: "return_to_idle" }
  | { readonly outcome: "pause"; readonly reason: string };

/**
 * Decide the next free-time transition.
 *
 * - Not in FreeTime → return_to_idle (nothing to schedule).
 * - Budget exhausted (no steps or no wall-clock left) → pause.
 * - Exploration-tagged FreeTime, still in budget → continue_free_time (the
 *   persistent unstructured mode stays put until the agent chooses otherwise).
 * - Ordinary FreeTime, still in budget → return_to_idle (rest is one cycle).
 */
export function decideFreeTimeTransition(input: FreeTimeTransitionSchedulerInput): FreeTimeTransitionDecision {
  if (input.state.tag !== "FreeTime") return { outcome: "return_to_idle" };

  if (input.stepsRemaining <= 0) {
    return { outcome: "pause", reason: "room budget exhausted: no steps remaining" };
  }
  if (input.roomBudget.maxWallClockMs !== undefined && input.wallClockRemainingMs <= 0) {
    return { outcome: "pause", reason: "room budget exhausted: wall-clock limit reached" };
  }

  if (input.state.reason.startsWith("open-ended exploration:")) {
    return { outcome: "continue_free_time" };
  }
  return { outcome: "return_to_idle" };
}
