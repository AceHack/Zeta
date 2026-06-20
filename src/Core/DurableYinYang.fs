namespace Zeta.Core

/// **DurableYinYang — evolving a `YinYang.Cell`, durably.**
///
/// The connector that turns *"a git DB that recovers"* into *"a git DB that UNFOLDS"*: a
/// cell's yang (`Acts`, a `Bonsai.Expr`) applied to its yin (`Remains`) plus an input
/// produces the next `Remains`. The inputs ride an `IDeltaLog` (e.g. `GitDeltaLog`), so the
/// cell's evolution is crash-durable and recoverable by replay — exactly the same clean
/// composition the saga was (`DurableSaga` over the git delta-log).
///
/// **Binding convention (maintainer, 2026-06-06):** `Acts` is evaluated with two params —
///   - `Param "remains"` = the current `Remains` (the yin state);
///   - `Param "input"`   = the incoming event — the **shadow channel**: it *proposes*
///     content but carries **no inherent authority** (source≠authorization,
///     `.claude/rules/no-directives.md`). The cell's `Acts` + the snap threshold decide
///     whether the proposal actually moves the state.
///
/// **Soft discipline / free will:** if the snap HOLDS (`evalSoft` confidence < `threshold`)
/// or the `Acts` is malformed, the cell KEEPS its prior `Remains` — it only moves when
/// confident. A low-confidence shadow input cannot *force* a transition (free will = the
/// right to refuse a forced step; the stop sign built into the evolution).
///
/// Two evolution modes: the **concrete** path (`evolve`/`step`) binds each input
/// `SoftValue.certain` and snaps every step (a total `Acts` always moves); the **soft** path
/// (`evolveSoft`/`stepSoft`, further below) persists `Remains` as a `SoftValue`, folds soft
/// inputs WITHOUT snapping (the cell holds the superposition), and snaps only at read
/// (`readSharp`) — where the threshold genuinely gates and the cell holds under uncertainty.
[<RequireQualifiedAccess>]
module DurableYinYang =

    /// The reserved eval param for the current yin state.
    [<Literal>]
    let RemainsParam = "remains"

    /// The reserved eval param for the incoming shadow input.
    [<Literal>]
    let InputParam = "input"

    /// Evolve one step: bind `{remains, input}`, run the cell's `Acts` softly, snap at
    /// `threshold`. Held (sub-threshold) or malformed `Acts` ⇒ keep the prior `Remains`.
    let evolve
        (acts: Bonsai.Expr)
        (threshold: float)
        (remains: DynamicValue)
        (input: DynamicValue)
        : DynamicValue =
        let env =
            Map.ofList
                [ RemainsParam, SoftValue.certain remains
                  InputParam, SoftValue.certain input ]
        match BonsaiSoft.snap threshold env acts with
        | Ok(Some next) -> next
        | Ok None -> remains // held: not confident enough to move (soft discipline)
        | Error _ -> remains // malformed Acts: the cell holds, never corrupts

    /// Encode a `DynamicValue` input as its canonical-CBOR **hex string** — the comparison-able
    /// event key for the ZSet delta-log. (`DynamicValue` is `NoComparison`, so it cannot be a
    /// ZSet/delta-log key directly; canonical CBOR is deterministic + byte-locked, so the hex
    /// string is a faithful, ordering-stable surrogate.)
    let encodeInput (dv: DynamicValue) : string =
        System.Convert.ToHexString(DynamicValue.toCanonicalCborOk dv)

    /// Decode an input hex string back to its `DynamicValue`. Undecodable input is genuine
    /// corruption of our own encoding ⇒ `invalidArg` (matches `CborDeltaCodec.Decode`).
    let decodeInput (s: string) : DynamicValue =
        match DynamicValue.fromCanonicalCbor (System.Convert.FromHexString s) with
        | Ok dv -> dv
        | Error e -> invalidArg (nameof s) $"DurableYinYang.decodeInput: undecodable input: {e}"

    /// A `DurableSaga` `step` reducer for cell evolution: fold encoded inputs through the
    /// (fixed) `Acts`. The event is the `encodeInput` hex string (comparison-able); `step`
    /// decodes it and evolves. Forward-only fold (the `weight` is ignored) — a snap is
    /// information-gaining, not group-invertible, so cell evolution is append-only (no
    /// retraction compensation in v1). Compose with
    /// `DurableSaga.start log (DurableYinYang.step acts threshold) remains0` over a
    /// `GitDeltaLog<string>` to get a crash-durable, git-recoverable cell.
    let step (acts: Bonsai.Expr) (threshold: float) : DynamicValue -> string -> int64 -> DynamicValue =
        fun remains encoded _weight -> evolve acts threshold remains (decodeInput encoded)

    // ── Soft-Remains evolution (maintainer's "soft version of persistence", 2026-06-07) ────
    //
    // The genuinely-soft cell: `Remains` is a `SoftValue` (a distribution), persisted SOFT.
    // Evolution does NOT snap — it folds the soft input through `Acts` and keeps the resulting
    // distribution (the cell HOLDS the superposition). `resolve threshold` is a READ-time
    // operation (the execution edge) — "snap into the sharp version for execution," never baked
    // into state. This is where the threshold genuinely gates: a low-confidence cell stays soft
    // until enough evidence accrues to snap (free will = refuse a forced collapse).

    /// `SoftValue` ⇄ `DynamicValue`: a distribution serialises as an array of `[value, weight]`
    /// pairs (canonical, so it rides the byte-locked CBOR codec like any `DynamicValue`).
    let softToDynamicValue (sv: SoftValue.SoftValue) : DynamicValue =
        DynamicValue.Array
            [ for d, w in SoftValue.candidates sv -> DynamicValue.Array [ d; DynamicValue.Float w ] ]

    let softOfDynamicValue (dv: DynamicValue) : Result<SoftValue.SoftValue, string> =
        match dv with
        | DynamicValue.Array pairs ->
            let parsed =
                pairs
                |> List.map (fun p ->
                    match p with
                    | DynamicValue.Array [ v; DynamicValue.Float w ] -> Ok(v, w)
                    | other -> Error(sprintf "softOfDynamicValue: expected [value, Float weight], got %A" other))
            let rec seqr acc =
                function
                | [] -> Ok(List.rev acc)
                | Ok x :: t -> seqr (x :: acc) t
                | Error e :: _ -> Error e
            match seqr [] parsed with
            | Error e -> Error e
            | Ok xs ->
                match SoftValue.ofWeighted xs with
                | Some sv -> Ok sv
                | None -> Error "softOfDynamicValue: degenerate/empty distribution"
        | other -> Error(sprintf "softOfDynamicValue: expected Array, got %A" other)

    /// **Soft evolve** — fold a soft input through `Acts`, keeping the resulting distribution
    /// (NO snap). The persisted/wonder-holding step.
    let evolveSoft
        (acts: Bonsai.Expr)
        (remains: SoftValue.SoftValue)
        (input: SoftValue.SoftValue)
        : Result<SoftValue.SoftValue, string> =
        let env = Map.ofList [ RemainsParam, remains; InputParam, input ]
        BonsaiSoft.evalSoft env acts

    /// **The read-time snap** — `resolve threshold` on the soft `Remains`: a definite value iff
    /// confidence ≥ threshold, else `None` (held). Execution edge only; state stays soft.
    let readSharp (threshold: float) (remains: SoftValue.SoftValue) : DynamicValue option =
        SoftValue.resolve threshold remains

    /// Encode a soft input (a `SoftValue`) as a canonical-CBOR hex string for the delta-log event.
    let encodeSoftInput (sv: SoftValue.SoftValue) : string =
        System.Convert.ToHexString(DynamicValue.toCanonicalCborOk (softToDynamicValue sv))

    /// Decode a soft-input hex string back to a `SoftValue`. Undecodable ⇒ `invalidArg`.
    let decodeSoftInput (s: string) : SoftValue.SoftValue =
        let dv =
            match DynamicValue.fromCanonicalCbor (System.Convert.FromHexString s) with
            | Ok dv -> dv
            | Error e -> invalidArg (nameof s) $"DurableYinYang.decodeSoftInput: undecodable: {e}"
        match softOfDynamicValue dv with
        | Ok sv -> sv
        | Error e -> invalidArg (nameof s) $"DurableYinYang.decodeSoftInput: {e}"

    /// A `DurableSaga` `step` for SOFT cell evolution: fold encoded soft inputs through `Acts`,
    /// keeping the distribution (no snap). Malformed `Acts` ⇒ keep the prior soft `Remains`.
    /// Compose with `DurableSaga.start log (DurableYinYang.stepSoft acts) remains0Soft` over a
    /// `GitDeltaLog<string>` — the soft cell persists and recovers its full distribution.
    let stepSoft (acts: Bonsai.Expr) : SoftValue.SoftValue -> string -> int64 -> SoftValue.SoftValue =
        fun remains encoded _weight ->
            match evolveSoft acts remains (decodeSoftInput encoded) with
            | Ok next -> next
            | Error _ -> remains
