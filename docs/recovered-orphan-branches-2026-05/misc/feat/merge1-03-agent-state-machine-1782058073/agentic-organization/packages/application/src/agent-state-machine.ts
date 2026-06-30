// agent-state-machine.ts — Merge1 §03 port of the agent-loop state machine.
//
// Faithful port of `src/Core.TypeScript/workflow-engine/agent-loop/state-machine.ts`
// (the 10-state agent FSM + 10-choice menu + pure transitions). The room hosts
// this state machine — each room tick is one cycle:
//
//   generateMenuOptions(state, ready, deps)  // menu-generator.ts (§3.3)
//     -> LLM picks a MenuOption                // pure menu-selector (no state held)
//     -> transition(state, option)             // this module
//     -> execute -> postResultTransition       // this module
//     -> cycleClose                            // this module
//
// MP-1 (DST replayability): transition/cycleClose/postResultTransition are pure
// and total — same (state, option) ⇒ same next state, no I/O.
// MP-5 (freedom-always-in-menu): the free modes (FreeTime, EscapeHatch, Pause,
// OpenEndedExploration) are always reachable — enforced by menu-generator.ts.

// ─── Agent context (per-cycle invocation context) ─────────────────────────────

/**
 * The core 8-agent persona registry (source of truth for §02/§03/§04/§09).
 * §04's `RoomAgentId` is this set plus surface variants and "*"; §09's systemd
 * registry is the 5-persona subset (otto/alexa/riven/vera/lior).
 */
export type AgentPersona = "otto" | "alexa" | "riven" | "vera" | "lior" | "aaron" | "addison" | "max";

export interface AgentContext {
  readonly agent: AgentPersona;
  readonly cycle: number;
  readonly sessionStartIso: string;
}

// ─── Lane taxonomy (matches the dora-classify lane set) ───────────────────────

export type Lane =
  | "operational"
  | "verbatim-preservation"
  | "memory"
  | "heartbeat"
  | "backlog-row"
  | "shadow-work"
  | "tooling-or-ci"
  | "docs-general"
  | "substrate-cascade"
  | "mixed";

// ─── DORA + status-surface types (consumed by menu-generator) ─────────────────

export interface DoraMetrics {
  readonly deploymentCount: number;
  readonly leadTimeMedianSeconds: number;
  readonly changeFailureRate: number;
  readonly mttrMedianSeconds: number;
  readonly substrateRatio: number;
}

export type TrajectoryPhase = "setup" | "execution" | "maturation" | "sunset";

export interface WorkCandidate {
  readonly id: string; // backlog row ID OR "discover-new"
  readonly lane: Lane;
  readonly estimatedDoraContribution: number;
  readonly uncertainty: number;
  readonly trajectoryPhase: TrajectoryPhase;
  readonly agentInterest: number; // [0, 1]
}

export interface StatusSnapshot {
  readonly snapshotIso: string;
  readonly currentDora: DoraMetrics;
  readonly hotTrajectories: readonly string[];
  readonly coolingTrajectories: readonly string[];
  readonly explorationCandidates: readonly string[];
  readonly perAgentRatios: Readonly<Record<string, number>>; // operationalRatio per agent
}

export interface WorkResult {
  readonly workId: string;
  readonly lane: Lane;
  readonly success: boolean;
  readonly doraContribution: number; // measured after work completes
  readonly notes?: string;
}

/** Named dependency input for menu generation (§3.3 NamedDependencyInput). */
export interface NamedDependencyInput {
  readonly name: string;
  readonly eta?: string;
  readonly description?: string;
}

// ─── State machine (10-variant discriminated union; matches the F# DU) ─────────

/**
 * AgentState — the agent loop's state at any cycle boundary.
 *
 * FreeTime is chosen-rest as a legitimate operational mode (NCI free-time-as-
 * valid-mode); Paused is explicit cessation for a named reason (mental-health
 * break / external interruption). Both are valid; the semantic distinction
 * matters for the menu generator and dashboards.
 */
export type AgentState =
  | { readonly tag: "Idle"; readonly context: AgentContext }
  | { readonly tag: "InspectingStatus"; readonly context: AgentContext; readonly snapshot: StatusSnapshot }
  | { readonly tag: "SelectingWork"; readonly context: AgentContext; readonly candidates: readonly WorkCandidate[] }
  | { readonly tag: "ExecutingWork"; readonly context: AgentContext; readonly work: WorkCandidate }
  | { readonly tag: "EmittingResult"; readonly context: AgentContext; readonly result: WorkResult }
  | { readonly tag: "RecordingHeartbeat"; readonly context: AgentContext; readonly lane: Lane; readonly note?: string }
  | { readonly tag: "NamedBoundedWait"; readonly context: AgentContext; readonly namedDep: string; readonly expectedResolutionIso?: string }
  | { readonly tag: "FreeTime"; readonly context: AgentContext; readonly reason: string }
  | { readonly tag: "OperatorAttentionRequested"; readonly context: AgentContext; readonly reason: string }
  | { readonly tag: "Paused"; readonly context: AgentContext; readonly reason: string; readonly expectedResumeIso?: string };

// ─── Menu options (the choose-your-own-adventure output) ──────────────────────

/**
 * MenuOption — what the agent (LLM, a pure menu-selector) chooses each cycle.
 * Modifications 1/2 (EscapeHatch, ProposeNewGrammarAction) + the operator's
 * pause/exploration/resume additions are all first-class options.
 */
