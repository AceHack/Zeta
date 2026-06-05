namespace Zeta.Core.FSharp.TriBoolean

/// **Predicate3 — the THREE-valued predicate register (Kleene K3).**
///
/// A `Predicate3<'a>` is `'a -> Tri`: for one value it answers "is this SELECTED —
/// true, false, or UNKNOWN?". It is the tri-valued sibling of `Predicate<'a>`
/// (`'a -> bool`, `src/Core/Predicate.fs`). A two-valued predicate must collapse
/// null/unknown into true-or-false — a **register-collapse** that crushes two genuinely
/// distinct states ("definitely false" vs "unknown/null") into one and so destroys
/// SQL-null monad propagation. `Predicate3` keeps UNKNOWN as a first-class third value so
/// it **propagates through composition**, exactly like SQL's three-valued `WHERE`
/// (Kleene K3 / Łukasiewicz: `NULL = 5` is UNKNOWN, not false; `NOT UNKNOWN = UNKNOWN`;
/// `UNKNOWN OR TRUE = TRUE`; `UNKNOWN AND FALSE = FALSE`).
///
/// The K3 connectives below are thin pointwise lifts of the already-proven truth tables in
/// `TriBoolean` (`andTri`/`orTri`/`notTri`). The 3→2 collapse happens **once**, at the
/// terminal `isSelected`/`filter` boundary (the legitimate place to decide include/exclude),
/// never inside `andP3`/`orP3`/`notP3` — keeping three values through composition is what
/// preserves propagation. Composes the never-collapse discipline: distinct states stay
/// distinct until a boundary forces a choice.
[<RequireQualifiedAccess>]
module Predicate3 =

    /// A three-valued decision over one value of shape `'a`: true / false / UNKNOWN.
    type Predicate3<'a> = 'a -> Tri

    /// ⊤ — always certainly selected.
    let always: Predicate3<'a> = fun _ -> Tri.T

    /// ⊥ — always certainly rejected.
    let never: Predicate3<'a> = fun _ -> Tri.F

    /// The held (UNKNOWN) predicate — selection is living-uncertain for every input.
    let unknown: Predicate3<'a> = fun _ -> Tri.N

    /// Lift a two-valued predicate (`'a -> bool`) into the three-valued register. A lifted
    /// predicate never yields UNKNOWN — total/known inputs stay certain.
    let ofBool (p: 'a -> bool) : Predicate3<'a> = fun a -> TriBoolean.fromBool (p a)

    /// Conjunction (Kleene K3 meet): F if either is F, else N if either is N, else T.
    let andP3 (p: Predicate3<'a>) (q: Predicate3<'a>) : Predicate3<'a> =
        fun a -> TriBoolean.andTri (p a) (q a)

    /// Disjunction (Kleene K3 join): T if either is T, else N if either is N, else F.
    let orP3 (p: Predicate3<'a>) (q: Predicate3<'a>) : Predicate3<'a> =
        fun a -> TriBoolean.orTri (p a) (q a)

    /// Negation (K3): swaps T/F, fixes N (`NOT UNKNOWN = UNKNOWN`).
    let notP3 (p: Predicate3<'a>) : Predicate3<'a> = fun a -> TriBoolean.notTri (p a)

    /// Kleene implication `(¬p) ∨ q`.
    let implies (p: Predicate3<'a>) (q: Predicate3<'a>) : Predicate3<'a> = orP3 (notP3 p) q

    /// Terminal SELECTION boundary — the one legitimate 3→2 collapse: a value is included
    /// iff the predicate is certainly TRUE; UNKNOWN and FALSE are both excluded (SQL `WHERE`
    /// keeps only rows where the condition is TRUE — UNKNOWN drops out). This collapse
    /// happens ONCE, here, after all K3 composition.
    let isSelected (p: Predicate3<'a>) (a: 'a) : bool =
        match p a with
        | Tri.T -> true
        | Tri.F
        | Tri.N -> false

    /// Filter a sequence by the terminal selection boundary (SQL `WHERE` semantics:
    /// keep only certainly-TRUE; drop FALSE and UNKNOWN).
    let filter (p: Predicate3<'a>) (xs: 'a seq) : 'a seq = Seq.filter (isSelected p) xs
