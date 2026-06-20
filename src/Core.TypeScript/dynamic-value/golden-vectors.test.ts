import { test, expect } from "bun:test";
import vectors from "./golden-vectors.json";
import { type Tagged, canonicalJson } from "./json";

// DynamicValue TS oracle — grown FROM the seed (seed-first / grow-code-from-the-seed,
// Aaron 2026-06-01). This is the canonical-encode side of the byte-lock: the seed
// (golden-vectors.json) is the canonical DATA; this code AGREES on the JSON structure.
// v1 locks null/bool/int/string/array/object; Float + Bytes are DEFERRED (see the
// seed's `deferred` block — they lock under CBOR, see cbor.ts). The codec lives in
// ./json.ts (shared with the decode test).

interface Vector {
  name: string;
  value: Tagged;
  json: string;
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
    const enc = canonicalJson(v.value);
    expect(enc.ok).toBe(true);
    expect(enc.ok ? enc.value : "").toBe(v.json);
    // the canonical json is itself valid JSON (block body — don't return JSON.parse's `any`)
    expect(() => {
      JSON.parse(v.json);
    }).not.toThrow();
  });
}
