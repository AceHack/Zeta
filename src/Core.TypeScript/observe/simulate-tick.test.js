import { describe, expect, test } from "bun:test";
import { simulateTick, simulateAllScenarios, SCENARIOS, fakeSink } from "./simulate-tick";
describe("simulate-tick — loop stability (pure oracle, no LLM)", () => {
    test("every scenario completes without crash", async () => {
        const results = await simulateAllScenarios({ useLlm: false, verbose: false });
        for (const r of results) {
            expect(r.executeOk).toBe(true);
        }
    });
    test("oracle agreement is 100% when using oracle (tautology check)", async () => {
        const results = await simulateAllScenarios({ useLlm: false, verbose: false });
        for (const r of results) {
            expect(r.oracleAgreement).toBe(true);
        }
    });
    test("empty backlog → explore (forward motion, not idle)", async () => {
        const result = await simulateTick({
            world: SCENARIOS.empty,
            scenarioName: "empty",
            verbose: false,
        });
        expect(result.action.kind).toBe("explore");
        expect(result.nextWorld.mode).toBe("explore");
    });
    test("ready work → do_item", async () => {
        const result = await simulateTick({
            world: SCENARIOS.work,
            scenarioName: "work",
            verbose: false,
        });
        expect(result.action.kind).toBe("do_item");
        expect(result.nextWorld.backlog.length).toBe(0); // item consumed
    });
    test("ambiguous item → decompose", async () => {
        const result = await simulateTick({
            world: SCENARIOS.ambiguous,
            scenarioName: "ambiguous",
            verbose: false,
        });
        expect(result.action.kind).toBe("decompose");
        expect(result.nextWorld.backlog.length).toBe(2); // split into children
    });
    test("operator pending message → respond_to_operator", async () => {
        const result = await simulateTick({
            world: SCENARIOS.operator,
            scenarioName: "operator",
            verbose: false,
        });
        expect(result.action.kind).toBe("respond_to_operator");
    });
    test("operator pending ferry → preserve_ferry (outranks all)", async () => {
        const result = await simulateTick({
            world: SCENARIOS.ferry,
            scenarioName: "ferry",
            verbose: false,
        });
        expect(result.action.kind).toBe("preserve_ferry");
    });
    test("persisted mode → stays in that mode (work offered, not forced)", async () => {
        const result = await simulateTick({
            world: SCENARIOS.persisted_mode,
            scenarioName: "persisted_mode",
            verbose: false,
        });
        expect(result.action.kind).toBe("explore");
        expect(result.nextWorld.mode).toBe("explore");
    });
    test("fake sink accumulates events", async () => {
        const sink = fakeSink();
        await simulateTick({
            world: SCENARIOS.work,
            scenarioName: "work",
            sink,
            verbose: false,
        });
        // do_item goes through executeDoItem which appends Started + Succeeded
        expect(sink.state.events.length).toBeGreaterThan(0);
    });
});
describe("simulate-tick — DI injection", () => {
    test("custom world (not in SCENARIOS) works", async () => {
        const customWorld = {
            backlog: [{ id: "081KCUSTOM000001", title: "custom item", ready: true, ambiguous: false }],
        };
        const result = await simulateTick({
            world: customWorld,
            scenarioName: "custom",
            verbose: false,
        });
        expect(result.executeOk).toBe(true);
        expect(result.action.kind).toBe("do_item");
    });
    test("custom sink is used when provided", async () => {
        const sink = fakeSink();
        await simulateTick({
            world: SCENARIOS.empty,
            scenarioName: "empty",
            sink,
            verbose: false,
        });
        // explore → one event appended
        expect(sink.state.events.length).toBe(1);
        expect(sink.state.events[0].kind).toBe("explore");
    });
});
