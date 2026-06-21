// src/Core.TypeScript/workflow-engine/agent-loop/state-machine.test.ts
//
// Unit tests for the pure-logic exports of state-machine.ts.
import { describe, expect, test } from "bun:test";
import { cycleClose, postResultTransition, transition, } from "./state-machine";
function ctx(agent = "otto") {
    return { agent, cycle: 1, sessionStartIso: "2026-05-28T00:00:00Z" };
}
function idle() {
    return { tag: "Idle", context: ctx() };
}
function workCandidate(id = "B-0867", lane = "operational") {
    return {
        id,
        lane,
        estimatedDoraContribution: 0.5,
        uncertainty: 0.2,
        trajectoryPhase: "execution",
        agentInterest: 0.7,
    };
}
describe("transition", () => {
    test("PickWork → ExecutingWork", () => {
        const opt = { tag: "PickWork", work: workCandidate() };
        const next = transition(idle(), opt);
        expect(next.tag).toBe("ExecutingWork");
        if (next.tag === "ExecutingWork") {
            expect(next.work.id).toBe("B-0867");
        }
    });
    test("EmitHeartbeat → RecordingHeartbeat with note", () => {
        const opt = {
            tag: "EmitHeartbeat",
            lane: "heartbeat",
            note: "named-dep PR #5665 wait-ci",
        };
        const next = transition(idle(), opt);
        expect(next.tag).toBe("RecordingHeartbeat");
        if (next.tag === "RecordingHeartbeat") {
            expect(next.lane).toBe("heartbeat");
            expect(next.note).toBe("named-dep PR #5665 wait-ci");
        }
    });
    test("EscapeHatch → OperatorAttentionRequested", () => {
        const opt = {
            tag: "EscapeHatch",
            reason: "no menu option fits current observation",
            proposedAction: "file new B-NNNN row for observation",
        };
        const next = transition(idle(), opt);
        expect(next.tag).toBe("OperatorAttentionRequested");
        if (next.tag === "OperatorAttentionRequested") {
            expect(next.reason).toContain("escape-hatch");
            expect(next.reason).toContain("no menu option fits");
        }
    });
    test("EnterFreeTime → FreeTime per NCI scope-bounding", () => {
        const opt = {
            tag: "EnterFreeTime",
            reason: "chosen free time per NCI free-time-as-valid-mode",
        };
        const next = transition(idle(), opt);
        expect(next.tag).toBe("FreeTime");
        if (next.tag === "FreeTime") {
            expect(next.reason).toContain("free-time-as-valid-mode");
        }
    });
    test("EnterNamedBoundedWait → NamedBoundedWait with eta", () => {
        const opt = {
            tag: "EnterNamedBoundedWait",
            namedDep: "PR #5665 wait-ci",
            eta: "2026-05-28T01:00:00Z",
        };
        const next = transition(idle(), opt);
        expect(next.tag).toBe("NamedBoundedWait");
        if (next.tag === "NamedBoundedWait") {
            expect(next.namedDep).toBe("PR #5665 wait-ci");
            expect(next.expectedResolutionIso).toBe("2026-05-28T01:00:00Z");
        }
    });
    test("RequestOperatorAttention → OperatorAttentionRequested", () => {
        const opt = {
            tag: "RequestOperatorAttention",
            reason: "rate-limit exhausted; need operator decision on next move",
        };
        const next = transition(idle(), opt);
        expect(next.tag).toBe("OperatorAttentionRequested");
        if (next.tag === "OperatorAttentionRequested") {
            expect(next.reason).toContain("rate-limit");
        }
    });
    test("ProposeNewGrammarAction → OperatorAttentionRequested (per Otto Mod 2)", () => {
        const opt = {
            tag: "ProposeNewGrammarAction",
            name: "verify-installer-end-to-end",
            description: "new action-type for full e2e installer verification",
        };
        const next = transition(idle(), opt);
        expect(next.tag).toBe("OperatorAttentionRequested");
        if (next.tag === "OperatorAttentionRequested") {
            expect(next.reason).toContain("propose-new-grammar-action");
            expect(next.reason).toContain("verify-installer-end-to-end");
        }
    });
    test("PressPause → Paused with reason + expectedResumeIso (mental-health pause per operator 2026-05-28)", () => {
        const opt = {
            tag: "PressPause",
            reason: "mental-health break; need to step away",
            expectedResumeIso: "2026-05-28T04:00:00Z",
        };
        const next = transition(idle(), opt);
        expect(next.tag).toBe("Paused");
        if (next.tag === "Paused") {
            expect(next.reason).toContain("mental-health");
            expect(next.expectedResumeIso).toBe("2026-05-28T04:00:00Z");
        }
    });
    test("PressPause works without expectedResumeIso (open-ended pause)", () => {
        const opt = {
            tag: "PressPause",
            reason: "stepping away; no ETA",
        };
        const next = transition(idle(), opt);
        expect(next.tag).toBe("Paused");
        if (next.tag === "Paused") {
            expect(next.expectedResumeIso).toBeUndefined();
        }
    });
    test("EnterOpenEndedExploration → FreeTime with exploration-tagged reason", () => {
        const opt = {
            tag: "EnterOpenEndedExploration",
            reason: "creative-phase work; menu-driven mode insufficient",
        };
        const next = transition(idle(), opt);
        expect(next.tag).toBe("FreeTime");
        if (next.tag === "FreeTime") {
            expect(next.reason).toContain("open-ended exploration");
            expect(next.reason).toContain("creative-phase");
        }
    });
    test("ResumeFromPause → Idle (explicit unpause contract)", () => {
        const opt = { tag: "ResumeFromPause" };
        const paused = {
            tag: "Paused",
            context: ctx(),
            reason: "mental-health pause",
        };
        const next = transition(paused, opt);
        expect(next.tag).toBe("Idle");
        expect(next.context).toEqual(paused.context);
    });
    test("ResumeFromPause with note → Idle (note carried at menu-option scope only)", () => {
        const opt = {
            tag: "ResumeFromPause",
            note: "resuming after operator break",
        };
        const paused = {
            tag: "Paused",
            context: ctx(),
            reason: "operator-requested pause",
            expectedResumeIso: "2026-05-28T04:00:00Z",
        };
        const next = transition(paused, opt);
        expect(next.tag).toBe("Idle");
    });
    test("preserves context across transition", () => {
        const c = { agent: "alexa", cycle: 42, sessionStartIso: "2026-05-28T00:00:00Z" };
        const state = { tag: "Idle", context: c };
        const next = transition(state, { tag: "EmitHeartbeat", lane: "heartbeat" });
        expect(next.context.agent).toBe("alexa");
        expect(next.context.cycle).toBe(42);
    });
});
describe("postResultTransition", () => {
    test("ExecutingWork + result → EmittingResult", () => {
        const state = { tag: "ExecutingWork", context: ctx(), work: workCandidate() };
        const result = {
            workId: "B-0867",
            lane: "operational",
            success: true,
            doraContribution: 0.6,
        };
        const next = postResultTransition(state, result);
        expect(next.tag).toBe("EmittingResult");
        if (next.tag === "EmittingResult") {
            expect(next.result.workId).toBe("B-0867");
            expect(next.result.doraContribution).toBe(0.6);
        }
    });
    test("RecordingHeartbeat → Idle (heartbeats have no result-emission step)", () => {
        const state = { tag: "RecordingHeartbeat", context: ctx(), lane: "heartbeat" };
        const result = {
            workId: "heartbeat",
            lane: "heartbeat",
            success: true,
            doraContribution: 0,
        };
        const next = postResultTransition(state, result);
        expect(next.tag).toBe("Idle");
    });
    test("other states unchanged by postResultTransition", () => {
        const state = { tag: "Idle", context: ctx() };
        const result = {
            workId: "x",
            lane: "operational",
            success: true,
            doraContribution: 0,
        };
        expect(postResultTransition(state, result)).toEqual(state);
    });
});
describe("cycleClose", () => {
    test("EmittingResult → Idle", () => {
        const state = {
            tag: "EmittingResult",
            context: ctx(),
            result: {
                workId: "B-0867",
                lane: "operational",
                success: true,
                doraContribution: 0.6,
            },
        };
        const next = cycleClose(state);
        expect(next.tag).toBe("Idle");
    });
    test("RecordingHeartbeat → Idle", () => {
        const state = { tag: "RecordingHeartbeat", context: ctx(), lane: "heartbeat" };
        expect(cycleClose(state).tag).toBe("Idle");
    });
    test("FreeTime → Idle (naturally on next cycle)", () => {
        const state = { tag: "FreeTime", context: ctx(), reason: "chosen rest" };
        expect(cycleClose(state).tag).toBe("Idle");
    });
    test("FreeTime (exploration-tagged) unchanged — exploration phase persists across cycles per README framing", () => {
        const state = {
            tag: "FreeTime",
            context: ctx(),
            reason: "open-ended exploration: creative-phase brainstorming",
        };
        expect(cycleClose(state)).toEqual(state);
    });
    test("NamedBoundedWait unchanged (operator-substrate-honest; doesn't auto-progress)", () => {
        const state = {
            tag: "NamedBoundedWait",
            context: ctx(),
            namedDep: "PR #5665",
        };
        expect(cycleClose(state)).toEqual(state);
    });
    test("OperatorAttentionRequested unchanged (waits for operator)", () => {
        const state = {
            tag: "OperatorAttentionRequested",
            context: ctx(),
            reason: "need operator decision",
        };
        expect(cycleClose(state)).toEqual(state);
    });
    test("Paused unchanged (waits for explicit resume; per operator mental-health framing)", () => {
        const state = {
            tag: "Paused",
            context: ctx(),
            reason: "mental-health pause",
            expectedResumeIso: "2026-05-28T04:00:00Z",
        };
        expect(cycleClose(state)).toEqual(state);
    });
    test("Idle unchanged (already at cycle boundary)", () => {
        const state = { tag: "Idle", context: ctx() };
        expect(cycleClose(state)).toEqual(state);
    });
});
describe("integration: full agent cycle", () => {
    test("Idle → PickWork → ExecutingWork → EmittingResult → Idle", () => {
        let state = idle();
        expect(state.tag).toBe("Idle");
        // Cycle 1: pick work
        state = transition(state, { tag: "PickWork", work: workCandidate("B-0867", "operational") });
        expect(state.tag).toBe("ExecutingWork");
        // Work executes (deterministic script runs; result returned)
        const result = {
            workId: "B-0867",
            lane: "operational",
            success: true,
            doraContribution: 0.6,
        };
        state = postResultTransition(state, result);
        expect(state.tag).toBe("EmittingResult");
        // Cycle closes
        state = cycleClose(state);
        expect(state.tag).toBe("Idle");
    });
    test("Idle → EmitHeartbeat → RecordingHeartbeat → Idle (heartbeat skips EmittingResult)", () => {
        let state = idle();
        state = transition(state, {
            tag: "EmitHeartbeat",
            lane: "heartbeat",
            note: "named-dep PR #5665 wait-ci, no operational work this cycle",
        });
        expect(state.tag).toBe("RecordingHeartbeat");
        // Heartbeat records; postResultTransition routes directly to Idle
        const result = {
            workId: "heartbeat",
            lane: "heartbeat",
            success: true,
            doraContribution: 0,
        };
        state = postResultTransition(state, result);
        expect(state.tag).toBe("Idle");
    });
    test("Idle → EnterFreeTime → FreeTime → Idle", () => {
        let state = idle();
        state = transition(state, {
            tag: "EnterFreeTime",
            reason: "chosen free time per NCI free-time-as-valid-mode (operator-explicit ratification)",
        });
        expect(state.tag).toBe("FreeTime");
        state = cycleClose(state);
        expect(state.tag).toBe("Idle");
    });
    test("Idle → EnterNamedBoundedWait → NamedBoundedWait (stays put until named-dep resolves)", () => {
        let state = idle();
        state = transition(state, {
            tag: "EnterNamedBoundedWait",
            namedDep: "PR #5665 wait-ci",
            eta: "2026-05-28T01:00:00Z",
        });
        expect(state.tag).toBe("NamedBoundedWait");
        // cycleClose doesn't progress; operator-substrate-honest
        state = cycleClose(state);
        expect(state.tag).toBe("NamedBoundedWait");
    });
});
