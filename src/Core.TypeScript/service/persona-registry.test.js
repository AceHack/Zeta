import { describe, expect, test } from "bun:test";
import { getPersona, listPersonas, PERSONAS } from "./persona-registry";
describe("persona-registry", () => {
    test("lists all personas", () => {
        const personas = listPersonas();
        const names = personas.map(p => p.name);
        expect(names).toContain("kiro");
        expect(names).toContain("otto");
        expect(names).toContain("riven");
        expect(personas.length).toBeGreaterThanOrEqual(6);
    });
    test("getPersona returns config for valid name", () => {
        const kiro = getPersona("kiro");
        expect(kiro).toBeDefined();
        expect(kiro.name).toBe("kiro");
        expect(kiro.label).toContain("kiro");
        expect(kiro.scheduleInterval).toBe(60);
        expect(kiro.gateInterval).toBeGreaterThan(0);
        expect(kiro.harness.command).toBe("kiro-cli");
    });
    test("getPersona returns undefined for unknown name", () => {
        expect(getPersona("nonexistent")).toBeUndefined();
    });
    test("all personas have unique labels", () => {
        const labels = PERSONAS.map((p) => p.label);
        expect(new Set(labels).size).toBe(labels.length);
    });
});
