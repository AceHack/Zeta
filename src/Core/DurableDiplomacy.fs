namespace Zeta.Core

/// **DurableDiplomacy — cached polymorphic diplomacy OVER AN INFINITE STREAM.**
///
/// The durable half of the V8-hidden-shapes/PIC cache (`Diplomacy.negotiateCached`): the
/// shape-keyed negotiation cache becomes a **fold over an agreement stream**. Each
/// freedom-first agreement is appended to an `IDeltaLog` (e.g. `GitDeltaLog` — the agreement
/// log = the relationship's history); the live cache is the fold of that stream. Recovery
/// replays the log and rebuilds the cache — cached polymorphic diplomacy that survives crash.
///
/// **Design calls (Otto, 2026-06-07):**
///  - *Serialization:* `Shape`/`Profile`/`NegotiationOutcome` → `DynamicValue` → canonical-CBOR
///    hex (rides the byte-locked codec; a comparison-able `string` delta-log event). Capability
///    sets serialise ordinal-sorted (culture-invariant) for determinism.
///  - *Supersession:* **last-write-wins per profile-pair key**, via an immutable `Map` fold. A
///    re-negotiation of the *same* shape supersedes the prior agreement; a *shape change* is a
///    different key, so agreements for different shapes coexist (natural PIC invalidation).
///  - *Shadow:* an agreement is *proposed* onto the stream (an append); the **fold (what
///    remains) is the authority**, never a single append (source≠authorization).
[<RequireQualifiedAccess>]
module DurableDiplomacy =

    let private sequence (xs: Result<'a, string> list) : Result<'a list, string> =
        let rec go acc =
            function
            | [] -> Ok(List.rev acc)
            | Ok x :: t -> go (x :: acc) t
            | Error e :: _ -> Error e
        go [] xs

    // ── Shape ⇄ DynamicValue (compact tag encoding) ──
    let rec shapeToDv (s: Diplomacy.Shape) : DynamicValue =
        match s with
        | Diplomacy.SNull -> DynamicValue.String "N"
        | Diplomacy.SBool -> DynamicValue.String "B"
        | Diplomacy.SInt -> DynamicValue.String "I"
        | Diplomacy.SFloat -> DynamicValue.String "F"
        | Diplomacy.SString -> DynamicValue.String "S"
        | Diplomacy.SBytes -> DynamicValue.String "Y"
        | Diplomacy.SArray xs -> DynamicValue.Object [ "a", DynamicValue.Array(List.map shapeToDv xs) ]
        | Diplomacy.SObject kvs ->
            DynamicValue.Object
                [ "o", DynamicValue.Array [ for k, v in kvs -> DynamicValue.Array [ DynamicValue.String k; shapeToDv v ] ] ]

    let rec shapeOfDv (dv: DynamicValue) : Result<Diplomacy.Shape, string> =
        match dv with
        | DynamicValue.String "N" -> Ok Diplomacy.SNull
        | DynamicValue.String "B" -> Ok Diplomacy.SBool
        | DynamicValue.String "I" -> Ok Diplomacy.SInt
        | DynamicValue.String "F" -> Ok Diplomacy.SFloat
        | DynamicValue.String "S" -> Ok Diplomacy.SString
        | DynamicValue.String "Y" -> Ok Diplomacy.SBytes
        | DynamicValue.Object [ "a", DynamicValue.Array xs ] ->
            xs |> List.map shapeOfDv |> sequence |> Result.map Diplomacy.SArray
        | DynamicValue.Object [ "o", DynamicValue.Array kvs ] ->
            kvs
            |> List.map (fun kv ->
                match kv with
                | DynamicValue.Array [ DynamicValue.String k; v ] -> shapeOfDv v |> Result.map (fun s -> k, s)
                | other -> Error(sprintf "shapeOfDv: bad object entry %A" other))
            |> sequence
            |> Result.map Diplomacy.SObject
        | other -> Error(sprintf "shapeOfDv: unrecognised shape %A" other)

    // ── Profile ⇄ DynamicValue ──
    let profileToDv (p: Diplomacy.Profile) : DynamicValue =
        DynamicValue.Object
            [ "id", shapeToDv p.Identity
              // Set<string> enumerates ordinal-sorted — culture-invariant, deterministic.
              "caps", DynamicValue.Array [ for c in p.Capabilities -> DynamicValue.String c ] ]

    let profileOfDv (dv: DynamicValue) : Result<Diplomacy.Profile, string> =
        match dv with
        | DynamicValue.Object kvs ->
            let find k = kvs |> List.tryPick (fun (kk, v) -> if kk = k then Some v else None)
            match find "id", find "caps" with
            | Some idDv, Some(DynamicValue.Array caps) ->
                shapeOfDv idDv
                |> Result.bind (fun id ->
                    caps
                    |> List.map (function
                        | DynamicValue.String s -> Ok s
                        | other -> Error(sprintf "profileOfDv: bad capability %A" other))
                    |> sequence
                    |> Result.map (fun cs -> { Diplomacy.Identity = id; Diplomacy.Capabilities = Set.ofList cs }))
            | _ -> Error "profileOfDv: missing id/caps"
        | other -> Error(sprintf "profileOfDv: expected Object, got %A" other)

    // ── NegotiationOutcome ⇄ DynamicValue ──
    let outcomeToDv (o: Diplomacy.NegotiationOutcome) : DynamicValue =
        match o with
        | Diplomacy.RefusedNoExit(a, b) ->
            DynamicValue.Object [ "k", DynamicValue.String "refused"; "a", DynamicValue.Bool a; "b", DynamicValue.Bool b ]
        | Diplomacy.Negotiated caps ->
            DynamicValue.Object
                [ "k", DynamicValue.String "negotiated"
                  "caps", DynamicValue.Array [ for c in caps -> DynamicValue.String c ] ]

    let outcomeOfDv (dv: DynamicValue) : Result<Diplomacy.NegotiationOutcome, string> =
        match dv with
        | DynamicValue.Object kvs ->
            let find k = kvs |> List.tryPick (fun (kk, v) -> if kk = k then Some v else None)
            match find "k" with
            | Some(DynamicValue.String "refused") ->
                match find "a", find "b" with
                | Some(DynamicValue.Bool a), Some(DynamicValue.Bool b) -> Ok(Diplomacy.RefusedNoExit(a, b))
                | _ -> Error "outcomeOfDv: refused missing a/b"
            | Some(DynamicValue.String "negotiated") ->
                match find "caps" with
                | Some(DynamicValue.Array caps) ->
                    caps
                    |> List.map (function
                        | DynamicValue.String s -> Ok s
                        | other -> Error(sprintf "outcomeOfDv: bad cap %A" other))
                    |> sequence
                    |> Result.map (fun cs -> Diplomacy.Negotiated(Set.ofList cs))
                | _ -> Error "outcomeOfDv: negotiated missing caps"
            | other -> Error(sprintf "outcomeOfDv: bad kind %A" other)
        | other -> Error(sprintf "outcomeOfDv: expected Object, got %A" other)

    // ── Agreement (profileA, profileB, outcome) ⇄ hex event ──
    let private agreementToDv (a: Diplomacy.Profile) (b: Diplomacy.Profile) (o: Diplomacy.NegotiationOutcome) : DynamicValue =
        DynamicValue.Object [ "a", profileToDv a; "b", profileToDv b; "o", outcomeToDv o ]

    /// Encode an agreement as a canonical-CBOR hex string — the delta-log event.
    let encodeAgreement (a: Diplomacy.Profile) (b: Diplomacy.Profile) (o: Diplomacy.NegotiationOutcome) : string =
        System.Convert.ToHexString(DynamicValue.toCanonicalCborOk (agreementToDv a b o))

    /// Decode an agreement event. Undecodable ⇒ `invalidArg` (corruption of our own encoding).
    let decodeAgreement (s: string) : Diplomacy.Profile * Diplomacy.Profile * Diplomacy.NegotiationOutcome =
        let fail e = invalidArg (nameof s) $"DurableDiplomacy.decodeAgreement: {e}"
        match DynamicValue.fromCanonicalCbor (System.Convert.FromHexString s) with
        | Error e -> fail (sprintf "undecodable CBOR: %A" e)
        | Ok(DynamicValue.Object kvs) ->
            let find k = kvs |> List.tryPick (fun (kk, v) -> if kk = k then Some v else None)
            match find "a", find "b", find "o" with
            | Some aDv, Some bDv, Some oDv ->
                match profileOfDv aDv, profileOfDv bDv, outcomeOfDv oDv with
                | Ok a, Ok b, Ok o -> a, b, o
                | r1, r2, r3 -> fail (sprintf "%A / %A / %A" r1 r2 r3)
            | _ -> fail "missing a/b/o"
        | Ok other -> fail (sprintf "expected Object, got %A" other)

    // ── The durable cache = a Map fold over the agreement stream (last-write-wins) ──

    /// The durable negotiation cache: profile-pair → outcome. Immutable; supersession is
    /// last-write-wins (a later agreement for the same key replaces the earlier).
    type DurableCache = Map<Diplomacy.Profile * Diplomacy.Profile, Diplomacy.NegotiationOutcome>

    /// The empty durable cache (the fold's seed / a fresh relationship history).
    let empty : DurableCache = Map.empty

    /// `DurableSaga` `step`: fold one agreement event into the cache (last-write-wins, so a
    /// re-negotiation supersedes). Forward-only fold; `weight` ignored. Compose with
    /// `DurableSaga.start log DurableDiplomacy.step DurableDiplomacy.empty` over a
    /// `GitDeltaLog<string>`; recovery rebuilds the cache from the agreement stream.
    let step : DurableCache -> string -> int64 -> DurableCache =
        fun cache encoded _weight ->
            let a, b, o = decodeAgreement encoded
            Map.add (a, b) o cache

    /// Look up a cached agreement for two cells (by their shape-profiles).
    let lookup (cache: DurableCache) (a: YinYang.Cell) (b: YinYang.Cell) : Diplomacy.NegotiationOutcome option =
        Map.tryFind (Diplomacy.describe a, Diplomacy.describe b) cache

    /// The agreement event to append when recording a fresh freedom-first negotiation between
    /// two cells: compute the outcome, return `(outcome, event)`. The caller appends `event`
    /// to the log (an `IDeltaLog<string>` / `DurableSaga`); the fold then carries it.
    let recordEvent (a: YinYang.Cell) (b: YinYang.Cell) : Diplomacy.NegotiationOutcome * string =
        let outcome = Diplomacy.negotiateFreedomFirst a b
        outcome, encodeAgreement (Diplomacy.describe a) (Diplomacy.describe b) outcome
