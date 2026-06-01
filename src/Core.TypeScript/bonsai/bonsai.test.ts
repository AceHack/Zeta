/**
 * bonsai.test.ts — TS reference (oracle #1) for the Bonsai-subset serializer
 * (B-0976 slice 1).
 *
 * Three duties (mirroring the algebra-ladder oracles):
 *   1. **Canonical serialize is byte-exact** — `serialize(expr) === canonical`
 *      for every shared golden vector (the cross-language parity lock the
 *      F#/C#/Rust twins will also cast: same compact JSON, same fixed key order).
 *   2. **`parse` round-trips** — `equals(parse(canonical), expr)` and
 *      `serialize(parse(canonical)) === canonical` (the canonical string is the
 *      fixed point).
 *   3. **Structural laws** — `equals` is reflexive; `serialize ∘ parse ∘
 *      serialize == serialize`; unknown kinds are rejected (no silent accept).
 */

import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join as pathJoin } from "node:path";
import { cint, equals, type Expr, parse, serialize } from "./bonsai";

interface GoldenCase {
  readonly name: string;
  readonly note: string;
  readonly expr: Expr;
  readonly canonical: string;
}
interface Golden {
  readonly description: string;
  readonly version: number;
  readonly cases: readonly GoldenCase[];
}

const golden: Golden = JSON.parse(
  readFileSync(pathJoin(import.meta.dir, "golden-vectors.json"), "utf8"),
) as Golden;

describe("Bonsai-subset — golden vectors (oracle #1 / parity lock)", () => {
  it("the fixture is non-empty and version 1", () => {
    expect(golden.version).toBe(1);
    expect(golden.cases.length).toBeGreaterThan(0);
  });

  for (const c of golden.cases) {
    it(`${c.name}: serialize(expr) is byte-exact canonical`, () => {
      expect(serialize(c.expr)).toBe(c.canonical);
    });

    it(`${c.name}: parse(canonical) structurally equals expr`, () => {
      expect(equals(parse(c.canonical), c.expr)).toBe(true);
    });

    it(`${c.name}: canonical is the serialize fixed point`, () => {
      expect(serialize(parse(c.canonical))).toBe(c.canonical);
    });
  }
});

describe("Bonsai-subset — round-trip + structural laws", () => {
  it("serialize ∘ parse ∘ serialize == serialize (every case)", () => {
    for (const c of golden.cases) {
      const once = serialize(c.expr);
      expect(serialize(parse(once))).toBe(once);
    }
  });

  it("equals is reflexive (every case)", () => {
    for (const c of golden.cases) {
      expect(equals(c.expr, c.expr)).toBe(true);
    }
  });

  it("distinct cases are not equal (no false collisions)", () => {
    const exprs = golden.cases.map((c) => c.expr);
    for (let i = 0; i < exprs.length; i++) {
      for (let j = i + 1; j < exprs.length; j++) {
        // distinct canonical strings ⇒ must not be structurally equal
        if (serialize(exprs[i]!) !== serialize(exprs[j]!)) {
          expect(equals(exprs[i]!, exprs[j]!)).toBe(false);
        }
      }
    }
  });

  it("parse rejects an unknown node kind (no silent accept)", () => {
    expect(() => parse('{"v":1,"expr":{"kind":"bogus"}}')).toThrow();
  });

  it("parse rejects an unsupported version", () => {
    expect(() => parse('{"v":2,"expr":{"kind":"param","name":"x"}}')).toThrow();
  });
});

describe("Bonsai-subset — strict validation (the parse/construct conformance surface)", () => {
  it("cint rejects non-integer / NaN / Infinity (no silent truncation)", () => {
    expect(() => cint(1.9)).toThrow();
    expect(() => cint(Number.NaN)).toThrow();
    expect(() => cint(Number.POSITIVE_INFINITY)).toThrow();
  });

  it("cint rejects integers outside the JS safe-integer range (no silent rounding)", () => {
    expect(() => cint(2 ** 53)).toThrow(); // 2^53 is NOT a safe integer (MAX is 2^53 - 1)
  });

  it("parse rejects a non-integer int literal", () => {
    expect(() => parse('{"v":1,"expr":{"kind":"const","value":{"t":"int","v":1.5}}}')).toThrow();
  });

  it("parse rejects an int beyond the safe-integer range (e.g. an int64 from another oracle)", () => {
    expect(() => parse('{"v":1,"expr":{"kind":"const","value":{"t":"int","v":99999999999999999}}}')).toThrow();
  });

  it("parse rejects an unknown binary operator (e.g. div)", () => {
    expect(() =>
      parse('{"v":1,"expr":{"kind":"binary","op":"div","left":{"kind":"param","name":"a"},"right":{"kind":"param","name":"b"}}}'),
    ).toThrow();
  });

  it("parse rejects non-array call args", () => {
    expect(() => parse('{"v":1,"expr":{"kind":"call","fn":"f","args":"nope"}}')).toThrow();
  });

  it("parse rejects a null expr (deterministic Bonsai error, not a generic TypeError)", () => {
    expect(() => parse('{"v":1,"expr":null}')).toThrow();
  });

  it("parse rejects a null const value", () => {
    expect(() => parse('{"v":1,"expr":{"kind":"const","value":null}}')).toThrow();
  });

  it("parse rejects a non-object document", () => {
    expect(() => parse("null")).toThrow();
    expect(() => parse("42")).toThrow();
  });

  it("parse rejects a bool literal carrying a non-boolean value", () => {
    expect(() => parse('{"v":1,"expr":{"kind":"const","value":{"t":"bool","v":1}}}')).toThrow();
  });

  // Canonical-only: parse accepts the canonical byte form ONLY, so the advertised
  // serialize∘parse fixed point holds and a non-canonical saga vector can't pass
  // this oracle yet disagree on a peer oracle's byte-diff.
  it("parse rejects a non-canonical vector carrying an unknown extra field", () => {
    expect(() => parse('{"v":1,"expr":{"kind":"param","name":"x","extra":0}}')).toThrow();
  });

  it("parse rejects non-canonical whitespace (canonical form is whitespace-free)", () => {
    expect(() => parse('{"v":1, "expr":{"kind":"param","name":"x"}}')).toThrow();
  });

  it("parse rejects non-canonical key order (canonical fixes kind/v first)", () => {
    expect(() => parse('{"expr":{"kind":"param","name":"x"},"v":1}')).toThrow();
  });
});
