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

// ─── The StarRing interface ──────────────────────────────────────────────────

/**
 * A *-ring: a ring (Zero, One, Add, Mul, Negate) plus an involution (Conj).
 * Dictionary-passing style (same as F#'s object expression pattern).
 * Carries NO state — pure operations.
 */
export interface StarRing<T> {
  readonly zero: T;
  readonly one: T;
  add(a: T, b: T): T;
  mul(a: T, b: T): T;
  negate(a: T): T;
  conj(a: T): T;
}

// ─── Complex number type ─────────────────────────────────────────────────────

export interface Complex {
  readonly re: number;
  readonly im: number;
}

// ─── Real algebra (IStarRing<float>) ─────────────────────────────────────────

export const realRing: StarRing<number> = {
  zero: 0,
  one: 1,
  add: (a, b) => a + b,
  mul: (a, b) => a * b,
  negate: (a) => -a,
  conj: (a) => a, // real conjugation = identity
};

// ─── Complex algebra (IStarRing<Complex>) ────────────────────────────────────

export const complexRing: StarRing<Complex> = {
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

// ─── Cayley-Dickson doubling (Doubled.algebra port) ──────────────────────────

export interface Doubled<T> {
  readonly real: T;
  readonly imag: T;
}

/**
 * The Cayley-Dickson construction: given an IStarRing<A>, produce IStarRing<Doubled<A>>.
 * This IS the tower: Real → Complex → Quaternion → Octonion → ...
 *
 * Multiplication: (a,b)*(c,d) = (a*c - conj(d)*b, d*a + b*conj(c))
 * Conjugation: conj(a,b) = (conj(a), -b)
 */
export function doubled<T>(inner: StarRing<T>): StarRing<Doubled<T>> {
  return {
    zero: { real: inner.zero, imag: inner.zero },
    one: { real: inner.one, imag: inner.zero },
    add: (a, b) => ({
      real: inner.add(a.real, b.real),
      imag: inner.add(a.imag, b.imag),
    }),
    mul: (a, b) => ({
      // (a,b)*(c,d) = (a*c - conj(d)*b, d*a + b*conj(c))
      real: inner.add(
        inner.mul(a.real, b.real),
        inner.negate(inner.mul(inner.conj(b.imag), a.imag)),
      ),
      imag: inner.add(
        inner.mul(b.imag, a.real),
        inner.mul(a.imag, inner.conj(b.real)),
      ),
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
export const complexFromDoubled: StarRing<Doubled<number>> = doubled(realRing);

/** Quaternion = Doubled<Complex> */
export type Quaternion = Doubled<Complex>;
export const quaternionRing: StarRing<Quaternion> = doubled(complexRing);

/** Octonion = Doubled<Quaternion> */
export type Octonion = Doubled<Quaternion>;
export const octonionRing: StarRing<Octonion> = doubled(quaternionRing);

// ─── Weighted set operations (generic over ring) ─────────────────────────────

export interface WEntry<K, W> {
  readonly key: K;
  readonly weight: W;
}

/**
 * Consolidate: sum weights of identical keys under ring.add, drop zeros.
 * This is where interference happens — opposite-weight entries cancel.
 * Generic over the ring: real weights → no cancel on positive; complex → phase cancel.
 */
export function consolidate<K, W>(
  ring: StarRing<W>,
  isZero: (w: W) => boolean,
  entries: readonly WEntry<K, W>[],
  keyEq: (a: K, b: K) => boolean = (a, b) => a === b,
): WEntry<K, W>[] {
  const grouped: { key: K; weight: W }[] = [];
  for (const entry of entries) {
    const existing = grouped.find((g) => keyEq(g.key, entry.key));
    if (existing) {
      existing.weight = ring.add(existing.weight, entry.weight);
    } else {
      grouped.push({ key: entry.key, weight: entry.weight });
    }
  }
  return grouped.filter((g) => !isZero(g.weight));
}

/**
 * Norm-squared: conj(w) * w. For complex: |z|² = re² + im². For real: w².
 * Used to determine "is this weight effectively zero."
 */
export function normSq<W>(ring: StarRing<W>, w: W): W {
  return ring.mul(ring.conj(w), w);
}
