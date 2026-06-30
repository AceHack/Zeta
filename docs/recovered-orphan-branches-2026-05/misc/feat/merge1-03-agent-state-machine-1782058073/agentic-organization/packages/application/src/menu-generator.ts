// menu-generator.ts — Merge1 §03: legal-menu generation for the agent loop.
//
// Implemented from the §03 spec sketch (no donor file in this repo's slice).
// Generates the menu of legal MenuOptions from the current state + ready work +
// named dependencies. Composes with RMO: RMO's hat-supply planning determines
// which WorkCandidates are "ready" for this agent; the menu generator turns each
// into a PickWork option.
//
// MP-5 (freedom-always-in-menu): the free modes — EnterFreeTime, EscapeHatch,
// PressPause, EnterOpenEndedExploration — plus EmitHeartbeat,
// RequestOperatorAttention, and ProposeNewGrammarAction are ALWAYS present,
// regardless of state. ResumeFromPause is the only state-gated option (Paused).

import type { AgentState, MenuOption, NamedDependencyInput, WorkCandidate } from "./agent-state-machine.ts";

/**
 * Generate the legal menu. PickWork per ready candidate, EnterNamedBoundedWait
 * per named dependency, the always-available free/escape/pause/heartbeat/
 * operator/grammar options, and ResumeFromPause iff currently Paused.
 */
export function generateMenuOptions(
  state: AgentState,
  readyWork: readonly WorkCandidate[],
  namedDependencies: readonly NamedDependencyInput[],
): readonly MenuOption[] {
  const options: MenuOption[] = [];

  // PickWork — one per ready candidate (RMO supplies the ready list).
  for (const work of readyWork) {
    options.push({ tag: "PickWork", work });
  }

  // Always-available operational + freedom options (MP-5).
  options.push({ tag: "EmitHeartbeat", lane: "heartbeat" });
  options.push({ tag: "EscapeHatch", reason: "", proposedAction: "" }); // Mod 1
  options.push({ tag: "EnterFreeTime", reason: "chosen rest" }); // free mode

  // EnterNamedBoundedWait — one per named dependency.
  for (const dep of namedDependencies) {
    options.push({ tag: "EnterNamedBoundedWait", namedDep: dep.name, ...(dep.eta === undefined ? {} : { eta: dep.eta }) });
  }

  options.push({ tag: "RequestOperatorAttention", reason: "" });
  options.push({ tag: "ProposeNewGrammarAction", name: "", description: "" }); // Mod 2
  options.push({ tag: "PressPause", reason: "" }); // mental-health pause
  options.push({ tag: "EnterOpenEndedExploration", reason: "" }); // unstructured mode

  // ResumeFromPause — surfaced only when Paused (the explicit unpause contract).
  if (state.tag === "Paused") {
    options.push({ tag: "ResumeFromPause" });
  }

  return options;
}
