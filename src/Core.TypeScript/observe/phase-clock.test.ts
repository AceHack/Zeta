import { describe, test, expect } from "bun:test";
import {
  createPhaseClock,
  stampPhase,
  happenedBefore,
  concurrent,
  mergePhase,
  COMMON_SEED,
} from "./phase-clock";

describe("PhaseClock — time as a 4th traveler", () => {
  test("initial state: phase 0, seed = COMMON_SEED", () => {
    const clock = createPhaseClock();
    expect(clock.state.phase).toBe(0);
    expect(clock.state.seed).toBe(COMMON_SEED);
    expect(clock.state.lastAdvanceReason).toBe("init");
  });

  test("tick advances phase monotonically", () => {
    const clock = createPhaseClock();
    clock.tick();
    expect(clock.state.phase).toBe(1);
    clock.tick();
    expect(clock.state.phase).toBe(2);
    clock.tick();
    expect(clock.state.phase).toBe(3);
  });

  test("tick changes the seed (deterministic derivation)", () => {
    const clock = createPhaseClock();
    const seed0 = clock.state.seed;
    clock.tick();
    const seed1 = clock.state.seed;
    clock.tick();
    const seed2 = clock.state.seed;
    expect(seed0).not.toBe(seed1);
    expect(seed1).not.toBe(seed2);
  });

  test("same initial seed → same sequence (deterministic, reproducible)", () => {
    const a = createPhaseClock(42);
    const b = createPhaseClock(42);
    a.tick(); b.tick();
    a.tick(); b.tick();
    a.tick(); b.tick();
    expect(a.state.phase).toBe(b.state.phase);
    expect(a.state.seed).toBe(b.state.seed);
  });

  test("observe(peerPhase): jump to max(local, peer) + 1 when peer is ahead", () => {
    const clock = createPhaseClock();
    clock.tick(); // phase = 1
    clock.observe(10); // peer at 10, we jump to 11
    expect(clock.state.phase).toBe(11);
    expect(clock.state.lastAdvanceReason).toBe("observed-peer");
  });

  test("observe(peerPhase): no jump when we're already ahead", () => {
    const clock = createPhaseClock();
    for (let i = 0; i < 10; i++) clock.tick(); // phase = 10
    const before = clock.state.phase;
    clock.observe(5); // peer behind us
    expect(clock.state.phase).toBe(before); // no change
  });

  test("HLC convergence: two clocks converge after observing each other", () => {
    const a = createPhaseClock();
    const b = createPhaseClock();
    // a advances faster
    a.tick(); a.tick(); a.tick(); // a.phase = 3
    b.tick(); // b.phase = 1
    // b observes a → jumps ahead
    b.observe(a.state.phase); // b.phase = 4
    expect(b.state.phase).toBe(4);
    // a observes b → jumps ahead
    a.observe(b.state.phase); // a.phase = 5
    expect(a.state.phase).toBe(5);
    // they're now within 1 of each other (converged)
  });

  test("multi-planet: three clocks with independent ticks converge via observe", () => {
    const earth = createPhaseClock();
    const mars = createPhaseClock();
    const moon = createPhaseClock();

    // Independent ticking (no communication)
    earth.tick(); earth.tick(); earth.tick(); // 3
    mars.tick(); // 1
    moon.tick(); moon.tick(); // 2

    // Mars receives a message from Earth (lightcone delay)
    mars.observe(earth.state.phase); // mars jumps to 4
    expect(mars.state.phase).toBe(4);

    // Moon receives from Mars
    moon.observe(mars.state.phase); // moon jumps to 5
    expect(moon.state.phase).toBe(5);

    // All converged to causal ordering without wall-clock
    expect(happenedBefore(stampPhase(earth), stampPhase(moon))).toBe(true);
  });
});

describe("PhaseStamp — causal ordering", () => {
  test("happenedBefore: lower phase → happened before", () => {
    expect(happenedBefore({ phase: 1, derived: 0 }, { phase: 2, derived: 0 })).toBe(true);
    expect(happenedBefore({ phase: 2, derived: 0 }, { phase: 1, derived: 0 })).toBe(false);
  });

  test("concurrent: same phase → neither happened before the other", () => {
    expect(concurrent({ phase: 5, derived: 0 }, { phase: 5, derived: 0 })).toBe(true);
    expect(concurrent({ phase: 5, derived: 0 }, { phase: 6, derived: 0 })).toBe(false);
  });

  test("mergePhase: takes the max (HLC principle)", () => {
    const a = { phase: 3, derived: 100 };
    const b = { phase: 7, derived: 200 };
    expect(mergePhase(a, b)).toEqual(b);
    expect(mergePhase(b, a)).toEqual(b);
  });
});
