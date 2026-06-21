// Clock — TS oracle of the logical-clock primitive (081KT7YW00008QG0R002T1XNWT floor #1). Mirror of
// the F# Versionstamp/Scheduler (src/Core/Clock.fs); grown from the shared seed
// (clock/golden-vectors.json). Total-order single-sequencer instance: a
// monotonic versionstamp + an injectable deterministic scheduler.
//
// tick = +1 = one scheduler step = z⁻¹ inverse (same unit at three layers).
// bigint = the int64 logical-clock value (byte-lock parity with F#/C#/Rust).

export interface Versionstamp {
  readonly version: bigint;
}

export const zero: Versionstamp = { version: 0n };

export const ofInt = (v: bigint): Versionstamp => ({ version: v });

/** Advance one tick — the forward unit step (inverse of z⁻¹ delay). */
export const tick = (v: Versionstamp): Versionstamp => ({ version: v.version + 1n });

/** The previous stamp (z⁻¹ delay): inverse of tick. delay(tick v) = v. */
export const delay = (v: Versionstamp): Versionstamp => ({ version: v.version - 1n });

/** Total-order comparison (-1 / 0 / +1). */
export const compare = (a: Versionstamp, b: Versionstamp): number =>
  a.version < b.version ? -1 : a.version > b.version ? 1 : 0;

/** Strict happens-before (total order, single-writer). */
export const isBefore = (a: Versionstamp, b: Versionstamp): boolean => a.version < b.version;

export interface Scheduler {
  readonly now: Versionstamp;
}

export const fromSeed = (seed: bigint): Scheduler => ({ now: ofInt(seed) });

export const step = (s: Scheduler): Scheduler => ({ now: tick(s.now) });

/** Deterministic timeline: the stamps produced by n steps from the seed (DST). */
export const run = (seed: bigint, n: number): Versionstamp[] => {
  const out: Versionstamp[] = [];
  let s = fromSeed(seed);
  for (let i = 0; i < n; i++) {
    s = step(s);
    out.push(s.now);
  }
  return out;
};
