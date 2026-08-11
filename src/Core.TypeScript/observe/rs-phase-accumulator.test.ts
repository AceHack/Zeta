/**
 * rs-phase-accumulator.test.ts — RS block emission from phase tick stream.
 */

import { describe, test, expect } from "bun:test";
import { createRSAccumulator } from "./rs-phase-accumulator";
import { recoverPhaseBlock, K, N } from "./rs-phase-codec";
import type { PhaseStamp } from "./phase-clock";

function stamp(phase: number, derived: number): PhaseStamp {
  return { phase, derived };
}

describe("RSPhaseAccumulator", () => {
  test("does not emit before 12 stamps", () => {
    const acc = createRSAccumulator();
    for (let i = 0; i < 11; i++) {
      const result = acc.push(stamp(i, i * 7 + 3));
      expect(result.emitted).toBe(false);
      if (!result.emitted) expect(result.buffered).toBe(i + 1);
    }
    expect(acc.buffered).toBe(11);
  });

  test("emits a block on the 12th stamp", () => {
    const acc = createRSAccumulator();
    for (let i = 0; i < 11; i++) {
      acc.push(stamp(i, i * 7 + 3));
    }
    const result = acc.push(stamp(11, 11 * 7 + 3));
    expect(result.emitted).toBe(true);
    if (result.emitted) {
      expect(result.block.info.length).toBe(K);
      expect(result.block.coded.length).toBe(N);
      expect(result.block.startPhase).toBe(0);
      expect(result.block.endPhase).toBe(11);
      expect(result.block.blockSeq).toBe(0);
    }
  });

  test("resets buffer after emission", () => {
    const acc = createRSAccumulator();
    for (let i = 0; i < 12; i++) acc.push(stamp(i, i));
    expect(acc.buffered).toBe(0);
    // Next push starts a new buffer
    const r = acc.push(stamp(12, 12));
    expect(r.emitted).toBe(false);
    if (!r.emitted) expect(r.buffered).toBe(1);
  });

  test("second block has blockSeq = 1", () => {
    const acc = createRSAccumulator();
    for (let i = 0; i < 12; i++) acc.push(stamp(i, i));
    for (let i = 12; i < 23; i++) acc.push(stamp(i, i));
    const result = acc.push(stamp(23, 23));
    expect(result.emitted).toBe(true);
    if (result.emitted) {
      expect(result.block.blockSeq).toBe(1);
      expect(result.block.startPhase).toBe(12);
      expect(result.block.endPhase).toBe(23);
    }
  });

  test("emitted block is recoverable from 12 of 16 coded symbols", () => {
    const acc = createRSAccumulator();
    for (let i = 0; i < 11; i++) acc.push(stamp(i, (i + 1) * 13));
    const result = acc.push(stamp(11, 12 * 13));
    expect(result.emitted).toBe(true);
    if (!result.emitted) return;

    // Simulate 4 erasures
    const observation = result.block.coded.map((v, i) =>
      [2, 5, 9, 14].includes(i) ? null : { value: v },
    );
    const recovered = recoverPhaseBlock(observation);
    expect(recovered.ok).toBe(true);
    if (recovered.ok) {
      expect(recovered.block).toEqual([...result.block.coded]);
    }
  });

  test("resume from partial buffer", () => {
    const partial: PhaseStamp[] = [stamp(0, 10), stamp(1, 20), stamp(2, 30)];
    const acc = createRSAccumulator({ resumeBuffer: partial, startSeq: 5 });
    expect(acc.buffered).toBe(3);
    expect(acc.emittedCount).toBe(5);

    // Push 9 more to complete
    for (let i = 3; i < 11; i++) acc.push(stamp(i, (i + 1) * 10));
    const result = acc.push(stamp(11, 120));
    expect(result.emitted).toBe(true);
    if (result.emitted) {
      expect(result.block.blockSeq).toBe(5);
      expect(result.block.startPhase).toBe(0);
    }
  });

  test("emittedCount tracks correctly across multiple blocks", () => {
    const acc = createRSAccumulator();
    expect(acc.emittedCount).toBe(0);
    for (let i = 0; i < 36; i++) acc.push(stamp(i, i));
    expect(acc.emittedCount).toBe(3); // 36 / 12 = 3 blocks
  });

  test("PURE: same stamps same block (deterministic)", () => {
    const stamps = Array.from({ length: 12 }, (_, i) => stamp(i, i * 5 + 2));
    const acc1 = createRSAccumulator();
    const acc2 = createRSAccumulator();
    let block1, block2;
    for (const s of stamps) {
      const r1 = acc1.push(s);
      const r2 = acc2.push(s);
      if (r1.emitted) block1 = r1.block;
      if (r2.emitted) block2 = r2.block;
    }
    expect(block1).toEqual(block2);
  });
});
