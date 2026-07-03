namespace Zeta.Core

/// **PcfgEm — unsupervised PCFG weight learning by Expectation–Maximization.**
/// (Aaron 2026-07-02, shadow*: the "where do the production weights come from" answer.)
///
/// The grammar learns its OWN production weights from a corpus — no hand-tuning. This is the
/// classic inside–outside EM (Baker 1979; Lari–Young 1990; Dempster–Laird–Rubin 1977):
///   • **E-step** — for each input, `Sppf.expectedCounts` gives the expected use of each production
///     across all its parses (posteriors from inside–outside). Sum over the corpus.
///   • **M-step** — re-estimate each production's weight = its expected count normalized over the
///     productions sharing its LHS (so each nonterminal's productions form a distribution).
/// Iterate; corpus likelihood increases monotonically to a local maximum (the EM guarantee).
///
/// In Aaron's SSAS frame this is training the decision-forest model — the weights become the
/// learned `NodeDistribution`s / `PredictProbability` potentials, fit to data rather than set.
/// Self-contained (inside–outside only); the loopy/EP + emotional-propagation rung stays on
/// `Zeta.Bayesian` (math-team). Anchors: Baker; Lari–Young; DLR (EM); ZetaParse (Amara).
[<RequireQualifiedAccess>]
module PcfgEm =

    /// Weights indexed by production; the value at `[p]` is production `p`'s potential.
    let private weightFn (w: float[]) : int -> float =
        fun p -> if p >= 0 && p < w.Length then w.[p] else 1.0

    /// Corpus log-likelihood under weights `w` (Σ over inputs of `log(insideTotal)`; an input with
    /// no parse contributes `-∞`, reported as `System.Double.NegativeInfinity`).
    let corpusLogLikelihood (g: GrammarIr.Grammar) (corpus: string list list) (w: float[]) : float =
        corpus
        |> List.sumBy (fun input ->
            let z = Sppf.insideTotal (weightFn w) (Sppf.build g input)
            if z > 0.0 then log z else System.Double.NegativeInfinity)

    /// One EM iteration: E-step (summed expected counts) + M-step (normalize per LHS). Returns the
    /// updated weights.
    let step (g: GrammarIr.Grammar) (forests: Sppf.Forest list) (w: float[]) : float[] =
        let n = w.Length
        let prodLhs = g.Productions |> List.map (fun p -> p.Lhs) |> Array.ofList
        // E-step: expected counts summed across the corpus
        let counts = Array.zeroCreate n
        let wf = weightFn w
        for f in forests do
            Sppf.expectedCounts wf f |> Map.iter (fun p c -> if p >= 0 && p < n then counts.[p] <- counts.[p] + c)
        // M-step: normalize per LHS (productions with the same LHS form a distribution)
        let lhsTotal = System.Collections.Generic.Dictionary<string, float>(System.StringComparer.Ordinal)
        for p in 0 .. n - 1 do
            let cur =
                match lhsTotal.TryGetValue prodLhs.[p] with
                | true, v -> v
                | _ -> 0.0
            lhsTotal.[prodLhs.[p]] <- cur + counts.[p]
        Array.init n (fun p ->
            let tot = lhsTotal.[prodLhs.[p]]
            if tot > 0.0 then counts.[p] / tot else w.[p]) // no evidence ⇒ keep prior

    /// Learn production weights from `corpus` by `iterations` EM steps, starting from uniform.
    /// Returns the learned weight array (per-LHS normalized) and a `weight: int -> float` function
    /// ready for `Sppf.inside` / `ParseSoft.ofSppf`.
    let learn (g: GrammarIr.Grammar) (corpus: string list list) (iterations: int) : float[] =
        let n = List.length g.Productions
        let forests = corpus |> List.map (Sppf.build g)
        let mutable w = Array.create n 1.0
        for _ in 1..iterations do
            w <- step g forests w
        w

    /// The learned weights as a `weight: int -> float` function.
    let weightFunction (w: float[]) : int -> float = weightFn w
