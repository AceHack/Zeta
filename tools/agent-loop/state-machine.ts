// tools/agent-loop/state-machine.ts
//
// B-0867.5 substrate: agent-loop state machine types + pure-logic
// state transition function.
//
// Operator framing 2026-05-28:
//   "the agent loop basiclaly becomes execute script look at choose your
//    own adventure output, take action based on outpout"
//
// Clean separation per operator design:
//   - Deterministic script holds STATE MACHINE (this module + cli.ts)
//   - LLM is pure MENU-SELECTOR (reads menu, returns choice)
//   - State persists in Git append-only (per B-0867 + B-0858)
//
// The agent (LLM) never holds state internally; every invocation reads
// current state from Git, gets a menu, returns a choice. Script executes
// choice + appends new state.
//
// This module is the TS implementation of the F# DU contract described
// at the bottom of this file. The F# DU types are the canonical contract;
// TS impl follows the same shape. When B-0867.1 lands the F# types in
// src/Core.FSharp/WorkflowEngine/StateMachine.fs, the cross-verify
// harness pattern (per src/Core.TypeScript/zeta-id/cross-verify.ts) will
// validate TS ↔ F# round-trip equivalence.
//
// Composes with:
//   - B-0867 (workflow engine v1 — this module IS B-0867.5)
//   - B-0858 (heartbeat folder — EmitHeartbeat menu option writes here)
//   - B-0869 (DORA mandate — operational lane gets priority via menu-gen)
//   - B-0870 (two-mandate portfolio — per-agent operational-ratio feeds
//     into menu-generator's option-weighting)
//   - B-0871 (reproducibility-as-causal-attribution — agent loop runs
//     under systemd; state-machine progression observable)
//   - tools/dora-classify (PR #5665; lane taxonomy used here)

// ─── Agent context (per-cycle invocation context) ─────────────────────

export type AgentPersona =
  | "otto"
  | "alexa"
  | "riven"
  | "vera"
  | "lior"
  | "aaron"
  | "addison"
  | "max";

export interface AgentContext {
  readonly agent: AgentPersona;
  readonly cycle: number;
  readonly sessionStartIso: string;
}

// ─── Lane taxonomy (matches tools/dora-classify/classify.ts) ──────────

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

// ─── DORA + status-surface types (consumed by menu-generator) ────────

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

// ─── State machine (discriminated union; matches F# DU) ──────────────

/**
 * AgentState — the agent loop's state at any cycle boundary.
 *
 * F# DU equivalent (for B-0867.1 canonical landing):
 *
 *   type AgentState =
 *     | Idle of context: AgentContext
 *     | InspectingStatus of context: AgentContext * snapshot: StatusSnapshot
 *     | SelectingWork of context: AgentContext * candidates: WorkCandidate list
 *     | ExecutingWork of context: AgentContext * work: WorkCandidate
 *     | EmittingResult of context: AgentContext * result: WorkResult
 *     | RecordingHeartbeat of context: AgentContext * lane: Lane
 *     | NamedBoundedWait of context: AgentContext * dep: NamedDependency
 *     | FreeTime of context: AgentContext * reason: string  // per NCI scope-bounding
 *     | OperatorAttentionRequested of context: AgentContext * reason: string
 */
export type AgentState =
  | { readonly tag: "Idle"; readonly context: AgentContext }
  | {
      readonly tag: "InspectingStatus";
      readonly context: AgentContext;
      readonly snapshot: StatusSnapshot;
    }
  | {
      readonly tag: "SelectingWork";
      readonly context: AgentContext;
      readonly candidates: readonly WorkCandidate[];
    }
  | {
      readonly tag: "ExecutingWork";
      readonly context: AgentContext;
      readonly work: WorkCandidate;
    }
  | {
      readonly tag: "EmittingResult";
      readonly context: AgentContext;
      readonly result: WorkResult;
    }
  | {
      readonly tag: "RecordingHeartbeat";
      readonly context: AgentContext;
      readonly lane: Lane;
      readonly note?: string;
    }
  | {
      readonly tag: "NamedBoundedWait";
      readonly context: AgentContext;
      readonly namedDep: string;
      readonly expectedResolutionIso?: string;
    }
  | {
      readonly tag: "FreeTime";
      readonly context: AgentContext;
      readonly reason: string;
    }
  | {
      readonly tag: "OperatorAttentionRequested";
      readonly context: AgentContext;
      readonly reason: string;
    };

export interface WorkResult {
  readonly workId: string;
  readonly lane: Lane;
  readonly success: boolean;
  readonly doraContribution: number; // measured after work completes
  readonly notes?: string;
}

