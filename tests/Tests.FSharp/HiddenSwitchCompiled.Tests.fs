namespace Zeta.Tests

open System
open Xunit
open Zeta.Core
open Zeta.Research

module HiddenSwitchCompiledTests =
    let private get = function Ok value -> value | Error reason -> failwithf "unexpected refusal: %A" reason

    [<Fact>]
    let ``choice output is exactly the registered little endian record`` () =
        let value: HiddenSwitchCompiledReceipt.ChoiceWork =
            { Action = 1uy; Path = 4uy; GuardComparisons = 0x01020304u; RecursiveCalls = 0x05060708u
              Nodes = 0x09101112u; ActionValues = 0x13141516u; Predictions = 0x17181920u; Updates = 0x21222324u }
        let buffer = Array.create 34 0xAAuy
        HiddenSwitchCompiledReceipt.writeChoice buffer 3 value |> get
        Assert.Equal("AAAAAA01040000040302010807060512111009161514132019181724232221AAAAAA", Convert.ToHexString buffer)
        let before = Array.copy buffer
        Assert.True(HiddenSwitchCompiledReceipt.writeChoice buffer 7 value |> Result.isError)
        Assert.True(HiddenSwitchCompiledReceipt.writeChoice buffer 3 { value with Path = 5uy } |> Result.isError)
        Assert.True(HiddenSwitchCompiledReceipt.writeChoice buffer 3 { value with Action = 2uy } |> Result.isError)
        Assert.True((before = buffer))

    [<Fact>]
    let ``binary64 wire preserves zero signs and subnormal bits and refuses invalid values`` () =
        for expected in ["8000000000000000"; "0000000000000000"; "0000000000000001"; "000FFFFFFFFFFFFF"; "0010000000000000"] do
            let value = HiddenSwitchCompiledReceipt.parseFiniteBits expected |> get
            Assert.Equal(expected, HiddenSwitchCompiledReceipt.bits value)
        for invalid in [null; ""; "000fffffffffffff"; "7FF0000000000000"; "FFF0000000000000"; "7FF8000000000000"] do
            Assert.True(HiddenSwitchCompiledReceipt.parseFiniteBits invalid |> Result.isError)

    [<Fact>]
    let ``native action only wrapper retains the actual depth three work`` () =
        let choice = HiddenSwitchCompiledPolicy.native true 0.25 3 |> get
        Assert.Equal(1uy, choice.Action)
        Assert.Equal(0uy, choice.Path)
        Assert.Equal(0u, choice.GuardComparisons)
        Assert.Equal(1u, choice.RecursiveCalls)
        Assert.Equal(21u, choice.Nodes)
        Assert.Equal(42u, choice.ActionValues)
        Assert.Equal(10u, choice.Predictions)
        Assert.Equal(20u, choice.Updates)
        for belief, depth in [Double.NaN, 3; Double.PositiveInfinity, 3; -0.1, 3; 1.1, 3; 0.5, 0; 0.5, 4] do
            Assert.True(HiddenSwitchCompiledPolicy.native true belief depth |> Result.isError)

    let private projection cue : GameEnvironment.Frame =
        let cells = Array.zeroCreate<byte> 2048
        cells.[8 * 64 + (if cue = 0 then 16 else 48)] <- 1uy
        { W = 64; H = 32; Palette = 2; Cells = cells }

    [<Fact>]
    let ``common adapter commits before feedback and keeps scalar snapshot after caller mutation`` () =
        let initial = HiddenSwitchCompiledPolicy.create true "dot" |> get
        Assert.True(HiddenSwitchCompiledPolicy.chooseNative initial |> Result.isError)
        let frame = projection 0
        let _, observed = HiddenSwitchCompiledPolicy.observe frame initial |> get
        let before = HiddenSwitchCompiledPolicy.snapshot observed
        Array.fill frame.Cells 0 frame.Cells.Length 1uy
        Assert.Equal(before, HiddenSwitchCompiledPolicy.snapshot observed)
        Assert.True(HiddenSwitchCompiledPolicy.observe (projection 1) observed |> Result.isError)
        let choice, committed = HiddenSwitchCompiledPolicy.chooseNative observed |> get
        Assert.Equal(1uy, choice.Action)
        Assert.True(HiddenSwitchCompiledPolicy.chooseNative committed |> Result.isError)
        let _, next = HiddenSwitchCompiledPolicy.observe (projection 0) committed |> get
        let after = HiddenSwitchCompiledPolicy.snapshot next
        Assert.Equal(2, after.Observed)
        Assert.Equal(-1, after.PendingAction)
        Assert.Equal(1, after.FilterCounters.Predictions)
        Assert.Equal(2, after.FilterCounters.Updates)
        let old = HiddenSwitchPolicy.create "belief-depth3" true "dot" |> get
        let _, oldObserved = HiddenSwitchPolicy.observe (projection 0) old |> get
        let _, oldCommitted = HiddenSwitchPolicy.choose oldObserved |> get
        let _, oldNext = HiddenSwitchPolicy.observe (projection 0) oldCommitted |> get
        Assert.Equal(HiddenSwitchCompiledReceipt.bits (HiddenSwitchPolicy.belief oldNext), after.BeliefBits)

    [<Fact>]
    let ``both services use the same complete observe choose commit chronology`` () =
        let bindings = Map.ofList ["ProtocolSha256", "8BBDFE44A0844DD8CE4F6C5DD77B060A56E5B84EA94EA7A6FDBB482AEC9D738A"; "hand-validation", String.replicate 64 "0"]
        let raw = HiddenSwitchCompiledCertificate.build bindings |> get
        let guards = HiddenSwitchCompiledCertificate.verify raw bindings |> get |> HiddenSwitchCompiledCertificate.guards
        let mutable native = HiddenSwitchCompiledPolicy.create true "dot" |> get
        let mutable compiled = HiddenSwitchCompiledPolicy.create true "dot" |> get
        for time in 0 .. 16 do
            let frame = projection (time % 2)
            native <- HiddenSwitchCompiledPolicy.observe frame native |> get |> snd
            compiled <- HiddenSwitchCompiledPolicy.observe frame compiled |> get |> snd
            Assert.Equal(HiddenSwitchCompiledPolicy.snapshot native, HiddenSwitchCompiledPolicy.snapshot compiled)
            if time < 16 then
                let first, nextNative = HiddenSwitchCompiledPolicy.chooseWith HiddenSwitchCompiledPolicy.native native |> get
                let second, nextCompiled = HiddenSwitchCompiledPolicy.chooseWith (HiddenSwitchCompiledSelector.choose guards) compiled |> get
                Assert.Equal(first.Action, second.Action)
                Assert.True(HiddenSwitchCompiledPolicy.observe frame compiled |> Result.isError)
                native <- nextNative
                compiled <- nextCompiled
        Assert.True(HiddenSwitchCompiledPolicy.chooseWith HiddenSwitchCompiledPolicy.native native |> Result.isError)
        Assert.True(HiddenSwitchCompiledPolicy.chooseWith (HiddenSwitchCompiledSelector.choose guards) compiled |> Result.isError)
