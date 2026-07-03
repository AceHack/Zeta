module Zeta.Tests.IsaSpecTests

// THE ISA AS DATA — homoiconic instruction sets (shadow*, Aaron 2026-07-02: "what's next sonic
// mario" — 6502/68000, real console ISAs, reached as SPECS not hand-written interpreters). Proofs:
//   1. DIFFERENTIAL EQUIVALENCE — evalSpec chip8 p regs = Isa.eval p regs for every program (the
//      data-driven interpreter matches the hand-written one; Isa.eval is the oracle).
//   2. ISA IS BYTE-LOCKABLE DATA — the CHIP-8 spec rides the codec stack (json‖ + cbor cross-verify).
//   3. EXTENSION AS DATA — a brand-new opcode (SUB) added purely as a spec value runs under
//      evalSpec, while Isa.eval and the SUB-less spec reject it. Adding an instruction is data.
//
// Anchors: Futamura (dynarec = 1st projection); only-the-irreducible-is-primitive; CHIP-8/6502/68000.

open global.Xunit
open Zeta.Core

let private regsEq (a: Map<int, int>) (b: Map<int, int>) =
    [ 0..15 ]
    |> List.forall (fun r -> (Map.tryFind r a |> Option.defaultValue 0) = (Map.tryFind r b |> Option.defaultValue 0))

[<Fact>]
let ``DIFFERENTIAL EQUIVALENCE: evalSpec chip8 = Isa.eval on every program (control flow, folding, wrap)`` () =
    let cases: (DynamicValue * Map<int, int>) list =
        [ Isa.prog [ Isa.set 0 0; Isa.add 0 1; Isa.se 0 3; Isa.jp 1; Isa.halt ], Map.empty // loop with control flow
          Isa.prog [ Isa.add 0 3; Isa.addr 1 0; Isa.set 2 100; Isa.addr 2 1 ], Map.ofList [ 0, 10; 1, 5 ]
          Isa.prog [ Isa.set 0 5; Isa.mov 1 0; Isa.add 1 2; Isa.addr 3 1 ], Map.ofList [ 3, 7 ]
          Isa.prog [ Isa.set 5 200; Isa.add 5 100 ], Map.empty ] // 300 wraps to 44
    for (p, regs) in cases do
        match IsaSpec.evalSpec IsaSpec.chip8 p regs, Isa.eval p regs with
        | Ok specd, Ok hard -> Assert.True(regsEq specd hard, "spec-driven eval must match the hand-written interpreter")
        | a, b -> Assert.Fail(sprintf "eval mismatch/error: spec=%A hard=%A" a b)

[<Fact>]
let ``ISA IS BYTE-LOCKABLE DATA: the CHIP-8 spec rides the codec stack (json‖ + cbor cross-verify)`` () =
    Assert.Empty(ValueTreeCodec.crossVerify [ ValueTreeCodec.parity ValueTreeCodec.json; ValueTreeCodec.cbor ] IsaSpec.chip8)

[<Fact>]
let ``EXTENSION AS DATA: a new opcode SUB added purely as a spec value runs; the interpreter is untouched`` () =
    // extend CHIP-8 with SUB Vx Vy := Vx - Vy, entirely as data (reuse the existing ops).
    let chip8Ops =
        match DynamicValue.get "ops" IsaSpec.chip8 with
        | Some(DynamicValue.Array os) -> os
        | _ -> []
    let chip8PlusSub =
        IsaSpec.isa (
            chip8Ops
            @ [ IsaSpec.op "SUB" [ IsaSpec.setReg (IsaSpec.fld "x") (IsaSpec.subV (IsaSpec.reg (IsaSpec.fld "x")) (IsaSpec.reg (IsaSpec.fld "y"))) ] ]
        )
    let subInstr x y =
        DynamicValue.Object [ "op", DynamicValue.String "SUB"; "x", DynamicValue.Int(int64 x); "y", DynamicValue.Int(int64 y) ]
    let p = Isa.prog [ Isa.set 0 10; Isa.set 1 3; subInstr 0 1 ] // V0 := 10 - 3 = 7

    // the extended ISA runs it
    match IsaSpec.evalSpec chip8PlusSub p Map.empty with
    | Ok regs -> Assert.Equal(7, Map.tryFind 0 regs |> Option.defaultValue -1)
    | Error e -> Assert.Fail(sprintf "extended spec failed: %s" e)

    // the base ISA (no SUB) rejects it — SUB exists ONLY as the added data
    Assert.True(
        (match IsaSpec.evalSpec IsaSpec.chip8 p Map.empty with
         | Error _ -> true
         | Ok _ -> false),
        "base CHIP-8 spec must reject SUB"
    )
    // and the hand-written interpreter rejects it too
    Assert.True(
        (match Isa.eval p Map.empty with
         | Error _ -> true
         | Ok _ -> false),
        "Isa.eval must reject the unknown SUB op"
    )
