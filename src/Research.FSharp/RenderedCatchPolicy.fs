namespace Zeta.Research

open System
open System.Buffers.Binary
open System.Text.Json
open Zeta.Core

/// Supplied-goal policies receive only admitted projected frames and their own bounded state.
[<RequireQualifiedAccess>]
module RenderedCatchPolicy =
    type Counts = { Unigram: float[]; Bigram: float[][]; OrderTwo: float[][][] }
    let inputSha256 = "C59468575B140DA146265182EE40B03D6F6B5103FAAC9A0137CE8A288DF357B3"
    let countsSha256 = "8BEFD54B878D600A31A75BB5FA159588D2FDA4A849CAFB1410F03D6BC9B5B2A5"
    let private fail code detail = Error(RenderedCatchReceipt.failure "policy" code detail)
    let validateCounts (counts: Counts) =
        if obj.ReferenceEquals(counts, null) || isNull counts.Unigram || counts.Unigram.Length <> 2
           || isNull counts.Bigram || counts.Bigram.Length <> 2 || isNull counts.OrderTwo || counts.OrderTwo.Length <> 2
           || Array.exists (fun (matrix: float[][]) -> isNull matrix || matrix.Length <> 2) counts.OrderTwo then fail "counts-shape" "count model must have 2/2x2/2x2x2 shape"
        else
            let rows = Array.concat [|[|counts.Unigram|]; counts.Bigram; Array.concat counts.OrderTwo|]
            if Array.exists (fun (row: float[]) -> isNull row || row.Length <> 2 || Array.exists (fun p -> not (Double.IsFinite p) || p <= 0.0 || p >= 1.0) row || abs(Array.sum row - 1.0) > 1e-12) rows then
                fail "counts-probability" "counts require finite strict-interior normalized binary rows"
            else Ok()
    let hashCounts counts =
        validateCounts counts |> Result.map (fun () ->
            let values = Array.concat [|counts.Unigram; Array.concat counts.Bigram; counts.OrderTwo |> Array.collect Array.concat|]
            let bytes = Array.zeroCreate<byte> (14 * 8)
            values |> Array.iteri (fun index value -> BinaryPrimitives.WriteDoubleLittleEndian(bytes.AsSpan(index * 8, 8), value))
            RenderedCatchCarrier.sha256 bytes)
    let admitCounts counts =
        hashCounts counts |> Result.bind (fun actual -> if actual = countsSha256 then Ok() else fail "counts-hash" "frozen count fingerprint mismatch")
    let readCounts (raw: byte[]) =
        if isNull raw || RenderedCatchCarrier.sha256 raw <> inputSha256 then fail "input-hash" "requires exact registered passive receipt bytes"
        else
            try
                use document = JsonDocument.Parse raw
                if not (document.RootElement.GetProperty("Complete").GetBoolean()) then fail "input-status" "passive input must be complete"
                else
                    let counts = JsonSerializer.Deserialize<Counts>(document.RootElement.GetProperty("Counts").GetRawText())
                    admitCounts counts |> Result.map (fun () -> counts)
            with
            | :? JsonException as error -> fail "input-json" error.Message
            | :? InvalidOperationException as error -> fail "input-json" error.Message
            | :? Collections.Generic.KeyNotFoundException as error -> fail "input-json" error.Message

    /// The retained initial seed and draw count permit exact state forks in conformance fixtures.
    /// Real experiments keep one instance across episodes; only policy history resets.
    type FairStream(seed: uint64) =
        let stream = ResearchRandom.Stream seed
        let mutable draws = 0L
        member _.Draws = draws
        member _.NextKey() = draws <- draws + 1L; int (2.0 * stream.Next())
        member _.Fork() =
            let copy = FairStream seed
            for _ in 1L .. draws do copy.NextKey() |> ignore
            copy

    type private Parameters =
        | OrderTwo of Counts
        | Bigram of float[] * float[][]
        | Last
        | Fair of FairStream
        | Known
    type Policy = private { Parameters: Parameters; History: int[]; mutable Observed: int }
    let private copyCounts counts =
        { Unigram = Array.copy counts.Unigram; Bigram = Array.map Array.copy counts.Bigram; OrderTwo = Array.map (Array.map Array.copy) counts.OrderTwo }
    let create name counts fair =
        admitCounts counts |> Result.bind (fun () ->
            let parameters =
                match name with
                | "order-two" -> Ok(OrderTwo(copyCounts counts), 2)
                | "bigram" -> Ok(Bigram(Array.copy counts.Unigram, Array.map Array.copy counts.Bigram), 1)
                | "last-beacon" -> Ok(Last, 1)
                | "fair-independent" -> match fair with Some stream -> Ok(Fair stream, 0) | None -> fail "fair-stream" "fair arm requires its independent stream"
                | "known-lag-two" -> Ok(Known, 2)
                | _ -> fail "arm" "unknown catch policy arm"
            parameters |> Result.map (fun (parameters, slots) -> { Parameters = parameters; History = Array.zeroCreate slots; Observed = 0 }))
    let observe (frame: GameEnvironment.Frame) policy =
        RenderedCatchCarrier.decodeProjection frame |> Result.map (fun token ->
            if policy.History.Length = 2 then policy.History.[0] <- policy.History.[1]
            if policy.History.Length > 0 then policy.History.[policy.History.Length - 1] <- token
            policy.Observed <- policy.Observed + 1
            token)
    let choose policy =
        if policy.Observed < 2 || policy.Observed > 65 then fail "chronology" "scored choice needs 2..65 preceding observations"
        else
            match policy.Parameters with
            | OrderTwo counts ->
                admitCounts counts |> Result.map (fun () -> if counts.OrderTwo.[policy.History.[0]].[policy.History.[1]].[1] > 0.5 then 1 else 0)
            | Bigram (prior, weights) ->
                let row = weights.[policy.History.[0]]
                if prior.Length <> 2 || row.Length <> 2 || Array.exists (fun p -> not (Double.IsFinite p) || p <= 0.0 || p >= 1.0) row || abs(Array.sum row - 1.0) > 1e-12 then
                    fail "counts-probability" "retained bigram is invalid"
                else Ok(if row.[1] > 0.5 then 1 else 0)
            | Last -> Ok policy.History.[0]
            | Known -> Ok policy.History.[0]
            | Fair stream -> Ok(stream.NextKey())
    /// Check the actual arrays retained by this policy, including bigram's six values.
    /// Global input-count hashing alone would not detect mutation of these private copies.
    let validateRetained counts policy =
        admitCounts counts |> Result.bind (fun () ->
            match policy.Parameters with
            | OrderTwo actual -> admitCounts actual
            | Bigram(prior, weights) ->
                let fingerprint (values: float[]) =
                    let bytes = Array.zeroCreate<byte> (values.Length * 8)
                    values |> Array.iteri (fun index value -> BinaryPrimitives.WriteDoubleLittleEndian(bytes.AsSpan(index * 8, 8), value))
                    RenderedCatchCarrier.sha256 bytes
                let actual = Array.append prior (Array.concat weights) |> fingerprint
                let expected = Array.append counts.Unigram (Array.concat counts.Bigram) |> fingerprint
                if actual = expected then Ok() else fail "retained-model" "retained bigram parameter fingerprint changed"
            | Last | Known | Fair _ -> Ok())
    let fork policy =
        let parameters =
            match policy.Parameters with
            | OrderTwo counts -> OrderTwo(copyCounts counts)
            | Bigram(prior, weights) -> Bigram(Array.copy prior, Array.map Array.copy weights)
            | Fair stream -> Fair(stream.Fork())
            | other -> other
        { Parameters = parameters; History = Array.copy policy.History; Observed = policy.Observed }
    let payload name : RenderedCatchReceipt.Payload =
        let parameters, slots, fair =
            match name with "order-two" -> 14,2,false | "bigram" -> 6,1,false | "last-beacon" -> 0,1,false
                          | "fair-independent" -> 0,0,true | "known-lag-two" -> 0,2,false | _ -> 0,0,false
        { RenderedCatchReceipt.ParameterFloat64Values = parameters; ParameterBytes = parameters * 8; HistoryInt32Slots = slots; HistoryBytes = slots * 4
          ObservationCountBytes = 4; FairStreamStateBytes = (if fair then 8 else 0); FairInitialSeedBytes = (if fair then 8 else 0); FairDrawCountBytes = (if fair then 8 else 0)
          RomBytes = 2247; FullFrameCellBytes = 2048; ProjectedFrameCellBytes = 2048
          Scope = "partial numeric and frame-array ledger; excludes object headers, maps, registers, stack, keys, trace buffers and metadata; not retained heap or peak memory" }