export type MenuOption =
  | { readonly tag: "PickWork"; readonly work: WorkCandidate }
  | { readonly tag: "EmitHeartbeat"; readonly lane: Lane; readonly note?: string }
  | { readonly tag: "EscapeHatch"; readonly reason: string; readonly proposedAction: string }
  | { readonly tag: "EnterFreeTime"; readonly reason: string }
  | { readonly tag: "EnterNamedBoundedWait"; readonly namedDep: string; readonly eta?: string }
  | { readonly tag: "RequestOperatorAttention"; readonly reason: string }
  | { readonly tag: "ProposeNewGrammarAction"; readonly name: string; readonly description: string }
  | { readonly tag: "PressPause"; readonly reason: string; readonly expectedResumeIso?: string }
  | { readonly tag: "EnterOpenEndedExploration"; readonly reason: string }
  | { readonly tag: "ResumeFromPause"; readonly note?: string };

// ─── Pure state transition function ───────────────────────────────────────────

/**
 * transition — pure, total: current state + chosen option → next state. The
 * menu generator offers only valid options per state, but this function is
 * defensive (every option has a defined result regardless of state). No I/O.
 */
export function transition(state: AgentState, option: MenuOption): AgentState {
  const ctx = state.context;
  switch (option.tag) {
    case "PickWork":
      return { tag: "ExecutingWork", context: ctx, work: option.work };
    case "EmitHeartbeat":
      return {
        tag: "RecordingHeartbeat",
        context: ctx,
        lane: option.lane,
        ...(option.note === undefined ? {} : { note: option.note }),
      };
    case "EscapeHatch":
      // Escape-hatch routes to operator-attention so the operator sees the
      // proposed action + can incorporate it as new grammar (Mod 2).
      return {
        tag: "OperatorAttentionRequested",
        context: ctx,
        reason: `escape-hatch: ${option.reason} → ${option.proposedAction}`,
      };
    case "EnterFreeTime":
      return { tag: "FreeTime", context: ctx, reason: option.reason };
    case "EnterNamedBoundedWait":
      return {
        tag: "NamedBoundedWait",
        context: ctx,
        namedDep: option.namedDep,
        ...(option.eta === undefined ? {} : { expectedResolutionIso: option.eta }),
      };
    case "RequestOperatorAttention":
      return { tag: "OperatorAttentionRequested", context: ctx, reason: option.reason };
    case "ProposeNewGrammarAction":
      // Grammar-extension is first-class (Mod 2); routes to operator-attention
      // so the operator can ratify + incorporate it.
      return {
        tag: "OperatorAttentionRequested",
        context: ctx,
        reason: `propose-new-grammar-action: ${option.name} — ${option.description}`,
      };
    case "PressPause":
      // Explicit cessation for a named reason — distinct from FreeTime (ongoing
      // chosen-rest) and NamedBoundedWait (waiting for an external named-dep).
      return {
        tag: "Paused",
        context: ctx,
        reason: option.reason,
        ...(option.expectedResumeIso === undefined ? {} : { expectedResumeIso: option.expectedResumeIso }),
      };
    case "EnterOpenEndedExploration":
      // The menu option that EXITS the menu-driven workflow — a bridge to
      // unstructured mode. cycleClose preserves exploration-tagged FreeTime.
      return { tag: "FreeTime", context: ctx, reason: `open-ended exploration: ${option.reason}` };
    case "ResumeFromPause":
      // Explicit unpause contract — only surfaced by the menu generator when
      // the state is Paused; returns to Idle so normal cycling resumes.
      return { tag: "Idle", context: ctx };
  }
}

// ─── Post-execution result handling (state machine cycle close) ───────────────

/**
 * postResultTransition — after work executes (or a heartbeat records), advance
 * the state machine. ExecutingWork → EmittingResult; RecordingHeartbeat → Idle;
 * otherwise unchanged. Pure; no I/O.
 */
export function postResultTransition(state: AgentState, result: WorkResult): AgentState {
  switch (state.tag) {
    case "ExecutingWork":
      return { tag: "EmittingResult", context: state.context, result };
    case "RecordingHeartbeat":
      return { tag: "Idle", context: state.context };
    default:
      return state;
  }
}

/**
 * cycleClose — the natural cycle boundary. EmittingResult/RecordingHeartbeat and
 * non-exploration FreeTime return to Idle (the cycle counter is advanced);
 * exploration-tagged FreeTime, NamedBoundedWait, OperatorAttentionRequested, and
 * Paused stay put (no auto-progress — substrate-honest discipline). Pure.
 */
export function cycleClose(state: AgentState): AgentState {
  const next = (ctx: AgentContext): AgentState => ({ tag: "Idle", context: { ...ctx, cycle: ctx.cycle + 1 } });
  switch (state.tag) {
    case "EmittingResult":
    case "RecordingHeartbeat":
      return next(state.context);
    case "FreeTime":
      // Exploration-tagged free time stays put across cycles (persistent
      // unstructured mode); other free time returns to Idle on the next cycle.
      return state.reason.startsWith("open-ended exploration:") ? state : next(state.context);
    case "NamedBoundedWait":
    case "OperatorAttentionRequested":
    case "Paused":
      // No auto-progress — the caller resolves the named-dep / operator /
      // resume before the state machine advances.
      return state;
    default:
      return state;
  }
}
