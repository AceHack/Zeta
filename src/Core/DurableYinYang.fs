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
/// v1 evolves over concrete `DynamicValue` (each binding is `SoftValue.certain`), so a total
/// `Acts` snaps every step. Soft-input evolution — where the threshold genuinely gates and
/// the cell holds under uncertainty — is the documented next step (bind soft inputs directly).
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
        System.Convert.ToHexString(DynamicValue.toCanonicalCbor dv)

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
