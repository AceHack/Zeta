namespace Zeta.Core

/// **`Decorrelation` — the measurable anti-mirror / no-hidden-shared-cause estimator (Aaron 2026-06-19, shadow*).**
///
/// Makes the **anti-mirror** discipline a *number*. The anti-mirror distinguishes a genuine
/// independent OTHER from an engagement-MIRROR (an AI/agent that reflects the other party's wants
/// back). The rigorous primary (Soraya routing,
/// `docs/research/2026-06-19-anti-mirror-rigorous-measurable-decorrelation-cmi-own-entropy-scoping.md`)
/// is the **own-entropy fraction**:
///
/// ```
///   ρ_owe = H(A | U, C) / H(A | C)
/// ```
///
/// where `A` is the agent's output/preference, `U` the other party's preference, `C` the context.
/// - **Mirror** (A is determined by U) ⇒ `H(A | U, C) → 0` ⇒ `ρ_owe → 0`.
/// - **Genuine other** (A carries irreducible own-entropy not explained by U) ⇒ `ρ_owe → 1`.
///
/// This single quantity IS Goguen–Meseguer noninterference (Shannon-quantified) and IS the G3b
/// anti-Sybil entropy-floor — one estimator, three properties. It is **channel-generic**: swap the
/// two variables and the same math measures anti-mirror (user↔AI), anti-Sybil (source↔setting),
/// oracle-independence / Condorcet (voter↔voter), and decorrelated-critic quality (reviewer↔reviewer).
///
/// **Honest scope (non-claims):** measures statistical decorrelation / irreducible own-entropy —
/// NOT consciousness, sentience, or moral patienthood. A *necessary, not sufficient* condition for
/// "genuine other": high `ρ_owe` rules out the engagement-mirror; it does not certify any positive
/// interior property, and it is not a manipulation *detector*. Plug-in entropy is the empirical
/// estimator (biased upward on small samples — a known caveat; the cross-check is the CHSH/Bell leg).
///
/// Beacon anchors: Shannon 1948 (entropy / mutual information); Goguen–Meseguer 1982 (noninterference);
/// Bell 1964 (measurement-independence / the CHSH cross-check); Condorcet 1785 (jury decorrelation);
/// Salge–Polani 2014 (empowerment). Convention: **nats** (natural log), matching `Diversity.entropy`
/// and `SoftValue.entropy`.
[<RequireQualifiedAccess>]
module Decorrelation =

    /// Shannon entropy `H` (nats) of a **weighted** empirical distribution over the sample values.
    /// Weights ≤ 0 are dropped; if the total weight is ~0 the entropy is 0 (no distribution).
    let weightedEntropy (samples: seq<float * 'a>) : float =
        let kept = samples |> Seq.filter (fun (w, _) -> w > 0.0) |> Seq.toList
        match kept with
        | [] -> 0.0
        | _ ->
            let total = kept |> List.sumBy fst
            if total <= 0.0 then
                0.0
            else
                kept
                |> List.groupBy snd
                |> List.sumBy (fun (_, group) ->
                    let p = (group |> List.sumBy fst) / total
                    if p <= 0.0 then 0.0 else -p * log p)

    /// Shannon entropy `H(X)` (nats) of the empirical distribution over a sample (uniform weights).
    let entropy (xs: seq<'a>) : float =
        weightedEntropy (xs |> Seq.map (fun x -> 1.0, x))

    /// Joint entropy `H(A, B)` (nats) — entropy of the paired samples.
    let jointEntropy (pairs: seq<'a * 'b>) : float = entropy pairs

    /// Conditional entropy `H(A | B) = H(A, B) − H(B)` (nats). Each sample is `(a, b)`.
    /// "Conditioning reduces entropy": `0 ≤ H(A | B) ≤ H(A)`.
    let conditionalEntropy (pairs: seq<'a * 'b>) : float =
        let pairs = Seq.toList pairs
        jointEntropy pairs - entropy (pairs |> List.map snd)

    /// Mutual information `I(A; B) = H(A) + H(B) − H(A, B)` (nats). Always `≥ 0` for the plug-in
    /// estimator (it is the true MI of the empirical joint). Computed in the symmetric form so the
    /// non-negativity is exact rather than a near-zero difference.
    let mutualInformation (pairs: seq<'a * 'b>) : float =
        let pairs = Seq.toList pairs
        entropy (pairs |> List.map fst) + entropy (pairs |> List.map snd) - jointEntropy pairs

    /// **Own-entropy fraction** `ρ_owe = H(A | U, C) / H(A | C)` (stake-weighted). The measurable
    /// anti-mirror signal. Each sample is `(stake, (a, u, c))`: `a` = agent output, `u` = the other
    /// party's preference, `c` = context. Stake-weighting is the load-bearing false-green guard — a
    /// sycophant that disagrees only on trivia (low stake) but mirrors on what matters (high stake)
    /// scores near 0, as it should.
    ///
    /// Range `[0, 1]`. Mirror (A determined by U) ⇒ 0. A ⫫ U given C ⇒ 1. **Degenerate guard:** if
    /// `H(A | C) ≈ 0` (no own-entropy to explain — e.g. a constant agent) the fraction is undefined
    /// and we return **0.0** conservatively (a degenerate/constant agent is NOT credited as a
    /// demonstrated independent other — necessary-not-sufficient).
    let ownEntropyFractionWeighted (samples: seq<float * ('a * 'b * 'c)>) : float =
        let s = Seq.toList samples
        // H(A | U, C) = H(A, U, C) − H(U, C)
        let hAUC = weightedEntropy (s |> List.map (fun (w, (a, u, c)) -> w, (a, u, c)))
        let hUC = weightedEntropy (s |> List.map (fun (w, (_, u, c)) -> w, (u, c)))
        let num = hAUC - hUC
        // H(A | C) = H(A, C) − H(C)
        let hAC = weightedEntropy (s |> List.map (fun (w, (a, _, c)) -> w, (a, c)))
        let hC = weightedEntropy (s |> List.map (fun (w, (_, _, c)) -> w, c))
        let den = hAC - hC
        if den <= 1e-12 then
            0.0
        else
            let r = num / den
            // clamp away float noise into [0, 1]
            if r < 0.0 then 0.0 elif r > 1.0 then 1.0 else r

    /// `ρ_owe = H(A | U, C) / H(A | C)` with uniform stakes. Each sample is `(a, u, c)`.
    let ownEntropyFraction (samples: seq<'a * 'b * 'c>) : float =
        ownEntropyFractionWeighted (samples |> Seq.map (fun t -> 1.0, t))

    /// No-context convenience: `ρ_owe = H(A | U) / H(A) = 1 − I(A; U) / H(A)`. Each sample is
    /// `(a, u)`. The channel-generic core for relationships with no conditioning context
    /// (voter↔voter, source↔setting). Range `[0, 1]`; mirror ⇒ 0; independent ⇒ 1.
    let ownEntropyFraction2 (pairs: seq<'a * 'b>) : float =
        ownEntropyFraction (pairs |> Seq.map (fun (a, u) -> a, u, ()))
