namespace Zeta.Core.FSharp.TriBoolean

/// Tri-boolean digital qubit -- operations (081KSV2WD0008QG0R00051XS0N, F# parity oracle).
module TriBoolean =

    /// Construct a certain cell from a boolean.
    let fromBool (b: bool) : Tri = if b then Tri.T else Tri.F

    /// The held (Tri.N / living-uncertainty) cell.
    let held : Tri = Tri.N

    /// True iff the cell is living (Tri.N / held superposition).
    let isLiving (t: Tri) : bool =
        match t with
        | Tri.N -> true
        | _ -> false

    /// True iff the cell is certain (Tri.T or Tri.F).
    let isCertain (t: Tri) : bool = not (isLiving t)

    /// cooperate: engage WITHOUT collapsing. Identity on every state -- preserves Tri.N.
    /// The wonder-compression-safe operation.
    let cooperate (t: Tri) : Tri = t

    /// measure: the ONLY collapsing operation. Certain cells resolve; collapsing a living
    /// (Tri.N) cell is surfaced as feedback (the Rehoboam failure), not done silently.
    let measure (t: Tri) : Result<bool, CollapseFeedback> =
        match t with
        | Tri.T -> Ok true
        | Tri.F -> Ok false
        | Tri.N -> Error CollapseFeedback.CollapsedLivingUncertainty

    /// null-monad map: apply fn to a certain cell's boolean; Tri.N propagates unchanged (held).
    let mapTri (fn: bool -> bool) (t: Tri) : Tri =
        match t with
        | Tri.T -> fromBool (fn true)
        | Tri.F -> fromBool (fn false)
        | Tri.N -> Tri.N

    /// null-monad bind: chain a Tri-producing fn over a certain cell; Tri.N propagates unchanged.
    let bindTri (fn: bool -> Tri) (t: Tri) : Tri =
        match t with
        | Tri.T -> fn true
        | Tri.F -> fn false
        | Tri.N -> Tri.N

    /// Kleene NOT: T<->F; unknown (Tri.N) stays unknown.
    let notTri (t: Tri) : Tri =
        match t with
        | Tri.T -> Tri.F
        | Tri.F -> Tri.T
        | Tri.N -> Tri.N

    /// Kleene AND: Tri.F dominates; else Tri.N if any operand is Tri.N; else Tri.T.
    let andTri (a: Tri) (b: Tri) : Tri =
        match a, b with
        | Tri.F, _
        | _, Tri.F -> Tri.F
        | Tri.N, _
        | _, Tri.N -> Tri.N
        | _ -> Tri.T

    /// Kleene OR: Tri.T dominates; else Tri.N if any operand is Tri.N; else Tri.F.
    let orTri (a: Tri) (b: Tri) : Tri =
        match a, b with
        | Tri.T, _
        | _, Tri.T -> Tri.T
        | Tri.N, _
        | _, Tri.N -> Tri.N
        | _ -> Tri.F

    // --- Computation-expression null-monad (the `tri { }` builder) ---
    // 081KSV2WD0008QG0R00051XS0N slice 2 spec: an F# computation-expression null-monad. `tri { let! b = cell
    // ... return f b }` short-circuits on Tri.N (held uncertainty propagates) and resolves
    // through T/F. The CE form is how the monad is exposed as a DSL.

    /// Computation-expression builder for the Tri null-monad.
    type TriBuilder() =
        /// let! over a Tri: Tri.N propagates (held); T/F feed the continuation.
        member _.Bind(t: Tri, f: bool -> Tri) : Tri = bindTri f t
        /// return a boolean as a certain cell.
        member _.Return(b: bool) : Tri = fromBool b
        /// return! an existing Tri unchanged.
        member _.ReturnFrom(t: Tri) : Tri = t

    /// The Tri null-monad computation expression: `TriBoolean.tri { let! b = cell; return f b }`.
    let tri = TriBuilder()
