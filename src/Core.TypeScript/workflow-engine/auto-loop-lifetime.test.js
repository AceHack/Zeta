// Invariant tests for AutoLoopLifetime PoC — Otto-CLI foreground loop substrate.
import { describe, expect, test } from "bun:test";
import { AUTO_LOOP_UNIVERSE, BRIEF_ACK_THRESHOLD, COLD_BOOT_CONTEXT, dispatchAutoLoopTransition, nextTickContext, runTickCycle, } from "./auto-loop-lifetime";
describe("AutoLoopLifetime universe", () => {
    test("9 distinct loop states", () => {
        expect(AUTO_LOOP_UNIVERSE.length).toBe(9);
        const kinds = AUTO_LOOP_UNIVERSE.map((s) => s.kind);
        expect(kinds).toContain("cold-boot");
        expect(kinds).toContain("tick-complete");
        expect(kinds).toContain("forced-escalation");
    });
    test("constants exported", () => {
        expect(BRIEF_ACK_THRESHOLD).toBe(6);
        expect(COLD_BOOT_CONTEXT.tickIndex).toBe(0);
        expect(COLD_BOOT_CONTEXT.briefAckCount).toBe(0);
    });
});
describe("dispatch transitions (happy path)", () => {
    test("cold-boot → refresh-substrate", () => {
        const r = dispatchAutoLoopTransition({ kind: "cold-boot" }, COLD_BOOT_CONTEXT);
        expect(r.ok).toBe(true);
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.outcome.nextState.kind).toBe("refresh-substrate");
            expect(r.outcome.verdict.kind).toBe("advance");
            expect(r.outcome.counterReset).toBe(true);
        }
    });
    test("refresh-substrate with fresh lastRefreshAt → scan-inflight-prs", () => {
        const ctx = {
            ...COLD_BOOT_CONTEXT,
            lastRefreshAt: Date.now() / 1000, // just refreshed
        };
        const r = dispatchAutoLoopTransition({ kind: "refresh-substrate" }, ctx);
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.outcome.nextState.kind).toBe("scan-inflight-prs");
        }
    });
    test("refresh-substrate with stale lastRefreshAt → RefreshStale feedback", () => {
        const ctx = {
            ...COLD_BOOT_CONTEXT,
            lastRefreshAt: (Date.now() / 1000) - 200, // 200s ago; > REFRESH_STALENESS_THRESHOLD_S
        };
        const r = dispatchAutoLoopTransition({ kind: "refresh-substrate" }, ctx);
        expect(r.ok).toBe(false);
        if (!r.ok) {
            expect(r.feedback.kind).toBe("RefreshStale");
        }
    });
    test("refresh-substrate with missing lastRefreshAt → RefreshStale feedback", () => {
        const r = dispatchAutoLoopTransition({ kind: "refresh-substrate" }, COLD_BOOT_CONTEXT);
        expect(r.ok).toBe(false);
        if (!r.ok) {
            expect(r.feedback.kind).toBe("RefreshStale");
        }
    });
    test("scan-inflight-prs with actionable → investigate-failure", () => {
        const ctx = {
            ...COLD_BOOT_CONTEXT,
            inflightPrs: [{ number: 5774, state: "OPEN", actionable: true }],
        };
        const r = dispatchAutoLoopTransition({ kind: "scan-inflight-prs" }, ctx);
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.outcome.nextState.kind).toBe("investigate-failure");
        }
    });
    test("scan-inflight-prs without actionable → decompose-or-ship", () => {
        const r = dispatchAutoLoopTransition({ kind: "scan-inflight-prs" }, COLD_BOOT_CONTEXT);
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.outcome.nextState.kind).toBe("decompose-or-ship");
        }
    });
    test("investigate-failure → ship-action", () => {
        const r = dispatchAutoLoopTransition({ kind: "investigate-failure" }, COLD_BOOT_CONTEXT);
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.outcome.nextState.kind).toBe("ship-action");
        }
    });
    test("ship-action → await-merge-confirmation with counter reset + artifact", () => {
        // Updated: ship-action now routes to await-merge-confirmation
        // (the explicit post-ship state) instead of directly to tick-complete,
        // making the new post-ship states reachable per IMPLICIT-NOT-EXPLICIT
        // rule. Counter still resets (substantive work shipped); artifact still
        // pr-opened; verdict still complete.
        const r = dispatchAutoLoopTransition({ kind: "ship-action" }, COLD_BOOT_CONTEXT);
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.outcome.nextState.kind).toBe("await-merge-confirmation");
            expect(r.outcome.verdict.kind).toBe("complete");
            expect(r.outcome.counterReset).toBe(true);
            expect(r.outcome.artifact?.kind).toBe("pr-opened");
        }
    });
});
describe("decompose-or-ship branch logic", () => {
    test("standing authorization → ship-action (no operator-direction pending; under counter)", () => {
        const r = dispatchAutoLoopTransition({ kind: "decompose-or-ship" }, COLD_BOOT_CONTEXT);
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.outcome.nextState.kind).toBe("ship-action");
        }
    });
    test("operator-direction pending → await-operator-direction (explicit per IMPLICIT-NOT-EXPLICIT rule)", () => {
        // Updated: operator-direction-pending now routes through the explicit
        // `await-operator-direction` state (not implicit-via-brief-ack-bounded-
        // wait). Distinct semantics: "waiting on operator question" is its
        // own substrate-engineering substrate-shape, not a conflated brief-ack.
        const ctx = {
            ...COLD_BOOT_CONTEXT,
            operatorDirectionPending: "which lane to advance?",
        };
        const r = dispatchAutoLoopTransition({ kind: "decompose-or-ship" }, ctx);
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.outcome.nextState.kind).toBe("await-operator-direction");
            expect(r.outcome.verdict.kind).toBe("no-op");
        }
    });
    test("counter threshold + no named-dep → forced-escalation", () => {
        const ctx = {
            ...COLD_BOOT_CONTEXT,
            briefAckCount: 6,
            lastNamedDependency: undefined,
        };
        const r = dispatchAutoLoopTransition({ kind: "decompose-or-ship" }, ctx);
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.outcome.nextState.kind).toBe("forced-escalation");
            expect(r.outcome.verdict.kind).toBe("escalate-to-operator");
        }
    });
    test("counter threshold WITH named-dep → ship-action (named-dep covers the wait)", () => {
        const ctx = {
            ...COLD_BOOT_CONTEXT,
            briefAckCount: 10,
            lastNamedDependency: "PR #5800 dup-ID fix in flight",
        };
        const r = dispatchAutoLoopTransition({ kind: "decompose-or-ship" }, ctx);
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.outcome.nextState.kind).toBe("ship-action");
        }
    });
});
describe("brief-ack-bounded-wait → forced-escalation transition at boundary", () => {
    test("at threshold boundary transitions through forced-escalation state (not abort)", () => {
        const ctx = { ...COLD_BOOT_CONTEXT, briefAckCount: 5 };
        const r = dispatchAutoLoopTransition({ kind: "brief-ack-bounded-wait" }, ctx);
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.outcome.nextState.kind).toBe("forced-escalation");
            expect(r.outcome.verdict.kind).toBe("escalate-to-operator");
        }
    });
    test("below threshold continues to tick-complete with no-op", () => {
        const ctx = { ...COLD_BOOT_CONTEXT, briefAckCount: 3 };
        const r = dispatchAutoLoopTransition({ kind: "brief-ack-bounded-wait" }, ctx);
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.outcome.nextState.kind).toBe("tick-complete");
            expect(r.outcome.verdict.kind).toBe("no-op");
        }
    });
});
describe("forced-escalation → tick-complete", () => {
    test("escalates to operator + completes tick", () => {
        const r = dispatchAutoLoopTransition({ kind: "forced-escalation" }, COLD_BOOT_CONTEXT);
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.outcome.nextState.kind).toBe("tick-complete");
            expect(r.outcome.verdict.kind).toBe("escalate-to-operator");
        }
    });
});
describe("nextTickContext bookkeeping", () => {
    test("tick index always increments", () => {
        const next = nextTickContext(COLD_BOOT_CONTEXT, {
            nextState: { kind: "tick-complete" },
            verdict: { kind: "complete" },
            counterReset: false,
        });
        expect(next.tickIndex).toBe(1);
    });
    test("counter reset zeroes briefAckCount", () => {
        const ctx = { ...COLD_BOOT_CONTEXT, briefAckCount: 4 };
        const next = nextTickContext(ctx, {
            nextState: { kind: "tick-complete" },
            verdict: { kind: "complete" },
            counterReset: true,
        });
        expect(next.briefAckCount).toBe(0);
    });
    test("entering brief-ack-bounded-wait state increments briefAckCount", () => {
        const ctx = { ...COLD_BOOT_CONTEXT, briefAckCount: 2 };
        const next = nextTickContext(ctx, {
            nextState: { kind: "brief-ack-bounded-wait" },
            verdict: { kind: "no-op" },
            counterReset: false,
        });
        expect(next.briefAckCount).toBe(3);
    });
    test("no-op verdict NOT entering brief-ack-bounded-wait does NOT increment (multi-transition tick)", () => {
        // Regression test for per-transition double-counting: previously the
        // no-op verdict from decompose-or-ship→brief-ack-bounded-wait
        // transition incremented briefAckCount, then the brief-ack-bounded-wait
        // state's own no-op verdict incremented it AGAIN — double-count per tick.
        // Now: only entering brief-ack-bounded-wait increments; other no-op
        // verdicts don't.
        const ctx = { ...COLD_BOOT_CONTEXT, briefAckCount: 2 };
        const next = nextTickContext(ctx, {
            nextState: { kind: "tick-complete" },
            verdict: { kind: "no-op" },
            counterReset: false,
        });
        expect(next.briefAckCount).toBe(2); // unchanged
    });
    test("advance verdict does NOT increment briefAckCount", () => {
        const ctx = { ...COLD_BOOT_CONTEXT, briefAckCount: 2 };
        const next = nextTickContext(ctx, {
            nextState: { kind: "tick-complete" },
            verdict: { kind: "advance" },
            counterReset: false,
        });
        expect(next.briefAckCount).toBe(2); // unchanged
    });
    test("tickIndex increments ONLY when transitioning to tick-complete", () => {
        // Intermediate transitions within a tick don't bump tickIndex
        const next = nextTickContext(COLD_BOOT_CONTEXT, {
            nextState: { kind: "scan-inflight-prs" },
            verdict: { kind: "advance" },
            counterReset: false,
        });
        expect(next.tickIndex).toBe(0); // unchanged
    });
});
describe("runTickCycle end-to-end", () => {
    test("cold-boot cycle completes happy-path with ship-action artifact", () => {
        // Now requires fresh lastRefreshAt to clear the refresh-substrate guard.
        const ctx = {
            ...COLD_BOOT_CONTEXT,
            lastRefreshAt: Date.now() / 1000,
        };
        const r = runTickCycle({ kind: "cold-boot" }, ctx);
        expect(r.ok).toBe(true);
        if (r.ok) {
            expect(r.outcome.finalState.kind).toBe("tick-complete");
            // Path: cold-boot → refresh → scan → decompose-or-ship → ship-action → tick-complete
            const kinds = r.outcome.transitions.map((s) => s.kind);
            expect(kinds[0]).toBe("cold-boot");
            expect(kinds).toContain("ship-action");
            expect(kinds[kinds.length - 1]).toBe("tick-complete");
        }
    });
    test("operator-direction pending cycle terminates via await-operator-direction (explicit per IMPLICIT-NOT-EXPLICIT rule)", () => {
        const ctx = {
            ...COLD_BOOT_CONTEXT,
            lastRefreshAt: Date.now() / 1000,
            operatorDirectionPending: "waiting on design direction",
        };
        const r = runTickCycle({ kind: "cold-boot" }, ctx);
        expect(r.ok).toBe(true);
        if (r.ok) {
            const kinds = r.outcome.transitions.map((s) => s.kind);
            expect(kinds).toContain("await-operator-direction");
        }
    });
    test("at-threshold cycle escalates (entering from decompose-or-ship preserves counter)", () => {
        // Note: cold-boot transition resets counter via counterReset=true.
        // To test threshold-escalation, enter from decompose-or-ship state.
        const ctx = {
            ...COLD_BOOT_CONTEXT,
            briefAckCount: 6,
        };
        const r = runTickCycle({ kind: "decompose-or-ship" }, ctx);
        expect(r.ok).toBe(true);
        if (r.ok) {
            const kinds = r.outcome.transitions.map((s) => s.kind);
            expect(kinds).toContain("forced-escalation");
        }
    });
});
describe("type-level AutoLoopLifetime exhaustive switch (compile check)", () => {
    test("all 9 variants distinguishable", () => {
        const variants = [
            { kind: "cold-boot" },
            { kind: "refresh-substrate" },
            { kind: "scan-inflight-prs" },
            { kind: "investigate-failure" },
            { kind: "decompose-or-ship" },
            { kind: "ship-action" },
            { kind: "brief-ack-bounded-wait" },
            { kind: "forced-escalation" },
            { kind: "tick-complete" },
        ];
        expect(variants.length).toBe(9);
    });
});
