module Zeta.Tests.SoftSessionTests

open global.Xunit
open Zeta.Core

// deterministic arithmetic ROM (no input opcodes) — drives without freezing, control inert
let private arith = [| 0x6Auy; 0x05uy; 0x7Auy; 0x03uy; 0x60uy; 0x02uy; 0x8Auy; 0x04uy; 0x12uy; 0x00uy |]

[<Fact>]
let ``play returns a Tick per frame`` () =
    let trace = SoftSession.play 8 2 2 4 6 42UL arith
    Assert.Equal(6, List.length trace)
    Assert.Equal<int list>([ 1; 2; 3; 4; 5; 6 ], trace |> List.map (fun t -> t.Frame))

[<Fact>]
let ``play is deterministic (DST): same seed+rom -> identical trace`` () =
    let a = SoftSession.play 8 2 2 4 5 7UL arith
    let b = SoftSession.play 8 2 2 4 5 7UL arith
    Assert.Equal<int list>(a |> List.map (fun t -> t.PC), b |> List.map (fun t -> t.PC))
    Assert.Equal<int list>(a |> List.map (fun t -> t.Key), b |> List.map (fun t -> t.Key))

[<Fact>]
let ``playToFrame agrees with the last Tick's PC`` () =
    let trace = SoftSession.play 8 2 2 4 5 7UL arith
    let final = SoftSession.playToFrame 8 2 2 4 5 7UL arith
    Assert.Equal((List.last trace).PC, int final.PC)

[<Fact>]
let ``digest summarizes a run and handles empty`` () =
    Assert.Equal("empty session", SoftSession.digest [])
    let d = SoftSession.digest (SoftSession.play 8 2 2 4 3 7UL arith)
    Assert.Contains("frames=3", d)
    Assert.Contains("PC=0x", d)

[<Fact>]
let ``empowerment is reported non-negative across the trace`` () =
    let trace = SoftSession.play 8 2 2 4 4 7UL arith
    Assert.All(trace, fun t -> Assert.True(t.Empowerment >= 0.0))
