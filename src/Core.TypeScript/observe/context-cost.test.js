import { test, expect } from "bun:test";
import { measureHarness, assessDrift, frontmatterDescription, residentText } from "./context-cost";
// B-1016 drift-alert core — pure functions (no I/O). The CLI edge is exercised
// manually; the measurement + drift logic is what must be correct.
test("measureHarness sums whole-mode files into resident (harness × surface)", () => {
    const cost = measureHarness("test", [
        { path: "a", text: "abc", mode: "whole" }, // 3
        { path: "b", text: "café", mode: "whole" }, // 5 (é = 2 bytes)
        { path: "c", text: "🜂", mode: "whole" }, // 4 (astral)
    ]);
    expect(cost.resident.bytes).toBe(12);
    expect(cost.onDemand.bytes).toBe(0); // whole-mode: nothing on-demand
});
test("description-mode counts only the frontmatter description as resident", () => {
    const fileText = "---\nname: x\ndescription: hi there\n---\n\nlong body that is on-demand only, not resident at cold-boot";
    const cost = measureHarness("h", [{ path: "s", text: fileText, mode: "description" }]);
    expect(cost.resident.bytes).toBe(8); // "hi there"
    expect(cost.onDemand.bytes).toBe(measureHarness("h", [{ path: "s", text: fileText, mode: "whole" }]).resident.bytes - 8);
    expect(cost.onDemand.bytes).toBeGreaterThan(0);
});
test("frontmatterDescription extracts the value; residentText respects mode", () => {
    const t = "---\nname: a\ndescription: the carved description\n---\nbody";
    expect(frontmatterDescription(t)).toBe("the carved description");
    expect(residentText(t, "description")).toBe("the carved description");
    expect(residentText(t, "whole")).toBe(t);
    expect(frontmatterDescription("no frontmatter here")).toBe("");
});
test("measureHarness of empty manifest is Zero", () => {
    expect(measureHarness("empty", []).resident.bytes).toBe(0);
});
test("assessDrift flags over-budget growth (the alert), gating on resident", () => {
    const cost = measureHarness("h", [{ path: "f", text: "x".repeat(120), mode: "whole" }]);
    const v = assessDrift(cost, 100, 110);
    expect(v.current).toBe(120);
    expect(v.delta).toBe(20);
    expect(v.overBudget).toBe(true);
});
test("assessDrift passes within budget and reports shrink as negative delta", () => {
    const cost = measureHarness("h", [{ path: "f", text: "x".repeat(80), mode: "whole" }]);
    const v = assessDrift(cost, 100, 110);
    expect(v.delta).toBe(-20);
    expect(v.overBudget).toBe(false);
});
