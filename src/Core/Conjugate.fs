namespace Zeta.Core

/// **The conjugate structure as a value — two `SoftValue` frames woven, with the irreducible error read off.**
///
/// Aaron #7080: *"save the conjugate structure on top of a single SoftValue, stick two in a DynamicValue and
/// weave, then create an algebra on top to make the numerics interface."* This realizes #7079 as a value:
///
/// - A **`Conjugate`** = the two-frame Bayesian-inverse pair (#7079): two `SoftValue`s (each a weighted
///   distribution over `DynamicValue` candidates — a frame's belief-with-uncertainty). `FrameA` and `FrameB`
///   are conjugate observers.
/// - **`weave`** = the symmetric **Bayesian fold** (#7065): the Bayesian *product* of the two frames (each is
///   the other's evidence — `SoftValue.observe`), renormalized → the converged belief. `None` if the frames
///   share no candidate (total divergence).
/// - **`residualEntropy`** = the entropy left in the weave = **the irreducible error** (#7075): the uncertainty
///   that survives convergence (conjugate to the heat that would resolve it, #7078/#7079).
/// - **The algebra (#7080).** Over `SoftValue`: `mix` (⊕, mixture — a *commutative monoid*) and `product` (⊗,
///   Bayesian conjunction — a *monoid*). **Honest finding:** probabilities have **no additive inverse**, so
///   this is a **semiring-WITHOUT-negate (a rig / the probability/expectation semiring)** — it does **not**
///   satisfy the repo's `IRing<_>` (which requires `Negate`); post-081KWG9JQ9H they COULD fit `ISemiring` (now a true rig interface) if their ops were total. They fit a *rig*,
///   not a ring; forcing an `ISemiring` instance would be unlawful. The numeric interface it honestly fits is
///   the commutative-monoid-⊕ + monoid-⊗ rig below. F# reference oracle.
module Conjugate =

    /// The two-frame conjugate pair (Bayesian-inverse observers, #7079).
    type Conjugate = { FrameA: SoftValue.SoftValue; FrameB: SoftValue.SoftValue }

    let ofFrames (a: SoftValue.SoftValue) (b: SoftValue.SoftValue) : Conjugate = { FrameA = a; FrameB = b }

    /// B's weight for a candidate `d` (0 if absent). `DynamicValue` is `NoComparison`, so look up by
    /// structural equality over the candidate list (not a `Map` key).
    let private weightIn (sv: SoftValue.SoftValue) (d: DynamicValue) : float =
        sv.Candidates
        |> List.tryPick (fun (k, w) -> if k = d then Some w else None)
        |> Option.defaultValue 0.0

    /// **Weave** — the symmetric Bayesian fold of the two frames (their Bayesian product, renormalized).
    /// `None` when the frames share no candidate (total divergence — maximal irreducible error).
    let weave (c: Conjugate) : SoftValue.SoftValue option =
        SoftValue.observe (weightIn c.FrameB) c.FrameA

    /// The **irreducible error** (#7075) = entropy remaining in the weave (residual uncertainty after
    /// convergence). `None` = total divergence (no shared candidate; unbounded irreducible error).
    let residualEntropy (c: Conjugate) : float option =
        weave c |> Option.map SoftValue.entropy

    /// The two frames have **converged** to certainty: the weave exists and has a single candidate (zero
    /// residual entropy) — agreement with no irreducible error.
    let converged (c: Conjugate) : bool =
        match weave c with
        | Some w -> List.length w.Candidates = 1
        | None -> false

    // ── The algebra (#7080): a rig over SoftValue (⊕ mixture monoid + ⊗ Bayesian-product monoid). ──
    // NOTE: no additive inverse (probabilities) ⇒ semiring-without-negate; NOT the repo's ISemiring.

    /// `⊕` (additive): **mixture** of two soft values — union of candidates, renormalized. Commutative +
    /// associative (a commutative monoid). `None` if both are empty.
    let mix (a: SoftValue.SoftValue) (b: SoftValue.SoftValue) : SoftValue.SoftValue option =
        SoftValue.ofWeighted (a.Candidates @ b.Candidates)

    /// `⊗` (multiplicative): **Bayesian product** (conjunction) of two soft values — weight a candidate by the
    /// other's weight for it, renormalized. A monoid. `None` if they share no candidate.
    let product (a: SoftValue.SoftValue) (b: SoftValue.SoftValue) : SoftValue.SoftValue option =
        SoftValue.observe (weightIn b) a

    /// `weave` expressed via the algebra: weaving the conjugate IS the `⊗` product of its two frames.
    let weaveViaProduct (c: Conjugate) : SoftValue.SoftValue option = product c.FrameA c.FrameB

    // ── DynamicValue packing (#7080: "stick two in a DynamicValue") ──

    /// Encode a `SoftValue` as a `DynamicValue.Array` of `{value; weight}` objects (homoiconic, #7041).
    let private softToDv (sv: SoftValue.SoftValue) : DynamicValue =
        sv.Candidates
        |> List.map (fun (d, w) -> DynamicValue.Object [ "value", d; "weight", DynamicValue.Float w ])
        |> DynamicValue.Array

    let private dvToSoft (dv: DynamicValue) : SoftValue.SoftValue option =
        match dv with
        | DynamicValue.Array items ->
            let pairs =
                items
                |> List.choose (fun it ->
                    match it with
                    | DynamicValue.Object fields ->
                        let get k = fields |> List.tryPick (fun (fk, fv) -> if fk = k then Some fv else None)
                        match get "value", get "weight" with
                        | Some v, Some(DynamicValue.Float w) -> Some(v, w)
                        | _ -> None
                    | _ -> None)
            SoftValue.ofWeighted pairs
        | _ -> None

    /// Pack the two frames into one `DynamicValue.Object {a; b}` (the conjugate as data, #7080).
    let toDynamicValue (c: Conjugate) : DynamicValue =
        DynamicValue.Object [ "a", softToDv c.FrameA; "b", softToDv c.FrameB ]

    /// Unpack a conjugate from its `DynamicValue` form (inverse of `toDynamicValue`). `None` if malformed.
    let ofDynamicValue (dv: DynamicValue) : Conjugate option =
        match dv with
        | DynamicValue.Object fields ->
            let get k = fields |> List.tryPick (fun (fk, fv) -> if fk = k then Some fv else None)
            match get "a", get "b" with
            | Some a, Some b ->
                match dvToSoft a, dvToSoft b with
                | Some sa, Some sb -> Some(ofFrames sa sb)
                | _ -> None
            | _ -> None
        | _ -> None
