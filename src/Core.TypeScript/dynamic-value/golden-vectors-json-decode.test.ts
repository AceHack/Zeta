import { test, expect } from "bun:test";
import vectors from "./golden-vectors.json";
import { type Tagged, type DecodeError, fromCanonicalJson } from "./json";

// DynamicValue canonical-JSON DECODE byte-lock — fromCanonicalJson is the inverse of
// canonicalJson, completing the text<->value round-trip for the 6 locked shapes (Float +
// Bytes are DEFERRED in JSON — they lock under CBOR, see cbor.ts). The decoder is strictly
// canonical (lenient parse → fixed-point check canonicalJson(parsed) === input →
// "NonCanonical"), so a successful decode of a seed vector is guaranteed to round-trip;
// int64 precision is preserved by parsing the number token as text (BigInt). This asserts
// decode succeeds + structurally matches the seed value, and that malformed / deferred /
// oversized / non-canonical inputs are rejected with the right DecodeError. The codec lives
// in ./json.ts (shared with encode). "The compilers don't lie."

interface Vector {
  name: string;
  value: Tagged;
  json: string;
}

const decodeErr = (s: string): DecodeError => {
  const r = fromCanonicalJson(s);
  if (r.ok) throw new Error("expected decode failure");
  return r.error;
};

const seed = vectors as unknown as { vectors: Vector[] };

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
