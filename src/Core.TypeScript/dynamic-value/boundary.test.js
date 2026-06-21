import { test, expect } from "bun:test";
import {} from "./types";
import { canonicalJson, fromCanonicalJson } from "./json";
import { canonicalCbor, fromCanonicalCbor } from "./cbor";
import { canonicalXml, fromCanonicalXml } from "./xml";
import { canonicalYaml, fromCanonicalYaml } from "./yaml";
// Helper to construct nested arrays of a given depth
function makeNestedArray(depth) {
    let val = { t: "null" };
    for (let i = 0; i < depth; i++) {
        val = { t: "arr", v: [val] };
    }
    return val;
}
// Helper to construct nested objects of a given depth
function makeNestedObject(depth) {
    let val = { t: "null" };
    for (let i = 0; i < depth; i++) {
        val = { t: "obj", v: [["k", val]] };
    }
    return val;
}
test("depth limit boundary: array nesting depth 256 is accepted", () => {
    const v = makeNestedArray(256);
    // JSON
    const encJson = canonicalJson(v);
    expect(encJson.ok).toBe(true);
    if (encJson.ok) {
        expect(fromCanonicalJson(encJson.value)).toEqual({ ok: true, value: v });
    }
    // CBOR
    const encCbor = canonicalCbor(v);
    expect(encCbor.ok).toBe(true);
    if (encCbor.ok) {
        expect(fromCanonicalCbor(encCbor.value)).toEqual({ ok: true, value: v });
    }
    // XML
    const encXml = canonicalXml(v);
    expect(encXml.ok).toBe(true);
    if (encXml.ok) {
        expect(fromCanonicalXml(encXml.value)).toEqual({ ok: true, value: v });
    }
    // YAML
    const encYaml = canonicalYaml(v);
    expect(encYaml.ok).toBe(true);
    if (encYaml.ok) {
        expect(fromCanonicalYaml(encYaml.value)).toEqual({ ok: true, value: v });
    }
});
test("depth limit boundary: array nesting depth 257 is rejected", () => {
    const v = makeNestedArray(257);
    // JSON
    expect(canonicalJson(v)).toEqual({ ok: false, error: "NestingTooDeep" });
    // CBOR
    expect(canonicalCbor(v)).toEqual({ ok: false, error: "NestingTooDeep" });
    // XML
    expect(canonicalXml(v)).toEqual({ ok: false, error: "NestingTooDeep" });
    // YAML
    expect(canonicalYaml(v)).toEqual({ ok: false, error: "NestingTooDeep" });
});
test("depth limit boundary: object nesting depth 256 is accepted", () => {
    const v = makeNestedObject(256);
    // JSON
    const encJson = canonicalJson(v);
    expect(encJson.ok).toBe(true);
    if (encJson.ok) {
        expect(fromCanonicalJson(encJson.value)).toEqual({ ok: true, value: v });
    }
    // CBOR
    const encCbor = canonicalCbor(v);
    expect(encCbor.ok).toBe(true);
    if (encCbor.ok) {
        expect(fromCanonicalCbor(encCbor.value)).toEqual({ ok: true, value: v });
    }
    // XML
    const encXml = canonicalXml(v);
    expect(encXml.ok).toBe(true);
    if (encXml.ok) {
        expect(fromCanonicalXml(encXml.value)).toEqual({ ok: true, value: v });
    }
    // YAML
    const encYaml = canonicalYaml(v);
    expect(encYaml.ok).toBe(true);
    if (encYaml.ok) {
        expect(fromCanonicalYaml(encYaml.value)).toEqual({ ok: true, value: v });
    }
});
test("depth limit boundary: object nesting depth 257 is rejected", () => {
    const v = makeNestedObject(257);
    // JSON
    expect(canonicalJson(v)).toEqual({ ok: false, error: "NestingTooDeep" });
    // CBOR
    expect(canonicalCbor(v)).toEqual({ ok: false, error: "NestingTooDeep" });
    // XML
    expect(canonicalXml(v)).toEqual({ ok: false, error: "NestingTooDeep" });
    // YAML
    expect(canonicalYaml(v)).toEqual({ ok: false, error: "NestingTooDeep" });
});
test("depth limit boundary: decoder rejects nested structures exceeding depth limit", () => {
    // JSON
    const json257 = "[".repeat(257) + "null" + "]".repeat(257);
    expect(fromCanonicalJson(json257)).toEqual({ ok: false, error: "NestingTooDeep" });
    // XML
    const xml257 = "<arr>".repeat(257) + "<null/>" + "</arr>".repeat(257);
    expect(fromCanonicalXml(xml257)).toEqual({ ok: false, error: "NestingTooDeep" });
});
