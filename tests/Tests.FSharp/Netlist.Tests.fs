module Zeta.Tests.NetlistTests

// COLUMN B, RUNG 1 — computation as gates (shadow*, Aaron 2026-07-02: "how do we make this general
// and intrinsic hardware?"). The residual-target knob turned to silicon. Proofs:
//   1. GATE BASICS — and/or/xor/not evaluate their truth tables.
//   2. ADDER = ADDITION (EXHAUSTIVE) — the 8-bit ripple-carry adder equals (a+b) mod 256 for ALL
//      65 536 byte pairs. The circuit IS the arithmetic.
//   3. NETLIST IS BYTE-LOCKABLE DATA — a circuit rides the codec stack (json‖ + cbor cross-verify).
//   4. BRIDGE TO THE ISA — the adder computes exactly what Isa ADD does (byte wrap), so ISA
//      arithmetic lowers to gates: the first thread from Column A (code) to Column B (circuit).
//
// Anchors: Shannon (1937, boolean algebra = circuits); ripple-carry full-adder; Lava/Chisel.

open global.Xunit
open Zeta.Core

let private merge (a: Map<string, int>) (b: Map<string, int>) =
    Map.fold (fun m k v -> Map.add k v m) a b

[<Fact>]
let ``GATE BASICS: and/or/xor/not evaluate their truth tables`` () =
    let c =
        Netlist.circuit
            [ "a"; "b" ]
            [ "and"; "or"; "xor"; "nota" ]
            [ Netlist.andG "and" "a" "b"
              Netlist.orG "or" "a" "b"
              Netlist.xorG "xor" "a" "b"
              Netlist.notG "nota" "a" ]
    for a in 0..1 do
        for b in 0..1 do
            match Netlist.eval c (Map.ofList [ "a", a; "b", b ]) with
            | Ok o ->
                Assert.Equal((if a = 1 && b = 1 then 1 else 0), o.["and"])
                Assert.Equal((if a = 1 || b = 1 then 1 else 0), o.["or"])
                Assert.Equal(a ^^^ b, o.["xor"])
                Assert.Equal(1 - a, o.["nota"])
            | Error e -> Assert.Fail(sprintf "eval failed: %s" e)

[<Fact>]
let ``ADDER = ADDITION (EXHAUSTIVE): the 8-bit gate adder equals (a+b) mod 256 for all 65536 pairs`` () =
    let add8 = Netlist.adder 8
    for a in 0..255 do
        for b in 0..255 do
            let inputs = merge (Netlist.bitsOf "a" 8 a) (Netlist.bitsOf "b" 8 b)
            match Netlist.eval add8 inputs with
            | Ok outs -> Assert.Equal((a + b) % 256, Netlist.intOf "s" 8 outs)
            | Error e -> Assert.Fail(sprintf "adder eval failed at a=%d b=%d: %s" a b e)

[<Fact>]
let ``NETLIST IS BYTE-LOCKABLE DATA: a circuit rides the codec stack (json‖ + cbor cross-verify)`` () =
    Assert.Empty(ValueTreeCodec.crossVerify [ ValueTreeCodec.parity ValueTreeCodec.json; ValueTreeCodec.cbor ] (Netlist.adder 8))

[<Fact>]
let ``BRIDGE TO THE ISA: the gate adder computes exactly what Isa ADD does (byte wrap)`` () =
    // Isa program: V0 := a ; V0 += b   ⇒   V0 = (a+b) mod 256, the same as the adder circuit.
    let add8 = Netlist.adder 8
    for (a, b) in [ (0, 0); (1, 1); (200, 100); (255, 1); (127, 200); (250, 250) ] do
        let viaIsa =
            match Isa.eval (Isa.prog [ Isa.set 0 a; Isa.add 0 b ]) Map.empty with
            | Ok regs -> Map.tryFind 0 regs |> Option.defaultValue 0
            | Error _ -> -1
        let viaGates =
            match Netlist.eval add8 (merge (Netlist.bitsOf "a" 8 a) (Netlist.bitsOf "b" 8 b)) with
            | Ok outs -> Netlist.intOf "s" 8 outs
            | Error _ -> -2
        Assert.Equal(viaIsa, viaGates)
