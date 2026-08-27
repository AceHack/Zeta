module Zeta.Tests.ChannelGrant

open System.Reflection
open Xunit
open Zeta.Core

let private ok result =
    match result with
    | Ok value -> value
    | Error feedback -> failwithf "expected Ok, got %A" feedback

let private apparatus () =
    ChannelSet.tryCreate
        [ { Channel = "ram"
            Direction = ChannelDirection.Write
            StartAddress = 0x300
            EndAddress = 0x3FF }
          { Channel = "ram"
            Direction = ChannelDirection.Read
            StartAddress = 0x200
            EndAddress = 0xFFF } ]
    |> ok

let private runKey label =
    Chip8CrossRunStore.runKey [| 0x12uy; 0x00uy |] 4UL 0x200 "chip8" label

let private grant () =
    let channels = apparatus ()
    let label = channels |> ChannelSet.runLabel |> ok
    let issuer = ExperimenterId.tryCreate "arc-harness" |> ok
    ChannelGrantHarness.issue issuer (runKey label) channels |> ok

[<Fact>]
let ``channel set canonicalizes the complete apparatus independent of declaration order`` () =
    let first = apparatus ()
    let second = first |> ChannelSet.specs |> List.rev |> ChannelSet.tryCreate |> ok
    let firstLabel = first |> ChannelSet.runLabel |> ok |> Chip8CrossRunStore.RunChannelLabel.value
    let secondLabel = second |> ChannelSet.runLabel |> ok |> Chip8CrossRunStore.RunChannelLabel.value

    Assert.Equal("assisted:ram-read@0200-0fff,ram-write@0300-03ff", firstLabel)
    Assert.Equal(firstLabel, secondLabel)

[<Fact>]
let ``grant constructor is not public and a clean run key cannot hide open channels`` () =
    let publicConstructors = typeof<ChannelGrant>.GetConstructors(BindingFlags.Public ||| BindingFlags.Instance)
    Assert.Empty publicConstructors

    let result =
        ChannelGrantHarness.issue
            (ExperimenterId.tryCreate "arc-harness" |> ok)
            (runKey Chip8CrossRunStore.RunChannelLabel.clean)
            (apparatus ())

    match result with
    | Error(RunKeyChannelMismatch(expected, actual)) ->
        Assert.Equal("assisted:ram-read@0200-0fff,ram-write@0300-03ff", expected)
        Assert.Equal("clean", actual)
    | other -> failwithf "expected channel mismatch, got %A" other

[<Fact>]
let ``meter counts read and write crossings on separate rows`` () =
    let issued = grant ()

    let meter =
        ChannelMeter.zero issued
        |> ChannelMeter.cross issued "ram" ChannelDirection.Read 0x200
        |> Result.bind (ChannelMeter.cross issued "ram" ChannelDirection.Write 0x300)
        |> Result.bind (ChannelMeter.crossRange issued "ram" ChannelDirection.Read 0x201 0x203)
        |> ok

    let snapshot = ChannelMeter.snapshot issued meter
    Assert.Equal("arc-harness", snapshot.IssuedBy)
    Assert.Contains("channel=" + snapshot.ChannelLabel, snapshot.RunKey)
    Assert.Equal<int64 list>([ 4L; 1L ], snapshot.Rows |> List.map _.Crossings)

[<Fact>]
let ``ungranted range refuses atomically`` () =
    let issued = grant ()
    let zero = ChannelMeter.zero issued

    match ChannelMeter.crossRange issued "ram" ChannelDirection.Write 0x3FF 0x400 zero with
    | Error(CrossingNotGranted("ram", ChannelDirection.Write, 0x400)) -> ()
    | other -> failwithf "expected crossing refusal, got %A" other

    let snapshot = ChannelMeter.snapshot issued zero
    Assert.All(snapshot.Rows, fun row -> Assert.Equal(0L, row.Crossings))

[<Fact>]
let ``overlapping declarations are refused`` () =
    let result =
        ChannelSet.tryCreate
            [ { Channel = "ram"
                Direction = ChannelDirection.Read
                StartAddress = 0x200
                EndAddress = 0x300 }
              { Channel = "ram"
                Direction = ChannelDirection.Read
                StartAddress = 0x280
                EndAddress = 0x400 } ]

    match result with
    | Error(OverlappingChannelRanges("ram", ChannelDirection.Read)) -> ()
    | other -> failwithf "expected overlap refusal, got %A" other
