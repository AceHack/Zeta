import { test, expect } from "bun:test";
import { T, F, N } from "./types";
import { fromBool, held, isLiving, isCertain, cooperate, measure, mapTri, bindTri, notTri, andTri, orTri, eq, } from "./tri-boolean";
test("constructors + predicates", () => {
    expect(eq(fromBool(true), T)).toBe(true);
    expect(eq(fromBool(false), F)).toBe(true);
    expect(eq(held(), N)).toBe(true);
    expect(isLiving(N)).toBe(true);
    expect(isLiving(T)).toBe(false);
    expect(isCertain(T)).toBe(true);
    expect(isCertain(N)).toBe(false);
});
test("cooperate never collapses (preserves Null; identity on all states)", () => {
    expect(eq(cooperate(N), N)).toBe(true);
    expect(eq(cooperate(T), T)).toBe(true);
    expect(eq(cooperate(F), F)).toBe(true);
});
test("measure: certain cells resolve; living(Null) is NOT silently collapsed (feedback surfaced)", () => {
    expect(measure(T)).toEqual({ ok: true, value: true });
    expect(measure(F)).toEqual({ ok: true, value: false });
    const m = measure(N);
    expect(m.ok).toBe(false);
    if (!m.ok)
        expect(m.feedback.reason).toBe("collapsed-living-uncertainty");
});
test("null-monad: Null propagates through map and bind (held stays held)", () => {
    expect(eq(mapTri(N, (b) => !b), N)).toBe(true);
    expect(eq(mapTri(T, (b) => !b), F)).toBe(true);
    expect(eq(mapTri(F, (b) => !b), T)).toBe(true);
    expect(eq(bindTri(N, () => T), N)).toBe(true);
    expect(eq(bindTri(T, (b) => fromBool(!b)), F)).toBe(true);
});
test("map identity law: mapTri(t, x => x) === t for all three states", () => {
    for (const t of [T, F, N])
        expect(eq(mapTri(t, (b) => b), t)).toBe(true);
});
test("Kleene NOT (unknown stays unknown)", () => {
    expect(eq(notTri(T), F)).toBe(true);
    expect(eq(notTri(F), T)).toBe(true);
    expect(eq(notTri(N), N)).toBe(true);
});
test("Kleene AND: F dominates; Null only when no F present", () => {
    expect(eq(andTri(F, N), F)).toBe(true);
    expect(eq(andTri(N, F), F)).toBe(true);
    expect(eq(andTri(T, N), N)).toBe(true);
    expect(eq(andTri(N, N), N)).toBe(true);
    expect(eq(andTri(T, T), T)).toBe(true);
    expect(eq(andTri(T, F), F)).toBe(true);
});
test("Kleene OR: T dominates; Null only when no T present", () => {
    expect(eq(orTri(T, N), T)).toBe(true);
    expect(eq(orTri(N, T), T)).toBe(true);
    expect(eq(orTri(F, N), N)).toBe(true);
    expect(eq(orTri(N, N), N)).toBe(true);
    expect(eq(orTri(F, F), F)).toBe(true);
    expect(eq(orTri(T, F), T)).toBe(true);
});
