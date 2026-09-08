module Zeta.Bayesian.Tests.MixedMessageEpochTests

open System
open System.Text
open System.Text.Json
open Xunit
open Zeta.Bayesian

module E = MixedMessageEpoch

let private accepted = function Ok x -> x | Error e -> failwithf "Unexpected refusal: %A" e
let private refused = function Error x -> x | Ok e -> failwithf "Unexpected acceptance: %A" e
let private raw (s: string) = Encoding.UTF8.GetBytes s

[<Fact>]
let ``canonical payload keeps CLR plus and HTML literal`` () =
    let expected = "{\"Html\":\"<>&'+`\",\"Type\":\"Zeta.Bayesian.BoundedModuleLearner+StepAttempt\"}"
    let supplied = "{ \"Type\": \"Zeta.Bayesian.BoundedModuleLearner\\u002bStepAttempt\", \"Html\":\"<>&'+`\" }"
    Assert.Equal<byte[]>(raw expected, E.tryCanonicalPayload (raw supplied) 65536 |> accepted)

[<Fact>]
let ``canonical payload uses minimal scalar escapes and UTF8`` () =
    let expected = "{\"Value\":\"\\\"\\\\\\b\\t\\n\\f\\r\\u0000\\u001f/é😀\u2028\u2029\"}"
    let supplied = "{\"Value\":\"\\u0022\\u005c\\u0008\\u0009\\u000a\\u000c\\u000d\\u0000\\u001f\\/\\u00e9\\ud83d\\ude00\\u2028\\u2029\"}"
    Assert.Equal<byte[]>(raw expected, E.tryCanonicalPayload (raw supplied) 65536 |> accepted)

[<Fact>]
let ``all control scalars use the fixed lowercase canonical grammar`` () =
    let escapes = [ for i in 0 .. 31 -> "\\u" + i.ToString("x4",Globalization.CultureInfo.InvariantCulture) ] |> String.concat ""
    let expected =
        [ for i in 0 .. 31 ->
            match i with
            | 8 -> "\\b" | 9 -> "\\t" | 10 -> "\\n" | 12 -> "\\f" | 13 -> "\\r"
            | _ -> "\\u" + i.ToString("x4",Globalization.CultureInfo.InvariantCulture) ] |> String.concat ""
    Assert.Equal<byte[]>(raw ("[\""+expected+"\"]"), E.tryCanonicalPayload (raw ("[\""+escapes+"\"]")) 65536 |> accepted)

[<Fact>]
let ``canonical core JSON refuses duplicate float nonfinite and isolated surrogate`` () =
    for bad in [ "{\"x\":1,\"x\":2}"; "[1.0]"; "[NaN]"; "[1e999]"; "[\"\\ud800\"]"; "{\"é\":1}" ] do
        E.tryCanonicalPayload (raw bad) 65536 |> refused |> ignore
    E.tryCanonicalPayload [| 0xffuy |] 65536 |> refused |> ignore

[<Fact>]
let ``canonical byte allowance is measured exactly before emission`` () =
    let expected = raw "{\"a\":\"+\",\"b\":3}"
    Assert.Equal<byte[]>(expected,E.tryCanonicalPayload expected expected.Length |> accepted)
    E.tryCanonicalPayload expected (expected.Length-1) |> refused |> ignore

[<Fact>]
let ``ordinary null core records return typed encoder failures`` () =
    E.tryEncodePlan Unchecked.defaultof<E.EpochPlan> |> refused |> ignore
    E.tryEncodeState Unchecked.defaultof<E.State> |> refused |> ignore
    E.tryEncodeObservation Unchecked.defaultof<E.Observation> 65536 |> refused |> ignore
    E.tryEncodeCheckpoint Unchecked.defaultof<E.Checkpoint> 65536 |> refused |> ignore
    E.tryEncodeCommit Unchecked.defaultof<E.Commit> 65536 |> refused |> ignore
    E.tryEncodeProjectionResponse Unchecked.defaultof<E.ProjectionResponse> |> refused |> ignore
    let actual = E.tryEncode Unchecked.defaultof<E.EpochResult> 65536 |> refused
    Assert.Null(box actual.Result)

