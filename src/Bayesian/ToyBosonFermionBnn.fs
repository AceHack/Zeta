namespace Zeta.Bayesian

open System

/// **A toy Bayesian classifier for the Cl(4) boson/fermion grading, and the controls that
/// decide whether it is worth anything.**
///
/// TOY MODEL, register `toy` (`.claude/rules/toy-is-free-metered-must-be-earned.md`). It sheds
/// the prefix only if it beats the closed form at something the closed form cannot do at all.
/// Raw accuracy on clean data can never be that, because **the label is
/// `popcount(mask) &&& 1`** — a total one-line function of the input. A classifier that
/// reproduces it scores 100% and demonstrates nothing. So:
///
///   * every model number in this module is reported as a **delta against
///     `closedFormBaseline`**, never on its own;
///   * a **label-shuffle null** (`shuffleLabels`) runs the identical pipeline on permuted
///     labels — if it still learns, the pipeline leaks and every other number here is void;
///   * **calibration is reported, not just accuracy** (`expectedCalibrationError`,
///     `brierScore`), because a Bayesian net whose posterior is not calibrated is a point
///     estimate wearing error bars.
///
/// ## Why there is a non-trivial question at all
///
/// On clean structures there is none. The question lives under the metered channel of
/// `ToyBosonFermionGenerator`: the blade is transmitted as an [8,4,4] codeword and corrupted,
/// and the label must be recovered from the damaged word. Three closed forms bracket it —
/// naive (`baselineNaive`), hard-decision ECC (`baselineEccDecode`), and the **exact Bayes
/// posterior** (`baselineExactBayes`), which is computable in 16 terms and is therefore the
/// ceiling, not a competitor to be beaten.
///
/// ## The measured read-out spectrum (this is the actual result)
///
/// `witnessSpectrum` searches all 256 linear functionals `χ_u(y) = ⟨u, y⟩ mod 2` and reports
/// which ones equal the label on all 16 clean codewords, with their Hamming weights. The
/// minimum such weight is the **minimum number of received bits that must be read to recover
/// the grading**, and the number of witnesses at each weight is the redundancy the code gives
/// the label. Both are computed here, not cited.
///
/// This matters because it is the honest version of a claim I nearly made from a count: the
/// code's minimum distance is 4 and it is tempting to expect the read-out degree to be 4 too.
/// `witnessSpectrum` decides it. Under `numerology-vs-number-theory`, a matching integer is a
/// coincidence to record, never an identification.
///
/// ## The model
///
/// Bayesian probit regression with a **diagonal Gaussian posterior over the weights**, updated
/// by one pass of assumed-density filtering through this repo's own EP substrate —
/// `Ep.probitProject` does the moment matching, and the weight update is recovered from the
/// projected moments rather than re-derived. This is the Bayes Point Machine update (Minka
/// 2001; Herbrich, Graepel, Campbell 2001) in the diagonal form of Graepel, Candela, Borchert
/// and Herbrich 2010 (*Web-scale Bayesian click-through rate prediction*, ICML) — the same
/// family as the repo's existing TrueSkill lineage in `TravelerRankLedger`.
///
/// **`MinimalBnn` and `MultilayerBnn` cannot express this**, and that is a finding rather than
/// an oversight: both are chains of scalar Gaussian latents with a Gaussian likelihood at
/// layer 0 — there are no weights, no feature map and no Bernoulli output. `MinimalBnn`'s own
/// header says "not gradient-trained weights". This module is the smallest thing on the
/// existing substrate that IS a Bayesian classifier: it adds a weight vector and reuses
/// `Ep.probitProject` unchanged.
///
/// Features are a generic degree-≤2 expansion of the received bits (bias, 8 signed bits, 28
/// pairwise products). Degree 2 is chosen because it is the smallest generic expansion that
/// can represent a two-bit XOR; it is *not* the label handed over — the model still has to
/// find which pair, out of 28, among 37 weights.
[<RequireQualifiedAccess>]
module ToyBosonFermionBnn =

    module Gen = ToyBosonFermionGenerator

    // ── Closed-form baselines ───────────────────────────────────────────────────────────────

    /// **The closed-form baseline on the CLEAN structure.** `popcount(mask) &&& 1`. Total,
    /// exact, one line. Its accuracy is 1.0 and any model result must be stated as a delta
    /// against it.
    let closedFormBaseline (blade: int) : bool = Gen.isBosonic blade

    /// Naive baseline on a possibly-corrupted word: read the parity of the four systematic
    /// bits. Exact on clean codewords (the encoding is systematic) and confidently wrong under
    /// damage — it carries no uncertainty at all.
    let baselineNaive (observed: int) : bool = Gen.popcount (observed &&& 0xF) % 2 = 0

    /// Minimum-weight coset leader for each of the 16 syndromes. Computed by exhaustive search
    /// over GF(2)⁸, so the table is derived from the code rather than transcribed.
    let cosetLeaders : int[] =
        let leaders = Array.create 16 -1

        for w in 0 .. 255 do
            let s = Gen.syndrome w
            if leaders.[s] < 0 || Gen.popcount w < Gen.popcount leaders.[s] then leaders.[s] <- w

        leaders

    /// Hard-decision ECC baseline: syndrome-decode with the [8,4,4] code (correcting one
    /// error), then read the parity of the recovered message. This is the code's correction
    /// capacity made operational — `t = ⌊(d−1)/2⌋ = 1`, with `d` computed by
    /// `Gen.minimumDistance`.
    let baselineEccDecode (observed: int) : bool =
        let corrected = observed ^^^ cosetLeaders.[Gen.syndrome observed]
        Gen.isBosonic (corrected &&& 0xF)

    /// Effective per-bit flip probability after `k` uniform flip **operations** on 8 bits: a
    /// given bit is flipped iff an odd number of operations hit it, so
    /// `q = (1 − (1 − 2/8)^k) / 2`. Derived, not fitted — and it is exactly the quantity the
    /// naive "k flips ⇒ k bits damaged" reading gets wrong.
    let effectiveFlipProbability (flips: int) : float =
        (1.0 - Math.Pow(0.75, float flips)) / 2.0

    /// **The ceiling.** Exact Bayes posterior `P(bosonic | observed)` under a uniform prior
    /// over the 16 blades and a binary symmetric channel at `q`. Sixteen terms, closed form,
    /// calibrated by construction. The toy BNN cannot beat this; the only interesting question
    /// is how close it gets without being told `q` or the code.
    let baselineExactBayes (flips: int) (observed: int) : float =
        let q = effectiveFlipProbability flips
        let q = min (max q 1e-12) (1.0 - 1e-12)

        let logWeight (blade: int) =
            let d = Gen.popcount (Gen.encode blade ^^^ observed)
            float d * log q + float (8 - d) * log (1.0 - q)

        let logs = [ 0 .. 15 ] |> List.map (fun b -> b, logWeight b)
        let peak = logs |> List.map snd |> List.max
        let total = logs |> List.sumBy (fun (_, l) -> exp (l - peak))

        let bosonic =
            logs
            |> List.sumBy (fun (b, l) -> if Gen.isBosonic b then exp (l - peak) else 0.0)

        bosonic / total

    // ── The measured read-out spectrum ──────────────────────────────────────────────────────

    /// For every linear functional `χ_u` on GF(2)⁸, does `⟨u, y⟩ mod 2` equal the grading on
    /// all 16 clean codewords? Returns `(weight, count)` pairs for the witnesses, sorted by
    /// weight. The minimum weight is the fewest received bits any XOR read-out needs; the
    /// counts are the redundancy the code gives the label.
    let witnessSpectrum () : (int * int) list =
        [ 0 .. 255 ]
        |> List.filter (fun u ->
            [ 0 .. 15 ]
            |> List.forall (fun blade ->
                let bit = Gen.popcount (Gen.encode blade &&& u) % 2
                (bit = 0) = Gen.isBosonic blade))
        |> List.countBy Gen.popcount
        |> List.sortBy fst

    /// The minimum witness weight, or `None` if no linear read-out exists. Reported because a
    /// value of 1 would mean a single received bit carries the grading, and a value above 2
    /// would mean no degree-2 model can express it — either would change what the toy BNN's
    /// feature map is allowed to claim.
    let minimumWitnessWeight () : int option =
        witnessSpectrum () |> List.map fst |> function
        | [] -> None
        | ws -> Some(List.min ws)

    // ── Features ────────────────────────────────────────────────────────────────────────────

    /// Number of features in the degree-≤2 expansion: 1 bias + 8 signed bits + 28 pairs.
    let featureCount = 37

    /// Generic degree-≤2 expansion of an 8-bit received word into ±1 features. Nothing
    /// label-specific is fed in: the model sees a bias, the eight bits, and every pairwise
    /// product, and must locate the relevant structure itself.
    let features (observed: int) : float[] =
        let bit i = if (observed >>> i) &&& 1 = 1 then -1.0 else 1.0
        let raw = Array.init 8 bit
        let out = Array.zeroCreate featureCount
        out.[0] <- 1.0
        Array.blit raw 0 out 1 8
        let mutable k = 9

        for i in 0 .. 7 do
            for j in i + 1 .. 7 do
                out.[k] <- raw.[i] * raw.[j]
                k <- k + 1

        out

    // ── The toy BNN ─────────────────────────────────────────────────────────────────────────

    /// Diagonal Gaussian posterior over the weight vector.
    type Posterior =
        { /// Posterior means, one per feature.
          Mean: float[]
          /// Posterior variances, one per feature. These are the product — the label is not.
          Variance: float[] }

    /// A standard-normal prior over every weight.
    let priorPosterior () : Posterior =
        { Mean = Array.zeroCreate featureCount
          Variance = Array.create featureCount 1.0 }

    let private minVariance = 1e-8

    /// Absorb one labelled example by assumed-density filtering. The moment matching is
    /// `Ep.probitProject` — the repo's existing EP site, unmodified — and the weight update is
    /// read back out of the projected moments:
    /// `α = (m̂ − m)/v` and `β = (v − v̂)/v²` are exactly the `λ/√(1+v)` and `λ(z+λ)/(1+v)` of
    /// the probit update, so nothing is re-derived by hand.
    let absorb (observed: int) (bosonic: bool) (posterior: Posterior) : Posterior =
        let x = features observed
        let s = if bosonic then 1.0 else -1.0

        let mutable m = 0.0
        let mutable v = 0.0

        for i in 0 .. featureCount - 1 do
            m <- m + posterior.Mean.[i] * x.[i]
            v <- v + posterior.Variance.[i] * x.[i] * x.[i]

        let m = s * m

        if not (Double.IsFinite m) || not (Double.IsFinite v) || v <= 0.0 then
            posterior
        else
            let projected = Ep.probitProject (Gaussian.ofMeanVariance m v)
            let mHat = Gaussian.mean projected
            let vHat = Gaussian.variance projected

            if not (Double.IsFinite mHat) || not (Double.IsFinite vHat) then
                posterior
            else
                let alpha = (mHat - m) / v
                let beta = (v - vHat) / (v * v)
                let mean = Array.copy posterior.Mean
                let variance = Array.copy posterior.Variance

                for i in 0 .. featureCount - 1 do
                    mean.[i] <- mean.[i] + variance.[i] * s * x.[i] * alpha

                    variance.[i] <-
                        max minVariance (variance.[i] - variance.[i] * variance.[i] * x.[i] * x.[i] * beta)

                { Mean = mean; Variance = variance }

    /// Train on a list of `(observed, bosonic)` pairs. One ADF pass; deterministic in the
    /// order, which is itself determined by the generator's seed.
    let train (examples: (int * bool) list) : Posterior =
        examples |> List.fold (fun p (o, b) -> absorb o b p) (priorPosterior ())

    /// Posterior predictive `P(bosonic | observed)` — the Gaussian activation pushed through
    /// the probit link, so the weight uncertainty is carried into the prediction rather than
    /// collapsed to a point estimate.
    let predict (posterior: Posterior) (observed: int) : float =
        let x = features observed
        let mutable m = 0.0
        let mutable v = 0.0

        for i in 0 .. featureCount - 1 do
            m <- m + posterior.Mean.[i] * x.[i]
            v <- v + posterior.Variance.[i] * x.[i] * x.[i]

        Normal.cdf (m / sqrt (1.0 + v))

    // ── Controls and scoring ────────────────────────────────────────────────────────────────

    /// **The label-shuffle null control.** Permutes the labels through the same metered source
    /// the data came from, so the null is DST-replayable too. If the pipeline still learns
    /// under this, every other number in the study is void.
    let shuffleLabels (source: Gen.Source) (examples: (int * bool) list) : (int * bool) list * Gen.Source =
        let arr = examples |> List.map snd |> Array.ofList
        let mutable src = source

        for i in Array.length arr - 1 .. -1 .. 1 do
            // 16 metered bits, reduced modulo (i+1). The modulo bias is real and is named
            // rather than hidden: at n ≤ 4096 it is below 2^-4 relative and cannot manufacture
            // structure, only fail to destroy it — which would make the null CONSERVATIVE.
            let r, next = Gen.draw 16 src
            src <- next
            let j = r % (i + 1)
            let t = arr.[i]
            arr.[i] <- arr.[j]
            arr.[j] <- t

        (examples |> List.mapi (fun i (o, _) -> o, arr.[i])), src

    /// Fraction of predictions on the correct side of 0.5.
    let accuracy (predictions: (float * bool) list) : float =
        if List.isEmpty predictions then
            0.0
        else
            let hits = predictions |> List.filter (fun (p, y) -> (p >= 0.5) = y) |> List.length
            float hits / float (List.length predictions)

    /// Brier score — mean squared error of the probability. Proper scoring rule, so it
    /// penalises confident errors that accuracy alone forgives.
    let brierScore (predictions: (float * bool) list) : float =
        if List.isEmpty predictions then
            0.0
        else
            predictions
            |> List.averageBy (fun (p, y) ->
                let t = if y then 1.0 else 0.0
                (p - t) * (p - t))

    /// A reliability bin: predicted-confidence band, count, mean confidence, empirical accuracy.
    type ReliabilityBin =
        { /// Lower edge of the confidence band.
          Lower: float
          /// Upper edge of the confidence band.
          Upper: float
          /// Number of predictions falling in the band.
          Count: int
          /// Mean predicted confidence in the band.
          MeanConfidence: float
          /// Empirical accuracy in the band.
          Accuracy: float }

    /// Reliability diagram over `bins` equal-width confidence bands. Confidence is
    /// `max(p, 1−p)`; accuracy is the rate at which the confident side is right.
    let reliability (bins: int) (predictions: (float * bool) list) : ReliabilityBin list =
        let scored =
            predictions |> List.map (fun (p, y) -> (max p (1.0 - p)), ((p >= 0.5) = y))

        [ for b in 0 .. bins - 1 ->
            let lower = 0.5 + 0.5 * float b / float bins
            let upper = 0.5 + 0.5 * float (b + 1) / float bins

            let inBin =
                scored
                |> List.filter (fun (c, _) -> c >= lower && (c < upper || (b = bins - 1 && c <= upper)))

            { Lower = lower
              Upper = upper
              Count = List.length inBin
              MeanConfidence = (if List.isEmpty inBin then 0.0 else inBin |> List.averageBy fst)
              Accuracy =
                if List.isEmpty inBin then
                    0.0
                else
                    float (inBin |> List.filter snd |> List.length) / float (List.length inBin) } ]

    /// Expected calibration error: the count-weighted mean gap between confidence and accuracy
    /// across the reliability bins (Naeini, Cooper, Hauskrecht 2015; Guo et al. 2017).
    let expectedCalibrationError (bins: int) (predictions: (float * bool) list) : float =
        let n = List.length predictions

        if n = 0 then
            0.0
        else
            reliability bins predictions
            |> List.sumBy (fun bin ->
                float bin.Count / float n * abs (bin.MeanConfidence - bin.Accuracy))

    // ── The study ───────────────────────────────────────────────────────────────────────────

    /// One row of the degradation study, at a fixed number of flip operations.
    type StudyRow =
        { /// Flip operations applied per sample.
          FlipOperations: int
          /// Entropy measured at the membrane per sample, in bits (4 for the blade + 3 each).
          MeteredBitsPerSample: float
          /// Mean realized Hamming damage. Diverges from `FlipOperations` because two
          /// operations on the same bit cancel — the gap the metering buys.
          MeanRealizedDamage: float
          /// Fraction of "corrupted" samples whose realized damage is actually 0.
          UndamagedFraction: float
          /// Accuracy of the naive closed form.
          NaiveAccuracy: float
          /// Accuracy of the hard-decision ECC decoder.
          EccAccuracy: float
          /// Accuracy of the exact Bayes posterior (the ceiling).
          ExactBayesAccuracy: float
          /// ECE of the exact Bayes posterior.
          ExactBayesEce: float
          /// Accuracy of the toy BNN.
          BnnAccuracy: float
          /// ECE of the toy BNN.
          BnnEce: float
          /// Brier score of the toy BNN.
          BnnBrier: float
          /// Accuracy of the toy BNN trained on shuffled labels — the null control.
          ShuffledAccuracy: float
          /// ECE of the null control.
          ShuffledEce: float }

    /// Run the whole study at one damage level: generate train and test sets through the
    /// metered channel, fit the toy BNN, fit the null, and score everything against the three
    /// closed forms.
    let study (seed: uint64) (flips: int) (trainCount: int) (testCount: int) : StudyRow =
        let trainSamples = Gen.generate seed flips trainCount
        let testSamples = Gen.generate (seed ^^^ 0xD1B54A32D192ED03UL) flips testCount

        let trainPairs = trainSamples |> List.map (fun s -> s.Observed, s.Bosonic)
        let testPairs = testSamples |> List.map (fun s -> s.Observed, s.Bosonic)

        let fitted = train trainPairs
        let shuffled, _ = shuffleLabels (Gen.sourceOfSeed (seed + 1UL)) trainPairs
        let nullFit = train shuffled

        let scoreOf (f: int -> float) =
            testPairs |> List.map (fun (o, y) -> f o, y)

        let bnn = scoreOf (predict fitted)
        let nullScores = scoreOf (predict nullFit)
        let bayes = scoreOf (baselineExactBayes flips)

        let hard (f: int -> bool) =
            testPairs |> List.map (fun (o, y) -> (if f o then 1.0 else 0.0), y)

        { FlipOperations = flips
          MeteredBitsPerSample =
            if List.isEmpty testSamples then
                0.0
            else
                testSamples |> List.averageBy (fun s -> float s.MeteredBits)
          MeanRealizedDamage =
            if List.isEmpty testSamples then
                0.0
            else
                testSamples |> List.averageBy (fun s -> float s.RealizedDamage)
          UndamagedFraction =
            if List.isEmpty testSamples then
                0.0
            else
                float (testSamples |> List.filter (fun s -> s.RealizedDamage = 0) |> List.length)
                / float (List.length testSamples)
          NaiveAccuracy = accuracy (hard baselineNaive)
          EccAccuracy = accuracy (hard baselineEccDecode)
          ExactBayesAccuracy = accuracy bayes
          ExactBayesEce = expectedCalibrationError 10 bayes
          BnnAccuracy = accuracy bnn
          BnnEce = expectedCalibrationError 10 bnn
          BnnBrier = brierScore bnn
          ShuffledAccuracy = accuracy nullScores
          ShuffledEce = expectedCalibrationError 10 nullScores }

    /// How much data does the posterior need? Accuracy and ECE of the toy BNN as the training
    /// count grows — the axis a generator buys that a stored 16-row dataset cannot.
    let sampleSizeCurve (seed: uint64) (flips: int) (counts: int list) (testCount: int) : (int * float * float) list =
        let testSamples = Gen.generate (seed ^^^ 0xD1B54A32D192ED03UL) flips testCount
        let testPairs = testSamples |> List.map (fun s -> s.Observed, s.Bosonic)

        [ for n in counts ->
            let fitted = train (Gen.generate seed flips n |> List.map (fun s -> s.Observed, s.Bosonic))
            let scores = testPairs |> List.map (fun (o, y) -> predict fitted o, y)
            n, accuracy scores, expectedCalibrationError 10 scores ]

    // ── The headline: degradation against MEASURED damage, not against flip count ────────────

    /// Every linear functional `χ_u` that equals the grading on all 16 clean codewords. These
    /// are the read-outs: the minimum-weight ones say how few received bits suffice, and the
    /// set as a whole is the redundancy the code lends the label.
    let witnesses () : int list =
        [ 0 .. 255 ]
        |> List.filter (fun u ->
            [ 0 .. 15 ]
            |> List.forall (fun blade ->
                let bit = Gen.popcount (Gen.encode blade &&& u) % 2
                (bit = 0) = Gen.isBosonic blade))

    /// **The bound, computed from the code rather than cited.** An error pattern destroys the
    /// grading beyond any recovery exactly when it flips EVERY witness at once — then no
    /// read-out disagrees and there is nothing left to decode against. Returns the number of
    /// such patterns and the minimum weight among them.
    let labelIrrecoverableErrors () : int * int =
        let ws = witnesses ()

        let bad =
            [ 1 .. 255 ]
            |> List.filter (fun e -> ws |> List.forall (fun u -> Gen.popcount (u &&& e) % 2 = 1))

        List.length bad, (bad |> List.map Gen.popcount |> List.min)

    /// **A checked structural symmetry, not a coincidence.** `11111111 ∈ C` and has even
    /// weight, so complementing a received word maps codeword to codeword AND preserves the
    /// grading. Damage `d` and damage `8 − d` are therefore the same problem. Returns
    /// `(labelPreserved, codewordSetPreserved)`; both `true` is what makes the degradation
    /// curve symmetric about damage 4 rather than monotone.
    let complementSymmetry () : bool * bool =
        let labelOk =
            [ 0 .. 15 ]
            |> List.forall (fun blade ->
                Gen.isBosonic blade = Gen.isBosonic ((Gen.encode blade ^^^ 0xFF) &&& 0xF))

        let setOk =
            List.sort (Gen.codewords |> List.map (fun c -> c ^^^ 0xFF)) = List.sort Gen.codewords

        labelOk, setOk

    /// One stratum of the degradation study, keyed by **measured** Hamming damage.
    type DamageRow =
        { /// Realized Hamming weight of the error — the measured quantity, not the requested one.
          RealizedDamage: int
          /// Samples in this stratum.
          Count: int
          /// Naive closed form (parity of the systematic bits).
          NaiveAccuracy: float
          /// Hard-decision ECC decode.
          EccAccuracy: float
          /// Exact Bayes posterior at the assumed channel.
          ExactBayesAccuracy: float
          /// ECE of the exact Bayes posterior.
          ExactBayesEce: float
          /// Toy BNN.
          BnnAccuracy: float
          /// ECE of the toy BNN.
          BnnEce: float
          /// Mean confidence `max(p, 1−p)` of the toy BNN. Read it beside the accuracy: a high
          /// confidence next to a below-chance accuracy is a posterior that is confidently
          /// wrong, which is the failure a bare accuracy number hides.
          BnnMeanConfidence: float }

    /// Train once at `trainFlips`, then test on samples pooled across `testFlips` levels and
    /// **stratify the scores by the damage actually realized**. This is the plot the metered
    /// channel buys: the code's unique-decoding radius `t = ⌊(d−1)/2⌋` is a Hamming weight, so
    /// it is a vertical line on this axis and on no other. Indexing by requested flip count
    /// instead mixes undamaged samples into the damaged buckets.
    ///
    /// Both the BNN and the Bayes column assume the training channel, so they are misspecified
    /// together on out-of-distribution strata — a fair head-to-head, and stated rather than
    /// hidden.
    let studyByDamage
        (seed: uint64)
        (trainFlips: int)
        (trainCount: int)
        (testFlips: int list)
        (testCount: int)
        : DamageRow list =
        let fitted =
            train (Gen.generate seed trainFlips trainCount |> List.map (fun s -> s.Observed, s.Bosonic))

        let test =
            testFlips
            |> List.collect (fun k -> Gen.generate (seed ^^^ (0x9E3779B9UL + uint64 k)) k testCount)

        test
        |> List.groupBy (fun s -> s.RealizedDamage)
        |> List.sortBy fst
        |> List.map (fun (damage, xs) ->
            let n = List.length xs
            let hard f = float (xs |> List.filter (fun s -> f s.Observed = s.Bosonic) |> List.length) / float n
            let bnn = xs |> List.map (fun s -> predict fitted s.Observed, s.Bosonic)
            let bayes = xs |> List.map (fun s -> baselineExactBayes trainFlips s.Observed, s.Bosonic)

            { RealizedDamage = damage
              Count = n
              NaiveAccuracy = hard baselineNaive
              EccAccuracy = hard baselineEccDecode
              ExactBayesAccuracy = accuracy bayes
              ExactBayesEce = expectedCalibrationError 10 bayes
              BnnAccuracy = accuracy bnn
              BnnEce = expectedCalibrationError 10 bnn
              BnnMeanConfidence = bnn |> List.averageBy (fun (p, _) -> max p (1.0 - p)) })
