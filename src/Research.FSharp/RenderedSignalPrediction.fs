namespace Zeta.Research

open System
open System.Buffers.Binary

[<RequireQualifiedAccess>]
module RenderedSignalPrediction =
    type Counts = { Unigram: float[]; Bigram: float[][]; OrderTwo: float[][][] }
    type Predictor = Fair | Last | Known | Unigram of float[] | Bigram of float[] * float[][] | OrderTwo of Counts | Network of SmallRnn.Model
    type Candidate = { Name: string; Seed: int; Predictor: Predictor }
    type Bin = { Index: int; Count: int; SumP1: float; SumY: float }
    type Score =
        { Name: string; Seed: int; P1: float[]; SampledLossBits: float; ExpectedCrossEntropyBits: float; ExcessKlBits: float
          Brier: float; Accuracy: float; Bins: Bin[]; LossDifferenceOrderTwo: float[] }
    type ModelReceipt =
        { Seed: int; Hidden: int; Status: string; Failure: string; InitialParameters: float[]; Parameters: float[]
          InitialSha256: string; TrainedSha256: string; TrainingTrace: SmallRnnTraining.Progress[]; TrainedTokens: int64 }

    let validTokens (tokens: int[]) =
        not (isNull tokens) && tokens.Length <= 256 && Array.forall (fun token -> token = 0 || token = 1) tokens

    let parametersHash (values: float[]) =
        let bytes = Array.zeroCreate (values.Length * 8)
        values |> Array.iteri (fun i value -> BinaryPrimitives.WriteDoubleLittleEndian(bytes.AsSpan(i * 8, 8), value))
        RenderedSignalCarrier.sha256 bytes

    let fitCounts (rows: int[][]) =
        if isNull rows || rows.Length = 0 || Array.exists (fun row -> not (validTokens row) || row.Length < 3) rows then
            Error "counts require nonempty rows of 3..256 binary symbols"
        else
            let unigram = Array.create 2 1.0
            let bigram = Array.init 2 (fun _ -> Array.create 2 1.0)
            let orderTwo = Array.init 2 (fun _ -> Array.init 2 (fun _ -> Array.create 2 1.0))
            for row in rows do
                for t in 1 .. row.Length - 1 do
                    unigram.[row.[t]] <- unigram.[row.[t]] + 1.0
                    bigram.[row.[t - 1]].[row.[t]] <- bigram.[row.[t - 1]].[row.[t]] + 1.0
                    if t >= 2 then orderTwo.[row.[t - 2]].[row.[t - 1]].[row.[t]] <- orderTwo.[row.[t - 2]].[row.[t - 1]].[row.[t]] + 1.0
            let normalize row = let sum = Array.sum row in Array.map (fun n -> n / sum) row
            Ok { Unigram = normalize unigram; Bigram = Array.map normalize bigram; OrderTwo = Array.map (Array.map normalize) orderTwo }

    let private countP counts order (tokens: int[]) =
        if tokens.Length = 0 || order = 0 then counts.Unigram.[1]
        elif tokens.Length = 1 || order = 1 then counts.Bigram.[tokens.[tokens.Length - 1]].[1]
        else counts.OrderTwo.[tokens.[tokens.Length - 2]].[tokens.[tokens.Length - 1]].[1]

    let private knownP (tokens: int[]) =
        if tokens.Length < 2 then 0.5 elif tokens.[tokens.Length - 2] = 1 then 0.75 else 0.25

    let validateDistribution (probabilities: float[]) =
        if isNull probabilities || probabilities.Length <> 2 || Array.exists (fun p -> not (Double.IsFinite p) || p <= 0.0 || p >= 1.0) probabilities
           || abs (Array.sum probabilities - 1.0) > 1e-12 then Error "prediction must be a finite normalized binary distribution"
        else Ok probabilities.[1]

    let private validateCounts (counts: Counts) =
        if isNull counts.Unigram || isNull counts.Bigram || counts.Bigram.Length <> 2 || isNull counts.OrderTwo || counts.OrderTwo.Length <> 2
           || Array.exists (fun (matrix: float[][]) -> isNull matrix || matrix.Length <> 2) counts.OrderTwo then Error "count model shape mismatch"
        else
            Array.concat [ [|counts.Unigram|]; counts.Bigram; Array.concat counts.OrderTwo ]
            |> Array.map validateDistribution
            |> Array.tryPick (function Error reason -> Some reason | _ -> None)
            |> function Some reason -> Error reason | None -> Ok()

    let predict predictor tokens =
        if not (validTokens tokens) then Error "prediction context must have at most 256 binary symbols"
        else
            (match predictor with
            | Fair -> Ok 0.5
            | Last -> Ok(if tokens.Length = 0 then 0.5 elif Array.last tokens = 1 then 0.95 else 0.05)
            | Known -> Ok(knownP tokens)
            | Unigram weights -> validateDistribution weights
            | Bigram (prior, weights) ->
                if isNull weights || weights.Length <> 2 then Error "bigram model shape mismatch"
                else validateDistribution (if tokens.Length = 0 then prior else weights.[Array.last tokens])
            | OrderTwo counts -> validateCounts counts |> Result.map (fun () -> countP counts 2 tokens)
            | Network model -> SmallRnn.after model tokens |> Result.bind (snd >> validateDistribution))
            |> Result.bind (fun p -> validateDistribution [| 1.0 - p; p |])

    let candidates counts (models: ModelReceipt[]) =
        let common =
            [| { Name = "fair"; Seed = -1; Predictor = Fair }; { Name = "last"; Seed = -1; Predictor = Last }
               { Name = "known"; Seed = -1; Predictor = Known }; { Name = "unigram"; Seed = -1; Predictor = Unigram counts.Unigram }
               { Name = "bigram"; Seed = -1; Predictor = Bigram(counts.Unigram, counts.Bigram) }; { Name = "order-two"; Seed = -1; Predictor = OrderTwo counts } |]
        let networks = ResizeArray<Candidate>()
        let mutable failure = None
        for model in models do
            if model.Status <> "complete" then failure <- Some "cannot admit a failed model to prediction"
            elif model.InitialSha256 <> parametersHash model.InitialParameters || model.TrainedSha256 <> parametersHash model.Parameters then
                failure <- Some "model parameter fingerprint mismatch"
            else
                for name, parameters in [ "untrained-rnn", model.InitialParameters; "trained-rnn", model.Parameters ] do
                    match SmallRnn.fromParameters 2 model.Hidden parameters with
                    | Error reason -> failure <- Some reason
                    | Ok network -> networks.Add { Name = name; Seed = model.Seed; Predictor = Network network }
        match failure with Some reason -> Error reason | None -> Ok(Array.append common (networks.ToArray()))

    let logLoss target p1 =
        let p = if target = 1 then p1 else 1.0 - p1
        if p <= 0.0 || not (Double.IsFinite p) then Error "possible observed target received zero or invalid probability"
        else Ok(-Math.Log2 p)

    let score (candidate: Candidate) (counts: Counts) (rows: int[][]) =
        if isNull rows || rows.Length = 0 || Array.exists (fun row -> not (validTokens row) || row.Length < 3) rows then Error "invalid prediction panel"
        else
            let predictions = Array.zeroCreate rows.Length
            let differences = Array.zeroCreate rows.Length
            let bins = Array.init 10 (fun index -> { Index = index; Count = 0; SumP1 = 0.0; SumY = 0.0 })
            let mutable sampled, expected, excess, brier, correct = 0.0, 0.0, 0.0, 0.0, 0
            let mutable failure = None
            for i in 0 .. rows.Length - 1 do
                if failure.IsNone then
                    let row = rows.[i]
                    let target = Array.last row
                    let context = row.[..row.Length - 2]
                    match predict candidate.Predictor context with
                    | Error reason -> failure <- Some reason
                    | Ok p ->
                        match logLoss target p, logLoss target (countP counts 2 context) with
                        | Ok loss, Ok controlLoss when p > 0.0 && p < 1.0 ->
                            let q = knownP context
                            let ce = -q * Math.Log2 p - (1.0 - q) * Math.Log2(1.0 - p)
                            let entropy = -q * Math.Log2 q - (1.0 - q) * Math.Log2(1.0 - q)
                            predictions.[i] <- p
                            differences.[i] <- loss - controlLoss
                            sampled <- sampled + loss
                            expected <- expected + ce
                            excess <- excess + ce - entropy
                            brier <- brier + (p - float target) ** 2.0
                            correct <- correct + (if (if p > 0.5 then 1 else 0) = target then 1 else 0)
                            let index = min 9 (int (10.0 * p))
                            let bin = bins.[index]
                            bins.[index] <- { bin with Count = bin.Count + 1; SumP1 = bin.SumP1 + p; SumY = bin.SumY + float target }
                        | Error reason, _ | _, Error reason -> failure <- Some reason
                        | _ -> failure <- Some "oracle cross-entropy requires positive probability for both possible symbols"
            match failure with
            | Some reason -> Error reason
            | None ->
                let n = float rows.Length
                Ok { Name = candidate.Name; Seed = candidate.Seed; P1 = predictions; SampledLossBits = sampled / n
                     ExpectedCrossEntropyBits = expected / n; ExcessKlBits = excess / n; Brier = brier / n; Accuracy = float correct / n
                     Bins = bins; LossDifferenceOrderTwo = differences }

    /// Independent replay checks numeric payload, not managed heap or whole-process RSS.
    let payload candidate =
        match candidate.Predictor with
        | Network model -> SmallRnn.parameters model |> Array.length |> fun n -> 8 * n, 8 * (SmallRnn.width model + 2)
        | Unigram _ -> 16, 16
        | Bigram _ -> 48, 20
        | OrderTwo _ -> 112, 24
        | Fair -> 0, 16
        | Last -> 0, 20
        | Known -> 0, 24
