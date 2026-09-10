#r "../Core.Abstractions/bin/Release/net10.0/Zeta.Core.Abstractions.dll"
#r "../Core/bin/Release/net10.0/Zeta.Core.dll"
#load "ResearchRandom.fs"
#load "HiddenSwitchReceipt.fs"
#load "HiddenSwitchObservation.fs"
#load "HiddenSwitchCarrier.fs"
#load "HiddenSwitchPolicy.fs"
#load "HiddenSwitchExperiment.fs"
#load "HiddenSwitchRuntime.fsx"

open System
open System.IO
open System.Text
open System.Text.Json
open System.Text.Json.Nodes
open Zeta.Core
open Zeta.Research

type Transition = { Effect: bool; X: int; Action: int; Drift: int; Next: int; Reward4: int }
type Cue = { X: int; Error: int; Y: int }
type Conditioning = { Prior: float; Effect: bool; Action: int; Cue: int; Predicted: float; Posterior: float }
type Planning = { Prior: float; Effect: bool; Depth: int; Q: float[]; Counters: HiddenSwitchReceipt.PlanningCounters }
type HandEpisode = { Tape: string; Effect: bool; Geometry: string; Palette: string; Arm: string; Episode: HiddenSwitchReceipt.Episode }
type Falsifier = { Name: string; Passed: bool }
type Hand =
    { Protocol: string; Kind: string; Complete: bool; Failure: HiddenSwitchReceipt.Failure; ProtocolSha256: string
      Transitions: Transition[]; Cues: Cue[]; Conditioning: Conditioning[]; Planning: Planning[]
      Episodes: HandEpisode[]; Falsifiers: Falsifier[] }

let arguments = fsi.CommandLineArgs |> Array.skip 1
let output = match arguments with [|"--hand"; output|] when not (String.IsNullOrWhiteSpace output) -> output | _ -> eprintfn "usage: check-hidden-switch-kernel.fsx --hand NEW-OUTPUT.json"; exit 2
if File.Exists output || Directory.Exists output || File.Exists(output + ".partial") || Directory.Exists(output + ".partial") then eprintfn "refusing existing output or partial attempt"; exit 2
let root = Path.GetFullPath(Path.Combine(__SOURCE_DIRECTORY__, "../.."))
let admission = HiddenSwitchRuntime.admitRegistration root (Path.Combine(__SOURCE_DIRECTORY__, __SOURCE_FILE__)) "check-hidden-switch-kernel.fsx"
let mutable failure = match admission with Ok _ -> null | Error reason -> reason
let keep fallback value =
    match value with
    | Ok result -> result
    | Error reason ->
        if isNull failure then failure <- reason
        fallback
let carrier fallback value =
    value |> Result.mapError (fun reason -> HiddenSwitchReceipt.failure "hand" "environment" (sprintf "%A" reason)) |> keep fallback
let transitions = ResizeArray<Transition>()
let cues = ResizeArray<Cue>()
let conditioning = ResizeArray<Conditioning>()
let planning = ResizeArray<Planning>()
let episodes = ResizeArray<HandEpisode>()
let falsifiers = ResizeArray<Falsifier>()
let geometries = [|"dot","fixed"; "bar","fixed"; "dot","odd-complement"|]
let arms = (HiddenSwitchReceipt.config()).Arms
let tapes = HiddenSwitchCarrier.handTapes()
let expectedCounters depth : HiddenSwitchReceipt.PlanningCounters =
    match depth with
    | 1 -> { Nodes = 1; ActionValues = 2; Predictions = 0; Updates = 0 }
    | 2 -> { Nodes = 5; ActionValues = 10; Predictions = 2; Updates = 4 }
    | _ -> { Nodes = 21; ActionValues = 42; Predictions = 10; Updates = 20 }
let semantic (a: HiddenSwitchReceipt.Episode) (b: HiddenSwitchReceipt.Episode) =
    a.Complete && b.Complete && a.Actions = b.Actions && a.Cues = b.Cues && a.States = b.States
    && a.Beliefs = b.Beliefs && a.DecisionQ = b.DecisionQ && a.TreeRootQ = b.TreeRootQ
let flag name passed =
    falsifiers.Add { Name = name; Passed = passed }
    if not passed && isNull failure then failure <- HiddenSwitchReceipt.failure "hand-falsifier" name "bounded executable conformance witness failed"