[<Fact>]
let ``malformed passive JSON remains a typed publication failure`` () =
    let observation: E.Observation =
        { Sequence=1;Operation=E.NeuralForward("node",0);InputRevision=0L
          Inputs=E.RawInputs Unchecked.defaultof<JsonElement>;Call=E.NotEntered;Proposal=None
          Admission=None;AppliedRevision=None;Failure=None }
    let actual = E.tryEncodeObservation observation 65536 |> refused
    Assert.Equal("Admission",actual.Code)

[<Fact>]
let ``wire snapshot bool cannot stand in for an integer`` () =
    let supplied = "{\"SnapshotIndex\":true}"
    E.tryDecodeBudgetSnapshot (raw supplied) |> refused |> ignore

[<Fact>]
let ``zero output allowance refuses before examining invalid passive input`` () =
    let observation: E.Observation =
        { Sequence=1;Operation=E.NeuralForward("node",0);InputRevision=0L
          Inputs=E.RawInputs Unchecked.defaultof<JsonElement>;Call=E.NotEntered;Proposal=None
          Admission=None;AppliedRevision=None;Failure=None }
    let failure = E.tryEncodeObservation observation 0 |> refused
    Assert.Equal(Some "encoding",failure.Field)
    Assert.Contains("before source traversal",failure.Message)

[<Fact>]
let ``tiny allowance stops before a malformed late passive scalar`` () =
    let encoded = "[" + String.concat "," (List.replicate 256 "\"small\"" @ ["\"\\ud800\""]) + "]"
    use document = JsonDocument.Parse encoded
    let observation: E.Observation =
        { Sequence=1;Operation=E.NeuralForward("node",0);InputRevision=0L
          Inputs=E.RawInputs(document.RootElement.Clone());Call=E.NotEntered;Proposal=None
          Admission=None;AppliedRevision=None;Failure=None }
    let failure = E.tryEncodeObservation observation 128 |> refused
    Assert.Equal(Some "encoding",failure.Field)
    Assert.Contains("allowance",failure.Message)

[<Fact>]
let ``canonical bytes match the independently captured Python golden`` () =
    let controls = [ for i in 0 .. 31 -> "\\u"+i.ToString("x4",Globalization.CultureInfo.InvariantCulture) ] |> String.concat ""
    let supplied = "{\"Type\":\"Zeta.Bayesian.BoundedModuleLearner+StepAttempt\",\"Text\":\"<>&\\\"\\\\/\\u00e9\\ud83d\\ude00\\u2028\\u2029\",\"Controls\":\""+controls+"\"}"
    let canonical = E.tryCanonicalPayload (raw supplied) 65536 |> accepted
    Assert.Equal(273,canonical.Length)
    let actualHash = Convert.ToHexString(Security.Cryptography.SHA256.HashData canonical)
    Assert.Equal("BEB199B5B256A3735BC238BA0801493F271D5A7AC028254F6CDA06E5DE2E10F8",actualHash)

[<Fact>]
let ``zero allowance precedes full result source traversal`` () =
    let malformed = Unchecked.defaultof<E.EpochResult>
    let full = E.tryEncode malformed 0 |> refused
    Assert.Null(box full.Result)
    Assert.Equal(Some "encoding",full.Failure.Field)
    Assert.Contains("before source traversal",full.Failure.Message)

[<Fact>]
let ``zero allowance precedes terminal source traversal`` () =
    let terminal = E.tryEncodeTerminal Unchecked.defaultof<E.EpochResult> Unchecked.defaultof<E.TerminalPublication> 0 |> refused
    Assert.Equal(Some "encoding",terminal.Field)
    Assert.Contains("before source traversal",terminal.Message)
