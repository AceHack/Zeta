// src/Core.TypeScript/protocol/agent-loop-contract.ts
//
// The agent loop's TYPE contract — the shape consumers agree to, with none of
// the loop's behaviour.
//
// ── WHY IT IS HERE AND NOT IN `workflow-engine/agent-loop/` ──────────────────
// `state-machine.ts` used to hold both halves: the pure DU/record types AND the
// transition functions that operate on them. Every consumer that wanted only
// the vocabulary — `corporate/dora.ts` wants `DoraMetrics`, `observe/merge-
// receipt.ts` wants `AgentPersona`, `corporate/slot-dispatch.ts` wants
// `MenuOption` — had to reach into the loop's implementation module to get it.
// That is nine files outside the meta-harness importing a harness internal for
// a type with no runtime, which is the coupling repo-split round 4 measured as
// part of the harness's 38 back-edges
// (`docs/research/2026-09-09-repo-split-round-4-*.md` §3.1).
//
// Under `.claude/rules/interfaces-free-classes-earned-under-rules.md` the split
// is the default, not a workaround: the interface half is FREE (pure shape, no
// instance state, nothing to capture) and belongs where anyone may depend on it;
// the behaviour half is the earned part and stays with its implementation. So
// the types live in the shared contract tier and `state-machine.ts` imports them
// back and re-exports them, which keeps every existing importer working.
//
// ── WHAT THIS MODULE MAY CONTAIN ────────────────────────────────────────────
// Types only. No functions, no constants, no imports. A value added here would
// make the contract a module both sides must EXECUTE rather than merely agree
// to, and the weight would be back.
//
// The F# DU comments below are kept verbatim from `state-machine.ts`: they are
// the canonical contract this TS shape follows, and they describe the types,
// not the transitions.

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
