// src/Core.TypeScript/workflow-engine/agent-loop/state-machine.ts
//
// 081KDWZ8TS008QG0R0020NJ9D0 substrate: agent-loop state machine types + pure-logic
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
// TS impl follows the same shape. When 081KDWZ8TS008QG0R000A4GT2F lands the F# types in
// src/Core.FSharp/WorkflowEngine/StateMachine.fs, the cross-verify
// harness pattern (per src/Core.TypeScript/zeta-id/cross-verify.ts) will
// validate TS ↔ F# round-trip equivalence.
//
// Composes with:
//   - 081KSKBP80008QG0R000B3Y19A (workflow engine v1 — this module IS 081KDWZ8TS008QG0R0020NJ9D0)
//   - 081KSKBP80008QG0R001KK9WV6 (heartbeat folder — EmitHeartbeat menu option writes here)
//   - 081KSNY2Z0008QG0R000HENSVM (DORA mandate — operational lane gets priority via menu-gen)
//   - 081KSNY2Z0008QG0R000DA261F (two-mandate portfolio — per-agent operational-ratio feeds
//     into menu-generator's option-weighting)
//   - 081KSNY2Z0008QG0R003R0Z7D2 (reproducibility-as-causal-attribution — agent loop runs
//     under systemd; state-machine progression observable)
//   - tools/dora-classify (PR #5665; lane taxonomy used here)
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
export function transition(state, option) {
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
export function postResultTransition(state, result) {
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
export function cycleClose(state) {
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
