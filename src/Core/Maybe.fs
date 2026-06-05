namespace Zeta.Core

/// **Maybe — the value-level absence monad (lawful, never-collapse).**
///
/// A `Maybe<'a>` is `Just of 'a | Nothing`: an explicit, first-class **absent value** that
/// **propagates** through computation (`Nothing` combined with anything is `Nothing`) instead
/// of collapsing into a sentinel (0 / "" / empty). It is the **value-register** companion to
/// `TriBoolean` (the *logic* register) and `DynamicValue.Null` (the *carrier*) — together they
/// keep absence distinct from empty / false / zero across computation, logic, and
/// serialization (the never-collapse discipline on the *value* axis).
///
/// **This is the general monad, not SQL semantics.** Maybe is exactly the Haskell/`Option`
/// Maybe — a lawful monad (`ret`/`bind`: left identity, right identity, associativity — proven
/// in `Maybe.Tests.fs`) so it composes with the rest of the monadic substrate (`Result`,
/// `Tri`'s bind, the fold/interpreter layers). `map` (functor), `map2`/`apply` (applicative —
/// the binary-op *propagation* lift) round out the kit.
///
/// **SQL is a BRIDGE on top, not this type.** SQL `NULL` adds three-valued comparison
/// (`NULL = 5 → UNKNOWN : Tri`), NULL-aware aggregates, etc. — semantics that belong in a
/// future `SqlNull` layer that *consumes* `Maybe` + `TriBoolean` at the SQL-query boundary.
/// Keeping them separate means the monad stands on its own and the SQL footguns stay scoped
/// to the SQL adapter. (Distinct from F#'s own `Option` so "recorded absence" is never
/// silently conflated with "no result" — bridged explicitly via `ofOption`/`toOption`.)
///
/// Uses the F# `Option`-style `ModuleSuffix` type+module pattern (the `Maybe` type and the
/// `Maybe` function module coexist).
type Maybe<'a> =
    /// A present (known) value.
    | Just of 'a
    /// The propagating absent value.
    | Nothing

[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module Maybe =

    /// Monadic unit / `return`: wrap a known value.
    let ret (x: 'a) : Maybe<'a> = Just x

    /// True iff absent.
    let isNothing (x: Maybe<'a>) : bool =
        match x with
        | Nothing -> true
        | Just _ -> false

    /// Functor map: apply `f` to a present value; `Nothing` propagates unchanged.
    let map (f: 'a -> 'b) (x: Maybe<'a>) : Maybe<'b> =
        match x with
        | Just a -> Just(f a)
        | Nothing -> Nothing

    /// Monadic bind: chain an absence-producing step; `Nothing` short-circuits (propagates).
    let bind (f: 'a -> Maybe<'b>) (x: Maybe<'a>) : Maybe<'b> =
        match x with
        | Just a -> f a
        | Nothing -> Nothing

    /// Applicative apply: `Nothing` in either position propagates.
    let apply (f: Maybe<'a -> 'b>) (x: Maybe<'a>) : Maybe<'b> =
        match f, x with
        | Just g, Just a -> Just(g a)
        | _ -> Nothing

    /// The binary-operation **propagation lift** — the heart of `Nothing + 5 = Nothing`:
    /// combine two values with `f`, but if EITHER is `Nothing` the result is `Nothing`.
    let map2 (f: 'a -> 'b -> 'c) (a: Maybe<'a>) (b: Maybe<'b>) : Maybe<'c> =
        match a, b with
        | Just x, Just y -> Just(f x y)
        | _ -> Nothing

    /// Value or a default when absent.
    let defaultValue (d: 'a) (x: Maybe<'a>) : 'a =
        match x with
        | Just a -> a
        | Nothing -> d

    /// Bridge from F# `option` ('no result') to `Maybe` ('absent value').
    let ofOption (o: 'a option) : Maybe<'a> =
        match o with
        | Some a -> Just a
        | None -> Nothing

    /// Bridge to F# `option`.
    let toOption (x: Maybe<'a>) : 'a option =
        match x with
        | Just a -> Some a
        | Nothing -> None
