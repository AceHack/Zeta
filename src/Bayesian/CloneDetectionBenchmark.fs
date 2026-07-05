namespace Zeta.Bayesian

open System

/// Synthetic clone-vs-independent benchmark for Sybil detectors (081KWQS0NGS).
/// Compares Clifford rotor consistency, Pearson correlation on means, and affine-map residual.
[<RequireQualifiedAccess>]
module CloneDetectionBenchmark =

    type Scorer =
        | Rotor
        | Pearson
        | Procrustes

    let private det3 (m: float[][]) : float =
        m.[0].[0] * (m.[1].[1] * m.[2].[2] - m.[1].[2] * m.[2].[1])
        - m.[0].[1] * (m.[1].[0] * m.[2].[2] - m.[1].[2] * m.[2].[0])
        + m.[0].[2] * (m.[1].[0] * m.[2].[1] - m.[1].[1] * m.[2].[0])

    let private replaceCol (m: float[][]) (col: int) (v: float[]) : float[][] =
        [| for i in 0 .. 2 do
               [| for j in 0 .. 2 do
                      if j = col then v.[i] else m.[i].[j] |] |]

    let private solve3 (a: float[][]) (b: float[]) : float[] =
        let detA = det3 a
        if abs detA < 1e-18 then
            Array.zeroCreate 3
        else
            [| det3 (replaceCol a 0 b) / detA
               det3 (replaceCol a 1 b) / detA
               det3 (replaceCol a 2 b) / detA |]

    let private solveAffine (design: float[][]) (targets: (float * float)[]) : float[] * float[] =
        let xtx = Array2D.zeroCreate 3 3
        let xty0 = Array.zeroCreate 3
        let xty1 = Array.zeroCreate 3
        for i in 0 .. design.Length - 1 do
            let row = design.[i]
            let y0, y1 = targets.[i]
            for r in 0 .. 2 do
                xty0.[r] <- xty0.[r] + row.[r] * y0
                xty1.[r] <- xty1.[r] + row.[r] * y1
                for c in 0 .. 2 do
                    xtx.[r, c] <- xtx.[r, c] + row.[r] * row.[c]
        let a =
            [| [| xtx.[0, 0] + 1e-8; xtx.[0, 1]; xtx.[0, 2] |]
               [| xtx.[1, 0]; xtx.[1, 1] + 1e-8; xtx.[1, 2] |]
               [| xtx.[2, 0]; xtx.[2, 1]; xtx.[2, 2] + 1e-8 |] |]
        solve3 a xty0, solve3 a xty1

    /// Affine least-squares fit [mean, precision, 1] → (mean', precision'); returns mean squared error.
    let affineLeastSquaresMse (beliefsA: Gaussian list) (beliefsB: Gaussian list) : float =
        let n = min beliefsA.Length beliefsB.Length
        if n < 2 then 1.0
        else
            let toMeanPrec (g: Gaussian) =
                let pr = g.Precision
                let m = if pr = 0.0 then 0.0 else g.PrecisionMean / pr
                m, pr

            let design =
                beliefsA
                |> List.take n
                |> List.map (toMeanPrec >> fun (m, pr) -> [| m; pr; 1.0 |])
                |> Array.ofList
            let targets =
                beliefsB
                |> List.take n
                |> List.map (toMeanPrec >> fun (m, pr) -> m, pr)
                |> Array.ofList

            let w0, w1 = solveAffine design targets
            let mutable se = 0.0
            for i in 0 .. n - 1 do
                let row = design.[i]
                let y0, y1 = targets.[i]
                let p0 = w0.[0] * row.[0] + w0.[1] * row.[1] + w0.[2] * row.[2]
                let p1 = w1.[0] * row.[0] + w1.[1] * row.[1] + w1.[2] * row.[2]
                let d0 = p0 - y0
                let d1 = p1 - y1
                se <- se + d0 * d0 + d1 * d1
            let mse = se / float n
            if Double.IsNaN mse || Double.IsInfinity mse then 1e12 else mse

    /// Higher score ⇒ more clone-like (label 1).
    let score (scorer: Scorer) (beliefsA: Gaussian list) (beliefsB: Gaussian list) : float =
        match scorer with
        | Scorer.Rotor ->
            CliffordAntiSybil.computeGeometricCorrelation
                { AntiSybil.AgentId = "a"; AntiSybil.Beliefs = beliefsA }
                { AntiSybil.AgentId = "b"; AntiSybil.Beliefs = beliefsB }
        | Scorer.Pearson -> abs (AntiSybil.computeCorrelation beliefsA beliefsB)
        | Scorer.Procrustes -> -(affineLeastSquaresMse beliefsA beliefsB)

    /// Mann–Whitney U → AUC. Labels: 1 = clone, 0 = independent.
    let auc (scores: float list) (labels: int list) : float =
        if scores.Length <> labels.Length || scores.IsEmpty then
            nan
        else
            let nPos = labels |> List.filter ((=) 1) |> List.length
            let nNeg = labels.Length - nPos
            if nPos = 0 || nNeg = 0 then nan
            else
                let ranked =
                    List.zip scores labels
                    |> List.sortBy fst
                    |> List.mapi (fun i pair -> i + 1, pair)
                let rankSumPos =
                    ranked
                    |> List.choose (fun (rank, (_, lab)) -> if lab = 1 then Some (float rank) else None)
                    |> List.sum
                let u = rankSumPos - float nPos * float (nPos + 1) / 2.0
                u / (float nPos * float nNeg)

    type Lcg = { mutable State: uint32 }

    let private nextUnit (lcg: Lcg) : float =
        lcg.State <- (lcg.State * 1664525u + 1013904223u)
        float lcg.State / float UInt32.MaxValue

    let private nextGaussian (lcg: Lcg) (sigma: float) : float =
        if sigma <= 0.0 then 0.0
        else
            let u1 = max 1e-15 (nextUnit lcg)
            let u2 = nextUnit lcg
            sigma * sqrt (-2.0 * log u1) * cos (2.0 * Math.PI * u2)

    let randomBeliefStream (lcg: Lcg) (length: int) : Gaussian list =
        let mutable mean = nextUnit lcg * 4.0 - 2.0
        let mutable prec = nextUnit lcg * 2.5 + 0.5
        [ for _ in 1 .. length do
              mean <- mean + nextGaussian lcg 0.3
              prec <- max 0.1 (prec + nextGaussian lcg 0.1)
              yield { Gaussian.PrecisionMean = mean * prec; Precision = prec } ]

    let cloneBeliefStream (lcg: Lcg) (baseStream: Gaussian list) (noiseSigma: float) (theta: float) (scale: float) : Gaussian list =
        let c = cos theta
        let s = sin theta
        baseStream
        |> List.map (fun b ->
            let pr = b.Precision
            let mean = if pr = 0.0 then 0.0 else b.PrecisionMean / pr
            let meanR = scale * (c * mean - s * pr) + nextGaussian lcg noiseSigma
            let prR = max 0.05 (scale * (s * mean + c * pr) + nextGaussian lcg noiseSigma)
            { Gaussian.PrecisionMean = meanR * prR; Precision = prR })

    type SweepRow =
        { NoiseSigma: float
          RotorAuc: float
          PearsonAuc: float
          ProcrustesAuc: float }

    /// N clone + N independent pairs at one noise level; fixed seed for reproducibility.
    let runNoiseLevel
        (seed: uint32)
        (pairsPerClass: int)
        (streamLength: int)
        (noiseSigma: float)
        : SweepRow =
        let rotorScores = ResizeArray()
        let pearsonScores = ResizeArray()
        let procrustesScores = ResizeArray()
        let labels = ResizeArray()

        let lcg = { State = seed }

        for i in 0 .. pairsPerClass - 1 do
            let baseA = randomBeliefStream lcg streamLength
            let theta = nextUnit lcg * 2.0 * Math.PI
            let scale = nextUnit lcg * 1.5 + 0.5
            let cloneB = cloneBeliefStream lcg baseA noiseSigma theta scale
            labels.Add(1)
            rotorScores.Add(score Scorer.Rotor baseA cloneB)
            pearsonScores.Add(score Scorer.Pearson baseA cloneB)
            procrustesScores.Add(score Scorer.Procrustes baseA cloneB)

            let indA = randomBeliefStream lcg streamLength
            let indB = randomBeliefStream lcg streamLength
            labels.Add(0)
            rotorScores.Add(score Scorer.Rotor indA indB)
            pearsonScores.Add(score Scorer.Pearson indA indB)
            procrustesScores.Add(score Scorer.Procrustes indA indB)

        let lab = labels |> Seq.toList
        { NoiseSigma = noiseSigma
          RotorAuc = auc (rotorScores |> Seq.toList) lab
          PearsonAuc = auc (pearsonScores |> Seq.toList) lab
          ProcrustesAuc = auc (procrustesScores |> Seq.toList) lab }

    let runSweep (seed: uint32) (pairsPerClass: int) (streamLength: int) (noiseLevels: float list) : SweepRow list =
        noiseLevels |> List.map (fun n -> runNoiseLevel seed pairsPerClass streamLength n)

    /// Default sweep matching the 2026-07-04 external audit experiment (seed 42, N=200, len=12).
    let defaultSweep () : SweepRow list =
        runSweep 42u 200 12 [ 0.0; 0.05; 0.1; 0.2; 0.5; 1.0; 2.0 ]
