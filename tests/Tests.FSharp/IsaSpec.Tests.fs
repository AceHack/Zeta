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

// ── MEMORY EXTENSION + THE 6502 (a real, memory-bearing ISA as data) — shadow*, Aaron 2026-07-03
// "build whatever you like". The register-only core got an addressable store (mem/setmem); a real
// console CPU (6502 register + zero-page subset) is now expressible as data and runs under the SAME
// interpreter. Proofs:
//   4. BACKWARD-COMPAT — the memory extension did not disturb register-only ISAs (chip8 still = Isa.eval).
//   5. MEMORY ROUND-TRIP — a value stored to zero page and loaded back survives (store→load through mem).
//   6. THE 6502 RUNS A REAL PROGRAM WITH A LOOP THROUGH MEMORY — count a zero-page cell up to N.
//   7. THE 6502 SPEC IS BYTE-LOCKABLE DATA — a second ISA rides the codec stack.

[<Fact>]
let ``BACKWARD-COMPAT: the memory extension leaves register-only ISAs unchanged (chip8 = Isa.eval)`` () =
    let programs =
        [ Isa.prog [ Isa.set 0 5; Isa.add 0 200; Isa.addr 1 0; Isa.mov 2 1; Isa.halt ]
          Isa.prog [ Isa.set 3 10; Isa.se 3 10; Isa.set 3 99; Isa.halt ] ]
    for p in programs do
        match Isa.eval p Map.empty, IsaSpec.evalSpec IsaSpec.chip8 p Map.empty with
        | Ok r, Ok s -> Assert.True(regsEq r s, "chip8 spec diverged from Isa.eval after the memory extension")
        | _ -> Assert.Fail "eval/evalSpec disagreed"

[<Fact>]
let ``MEMORY ROUND-TRIP: a value stored to zero page and loaded back survives`` () =
    // A=42 ; mem[16]=A ; A=0 ; A=mem[16] ; X=A ; BRK  → A=42, X=42, mem[16]=42
    let p =
        DynamicValue.Array
            [ IsaSpec.ldaImm 42; IsaSpec.staZp 16; IsaSpec.ldaImm 0; IsaSpec.ldaZp 16; IsaSpec.tax; IsaSpec.brk ]
    match IsaSpec.evalSpecFull IsaSpec.mos6502 p Map.empty Map.empty with
    | Ok(regs, mem) ->
        Assert.Equal(42, Map.tryFind 0 regs |> Option.defaultValue 0) // A
        Assert.Equal(42, Map.tryFind 1 regs |> Option.defaultValue 0) // X
        Assert.Equal(42, Map.tryFind 16 mem |> Option.defaultValue 0) // mem[16]
    | Error e -> Assert.Fail(sprintf "6502 round-trip failed: %s" e)

[<Fact>]
let ``THE 6502 RUNS A REAL LOOP THROUGH MEMORY: count a zero-page cell up to N`` () =
    // mem[0]=0 ; loop@2: A=mem[0] ; A=A+1 ; mem[0]=A ; SKE A,target (skip JMP to exit) ; JMP loop ; BRK
    let program (target: int) =
        DynamicValue.Array
            [ IsaSpec.ldaImm 0 // @0: A = 0
              IsaSpec.staZp 0 // @1: mem[0] = 0
              IsaSpec.ldaZp 0 // @2: A = mem[0]      (loop head)
              IsaSpec.adcImm 1 // @3: A = A + 1
              IsaSpec.staZp 0 // @4: mem[0] = A
              IsaSpec.ske target // @5: if A == target, skip the JMP (exit)
              IsaSpec.jmp 2 // @6: else loop
              IsaSpec.brk ] // @7: stop
    for target in [ 1; 3; 10; 200 ] do
        match IsaSpec.evalSpecFull IsaSpec.mos6502 (program target) Map.empty Map.empty with
        | Ok(regs, mem) ->
            Assert.Equal(target, Map.tryFind 0 mem |> Option.defaultValue 0) // mem[0] counted up to target
            Assert.Equal(target, Map.tryFind 0 regs |> Option.defaultValue 0) // A holds the final count
        | Error e -> Assert.Fail(sprintf "6502 loop failed at target=%d: %s" target e)

