namespace Zeta.Core

open System.Collections.Generic

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
        let positions = Dictionary<DynamicValue, int>()
        let merged = ResizeArray<DynamicValue * float>()
        let mutable total = 0.0

        for d, w in xs do
            if w > 0.0 then
                total <- total + w
                match positions.TryGetValue d with
                | true, i ->
                    let existing, existingWeight = merged.[i]
                    merged.[i] <- existing, existingWeight + w
                | false, _ ->
                    positions.Add(d, merged.Count)
                    merged.Add(d, w)

        if merged.Count = 0 || total <= EPS then None
        else
            Some
                { Candidates =
                    [ for d, w in merged do
                          d, w / total ] }

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

    /// The weight `sv` assigns to candidate `d` (0 if `d` is absent from the support).
    let weightOf (d: DynamicValue) (sv: SoftValue) : float =
        sv.Candidates
        |> List.tryPick (fun (c, w) -> if c = d then Some w else None)
        |> Option.defaultValue 0.0

    /// **combine — independent-evidence product of two soft values.** The commutative + associative
    /// monoid that lets a soft fold **banana-split and fuse in uncertainty space** without ever
    /// collapsing to a definite value: `combine a b ∝ aᵢ · bᵢ`, renormalized. `None` if their supports
    /// are disjoint (a contradiction — no fabricated certainty, the same discipline as `observe`).
    ///
    /// It is literally `observe` with the other value as the likelihood, so it inherits `observe`'s
    /// normalization and honesty. Because real multiplication commutes and associates, `combine` is a
    /// commutative associative (partial) monoid — therefore folding a node's children with `combine`
    /// is **order-independent** (the soft / NCI analogue of the eager `cata`-fusion law). The carrier
    /// for a `DynamicValueFold.DvAlgebra<SoftValue>` is exactly this: soft cata/bananaSplit/fusion are
    /// the generic schemes at `'r = SoftValue`, and `combine` is the order-free child-combiner.
    let combine (a: SoftValue) (b: SoftValue) : SoftValue option =
        observe (fun d -> weightOf d b) a

    // ── Snap: the policy-gated soft → hard boundary ──
    // The soft model runs entirely in uncertainty space (combine/observe, never collapsing); a *policy*
    // is the one place it is allowed to leave that space and snap to a hard `DynamicValue` that
    // represents the exact (math-provable) value. Bayesian is how we approximate; snap is how we commit.

    /// A **snap policy**: the soft → hard decision. Collapse a soft value to a definite `DynamicValue`,
    /// or hold (`None`) if the policy judges the collapse unwarranted. This is the *only* sanctioned exit
    /// from uncertainty space — everything upstream of it stays soft.
    type SnapPolicy = SoftValue -> DynamicValue option

    /// Snap a soft value to a hard one under a policy. `snap (threshold t)` is calibration-gated (never
    /// falsely certain); `snap best` always takes the argmax. `snap _ (certain dv) = Some dv` — with no
    /// genuine uncertainty the soft layer reproduces exactly the hard value the math team proves.
    let snap (policy: SnapPolicy) (sv: SoftValue) : DynamicValue option = policy sv

    /// Policy: collapse iff confidence ≥ `t` (this is `resolve`, named as a policy).
    let threshold (t: float) : SnapPolicy = resolve t

    /// Policy: always collapse to the most-likely candidate (argmax); never holds.
    let best: SnapPolicy =
        fun sv -> sv.Candidates |> List.maxBy snd |> fst |> Some
