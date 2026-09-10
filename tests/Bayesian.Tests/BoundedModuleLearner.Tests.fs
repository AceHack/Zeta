module Zeta.Bayesian.Tests.BoundedModuleLearnerTests

open System
open System.Security.Cryptography
open System.Text
open System.Text.Json
open Xunit
open Zeta.Bayesian

module L = BoundedModuleLearner

let private accepted = function
    | Ok value -> value
    | Error failure -> failwithf "Unexpected refusal: %A" failure

let private refused = function
    | Error failure -> failure
    | Ok value -> failwithf "Expected refusal; actual return: %A" value

let private hash = String.replicate 64 "A"
let private row value = value :: List.replicate 7 0.0
let private inputs value = row value @ [ 0.0; 0.0; 0.0; 0.0 ]
let private initial = L.initialParameters ()
let private near expected actual tolerance =
    Assert.True(Double.IsFinite actual && abs (actual - expected) <= tolerance,
                $"Expected {expected}, actual {actual}, tolerance {tolerance}")

let private scaler rows = (L.tryFitPreprocessing hash rows).Outcome |> accepted

let private artifact () : L.ModuleArtifact =
    { Id = "control/module"; ParentVersion = None; TrainingCut = hash
      Architecture = L.Architecture; Ports = [ "absent"; "absent" ]
      Parameters = initial; Preprocessing = scaler [ row 0.0 ]
      UpdateReceiptSha256 = hash; SourceBindings = Map.ofList [ "control/source.fs", hash ] }

[<Fact>]
let ``initializer is exactly the fixed 57 parameter roster`` () =
    let numerators =
        [ -2; -1; 0; 1; 2; 3; -3; -2; -1; 0; 1; 2
          -1; 1; 3; -2; 0; 2; -3; -1; 1; 3; -2; 0
          0; 3; -1; 2; -2; 1; -3; 0; 3; -1; 2; -2
          1; -2; 2; -1; 3; 0; -3; 1; -2; 2; -1; 3
          0; 0; 0; 0; 2; 4; 6; 8; 0 ]
    let expected = numerators |> List.map (fun n -> float n / 32.0)
    Assert.Equal<float list>(expected, initial)

[<Fact>]
let ``forward retains four actual activations and the fixed output`` () =
    let actual = L.tryForward { Parameters = initial; Inputs = inputs 0.5 }
    let expectedHidden = [ for h in 0 .. 3 -> Math.Tanh(initial[12 * h] * 0.5) ]
    let expected = List.fold2 (fun acc v h -> acc + v * h) 0.0 initial[52..55] expectedHidden
    Assert.Equal<float list>(expectedHidden, actual.Hidden)
    Assert.Equal(4, actual.Preactivations.Length)
    Assert.Equal(L.bits expected, L.bits (accepted actual.Outcome))

[<Fact>]
let ``full gradient uses one old vector and fixed half squared loss`` () =
    let x = inputs -1.25
    let actual = L.tryStep { Parameters = initial; Inputs = x; Target = -1.0 }
    accepted actual.Outcome
    let forward = Option.get actual.Forward
    let prediction = accepted forward.Outcome
    let error = prediction + 1.0
    let delta = [ for h in 0 .. 3 -> (error * initial[52 + h]) * (1.0 - forward.Hidden[h] * forward.Hidden[h]) ]
    let expected =
        [ yield! [ for h in 0 .. 3 do for j in 0 .. 11 -> delta[h] * x[j] ]
          yield! delta
          yield! [ for h in 0 .. 3 -> error * forward.Hidden[h] ]
          yield error ]
    Assert.Equal<float list>(expected, actual.Gradient)
    Assert.Equal(Some(error * error / 2.0), actual.Loss)
    Assert.Equal(57, actual.ProposedParameters.Length)
    Assert.Equal<float list>(List.map2 (fun old g -> old - g / 1024.0) initial expected, actual.ProposedParameters)

[<Fact>]
let ``central differences distinguish updated output weight hidden gradient`` () =
    let preprocessing = scaler [ row -1.0; row -0.5; row 0.5; row 1.0 ]
    let transformed = L.tryTransform preprocessing (row -1.0)
    accepted transformed.Outcome
    let x = transformed.Values @ [ 0.0; 0.0; 0.0; 0.0 ]
    let actual = L.tryStep { Parameters = initial; Inputs = x; Target = -1.0 }
    accepted actual.Outcome
    let loss parameters =
        let value = (L.tryForward { Parameters = parameters; Inputs = x }).Outcome |> accepted
        (value + 1.0) * (value + 1.0) / 2.0
    let h = Math.ScaleB(1.0, -20)
    let difference index =
        let shifted delta = initial |> List.mapi (fun i value -> if i = index then value + delta else value)
        (loss (shifted h) - loss (shifted -h)) / (2.0 * h)
    let hiddenDifference = difference 0
    let outputDifference = difference 52
    let tolerance derivative = 1e-7 + 1e-6 * abs derivative
    near hiddenDifference actual.Gradient[0] (tolerance hiddenDifference)
    near outputDifference actual.Gradient[52] (tolerance outputDifference)
    let forward = Option.get actual.Forward
    let error = accepted forward.Outcome + 1.0
    let wrong = ((error * actual.ProposedParameters[52]) * (1.0 - forward.Hidden[0] * forward.Hidden[0])) * x[0]
    Assert.True(abs (wrong - hiddenDifference) > tolerance hiddenDifference,
                "The executed updated-V mutant must fail the same derivative check")

