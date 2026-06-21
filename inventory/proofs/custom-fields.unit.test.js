/**
 * Inventory — Phase 5 custom-field UNIT tests (pure, no network, deterministic)
 * ---------------------------------------------------------------------------
 * Tests the SHARED logic in inventory/lib/custom-fields.js that BOTH the browser
 * (index.html) and these tests use — so the typed sort / coercion / validation
 * are covered in isolation, not only end-to-end (the phase that "most needs
 * ongoing assertions", per the owner's brief).
 *
 * Run:  bun test inventory/proofs/custom-fields.unit.test.ts
 *
 * Includes the BROKEN-vs-FIXED demonstration the CLAUDE.md requires: a naive
 * string comparator yields the wrong numeric order (10,100,9); the real
 * comparator yields the correct order (9,10,100).
 */
import { describe, test, expect } from "bun:test";
import CF from "../lib/custom-fields.js";
const def = (type, options) => ({ key: "k", label: "K", type, options: options ?? null });
describe("coerceFormValue (raw form input -> typed value)", () => {
    test("text", () => {
        expect(CF.coerceFormValue(def("text"), "  hi ")).toEqual({ ok: true, value: "hi" });
        expect(CF.coerceFormValue(def("text"), "")).toEqual({ ok: true, value: null });
    });
    test("number accepts numeric, rejects text", () => {
        expect(CF.coerceFormValue(def("number"), "42")).toEqual({ ok: true, value: 42 });
        expect(CF.coerceFormValue(def("number"), "-3.5")).toEqual({ ok: true, value: -3.5 });
        expect(CF.coerceFormValue(def("number"), "")).toEqual({ ok: true, value: null });
        expect(CF.coerceFormValue(def("number"), "abc").ok).toBe(false);
        expect(CF.coerceFormValue(def("number"), "1e999").ok).toBe(false); // Infinity rejected
    });
    test("date accepts real calendar dates, rejects impossible ones", () => {
        expect(CF.coerceFormValue(def("date"), "2024-02-29")).toEqual({ ok: true, value: "2024-02-29" });
        expect(CF.coerceFormValue(def("date"), "2023-02-29").ok).toBe(false); // not a leap year
        expect(CF.coerceFormValue(def("date"), "2024-13-40").ok).toBe(false);
        expect(CF.coerceFormValue(def("date"), "nope").ok).toBe(false);
    });
    test("dropdown enforces option membership", () => {
        const d = def("dropdown", ["red", "green"]);
        expect(CF.coerceFormValue(d, "green")).toEqual({ ok: true, value: "green" });
        expect(CF.coerceFormValue(d, "purple").ok).toBe(false);
        expect(CF.coerceFormValue(d, "")).toEqual({ ok: true, value: null });
    });
    test("boolean tri-state select", () => {
        expect(CF.coerceFormValue(def("boolean"), "true")).toEqual({ ok: true, value: true });
        expect(CF.coerceFormValue(def("boolean"), "false")).toEqual({ ok: true, value: false });
        expect(CF.coerceFormValue(def("boolean"), "")).toEqual({ ok: true, value: null });
    });
});
describe("validateTypedValue (app-side mirror of the DB trigger)", () => {
    test("null is always allowed", () => {
        for (const t of CF.CUSTOM_TYPES)
            expect(CF.validateTypedValue(def(t, ["x"]), null).ok).toBe(true);
    });
    test("type mismatches rejected", () => {
        expect(CF.validateTypedValue(def("number"), "5").ok).toBe(false);
        expect(CF.validateTypedValue(def("boolean"), "true").ok).toBe(false);
        expect(CF.validateTypedValue(def("text"), 5).ok).toBe(false);
        expect(CF.validateTypedValue(def("dropdown", ["a"]), "b").ok).toBe(false);
    });
});
describe("numeric sort: BROKEN (string) vs FIXED (typed)", () => {
    const nums = ["10", "9", "100"]; // stored as JSON numbers; shown here as the values
    test("a naive STRING comparator gets it WRONG (10,100,9)", () => {
        const naive = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
        expect([...nums].sort(naive)).toEqual(["10", "100", "9"]); // the "10 < 9" bug
    });
    test("the REAL typed comparator gets it RIGHT (9,10,100)", () => {
        const real = (a, b) => CF.compareValues("num", a, b);
        expect([...nums].sort(real)).toEqual(["9", "10", "100"]);
    });
});
describe("compareValues: nulls, mixed, and the five types", () => {
    test("nulls sort last on ascending (treated as +inf, flipped by dir like core)", () => {
        const arr = [5, null, 1, 10, null];
        const sorted = [...arr].sort((a, b) => CF.compareValues("num", a, b));
        expect(sorted).toEqual([1, 5, 10, null, null]);
    });
    test("mixed/invalid values degrade gracefully (no throw; invalid last)", () => {
        const arr = [3, "not-a-number", 1, undefined, 2];
        let sorted = [];
        expect(() => {
            sorted = [...arr].sort((a, b) => CF.compareValues("num", a, b));
        }).not.toThrow();
        expect(sorted.slice(0, 3)).toEqual([1, 2, 3]); // valid numbers first, in order
    });
    test("date comparator is chronological, not lexicographic-on-prefix-only", () => {
        const arr = ["2024-12-01", "2024-02-28", "2024-02-29"];
        const sorted = [...arr].sort((a, b) => CF.compareValues("date", a, b));
        expect(sorted).toEqual(["2024-02-28", "2024-02-29", "2024-12-01"]);
    });
    test("boolean: false < true; nulls last", () => {
        const arr = [true, false, null, true];
        const sorted = [...arr].sort((a, b) => CF.compareValues("bool", a, b));
        expect(sorted).toEqual([false, true, true, null]);
    });
    test("string comparator is numeric-aware within text", () => {
        const arr = ["item10", "item2", "item1"];
        const sorted = [...arr].sort((a, b) => CF.compareValues("str", a, b));
        expect(sorted).toEqual(["item1", "item2", "item10"]);
    });
});
describe("searchTextForValue + displayText", () => {
    test("boolean is searchable as both true/yes and false/no", () => {
        expect(CF.searchTextForValue(def("boolean"), true)).toBe("true yes");
        expect(CF.searchTextForValue(def("boolean"), false)).toBe("false no");
    });
    test("null -> empty search text", () => {
        expect(CF.searchTextForValue(def("text"), null)).toBe("");
    });
    test("displayText renders booleans Yes/No and null as empty", () => {
        expect(CF.displayText(def("boolean"), true)).toBe("Yes");
        expect(CF.displayText(def("boolean"), false)).toBe("No");
        expect(CF.displayText(def("text"), null)).toBe("");
        expect(CF.displayText(def("number"), 0)).toBe("0");
    });
});
describe("admin helpers", () => {
    test("isValidKey enforces a safe slug", () => {
        expect(CF.isValidKey("warranty_expires")).toBe(true);
        expect(CF.isValidKey("Warranty")).toBe(false); // no uppercase
        expect(CF.isValidKey("2cool")).toBe(false); // must start with a letter
        expect(CF.isValidKey("has space")).toBe(false);
        expect(CF.isValidKey("")).toBe(false);
    });
    test("parseOptions splits, trims, de-dupes, drops empties", () => {
        expect(CF.parseOptions("red, green\n blue ,red,")).toEqual(["red", "green", "blue"]);
        expect(CF.parseOptions("")).toEqual([]);
    });
});
describe("isValidCalendarDate", () => {
    test("real vs impossible", () => {
        expect(CF.isValidCalendarDate("2024-02-29")).toBe(true);
        expect(CF.isValidCalendarDate("2023-02-29")).toBe(false);
        expect(CF.isValidCalendarDate("2024-00-10")).toBe(false);
        expect(CF.isValidCalendarDate("2024-1-1")).toBe(false); // must be zero-padded
    });
});
