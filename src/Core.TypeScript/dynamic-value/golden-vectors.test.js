import { test, expect } from "bun:test";
import vectors from "./golden-vectors.json";
import { canonicalJson } from "./json";
const seed = vectors;
test("seed identifies as DynamicValue v1", () => {
    expect(seed.primitive).toBe("DynamicValue");
    expect(seed.version).toBe(1);
    expect(seed.vectors.length).toBeGreaterThan(0);
});
for (const v of seed.vectors) {
    test(`byte-lock encode: ${v.name}`, () => {
        // encode(value) === canonical json (the byte-lock target)
        const enc = canonicalJson(v.value);
        expect(enc.ok).toBe(true);
        expect(enc.ok ? enc.value : "").toBe(v.json);
        // the canonical json is itself valid JSON (block body — don't return JSON.parse's `any`)
        expect(() => {
            JSON.parse(v.json);
        }).not.toThrow();
    });
}
