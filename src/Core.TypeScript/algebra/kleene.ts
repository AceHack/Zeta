/**
 * kleene.ts — the Kleene-algebra tier of the algebra tower (TS oracle side).
 *
 * IKleeneAlgebra = ISemiring + Star (iteration / reflexive-transitive closure),
 * Star(a) = one ⊕ a ⊕ (a⊗a) ⊕ … — the KLEENE star, NOT the involution star of
 * star-ring.ts (orthogonal branches). Kleene addition is IDEMPOTENT (a ⊕ a = a),
 * so there is no additive inverse: it extends ISemiring, never IRing.
 *
 * The tropical (min,+) instance below is the drift-check oracle for
 * kleene-algebra.ir.json: min is idempotent + commutative + associative with
 * identity +∞; + is the product with identity 0 and distributes over min; the
 * star of a non-negative weight is 0 (a self-loop never improves a shortest path).
 * Anchors: Lehmann 1977 (matrix star = closure); Kozen 1994 (Kleene axioms).
 */
import type { ISemiring } from "./interfaces";

/** Kleene algebra: a star-semiring (ISemiring + the Kleene closure `star`). */
export interface IKleeneAlgebra<T> extends ISemiring<T> {
  star(a: T): T;
}

/** Tropical (min,+) Kleene algebra over numbers — the idempotent corner. */
export const tropicalKleene: IKleeneAlgebra<number> = {
  zero: Number.POSITIVE_INFINITY, // additive (min) identity
  one: 0, // multiplicative (+) identity
  add: (a, b) => Math.min(a, b), // ⊕ = min (idempotent)
  mul: (a, b) => a + b, // ⊗ = +
  star: (a) => (a >= 0 ? 0 : Number.NEGATIVE_INFINITY), // (min,+) closure
};
