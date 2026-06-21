// Clock — TS oracle of the logical-clock primitive (081KT7YW00008QG0R002T1XNWT floor #1). Mirror of
// the F# Versionstamp/Scheduler (src/Core/Clock.fs); grown from the shared seed
// (clock/golden-vectors.json). Total-order single-sequencer instance: a
// monotonic versionstamp + an injectable deterministic scheduler.
//
// tick = +1 = one scheduler step = z⁻¹ inverse (same unit at three layers).
// bigint = the int64 logical-clock value (byte-lock parity with F#/C#/Rust).
export const zero = { version: 0n };
export const ofInt = (v) => ({ version: v });
/** Advance one tick — the forward unit step (inverse of z⁻¹ delay). */
export const tick = (v) => ({ version: v.version + 1n });
/** The previous stamp (z⁻¹ delay): inverse of tick. delay(tick v) = v. */
export const delay = (v) => ({ version: v.version - 1n });
/** Total-order comparison (-1 / 0 / +1). */
export const compare = (a, b) => a.version < b.version ? -1 : a.version > b.version ? 1 : 0;
/** Strict happens-before (total order, single-writer). */
export const isBefore = (a, b) => a.version < b.version;
export const fromSeed = (seed) => ({ now: ofInt(seed) });
export const step = (s) => ({ now: tick(s.now) });
/** Deterministic timeline: the stamps produced by n steps from the seed (DST). */
export const run = (seed, n) => {
    const out = [];
    let s = fromSeed(seed);
    for (let i = 0; i < n; i++) {
        s = step(s);
        out.push(s.now);
    }
    return out;
};
