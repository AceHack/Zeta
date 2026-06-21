/**
 * src/Core.TypeScript/algebra/star-ring.ts — the *-ring interface (IStarRing port).
 *
 * A *-ring (star-ring) is a ring with an involution (conjugation). This is the
 * minimal algebraic interface that makes the soft lanes work generically:
 *
 *   - Real weights (Bayesian): conj = identity, the ring is commutative
 *   - Complex amplitudes (Quantum): conj = complex conjugate, enables interference
 *   - Quaternion (future): conj = quaternion conjugate, non-commutative
 *
 * The same code works over any StarRing instance — swap the ring, change the
 * physics. This is the TS port of F#'s `IStarRing<'A>` from `CayleyDickson.fs`.
 *
 * Composes with:
 *   - src/Core/CayleyDickson.fs (F# source of truth: IStarRing, Doubled.algebra)
 *   - src/Core/ImaginaryStack (complex/quaternion/octonion instances)
 *   - src/Core/WSet.fs (consolidate + apply use the ring)
 *   - docs/specs/soft-lane-codegen-numeric-interfaces.md (the design spec)
 */
// ─── Real algebra (IStarRing<float>) ─────────────────────────────────────────
export const realRing = {
    zero: 0,
    one: 1,
    add: (a, b) => a + b,
    mul: (a, b) => a * b,
    negate: (a) => -a,
    conj: (a) => a, // real conjugation = identity
};
// ─── Complex algebra (IStarRing<Complex>) ────────────────────────────────────
export const complexRing = {
    zero: { re: 0, im: 0 },
    one: { re: 1, im: 0 },
    add: (a, b) => ({ re: a.re + b.re, im: a.im + b.im }),
    mul: (a, b) => ({
        re: a.re * b.re - a.im * b.im,
        im: a.re * b.im + a.im * b.re,
    }),
    negate: (a) => ({ re: -a.re, im: -a.im }),
    conj: (a) => ({ re: a.re, im: -a.im }), // complex conjugation
};
/**
 * The Cayley-Dickson construction: given an IStarRing<A>, produce IStarRing<Doubled<A>>.
 * This IS the tower: Real → Complex → Quaternion → Octonion → ...
 *
 * Multiplication: (a,b)*(c,d) = (a*c - conj(d)*b, d*a + b*conj(c))
 * Conjugation: conj(a,b) = (conj(a), -b)
 */
export function doubled(inner) {
    return {
        zero: { real: inner.zero, imag: inner.zero },
        one: { real: inner.one, imag: inner.zero },
        add: (a, b) => ({
            real: inner.add(a.real, b.real),
            imag: inner.add(a.imag, b.imag),
        }),
        mul: (a, b) => ({
            // (a,b)*(c,d) = (a*c - conj(d)*b, d*a + b*conj(c))
            real: inner.add(inner.mul(a.real, b.real), inner.negate(inner.mul(inner.conj(b.imag), a.imag))),
            imag: inner.add(inner.mul(b.imag, a.real), inner.mul(a.imag, inner.conj(b.real))),
        }),
        negate: (a) => ({
            real: inner.negate(a.real),
            imag: inner.negate(a.imag),
        }),
        conj: (a) => ({
            real: inner.conj(a.real),
            imag: inner.negate(a.imag),
        }),
    };
}
// ─── The imaginary stack (pre-computed instances) ─────────────────────────────
/** Complex = Doubled<Real> — same as ImaginaryStack.complex in F# */
export const complexFromDoubled = doubled(realRing);
export const quaternionRing = doubled(complexRing);
export const octonionRing = doubled(quaternionRing);
/**
 * Consolidate: sum weights of identical keys under ring.add, drop zeros.
 * This is where interference happens — opposite-weight entries cancel.
 * Generic over the ring: real weights → no cancel on positive; complex → phase cancel.
 */
export function consolidate(ring, isZero, entries, keyEq = (a, b) => a === b) {
    const grouped = [];
    for (const entry of entries) {
        const existing = grouped.find((g) => keyEq(g.key, entry.key));
        if (existing) {
            existing.weight = ring.add(existing.weight, entry.weight);
        }
        else {
            grouped.push({ key: entry.key, weight: entry.weight });
        }
    }
    return grouped.filter((g) => !isZero(g.weight));
}
/**
 * Norm-squared: conj(w) * w. For complex: |z|² = re² + im². For real: w².
 * Used to determine "is this weight effectively zero."
 */
export function normSq(ring, w) {
    return ring.mul(ring.conj(w), w);
}
