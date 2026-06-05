namespace Zeta.Core

/// **Predicate — the reusable decision-over-shape kernel.**
///
/// A `Predicate<'a>` is a total function `'a -> bool`: it answers, for one value
/// of an arbitrary shape `'a`, "is this value SELECTED?". The combinators below
/// form a **Boolean algebra** (a complemented distributive lattice) over
/// predicates: `andP`/`orP`/`notP` are meet/join/complement, `always`/`never`
/// are top/bottom (⊤/⊥), and the standard laws (associativity, commutativity,
/// distributivity, De Morgan, complement, identity) all hold under extensional
/// equality (two predicates are equal iff they agree on every input). Because a
/// `Predicate<'a>` carries no negation-as-absence and is closed under the Boolean
/// operations, it is also a **Heyting algebra** whose `implies` is `(not p) ∨ q`.
///
/// **Why ONE kernel, parameterized by `'a`.** The polymorphism IS the
/// cross-junction reuse: serialization specializes `'a = key` (which Object keys
/// get named elements), trust specializes `'a = nodeId`, retry specializes
/// `'a = attempt`, dispatch specializes `'a = type-tuple` — the SAME algebra,
/// a different `'a`. We specialize only when the shapes genuinely differ; the
/// decision logic stays in this one place.
///
/// **Category-theory framing.** A predicate over `'a` is a *sieve* / a
/// characteristic map into the subobject classifier Ω = `bool`: it picks out
/// the sub-shape of `'a` that is selected (Lawvere; topos-theoretic
/// subobject classifier). `andP`/`orP` are the lattice operations on the poset
/// of sub-shapes (a Heyting algebra in any topos).
///
/// **The familiar face: SQL `WHERE`.** A `Predicate<'a>` is exactly a relational
/// selection predicate σ (Codd 1970, *A Relational Model of Data for Large
/// Shared Data Banks*): `WHERE p AND q`, `WHERE p OR q`, `WHERE NOT p`. The
/// algebra here is the same Boolean algebra SQL's `WHERE` clause lives in.
[<RequireQualifiedAccess>]
module Predicate =

    /// A decision over one value of shape `'a`: "is this value selected?".
    type Predicate<'a> = 'a -> bool

    /// ⊤ — selects everything (Boolean-algebra top / lattice unit for `andP`).
    let always: Predicate<'a> = fun _ -> true

    /// ⊥ — selects nothing (Boolean-algebra bottom / lattice unit for `orP`).
    let never: Predicate<'a> = fun _ -> false

    /// Conjunction (meet, ∧): selected iff BOTH predicates select. Short-circuits.
    let andP (p: Predicate<'a>) (q: Predicate<'a>) : Predicate<'a> = fun a -> p a && q a

    /// Disjunction (join, ∨): selected iff EITHER predicate selects. Short-circuits.
    let orP (p: Predicate<'a>) (q: Predicate<'a>) : Predicate<'a> = fun a -> p a || q a

    /// Complement (¬): selected iff the predicate does NOT select.
    let notP (p: Predicate<'a>) : Predicate<'a> = fun a -> not (p a)

    /// Material implication (p → q ≡ ¬p ∨ q): the Heyting arrow for this Boolean algebra.
    let implies (p: Predicate<'a>) (q: Predicate<'a>) : Predicate<'a> = fun a -> (not (p a)) || q a

    /// Exclusive-or (⊕): selected iff EXACTLY ONE predicate selects.
    let xorP (p: Predicate<'a>) (q: Predicate<'a>) : Predicate<'a> = fun a -> p a <> q a

    /// Membership in a finite `Set<'a>` — the "value is one of these" predicate
    /// (relational `WHERE x IN (…)`). Requires `'a : comparison` for the set; the
    /// rest of the kernel is unconstrained, so this lives as its own function
    /// rather than constraining `Predicate<'a>` itself.
    let ofSet (set: Set<'a>) : Predicate<'a> = fun a -> Set.contains a set
