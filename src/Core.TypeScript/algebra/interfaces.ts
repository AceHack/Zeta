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

// ─── ISemiring<T> ───────────────────────────────────────────────────────

/** Semiring (rig): additive monoid (Zero, Add) + multiplicative monoid (One, Mul).
 * NO additive inverse — lawful semirings (tropical min-plus) provably cannot
 * always supply one (idempotent ⇒ zerosumfree: Vandiver 1934, Golan 1999).
 * Retraction-capable algebras implement IRing (081KWG9JQ9H). */
export interface ISemiring<T> {
  readonly zero: T;
  readonly one: T;
  add(a: T, b: T): T;
  mul(a: T, b: T): T;
}

// ─── IRing<T> ───────────────────────────────────────────────────────────

/** Ring: the earned quotient over ISemiring — adds the additive inverse
 * (add(a, negate(a)) = zero), which retraction/undo/DBSP rollback require. */
export interface IRing<T> extends ISemiring<T> {
  negate(a: T): T;
}

// ─── IGroup<T> ──────────────────────────────────────────────────────────

/** Group: identity + combine + inverse. The minimal structure for undo/retract. */
export interface IGroup<T> {
  readonly identity: T;
  combine(a: T, b: T): T;
  inverse(a: T): T;
}

// ─── IMonoid<T> ─────────────────────────────────────────────────────────

/** Monoid: identity + combine. No inverse. The CRDT merge floor. */
export interface IMonoid<T> {
  readonly identity: T;
  combine(a: T, b: T): T;
}

// ─── ILattice<T> ────────────────────────────────────────────────────────

/** Semilattice: join (least upper bound) + meet (greatest lower bound). CRDT merge. */
export interface ILattice<T> {
  join(a: T, b: T): T;
  meet(a: T, b: T): T;
}

/** Join-semilattice only (GSet, LWW-Register — monotone, no retraction). */
export interface IJoinSemilattice<T> {
  join(a: T, b: T): T;
}

// ─── IFunctor<F> ────────────────────────────────────────────────────────

/** Functor: lift a function over a container/context. Covariant. */
export interface IFunctor<F> {
  map<A, B>(fa: F & { readonly _A: A }, f: (a: A) => B): F & { readonly _A: B };
}

/**
 * Simplified functor for concrete containers (not HKT — TS can't express HKT natively).
 * Use this for practical array/option/result functors.
 */
export interface Mappable<T> {
  map<U>(f: (value: T) => U): Mappable<U>;
}

// ─── IMonad<M> ──────────────────────────────────────────────────────────

/** Monad: return (lift a value) + bind (chain computations). The distribution/soft-value lift. */
export interface IMonad<T> {
  /** Lift a pure value into the monadic context. */
  of<A>(value: A): IMonad<A>;
  /** Chain: apply f to the inner value, flattening the result. */
  flatMap<U>(f: (value: T) => IMonad<U>): IMonad<U>;
}

// ─── ICodec<A, B> ──────────────────────────────────────────────────────

/**
 * Codec: encode/decode pair. A is contravariant (input), B is covariant (output).
 * The DynamicValue ↔ domain types serialization contract.
 */
export interface ICodec<A, B> {
  encode(a: A): B;
  decode(b: B): A;
}

/** Round-trip codec: encode then decode = identity. */
export interface IRoundTripCodec<A, B> extends ICodec<A, B> {
  /** Verify: decode(encode(a)) === a */
  isRoundTrip(a: A, eq?: (x: A, y: A) => boolean): boolean;
}

// ─── IPort<T> ──────────────────────────────────────────────────────────

/**
 * Hexagonal port: the boundary between the domain and the infrastructure.
 * Invariant on T (read + write). The WorkspacePort, EventSink, OperatorPort pattern.
 */
export interface IPort<T> {
  read(): T | Promise<T>;
  write(value: T): void | Promise<void>;
}

/** Read-only port (covariant — can widen output). */
export interface IReadPort<T> {
  read(): T | Promise<T>;
}

/** Write-only port (contravariant — can narrow input). */
export interface IWritePort<T> {
  write(value: T): void | Promise<void>;
}

// ─── Instances ──────────────────────────────────────────────────────────

/** Number as a ring (standard arithmetic; ring tier — negate is lawful here). */
export const numberSemiring: IRing<number> = {
  zero: 0,
  one: 1,
  add: (a, b) => a + b,
  mul: (a, b) => a * b,
  negate: (a) => -a,
};

/** Additive group over numbers. */
export const additiveGroup: IGroup<number> = {
  identity: 0,
  combine: (a, b) => a + b,
  inverse: (a) => -a,
};

/** Max semilattice (numbers under max). */
export const maxLattice: IJoinSemilattice<number> = {
  join: (a, b) => Math.max(a, b),
};

/** Boolean OR semilattice (GSet-style monotone growth). */
export const boolOrLattice: IJoinSemilattice<boolean> = {
  join: (a, b) => a || b,
};

/** Set union monoid. */
export function setUnionMonoid<T>(): IMonoid<Set<T>> {
  return {
    identity: new Set<T>(),
    combine: (a, b) => new Set([...a, ...b]),
  };
}

/** JSON codec (encode: object → string, decode: string → object). */
export const jsonCodec: ICodec<unknown, string> = {
  encode: (a) => JSON.stringify(a),
  decode: (b) => JSON.parse(b),
};
