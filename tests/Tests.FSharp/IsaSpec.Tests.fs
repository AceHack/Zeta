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

let private union (s: Map<int, int>) (d: Map<int, int>) =
    Map.fold (fun m k v -> Map.add k v m) s d

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

// ── spec-driven `mix`: partial evaluation over ANY ISA-as-data ──

let private chip8PlusSub =
    let ops =
        match DynamicValue.get "ops" IsaSpec.chip8 with
        | Some(DynamicValue.Array os) -> os
        | _ -> []
    IsaSpec.isa (
        ops
        @ [ IsaSpec.op "SUB" [ IsaSpec.setReg (IsaSpec.fld "x") (IsaSpec.subV (IsaSpec.reg (IsaSpec.fld "x")) (IsaSpec.reg (IsaSpec.fld "y"))) ] ]
    )

let private subInstr x y =
    DynamicValue.Object [ "op", DynamicValue.String "SUB"; "x", DynamicValue.Int(int64 x); "y", DynamicValue.Int(int64 y) ]

[<Fact>]
let ``SPEC-DRIVEN MIX (S-m-n, ISA-parametric): evalSpec spec (residual) dyn ⊕ known = evalSpec spec p (static ∪ dyn)`` () =
    // straight-line cases over CHIP-8; specialize is now driven purely by the spec + Isa.set as loadImm.
    let cases: (DynamicValue * Map<int, int> * Map<int, int>) list =
        [ Isa.prog [ Isa.add 0 3; Isa.addr 1 0; Isa.set 2 100; Isa.addr 2 1 ], Map.ofList [ 0, 10 ], Map.ofList [ 1, 5 ]
          Isa.prog [ Isa.set 0 5; Isa.mov 1 0; Isa.add 1 2; Isa.addr 3 1 ], Map.empty, Map.ofList [ 3, 7 ]
          Isa.prog [ Isa.set 0 8; Isa.addr 0 1 ], Map.empty, Map.ofList [ 1, 3 ] ]
    for (p, statics, dynamics) in cases do
        let full = IsaSpec.evalSpec IsaSpec.chip8 p (union statics dynamics)
        match IsaSpec.specialize IsaSpec.chip8 Isa.set p statics, full with
        | Ok(residual, known), Ok fullRegs ->
            match IsaSpec.evalSpec IsaSpec.chip8 residual dynamics with
            | Ok specd -> Assert.True(regsEq (union known specd) fullRegs, "spec-driven mix law must hold")
            | Error e -> Assert.Fail(sprintf "evalSpec residual failed: %s" e)
        | Error e, _
        | _, Error e -> Assert.Fail(sprintf "setup failed: %s" e)

[<Fact>]
let ``SPEC-DRIVEN MIX is ISA-parametric: it specializes a program in the EXTENDED (SUB) ISA correctly`` () =
    // SUB was added purely as data; `mix` handles it with no interpreter/specializer change.
    let p = Isa.prog [ Isa.set 0 20; subInstr 0 1 ] // V0 := 20 ; V0 := V0 - V1   (V1 dynamic)
    let statics = Map.empty
    let dynamics = Map.ofList [ 1, 6 ] // ⇒ V0 = 20 - 6 = 14
    let full = IsaSpec.evalSpec chip8PlusSub p (union statics dynamics)
    match IsaSpec.specialize chip8PlusSub Isa.set p statics, full with
    | Ok(residual, known), Ok fullRegs ->
        match IsaSpec.evalSpec chip8PlusSub residual dynamics with
        | Ok specd -> Assert.True(regsEq (union known specd) fullRegs, "mix law must hold on the extended ISA")
        | Error e -> Assert.Fail(sprintf "evalSpec residual failed: %s" e)
    | Error e, _
    | _, Error e -> Assert.Fail(sprintf "setup failed: %s" e)

[<Fact>]
let ``SPEC-DRIVEN MIX: rejects control flow (straight-line fragment only)`` () =
    let withJp = Isa.prog [ Isa.set 0 1; Isa.jp 0 ]
    Assert.True(
        (match IsaSpec.specialize IsaSpec.chip8 Isa.set withJp Map.empty with
         | Error _ -> true
         | Ok _ -> false),
        "JP (control flow) must be rejected"
    )
