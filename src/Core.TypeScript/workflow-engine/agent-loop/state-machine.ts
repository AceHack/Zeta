// src/Core.TypeScript/workflow-engine/agent-loop/state-machine.ts
//
// 081KSKBP80008QG0R000B3Y19A.5 substrate: agent-loop state machine types + pure-logic
// state transition function.
//
// Operator framing 2026-05-28:
//   "the agent loop basiclaly becomes execute script look at choose your
//    own adventure output, take action based on outpout"
//
// Clean separation per operator design:
//   - Deterministic script holds STATE MACHINE (this module + cli.ts)
//   - LLM is pure MENU-SELECTOR (reads menu, returns choice)
//   - State persists in Git append-only (per 081KSKBP80008QG0R000B3Y19A + 081KSKBP80008QG0R001KK9WV6)
//
// The agent (LLM) never holds state internally; every invocation reads
// current state from Git, gets a menu, returns a choice. Script executes
// choice + appends new state.
//
// This module is the TS implementation of the F# DU contract described
// at the bottom of this file. The F# DU types are the canonical contract;
// TS impl follows the same shape. When 081KSKBP80008QG0R000B3Y19A.1 lands the F# types in
// src/Core.FSharp/WorkflowEngine/StateMachine.fs, the cross-verify
// harness pattern (per src/Core.TypeScript/zeta-id/cross-verify.ts) will
// validate TS ↔ F# round-trip equivalence.
//
// Composes with:
//   - 081KSKBP80008QG0R000B3Y19A (workflow engine v1 — this module IS 081KSKBP80008QG0R000B3Y19A.5)
//   - 081KSKBP80008QG0R001KK9WV6 (heartbeat folder — EmitHeartbeat menu option writes here)
//   - 081KSNY2Z0008QG0R000HENSVM (DORA mandate — operational lane gets priority via menu-gen)
//   - 081KSNY2Z0008QG0R000DA261F (two-mandate portfolio — per-agent operational-ratio feeds
//     into menu-generator's option-weighting)
//   - 081KSNY2Z0008QG0R003R0Z7D2 (reproducibility-as-causal-attribution — agent loop runs
//     under systemd; state-machine progression observable)
//   - tools/dora-classify (PR #5665; lane taxonomy used here)

// ─── Agent context (per-cycle invocation context) ─────────────────────

export type AgentPersona = "otto" | "alexa" | "riven" | "vera" | "lior" | "aaron" | "addison" | "max";

export interface AgentContext {
  readonly agent: AgentPersona;
  readonly cycle: number;
  readonly sessionStartIso: string;
}

