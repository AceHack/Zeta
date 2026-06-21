namespace Zeta.Core.FSharp.Observe

/// The observe event log as an additive MONOID (081KSXN940008QG0R0002287MP, Target 2 — F# slice),
/// expressed via F#'s native generic-math convention: `Zero` (identity) + `(+)`
/// (associative op). This is the F# parallel to the C# `EventLog`'s
/// `System.Numerics` `IAdditiveIdentity` + `IAdditionOperators` — each language
/// owns the interface in its OWN idiom. F#'s generic numeric machinery (SRTP,
/// `List.sum`, `LanguagePrimitives.GenericZero`) recognizes `Zero`/`(+)`, so this
/// is the genuine F# generic-math surface, not a transplant of the C# IWSAM
/// interfaces (which would fight the language).
///
/// Additive-monoidal ONLY (operator 2026-05-31): the log is the FREE monoid —
/// identity = empty log, op = associative append — not a field-like number
/// (no multiplication, ordering, or negatives to invent).
///
/// Load-bearing law: `FoldOnto` is the monoid action / homomorphism onto `World`
/// — folding a concatenated log equals incremental folding:
///   `(a + b).FoldOnto w0  =  b.FoldOnto (a.FoldOnto w0)`
/// i.e. append-only / DST-replay soundness.
///
/// UoM (`[<Measure>]`) is intentionally absent: the observe `World` carries no
/// measurable numeric quantity (only ids, flags, a mode), so units here would be
/// ceremony, not safety; UoM lives at the TriFloat / attention value domain
/// (`src/Core/Units.fs`). F# records give structural equality (incl. the
/// `NextAction list`), so two logs with equal events are value-equal natively.
type EventLog =
    { Events: NextAction list }

    /// The empty log — the monoid identity (F# generic-math `Zero`).
    static member Zero: EventLog = { Events = [] }

    /// Associative append — the free-monoid operation.
    static member (+)(left: EventLog, right: EventLog) : EventLog =
        { Events = left.Events @ right.Events }

    /// Project this log onto an initial world: the monoid action / homomorphism
    /// to `World`. Equivalent to `Algebra.fold initial this.Events`; satisfies
    /// `(a + b).FoldOnto w0 = b.FoldOnto (a.FoldOnto w0)`.
    member this.FoldOnto(initial: World) : World = Algebra.fold initial this.Events
