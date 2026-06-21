/**
 * src/Core.TypeScript/algebra/interfaces.ts — the full algebraic interface stack.
 *
 * GCF principle: richest shared structure all 7 languages can express.
 * These compose: ISemiring → IStarRing (in star-ring.ts), IGroup → IMonoid,
 * ILattice → CRDT merge, IFunctor/IMonad → soft-value lift, ICodec → serialization.
 *
 * Each interface is:
 * - A dictionary of operations (no state, pure)
 * - Composable (extends/inherits)
 * - Ring-generic (parameterized by element type)
 * - Expressible in all 7 target languages (see codegen-interface.ts)
 */
// ─── Instances ──────────────────────────────────────────────────────────
/** Number as a semiring (standard arithmetic). */
export const numberSemiring = {
    zero: 0,
    one: 1,
    add: (a, b) => a + b,
    mul: (a, b) => a * b,
    negate: (a) => -a,
};
/** Additive group over numbers. */
export const additiveGroup = {
    identity: 0,
    combine: (a, b) => a + b,
    inverse: (a) => -a,
};
/** Max semilattice (numbers under max). */
export const maxLattice = {
    join: (a, b) => Math.max(a, b),
};
/** Boolean OR semilattice (GSet-style monotone growth). */
export const boolOrLattice = {
    join: (a, b) => a || b,
};
/** Set union monoid. */
export function setUnionMonoid() {
    return {
        identity: new Set(),
        combine: (a, b) => new Set([...a, ...b]),
    };
}
/** JSON codec (encode: object → string, decode: string → object). */
export const jsonCodec = {
    encode: (a) => JSON.stringify(a),
    decode: (b) => JSON.parse(b),
};