[<Fact>]
let ``late replacement refusal retains forward full gradient and partial proposal`` () =
    let old = List.replicate 57 0.0 |> List.mapi (fun i x -> if i = 52 || i = 56 then 64.0 else x)
    let x = List.replicate 8 0.0 @ [ 64.0; 0.0; 1.0; 0.0 ]
    let actual = L.tryStep { Parameters = old; Inputs = x; Target = -64.0 }
    let failure = refused actual.Outcome
    Assert.Equal("learn", failure.Stage)
    Assert.Equal(Some "replacement[8]", failure.Field)
    Assert.Equal(57, actual.Gradient.Length)
    Assert.Equal(8, actual.ProposedParameters.Length)
    Assert.Equal(524288.0, actual.Gradient[8])
    Assert.Equal(64.0, (Option.get actual.Forward).Outcome |> accepted)
    Assert.Equal(Some 8192.0, actual.Loss)
    Assert.Equal(0.0, old[8])

[<Fact>]
let ``nonfinite target refuses before entering forward`` () =
    let actual = L.tryStep { Parameters = initial; Inputs = inputs 0.0; Target = Double.NaN }
    refused actual.Outcome |> ignore
    Assert.True(actual.Forward.IsNone)
    Assert.Empty(actual.Gradient)
    Assert.Empty(actual.ProposedParameters)

[<Fact>]
let ``parameter and input lengths refuse before activation`` () =
    for parameters in [ initial.Tail; initial @ [ 0.0 ]; Unchecked.defaultof<float list> ] do
        let actual = L.tryForward { Parameters = parameters; Inputs = inputs 0.0 }
        Assert.Equal("Admission", (refused actual.Outcome).Code)
        Assert.Empty(actual.Hidden)
    for x in [ []; inputs 0.0 @ [ 0.0 ] ] do
        refused (L.tryForward { Parameters = initial; Inputs = x }).Outcome |> ignore

[<Fact>]
let ``input finite range and presence are admitted exactly`` () =
    for value in [ Double.NaN; Double.PositiveInfinity; 8.0001 ] do
        refused (L.tryForward { Parameters = initial; Inputs = inputs value }).Outcome |> ignore
    let absentNonzero = List.replicate 8 0.0 @ [ 2.0; 0.0; 0.0; 0.0 ]
    refused (L.tryForward { Parameters = initial; Inputs = absentNonzero }).Outcome |> ignore
    let badPresence = List.replicate 10 0.0 @ [ 0.5; 0.0 ]
    refused (L.tryForward { Parameters = initial; Inputs = badPresence }).Outcome |> ignore

[<Fact>]
let ``null ordinary input records return typed refusal`` () =
    refused (L.tryForward Unchecked.defaultof<L.ForwardInput>).Outcome |> ignore
    refused (L.tryStep Unchecked.defaultof<L.StepInput>).Outcome |> ignore
    refused (L.tryValidateArtifact Unchecked.defaultof<L.ModuleArtifact>) |> ignore

[<Fact>]
let ``preprocessing uses population variance and constant scale one`` () =
    let actual = L.tryFitPreprocessing hash [ row -1.0; row -0.5; row 0.5; row 1.0 ]
    let value = accepted actual.Outcome
    Assert.Equal(4, value.Count)
    Assert.Equal(0.0, value.Means[0])
    Assert.Equal(0.625, actual.Variances[0])
    Assert.Equal(sqrt 0.625, value.Scales[0])
    Assert.Equal<float list>(List.replicate 7 1.0, value.Scales.Tail)
    Assert.NotEqual(sqrt (2.5 / 3.0), value.Scales[0])

[<Fact>]
let ``stored child scaler yields five and seven without refitting`` () =
    let value = scaler [ row -1.0; row -0.5 ]
    Assert.Equal(-0.75, value.Means[0])
    Assert.Equal(0.25, value.Scales[0])
    for raw, expected in [ 0.5, 5.0; 1.0, 7.0 ] do
        let actual = L.tryTransform value (row raw)
        accepted actual.Outcome
        Assert.Equal(expected, actual.Values[0])
    Assert.Equal(-0.75, value.Means[0])

