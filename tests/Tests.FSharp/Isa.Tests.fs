module Zeta.Tests.IsaTests

// UNIVERSAL ISA INTERPRETER + THE FIRST GENERAL `mix` (shadow*, Aaron 2026-07-02: "how do we make
// this general and intrinsic hardware?" — the pivot rung). Proofs:
//   1. EVAL RUNS — the interpreter executes a program with control flow (SE/JP/HALT loop) correctly.
//   2. MIX CORRECTNESS (Kleene S-m-n / Futamura mix law) — for a straight-line p and a static/dynamic
//      register split:  eval (residual) dynamic  ⊕ known  =  eval p (static ∪ dynamic).
//   3. SPECIALIZATION REDUCES — the residual is strictly shorter when there is static content to fold.
//   4. FRAGMENT BOUNDARY — specialize rejects control flow (honest scope: straight-line only).
//
// Anchors: Kleene (S-m-n); Futamura (1971); Jones/Gomard/Sestoft (online PE, 1993); CHIP-8.

open global.Xunit
open Zeta.Core

/// Compare two register maps on all 16 registers (absent = 0).
let private regsEq (a: Map<int, int>) (b: Map<int, int>) =
    [ 0..15 ]
    |> List.forall (fun r -> (Map.tryFind r a |> Option.defaultValue 0) = (Map.tryFind r b |> Option.defaultValue 0))

let private union (s: Map<int, int>) (d: Map<int, int>) =
    Map.fold (fun m k v -> Map.add k v m) s d

[<Fact>]
let ``EVAL RUNS: the interpreter executes control flow (increment-until-equal loop) correctly`` () =
    // V0 := 0 ; loop: V0 += 1 ; skip JP if V0 == 3 ; JP loop ; HALT   ⇒ V0 ends at 3
    let p =
        Isa.prog [ Isa.set 0 0; Isa.add 0 1; Isa.se 0 3; Isa.jp 1; Isa.halt ]
    match Isa.eval p Map.empty with
    | Ok regs -> Assert.Equal(3, Map.tryFind 0 regs |> Option.defaultValue 0)
    | Error e -> Assert.Fail(sprintf "eval failed: %s" e)

[<Fact>]
let ``MIX CORRECTNESS: eval (residual) dynamic ⊕ known = eval p (static ∪ dynamic) — the S-m-n law`` () =
    // three programs exercising fold, ADDR-with-static-Vy ⇒ ADD-immediate, and the materialize path.
    let cases: (DynamicValue * Map<int, int> * Map<int, int>) list =
        [ // fold V0, ADDR V1 V0 ⇒ ADD imm, materialize V2 before dynamic ADDR
          (Isa.prog [ Isa.add 0 3; Isa.addr 1 0; Isa.set 2 100; Isa.addr 2 1 ], Map.ofList [ 0, 10 ], Map.ofList [ 1, 5 ])
          // MOV/ADD folding, then ADDR with static Vy ⇒ ADD immediate
          (Isa.prog [ Isa.set 0 5; Isa.mov 1 0; Isa.add 1 2; Isa.addr 3 1 ], Map.empty, Map.ofList [ 3, 7 ])
          // ADDR materialize: SET V0 then ADDR V0 Vy(dynamic)
          (Isa.prog [ Isa.set 0 8; Isa.addr 0 1 ], Map.empty, Map.ofList [ 1, 3 ]) ]
    for (p, statics, dynamics) in cases do
        let full = Isa.eval p (union statics dynamics)
        match Isa.specialize p statics, full with
        | Ok(residual, known), Ok fullRegs ->
            match Isa.eval residual dynamics with
            | Ok specd -> Assert.True(regsEq (union known specd) fullRegs, "mix law must hold for every case")
            | Error e -> Assert.Fail(sprintf "eval residual failed: %s" e)
        | Error e, _
        | _, Error e -> Assert.Fail(sprintf "setup failed: %s" e)

[<Fact>]
let ``SPECIALIZATION REDUCES: folding static content shortens the residual`` () =
    // everything but V1's runtime value is static ⇒ most of the program folds away.
    let p =
        Isa.prog [ Isa.set 0 5; Isa.add 0 3; Isa.addr 1 0 ] // V0 fully static (=8); only ADDR V1 V0 survives (as ADD imm)
    match Isa.specialize p Map.empty with
    | Ok(DynamicValue.Array residual, known) ->
        Assert.True(List.length residual < 3, "residual should be shorter than the 3-instruction original")
        Assert.Equal(8, Map.tryFind 0 known |> Option.defaultValue -1) // V0 folded to 8
    | Ok _ -> Assert.Fail "residual should be an array"
    | Error e -> Assert.Fail(sprintf "specialize failed: %s" e)

[<Fact>]
let ``FRAGMENT BOUNDARY: specialize rejects control flow (straight-line fragment only)`` () =
    let withJp = Isa.prog [ Isa.set 0 1; Isa.jp 0 ]
    let withSe = Isa.prog [ Isa.set 0 1; Isa.se 0 1 ]
    Assert.True(
        (match Isa.specialize withJp Map.empty with
         | Error _ -> true
         | Ok _ -> false),
        "JP must be rejected"
    )
    Assert.True(
        (match Isa.specialize withSe Map.empty with
         | Error _ -> true
         | Ok _ -> false),
        "SE must be rejected"
    )
