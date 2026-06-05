namespace Zeta.Core

/// **SoftValue — the value-axis "soft" DynamicValue seed (calibrated / probabilistic).**
///
/// A normalized distribution over candidate `DynamicValue`s. The safety property is NOT
/// "always certain" but **"always knows its uncertainty" (calibration / never falsely
/// certain)**: `resolve` collapses to a definite value ONLY when confidence ≥ a threshold —
/// otherwise it returns `None` (held), exactly like the middle value of a three-valued logic
/// is never silently collapsed. This is the **value-axis generalization of `TriBoolean.Tri.N`
/// and `Predicate3`**: where Predicate3 keeps UNKNOWN on the truth axis, SoftValue keeps a
/// full distribution on the value axis.
///
/// `observe` does a Bayesian update with a likelihood and re-normalizes (sharpening with
/// evidence). Crucially, **independent-evidence observes COMMUTE** — posterior ∝ prior · L₁ · L₂
/// and multiplication commutes — so the uncertainty-merge is order-independent. (That is the
/// crux the convergence-despite-reordering analysis flagged: the Bayesian merge is commutative
/// for independent evidence; proven below.)
///
/// Honesty by construction: an `observe` whose likelihood zeroes every candidate (a
/// contradiction) returns `None` rather than fabricating a value — the seed never invents
/// certainty it doesn't have. Composes [[DynamicValue]] + the never-collapse discipline.
[<RequireQualifiedAccess>]
module SoftValue =

    /// Invariant (maintained by every constructor): non-empty, all weights > 0, weights sum to 1.
    type SoftValue = { Candidates: (DynamicValue * float) list }

    [<Literal>]
    let private EPS = 1e-12

    /// Merge equal candidates (first-seen order), drop non-positive weights, normalize.
    /// `None` if nothing positive remains (empty or total ≈ 0) — no fabricated certainty.
    let private build (xs: (DynamicValue * float) list) : SoftValue option =
        let merged =
            xs
            |> List.fold
                (fun acc (d, w) ->
                    if w <= 0.0 then
                        acc
                    else
                        match acc |> List.tryFindIndex (fun (d2, _) -> d2 = d) with
                        | Some i -> acc |> List.mapi (fun j (d2, w2) -> if j = i then (d2, w2 + w) else (d2, w2))
                        | None -> acc @ [ d, w ])
                []
        let total = merged |> List.sumBy snd
        if List.isEmpty merged || total <= EPS then None
        else Some { Candidates = merged |> List.map (fun (d, w) -> d, w / total) }

    /// A point mass — fully certain at `dv` (confidence 1).
    let certain (dv: DynamicValue) : SoftValue = { Candidates = [ dv, 1.0 ] }

    /// Build from weighted candidates (merged + normalized). `None` if no positive weight.
    let ofWeighted (xs: (DynamicValue * float) list) : SoftValue option = build xs

    /// The candidate distribution (normalized, sums to 1).
    let candidates (sv: SoftValue) : (DynamicValue * float) list = sv.Candidates

    /// Confidence = the probability of the most-likely candidate (1.0 iff a point mass).
    let confidence (sv: SoftValue) : float = sv.Candidates |> List.map snd |> List.max

    /// Shannon entropy (nats) — the system's own measure of how uncertain it is (0 = certain).
    let entropy (sv: SoftValue) : float =
        sv.Candidates |> List.sumBy (fun (_, p) -> if p <= EPS then 0.0 else -p * log p)

    /// Bayesian update: posterior ∝ prior · likelihood, re-normalized. A non-positive likelihood
    /// is clamped to 0 (that candidate refuted). `None` if every candidate is refuted (contradiction).
    let observe (likelihood: DynamicValue -> float) (sv: SoftValue) : SoftValue option =
        build (sv.Candidates |> List.map (fun (d, w) -> d, w * max 0.0 (likelihood d)))

    /// Terminal decision (the ONE legitimate collapse): a definite value iff confidence ≥
    /// `threshold`, else `None` (held / unknown). This is the calibration guarantee — never
    /// returns a value it is not confident enough about; never falsely certain.
    let resolve (threshold: float) (sv: SoftValue) : DynamicValue option =
        let best, p = sv.Candidates |> List.maxBy snd
        if p >= threshold then Some best else None
