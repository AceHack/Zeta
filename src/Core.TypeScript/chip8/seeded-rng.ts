/**
 * seeded-rng.ts — the one PRNG for the CHIP-8 arena, seeded from COMMON_SEED.
 *
 * Every random draw in the arena (emulator RND opcode, BNN observation noise,
 * exploration policy, respawn placement) must flow through a stream created
 * here. Ambient `Math.random()` is a noninterference violation (dv2 discipline
 * §7 / manifesto §13): two viewers of the same stream would fold different
 * evidence, and no run would replay. A seeded stream converts the arena from
 * "looks alive" to "is a measurement".
 *
 * splitmix32 — the 32-bit sibling of splitmix64 (Steele, Lea & Flood 2014,
 * "Fast splittable pseudorandom number generators", OOPSLA). Chosen because the
 * repo already cross-verifies splitmix64 across languages; this is the same
 * construction at the width JS bit-ops natively support.
 */

import { COMMON_SEED } from "../observe/phase-clock";

/** Immutable-state PRNG step: returns the drawn u32 and the successor state. */
export function splitmix32Step(state: number): { readonly u32: number; readonly next: number } {
  const next = (state + 0x9e3779b9) | 0;
  let t = next ^ (next >>> 16);
  t = Math.imul(t, 0x21f0aaad);
  t = t ^ (t >>> 15);
  t = Math.imul(t, 0x735a2d97);
  t = t ^ (t >>> 15);
  return { u32: t >>> 0, next };
}

/** A mutable stream wrapper for call sites that want `rand()` ergonomics. */
export interface SeededStream {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform u8 (for the CHIP-8 RND opcode). */
  nextByte(): number;
  /** Current state — persist it to make a run resumable. */
  state(): number;
}

/**
 * Create a stream. `streamId` decorrelates independently-owned streams derived
 * from the same COMMON_SEED (predictor vs emulator vs explorer) without
 * inventing per-stream magic constants at call sites.
 */
export function createSeededStream(seed: number = COMMON_SEED, streamId = 0): SeededStream {
  // Mix the streamId in through one step so streams with the same seed differ.
  let s = splitmix32Step((seed ^ Math.imul(streamId + 1, 0x85ebca6b)) | 0).next;
  return {
    next(): number {
      const r = splitmix32Step(s);
      s = r.next;
      return r.u32 / 4294967296;
    },
    nextByte(): number {
      const r = splitmix32Step(s);
      s = r.next;
      return r.u32 & 0xff;
    },
    state(): number {
      return s;
    },
  };
}