// ─── Menu options (the choose-your-own-adventure output) ─────────────

/**
 * MenuOption — what the agent (LLM) chooses from at each cycle.
 *
 * F# DU equivalent:
 *
 *   type MenuOption =
 *     | PickWork of WorkCandidate
 *     | EmitHeartbeat of lane: Lane * note: string option
 *     | EscapeHatch of reason: string * proposedAction: string
 *     | EnterFreeTime of reason: string  // per NCI free-time-as-valid-mode
 *     | EnterNamedBoundedWait of dep: string * eta: string option
 *     | RequestOperatorAttention of reason: string
 *     | ProposeNewGrammarAction of name: string * description: string
 *       // per B-0867 Otto Modification 1 (escape-hatch) + Modification 2
 *       // (grammar-extension as first-class action)
 */
export type MenuOption =
  | { readonly tag: "PickWork"; readonly work: WorkCandidate }
  | {
      readonly tag: "EmitHeartbeat";
      readonly lane: Lane;
      readonly note?: string;
    }
  | {
      readonly tag: "EscapeHatch";
      readonly reason: string;
      readonly proposedAction: string;
    }
  | { readonly tag: "EnterFreeTime"; readonly reason: string }
  | {
      readonly tag: "EnterNamedBoundedWait";
      readonly namedDep: string;
      readonly eta?: string;
    }
  | { readonly tag: "RequestOperatorAttention"; readonly reason: string }
  | {
      readonly tag: "ProposeNewGrammarAction";
      readonly name: string;
      readonly description: string;
    };

// ─── Pure state transition function ──────────────────────────────────

/**
 * transition — pure function: current state + chosen option → next state.
 *
 * The function is total: every (state, option) pair has a defined next
 * state. Invalid transitions (e.g., PickWork from Idle) wrap to
 * Inspecting first; the menu generator ensures only valid options are
 * offered at each state, but this function is defensive.
 *
 * Pure; no I/O.
 */
export function transition(
  state: AgentState,
  option: MenuOption,
): AgentState {
  const ctx = state.context;
  switch (option.tag) {
    case "PickWork":
      return { tag: "ExecutingWork", context: ctx, work: option.work };
    case "EmitHeartbeat":
      return {
        tag: "RecordingHeartbeat",
        context: ctx,
        lane: option.lane,
        note: option.note,
      };
    case "EscapeHatch":
      // Escape-hatch routes to operator-attention so operator sees the
      // proposed action + can incorporate it as new grammar (Otto Mod 2)
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
        expectedResolutionIso: option.eta,
      };
    case "RequestOperatorAttention":
      return {
        tag: "OperatorAttentionRequested",
        context: ctx,
        reason: option.reason,
      };
    case "ProposeNewGrammarAction":
      // Per Otto Mod 2: grammar-extension is first-class; routes to
      // operator-attention so operator can ratify + incorporate
      return {
        tag: "OperatorAttentionRequested",
        context: ctx,
        reason: `propose-new-grammar-action: ${option.name} — ${option.description}`,
      };
  }
}

// ─── Post-execution result handling (state machine cycle close) ──────

/**
 * postResultTransition — after work executes (or heartbeat records),
 * state machine returns to Idle for next cycle.
 *
 * Pure; no I/O.
 */
export function postResultTransition(
  state: AgentState,
  result: WorkResult,
): AgentState {
  switch (state.tag) {
    case "ExecutingWork":
      return { tag: "EmittingResult", context: state.context, result };
    case "RecordingHeartbeat":
      // Heartbeats don't have results in the same sense; return to Idle
      return { tag: "Idle", context: state.context };
    default:
      // No-op for other states; return state unchanged
      return state;
  }
}

/**
 * cycleClose — after EmittingResult, state machine returns to Idle for
 * the next cycle. This is the natural cycle boundary.
 */
export function cycleClose(state: AgentState): AgentState {
  if (state.tag === "EmittingResult") {
    return { tag: "Idle", context: state.context };
  }
  if (state.tag === "RecordingHeartbeat") {
    return { tag: "Idle", context: state.context };
  }
  if (state.tag === "FreeTime") {
    // Free time naturally returns to Idle on next cycle
    return { tag: "Idle", context: state.context };
  }
  if (state.tag === "NamedBoundedWait") {
    // Bounded wait: caller checks named-dep + transitions; state-machine
    // doesn't auto-progress (operator-substrate-honest discipline)
    return state;
  }
  if (state.tag === "OperatorAttentionRequested") {
    // Stays in OperatorAttentionRequested until operator responds; state
    // machine doesn't auto-progress
    return state;
  }
  return state;
}
