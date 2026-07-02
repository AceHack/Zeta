namespace Zeta.Core

open System

/// **EventEnvelope — CloudEvents / Debezium envelope categories (metadata ⊕ payload).**
/// (Aaron 2026-07-02, shadow*: "we want cloud events/debezium envelopes too … very similar
/// to frontmatter, same kind of graph … one graph, many surfaces.")
///
/// The parity wrapper (`ValueTreeEnvelope`) closes non-native scalars; THIS module is the
/// other face of the same shape — the **metadata head ⊕ payload** frame that frontmatter and
/// the standard event envelopes share. An event is just a `DynamicValue` value tree with a
/// standard metadata header, so it rides the WHOLE codec stack for free (json/cbor/yaml/asn1
/// + parity) — no new codec, a shape on the landed port.
///
/// The metadata head is a **graph**: `source` / `subject` / causation ids are `ZetaId`
/// references (the universal pointer of the doctrine §8 — resolves inside AND outside the
/// superdeterministic Markov boundary). One dependency-graph discipline (deps / frontmatter /
/// event-causation), many surfaces.
///
/// Distinctive Zeta content: a **Debezium `op` is a Z-set weight** — create/read ASSERT (+1),
/// delete RETRACTS (−1), update is retract-then-assert (−1 then +1). The CDC envelope folds
/// straight into a DBSP Z-set delta.
///
/// Anchors: CloudEvents (CNCF spec 1.0); Debezium (CDC change-event envelope); Z-set/DBSP
/// (Budiu et al.) — retraction is correction, not a duplicate.
[<RequireQualifiedAccess>]
module EventEnvelope =

    // ── CloudEvents (CNCF spec 1.0) ──

    [<Literal>]
    let cloudEventsSpecVersion = "1.0"

    /// The four REQUIRED CloudEvents context attributes (spec §3 "REQUIRED").
    let cloudEventRequired = [ "specversion"; "id"; "source"; "type" ]

    /// Build a CloudEvents 1.0 envelope value tree. `source` is a `ZetaId` reference (a §8
    /// graph edge); `data` is the payload value tree carried by whichever codec the substrate
    /// wants (YAML git-native, CBOR DAG-native, …).
    let cloudEvent (id: string) (source: string) (eventType: string) (data: DynamicValue) : DynamicValue =
        DynamicValue.Object
            [ "specversion", DynamicValue.String cloudEventsSpecVersion
              "id", DynamicValue.String id
              "source", DynamicValue.String source
              "type", DynamicValue.String eventType
              "data", data ]

    /// Validate the required CloudEvents context attributes are present and String-typed.
    /// Unknown attributes pass through (forward-compat — the same unknown-metadata rule as
    /// the versioned parity envelope).
    let validateCloudEvent (dv: DynamicValue) : Result<unit, string> =
        match dv with
        | DynamicValue.Object _ ->
            let missing =
                cloudEventRequired
                |> List.filter (fun k ->
                    match DynamicValue.tryField k dv with
                    | Some(DynamicValue.String _) -> false
                    | _ -> true)
            if List.isEmpty missing then
                Ok()
            else
                Error(sprintf "cloudevent: missing/invalid required attributes: %s" (String.concat ", " missing))
        | _ -> Error "cloudevent: envelope must be an Object"

    // ── Debezium CDC envelope — op ≈ Z-set weight (±1) ──

    /// A Debezium change operation (the `op` field).
    type DebeziumOp =
        | Create // "c"
        | Read // "r" (snapshot read)
        | Update // "u"
        | Delete // "d"

    let opCode (op: DebeziumOp) : string =
        match op with
        | Create -> "c"
        | Read -> "r"
        | Update -> "u"
        | Delete -> "d"

    let parseOp (s: string) : Result<DebeziumOp, string> =
        match s with
        | "c" -> Ok Create
        | "r" -> Ok Read
        | "u" -> Ok Update
        | "d" -> Ok Delete
        | other -> Error(sprintf "debezium: unknown op '%s'" other)

    /// Build a Debezium change-event envelope value tree (before / after / op / source).
    let debeziumEnvelope
        (before: DynamicValue)
        (after: DynamicValue)
        (op: DebeziumOp)
        (source: DynamicValue)
        : DynamicValue =
        DynamicValue.Object
            [ "before", before
              "after", after
              "op", DynamicValue.String(opCode op)
              "source", source ]

    /// **The Zeta bridge:** fold a Debezium CDC envelope into Z-set deltas. create/read
    /// ASSERT the after-row (+1); delete RETRACTS the before-row (−1); update is a
    /// retract-then-assert (−1 then +1) — the Z-set CORRECTION, not a duplicate. Returns the
    /// `(row, weight)` deltas ready to apply to a DBSP Z-set.
    let debeziumToZSet (dv: DynamicValue) : Result<(DynamicValue * int) list, string> =
        match DynamicValue.tryField "op" dv with
        | Some(DynamicValue.String opStr) ->
            parseOp opStr
            |> Result.map (fun op ->
                let before = DynamicValue.tryField "before" dv |> Option.defaultValue DynamicValue.Null
                let after = DynamicValue.tryField "after" dv |> Option.defaultValue DynamicValue.Null
                match op with
                | Create
                | Read -> [ after, +1 ]
                | Delete -> [ before, -1 ]
                | Update -> [ before, -1; after, +1 ])
        | _ -> Error "debezium: missing or non-string 'op' field"
