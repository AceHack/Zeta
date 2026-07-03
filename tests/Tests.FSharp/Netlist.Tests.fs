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

// ── COLUMN B, RUNG 2 — ISA → circuit synthesis: a whole straight-line program becomes ONE circuit ──

let private regsEq (a: Map<int, int>) (b: Map<int, int>) =
    [ 0..15 ]
    |> List.forall (fun r -> (Map.tryFind r a |> Option.defaultValue 0) = (Map.tryFind r b |> Option.defaultValue 0))

[<Fact>]
let ``SYNTHESIS = INTERPRETER: a synthesized circuit computes exactly what Isa.eval does (all registers)`` () =
    let cases: (DynamicValue * Map<int, int>) list =
        [ Isa.prog [ Isa.set 0 10; Isa.set 1 5; Isa.addr 2 0; Isa.addr 2 1 ], Map.empty // V2 = 15
          Isa.prog [ Isa.set 0 200; Isa.add 0 100 ], Map.empty // V0 = 44 (wrap)
          Isa.prog [ Isa.mov 3 5; Isa.add 3 1 ], Map.ofList [ 5, 7 ] // V3 = 8 from input V5
          Isa.prog [ Isa.set 0 250; Isa.set 1 250; Isa.addr 0 1 ], Map.empty // 244 (wrap)
          Isa.prog [ Isa.add 0 3; Isa.addr 1 0; Isa.addr 1 0 ], Map.ofList [ 0, 10; 1, 1 ] ] // pass-through + arith
    for (p, regs) in cases do
        match Netlist.synthesize p with
        | Ok(c, outMap) ->
            match Netlist.eval c (Netlist.regInputs regs) with
            | Ok wires ->
                let viaGates = Netlist.regOutputs outMap wires
                let viaIsa =
                    match Isa.eval p regs with
                    | Ok r -> r
                    | Error e -> failwithf "isa eval failed: %s" e
                Assert.True(regsEq viaGates viaIsa, "the synthesized circuit must match the interpreter on every register")
            | Error e -> Assert.Fail(sprintf "circuit eval failed: %s" e)
        | Error e -> Assert.Fail(sprintf "synthesize failed: %s" e)

[<Fact>]
let ``SYNTHESIS produces ONE byte-lockable circuit (rides the codec stack)`` () =
    match Netlist.synthesize (Isa.prog [ Isa.set 0 10; Isa.addr 1 0; Isa.add 1 5 ]) with
    | Ok(c, _) -> Assert.Empty(ValueTreeCodec.crossVerify [ ValueTreeCodec.parity ValueTreeCodec.json; ValueTreeCodec.cbor ] c)
    | Error e -> Assert.Fail(sprintf "synthesize failed: %s" e)

[<Fact>]
let ``SYNTHESIS rejects control flow (needs sequential logic — a later rung)`` () =
    Assert.True(
        (match Netlist.synthesize (Isa.prog [ Isa.set 0 1; Isa.jp 0 ]) with
         | Error _ -> true
         | Ok _ -> false),
        "JP must be rejected by combinational synthesis"
    )

// ── ALU completion: SUB / bitwise / compare, each proven exhaustively ──

let private runAB (c: DynamicValue) (a: int) (b: int) =
    Netlist.eval c (merge (Netlist.bitsOf "a" 8 a) (Netlist.bitsOf "b" 8 b))

[<Fact>]
let ``SUBTRACTOR = SUBTRACTION (EXHAUSTIVE): the 8-bit gate subtractor equals (a-b) mod 256 for all pairs`` () =
    let sub8 = Netlist.subtractor 8
    for a in 0..255 do
        for b in 0..255 do
            match runAB sub8 a b with
            | Ok outs -> Assert.Equal((((a - b) % 256) + 256) % 256, Netlist.intOf "s" 8 outs)
            | Error e -> Assert.Fail(sprintf "sub eval failed at a=%d b=%d: %s" a b e)

[<Fact>]
let ``BITWISE = BITWISE (EXHAUSTIVE): and/or/xor gate circuits equal the byte operations`` () =
    let andC = Netlist.bitwise "and" 8
    let orC = Netlist.bitwise "or" 8
    let xorC = Netlist.bitwise "xor" 8
    for a in 0..255 do
        for b in 0..255 do
            match runAB andC a b, runAB orC a b, runAB xorC a b with
            | Ok oa, Ok oo, Ok ox ->
                Assert.Equal(a &&& b, Netlist.intOf "s" 8 oa)
                Assert.Equal(a ||| b, Netlist.intOf "s" 8 oo)
                Assert.Equal(a ^^^ b, Netlist.intOf "s" 8 ox)
            | _ -> Assert.Fail(sprintf "bitwise eval failed at a=%d b=%d" a b)

[<Fact>]
let ``COMPARATOR = EQUALITY (EXHAUSTIVE): eq = 1 iff a == b for all byte pairs`` () =
    let eqC = Netlist.equal 8
    for a in 0..255 do
        for b in 0..255 do
            match runAB eqC a b with
            | Ok outs -> Assert.Equal((if a = b then 1 else 0), Map.tryFind "eq" outs |> Option.defaultValue -1)
            | Error e -> Assert.Fail(sprintf "eq eval failed at a=%d b=%d: %s" a b e)
