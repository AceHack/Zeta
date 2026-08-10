import { describe, expect, test } from "bun:test";
import { COMMON_SEED, MAX_PEER_ADVANCE, createPhaseClock } from "./phase-clock";
import { MAX_RECOVERY_SPAN, recoverForward, verifyPhase } from "./phase-erasure";

/**
 * Regression tests for the three P1s Kira found on 2026-08-10.
 *
 * Each of these inputs arrives from a PEER'S event file — unauthenticated, unvalidated
 * text from another writer — so every one of them is reachable by an attacker who can
 * write a single small JSON file.
 */

describe("P1: observe() must not adopt an unbounded peer phase", () => {
  test("a huge peer phase is REFUSED, not adopted", () => {
    // The live attack: one event carrying a giant phase permanently poisons this clock
    // AND is then persisted into our own events, propagating to every reader.
    const clock = createPhaseClock();
    clock.tick();
    const before = clock.state.phase;
    clock.observe(1e15);
    expect(clock.state.phase).toBe(before);
  });

  test("refused rather than CLAMPED — a truncated value would fabricate a phase", () => {
    const clock = createPhaseClock();
    clock.observe(MAX_PEER_ADVANCE + 1);
    // Clamping would leave us at MAX_PEER_ADVANCE, a phase nobody ever observed.
    expect(clock.state.phase).toBe(0);
  });

  test("a peer just inside the window is still adopted — the bound is not a wall", () => {
    const clock = createPhaseClock();
    clock.observe(MAX_PEER_ADVANCE);
    expect(clock.state.phase).toBe(MAX_PEER_ADVANCE + 1); // adopted, then advanced
  });

  test("non-integer, negative, NaN and Infinity are all rejected", () => {
    for (const bad of [1.5, -1, NaN, Infinity, -Infinity, Number.MAX_VALUE]) {
      const clock = createPhaseClock();
      clock.tick();
      const before = clock.state.phase;
      clock.observe(bad);
      expect(clock.state.phase).toBe(before);
    }
  });

  test("ordinary peer catch-up is unaffected (no behaviour change for honest input)", () => {
    const clock = createPhaseClock();
    clock.observe(5);
    expect(clock.state.phase).toBe(6);
  });

  test("a peer BEHIND us still does not move us backward", () => {
    const clock = createPhaseClock();
    for (let i = 0; i < 10; i++) clock.tick();
    const before = clock.state.phase;
    clock.observe(2);
    expect(clock.state.phase).toBe(before);
  });
});

describe("P1: recovery spans must be bounded", () => {
  test("recoverForward refuses an enormous span instead of allocating per phase", () => {
    const anchor = { phase: 0, seed: COMMON_SEED, lastAdvanceReason: "init" as const, wallClockAt: "" };
    expect(() => recoverForward(anchor, 1e12)).toThrow(/MAX_RECOVERY_SPAN/);
  });

  test("a normal gap still recovers exactly", () => {
    const anchor = { phase: 0, seed: COMMON_SEED, lastAdvanceReason: "init" as const, wallClockAt: "" };
    const got = recoverForward(anchor, 5);
    expect(got.length).toBe(5);
    expect(got.map((s) => s.phase)).toEqual([1, 2, 3, 4, 5]);
  });

  test("verifyPhase refuses an enormous claimed phase instead of ticking to it", () => {
    expect(() =>
      verifyPhase({ phase: 1e12, seed: 0, lastAdvanceReason: "init", wallClockAt: "" }),
    ).toThrow(/MAX_RECOVERY_SPAN/);
  });

  test("verifyPhase rejects malformed phases without throwing", () => {
    for (const bad of [-1, 1.5, NaN]) {
      expect(
        verifyPhase({ phase: bad, seed: 0, lastAdvanceReason: "init", wallClockAt: "" }),
      ).toBe(false);
    }
  });

  test("verifyPhase still verifies an honest short chain", () => {
    const clock = createPhaseClock(COMMON_SEED);
    for (let i = 0; i < 3; i++) clock.tick();
    expect(verifyPhase({ ...clock.state, phase: 3 })).toBe(true);
  });

  test("the span ceiling is a parameter, so a caller may lower it but not silently raise it", () => {
    const anchor = { phase: 0, seed: COMMON_SEED, lastAdvanceReason: "init" as const, wallClockAt: "" };
    expect(() => recoverForward(anchor, 50, 10)).toThrow(/exceeds MAX_RECOVERY_SPAN/);
    expect(MAX_RECOVERY_SPAN).toBeGreaterThan(0);
  });
});
