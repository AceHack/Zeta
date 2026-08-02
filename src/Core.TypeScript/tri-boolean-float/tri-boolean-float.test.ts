import { describe, test, expect } from "bun:test";
import { T, F, N } from "../tri-boolean";
import { DEFAULT_SHAPE } from "./types";
import { decode, measure, cooperate, isHeld, fromValue, fromTrits } from "./tri-boolean-float";

test("round-trip: representable non-negative values decode back exactly", () => {
  // shape 4/3/4 => 8 value bits (V in [0,256)), mode in [0,8).
  for (const v of [0, 1, 5, 6, 0.5, 8, 16]) {
    const enc = fromValue(v);
    expect(enc.ok).toBe(true);
    if (enc.ok) {
      const dec = decode(enc.float);
      expect(dec.ok).toBe(true);
      if (dec.ok) expect(dec.value).toBe(v);
    }
  }
});

test("the MIDDLE decodes the ends: same value bits, different mode => different magnitude", () => {
  // V = 5, mode 4 (bias=4) -> exp 0 -> value 5
  const m4 = fromTrits([F, F, F, F], [T, F, F], [F, T, F, T]);
  // V = 3, mode 5 -> exp +1 -> value 6
  const m5 = fromTrits([F, F, F, F], [T, F, T], [F, F, T, T]);
  // V = 8, mode 3 -> exp -1 -> value 4
  const m3 = fromTrits([F, F, F, F], [F, T, T], [T, F, F, F]);
  // V = 4, mode 2 -> exp -2 -> value 1
  const m2 = fromTrits([F, F, F, F], [F, T, F], [F, T, F, F]);

  expect(decode(m4)).toEqual({ ok: true, value: 5 });
  expect(decode(m5)).toEqual({ ok: true, value: 6 });
  expect(decode(m3)).toEqual({ ok: true, value: 4 });
  expect(decode(m2)).toEqual({ ok: true, value: 1 });
});

test("N in a VALUE trit => value-superposed (interpretation known)", () => {
  const f = fromTrits([F, F, F, N], [T, F, F], [F, F, F, T]); // decoder certain, value has an N
  const r = measure(f);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.feedback.reason).toBe("value-superposed");
  expect(isHeld(f)).toBe(true);
});

test("N in a DECODER trit => interpretation-superposed (even with a fully-certain value)", () => {
  const f = fromTrits([F, F, F, F], [T, N, F], [F, F, F, T]); // value certain, decoder has an N
  const r = measure(f);
  expect(r.ok).toBe(false);
  // The decode INSTRUCTION itself is held -- the qubit property at the interpretation level.
  if (!r.ok) expect(r.feedback.reason).toBe("interpretation-superposed");
});

test("decoder-N dominates: interpretation-superposed even when a value trit is ALSO N", () => {
  const f = fromTrits([N, F, F, F], [N, F, F], [F, F, F, T]); // both held; decoder read first
  const r = decode(f);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.feedback.reason).toBe("interpretation-superposed");
});

test("cooperate preserves every held trit (identity; never collapses)", () => {
  const f = fromTrits([N, F, F, F], [F, N, F], [F, F, F, N]);
  expect(cooperate(f)).toBe(f);
  expect(isHeld(cooperate(f))).toBe(true);
});

test("fromValue surfaces not-representable for negatives + out-of-range", () => {
  expect(fromValue(-1).ok).toBe(false);
  expect(fromValue(2041).ok).toBe(false); // exceeds max representable 2040 (255 * 2^3)
  expect(fromValue(1 / 1024).ok).toBe(false); // underflows min representable positive (1 * 2^-4 = 0.0625)
});

test("encode canonicalizes to the smallest mode (decode is exact regardless)", () => {
  const enc = fromValue(2, DEFAULT_SHAPE); // 2 = 32 * 2^-4 (mode 0), not 16 * 2^-3 (mode 1)
  expect(enc.ok).toBe(true);
  if (enc.ok) {
    expect(enc.float.decoder).toEqual([F, F, F]); // mode 0
    expect(decode(enc.float)).toEqual({ ok: true, value: 2 });
  }
});