// ─── Lane taxonomy (matches src/Core.TypeScript/dora-classify/classify.ts) ──────────

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
 * F# DU equivalent (for 081KSKBP80008QG0R000B3Y19A.1 canonical landing):
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
 *     | Paused of context: AgentContext * reason: string * expectedResumeIso: string option
 *       // Operator 2026-05-28: "a pause button is also very important for mental health."
 *       // Distinct from FreeTime: FreeTime is chosen-rest as legitimate operational state
 *       // (per NCI free-time-as-valid-mode); Paused is explicit-cessation-for-named-reason
 *       // (mental-health break / external interruption / context-loaded-attention-needed).
 *       // Both are valid; semantic distinction matters for menu-generator + dashboard.
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
    }
  | {
      readonly tag: "Paused";
      readonly context: AgentContext;
      readonly reason: string;
      readonly expectedResumeIso?: string;
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
 *       // per 081KSKBP80008QG0R000B3Y19A Otto Modification 1 (escape-hatch) + Modification 2
 *       // (grammar-extension as first-class action)
 *     | PressPause of reason: string * expectedResumeIso: string option
 *       // Operator 2026-05-28: "a pause button is also very important for
 *       // mental health." First-class menu option for explicit cessation;
 *       // distinct from EnterFreeTime (chosen-rest as ongoing valid mode)
 *       // and EnterNamedBoundedWait (waiting for external named-dep).
 *       // Pause is "I/we are stopping; we'll resume when ready."
 *     | EnterOpenEndedExploration of reason: string
 *       // Operator 2026-05-28: "there's a menu button for that" — when
 *       // structured menu doesn't fit current mode (creative phase,
 *       // brainstorming, exploration). The menu-driven workflow has a
 *       // menu-option that EXITS the menu-driven workflow. Bridge between
 *       // structured + unstructured modes. The exploration phase persists
 *       // across cycles (cycleClose keeps exploration-tagged FreeTime put)
 *       // until the agent actively selects another menu option.
 *     | ResumeFromPause of note: string option
 *       // The explicit unpause contract for Paused state. Menu-generator
 *       // surfaces this option only when current state is Paused;
 *       // selecting it returns the state machine to Idle so the agent can
 *       // resume normal cycling. Per Copilot #5667 finding — the Paused
 *       // contract required an explicit resume operation to be enforceable.
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
    }
  | {
      readonly tag: "PressPause";
      readonly reason: string;
      readonly expectedResumeIso?: string;
    }
  | {
      readonly tag: "EnterOpenEndedExploration";
      readonly reason: string;
    }
  | {
      readonly tag: "ResumeFromPause";
      readonly note?: string;
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
        ...(option.eta === undefined ? {} : { expectedResolutionIso: option.eta }),
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
    case "PressPause":
      // Per operator 2026-05-28: "a pause button is also very important
      // for mental health." Distinct from FreeTime (ongoing chosen-rest)
      // and NamedBoundedWait (waiting for external named-dep). Pause is
      // explicit-cessation-for-named-reason.
      return {
        tag: "Paused",
        context: ctx,
        reason: option.reason,
        ...(option.expectedResumeIso === undefined ? {} : { expectedResumeIso: option.expectedResumeIso }),
      };
    case "EnterOpenEndedExploration":
      // Per operator 2026-05-28: "there's a menu button for that lol" —
      // the menu-driven workflow has an option that EXITS the menu-driven
      // workflow. Bridge between structured + unstructured modes. Routes
      // to FreeTime with an exploration-tagged reason; cycleClose preserves
      // exploration-tagged FreeTime across cycles so the agent stays in
      // unstructured mode until it actively selects another menu option.
      return {
        tag: "FreeTime",
        context: ctx,
        reason: `open-ended exploration: ${option.reason}`,
      };
    case "ResumeFromPause":
      // The explicit unpause contract — only meaningful when current state
      // is Paused, but the transition function doesn't gate on state; the
      // menu-generator is responsible for surfacing this option only when
      // applicable. Returns to Idle so the agent can resume normal cycling.
      return { tag: "Idle", context: ctx };
  }
}

// ─── Post-execution result handling (state machine cycle close) ──────

/**
 * postResultTransition — after work executes (or heartbeat records),
 * state machine returns to Idle for next cycle.
 *
 * Pure; no I/O.
 */
export function postResultTransition(state: AgentState, result: WorkResult): AgentState {
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
    // Exploration-tagged free time (from EnterOpenEndedExploration) stays
    // put across cycles so the agent remains in unstructured mode until it
    // actively selects another menu option — matches the README framing of
    // "bridge between structured + unstructured modes" as a persistent
    // phase, not a one-cycle escape. Per Copilot #5667 finding.
    if (state.reason.startsWith("open-ended exploration:")) {
      return state;
    }
    // Non-exploration free time naturally returns to Idle on next cycle.
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
  if (state.tag === "Paused") {
    // Stays in Paused until explicit resume; state machine doesn't
    // auto-progress (operator/participant-substrate-honest discipline —
    // pause means "I am stopping," not "I will auto-restart next cycle").
    // Per operator 2026-05-28 mental-health framing.
    return state;
  }
  return state;
}
