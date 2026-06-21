import { describe, expect, test } from "bun:test";
import { toTagged, canonicalBytes } from "./canonical.js";
import { canonicalJson, fromCanonicalJson } from "../dynamic-value/json.js";
const dec = new TextDecoder();
const bytesToStr = (b) => dec.decode(b);
describe("toTagged", () => {
    test("null / bool / string map directly", () => {
        expect(toTagged(null)).toEqual({ t: "null" });
        expect(toTagged(true)).toEqual({ t: "bool", v: true });
        expect(toTagged(false)).toEqual({ t: "bool", v: false });
        expect(toTagged("hi")).toEqual({ t: "str", v: "hi" });
    });
    test("integer number → int with decimal-string value", () => {
        expect(toTagged(0)).toEqual({ t: "int", v: "0" });
        expect(toTagged(42)).toEqual({ t: "int", v: "42" });
        expect(toTagged(-7)).toEqual({ t: "int", v: "-7" });
    });
    test("non-safe-integer numbers throw (float, NaN, Infinity, out-of-range)", () => {
        expect(() => toTagged(3.14)).toThrow();
        expect(() => toTagged(Number.NaN)).toThrow();
        expect(() => toTagged(Number.POSITIVE_INFINITY)).toThrow();
        expect(() => toTagged(1e21)).toThrow(); // String(1e21) === "1e+21" → would crash canonicalJson's BigInt
        expect(() => toTagged(Number.MAX_SAFE_INTEGER + 1)).toThrow();
    });
    test("safe-integer bounds map directly", () => {
        expect(toTagged(Number.MAX_SAFE_INTEGER)).toEqual({ t: "int", v: "9007199254740991" });
        expect(toTagged(Number.MIN_SAFE_INTEGER)).toEqual({ t: "int", v: "-9007199254740991" });
    });
    test("empty object and empty array", () => {
        expect(toTagged({})).toEqual({ t: "obj", v: [] });
        expect(toTagged([])).toEqual({ t: "arr", v: [] });
    });
    test("array preserves order, recurses", () => {
        expect(toTagged([1, "a", true])).toEqual({
            t: "arr",
            v: [{ t: "int", v: "1" }, { t: "str", v: "a" }, { t: "bool", v: true }],
        });
    });
    test("object emits entries in SORTED key order", () => {
        const out = toTagged({ b: 2, a: 1, c: 3 });
        expect(out.t).toBe("obj");
        expect(out.v.map(([k]) => k)).toEqual(["a", "b", "c"]);
        expect(out.v).toEqual([
            ["a", { t: "int", v: "1" }],
            ["b", { t: "int", v: "2" }],
            ["c", { t: "int", v: "3" }],
        ]);
    });
    test("nested object sorts at every level", () => {
        const out = toTagged({ z: { y: 1, x: 2 }, a: 3 });
        expect(out.v.map(([k]) => k)).toEqual(["a", "z"]);
        const z = out.v[1][1];
        expect(z.v.map(([k]) => k)).toEqual(["x", "y"]);
    });
    test("undefined object properties are omitted (JSON parity)", () => {
        const out = toTagged({ a: 1, b: undefined, c: 3 });
        expect(out.v.map(([k]) => k)).toEqual(["a", "c"]);
    });
    test("unsupported value types throw (bigint, symbol, function)", () => {
        expect(() => toTagged(1n)).toThrow();
        expect(() => toTagged(Symbol("x"))).toThrow();
        expect(() => toTagged(() => 0)).toThrow();
    });
    test("lone surrogates throw (well-formedness — trust-core byte-collision guard)", () => {
        expect(() => toTagged("\uD800")).toThrow(); // lone high surrogate
        expect(() => toTagged("\uDC00")).toThrow(); // lone low surrogate
        expect(() => toTagged("a\uD83Db")).toThrow(); // high not followed by low
        expect(() => toTagged({ "\uD800": 1 })).toThrow(); // lone surrogate in an object key
    });
    test("valid surrogate pairs are accepted (astral code points)", () => {
        expect(toTagged("😀")).toEqual({ t: "str", v: "😀" });
        expect(toTagged("a😀b")).toEqual({ t: "str", v: "a😀b" });
    });
});
describe("canonicalBytes", () => {
    test("= encode(canonicalJson(toTagged(x)))", () => {
        const x = { b: 2, a: "hi", c: [1, 2] };
        const expected = canonicalJson(toTagged(x));
        expect(expected.ok).toBe(true);
        expect(bytesToStr(canonicalBytes(x))).toBe(expected.ok ? expected.value : "");
    });
    test("produces sorted-key minified canonical JSON", () => {
        expect(bytesToStr(canonicalBytes({ b: 2, a: 1 }))).toBe('{"a":1,"b":2}');
    });
    test("empty object / array canonical bytes", () => {
        expect(bytesToStr(canonicalBytes({}))).toBe("{}");
        expect(bytesToStr(canonicalBytes([]))).toBe("[]");
    });
    test("lone surrogate cannot collide with U+FFFD (rejected before encoding)", () => {
        // Without the guard, "\uD800" and "�" both UTF-8-encode to EF BF BD → collision.
        expect(() => canonicalBytes({ k: "\uD800" })).toThrow();
        expect(bytesToStr(canonicalBytes({ k: "�" }))).toBe('{"k":"�"}');
    });
    test("round-trips through the shared fromCanonicalJson", () => {
        const x = { name: "z", count: 3, nested: { k: "v" } };
        const json = bytesToStr(canonicalBytes(x));
        const back = fromCanonicalJson(json);
        expect(back.ok).toBe(true);
        if (back.ok) {
            const enc = canonicalJson(back.value);
            expect(enc.ok).toBe(true);
            if (enc.ok)
                expect(enc.value).toBe(json);
        }
    });
    test("determinism: key insertion order does not change the bytes", () => {
        const a = canonicalBytes({ one: 1, two: 2, three: 3 });
        const b = canonicalBytes({ three: 3, one: 1, two: 2 });
        expect(Buffer.from(a)).toEqual(Buffer.from(b));
    });
});