[<Fact>]
let ``raw training bound is not silently imposed on finite query features`` () =
    let value = { scaler [ row 0.0 ] with Scales = 32.0 :: List.replicate 7 1.0 }
    let transformed = L.tryTransform value (row 128.0)
    accepted transformed.Outcome
    Assert.Equal(4.0, transformed.Values[0])
    refused (L.tryFitPreprocessing hash [ row 128.0 ]).Outcome |> ignore

[<Fact>]
let ``late query range refusal retains processed prefix`` () =
    let value = scaler [ row 0.0 ]
    let transformed = L.tryTransform value (List.replicate 7 1.0 @ [ 9.0 ])
    refused transformed.Outcome |> ignore
    Assert.Equal<float list>(List.replicate 7 1.0, transformed.Values)

[<Fact>]
let ``training row hash count shape and finiteness are bounded`` () =
    for rows in [ []; List.replicate 257 (row 0.0); [ [] ]; [ row Double.NaN ]; Unchecked.defaultof<float list list> ] do
        refused (L.tryFitPreprocessing hash rows).Outcome |> ignore
    refused (L.tryFitPreprocessing "bad" [ row 0.0 ]).Outcome |> ignore
    let bad = { scaler [ row 0.0 ] with Scales = 0.0 :: List.replicate 7 1.0 }
    refused (L.tryTransform bad (row 0.0)).Outcome |> ignore

[<Fact>]
let ``artifact bytes bind all fields and signed zero without reflection`` () =
    let value = artifact ()
    let raw = L.tryEncodeArtifact value |> accepted
    Assert.True(raw.Length < L.ArtifactLimit)
    Assert.Equal(Convert.ToHexString(SHA256.HashData raw), L.tryVersion value |> accepted)
    use document = JsonDocument.Parse raw
    let names = document.RootElement.EnumerateObject() |> Seq.map (fun p -> p.Name) |> Seq.toList
    Assert.Equal<string list>([ "Architecture"; "Id"; "Parameters"; "ParentVersion"; "Ports"; "Preprocessing"; "SourceBindings"; "TrainingCut"; "UpdateReceiptSha256" ], names)
    let negativeZero = BitConverter.UInt64BitsToDouble(0x8000000000000000UL)
    let changed = { value with Parameters = value.Parameters |> List.mapi (fun i x -> if i = 56 then negativeZero else x) }
    Assert.NotEqual<string>(L.tryVersion value |> accepted, L.tryVersion changed |> accepted)
    Assert.Contains("8000000000000000", Encoding.UTF8.GetString(L.tryEncodeArtifact changed |> accepted))

[<Fact>]
let ``artifact semantic mutations refuse or change the complete version`` () =
    let value = artifact ()
    for bad in [ { value with Architecture = "other" }; { value with Ports = [ "required" ] }
                 { value with TrainingCut = String.replicate 64 "B" }
                 { value with Parameters = Double.NaN :: value.Parameters.Tail }
                 { value with SourceBindings = Map.empty } ] do
        refused (L.tryVersion bad) |> ignore
    let changed = { value with Ports = [ "required"; "optional" ] }
    Assert.NotEqual<string>(L.tryVersion value |> accepted, L.tryVersion changed |> accepted)

[<Fact>]
let ``artifact preallocation quota refuses a bounded large source map`` () =
    let source = [ for i in 0 .. 300 -> ("source/" + string i + String.replicate 190 "a", hash) ] |> Map.ofList
    let actual = L.tryEncodeArtifact { artifact () with SourceBindings = source }
    Assert.Equal("Budget", (refused actual).Code)

[<Fact>]
let ``dense admitted vector distinguishes every feature and child gradient`` () =
    let x = [ 0.25; -0.5; 0.75; -1.0; 1.25; -1.5; 1.75; -2.0; 2.25; -2.5; 1.0; 1.0 ]
    let old = initial |> List.mapi (fun i v -> if i >= 48 && i <= 51 then v + float (i - 47) / 128.0 else v)
    let actual = L.tryStep { Parameters = old; Inputs = x; Target = 0.625 }
    accepted actual.Outcome
    let activation h = List.fold2 (fun s w v -> s + w * v) old[48+h] old[12*h..12*h+11] x
    let hidden = [ for h in 0 .. 3 -> Math.Tanh(activation h) ]
    let prediction = List.fold2 (fun s w v -> s + w * v) old[56] old[52..55] hidden
    let e = prediction - 0.625
    let delta = [ for h in 0 .. 3 -> (e * old[52+h]) * (1.0-hidden[h]*hidden[h]) ]
    let expected =
        [ yield! [ for h in 0 .. 3 do for j in 0 .. 11 -> delta[h] * x[j] ]
          yield! delta
          yield! List.map (fun h -> e * h) hidden
          yield e ]
    Assert.Equal<float list>(expected, actual.Gradient)
    Assert.Equal<float list>(List.map2 (fun p g -> p-g/1024.0) old expected, actual.ProposedParameters)
    Assert.All(actual.Gradient, fun g -> Assert.NotEqual(0.0,g))
