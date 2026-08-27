module Zeta.Tests.WSetHeatTests

open System
open Xunit
open Zeta.Core
open Zeta.Core.Abstractions

let private intStar: IStarRing<int64> = IntegerRing.Star

let private isZero (value: int64) = value = 0L

let private assertForgotten expectedMassPpm (result: WSetHeat.Metered<'T>) =
    match result.Heat with
    | None -> Assert.Fail "erasing operation must carry a heat signature"
    | Some heat ->
        Assert.Equal(expectedMassPpm, heat.MassPpm)
        Assert.Equal(1, heat.Units)
        Assert.Equal("forgotten", HeatSignal.tokenOfSignature heat)
        Assert.Contains("finite-reference-domain", heat.Detail, StringComparison.Ordinal)
        Assert.Contains("not-per-input-physical-cost", heat.Detail, StringComparison.Ordinal)

[<Fact>]
let ``reversible WSet adapters preserve values and stay cold`` () =
    let input = [ 0, 1L; 1, -1L ]
    let recorder = RecordingHeatSink()

    let negate = WSetHeat.negate "wset-room" intStar input
    let copy = WSetHeat.copy "wset-room" input
    let mapped = WSetHeat.mapKeysInjective "wset-room" ((+) 10) input
    let applied = WSetHeat.applyInjective "wset-room" intStar (fun key -> [ key + 10, 1L ]) input

    Assert.Equal<(int * int64) list>([ 0, -1L; 1, 1L ], negate.Value)
    Assert.Equal<((int * int) * int64) list>([ (0, 0), 1L; (1, 1), -1L ], copy.Value)
    Assert.Equal<(int * int64) list>([ 10, 1L; 11, -1L ], mapped.Value)
    Assert.Equal<(int * int64) list>(mapped.Value, applied.Value)

    for heat in [ negate.Heat; copy.Heat; mapped.Heat; applied.Heat ] do
        Assert.True(Option.isNone heat)

    match WSetHeat.emit (recorder :> IHeatSink) negate with
    | Error feedback -> Assert.Fail($"unexpected heat feedback: {feedback}")
    | Ok _ -> Assert.Empty recorder.Signatures

[<Fact>]
let ``erasing WSet adapters carry the measured finite-domain maxima`` () =
    let annihilating = [ 0, 1L; 0, -1L ]
    let singleton = [ 1, 1L ]

    WSetHeat.consolidate "wset-room" intStar isZero annihilating
    |> assertForgotten 3_459_432L

    WSetHeat.discard "wset-room" intStar annihilating
    |> assertForgotten 3_906_891L

    WSetHeat.bornProb "wset-room" (fun (weight: int64) -> float weight * float weight) annihilating
    |> assertForgotten 2_807_355L

    WSetHeat.plus "wset-room" annihilating singleton
    |> assertForgotten 1_584_963L

    WSetHeat.tensor "wset-room" intStar annihilating singleton
    |> assertForgotten 6_409_391L

[<Fact>]
let ``WSet heat emission uses the injected sink and preserves typed backpressure`` () =
    let sink = BoundedHeatSink(BoundedGSetConfig.noForgetBackpressure 1)
    let port = sink :> IHeatSink

    let first = WSetHeat.consolidate "room-a" intStar isZero [ 0, 1L; 0, -1L ]
    let second = WSetHeat.discard "room-b" intStar [ 1, 1L ]

    match WSetHeat.emit port first with
    | Error feedback -> Assert.Fail($"unexpected first heat feedback: {feedback}")
    | Ok result -> Assert.Equal(first, result)

    match WSetHeat.emit port second with
    | Ok _ -> Assert.Fail "the bounded sink must backpressure rather than erase heat"
    | Error(HeatSinkFeedback.Backpressure(heat, capacity, count)) ->
        Assert.Equal("room-b", heat.Source)
        Assert.Equal(1, capacity)
        Assert.Equal(2, count)
    | Error feedback -> Assert.Fail($"unexpected heat feedback: {feedback}")

type private Interp = Map<int, int>

let private reread: FourCornerTrace.Generator<int list, Interp, int, int64> =
    fun interpretation history ->
        history
        |> List.map (fun value -> Map.tryFind value interpretation |> Option.defaultValue value, 1L)

let private relabel (interpretation: Interp) ((before, after): int * int) =
    Map.add before after interpretation

[<Fact>]
let ``metered trace opening equals the pure trace and emits its consolidation`` () =
    let recorder = RecordingHeatSink()
    let history = [ 3; 3; 5 ]
    let expectedState, expectedEmission = FourCornerTrace.start intStar isZero reread history Map.empty

    match
        FourCornerTraceHeat.start
            (recorder :> IHeatSink)
            "trace-room"
            "turn-0"
            intStar
            isZero
            reread
            history
            Map.empty
    with
    | Error feedback -> Assert.Fail($"unexpected trace heat feedback: {feedback}")
    | Ok measured ->
        Assert.Equal(expectedState, measured.Candidate.State)
        Assert.Equal<(int * int64) list>(expectedEmission, measured.Candidate.Emission)
        let heat = Assert.Single measured.Heat
        Assert.Equal(FourCornerTraceHeat.Stage.OpeningConsolidation, heat.Stage)
        Assert.Equal("wset.consolidate.forgotten", heat.Signature.Kind)
        Assert.Single recorder.Signatures |> ignore

[<Fact>]
let ``metered trace step equals the pure trace and orders both consolidations`` () =
    let recorder = RecordingHeatSink()
    let history = [ 3; 3; 5 ]
    let state, _ = FourCornerTrace.start intStar isZero reread history Map.empty
    let expectedState, expectedDelta =
        FourCornerTrace.step intStar isZero reread relabel history (3, 30) state

    match
        FourCornerTraceHeat.step
            (recorder :> IHeatSink)
            "trace-room"
            "turn-1"
            intStar
            isZero
            reread
            relabel
            history
            (3, 30)
            state
    with
    | Error feedback -> Assert.Fail($"unexpected trace heat feedback: {feedback}")
    | Ok measured ->
        Assert.Equal(expectedState, measured.Candidate.State)
        Assert.Equal<(int * int64) list>(expectedDelta, measured.Candidate.Emission)
        Assert.Equal(2, measured.Heat.Length)
        Assert.Equal(FourCornerTraceHeat.Stage.DeltaConsolidation, measured.Heat[0].Stage)
        Assert.Equal(FourCornerTraceHeat.Stage.StateConsolidation, measured.Heat[1].Stage)
        Assert.Equal(2, recorder.Signatures.Count)

[<Fact>]
let ``metered trace retry preserves candidate and does not duplicate accepted heat`` () =
    let history = [ 3; 3; 5 ]
    let state, _ = FourCornerTrace.start intStar isZero reread history Map.empty
    let bounded = BoundedHeatSink(BoundedGSetConfig.noForgetBackpressure 1)

    let refused =
        FourCornerTraceHeat.step
            (bounded :> IHeatSink)
            "trace-room"
            "turn-1"
            intStar
            isZero
            reread
            relabel
            history
            (3, 30)
            state

    match refused with
    | Ok _ -> Assert.Fail "the second trace signature must backpressure"
    | Error feedback ->
        Assert.Equal(1, feedback.Completed.Length)
        Assert.Equal(FourCornerTraceHeat.Stage.DeltaConsolidation, feedback.Completed[0].Stage)
        Assert.Single feedback.Pending |> ignore
        Assert.Equal(FourCornerTraceHeat.Stage.StateConsolidation, feedback.Pending[0].Stage)
        Assert.Equal<(int * int64) list>([ 3, -2L; 30, 2L ], feedback.Candidate.Emission)
        Assert.Equal<(int * int64) list>([ 5, 1L; 30, 2L ], feedback.Candidate.State.Emitted)

        let recorder = RecordingHeatSink()

        match FourCornerTraceHeat.resume (recorder :> IHeatSink) feedback with
        | Error resumed -> Assert.Fail($"unexpected retry feedback: {resumed}")
        | Ok measured ->
            Assert.Equal(feedback.Candidate, measured.Candidate)
            Assert.Equal(2, measured.Heat.Length)
            let retried = Assert.Single recorder.Signatures
            Assert.Equal(feedback.Pending[0].Signature, retried)

[<Fact>]
let ``trace event identity makes replay idempotent without hiding the next turn`` () =
    let history = [ 3; 3; 5 ]
    let state, _ = FourCornerTrace.start intStar isZero reread history Map.empty
    let bounded = BoundedHeatSink(BoundedGSetConfig.noForgetBackpressure 2)

    let run eventId =
        FourCornerTraceHeat.step
            (bounded :> IHeatSink)
            "trace-room"
            eventId
            intStar
            isZero
            reread
            relabel
            history
            (3, 30)
            state

    match run "turn-1" with
    | Error feedback -> Assert.Fail($"unexpected first event feedback: {feedback}")
    | Ok _ -> Assert.Equal(2, bounded.Stored.Length)

    match run "turn-1" with
    | Error feedback -> Assert.Fail($"same event must replay idempotently: {feedback}")
    | Ok _ -> Assert.Equal(2, bounded.Stored.Length)

    match run "turn-2" with
    | Ok _ -> Assert.Fail "a distinct event must not collapse into the prior event"
    | Error feedback ->
        Assert.Empty feedback.Completed
        Assert.Equal(2, feedback.Pending.Length)
        Assert.Equal(FourCornerTraceHeat.Stage.DeltaConsolidation, feedback.Pending[0].Stage)
