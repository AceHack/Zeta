import { test, expect } from "bun:test";
import { encode } from "./encoder";
import { parse } from "./dom";
// TS YAML encoder — (1) round-trips with the TS parser, (2) BYTE-IDENTICAL to the
// F# encoder (cross-language YAML byte-lock; the expected strings are the F#
// encoder's output, captured via fsi). YAML is the storage of record.
const I = (n) => ({ t: "Int", value: n });
const S = (s) => ({ t: "Str", value: s });
const M = (entries) => ({ t: "Map", entries });
const SEQ = (items) => ({ t: "Seq", items });
function roundtrips(v) {
    const r = parse(encode(v));
    return r.ok && JSON.stringify(toJ(r.value)) === JSON.stringify(toJ(v));
}
// bigint isn't JSON-serializable; normalize for structural compare
function toJ(v) {
    switch (v.t) {
        case "Int": return { t: "Int", value: v.value.toString() };
        case "Map": return { t: "Map", entries: v.entries.map(([k, c]) => [k, toJ(c)]) };
        case "Seq": return { t: "Seq", items: v.items.map(toJ) };
        default: return v;
    }
}
test("cross-language byte-lock: TS encode === F# encode (flat)", () => {
    const v = M([["b", I(2n)], ["a", S("x")], ["n", { t: "Null" }]]);
    expect(encode(v)).toBe('"b": 2\n"a": "x"\n"n": null\n');
});
test("cross-language byte-lock: TS encode === F# encode (nested)", () => {
    const v = M([
        ["outer", M([["inner", I(5n)]])],
        ["list", SEQ([I(1n), S("two")])],
    ]);
    expect(encode(v)).toBe('"outer":\n  "inner": 5\n"list":\n  - 1\n  - "two"\n');
});
test("strings round-trip as map values (ambiguous + escaped)", () => {
    for (const s of ["123", "true", "null", "", "  sp  ", "a: b", "# c", "- d", "[x", "{y", "&z",
        "line\nbreak", "tab\tsep", 'q"here', "back\\slash", "ret\rurn", "nul\0byte"]) {
        expect(roundtrips(M([["v", S(s)]]))).toBe(true);
    }
});
test("nesting round-trips", () => {
    for (const v of [
        SEQ([I(1n), I(2n), S("three")]),
        M([["outer", M([["inner", I(5n)]])]]),
        M([["list", SEQ([I(1n), I(2n)])]]),
        SEQ([M([["a", I(1n)]]), M([["b", I(2n)]])]),
    ]) {
        expect(roundtrips(v)).toBe(true);
    }
});
test("canonical determinism: same value → same bytes", () => {
    const v = M([["b", I(2n)], ["a", SEQ([S("x"), { t: "Bool", value: true }])]]);
    expect(encode(v)).toBe(encode(v));
});
