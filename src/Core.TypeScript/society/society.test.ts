import { describe, expect, test } from "bun:test";
import { canonicalSortAddresses, compareAddress, type Address } from "./society";

// ── Why these tests exist, and what they deliberately do NOT test ──────────────────────────────
//
// `society.ts` is a DECLARATION: interfaces and two ordering helpers. There is no society to test
// and none is being implied. The algebraic obligations on an eventual implementation live in F#
// (`Society.SocietyLaws`), stated as predicates a property test or a proof can be pointed at.
//
// What IS testable today is the one thing that can silently diverge between the TS and F# oracles
// and take the byte-lock with it: the ORDER a membership set folds in. So that is what is pinned —
// the collation treaty (Unicode code-point order ≡ UTF-8 byte order), and the two orderings it is
// most likely to be confused with.
//
// Under `toy-is-free-metered-must-be-earned`: this is a falsifier for the ordering claim only. It
// says nothing about the interfaces, and it must not be cited as if it did.

describe("address collation treaty (byte-lock with the F# oracle)", () => {
  test("orders by Unicode code point, matching Society.Address.compare -> Collation.binary", () => {
    // Uppercase precedes lowercase in code-point order. A linguistic collation reverses this.
    expect(compareAddress("Otto", "otto")).toBeLessThan(0);
    expect(compareAddress("agent-1", "agent_1")).toBeLessThan(0); // '-' 0x2D < '_' 0x5F
    expect(compareAddress("otto", "otto-cli")).toBeLessThan(0); // prefix sorts first
    expect(compareAddress("otto", "otto")).toBe(0);
  });

  test("DIVERGES from localeCompare — which the existing buses use to order envelopes", () => {
    // `agent-bus/subscribe.ts:71` and `bus/bus.ts:95` sort with `localeCompare`, a culture-SENSITIVE
    // comparison that `culture-invariant-by-default` forbids in primitives. Today's bus keys (fixed
    // -width ISO timestamps + lowercase 32-hex ids) happen to order identically under both, so
    // nothing is currently mis-sorted. It stops being harmless the moment a society admits members
    // with arbitrary addresses — which is exactly what `ISociety` is for. This test is the tripwire
    // that keeps that fact from being forgotten.
    const cases: readonly (readonly [Address, Address])[] = [
      ["Otto", "otto"],
      ["Zeta", "otto"],
    ];
    for (const [a, b] of cases) {
      expect(Math.sign(compareAddress(a, b))).not.toBe(Math.sign(a.localeCompare(b)));
    }
  });

  test("handles non-BMP addresses by code point, where UTF-16 code-unit order disagrees", () => {
    // U+1F600 (astral, surrogate pair 0xD83D 0xDE00) vs U+FFFD (BMP).
    // Code point:      U+FFFD (65533) < U+1F600 (128512)
    // UTF-16 code unit: 0xD83D (55357) < 0xFFFD (65533)  -- the opposite verdict.
    // Bare `<` in JS and .NET `String.CompareOrdinal` both take the UTF-16 reading; the treaty
    // takes the code-point one, so both languages must route through the treaty, not through `<`.
    const astral = "\u{1F600}";
    const bmp = "�";
    expect(compareAddress(bmp, astral)).toBeLessThan(0);
    expect(bmp < astral).toBe(false); // the bare-`<` trap, pinned so it cannot be reintroduced
  });

  test("canonicalSortAddresses is deterministic and does not mutate its input", () => {
    const input: readonly Address[] = ["otto", "Otto", "agent_1", "agent-1", "\u{1F600}", "�"];
    const once = canonicalSortAddresses(input);
    const twice = canonicalSortAddresses(once);
    expect(twice).toEqual(once);
    expect(input).toEqual(["otto", "Otto", "agent_1", "agent-1", "\u{1F600}", "�"]);
    // Re-sorting a shuffled permutation reaches the same canonical sequence.
    expect(canonicalSortAddresses([...input].reverse())).toEqual(once);
  });
});
