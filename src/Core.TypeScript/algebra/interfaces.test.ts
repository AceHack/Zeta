import { describe, test, expect } from "bun:test";
import {
  numberSemiring, additiveGroup, maxLattice, boolOrLattice,
  setUnionMonoid, jsonCodec,
  type ISemiring, type IRing,
} from "./interfaces";

describe("ISemiring<number> — ring laws", () => {
  const r = numberSemiring;

  test("zero is additive identity", () => { // PROOF: zero-is-additive-identity
    expect(r.add(5, r.zero)).toBe(5);
    expect(r.add(r.zero, 5)).toBe(5);
  });

  test("one is multiplicative identity", () => { // PROOF: one-is-multiplicative-identity
    expect(r.mul(7, r.one)).toBe(7);
    expect(r.mul(r.one, 7)).toBe(7);
  });

  test("add is commutative", () => { // PROOF: add-is-commutative
    expect(r.add(3, 7)).toBe(r.add(7, 3));
  });

  test("add is associative", () => { // PROOF: add-is-associative
    expect(r.add(r.add(1, 2), 3)).toBe(r.add(1, r.add(2, 3)));
  });

  test("negate is additive inverse", () => { // PROOF: negate-is-additive-inverse
    expect(r.add(5, r.negate(5))).toBe(r.zero);
  });

  test("mul distributes over add", () => { // PROOF: mul-distributes-over-add
    expect(r.mul(3, r.add(4, 5))).toBe(r.add(r.mul(3, 4), r.mul(3, 5)));
  });
});

describe("IGroup<number> — group laws", () => {
  const g = additiveGroup;

  test("identity is neutral", () => {
    expect(g.combine(5, g.identity)).toBe(5);
    expect(g.combine(g.identity, 5)).toBe(5);
  });

  test("inverse undoes combine", () => {
    expect(g.combine(7, g.inverse(7))).toBe(g.identity);
  });

  test("associativity", () => {
    expect(g.combine(g.combine(1, 2), 3)).toBe(g.combine(1, g.combine(2, 3)));
  });
});

describe("IJoinSemilattice — lattice laws", () => {
  test("max lattice: join = max", () => {
    expect(maxLattice.join(3, 7)).toBe(7);
    expect(maxLattice.join(7, 3)).toBe(7);
  });

  test("max lattice: idempotent (join(a,a) = a)", () => {
    expect(maxLattice.join(5, 5)).toBe(5);
  });

  test("max lattice: associative", () => {
    expect(maxLattice.join(maxLattice.join(1, 5), 3)).toBe(maxLattice.join(1, maxLattice.join(5, 3)));
  });

  test("bool OR lattice: monotone growth", () => {
    expect(boolOrLattice.join(false, false)).toBe(false);
    expect(boolOrLattice.join(false, true)).toBe(true);
    expect(boolOrLattice.join(true, false)).toBe(true);
    expect(boolOrLattice.join(true, true)).toBe(true);
  });
});

describe("IMonoid<Set<T>> — set union", () => {
  const m = setUnionMonoid<string>();

  test("identity is empty set", () => {
    expect(m.identity.size).toBe(0);
  });

  test("combine = union", () => {
    const a = new Set(["x", "y"]);
    const b = new Set(["y", "z"]);
    const c = m.combine(a, b);
    expect(c.size).toBe(3);
    expect(c.has("x")).toBe(true);
    expect(c.has("y")).toBe(true);
    expect(c.has("z")).toBe(true);
  });

  test("combine with identity = self", () => {
    const a = new Set(["a", "b"]);
    const c = m.combine(a, m.identity);
    expect([...c].sort()).toEqual(["a", "b"]);
  });
});

describe("ICodec<unknown, string> — JSON codec", () => {
  test("encode produces JSON string", () => {
    expect(jsonCodec.encode({ x: 1 })).toBe('{"x":1}');
  });

  test("decode parses JSON string", () => {
    expect(jsonCodec.decode('{"x":1}')).toEqual({ x: 1 });
  });

  test("round-trip: decode(encode(a)) = a", () => {
    const original = { hello: "world", n: 42, arr: [1, 2, 3] };
    expect(jsonCodec.decode(jsonCodec.encode(original))).toEqual(original);
  });

  test("round-trip on arrays", () => {
    const arr = [1, "two", null, true];
    expect(jsonCodec.decode(jsonCodec.encode(arr))).toEqual(arr);
  });
});

describe("interface composability — StarRing IS-A ISemiring", () => {
  // Import StarRing from the existing module
  const { realRing, complexRing } = require("./star-ring");

  test("realRing satisfies ISemiring contract", () => {
    const r: ISemiring<number> = realRing; // structural subtype
    expect(r.add(r.zero, 5)).toBe(5);
    expect(r.mul(r.one, 7)).toBe(7);
    const ring: IRing<number> = realRing; // ring tier adds negate (not on the semiring view)
    expect(ring.add(3, ring.negate(3))).toBe(ring.zero);
  });

  test("complexRing satisfies ISemiring contract", () => {
    const r: ISemiring<{ re: number; im: number }> = complexRing;
    expect(r.add(r.zero, r.one)).toEqual({ re: 1, im: 0 });
  });
});
