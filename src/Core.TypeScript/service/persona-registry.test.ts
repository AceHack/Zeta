import { describe, expect, test } from "bun:test";
import { getPersona, listPersonas, PERSONAS } from "./persona-registry";

describe("persona-registry", () => {
  test("lists all personas", () => {
    const names = listPersonas();
    expect(names).toContain("kiro");
    expect(names).toContain("otto");
    expect(names).toContain("riven");
    expect(names.length).toBeGreaterThanOrEqual(6);
  });

  test("getPersona returns config for valid name", () => {
    const kiro = getPersona("kiro");
    expect(kiro).toBeDefined();
    expect(kiro!.name).toBe("kiro");
    expect(kiro!.label).toContain("kiro");
    expect(kiro!.scheduleInterval).toBe(60);
  });

  test("getPersona returns undefined for unknown name", () => {
    expect(getPersona("nonexistent")).toBeUndefined();
  });

  test("all personas have unique labels", () => {
    const labels = PERSONAS.map((p) => p.label);
    expect(new Set(labels).size).toBe(labels.length);
  });
});
