// tools/accelerator/local-llm.test.ts
//
// Backend-agnostic tests for the local-LLM primitive — mock the model, so these
// run anywhere with no model/account (the selection + fallback logic is what we
// validate here; the actual on-runner model is exercised by the workflow).
import { describe, expect, test } from "bun:test";
import { chooseIndex, classify } from "./local-llm.js";
function mockBackend(reply) {
    return { name: "mock", complete: async () => reply };
}
function throwingBackend() {
    return {
        name: "mock-throw",
        complete: async () => {
            throw new Error("model unavailable");
        },
    };
}
describe("chooseIndex — the CYOA / classifier choice primitive", () => {
    test("parses a clean index", async () => {
        const r = await chooseIndex(mockBackend("1"), { context: "x", options: ["a", "b", "c"] });
        expect(r).toEqual({ index: 1, raw: "1", fallback: false });
    });
    test("extracts the first digit from noisy output", async () => {
        const r = await chooseIndex(mockBackend("The best choice is 2 because…"), {
            context: "x",
            options: ["a", "b", "c"],
        });
        expect(r.index).toBe(2);
        expect(r.fallback).toBe(false);
    });
    test("falls back to 0 on an out-of-range index", async () => {
        const r = await chooseIndex(mockBackend("9"), { context: "x", options: ["a", "b"] });
        expect(r.index).toBe(0);
        expect(r.fallback).toBe(true);
    });
    test("falls back to 0 on non-numeric output", async () => {
        const r = await chooseIndex(mockBackend("banana"), { context: "x", options: ["a", "b"] });
        expect(r.index).toBe(0);
        expect(r.fallback).toBe(true);
    });
    test("falls back to 0 when the backend throws (loop never stalls)", async () => {
        const r = await chooseIndex(throwingBackend(), { context: "x", options: ["a", "b"] });
        expect(r.index).toBe(0);
        expect(r.fallback).toBe(true);
    });
    test("single option short-circuits with no model call", async () => {
        // throwingBackend would throw if called — proves no call happened.
        const r = await chooseIndex(throwingBackend(), { context: "x", options: ["only"] });
        expect(r).toEqual({ index: 0, raw: "", fallback: false });
    });
    test("empty options throws (caller bug, not a model failure)", async () => {
        await expect(chooseIndex(mockBackend("0"), { context: "x", options: [] })).rejects.toThrow();
    });
});
describe("classify — observe.ts auto-classifier shape", () => {
    test("maps the chosen index to its label", async () => {
        const r = await classify(mockBackend("0"), {
            input: "deploy rolled back after error spike",
            labels: ["incident", "normal"],
        });
        expect(r.label).toBe("incident");
        expect(r.index).toBe(0);
        expect(r.fallback).toBe(false);
    });
    test("fallback picks the first label safely", async () => {
        const r = await classify(throwingBackend(), { input: "x", labels: ["a", "b"] });
        expect(r.label).toBe("a");
        expect(r.fallback).toBe(true);
    });
});
