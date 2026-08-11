/**
 * rs-phase-accumulator.ts — accumulates phase ticks and emits RS-encoded blocks.
 *
 * Bridges the gap between the per-tick phase clock (phase-clock.ts) and the
 * RS codec (rs-phase-codec.ts). Every 12 ticks, the accumulator:
 *   1. Bundles the 12 derived values
 *   2. Encodes them into a 16-symbol RS codeword
 *   3. Emits the block (for inclusion in the event envelope or a separate channel)
 *
 * The accumulator is STATEFUL (it holds the partial buffer of ticks since the
 * last emission) but DETERMINISTIC given the same sequence of tick inputs.
 *
 * ## Integration with run-loop-real.ts
 *
 * The run-loop calls `accumulator.push(phaseStamp)` after each tick.
 * When 12 stamps accumulate, `push()` returns the encoded block.
 * The block can be:
 *   - Stored in the event envelope's `rs_block` field
 *   - Written to a separate `data/rs-blocks.json` accumulator file
 *   - Sent over the realtime WebSocket for immediate peer verification
 *
 * ## Recovery scenario
 *
 * A peer that missed 4 of 16 ticks in a block:
 *   1. Receives the partial observation (12 of 16 coded symbols)
 *   2. Calls `recoverPhaseBlock()` from rs-phase-codec.ts
 *   3. Gets back the full 16-symbol block including the missed phases
 *   4. Can verify continuity by checking the recovered derived values
 *      against what the phase clock WOULD have produced
 */

import type { PhaseStamp } from "./phase-clock";
import { encodePhaseBlock, K, N } from "./rs-phase-codec";

// ═══ Types ════════════════════════════════════════════════════════════════════

/**
 * An emitted RS block — 12 information phases encoded into 16 coded symbols.
 */
export interface RSBlock {
  /** The phase range this block covers (inclusive). */
  readonly startPhase: number;
  readonly endPhase: number;
  /** The 12 original derived values (mod 17). */
  readonly info: readonly number[];
  /** The 16 coded symbols (evaluations of the interpolating polynomial). */
  readonly coded: readonly number[];
  /** Block sequence number (how many blocks have been emitted). */
  readonly blockSeq: number;
}

/**
 * The result of pushing a stamp: either the buffer is still filling,
 * or a complete block was emitted.
 */
export type PushResult =
  | { readonly emitted: false; readonly buffered: number }
  | { readonly emitted: true; readonly block: RSBlock };

// ═══ Accumulator ══════════════════════════════════════════════════════════════

export interface RSPhaseAccumulator {
  /** Push a new phase stamp. Returns a block if 12 have accumulated. */
  push(stamp: PhaseStamp): PushResult;
  /** How many stamps are buffered (waiting for the next block). */
  readonly buffered: number;
  /** How many blocks have been emitted so far. */
  readonly emittedCount: number;
  /** Peek at the current buffer (for debugging/testing). */
  readonly buffer: readonly PhaseStamp[];
}

/**
 * Create an RS phase accumulator.
 *
 * Optionally resume from a partial buffer (for persistence across restarts).
 */
export function createRSAccumulator(
  opts?: { resumeBuffer?: readonly PhaseStamp[]; startSeq?: number },
): RSPhaseAccumulator {
  const buffer: PhaseStamp[] = opts?.resumeBuffer ? [...opts.resumeBuffer] : [];
  let blockSeq = opts?.startSeq ?? 0;

  return {
    push(stamp: PhaseStamp): PushResult {
      buffer.push(stamp);

      if (buffer.length < K) {
        return { emitted: false, buffered: buffer.length };
      }

      // Buffer is full — encode and emit
      const info = buffer.map((s) => s.derived);
      const coded = encodePhaseBlock(info);
      const block: RSBlock = {
        startPhase: buffer[0]!.phase,
        endPhase: buffer[buffer.length - 1]!.phase,
        info,
        coded,
        blockSeq,
      };

      // Reset buffer and advance sequence
      buffer.length = 0;
      blockSeq++;

      return { emitted: true, block };
    },

    get buffered(): number {
      return buffer.length;
    },

    get emittedCount(): number {
      return blockSeq;
    },

    get buffer(): readonly PhaseStamp[] {
      return buffer;
    },
  };
}
