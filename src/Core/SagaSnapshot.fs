namespace Zeta.Core

open System

/// **081KT07NV0008QG0R003BE6MJ2 slice — resume-not-replay snapshot for self-evolving sagas (Aaron 2026-06-01).** `DurableSaga.fs`
/// recovers by FULL log replay and explicitly defers a state snapshot ("a `'TState` snapshot is a follow-up");
/// this is that follow-up, and it is the 081KT07NV0008QG0R003BE6MJ2 differentiator over the replay family (Durable Functions /
/// Temporal / Dapr Workflow).
///
/// A snapshot captures both halves of a self-evolving saga:
/// - **the pattern** — the `Bonsai.Expr` expression-tree ("the pattern is data"); editable in flight, so the
///   *pattern itself* evolves, not only the state (the superset the replay family structurally cannot do).
/// - **the closure state** — a `DynamicValue` at the cursor.
///
/// `resume` restores both **directly** — it does NOT re-run the body from the start. So the body constraints
/// are looser than replay: **non-determinism in the body is fine**, because we snapshot the *value* rather
/// than re-deriving it. The whole snapshot serialises to `DynamicValue` (pattern via `Bonsai.serialize`),
/// riding the canonical codecs, and the `Seq` cursor is the position on the Z-set/IndexedZSet ladder.
///
/// Anchors: Nuqleon/Reaqtor Bonsai (serialized expr-trees), Temporal/Durable Functions (the interface to
/// meet, replay family we beat on pattern-evolution), 081KRYRGG0008QG0R0018CMFQY (saga compensation = Z-set retraction). This
/// slice is the snapshot + resume + pattern-swap; the Z-set-of-subtrees retraction operator for fine-grained
/// pattern evolution is the next slice.
[<RequireQualifiedAccess>]
module SagaSnapshot =

    /// A resume-not-replay snapshot: the pattern (Bonsai expr-tree), the closure state, and the stream cursor.
    [<NoComparison>]
    type Snapshot =
        { Pattern: Bonsai.Expr // the serialized expression-tree — editable in flight (pattern-as-data)
          State: DynamicValue // the closure state at the cursor
          Seq: int64 } // stream position on the Z-set ladder

    let create (pattern: Bonsai.Expr) (state: DynamicValue) (seq: int64) : Snapshot =
        { Pattern = pattern; State = state; Seq = seq }

    /// **resume, not replay** — restore the snapshot directly: return the `(pattern, state)` to continue
    /// *from*, with no re-execution of the body up to `Seq`. This is the differentiator over the replay family.
    let resume (s: Snapshot) : Bonsai.Expr * DynamicValue = s.Pattern, s.State

    /// Advance to the next cursor with updated closure state (the pattern unchanged).
    let advance (newState: DynamicValue) (s: Snapshot) : Snapshot =
        { s with
            State = newState
            Seq = s.Seq + 1L }

    /// **Pattern evolution** — swap the pattern (the "pattern is data" edit: retract the old expr-tree, admit
    /// a new one). The principled operator is the Z-set retraction (081KRYRGG0008QG0R0018CMFQY: compensation = additive inverse);
    /// this bounded form is a whole-pattern swap at the cursor. Both pattern AND state can now evolve.
    let evolvePattern (newPattern: Bonsai.Expr) (s: Snapshot) : Snapshot = { s with Pattern = newPattern }

    [<Literal>]
    let private PatternKey = "pattern"

    [<Literal>]
    let private StateKey = "state"

    [<Literal>]
    let private SeqKey = "seq"

    /// Serialise a snapshot to `DynamicValue.Object` (rides the canonical codecs). The pattern is emitted via
    /// `Bonsai.serialize` (the cross-oracle byte contract); `Error` if the pattern declines serialisation.
    let toDynamic (s: Snapshot) : Result<DynamicValue, Bonsai.BonsaiFeedback> =
        match Bonsai.serialize s.Pattern with
        | Ok patternStr ->
            Ok(
                DynamicValue.Object
                    [ PatternKey, DynamicValue.String patternStr
                      StateKey, s.State
                      SeqKey, DynamicValue.Int s.Seq ]
            )
        | Error f -> Error f

    /// Parse a snapshot from a `DynamicValue.Object`. `Error` if a field is missing/ill-typed or the pattern
    /// string declines parsing. `toDynamic`/`ofDynamic` round-trip: `ofDynamic (toDynamic s) = Ok s`.
    let ofDynamic (dv: DynamicValue) : Result<Snapshot, Bonsai.BonsaiFeedback> =
        match dv with
        | DynamicValue.Object kvs ->
            let find k =
                kvs |> List.tryPick (fun (kk, v) -> if String.Equals(kk, k, StringComparison.Ordinal) then Some v else None)

            match find PatternKey, find StateKey, find SeqKey with
            | Some(DynamicValue.String patternStr), Some state, Some(DynamicValue.Int seq) ->
                match Bonsai.parse patternStr with
                | Ok pattern -> Ok { Pattern = pattern; State = state; Seq = seq }
                | Error f -> Error f
            | _ -> Error(Bonsai.BonsaiFeedback.MalformedJson "snapshot: missing/ill-typed pattern, state, or seq field")
        | _ -> Error(Bonsai.BonsaiFeedback.MalformedJson "snapshot: missing/ill-typed pattern, state, or seq field")
