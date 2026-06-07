namespace Zeta.Core

/// **Information-theoretic floor for `SoftValue` distributions — cross-entropy and KL divergence (Aaron
/// 2026-06-07).** Complements `SoftValue.entropy` (H(p)); same convention — **nats** (natural log), with the
/// `EPS` guard for zero-probability terms. A `SoftValue` is a normalized distribution over `DynamicValue`
/// candidates, so these are the standard discrete-distribution measures over the candidate support.
///
/// Additive module (no edit to `SoftValue.fs`). Anchors: Shannon entropy; Kullback–Leibler divergence;
/// cross-entropy (the ML training objective) — the same information geometry the soft/Bayesian layer needs.
[<RequireQualifiedAccess>]
module SoftValueInfo =

    [<Literal>]
    let private EPS = 1e-12

    /// `q` as a probability lookup keyed by candidate value (absent ⇒ 0). `DynamicValue` carries content
    /// equality + hash, so it is a valid dictionary key.
    let private probOf (q: SoftValue.SoftValue) : DynamicValue -> float =
        let m = System.Collections.Generic.Dictionary<DynamicValue, float>()
        for v, p in SoftValue.candidates q do
            m[v] <- p

        fun x ->
            match m.TryGetValue x with
            | true, p -> p
            | _ -> 0.0

    /// **Cross-entropy** `H(p, q) = −Σ p(x)·ln q(x)` (nats). Returns `+∞` if `q` assigns ~zero probability to
    /// an outcome `p` supports (the standard divergent case). `H(p, p) = H(p)` (the entropy).
    let crossEntropy (p: SoftValue.SoftValue) (q: SoftValue.SoftValue) : float =
        let qp = probOf q

        SoftValue.candidates p
        |> List.sumBy (fun (x, px) ->
            if px <= EPS then
                0.0
            else
                let qx = qp x
                if qx <= EPS then infinity else -px * log qx)

    /// **KL divergence** `D(p ‖ q) = Σ p(x)·ln(p(x)/q(x)) = H(p, q) − H(p)` (nats). Always `≥ 0` (Gibbs); `0`
    /// iff `p = q`; `+∞` if `support(p) ⊄ support(q)`. Not symmetric.
    let klDivergence (p: SoftValue.SoftValue) (q: SoftValue.SoftValue) : float =
        crossEntropy p q - SoftValue.entropy p
