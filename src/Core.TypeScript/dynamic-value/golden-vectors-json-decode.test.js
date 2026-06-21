import { test, expect } from "bun:test";
import vectors from "./golden-vectors.json";
import { fromCanonicalJson } from "./json";
const decodeErr = (s) => {
    const r = fromCanonicalJson(s);
    if (r.ok)
        throw new Error("expected decode failure");
    return r.error;
};
const seed = vectors;
for (const v of seed.vectors) {
    test(`json decode round-trip: ${v.name}`, () => {
        const r = fromCanonicalJson(v.json);
        // ok ⟹ the fixed-point check passed (canonicalJson(parsed) === input), i.e. the
        // round-trip holds against the already-verified encoder.
        expect(r.ok).toBe(true);
        if (r.ok) {
            // structural: decoded tagged value equals the seed value (incl. object key order)
            expect(JSON.stringify(r.value)).toBe(JSON.stringify(v.value));
        }
    });
}
test("json decode rejects malformed input", () => {
    expect(decodeErr("")).toBe("UnexpectedEnd"); // empty
    expect(decodeErr("tru")).toBe("UnexpectedEnd"); // truncated literal
    expect(decodeErr("[1,")).toBe("UnexpectedEnd"); // unterminated array
    expect(decodeErr('{"a"')).toBe("UnexpectedEnd"); // object missing colon+value
    expect(decodeErr('"unterminated')).toBe("UnexpectedEnd"); // unterminated string
    expect(decodeErr('"\\u00gg"')).toBe("UnexpectedEnd"); // \uXXXX with non-hex digits
    expect(decodeErr('"\\q"')).toBe("UnexpectedEnd"); // invalid escape
    expect(decodeErr("1.")).toBe("UnexpectedEnd"); // no digit after '.'
    expect(decodeErr("1e")).toBe("UnexpectedEnd"); // no exponent digits
    expect(decodeErr("1e+")).toBe("UnexpectedEnd"); // exponent sign without digits
    expect(decodeErr("-")).toBe("UnexpectedEnd"); // sign without digits
    expect(decodeErr("null x")).toBe("TrailingData"); // value + trailing token
    expect(decodeErr("nullnull")).toBe("TrailingData"); // two values
});
test("json decode rejects DEFERRED float-shaped numbers as Unsupported", () => {
    expect(decodeErr("1.5")).toBe("Unsupported"); // decimal point
    expect(decodeErr("1e10")).toBe("Unsupported"); // exponent
    expect(decodeErr("-0.0")).toBe("Unsupported"); // negative float
});
test("json decode rejects oversized integers", () => {
    expect(decodeErr("9223372036854775808")).toBe("IntegerOverflow"); // i64::MAX + 1
    expect(decodeErr("-9223372036854775809")).toBe("IntegerOverflow"); // i64::MIN - 1
});
test("json decode rejects non-canonical input", () => {
    expect(decodeErr(" null")).toBe("NonCanonical"); // leading whitespace
    expect(decodeErr("[1, 2]")).toBe("NonCanonical"); // space after comma
    expect(decodeErr("01")).toBe("NonCanonical"); // leading zero (BigInt("01")=1 → "1")
    expect(decodeErr('"\\u0041"')).toBe("NonCanonical"); // A = "A"; canonical emits raw "A"
    expect(decodeErr('{ "a":1}')).toBe("NonCanonical"); // whitespace inside object
});
