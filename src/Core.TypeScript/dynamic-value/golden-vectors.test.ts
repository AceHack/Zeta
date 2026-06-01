import { test, expect } from "bun:test";
import vectors from "./golden-vectors.json";

// DynamicValue TS oracle — grown FROM the seed (seed-first / grow-code-from-the-seed,
// Aaron 2026-06-01). This is the canonical-encode side of the byte-lock: the seed
// (golden-vectors.json) is the canonical DATA; this code AGREES on the JSON structure.
// v1 locks null/bool/int/string/array/object; Float + Bytes are DEFERRED (see the
// seed's `deferred` block). The decode side (precision-safe JSON tokenizer that keeps
// int64 as a string) is the next slice; this slice locks ENCODE + canonical-JSON validity.

type Tagged =
  | { t: "null" }
  | { t: "bool"; v: boolean }
  | { t: "int"; v: string }
  | { t: "str"; v: string }
  | { t: "arr"; v: Tagged[] }
  | { t: "obj"; v: [string, Tagged][] };

interface Vector {
  name: string;
  value: Tagged;
  json: string;
}

// Canonical JSON encoding, per the seed's `canonicalJson` rules:
// minified; object keys in INSERTION order (NOT sorted — Object is order-significant);
// int = bare exact decimal; string = RFC 8259 minimal escaping ("/" NOT escaped,
// control U+0000..001F as short-form or lowercase \u00XX, all else raw UTF-8).
function encodeString(s: string): string {
  let out = '"';
  for (const ch of s) {
    // iterate by code point (string iterator combines surrogate pairs)
    switch (ch) {
      case '"':
        out += '\\"';
        break;
      case "\\":
        out += "\\\\";
        break;
      case "\b":
        out += "\\b";
        break;
      case "\f":
        out += "\\f";
        break;
      case "\n":
        out += "\\n";
        break;
      case "\r":
        out += "\\r";
        break;
      case "\t":
        out += "\\t";
        break;
      default: {
        const code = ch.codePointAt(0)!;
        if (code <= 0x1f) {
          out += "\\u" + code.toString(16).padStart(4, "0");
        } else {
          out += ch; // raw UTF-8 (incl. non-ASCII / astral)
        }
      }
    }
  }
  return out + '"';
}

function canonicalEncode(n: Tagged): string {
  switch (n.t) {
    case "null":
      return "null";
    case "bool":
      return n.v ? "true" : "false";
    case "int":
      // re-canonicalize via BigInt: validates the seed's int text is canonical
      // (no leading zeros, no '+', '-' only for negatives) and arbitrary-precision-exact
      return BigInt(n.v).toString();
    case "str":
      return encodeString(n.v);
    case "arr":
      return "[" + n.v.map(canonicalEncode).join(",") + "]";
    case "obj":
      return "{" + n.v.map(([k, val]) => encodeString(k) + ":" + canonicalEncode(val)).join(",") + "}";
  }
}

const seed = vectors as unknown as { primitive: string; version: number; vectors: Vector[] };

test("seed identifies as DynamicValue v1", () => {
  expect(seed.primitive).toBe("DynamicValue");
  expect(seed.version).toBe(1);
  expect(seed.vectors.length).toBeGreaterThan(0);
});

for (const v of seed.vectors) {
  test(`byte-lock encode: ${v.name}`, () => {
    // encode(value) === canonical json (the byte-lock target)
    expect(canonicalEncode(v.value)).toBe(v.json);
    // the canonical json is itself valid JSON
    expect(() => JSON.parse(v.json)).not.toThrow();
  });
}