if isNull failure then
    for effect in [false; true] do
        for x in 0 .. 1 do
            for action in 0 .. 1 do
                for drift in 0 .. 1 do
                    let next, reward = HiddenSwitchCarrier.transition effect x action drift |> carrier (0,0)
                    transitions.Add { Effect = effect; X = x; Action = action; Drift = drift; Next = next; Reward4 = reward }
    for x in 0 .. 1 do
        for error in 0 .. 1 do cues.Add { X = x; Error = error; Y = HiddenSwitchCarrier.cue x error |> carrier 0 }
    for prior in [0.0;0.25;0.5;0.75;1.0] do
        for effect in [false; true] do
            for action in 0 .. 1 do
                let predicted = HiddenSwitchPolicy.predict effect prior action |> keep 0.0
                for cue in 0 .. 1 do
                    let _, posterior = HiddenSwitchPolicy.condition predicted cue |> keep (0.0,0.0)
                    conditioning.Add { Prior = prior; Effect = effect; Action = action; Cue = cue; Predicted = predicted; Posterior = posterior }
            for depth in 1 .. 3 do
                let q, counters = HiddenSwitchPolicy.evaluate effect prior depth |> keep ([|0.0;0.0|], HiddenSwitchReceipt.zeroPlanning)
                planning.Add { Prior = prior; Effect = effect; Depth = depth; Q = q; Counters = counters }
    for name, tape in tapes do
        for effect in [false; true] do
            for geometry, palette in geometries do
                for arm in arms do
                    let value = HiddenSwitchExperiment.episode 0 tape effect geometry palette arm
                    episodes.Add { Tape = name; Effect = effect; Geometry = geometry; Palette = palette; Arm = arm; Episode = value }
                    if not value.Complete && isNull failure then failure <- value.Failure

    flag "action-effect" (transitions |> Seq.forall (fun row ->
        match HiddenSwitchCarrier.transition row.Effect row.X (1 - row.Action) row.Drift with
        | Ok(next, _) -> (next <> row.Next) = row.Effect
        | Error _ -> false))
    let mutable suffix = true
    for _, tape in tapes do
        let changed = { tape with Drift = Array.mapi (fun i bit -> if i >= 8 then 1 - bit else bit) tape.Drift
                                  Errors = Array.mapi (fun i bit -> if i >= 9 then 1 - bit else bit) tape.Errors }
        for effect in [false; true] do
            for arm in arms do
                let a = HiddenSwitchExperiment.episode 0 tape effect "dot" "fixed" arm
                let b = HiddenSwitchExperiment.episode 0 changed effect "dot" "fixed" arm
                suffix <- suffix && a.Complete && b.Complete && a.Actions.[0..8] = b.Actions.[0..8]
                          && a.Cues.[0..8] = b.Cues.[0..8] && a.Beliefs.[0..8] = b.Beliefs.[0..8]
                          && a.DecisionQ.[0..8] = b.DecisionQ.[0..8] && a.TreeRootQ.[0..8] = b.TreeRootQ.[0..8]
                          && a.States.[9] <> b.States.[9]
    flag "suffix-noninterference" suffix

    let mutable band, scorer = true, true
    for row in episodes do
        let tape = tapes |> Array.find (fun (name, _) -> name = row.Tape) |> snd
        let changeFrame index (frame: GameEnvironment.Frame) =
            let cells = Array.copy frame.Cells
            for i in 1536 .. 2047 do cells.[i] <- byte ((i + index) % 2)
            Ok { frame with Cells = cells }
        let bandHooks = { HiddenSwitchExperiment.normal with Frame = changeFrame }
        let alteredBand = HiddenSwitchExperiment.episodeWith bandHooks 0 tape row.Effect row.Geometry row.Palette row.Arm
        band <- band && semantic row.Episode alteredBand && row.Episode.Reward4 = alteredBand.Reward4
                && row.Episode.ProjectionSha256 = alteredBand.ProjectionSha256 && row.Episode.FrameSha256 <> alteredBand.FrameSha256
        let scoreHooks = { HiddenSwitchExperiment.normal with Scorer = fun step reward -> Ok(reward + 100 + step) }
        let alteredScorer = HiddenSwitchExperiment.episodeWith scoreHooks 0 tape row.Effect row.Geometry row.Palette row.Arm
        scorer <- scorer && semantic row.Episode alteredScorer && row.Episode.Reward4 <> alteredScorer.Reward4
                  && row.Episode.ProjectionSha256 = alteredScorer.ProjectionSha256
    flag "private-band-noninterference" band
    flag "scorer-noninterference" scorer

    let sampleEnvironment = HiddenSwitchCarrier.Adapter(snd tapes.[0], true, "dot", "fixed") :> GameEnvironment.IEnvironment<HiddenSwitchCarrier.State>
    let sample = result {
        let! state = sampleEnvironment.Reset()
        return! sampleEnvironment.Frame state } |> Result.mapError (fun reason -> HiddenSwitchReceipt.failure "hand" "sample" (sprintf "%A" reason))
    let frame = sample |> keep { W = 64; H = 32; Palette = 2; Cells = Array.zeroCreate 2048 }
    let mutable isolation = true
    for arm in arms do
        let witness = result {
            let! projection = HiddenSwitchObservation.project frame
            let! policy = HiddenSwitchPolicy.create arm true "dot"
            let! _, observed = HiddenSwitchPolicy.observe projection policy
            let snapshot = HiddenSwitchPolicy.snapshot observed
            let! before, _ = HiddenSwitchPolicy.choose observed
            Array.fill projection.Cells 0 2048 1uy
            let! after, _ = HiddenSwitchPolicy.choose observed
            return before = after && snapshot = HiddenSwitchPolicy.snapshot observed }
        isolation <- isolation && (witness |> Result.defaultValue false)
    flag "caller-frame-isolation" isolation

    flag "geometry-palette-invariance" (episodes |> Seq.forall (fun row ->
        let baseline = episodes |> Seq.find (fun other -> other.Tape = row.Tape && other.Effect = row.Effect && other.Arm = row.Arm && other.Geometry = "dot" && other.Palette = "fixed")
        semantic row.Episode baseline.Episode && row.Episode.Reward4 = baseline.Episode.Reward4))
    let nonbinary = { frame with Cells = Array.copy frame.Cells }
    nonbinary.Cells.[0] <- 2uy
    let extra = { frame with Cells = Array.copy frame.Cells }
    extra.Cells.[0] <- 1uy
    let tie = { frame with Cells = Array.init 2048 (fun index -> if index < 768 then 1uy else 0uy) }
    let policy = HiddenSwitchPolicy.create "belief-depth3" true "dot"
    let unsupported = result {
        let! state = sampleEnvironment.Reset()
        return! sampleEnvironment.Step(state, ControlScheme.Pad 2) }
    let malformed =
        [ HiddenSwitchObservation.project nonbinary |> Result.isError
          HiddenSwitchObservation.project Unchecked.defaultof<GameEnvironment.Frame> |> Result.isError
          HiddenSwitchObservation.project { frame with W = 63 } |> Result.isError
          HiddenSwitchObservation.project tie |> Result.isError
          HiddenSwitchObservation.decode "dot" extra |> Result.isError
          HiddenSwitchObservation.decode "unknown" frame |> Result.isError
          HiddenSwitchPolicy.condition Double.NaN 0 |> Result.isError
          HiddenSwitchPolicy.predict true Double.PositiveInfinity 0 |> Result.isError
          HiddenSwitchPolicy.evaluate true 0.5 4 |> Result.isError
          HiddenSwitchPolicy.select [|0.0; Double.NaN|] |> Result.isError
          policy |> Result.bind HiddenSwitchPolicy.choose |> Result.isError
          unsupported |> Result.isError ] |> List.forall id
    // An in-memory incomplete DTO tests shape only; it is never published as a successful experiment.
    let shapeProvenance: HiddenSwitchReceipt.Provenance =
        { SourceCommit = ""; RegistrationTag = ""; RegistrationCommit = ""; ImplementationTag = ""; ImplementationCommit = ""
          SourceHashes = [||]; LoadedAssemblies = [||]; Runtime = "fixture"; OperatingSystem = "fixture"; Arguments = [||] }
    let partialShape: HiddenSwitchReceipt.Native =
        { Protocol = HiddenSwitchReceipt.protocol; Kind = "behavior"; Complete = false; Failure = null
          ProtocolSha256 = HiddenSwitchRuntime.expectedProtocolHash; Config = HiddenSwitchReceipt.config()
          Provenance = shapeProvenance; StartedAtUtc = ""; FinishedAtUtc = ""
          Panels = (HiddenSwitchReceipt.config()).Panels |> Array.map (fun config ->
              { Config = config; Arms = arms |> Array.map (fun arm ->
                  { Name = arm; Complete = false; Failure = null
                    Episodes = [|(episodes |> Seq.find (fun row -> row.Arm = arm && row.Effect = config.Effect
                                                                  && row.Geometry = config.Geometry && row.Palette = config.Palette)).Episode|] }) }) }
    let encoded = JsonSerializer.Serialize partialShape
    let shapeBaseline = HiddenSwitchRuntime.nativeShape (Encoding.UTF8.GetBytes encoded) |> Result.isOk
    let mutationRefuses mutate =
        let node = JsonNode.Parse encoded
        mutate node
        node.ToJsonString() |> Encoding.UTF8.GetBytes |> HiddenSwitchRuntime.nativeShape |> Result.isError
    let omissions =
        [ mutationRefuses (fun node -> node.AsObject().Remove "Failure" |> ignore)
          mutationRefuses (fun node -> node.["Panels"].[0].["Arms"].[0].["Episodes"].[0].AsObject().Remove "Index" |> ignore)
          mutationRefuses (fun node -> node.["Panels"].[3].["Config"].AsObject().Remove "Effect" |> ignore)
          mutationRefuses (fun node -> node.["Panels"].[0].["Arms"].[1].["Episodes"].[0].["PlanningCounters"].[0].AsObject().Remove "Predictions" |> ignore)
          mutationRefuses (fun node -> node.AsObject().Add("Unexpected", JsonValue.Create 0))
          mutationRefuses (fun node -> node.["Complete"] <- JsonValue.Create "false") ] |> List.forall id
    let malformedJson =
        [ "{\"Complete\":true,\"Complete\":false}"; "{\"value\":NaN}"; "{\"value\":1e999}" ]
        |> List.forall (Encoding.UTF8.GetBytes >> HiddenSwitchRuntime.strictJson >> Result.isError)
    let argumentRefusals =
        (HiddenSwitchRuntime.behaviorArguments [|"fixture-output.json"|] |> Result.isOk)
        && ([ [||]; [|" "|]; [|"a";"b"|] ] |> List.forall (HiddenSwitchRuntime.behaviorArguments >> Result.isError))
    flag "malformed-input-refusal" (malformed && shapeBaseline && omissions && malformedJson && argumentRefusals)
    flag "padded-equivalence" (episodes |> Seq.filter (fun row -> row.Arm = "belief-myopic") |> Seq.forall (fun row ->
        let other = episodes |> Seq.find (fun other -> other.Tape = row.Tape && other.Effect = row.Effect && other.Geometry = row.Geometry && other.Palette = row.Palette && other.Arm = "belief-myopic-padded")
        row.Episode.Actions = other.Episode.Actions && row.Episode.Cues = other.Episode.Cues
        && row.Episode.States = other.Episode.States && row.Episode.Reward4 = other.Episode.Reward4
        && row.Episode.Beliefs = other.Episode.Beliefs && row.Episode.DecisionQ = other.Episode.DecisionQ))
    flag "counter-accounting" (episodes |> Seq.forall (fun row ->
        (row.Episode.PlanningCounters |> Array.mapi (fun step actual ->
            actual = expectedCounters (if row.Arm = "belief-myopic" then 1 else min 3 (16 - step))) |> Array.forall id)
        && row.Episode.FilterCounters = { Predictions = (if row.Arm = "latest-cue-depth3" then 0 else 16); Updates = 17 }))
    flag "null-dominance" (episodes |> Seq.filter (fun row -> not row.Effect) |> Seq.forall (fun row ->
        row.Episode.Complete && row.Episode.Actions = String('0',16)
        && (row.Episode.DecisionQ |> Array.forall (fun q -> q.[0] > q.[1]))))

let receipt: Hand =
    { Protocol = HiddenSwitchReceipt.protocol; Kind = "hand-conformance"; Complete = isNull failure; Failure = failure
      ProtocolSha256 = HiddenSwitchRuntime.expectedProtocolHash; Transitions = transitions.ToArray(); Cues = cues.ToArray()
      Conditioning = conditioning.ToArray(); Planning = planning.ToArray(); Episodes = episodes.ToArray(); Falsifiers = falsifiers.ToArray() }
match HiddenSwitchRuntime.writeNew output receipt with
| Error reason -> eprintfn "%s: %s" reason.Code reason.Detail; exit 1
| Ok hash -> eprintfn "hand=%s sha256=%s complete=%b" output hash receipt.Complete
if not receipt.Complete then eprintfn "%s: %s" failure.Code failure.Detail; exit 1