[<Fact>]
let ``THE 6502 SPEC IS BYTE-LOCKABLE DATA: a second real ISA rides the codec stack`` () =
    Assert.Empty(ValueTreeCodec.crossVerify [ ValueTreeCodec.parity ValueTreeCodec.json; ValueTreeCodec.cbor ] IsaSpec.mos6502)

// ── the SPEC-DRIVEN MIX over the 6502 (the dynarec on a real, memory-bearing ISA) — shadow*,
// Aaron 2026-07-03 "build whatever you like". specializeMem folds static registers AND static
// zero-page memory. Proofs:
//   8. THE EXTENDED S-m-n LAW: evalSpecFull spec residual dynReg dynMem ⊕ (knownReg, knownMem)
//      = evalSpecFull spec p (static∪dyn) — the memory-aware mix is correct (differential).
//   9. SPECIALIZATION REDUCES: the residual is strictly shorter when there is static memory to fold.

// Overlay: the folded static map wins over the residual's dynamic result (folded cells/regs untouched).
let private overlay (known: Map<int, int>) (dyn: Map<int, int>) =
    Map.fold (fun m k v -> Map.add k v m) dyn known

[<Fact>]
let ``THE 6502 MIX obeys the extended S-m-n law over registers AND memory`` () =
    // A static; mem[20] dynamic. Static ops fold (incl. a static mem read); the dynamic ADC_ZP
    // and everything after it residualize.
    let p =
        DynamicValue.Array
            [ IsaSpec.staZp 10 // mem[10] = A          (A static → fold)
              IsaSpec.ldaZp 10 // A = mem[10]          (static cell → fold)
              IsaSpec.adcImm 5 // A = A + 5            (fold)
              IsaSpec.staZp 11 // mem[11] = A          (fold)
              IsaSpec.adcZp 20 // A = A + mem[20]      (mem[20] dynamic → A goes dynamic)
              IsaSpec.staZp 12 // mem[12] = A          (A dynamic → residualize)
              IsaSpec.brk ]
    let staticRegs = Map.ofList [ 0, 7 ] // A = 7 static
    let staticMem = Map.empty
    match IsaSpec.specializeMem IsaSpec.mos6502 IsaSpec.load6502 p staticRegs staticMem with
    | Ok(residual, knownReg, knownMem) ->
        for dynCell in [ 0; 1; 100; 250 ] do
            let dynReg = Map.empty
            let dynMem = Map.ofList [ 20, dynCell ]
            match IsaSpec.evalSpecFull IsaSpec.mos6502 residual dynReg dynMem with
            | Ok(rRegs, rMem) ->
                let gotRegs = overlay knownReg rRegs
                let gotMem = overlay knownMem rMem
                match IsaSpec.evalSpecFull IsaSpec.mos6502 p (overlay staticRegs dynReg) (overlay staticMem dynMem) with
                | Ok(fullRegs, fullMem) ->
                    Assert.Equal<Map<int, int>>(fullRegs, gotRegs)
                    Assert.Equal<Map<int, int>>(fullMem, gotMem)
                | Error e -> Assert.Fail(sprintf "full run failed: %s" e)
            | Error e -> Assert.Fail(sprintf "residual run failed: %s" e)
    | Error e -> Assert.Fail(sprintf "specializeMem failed: %s" e)

[<Fact>]
let ``THE 6502 MIX reduces: an all-static program folds to an empty residual`` () =
    // Everything static → the residual should carry no runtime work (all folded into known).
    let p = DynamicValue.Array [ IsaSpec.ldaImm 10; IsaSpec.staZp 5; IsaSpec.adcImm 3; IsaSpec.staZp 6; IsaSpec.brk ]
    match IsaSpec.specializeMem IsaSpec.mos6502 IsaSpec.load6502 p Map.empty Map.empty with
    | Ok(residual, knownReg, knownMem) ->
        (match residual with
         | DynamicValue.Array xs -> Assert.Empty xs // fully folded — no residual instructions
         | _ -> Assert.Fail "residual not an array")
        Assert.Equal(13, Map.tryFind 0 knownReg |> Option.defaultValue 0) // A = 10 + 3
        Assert.Equal(10, Map.tryFind 5 knownMem |> Option.defaultValue 0) // mem[5] = 10
        Assert.Equal(13, Map.tryFind 6 knownMem |> Option.defaultValue 0) // mem[6] = 13
    | Error e -> Assert.Fail(sprintf "specializeMem failed: %s" e)
