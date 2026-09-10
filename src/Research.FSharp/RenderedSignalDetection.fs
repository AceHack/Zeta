namespace Zeta.Research

open System

[<RequireQualifiedAccess>]
module RenderedSignalDetection =
    type Trace = { FirstCrossing: int; FinalLogRatio: float; LogRatios: float[] }
    type Score =
        { Name: string; Seed: int; FirstCrossings: int[]; FinalLogRatios: float[]; AlarmCount: int; PreChangeAlarms: int
          Eligible: int; Detected: int; Misses: int; Delays: int[]; WilsonLow: float; WilsonHigh: float }

    let private logMean (values: float[]) =
        let maximum = Array.max values
        maximum + Math.Log(Array.averageBy (fun value -> Math.Exp(value - maximum)) values)

    /// Complete alternative likelihoods divided by the complete frozen denominator.
    /// Replacing only post-change factors would invalidate a learned/null comparison.
    let trace predictor (tokens: int[]) =
        if not (RenderedSignalPrediction.validTokens tokens) || tokens.Length < 2 then Error "detector requires 2..256 binary symbols"
        else
            let alternatives = [| for position in [32; 64; 96; 128] do for p in [0.5; 0.25] do yield position, p |]
            let numeratorLogs = Array.zeroCreate alternatives.Length
            let ratios = Array.zeroCreate tokens.Length
            let mutable denominatorLog = 0.0
            let mutable first = -1
            let mutable failure = None
            let mutable networkState =
                match predictor with RenderedSignalPrediction.Network model -> Array.zeroCreate (SmallRnn.width model) | _ -> [||]
            let mutable networkP1 = 0.5
            for t in 0 .. tokens.Length - 1 do
                if failure.IsNone then
                    let probability =
                        match predictor with
                        | RenderedSignalPrediction.Network _ -> Ok networkP1
                        | _ -> RenderedSignalPrediction.predict predictor (if t = 0 then [||] else tokens.[..t - 1])
                    match probability with
                    | Error reason -> failure <- Some reason
                    | Ok p1 ->
                        match RenderedSignalPrediction.logLoss tokens.[t] p1 with
                        | Error reason -> failure <- Some reason
                        | Ok lossBits ->
                            denominatorLog <- denominatorLog - lossBits * Math.Log 2.0
                            for a in 0 .. alternatives.Length - 1 do
                                let position, p = alternatives.[a]
                                let copy = if t >= position then p else 0.75
                                let emission = if t < 2 then 0.5 elif tokens.[t] = tokens.[t - 2] then copy else 1.0 - copy
                                numeratorLogs.[a] <- numeratorLogs.[a] + Math.Log emission
                            ratios.[t] <- logMean numeratorLogs - denominatorLog
                            if first < 0 && ratios.[t] >= Math.Log 20.0 then first <- t
                            match predictor with
                            | RenderedSignalPrediction.Network model ->
                                let state, distribution = SmallRnn.stepUnchecked model networkState tokens.[t]
                                match RenderedSignalPrediction.validateDistribution distribution with
                                | Error reason -> failure <- Some reason
                                | Ok next -> networkState <- state; networkP1 <- next
                            | _ -> ()
            match failure with Some reason -> Error reason | None -> Ok { FirstCrossing = first; FinalLogRatio = Array.last ratios; LogRatios = ratios }

    let wilson count total =
        let n = float total
        let p = float count / n
        let z = 1.959963984540054
        let denominator = 1.0 + z * z / n
        let centre = (p + z * z / (2.0 * n)) / denominator
        let radius = z * sqrt ((p * (1.0 - p) + z * z / (4.0 * n)) / n) / denominator
        centre - radius, centre + radius

    let score (candidate: RenderedSignalPrediction.Candidate) (rows: int[][]) =
        if isNull rows || rows.Length = 0 then Error "detection panel must contain rows"
        else
            let traces = rows |> Array.map (trace candidate.Predictor)
            match traces |> Array.tryPick (function Error reason -> Some reason | _ -> None) with
            | Some reason -> Error reason
            | None ->
                let valid = traces |> Array.choose (function Ok value -> Some value | _ -> None)
                let first = Array.map _.FirstCrossing valid
                let alarms = first |> Array.sumBy (fun t -> if t >= 0 then 1 else 0)
                let pre = first |> Array.sumBy (fun t -> if t >= 0 && t < 128 then 1 else 0)
                let delays = first |> Array.choose (fun t -> if t >= 128 then Some(t - 128) else None)
                let low, high = wilson alarms rows.Length
                Ok { Name = candidate.Name; Seed = candidate.Seed; FirstCrossings = first; FinalLogRatios = Array.map _.FinalLogRatio valid
                     AlarmCount = alarms; PreChangeAlarms = pre; Eligible = rows.Length - pre; Detected = delays.Length
                     Misses = rows.Length - pre - delays.Length; Delays = delays; WilsonLow = low; WilsonHigh = high }
