import { test, expect } from "bun:test";
import manifest from "./golden-vectors-values.json";
import jsonSeed from "./golden-vectors.json";
import cborSeed from "./golden-vectors-cbor.json";
import { fromCanonicalJson } from "./json";
import { fromCanonicalCbor, fromHex } from "./cbor";
const key = (v) => JSON.stringify(v);
const entries = manifest.values;
const jsonVectors = jsonSeed.vectors;
const cborVectors = cborSeed.vectors;
const manifestByValue = new Map(entries.map((e) => [key(e.value), e.formats]));
test("manifest is non-empty and every value lists at least one format", () => {
    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries)
        expect(e.formats.length).toBeGreaterThan(0);
});
test("JSON seed is a faithful projection of the manifest", () => {
    for (const v of jsonVectors) {
        const fmts = manifestByValue.get(key(v.value));
        expect(fmts).toBeDefined();
        expect(fmts).toContain("json");
        const r = fromCanonicalJson(v.json);
        expect(r.ok).toBe(true);
        if (r.ok)
            expect(key(r.value)).toBe(key(v.value)); // encoding decodes back to the manifest value
    }
});
test("CBOR seed is a faithful projection of the manifest", () => {
    for (const v of cborVectors) {
        const fmts = manifestByValue.get(key(v.value));
        expect(fmts).toBeDefined();
        expect(fmts).toContain("cbor");
        const r = fromCanonicalCbor(fromHex(v.cbor));
        expect(r.ok).toBe(true);
        if (r.ok)
            expect(key(r.value)).toBe(key(v.value));
    }
});
test("each format projection is complete (every flagged manifest value is in that seed)", () => {
    const jsonValues = new Set(jsonVectors.map((v) => key(v.value)));
    const cborValues = new Set(cborVectors.map((v) => key(v.value)));
    for (const e of entries) {
        if (e.formats.includes("json"))
            expect(jsonValues.has(key(e.value))).toBe(true);
        if (e.formats.includes("cbor"))
            expect(cborValues.has(key(e.value))).toBe(true);
    }
});
test("CBOR and JSON agree on every value both express (nothing is single source of truth)", () => {
    const jsonByValue = new Map(jsonVectors.map((v) => [key(v.value), v]));
    const cborByValue = new Map(cborVectors.map((v) => [key(v.value), v]));
    let shared = 0;
    for (const e of entries) {
        if (!(e.formats.includes("json") && e.formats.includes("cbor")))
            continue;
        const jv = jsonByValue.get(key(e.value));
        const cv = cborByValue.get(key(e.value));
        expect(jv).toBeDefined();
        expect(cv).toBeDefined();
        if (!jv || !cv)
            continue;
        shared += 1;
        const fj = fromCanonicalJson(jv.json);
        const fc = fromCanonicalCbor(fromHex(cv.cbor));
        expect(fj.ok && fc.ok).toBe(true);
        if (fj.ok && fc.ok)
            expect(key(fj.value)).toBe(key(fc.value));
    }
    expect(shared).toBeGreaterThan(0); // there ARE values both formats express
});