/**
 * RESOLUTION IS MINTABLE — a characterization guard, requested by Soraya 2026-08-01.
 *
 * CONTEXT. Aaron proposed the self-describing carrier as the escape from the whitewash
 * impossibility: a fresh identity is HELD (undecodable), so "held cannot delegate" denies
 * newcomers without placing them at the bottom of a scalar. Half of that argument succeeds — the
 * type makes `{value: 0, epsilon: 0}` unrepresentable, which is strictly stronger than the
 * two-field convention it replaces, and that bug shipped hours before.
 *
 * The other half fails on this module, for two independent reasons Soraya established and I
 * verified:
 *
 *   1. RESOLUTION IS NOT GRADED. `decode` is all-or-nothing — `ok(number)` or one of two
 *      superposed states — so a carrier one trit short of full resolution is indistinguishable
 *      in the codomain from one with nothing resolved. There is no width to accumulate.
 *   2. RESOLUTION IS NOT UNFORGEABLE. That is what the tests below pin: `fromValue(v)` emits a
 *      FULLY RESOLVED carrier for every representable v, and `fromTrits` takes the trits directly.
 *
 * THESE TESTS PASS TODAY, AND THEIR PASSING IS THE EXPOSURE. That is the unusual thing about
 * them and the reason they are named this way. Nothing here is broken: a numeric constructor
 * that produces a resolved number is correct, and this module is a NUMBER, not a credential.
 * The exposure exists only in the *proposed* use — the moment a `TriFloat` carries reputation
 * or delegation capacity, `fromValue` becomes the mint, and an agent can hand itself a resolved
 * carrier.
 *
 * SO: these are characterization tests. They pin current behaviour so that a change is
 * deliberate rather than accidental, and they carry the inversion condition in the open —
 *
 *   >>> IF A TriFloat EVER CARRIES REPUTATION, DELEGATION CAPACITY, OR ANY EARNED QUANTITY,
 *   >>> THESE ASSERTIONS MUST BE INVERTED: no agent-reachable constructor may produce
 *   >>> `isHeld === false`, and resolution must become graded so it can accumulate.
 *
 * Friedman–Resnick is the reason: something must be non-transferable across an identity reset.
 * Accumulated resolution cannot be that thing while the substrate hands out resolved numbers on
 * request — the carrier is the right vessel for a tenure/cost quantity, not a substitute for one.
 */
describe("resolution is mintable — pinned so the exposure cannot be forgotten", () => {
  test("fromValue mints a FULLY RESOLVED carrier for every representable value", () => {
    // The mint. Correct for a number; disqualifying for a credential.
    for (const v of [0, 1, 2.5, 15.9375, 255]) {
      const encoded = fromValue(v);
      if (!encoded.ok) continue; // unrepresentable under DEFAULT_SHAPE — not the point here
      expect(isHeld(encoded.float)).toBe(false);
      expect(decode(encoded.float).ok).toBe(true);
    }
  });

  test("decode is ALL-OR-NOTHING: 7-of-8 held is indistinguishable from 1-of-8 held", () => {
    // The absence of a graded quantity, stated as an observation rather than a complaint.
    // Whitewash-proofness needs resolution to ACCUMULATE; this shows there is nothing to
    // accumulate — one held trit collapses the carrier to the same codomain inhabitant as many.
    const nearlyResolved = fromTrits([F, F, F, N], [F, F, F], [F, F, F, T]);
    const barelyResolved = fromTrits([N, N, N, N], [F, F, F], [N, N, N, N]);
    const a = decode(nearlyResolved);
    const b = decode(barelyResolved);
    expect(a.ok).toBe(false);
    expect(b.ok).toBe(false);
    if (!a.ok && !b.ok) {
      expect(a.feedback.reason).toBe(b.feedback.reason);
    }
  });

  test("a held carrier cannot be read as a value — the ok:false branch has no value field", () => {
    // The half of Aaron's argument that DOES succeed, pinned so it is not lost when the rest is
    // revisited. `{value: 0, epsilon: 0, silent: true}` has no representation here: you cannot
    // express "a value, held with certainty", which is the class of bug this replaces.
    const held = fromTrits([F, F, F, N], [F, F, F], [F, F, F, T]);
    const result = decode(held);
    expect(result.ok).toBe(false);
    expect("value" in result).toBe(false);
  });
});
